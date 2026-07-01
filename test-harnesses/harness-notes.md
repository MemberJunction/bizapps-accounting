# harness-notes.md — how to build & run MJ server test harnesses (hard-won)

Practical notes for anyone (human or agent) writing or running the bizapps-accounting
**server integration harnesses** (`test-harnesses/server/block*-runtime.ts`). These are
**tsx live-DB** harnesses that exercise the real MJ data provider + server entity subclasses
against a real instance DB — the exact path MJAPI runs. They are kept, committed, and re-run
on every substantive change. (The Vitest unit tier is separate: pure logic, no DB.)

## How to run
- From the **instance worktree root** (so the instance `.env` resolves from cwd):
  `cd ~/MJDev/instances/<slug>/mj && npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block0-runtime.ts`
- Exit codes: **0** all passed · **1** test failures · **2** bootstrap error.
- Each harness self-bootstraps (creates a tagged throwaway company → W1 seeds COA + periods)
  and tears down by `CompanyID`, so runs are idempotent.

## Hard-won lessons (the WHY — don't relearn these the hard way)

1. **NEVER `await pool.close()` before exiting.** The MJ `SQLServerDataProvider` pool's
   `close()` can hang indefinitely (lingering socket handles), so a harness ending with
   `await pool.close(); process.exit()` prints its summary and then **never exits** — the tsx
   process lingers forever (looks "hung" but it already passed). Use the shared
   **`finishAndExit(summaryLine, code, ...pools)`** helper (`server/harness-exit.ts`): it prints
   the summary, fires each `pool.close()` **non-blocking** (deduped, errors swallowed), then
   `process.exit(code)` to force-terminate. Dropped sockets are harmless for a test harness.

2. **NEVER run two harnesses against the same instance DB concurrently.** Teardown toggles
   `DISABLE TRIGGER ALL` / `ENABLE TRIGGER ALL`, which is **table-level (global), not
   session-scoped**. Concurrent runs race on it + on table locks and mutually block/deadlock —
   you get multiple processes stuck at ~equal CPU, no output. Run them **serially**.

3. **Always re-enable triggers in a `finally`.** Wrap `DISABLE … <deletes> … ENABLE` so the
   `ENABLE TRIGGER ALL` on every toggled table runs even if a DELETE throws. Otherwise a failed
   teardown (or a `SIGTERM` kill mid-teardown) can leave the financial-invariant triggers
   **DISABLED** — a real dev-instance integrity gap. Enabling an already-enabled trigger is a
   harmless no-op, so over-enabling is safe.

4. **Use the db_owner `MJ_CodeGen` connection for trigger toggling + deleting locked rows.**
   The app user `MJ_Connect` deliberately **lacks ALTER** (can't `DISABLE TRIGGER`) and can't
   delete immutable (Batched/GLPosted) rows — that's the security model, not a bug. Open a second
   pool with the `MJ_CodeGen` creds for teardown of locked data; fall back to the app pool (which
   still cleans unlocked rows) when those creds are absent.

5. **UUID case bites.** SQL Server returns UUIDs **UPPERCASE**; `entity.ID` / app-side IDs are
   lowercase. Compare with `UUIDsEqual` / `NormalizeUUID` (from `@memberjunction/global`), never
   `===`. A real production bug hid behind unit tests that happened to control casing — only the
   **live harness** caught it. This is why the live tier exists.

6. **Run the trigger pre-flight at startup.** Call `assertInvariantTriggers(pool)` (see
   `server/trigger-preflight.ts`) right after the pool connects, before any test. It fails fast,
   naming any missing/disabled invariant trigger — so a raw-SQL "bypass" test can never pass
   **vacuously** (succeed because the trigger it was supposed to hit isn't actually there).

7. **Self-bootstrap + FK-aware teardown by `CompanyID`, tagged with a `RUN_TAG`.** Create a
   uniquely-tagged company so runs don't collide, and delete child→parent. Keeps runs idempotent
   and lets you identify/purge orphans from a crashed run.

8. **Don't leave stray background harness processes.** A backgrounded run that lingers (lesson #1)
   or a forgotten wait-loop piles up and then contends with the next run (lesson #2). If you must
   kill one, `pkill -f <block>-runtime`; then verify triggers are ENABLED before trusting the DB.

9. **Ignore the `MISSING FIELDS … BaseEntity::SetMany` console warning** — it's non-fatal noise
   from the provider loading an entity with virtual/extra fields; it does not affect results.

## ‼ Author harnesses at the MAIN process level — NOT in a subagent
**Hard rule (cost + steerability).** Write harnesses yourself, in the main/orchestrator process. Do
NOT delegate harness *authoring* to a subagent. A delegated **Playwright** harness once burned
**~500k tokens / 496 tool calls / ~92 min and hit the org spend limit before finishing** — browser
harnesses thrash on auth + selector iteration, and you cannot see or cap a subagent's loop from the
outside (the cost is invisible until the bill). Author + run + verify harnesses at the top level;
delegate only stable, bounded sub-steps. This is doubly true for Playwright/browser harnesses.

## Checklist for a NEW server harness
- [ ] `import { finishAndExit } from './harness-exit.js';` and `import { assertInvariantTriggers } from './trigger-preflight.js';`
- [ ] Connect the app pool; if you'll touch locked rows, also open a `MJ_CodeGen` db_owner pool.
- [ ] `await assertInvariantTriggers(pool)` before any test.
- [ ] Bootstrap a `RUN_TAG`-tagged company; check `.Success` / `Save()` booleans; use typed
      properties (never `.Get()/.Set()`); `BypassCache: true` for true-DB-state reads; UTC dates.
- [ ] Teardown: wrap any `DISABLE TRIGGER` block in `try { … } finally { ENABLE TRIGGER ALL … }`.
- [ ] End `main()` (and the bootstrap-error path) with `finishAndExit(summary, code, pool, teardownPool)`.
- [ ] Verify it **exits on its own** (no pkill) before trusting it. Never run it concurrently with another harness.
