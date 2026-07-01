# testing.md — bizapps-accounting test ledger + coverage matrix

The **living coverage record** for this app's test suite, per the testing motto (filed in
`~/MJDev/MJDEV-REQUESTS.md`): *every feature, every variation, every layer, every interaction —
alone and composed as you ascend the tiers — fully validated, for all classes and possible data
cases, using prudent discrimination to limit tier-5 overuse but treating all other layers as cheap
and fully fleshing them out.*

Three sections: the **coverage matrix** (drive every ✗ to zero), the **intentional-⚠ register**
(coverage deliberately placed at a cheaper tier — NOT gaps), and the **ledger** (tests still to
create + open questions for the human, recorded so dev can roll through and circle back).

Tiers: **1** Vitest (unit) · **2** server (tsx, in-process direct SQL) · **3** API (GraphQL→MJAPI) ·
**4** GUI/DOM (no-browser — parked, mjdev overlay) · **5** Playwright (browser e2e, pre-PR only).

## Coverage matrix (✓ = real-value/exact · ⚠ = intentional, see register · ✗ = GAP, fill it)

| Feature / interaction | T1 | T2 | T3 | T5 |
|---|---|---|---|---|
| W1 company seeding (COA/periods/refs/TZ/audit) | — | ✓ | — | — |
| JE + batch numbering (W2/W3) | — | ✓ | — | — |
| JE balanced / immutability / period-close (bypass-proven) | ✓ | ✓ | — | — |
| JE validation (F1) | ✓ | ✓ | — | — |
| Adjusting-entry routing (W4) | — | ✓ | — | — |
| Reversal (W6) | — | ✓ | ✓ | ⚠ |
| Batch **netting + canceling** (exact values) | ✓ | ✓ | ✓ | ⚠ |
| GL resolution + COA-mapping approval (Block 5) | — | ✓ | — | — |
| Dimension-through-batch | ✓ | ✓ | ⚠ | ⚠ |
| CFO gate: approve → dispatch | — | ✓ | ✓ | ✓ |
| **Reject/deny → dispatch refused** | — | ✓ | ✓ | ⚠ |
| **No-CFO → build hard-fails** | — | ✓ | ✓ | — |
| **Multi-company independence (no cross-company bleed)** | — | ✓ | ✓ | ⚠ |
| **Due-to/from batched as-is, tag preserved, NO balancing** | — | ✓ | ✓ | ⚠ |
| Scheduled JEs (S3) | ✓ | ✓ | — | — |
| Read-models (TB/AR/aging/defrev/tax/dispatch/intercompany) | — | ✓ | ✓ | ⚠ |
| GUI dashboards + forms + nav | — | — | — | ✓ |

**No open ✗.** Every cell is covered or a justified ⚠ below.

## Intentional-⚠ register (coverage placed at a cheaper/other tier on purpose — NOT shortcuts)

- **Dimension-through-batch @ T3** — fully proven at **T2** (`block2` B5: same account × 2 dim values
  → separate, tagged summary lines, via SQL). The API's `BuildJEBatchResult` is aggregate; the
  consolidation it *does* report (`SummaryLineCount`) is already asserted at T3 (the canceling test in
  `batch-dispatch-api.ts`, 6 lines → 3 summary lines). A dimension-specific T3 test would re-prove the
  same `SummaryLineCount` mechanism on the same engine — redundant. **No API change needed** (an
  earlier proposal to add summary-line dimension fields was withdrawn — never grow the API to serve a test).
- **Reject · netting-exact · reversal · read-model-exact · intercompany · multi-company @ T5** —
  deliberately **thin at tier 5** (browser e2e is expensive). Exact values + variations are proven at
  T1/T2/T3; T5 proves the end-to-end *state machine* + that values reach the screen. This is the
  motto's "prudent discrimination"; tier-4 (the parked mjdev overlay) is the relief valve for fast exact-DOM.

## Ledger — tests still to create + open questions (roll-through: log, proceed, circle back)

**Tests to create:** _none open_ — every matrix gap is filled or a justified ⚠.

**Open questions for the human:** _none open._
- ✅ Due-to/from semantics **confirmed** (Marcelo): Accounting does **no** intercompany netting —
  the Payments component owns it. Accounting receives + batches the tagged JEs as-is. Tested exactly
  that at T2 (`batching-multicompany-runtime.ts`) + T3 (`batching-scenarios-api.ts`).
- ✅ "Change the API for T3 dimension" — **withdrawn** (not needed; observable behavior is covered).

## Harness inventory + run commands (cwd = instance worktree root)

| Tier | Harness | Run |
|---|---|---|
| 1 | `packages/CoreEntitiesServer/src/__tests__/*.test.ts` | `cd packages/dev-apps/bizapps-accounting/packages/CoreEntitiesServer && npx vitest run` |
| 2 | `test-harnesses/server/block{0,1,2,4,5,6}-runtime.ts` · `batching-multicompany-runtime.ts` | `npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/<file>.ts` (per file) |
| 3 | `test-harnesses/api/readmodels-api.ts` · `batch-dispatch-api.ts` · `batching-scenarios-api.ts` | `npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/<file>.ts` |
| 5 | `test-harnesses/playwright/specs/{dashboards,batching}.spec.ts` | `cd …/test-harnesses/playwright && npx playwright test` (MJAPI+Explorer up) |

Latest verified (this session): T1 **32/32** · T2 **65/65** (blocks) + **6/6** (multi-company) ·
T3 **28/28** + **17/17** + **12/12** · T5 dashboards **9/9** + batching green.

**Equivalence run — `codegen-commit-accounting-3` (squashed v1.0 baseline), 2026-06-30 — ALL GREEN:**
T1 **32/32** · T2 **71/71** (65 blocks incl. block2 18/18 once `bizapps-tasks` linked + 6 multi-company) ·
seed **6/6** views (exact values) · T3 **57/57** (28+17+12) · T5 **10/10** (4.3m). Total **170** checks —
matches the pre-squash suite. **Conclusion: the 6→1 migration consolidation is behavior-equivalent — the
squash broke nothing.** (T5 first came back 4/10 red on a stale Explorer manifest — a workaround artifact,
NOT a squash regression; fixed by the manifest-regen step in the recipe below.)

## Running the suite on a NON-DEFAULT instance (env-override recipe)

The harnesses hardcode `bizapps-accounting-dev` + default ports `:4070`/`:4310`. To run on another
instance, override via ENV at run time — **no file edits** (nonstandard-but-OK). Example below is for
**codegen-commit-accounting-3** (API **:4100**, Explorer **:4410**); swap slug/ports for others.

**Prereqs:** `./bin/mjdev setup codegen-commit-accounting-3 all` (deps→build→migrate baseline→codegen→build),
then start MJAPI + Explorer, then run the demo seed. Run tsx harnesses from the worktree root
(`~/MJDev/instances/codegen-commit-accounting-3/mj`) so `.env` resolves.

- **Start MJAPI:** `./bin/mjdev run codegen-commit-accounting-3 api`  (serves on :4100)
- **Start Explorer (ng21 workaround — `mjdev run explorer` injects `--no-interactive` which ng21 rejects):**
  ⚠ FIRST regenerate the class-registrations manifest — the raw `ng serve` below **skips** MJExplorer's
  `prestart` hook that does this, and WITHOUT it the open-app dashboard resources never register, so every
  dashboard T5 test fails with `console.error: Unable to find resource registration for driver class …`:
  `cd packages/MJExplorer && npx mj codegen manifest --exclude-packages @memberjunction --output ./src/app/generated/class-registrations-manifest.ts --open-app-client-bootstrap`
  THEN serve: `NODE_OPTIONS=--max-old-space-size=16384 npx ng serve --port 4410`
  (This `mj codegen manifest` is tree-shaking-prevention, NOT entity/SQL codegen — safe in an instance.
  Verify it reports non-zero classes + "client packages wired". Root-caused in MJDEV-ISSUES.md → ng21 issue, follow-up 2.)
- **Demo seed (DB-direct, no override):** `npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/seed-demo.ts`
- **Tier 1 (Vitest, no DB/API, no override):** `cd packages/dev-apps/bizapps-accounting/packages/CoreEntitiesServer && npx vitest run`
- **Tier 2 (server, DB-direct via .env → NO override; SERIAL):** `npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block{0,1,2,4,5,6}-runtime.ts` and `.../batching-multicompany-runtime.ts`
- **Tier 3 (API — override URL + KEY; the hardcoded INSTANCE_SLUG is only used to mint the key, which MJ_API_KEY bypasses):**
  `MJ_API_URL=http://localhost:4100 MJ_API_KEY="$(./bin/mjdev key codegen-commit-accounting-3 | grep mj_sk_ | tail -1)" npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/readmodels-api.ts` (repeat for `batch-dispatch-api.ts`, `batching-scenarios-api.ts`)
- **Tier 5 (Playwright — override SLUG; ports + magic-link auto-follow):**
  `cd packages/dev-apps/bizapps-accounting/test-harnesses/playwright && MJDEV_SLUG=codegen-commit-accounting-3 npx playwright test` (Explorer must be serving on :4410)

**Portability gap (OK for now):** the three `api/*.ts` harnesses hardcode `INSTANCE_SLUG='bizapps-accounting-dev'`
(used only for `mjdev key`). Passing `MJ_API_KEY` sidesteps it. Future cleanup: make it
`process.env.MJDEV_SLUG ?? 'bizapps-accounting-dev'` to match the Playwright `env.ts` pattern.

**Expectation:** the squashed v1.0 baseline yields the SAME net schema as the old create-then-drop set,
so a fully green run here IS the equivalence proof that the consolidation didn't break anything.
