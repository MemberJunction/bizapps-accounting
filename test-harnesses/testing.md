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

_Reworked 2026-07-06 for the engine-meeting rulings: AccountingPeriod/AccountBalance retired (CH-1),
multi-company JEs + GLOBAL multi-company batches (CH-4/AM-4), batch lifecycle
Pending→Approved→Sent→Posted, ERP resolution falls back to the account Code (AM-4), the SJE
materializer retired (AM-6 — domain servers generate). W4 routing + period-close rows are gone
WITH their features; new rows cover the new invariants._

| Feature / interaction | T1 | T2 | T3 | T5 |
|---|---|---|---|---|
| W1 company seeding (COA/refs/TZ/audit) | — | ✓ | — | — |
| GLAccountRole reference data (8 roles, metadata-sync seed) | — | ✓ | — | — |
| JE + batch numbering — GLOBAL sequences, monotonic (W2/W3, D-SEQ) | — | ✓ | — | — |
| JE balanced-on-lock overall (50001, bypass-proven) | ✓ | ✓ | — | — |
| **JE balanced PER COMPANY (50019, AM-4, bypass-proven)** | ✓ | ✓ | — | — |
| JE / JE-line immutability (50003/50004/50006) | — | ✓ | — | — |
| JE validation (F1, incl. per-company) | ✓ | ✓ | — | — |
| Reversal (W6) | — | ✓ | ✓ | ⚠ |
| Batch **netting + canceling** (exact values) | ✓ | ✓ | ✓ | ⚠ |
| **GLOBAL multi-company sweep (companyCount, per-company netting isolation)** | ✓ | ✓ | ✓ | ⚠ |
| GL resolution — mapping override · inline · **Code fallback (AM-4)** + COA-mapping approval (Block 5) | — | ✓ | — | — |
| Dimension-through-batch | ✓ | ✓ | ⚠ | ⚠ |
| **approveBatch step (audit stamps · only-Pending guard · dispatch-before-approve refused)** | — | ✓ | ✓ | ✓ |
| CFO gate: approve → dispatch → **Posted** | — | ✓ | ✓ | ✓ |
| **Reject/deny → dispatch refused (both layers)** | — | ✓ | ✓ | ⚠ |
| **No-CFO → build hard-fails** | — | ✓ | ✓ | — |
| **Multi-company CFO UNION (one Task, all companies' CFOs)** | — | ✓ | — | — |
| **Due-to/from batched as-is, tags preserved, NO balancing** | — | ✓ | ✓ | ⚠ |
| Batch summary foots overall (50014) + **per company (50023, AM-4)** — bypass-proven | — | ✓ | — | — |
| Scheduled JEs (S3 create + cent-spread) + **AM-6 domain-generation flow** + SJE locks (50016-18) | ✓ | ✓ | — | — |
| Read-models (all 12 views, exact values; month-grain recon/rollforward) | — | ✓ | ✓ | ⚠ |
| **Engine: CreateJournalEntry pipeline (7 error codes, merge/order, per-company balance)** | ✓ | ✓ | ✓ | — |
| **Engine: atomic write (mid-write failure → ZERO partial rows, raw-SQL proven)** | — | ✓ | — | — |
| **Engine: ResolveLinkedAccount (role links, date windows, ordered dims)** | ✓ | ✓ | — | — |
| **Engine: op over GraphQL ExecuteRemoteOperation (A5 "runs on local")** | — | — | ✓ | — |
| GUI dashboards (Batch Dispatch + 4 read-model) + forms + nav | — | — | — | ✓ |
| GUI dashboards NEW (JE Console · Chart of Accounts · Company Setup · Approvals) | — | — | — | ✗ (ad-hoc headed walks only, 0 errors — no committed Tier-5 specs; see Ledger) |

**No open ✗.** Every cell is covered or a justified ⚠ below.

## Intentional-⚠ register (coverage placed at a cheaper/other tier on purpose — NOT shortcuts)

- **Dimension-through-batch @ T3** — fully proven at **T2** (`block2` B5: same account × 2 dim values
  → separate, tagged summary lines, via SQL). The API's `BuildJEBatchResult` is aggregate; the
  consolidation it *does* report (`SummaryLineCount`) is already asserted at T3. **No API change
  needed** (never grow the API to serve a test).
- **Reject · netting-exact · reversal · read-model-exact · intercompany · multi-company @ T5** —
  deliberately **thin at tier 5** (browser e2e is expensive). Exact values + variations are proven at
  T1/T2/T3; T5 proves the end-to-end *state machine* + that values reach the screen.

## Ledger — tests still to create + open questions (roll-through: log, proceed, circle back)

**Tests to create — ✗ GAP (management UI, 2026-07-08):** the new Explorer dashboards below were validated
**ad-hoc** with headed Playwright walks (rendered + drove the flow, **0 console/pageerror**) but have **NO
committed Tier-5 specs** yet — treat as a coverage gap to fill (Tier-5 `dashboards.spec.ts` pattern):
  - **Journal Entries Console** — filter/status chips, expand→Dr/Cr lines, source-order drill, Generate reversal.
  - **Chart of Accounts** tree — company selector, type filter, drill to account (now via in-app form dialog).
  - **Company Setup** — CFO assign ("Make me the CFO"), default-account pickers + code display, Open profile dialog.
  - **Batch Approvals** inbox — pending-approval list + Approve/Reject.
  (Existing Batch Dispatch + 4 read-model dashboards keep their Tier-5 10/10.)
- ✅ GLAccountLink / GLAccountLinkDimension — covered 2026-07-06 (engine step-4): `pickActiveLinkIndex` unit +
  `engine-runtime.ts` E4.

**Open questions for the human → see `instances/accounting-engine-dev/QUESTIONS.md`:**
- ✅ **Batch reject semantics** (Q4) — RESOLVED 2026-07-08 (Robert: levels of locking). Reject now reverses the
  **preliminary** lock: `cancelBatch` → batch Cancelled + entries back to the candidate pool. Proven in `block2`
  (`#12 cancelBatch`) + live through MJAPI. Impl: migration `V202607081600` + `BatchingEngine.cancelBatch`.
- ✅ **buildBatch atomicity** (Q5) — RESOLVED 2026-07-08. A failed approval-task raise now auto-reverses the batch
  (reversible preliminary lock) instead of stranding a task-less orphan. Proven in `block2` (`no CFO → auto-reverse`).
- ⏳ **Follow-on GAAP calls (Q12–Q15, high-priority for Robert):** reversal same-period-vs-forward-date, batch cutoff
  (oldest-forward), out-of-order approval, backdated-order JE date. Provisional answers coded; confirmations shape the
  deferred filter/backdating work (plan `batch-approval-lock-redesign.md` §13–14). Do NOT block the shipped reject fix.
- ✅ Due-to/from semantics **confirmed** (Marcelo): Accounting does **no** intercompany netting — Payments owns it.

**Batch-lock redesign (#12, 2026-07-08) coverage:** `block2` now **24/24** — adds `#12 cancelBatch` (reject-unlock),
`#12 permanent lock` (approved → raw unlock rejected by trigger), `#12 regenerateBatch` (re-gathers a since-added JE),
and upgrades the `no CFO` test to assert auto-reverse. Live end-to-end validated through MJAPI (build→reject→Cancelled+freed;
build→regenerate→jeCount grows; approve→dispatch→Posted). **Gap:** literal in-browser click of the Reject/Regenerate
buttons in Explorer (UI compiles + markup present; the exact resolver calls the buttons make are proven live).

## Harness inventory + run commands (cwd = instance worktree root)

| Tier | Harness | Run |
|---|---|---|
| 1 | `packages/CoreEntitiesServer/src/__tests__/*.test.ts` | `cd packages/dev-apps/bizapps-accounting/packages/CoreEntitiesServer && npx vitest run` |
| 2 | `test-harnesses/server/block{0,1,2,4,5,6}-runtime.ts` · `batching-multicompany-runtime.ts` · `engine-runtime.ts` | `npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/<file>.ts` (per file) |
| 3 | `test-harnesses/api/readmodels-api.ts` · `batch-dispatch-api.ts` · `batching-scenarios-api.ts` · `engine-op-api.ts` | `npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/<file>.ts` |
| 5 | `test-harnesses/playwright/specs/{dashboards,batching}.spec.ts` | `cd …/test-harnesses/playwright && npx playwright test` (MJAPI+Explorer up) |

Latest verified (2026-07-06, instance accounting-engine-dev, post-rework — API :4050, Explorer :4310):
T1 **39/39** · T2 **76/76** (block0 10 · block1 11 · block2 21 · block4 7 · block5 5 · block6 13 ·
multi-company 9) + seed **6/6** views · T3 **64/64** (dispatch 20 · readmodels 29 · scenarios 15) ·
T5 **10/10** in one run, 4.3m (after two REAL catches: the dashboard's Pending-only approval-state
refresh hid the Dispatch button — fixed; and MJ core's DataExplorerDashboard NG0100 relative-time
flake — logged in BUGS.md + component-scoped keystone allowlist). **Total 195 checks green.**
AM-7 step-4 ENGINE (2026-07-06, same instance): unit **76/76** (EngineBase 37 — pipeline+link picker;
CoreEntitiesServer 39) · T2 `engine-runtime.ts` **12/12** (success/merge/order · all 7 typed error codes
live · ATOMIC ROLLBACK raw-SQL-proven · ResolveLinkedAccount windows) · T3 `engine-op-api.ts` **8/8**
(the op over GraphQL `ExecuteRemoteOperation` — typed contract on the wire, logical failures inside the
output, unknown-key gate). The engine has a bounded cache-miss retry (one forced refresh on
unknown-reference errors) for cross-process reference writes. ⚠ MJ-core TG-failure crash bug + guard:
see BUGS.md.
(Explorer needs the peer-dep workaround from MJDEV-ISSUES until fixed: `npm install
@angular/service-worker@21.1.3 aws-amplify@6.16.3 primeng@21.1.1 --no-save` after any full npm install.)

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
