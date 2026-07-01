# test-harnesses

All of bizapps-accounting's **kept, maintained** test harnesses live here, one folder per tier.
These are living regression assets — they are committed and re-run on every substantive change
(unlike `logs/`, which is throwaway). The pure-logic **Vitest** unit suites are NOT here; they
live with their packages (`packages/*/src/__tests__/*.test.ts`, no DB) per MJ convention.

## Coverage bar — each tier fully validates its layer to a *shippable* level

The tiers are **horizontal swatches**, not a smoke ladder. The governing rule:

- **Each tier validates its layer to a shippable bar.** Green at tier N means everything that tier
  depends on (the contract it consumes from the layer below), everything it tested, and all of its
  own layer's code is trustworthy — so the **next tier up can assume any failure is in *its own*
  block, not below it.** After the whole pyramid is green you can ship; after a *single* tier is
  green you can trust *that layer* and what it sits on. (e.g. tier 3 green ⇒ "I could ship MJAPI".)
- **Overlap is intentional and useful** (it localizes failures). It does NOT mean re-testing the
  lower layer's internals: each tier validates **(a)** its own layer's behavior **+ (b)** that the
  contract it consumes from below actually holds — driven by expected behavior, use cases, and
  documented/planned functionality.
- **Liveness ≠ testing.** "The query returned an array" / "the page rendered" is NOT coverage.
  Assert **real expected values** (the trial balance foots to 3920; AR-open = 1000/1000/300 = 2300;
  tax outstanding = 1150). Where a value is inherently date-relative (AR aging buckets age with the
  calendar), assert the **drift-proof invariant** (buckets sum to TotalOpen), never a value that
  rots — but never fall back to liveness.
- **Test against the SPEC of what should exist, not just observed behavior.** A green suite cannot
  catch the absence of a thing it never checks. (Lesson: the GUI "registration" was validated by
  what the tests happened to click — nav rendered, so it looked done — while a *separate* concern
  went unasserted because nothing checked it. Validate each layer against a checklist of what
  *complete* means, not just against the paths you happened to exercise.)
- **Tier-1's boundary = the EXTRACTED pure seams.** Services deliberately extract their pure logic
  into sync exported helpers (`netLines`, `checkBalance`, `computeStraightLineSchedule`,
  `rangesOverlap`, `mapScheduledEntryType`, the seed constants) so it's unit-testable in isolation
  and **edge-complete** (penny-rounding, balance tolerance, zero-net drop, foots, throws) — while the
  DB orchestration around them stays at tier-2. A service that is all-async/DB correctly has **0**
  tier-1 tests; that's the layer boundary, not a gap. (The JE/batch numbering *format* lives in SQL
  sprocs → proven at tier-2 `block0`, not tier-1.)

## Tiers

| Folder | Tier | Runner | Touches | What it proves |
|---|---|---|---|---|
| `server/` | Server-side integration | `tsx` scripts | a **live instance DB** through the real MJ data provider (the exact path MJAPI runs) | W*/lifecycle hooks, DB-level invariant triggers (raw-SQL **bypass** proofs), numbering sprocs, RecordChange audit, the batching / scheduled-JE / COA-mapping-approval engines + read-model views |
| `api/` | API contract (GraphQL → MJAPI) | `tsx` scripts | the running **MJAPI** over HTTP/GraphQL with `X-API-Key` auth (the transport the dashboards + external clients call) | resolver **values + auth + scoping** (7 read-models, REAL values) AND the **mutation flow** (build → approve → dispatch → reverse) — i.e. "could I ship MJAPI" |
| `playwright/` | GUI end-to-end | Playwright + **system Chrome** (`channel: 'chrome'`, headless) | the **instance's** MJExplorer (the one shipped with the instance worktree — NOT the app's relic `apps/MJExplorer`) | UI presence **and** behavior — the dual-layer protocol (a control renders AND clicking it drives the real engine and reflects state) |
| `test-auth/` | (support, **gitignored**) | — | local auth secrets only | holds the persisted browser auth profile + any persona keys the Playwright tier needs. **Contents are gitignored**; see `test-auth/test-auth.md` for what to put here. |

## Running

### server/ (live-DB integration)
Reads DB settings from the instance `.env`, so run from the **instance worktree root**
(`~/MJDev/instances/<slug>/mj`):
```bash
cd ~/MJDev/instances/<slug>/mj
npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block0-runtime.ts
```
Exit code: `0` all passed · `1` test failures · `2` bootstrap error. Each script self-bootstraps
(creates a throwaway company → W1 seeds COA + periods) and tears down by `CompanyID`, so runs are
idempotent. A shared `server/trigger-preflight.ts` fails fast (naming the missing/disabled trigger)
if the financial-invariant triggers aren't present + enabled — so a "bypass" test can never pass
vacuously. See `server/README.md` for the per-script matrix.

### playwright/ (GUI e2e)
Drives the **instance** Explorer (launched via `mjdev run <slug> explorer` / a magic-link session
from `mjdev explorer-url <slug>`). Uses system Chrome in headless mode and a persisted auth profile
under `test-auth/` (gitignored). See `playwright/README.md` for setup + the auth bootstrap.

> **Generated artifacts stay uncommitted.** CodeGen output (generated TS/SQL, Angular forms,
> `SQL Scripts/generated/`, `migrations/codegen/`, synced `metadata/`) is left uncommitted for the
> user's single "generated commit." Hand-written harness code here IS committed.
