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

## ✅ RESOLVED (2026-08-06) — All-accounts standard-grid swap, spec red → root-caused, 3 fixes

All accounts now renders the STANDARD mj-entity-data-grid (Marcelo's ask): toolbar filters/search
feed GridParams.ExtraFilter (server-side; same predicate the client filter used), row-click opens
the editor (per-row Edit/Retire buttons retired — the editor's Active checkbox is the retire path),
tree indentation/orphan flags stay on the CoA page.

The 2026-08-05 red spec had THREE stacked causes (the ".ag-row count 0 + phantom PARENT column"
symptoms were ONE cause; two more surfaced beneath it as each fix landed):

1. **Stale Explorer bundle.** The app dist WAS rebuilt after the swap, but the running ng serve
   never picked it up — the browser still served the OLD hand-rolled table (plain rows → `.ag-row`
   count 0; PARENT column = the old table's column, not saved grid state). The 2026-08-05
   "live-proven by screenshot" note was therefore proof of the OLD page, not the new grid. Fix:
   `mjdev restart accounting-revamp explorer`. Lesson: after an app rebuild, RESTART the Explorer
   before believing any live evidence.
2. **Grid height collapse (~4px).** `.gla-wrap` had card dressing only — no sizing — and
   mj-entity-data-grid's :host is height:100%, so the grid collapsed to its borders; AG rows were
   clipped invisible + unclickable (hit-test at row center → .gla-body). The EXACT regression
   All-JE's CSS comment documents. Fix: `.gla-wrap` now carries the `.aje-grid` height chain
   (flex 1 1 auto · min-height 320px · flex column); dead old-table CSS block deleted.
3. **rowKey passed unparsed.** The grid's AfterRowClick rowKey is a CompositeKey concatenated
   string ('ID|<uuid>'), NOT a bare ID — `OnGridRowClicked` fed it straight to UUIDsEqual, so the
   find never matched and the editor silently never opened (spec timed out on
   `expect(editor).toBeVisible()` with the row correctly [selected]). Fix: parse via the shared
   `rowKeyToId` (all-batches + dispatch-status already did; only gl-accounts missed it). Tier-4
   regression guard added: gl-accounts.dom.test.ts now clicks with the real 'ID|<uuid>' shape and
   asserts the editor opens on that account.

Also: stale fixture company `PWBATCH-MSGWZXIC GUI Batch Co` (leftover from the 2026-08-05
externally-killed tier-5 run — kill skips afterAll teardown) torn down via the fixture's own
teardown; new helper `test-harnesses/playwright/lib/find-stale-fixtures.ts` lists PWBATCH-*
leftovers for future cleanup. Validation runs recorded below as they complete.

**A FOURTH bug the spec caught while re-greening (2026-08-06):** post-save the grid showed the
STALE pre-rename row. mj-entity-data-grid's `Params` setter DEEP-COMPARES
(`RunViewParams.Equals`) and skips the refetch when the rebuilt params are equivalent — after a
save, filters/search are unchanged, so `rebuildGridParams()` was a silent no-op for the grid.
Worse, the audit showed All-JE / all-batches carried a **vestigial `RefreshToken` counter nothing
consumed** — their header Refresh buttons never refetched the grid either when filters were
unchanged. Fix on ALL FOUR grid pages (gl-accounts, all-journal-entries, all-batches,
dispatch-status): `@ViewChild(EntityDataGridComponent)` + explicit `grid.Refresh()` in the page's
`Refresh()` and post-save paths; RefreshToken deleted. A fifth find: the tier-4 mount was missing
`EntityViewerModule`, so the grid rendered as an unknown element in jsdom (NG0304 caught by the
keystone once the bundle was current) — added to the TestBed imports.

**2026-08-06 re-green runs (this fix wave):**
- Tier 1 units: **101/101 pass** (2 real suites: 44 + 57; 4 packages remain "No tests configured"
  stubs — pre-existing gap, unchanged).
- Tier 4 dom (full): **9/9 pass** across 5 files, incl. gl-accounts' new composite-rowKey →
  editor-opens regression assert.
- Tier 5 accounts spec: **2/2 pass** (create → rename → identity-lock 38s; Dimensions+CoA 29.7s).
- Tier 5 FULL suite: **8/8 accounting specs pass** (10.3m); the sole failure is the PRE-KNOWN
  `orders-product-catalog` blocker (Orders app not linked in this instance — same signature as the
  2026-08-05 battery, unrelated to this branch).
- Tier 2 (after tier-5, serialized on the DB): runtimes **50/50** (block0 10 · block1 11 ·
  engine 12 · intercompany 17) + server vitest **25/25** = **75/75**, matching baseline.
- Tier 3 wire (real client → MJAPI): **72/72** (batch-ops 37 · engine-op 11 · full-flow 24) on the
  renamed op keys, matching baseline.
- DB hygiene: `find-stale-fixtures` → zero PWBATCH-* leftovers.

**2026-08-06 (later) — nav-label sweep (Marcelo: "nav tabs at the top, the side bar"):** top-nav
category "Batches" → **"Journal Entry Batches"** (metadata DefaultNavItems Label, synced to the DB
via `app sync --include applications` + API restart), CategoryTitle + both resource display names
likewise; rail labels mirror the JE category's scheme — "All batches" → **"All journal entry
batches"** (primary list spelled out) · "Batch workspace" → **"JE batch workspace"** · "Batch
approvals" → **"JE batch approvals"** ("JE" abbreviation = existing house style, cf. "JE
workspace"); Dashboard/Dispatch status unchanged. Page-internal prose ("this batch", "New batch",
'Batched' status chips, BATCH- numbers) intentionally unchanged. Specs updated (stale-label case):
4 batch specs' `railItem` calls + env.ts `NAV.batches`. **Validated live** (probe: rail + top nav
render the new labels, zero console errors) **and by tier-5: the 4 batch-flow specs pass 4/4
(5.3m)** driving the renamed nav end-to-end. Side-find while validating: the Entries column's
"$1.00" currency dressing is an **MJ-core bug** (host GridColumnConfig type/format dropped +
name-pattern currency heuristic) — filed in MJ-UPSTREAM.md 2026-08-06 with root cause + fix; the
app keeps its correct column config so it heals when MJ fixes the mapping. A StateKey v1→v2 bump
was tried on that theory and REVERTED (fresh state still renders currency — disproven).

**Battery verdict 2026-08-06: FULL PYRAMID GREEN at baseline** — units 101 · tier-2 75 · tier-3 72
· tier-4 9 · tier-5 8 (+1 pre-known orders blocker). The branch's uncommitted fix wave (4 grid
pages' refresh, gl-accounts rowKey parse + CSS height chain, tier-4 module import + regression
assert, find-stale-fixtures helper, Server index comment) awaits commit approval.

## ⭐ CURRENT STATE — 2026-08-05 UI-WAVE BATTERY (post-#43 merge + the chrome/control wave)

Scope: PR #43 merged into the rename branch (conflict-free; git followed the renames; the guarded
sweep re-ran over #43's 16 arriving files — zero leftovers) plus the UI wave (Marcelo's 2026-08-05
task list): JE panel "Open full" removed (workspace = the ONE open action) · ALL 34 native <select>s
replaced with MJ controls (mj-dropdown CVA; new shared mja-check-dropdown CHECKBOX multi-select for
company filters on All-JE / All-batches / All-accounts / CoA / batch-status — batch-workspace's
company stays single: it is a BUILD CRITERION under single-company batches, MOD-15) · every inline
mj-refresh-button removed and all five category headers on the orders-style outline refresh
(dashboards subscribe to PageRefreshService, OPTIONAL injection — provided per category shell) ·
create verbs hoisted: the category header shows the ACTIVE PAGE's create verb (New account / New
dimension / New company), dashboard header-cards deleted · Dimensions page: status filter + New
dimension + per-row details opening the record's real form in the MJ slide-in (openBizCreate added
to the standardized helper) · slide-in audit: app already 100% on mj-slide-panel/MJFormPresenter —
nothing to swap.

| Tier | Suite | Result |
|---|---|---|
| 1 | Angular units | **125/125** |
| 4 | GUI DOM suite | **9/9** (specs updated: TestBed imports for the new controls; company-setup asserts the create button's INTENTIONAL absence; gl-accounts drives the multi-select API) |
| live | keystone sweep over every new surface (15 checks) | **15/15**, zero console/page errors (2 initial FAILs were probe-timing, re-proven individually) |
| 5 | Playwright full suite (specs now drive mj-dropdown via pickMjDropdown) | **8/8 green** (10.8m) |
| 5 | orders-product-catalog | pre-known 5y blocker — NOT a regression |

Tiers 2/3 unaffected by this wave (server untouched) — last green on the rename battery below.
Known follow-ups: mj-dropdown lacks an accessible-name input (host aria-label interim; MJ upstream
candidate) · GLAccountLink demo seed/create-UI gap (diagnosed 2026-08-05, awaiting ruling).

## ⭐ PRIOR STATE — 2026-08-05 JOURNALENTRYBATCH RENAME BATTERY (full pyramid vs the identifier refactor)

Gate scope: Amith's ruling — every bare `Batch`-prefixed identifier naming the JournalEntryBatch
entity renamed to the full prefix (`BatchID→JournalEntryBatchID`, `BatchNumber→JournalEntryBatchNumber`,
`ExternalBatchRef→ExternalJournalEntryBatchRef`, `IsBatchSummary→IsJournalEntryBatchSummary`,
`spAssignNextBatchNumber→spAssignNextJournalEntryBatchNumber`, `trg_JEBatch_*→trg_JournalEntryBatch_*`,
FK/CK/UX names), applied by editing the consolidated baseline in place (house convention) +
drop-schema → migrate → sync → codegen (verified NO-OP — baseline self-consistent) → build, then the
Assoc Demo re-seed (6/6; NOTE: drop-schema strands the IsA PARENT rows in __mj.Company — the 3 demo
parents had to be deleted before re-seed could recreate them). Deliberately unchanged: verb-form
lifecycle columns (BatchedAt/BatchedByUserID), Status value 'Batched', the BATCH- number format,
and compact DisplayNames ("Batch ID"). Branch: refactor/journal-entry-batch-rename.

| Tier | Suite | Result |
|---|---|---|
| 1 | EngineBase / CoreEntitiesServer / Angular units | **57/57 · 44/44 · 125/125** |
| 2 | block0 / block1 / engine-runtime / intercompany + server vitest | **10/10 · 11/11 · 12/12 · 17/17 · 25/25** |
| 3 | engine-op-api / batch-ops-api / full-flow-api (wire) | **11/11 · 37/37 · 24/24** |
| 4 | GUI DOM suite | **9/9** |
| 5 | Playwright (8 demo-relevant specs incl. all three batch specs) | **8/8 green** (10.6m) |
| 5 | orders-product-catalog | pre-known 5y blocker (orders unlinked) — NOT a regression |

Round 2 (2026-08-05): DisplayNames renamed too (baseline + DB, codegen refreshed); server files/classes
aligned (JournalEntryBatchEngine.ts, JournalEntryBatchOperations.ts, all exported bare-Batch
identifiers; op WIRE KEYS deliberately unchanged pending ruling). Re-validated after: CES units
44/44 · engine-runtime 12/12 · tier-3 wire 11/11 · 37/37 · 24/24 · tier-4 9/9 · tier-5 batch
specs 3/3 (exact-value regenerate 600→711 proven).

Round 3 (2026-08-05): op WIRE KEYS renamed (orders' tip verified zero-reference — heads-up filed
as bizapps-orders#37) + Angular files/dirs/classes renamed (JournalEntryBatchDispatch/,
JournalEntryBatchStatus/, journal-entry-batch-workspace.*, journal-entry-batches-dashboard.page,
gui dom spec file). Selectors + @RegisterClass resource keys kept (metadata-bound); batches-category
kept (nav-category name). Re-validated: full app build clean · Angular units 125/125 · tier-3 wire
11/11 · 37/37 · 24/24 (driving the NEW op keys) · tier-4 9/9 · tier-5 batch specs 3/3.

Harness notes: the three explicit-seed fixes (W1 auto-seed retirement) + the two MJ-5.51 locator
fixes were re-applied on this branch (they also ship in PR #44's branch; identical edits, clean
merge). Cross-app: bizapps-orders consumes these fields — it needs a companion rename sweep in its
own repo once this lands.

## ⭐ PRIOR STATE — 2026-07-30 DEMO-GATE RUN (Amith's demo flow, pre-PR-merge gate)

Gate scope (Amith 2026-07-30): prove the full demo flow — company profile setup → GL accounts →
JE/Lines → batching — before the PR merges. Company-create browser SAVE stays a **waived** gap
(5x; Marcelo ruling 2026-07-30: that dialog will be rebuilt as an app-owned form-based dialog).

| What ran | Result |
|---|---|
| Tier-5 playwright suite (fresh run vs pushed HEAD) | **8/8 demo-relevant specs green** (10.2m). 9th spec = `orders-product-catalog`, failed as pre-known 5y blocker (orders@next ships no nav app) — NOT a regression |
| **NEW** `test-harnesses/api/full-flow-api.ts` — the demo journey as ONE chain on a FRESH company, all over the wire (the exact calls the UI buttons make): ACP "New company" save → IS-A parent + W1 COA (10 accts, 11201/40100) → 3 JEs via `Accounting.CreateJournalEntry` (merge shape, entry-number format) → Preview/Build netted 600/600 → approval flip → Approve → Dispatch (Posted + MOCK ref) → JEs GLPosted via the dashboards' dynamic-view read path → **C2 dimension-split consolidation** (Marcelo ruling 2026-07-30: prove company × GLAccount × dimension-combo split on the PERSISTED summary, not just tier-1 pure netting): same-account/different-dims lines refuse to merge at creation (LineCount 3), batch collapse nets ACROSS JEs per dim group (AR×SALES 140 = 100+40, AR×MKTG 60 split, REV 200 untagged), summaryLineCount 3, each summary line re-tagged with exactly its combo — all read back over the wire → fixture teardown | **24/24, first run** |
| Amith's orders integration suite (15 bundles) re-run vs pushed HEAD | **177/177** |
| `cross-app-batching.mjs` — now +2 checks reading the order-JEs/batch back through the accounting dashboards' wire view path (the "API in orders → UI in accounting" closure) | **11/11** |

**W1 auto-seed RETIRED (Marcelo ruling 2026-07-30, live UI session):** new companies start with an
EMPTY chart (auto-seed collided with the L8 identity lock); `SeedDefaultChartOfAccounts()` stays as
an explicit public capability. Contract re-pinned and re-proven: block0 W1.2 now asserts BOTH halves
(empty on create + 10 accounts on explicit call) — **10/10**; full-flow-api asserts empty-start over
the wire then creates its own AR/Revenue accounts — **24/24**; batching-fixture seeds explicitly —
batch-reject spec re-proven **1/1**; CES units **42/42**. Amith's integration fixtures are unaffected
by design (they seed directly, fixture.ts:270). Flagged to Amith via instance QUESTIONS.md (W1 was a
master-plan item). `docs/lifecycle-hooks.md` updated.

**Residue finding + sweep (2026-07-30):** the orders integration suite's bundle teardown LEAKS the
accounting companies it provisions (63 IT-ORD ACP+Company rows + ~250 orders-schema rows from one
run) and the cross-app teardown ran without CODEGEN creds (no ALTER for DISABLE TRIGGER) → 13
orphan GLPosted JEs + 3 orphan batches. Fixed/handled: cross-app teardown now uses the CODEGEN
pool; new `server/_maint-clean-test-residue.ts` + `_maint-clean-test-residue2.ts` (generic
FK-driven, tag-scoped sweep, constraints re-verified WITH CHECK) ran to zero — instance now holds
exactly the 3 Assoc Demo companies (verified over the UI's read path post-API-restart). Suite-leak
finding filed to `~/MJDev/MJ-UPSTREAM.md` for the orders app.

## ⭐ PRIOR STATE — 2026-07-30 FULL-COVERAGE OVERNIGHT RUN (all tiers + orders integration)

**Final battery (2026-07-30, everything re-run after the night's metadata/view changes):**

| Tier | Suite | Result |
|---|---|---|
| 1 | EngineBase units | **57/57** |
| 1 | CoreEntitiesServer units | **42/42** |
| 1 | Angular units | **125/125** |
| 2 | live vitest (phase2 17 + batch-workspace pure 8) | **25/25** |
| 2 | block0 / block1 / engine-runtime / intercompany (tsx) | **10/10 · 11/11 · 12/12 · 17/17** |
| 3 | engine-op-api / batch-ops-api (incl. NEW regenerate wire section) | **11/11 · 37/37** |
| 4 | gui dom suite (company-setup, je-dashboard, gl-accounts, batch-workspace + smoke) | **9/9** |
| 5 | playwright: accounts-manage(2) · batch approve/reject/regenerate · je-reversal · company-create · je-create · shell-smoke | **9/9 specs green** |
| X-app | Amith's orders integration suite (15 bundles) vs our HEAD | **177/177** |
| X-app | cross-app-batching.mjs (order→JE→batch→approve→dispatch→GLPosted, committed flow) | **9/9** |

**Named-flow coverage (Marcelo's 2026-07-29 sweep) — all browser-proven:** create JEs (workspace) ·
batch build/approve/reject/REGENERATE · JE reversal · account create/rename/identity-lock ·
dimensions render · company COA render · company creation (affordance+cancel; full dialog save =
CODED GAP 5x, generated forms lack stable locators — upstream ask filed) · orders→accounting
booking + batching end to end.

**Known gaps / blocked (all coded + filed):**
- 5x company-create dialog SAVE (upstream: generated-form locators; entity path covered tiers 2-4).
- 4x tier-4 per-page floor: all-journal-entries, dispatch-status, account-links, dimensions,
  je-approvals, je-workspace dom specs not yet authored (pattern established; direct-declaration).
- 5y orders-product-catalog spec: orders@next ships NO nav-app metadata yet (blocked upstream).
- TX-class finding: TaxRate.Rate unit/precision contract (fraction vs percent) — scaffolded
  locally to DECIMAL(9,6); needs the real cross-app contract decision.
- Metadata drift vs committed baseline (deliberate, needs a baseline pass to adopt): JE
  EntryNumber IsNameField=1 (+ the 4 virtual name-fields it emits), Refund JournalEntryType in
  the seed, CompanyTaxNexus scaffold table (accounting's plan owns the real one).

**Environment lesson bank (tonight):** collapsed-rail hover-peek intercepts content clicks (park
the mouse after rail nav; chip menus close on a NEUTRAL spot, never x<60) · getByRole name
matching is SUBSTRING by default (the scope chip's "Scope: All companies" swallowed
{name:'Companies'} — always exact:true on rail items) · batch specs must scopeToCompany (builds
sweep every company in scope and the CFO gate must hold for each) · engine-runtime's stray-guard
is company-scoped now (demo data legitimately keeps Pending JEs).

---

## ⭐ PRIOR STATE — 2026-07-29 harness modernization (the donor-port test line)

The suite was modernized with the S-A/S-B/S-C port (see `plans/donor-audit.md`). **Dead harnesses
were REMOVED** — they tested retired systems and could never run against the realigned schema:
`block2` (old batch-line-item model) · `block4` (ScheduledJE/materializer, dead per D15) · `block5`
(ChartOfAccountsMapping, dead per D13) · `block6` (the removed `vw_*` views) ·
`batching-multicompany` (multi-company batches, superseded by single-company D7) · api
`readmodels-api` / `batch-dispatch-api` / `batching-scenarios-api` (dropped views + the deleted
BatchDispatchResolver). Their live coverage now lives in the modernized set below (integration-style
flows with exact-value asserts, mirroring the orders headless-E2E pattern).

**Current inventory + verified results (2026-07-29, instance accounting-revamp — API :4180):**

| Tier | Harness | Covers | Last run |
|---|---|---|---|
| 1 | `packages/CoreEntitiesServer/src/__tests__/` (vitest) | seeds, types, batch/JE invariants, dims | **42/42** |
| 1 | `test-harnesses/server/batch-workspace.pure.test.ts` (vitest, no DB) | pure batch-workspace machinery via the built package surface: outOfOrderSkipCount, classifyViewEntries, perCompanySubtotals — housed in the HARNESS (not package src) so engine-internal test scaffolding never ships | **8/8** |
| 1 | `packages/EngineBase/src/__tests__/` (vitest) | pipeline stages 1–5 incl. `MULTI_COMPANY_DRAFT` + counterparty carry, link picker | **59/59** |
| 2 | `test-harnesses/server/phase2-encapsulation.live.test.ts` (vitest, live DB) | L1–L16: encapsulated JE save/load/reversal (+guards L14, counterparty L15), engine set-op atomicity, ONE-transaction batch build + task stamp (L11–L13), GLAccount immediate lock (L8), link tie guard + forCompanyID (L16) | **16/16** |
| 2 | `test-harnesses/server/block0-runtime.ts` (tsx) | W1 seeding, per-company JE numbering (BA-D31), batch numbering (DR-5 noted) | **10/10** |
| 2 | `test-harnesses/server/block1-runtime.ts` (tsx) | REWRITTEN 2026-07-29: raw-SQL bypass proofs of the JE floor (50001/50003/50004/50006/50019/50022/50012), reversal via entity, entity double-entry validation | **11/11** |
| 2 | `test-harnesses/server/engine-runtime.ts` (tsx) | engine typed error codes live (incl. MULTI_COMPANY_DRAFT), atomic rollback, ResolveLinkedAccount windows | **12/12** |
| 2 | `test-harnesses/server/intercompany-runtime.ts` (tsx) | BA-D26/27 IAM resolution + triggers | **17/17** |
| 3 | `test-harnesses/api/engine-op-api.ts` (tsx) | 'Accounting.CreateJournalEntry' over ExecuteRemoteOperation (per-company EntryNumber asserted) | **8/8** |
| 3 | `test-harnesses/api/batch-ops-api.ts` (tsx, NEW) | the 5 batch remote ops end-to-end over the wire: build (netted 600-not-800 + stamped task), approval-state flip, dispatch→Posted, reject→Cancelled+pool-return, loud EmptyBatch | **23/23** |
| 5 | `test-harnesses/playwright/specs/*-newnav` | REAL-BROWSER behavior flows on the rebuilt shell: batch build→approve→dispatch to Posted · batch reject (JEs return to pool) · JE reversal from All journal entries (build→dispatch→GLPosted→Reverse), each self-seeding via the fixture + console-error keystone | **3/3** (2026-07-29) |
| 5 | `test-harnesses/playwright/shell-smoke.ts` (standalone tsx) | 5-category nav walk + shells mount + keystone | **ALL PASSED** (2026-07-29; one transient `ERR_CONNECTION_REFUSED` keystone hit on an earlier run — not reproduced with request-URL capture, watching) |
| 5 | `specs/orders-product-catalog.spec.ts` | orders app UI — BLOCKED on the orders migrate (mjdev per-file-transaction fix) | not run |

Shared fixture `playwright/lib/batching-fixture.ts` modernized: encapsulated JE saves, EntryTypeID
lookup, User-based CFO (ApprovalCFOUserID), company-rooted teardown, per-company isolation (the
global stray-Pending fail-fast is gone — builds are per-company now).

**2026-07-29 tier-5 modernization notes:** `lib/explorer.ts` gained `resetCompanyScopeToAll`
(the ported batch specs imported it but the ported lib lacked it — specs wouldn't load); the
je-reversal spec was updated to the rebuilt workspace's sequence (scope reset + the deferred-query
"Load entries" click before Build enables — the donor-era sequence left Build disabled). Also
fixed: sub-page `mj-page-header`s painted OVER the category header + scope dropdown (same-z later
DOM) — `category-shell.css` now isolates `mj-left-nav-content`'s stacking context; verified by
headless hit-testing of the open scope menu. Proper chrome fix (pages → `mj-page-header-interior`
per conventions §10) tracked for the hardening pass.

**2026-07-29 shipping-hygiene fix (Amith/Marcelo PR review):** CoreEntitiesServer's tsconfig was
missing the `src/**/__tests__/**` build exclude (EngineBase/Angular already had it), so compiled
test files were landing in `dist/` — which `files: ['/dist']` would have PUBLISHED. Exclude added,
dist rebuilt clean. The pure engine-internals spec (`BatchWorkspacePure`) moved to
`test-harnesses/server/batch-workspace.pure.test.ts` (runs under the tier-2 vitest config, needs no
DB, imports the built package surface). Verified after the change: CES units 42/42 · full tier-2
vitest harness 25/25 (17 live + 8 pure) · no `__tests__` output in any package dist.

---

## Coverage matrix (✓ = real-value/exact · ⚠ = intentional, see register · ✗ = GAP, fill it)

> ⚠ **HISTORICAL (2026-07-06 era — pre-rebuild).** Rows below reference retired features
> (multi-company JEs/batches, COAMapping, SJE, read-model views) and removed harnesses. Kept as
> the record of what the donor-era suite covered; the CURRENT STATE section above is the live
> inventory. A fresh matrix gets rebuilt when the UI port lands (tier 4/5 columns change shape).

_Historical matrix, reworked 2026-07-06: AccountingPeriod/AccountBalance retired (CH-1),
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
| **approveJournalEntryBatch step (audit stamps · only-Pending guard · dispatch-before-approve refused)** | — | ✓ | ✓ | ✓ |
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
  → separate, tagged summary lines, via SQL). The API's `BuildJournalEntryBatchResult` is aggregate; the
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
  **preliminary** lock: `cancelJournalEntryBatch` → batch Cancelled + entries back to the candidate pool. Proven in `block2`
  (`#12 cancelJournalEntryBatch`) + live through MJAPI. Impl: migration `V202607081600` + `JournalEntryBatchEngine.cancelJournalEntryBatch`.
- ✅ **buildJournalEntryBatch atomicity** (Q5) — RESOLVED 2026-07-08. A failed approval-task raise now auto-reverses the batch
  (reversible preliminary lock) instead of stranding a task-less orphan. Proven in `block2` (`no CFO → auto-reverse`).
- ⏳ **Follow-on GAAP calls (Q12–Q15, high-priority for Robert):** reversal same-period-vs-forward-date, batch cutoff
  (oldest-forward), out-of-order approval, backdated-order JE date. Provisional answers coded; confirmations shape the
  deferred filter/backdating work (plan `batch-approval-lock-redesign.md` §13–14). Do NOT block the shipped reject fix.
- ✅ Due-to/from semantics **confirmed** (Marcelo): Accounting does **no** intercompany netting — Payments owns it.

**Batch-lock redesign (#12, 2026-07-08) coverage:** `block2` now **24/24** — adds `#12 cancelJournalEntryBatch` (reject-unlock),
`#12 permanent lock` (approved → raw unlock rejected by trigger), `#12 regenerateJournalEntryBatch` (re-gathers a since-added JE),
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
