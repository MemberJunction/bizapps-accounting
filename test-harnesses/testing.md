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
**4** GUI/DOM (no-browser — **LIVE since 2026-07-16**, see below) · **5** Playwright (browser e2e, pre-PR only).

### Tier 4 is no longer parked (2026-07-16, UI wave §8.0)

Tier 4 now exists at `packages/Angular/vitest.dom.config.ts` (+ `vitest.dom.setup.ts`,
`tsconfig.spec.json`); specs live BESIDE their components as `*.dom.test.ts`.
Run: `cd packages/Angular && npm run test:dom`.

- **Real Angular, headless** — `@analogjs/vite-plugin-angular` + jsdom + a **zoneless** TestBed.
  No browser, no MJAPI, no HTTP.
- **The keystone is wired and PROVEN:** any `console.error`, Angular `ErrorHandler` hit, or
  unhandled rejection during a render **fails the test**. Mutation-checked — a probe spec whose
  body passed still failed the run purely on a console error, so the keystone is not decorative.
- **Why it is self-contained (not MJ's preset):** MJ ships an equivalent, but neither half is
  reachable from an open app — `vitest.dom.shared.ts` is a ROOT-level file (exported from no
  package) and `@memberjunction/ng-test-utils` is `"private": true`. Inside a dev-linked instance
  we could reach both, but bizapps-accounting is a **standalone repo**: a harness that only runs
  when dev-linked silently stops running in the app's own CI. So the (small) preset is replicated
  here against public packages only. Filed upstream in `~/MJDev/MJDEV-REQUESTS.md` — if MJ
  publishes the kit, delete our copy and extend theirs.
- **Honest scope today:** the DOM contract over the UI layer (render, gating, bindings, real values
  reaching the DOM, click→behaviour). The doctrine's **in-process real-DB binding**
  (`setupSQLServerClient`, the tier-2 path) is **NOT yet wired** — the first tier-4 spec covers a
  component whose data comes from an injected service, so it did not need it. That binding is the
  next tier-4 step and is tracked in the ledger below; until then, do not read tier-4 green as
  proof of the data path (tier 2/3 own that).

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
| GUI dashboards NEW (JE Console · Chart of Accounts · Company Setup · Approvals) | — | — | — | ✓ (committed Tier-5 specs, all green 2026-07-10: `accounting-je-console` 3/3, `accounting-chart-of-accounts` 3/3, `accounting-company-setup` 3/3, `accounting-batch-approvals` 1/1) |

**No open ✗.** Every cell is covered or a justified ⚠ below.

_2026-07-10 rollout (Task 36) — full re-baseline on the lived-in `accounting-engine-dev` instance:_
- _T1 86/86 · T2 all blocks green · T3 accounting core 43/43 · T3 orders (NEW `order-to-je-api` 35/35) · T5 new dashboards 10/10 + stable existing 6/6._
- _**block6 hardened:** `vw_ARtoGLRecon` check rewritten from a fixed "2 GLPosted this month" absolute to a **base-table reconciliation** — isolation-proof against accumulated demo/test data (13/13)._
- _**readmodels-api 22/29:** the 7 reds are the shared Association demo company `CO1` carrying extra data (all drift-proof invariants pass → resolvers correct). Fixed a real null-CustomerName crash. Design decision (isolate vs. drift-proof vs. clean+reseed) logged in the instance `QUESTIONS.md`._
- _**T5 spec-drift fixes:** FontAwesome icon glyphs pollute button accessible names → use substring/regex name matches (not `exact`). Batch Approvals card needs a manual Refresh to reflect Approved post-approve (low-sev reactivity gap, logged in `BUGS.md`; spec drives Refresh)._
- _**Stale existing specs (NOT yet reconciled):** `batching`, `batching-reject`, `dashboards` pre-date the Batch UI refactor (nav "Batches" removed → "Batch Approvals"; Build moved to a Batch Status preview dialog). Reconciliation scoped (feeds Task 40/51)._

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
build→regenerate→jeCount grows; approve→dispatch→Posted). **GUI layer:** `specs/batching-reject.spec.ts` (Playwright, system
Chrome) drives the live Explorer — Build→**Reject** (card flips to Cancelled + banner)→Build→**Regenerate** (rebuild banner),
0 console errors — **passed 1/1**. Dual-layer complete.

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

_2026-07-10 (session 2) — batch-approval reactivity fix + stale-spec reconciliation:_
- _**FIX (product):** `BatchDispatch/loadBatches()` now uses `RunView({ BypassCache: true })`. The batch status
  transitions run through server resolvers (buildBatch/approveBatch/sendBatch/recordDecision), not a client
  BaseEntity.Save(), so MJ's read cache wasn't invalidated → the inbox card showed a stale "Pending" after
  Approve until a manual Refresh. GUI-verified: `accounting-batch-approvals` now flips Pending→Approved→Posted
  reactively (no refresh)._
- _**Spec reconciliation (post Batch-UI-refactor, Tasks 23/38/39/46):** `batching.spec` DELETED (its
  Dispatch→Posted step folded into `accounting-batch-approvals`, which now covers the full Build→Approve→
  Dispatch→Posted spine). `batching-reject.spec` REWRITTEN to the current flow (Build on Batch Status → Reject
  on Batch Approvals) — scoped to the awaiting-approval card (shared-demo-data safe); asserts the #12 core
  (Reject→Cancelled + entries-freed). `dashboards.spec` TRIMMED from 9→4 tests: removed GL-Accounts grid/form +
  JE grid-form (now covered by `accounting-chart-of-accounts` + `accounting-je-console`) and Batch Approvals/
  Batch Status cards (redundant with the dedicated specs); kept the read-model dashboards + nav smoke._
- _**Raised (BUGS.md):** (1) Batch Approvals card needed manual Refresh after Approve — FIXED. (2) rebuild-after-
  Reject produced no new Pending batch despite the "entries returned to candidate pool" banner — under
  investigation; batching-reject asserts the verified #12 core only, not forced green._
- _T5 green after this round: `accounting-batch-approvals` (full spine, reactive) · `batching-reject` (#12) ·
  `dashboards` 4/4 · plus the earlier-green je-console/chart-of-accounts/company-setup/orders specs + stable set._

---
### 2026-07-14 — A4 single-company JE restoration (MOD-12) — full re-baseline
Schema plan A3 (audit — see `docs/bizapps-accounting-erd.md` appendix) + A4 executed; baseline
`B202605281200` edited in place (collapse-into-baseline; `V202607081600` folded in + deleted).

**What changed under test:** `JournalEntry.CompanyID NOT NULL` + FK + immutability-frozen +
lock-time company-coherence trigger (THROW **50025**); pipeline stage 5 = whole-entry balance +
**MULTI_COMPANY_DRAFT** (AM-4 per-company balance collapsed); numbering per company
`JE-{CompanyCode}-{FY}-{seq}` (`JournalEntrySequence` re-keyed `(CompanyID, FiscalYear)`; sproc
THROW **50024** on missing ACP; FY from ACP FiscalYearStartMonth/Day); `ApprovalCFOUserID`
replaces `ApprovalCFOPersonID` (A4.6 — gate assigns tasks to **Users**; decisions stay
Person-keyed per the tasks-app FK).

**Suite results (all re-run this session):**
- T1 EngineBase vitest **39/39** ✓ (stage-5 rework: MULTI_COMPANY_DRAFT cases incl. balanced-per-
  company rejection + combined MULTI+UNBALANCED; companyID surfaced in the pipeline outcome).
- T1 CoreEntitiesServer vitest **39/39** ✓.
- T2 block0 **12/12** ✓ — numbering re-baselined: W2.1 `JE-{CompanyCode}-{FY}-{seq}`, W2.2 per-
  company monotonic, **NEW W2.3** second company starts at 000001 (per-company independence),
  **NEW W2.4** 5 concurrent JEs → unique gap-free run (AD-17). Batch numbering stays GLOBAL (W3).
- T2 block1 **13/13** ✓ — 50019 cross-company-unbalanced kept; **INVERTED** old "multi-company
  balanced locks" → now REJECTED (50025); **NEW** CompanyID-frozen-once-locked (50004/50025,
  either trigger may fire first — order undefined); raw-INSERT paths carry CompanyID.
- T2 block2 **24/24** ✓ — approval gate on CFO **Users** (assignment entity = MJ: Users); reject-
  unlock + regenerate + netting + multi-company batch sweep intact; makeJE company-scoped.
- T2 block4 **7/7** ✓ · block6 **13/13** ✓ · batching-multicompany **9/9** ✓ (batches still span
  companies — CH-4 unchanged; only the JE is single-company).
- T2 engine-runtime **13/13** ✓ — E1 asserts JE.CompanyID stamped + new number format; E2 gained
  the two MULTI_COMPANY_DRAFT cases.
- T3 engine-op-api **8/8** ✓ over live GraphQL (MJAPI :4030) — numbering assert updated.
- Cross-app: orders order-to-je **6/6** ✓ (N-single-company-JEs + O6 numbering) ·
  order-to-glposted full cycle ✓ (order → per-company JE → batch → approve → send → GLPosted).
- Demo: `seed-demo.ts` **6/6 views** ✓ (ensureCompany now sweeps orphan __mj.Company rows left by
  `app drop-schema` — same hardening in orders' seed-demo-catalog).
- Teardown hardening (all suites): per-company `JournalEntrySequence` rows deleted before company
  rows (new FK); block0 W2.3 companies tracked + swept.

**2026-07-14 (later) — atomic SET op (`Accounting.CreateJournalEntries`):** per Amith's transaction
rule, a new set-form remote op validates EVERY draft (set errors carry `DraftIndex`) then writes all
drafts' rows in ONE TransactionGroup. Orders' Confirm books through it (compensation path deleted).
engine-runtime grew to **16/16** with E5: set success (2 companies, distinct numbers) · set
validation (one bad draft rejects all, nothing written) · **SET ATOMIC ROLLBACK** (stale-cache FK
failure in draft 2 rolls back draft 1 — raw-SQL proven). order-to-je re-run **6/6** through the new
path; demo reseeded through it.

**Known gaps / labels:**
- ~~Orders' booking-set compensation not live-proven~~ — RETIRED 2026-07-14: the compensation path
  no longer exists; cross-draft atomicity is live-proven (E5).
- Playwright (tier 5) specs incl. the batching fixtures were updated for ApprovalCFOUserID but NOT
  re-run this session (the UI workstream owns their next run); batching fixtures now assign the
  running user as CFO.

## Tier-5 spec debt created by the UI wave (recorded 2026-07-16 — MUST fix in the tier-5 pass)

Marcelo's sequencing (2026-07-16): **UI first, tiers 1–3 as we go, tiers 4–5 after the UI is
complete.** That means the UI wave is knowingly invalidating committed tier-5 specs as it retires
old screens. They are listed here so the tier-5 pass is a checklist, not an archaeology exercise.
**Do not delete these specs — repoint them.**

| Spec | What broke it | Fix |
|---|---|---|
| `playwright/specs/accounting-je-console.spec.ts` | The flat **"Journal Entries" → `JournalEntryConsoleResource`** nav item was REPLACED by the category shell (`JournalEntriesCategoryResource`) once All-journal-entries reached parity (§6 sweep). The spec navigates by the nav label and then asserts JE-Console selectors, so it will now land on the category and fail. | Repoint at the category: nav label "Journal Entries" → rail item **"All journal entries"** → the `mj-entity-data-grid` + the `mj-journal-entry-detail-panel` slide-in (`.jed__*`). The BEHAVIOURS to keep proving are the same: reversal, source-order drill-through, lines + totals, status filter. |
| `playwright/lib/env.ts` `NAV.journalEntries` | Still correct as a LABEL, but it now resolves to the category shell, not the console. | Keep the label; add rail-item constants for the pages inside a category. |
| `playwright/specs/accounting-batch-approvals.spec.ts`, `batching-reject.spec.ts`, `dashboards.spec.ts` | The flat **"Batch Status"** + **"Batch Approvals"** nav items were REPLACED by the **Batches** category (§8.2). Both dashboards still exist and their engines/logic are UNCHANGED — they were migrated to `<mj-page-header-interior>` and are now hosted as rail pages ("All batches" / "Batch approvals"). Specs navigating by the old flat labels will not find them. | Repoint: nav "Batches" → rail item "Batch approvals" / "All batches". Selectors INSIDE the dashboards (`.bd-card`, `.bd-metric`, Approve/Reject/Dispatch) are unchanged, so only the navigation preamble moves. `dashboards.spec.ts`'s `CURRENT_NAV` list must drop "Batch Status"/"Batch Approvals" and add "Batches". |
| `playwright/lib/env.ts` `NAV.batchStatus` / `NAV.batchApprovals` | Same cause. | Replace with a `Batches` category label + rail-item constants. |

**Not yet covered at tier 5 at all (new surface):** the nav rail renders the approved sections; the
company scope chip persists across reload (UserInfoEngine, not localStorage); filters drive the grid
server-side; row → detail slide-in shows lines/lineage/reversal chain/C.8 chip.

**The JE Console component is deliberately NOT deleted** — only un-navigated. It stays as the
behavioural reference until the tier-5 pass proves the new page covers it, then it goes at sweep
close. Deleting it before its replacement is proven would destroy the only working reference.


## KNOWN RED — MOD-14 vs the Q5 no-CFO ruling (2026-07-16, deliberate)

`block2-runtime` → **27/28**. The one red is **not** a broken test and **not** a bug to squash:

`S1 real gate — no CFO configured → buildBatch hard-fails AND auto-reverses (Q5 atomicity)`
> `Error: expected an error containing "No CFO configured" but none was thrown`

It encodes the **Q5 ruling** (no CFO → build hard-fails). **MOD-14** (Marcelo, 2026-07-16) says a
build must never be gated on the approval-task raise — and as implemented it swallows the no-CFO
case too, so the build now succeeds and leaves a batch nobody can approve.

**Left red on purpose.** Re-baselining it would silently retire a ruling Marcelo made, which is
exactly the "green because we changed the test" failure mode. The reconciliation is proposed in
[Q28](../plans/QUESTIONS.md#q28): treat *no CFO configured* as a **precondition** checked BEFORE any
write (build nothing), and keep MOD-14's never-destroy-a-built-batch rule for the task-raise itself.
That satisfies both rulings and is better than the old behaviour, which built the batch and then
cancelled it. **Fix the test when Marcelo rules — not before.**

The three new MOD-14 tests are green: failing-gate-does-not-destroy-the-batch, real-gate-stamps-the-
pointer (and the id resolves to a live Task), and the half-stamp being unrepresentable (raw-SQL
bypass-proven).


---
### 2026-07-18 — full 5-tier roll-through (real-client tier 3 + new gui tier 4 + tier-5 new-nav)
Instance accounting-engine-dev · MJAPI :4030 (RESTARTED this session — was stale, see below) · Explorer :4390.

**Tier 1 (unit):** EngineBase **39/39** · CoreEntitiesServer **87/87** (re-run, green).
**Tier 2 (server/tsx live DB):** after a test-data reset (swept 1 stray Pending JE via `_maint-post-stray`):
block0 12 · block1 13 · block2 **28/28** (the old 27/28 MOD-14-vs-Q5 red is now green — reconciliation landed) ·
block4 7 · block5 5 · block6 13 · multicompany 9 · engine-runtime 16 · scheduled-je 5. ALL GREEN.
**Tier 3 — NOW DRIVES THE APP'S REAL CLIENT (was hand-rolled fetch):**
- NEW `api/readmodels-client.ts` **29/29** — drives the real `ReadModelsClient` (exact values: TB foots 3920, AR 2300, aging buckets sum to TotalOpen, intercompany scoping).
- NEW `api/batch-dispatch-client.ts` **20/20** — real `BatchDispatchClient`+`JournalEntryClient` (build netted 600, CFO gate, dispatch-refused-before-approval, dispatch→Posted, reversal).
- NEW shared `api/_client-bootstrap.ts` (setupGraphQLClient; port from `mjdev ps`, key from `mjdev key`).
- Verified on fresh MJAPI: engine-op 8/8 · batching-scenarios 15/15. (Old `readmodels-api.ts`/`batch-dispatch-api.ts` retained for the negatives the client swallows to [].)  **Tier-3 total: 65 acct checks.**
- ENV LEARNINGS: (1) run the direct-SQL subprocess fixture BEFORE bootstrapping the GraphQL client (else stale keep-alive → ECONNRESET on the first mutation). (2) **MJAPI was STALE** (buildBatch atomic write failed via API while tier-2 in-process was green) → `mjdev restart accounting-engine-dev api` FIXED it. This also unblocked the pre-existing raw batch-dispatch-api.ts, which was failing identically.

**Tier 4 — NEW mjdev gui harness (component → real GraphQL client → MJAPI → DB, AOT jsdom):**
Installed via `mjdev app gui-test sync accounting-engine-dev bizapps-accounting`. Suite **4/4**:
`example.dom.test` (smoke) · `batch-status.dom.test` (render) · NEW `trial-balance-ar.dom.test` (EXACT: foots 3920, nets 0, AR 11201 = 2300, open AR 2300) · NEW `revenue-tax.dom.test` (EXACT: defrev additions 300/releases 120→a period closes at 180; tax accrued 1500/remitted 350/outstanding 1150; PartiallyPaid 1000/650).
Pattern: render INSIDE the `it` (scaffold beforeEach re-configures TestBed); pin `SelectedCompanyID` before `detectChanges`; assert the component MODEL for exact values (AG-Grid is external in jsdom → no cell paint); keystone clean.
KNOWN (shelved, non-blocking): a `TypeError: undefined (reading 'push')` fires in the BaseDashboard lifecycle OUTSIDE loadData — Vitest prints it but does NOT fail the test; escapes all keystone channels + console/stdout interception. Keystone-gap + latent lifecycle item → for the MJDev agent (scaffold bootstrap provider).

**Tier 5 (playwright, browser):** harness verified (system Chrome + magic-link auth + Explorer). NEW `specs/reports-nav.spec.ts` GREEN — Reports category rail → 'Trial balance (AR)' → renders, 0 console errors.
NAV-DEBT (pre-existing): the committed specs navigate by RETIRED flat nav labels (UI wave → category rails); `dashboards.spec` fails 4 on old labels. Reconciliation pattern proven in reports-nav.spec: category is a visible link; **rail items are `getByRole('button',{name})`** (a hidden `.mj-left-nav__switcher-label` span with the same text defeats `getByText().first()`); interior pages have **no `mj-page-body`** (assert dashboard content). Remaining repoint = bounded mechanical follow-up (tier 4 now owns these dashboards' values).

_All new files uncommitted (holding per instruction). Reasonable-default decisions logged in the response._

### 2026-07-18 (correction 2) — engine-op tier-3 converted to the real client
NEW `api/engine-op-client.ts` **8/8** — `Accounting.CreateJournalEntry` via **`provider.RouteOperation`** (the real remote-op call the browser makes), replacing the hand-rolled `ExecuteRemoteOperation` GraphQL of `engine-op-api.ts`. Same proofs: success + duplicate-debit merge (LineCount 2) + EntryNumber format; unbalanced → `Output.Success:false`/UNBALANCED (transport green); unknown key refused. Tier 3 accounting is now: readmodels-client 29 + batch-dispatch-client 20 + engine-op-client 8 on the REAL client. `batching-scenarios` convert = OPEN (gap 3a).

### 2026-07-18 (correction 3) — batching-scenarios converted to the real client
NEW `api/batching-scenarios-client.ts` **15/15** — multi-company sweep (JECount 3 / CompanyCount 2 / foots 1000/1000), due-to/from preserved through batching, reject→dispatch-refused, no-CFO hard-fail — all via **`BatchDispatchClient`** (BuildBatch/RecordDecision/GetApprovalState/DispatchBatch) + **`ReadModelsClient.IntercompanyFlow`**, replacing the hand-rolled `fetch` of `batching-scenarios-api.ts`. Warmup read after each seed-wave subprocess (stale-keep-alive rule). **Tier 3 accounting is now FULLY on the real client: readmodels 29 + batch-dispatch 20 + engine-op 8 + batching-scenarios 15 = 72 checks** (gap 3a CLOSED).

### 2026-07-18 (correction 4) — TIER 4 dashboard breadth filled (gap 4a CLOSED)
Accounting gui suite **9/9**: added `je-console` · `chart-of-accounts` (AllAccounts>0, every Code) · `company-setup` (profiles>0) · `batch-dispatch` (Batches array + StatusOptions; provides PageRefreshService) · `intercompany` (pinned CO2, Legs>0, every EntryType IntercompanyFlow) — all render real data through the real client, keystone-clean. Plus the earlier trial-balance-ar/revenue-tax (exact) + batch-status. Every data-driven accounting dashboard now has a tier-4 spec.

### 2026-07-20 — JE workspace counterparty picker (tier-1 mapping + tier-3 persistence)
Added a per-line **Counterparty** (`CounterpartyOrganizationID`) picker to the manual-JE workspace (Marcelo, 2026-07-20 — "visibility/testing, dial in later"). The field was already in the `CreateJournalEntry` contract + persisted by the engine (`AccountingEngine.ts:280`), so this is UI-only (draft + `toCreateInput` mapping + picker):
- **`je-draft.test.ts` now 31/31** (was 29) — `toCreateInput` sends `CounterpartyOrganizationID` when picked, omits it (absent, not null) when not. Proves the UI→contract half.
- **contract→engine→DB half proven live** in the orders tier-3 harness `order-to-je-client.ts` **31/31** (payment-capture AR line carries the counterparty — same `CreateJournalEntry` path). See orders `testing.md` 2026-07-20.
- **✅ tier-4 CLOSED (2026-07-20, same day):** added `je-workspace.dom.test` (real API) — renders the workspace cleanly (keystone) + asserts the Counterparty column renders + options load through the real client. 1/1 green.
- The counterparty picker's options load from `MJ_BizApps_Common: Organizations` (one read at open); optional, only meaningful on AR lines.

### 2026-07-21 — JE create-form INPUT VALIDATION proven at both layers (golden-path campaign, step 1)
The everyday-use bar: the FRONTEND blocks invalid input AND the engine enforces it. Prior coverage proved the pure gate logic (tier-1) and the engine rejection (tier-3), but NO test drove the real form asserting the button is disabled. Closed that:
- **NEW tier-4 `je-workspace-validation.dom.test` 1/1** (9 scenarios, real component) — drives `JEWorkspacePageComponent` through every invalid-input class and asserts the Create button is truly `disabled` in the DOM: empty draft · no-company (accounts un-choosable) · unbalanced (Dr100/Cr50, strip shows "Not balanced") · <2 lines · missing date · line missing account; and that a BALANCED valid entry ENABLES the button (gate lets valid through). STRUCTURAL: the account picker offers ONLY the picked company's ACTIVE accounts (cross-company/inactive/unknown unbuildable) and clears line accounts on company change. Read-only — never submits, zero residuals, demo untouched.
- **FE gate:** tier-4 (above) + tier-1 `je-draft` **31/31** (re-confirmed).
- **BE enforcement:** tier-1 EngineBase pipeline **39/39** (UNBALANCED · MULTI_COMPANY_DRAFT · ACCOUNT_UNKNOWN · ACCOUNT_INACTIVE · MALFORMED_DRAFT) + DB triggers 50001/50019/50025 + immutability (documented tier-2) + `engine-op-client` **8/8** (documented tier-3). Live engine-op-client re-run BLOCKED by 2 pre-existing stray Pending `PaymentReceipt` JEs (`JE-O2JA*`/`ORD2JEAPI-*`) — order-to-je harness teardown gap (payment JEs have no OrderID so its OrderID-scoped cleanup misses them); NOT from this work, NOT demo. Cleanup correctly gated as a destructive DB op — flagged in orders `plans/GOLDEN-PATH-VALIDATION.md`.

- **2026-07-21 update:** engine-op-client **8/8 LIVE** (unbalanced→UNBALANCED, unknown-key refused) after clearing 2 stray Pending PaymentReceipt JEs (`JE-O2JA*`, order-to-je teardown residue) via entity-layer delete — 0 Pending remain, demo untouched. JE create path now both-layer LIVE-validated. Order-to-je teardown gap (payment JEs have no OrderID) logged in orders GOLDEN-PATH-VALIDATION.md.
