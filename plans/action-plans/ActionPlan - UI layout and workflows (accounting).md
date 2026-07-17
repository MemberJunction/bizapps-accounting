# Plan — UI layout & workflows (accounting)

> **Status:** ACTIVE (approved for execution — Marcelo review completed 2026-07-14; **mockup set
> approved + converted to per-screen build specs 2026-07-16 — §8 is the operative implementation
> spec**) · **Created:** 2026-07-11
> **Implements:** the UI consequences of MOD-8 (batch building), MOD-9 (settings/setup screen deliverable),
> B2 (reporting surfaces); the 2026-07-10 GUI-review direction.
> **Sources:** meetings (orders repo) `07102026 - Matt & Marcelo GUI Review.md` + `2026-07-10-decisions.md`
> (accounting companion has the full UI write-up); MJ guides (DASHBOARD_BEST_PRACTICES,
> explorer-chrome-conventions, KEYSET_PAGINATION_GUIDE); Live Page System plan (shared-plans, approved).
> **Depends on:** feature plan B1–B3 for the actions; schema plan A2 for roles. Suggestions-level — same
> caveat as the orders UI plan: Marcelo prunes.

## 0. Cross-cutting direction (same house rules as the orders UI plan — one look across both apps)

AG-grid tables as the single list idiom (trial-balance screen = the reference look) · slide-in panel for
detail · time-window defaults on every list · keyset pagination + LiveDashboardBase adoption per the Live
Page System plan · laptop-width tolerance · design tokens only. Accountants live in tables (Marcelo's own
read, GUI review): lean INTO the grid, don't invent dropdown-card hybrids.

**Shared components (placements ruled 2026-07-15):** accounting OWNS the domain trio — schedule/
waterfall viewer · GL-resolution preview · Customer A/R base view (read-only core; orders wraps it
with its verbs) — orders imports them (dependency direction: common → accounting → orders). The
framework-clean set — approval inbox (target: bizapps-tasks) · list-screen scaffold (design ON the
Live Page System plan's LiveDashboardBase, not fresh; target: common → MJ base) · role-gating
directive (target: MJ base) · cross-app deep-link helper (target: MJ base) — is **PARKED in this
app** for iteration speed (no extra dev-linked apps/feature branches during the wave) and tracked
in `plans/TRANSFER-BACKLOG.md` (target + trigger per row). **Parking discipline: framework-clean
components live in a bounded folder and import NO accounting entities** — extraction must stay a
file move, never a refactor. Status stepper + money strip are orders-local (single consumer today;
no premature abstraction). Build each shared thing ONCE.

**Mockup round 1 rulings (Marcelo, 2026-07-15 — bind the build):**
- **Nav shape approved:** top-nav CATEGORIES (= Explorer app nav items — metadata-configured,
  badges supported natively) + collapsible **nav rail** (standard term) per category, dedicated
  single-purpose pages, MAIN + secondary groups. No FAB (MJ chat button owns the corner).
- **Page pattern:** every page gets Filters (top-left of actions) + a consistent top-right create
  button where creation makes sense.
- **Creation/detail pattern:** modal = the approachable baseline for quick ops; EVERY modal and
  slide-in carries a pop-out (↗) to the full-depth home. **Batches are page-scale, not
  modal-scale** → dedicated **Batch workspace** (and a JE workspace): tabbed, in-progress items
  keep state **session-scoped in v1 (NOT the database)**, closable tabs.
- **Approver visibility:** build criteria (the filters a batch was built from) are ALWAYS shown —
  on the workspace and in the review slide-in.
- **Slide-in = quick VIEW** (glance-and-go); modal = focused quick ACTION; page = full depth.
- **Dashboard stats:** no on-demand aggregates — anything expensive (e.g. entries-per-day) is
  precomputed on a schedule and stored, or it doesn't ship.
  **Stats rule (Marcelo 2026-07-17): never compute a stat client-side by pulling rows.** Every
  dashboard count/sum/rate comes from a **stored-Query server-side aggregate** (`RunQuery` + SQL
  `GROUP BY`/`SUM` — MJ exemplar: the Tags dashboard's `Tag Aggregates` query, added there
  precisely to avoid shipping 17K+ rows to the browser) or from `RunQueryResult.TotalRowCount`
  (server count without a row pull). Do NOT copy MJ's Actions/AI-analytics dashboards, which pull
  whole log tables to `.filter().length` — that pattern is filed upstream as an anti-pattern
  (`~/MJDev/MJ-UPSTREAM.md`). In-memory engine counts (`engine.X.length`) are fine for small
  already-cached sets. A precomputed-stats endpoint is BACKLOG (plans/BACKLOG.md), not v1.
- **Company scope chip:** app-owned, top of the rail (persisted per user via UserInfoEngine).
  Explorer's header has NO app-widget slot today — an "Explorer header widget slot" is flagged
  upstream (component inventory / Matt); if it lands, the chip moves up.
- Rail does NOT hold creation items ("New X" removed) — creation = page button + workspace tab.

## 1. Batch approvals page (Marcelo: "I'm not a lover" — rebuild to house style)

- Replace the hand-rolled table with the standard AG grid: sortable/filterable columns (batch №, status,
  built-at, cutoff, entry count, total Dr/Cr, approver), expandable rows → netted summary lines
  (Company × Account × Dimension, per MOD-4).
- Row actions per role (A2): Approve / Reject (reject-unlock semantics from the completed lock redesign,
  with a "entries return to the pool" confirm), Regenerate (open batches).
- Batch detail slide-in: summary lines + drill-through to member JEs + dispatch status
  (`vw_BatchDispatchStatus`).
- **Manual-JE approval (C.8 — added 2026-07-15):** an approval-inbox instance on this same workspace
  (same tasks substrate as batch approvals) filtered to approval tasks for `EntryType='Manual'` JEs;
  "Awaiting CFO approval" chip in the JE browser + Approve/Reject on the JE slide-in for the approver
  role; blocked-from-batch tooltip explaining why an unapproved manual JE can't be picked up.

## 2. Batch builder (B1's UI face)

- **Default flow:** "New batch → everything unbatched through [date-time picker, default now]" → preview
  (count, totals, per-company subtotals) → build.
- **From-view flow:** pick an MJ User View of Journal Entries → validate (loud list of any already-batched
  entries) → preview → build. Link to create/edit views (standard MJ view UX — don't rebuild it).
- Out-of-order warning chip when the selection skips older unbatched entries (allowed, but visible — MOD-8).

## 3. Journal Entries browser

- The volume screen (thousands of JEs): AG grid + keyset pagination + server search; time-window default;
  status/company/entry-type filter bar per the chrome conventions (filters in [toolbar], state in [meta]).
- Row slide-in: lines w/ dimensions, origin lineage (JournalEntryLink → "Order ORD-123" deep link into the
  orders app — the cross-app navigation fix from the GUI review, symmetric with orders §8), reversal chain,
  batch membership.
- This screen is the LiveDashboardBase pilot candidate on the accounting side (push-updated statuses).
- **Reserved slots (added 2026-07-15, decision-gated):** a void affordance on `Pending` JEs only
  (semantics wait on §14 Q1 flag-vs-delete) and an attachments panel over `FileID → __mj.File`
  (§14 Q9). Layout slots reserved in the JE detail now so the decisions don't force rework.

## 4. Reporting surfaces (B2)

- **AR Aging** and **DefRev Rollforward** first: parameterized (as-of date, company, customer filter),
  drill-through (aging bucket → orders/JEs behind it), export. Deterministic re-run (Jeremy's
  reproducibility requirement) stated in the UI (as-of shown on the report).
- Report home: an Accounting Reports nav item listing the pack (§10.2 list) — simple launcher, no separate
  gallery app (out of scope per §10.3).
- **Remaining read models (added 2026-07-15): decision pending** — launcher-only vs real parameterized
  surfaces for recon (`vw_ARtoGLRecon`), GL detail, dimension P&L, FX exposure, tax liability.
  **RESOLVED 2026-07-16 by mockup approval:** real parameterized surfaces for AR Aging, DefRev
  Rollforward, Trial balance (AR), AR↔GL recon, GL detail, Dimension P&L, and Sales tax liability
  (all seven mocked + approved — §8.5). FX exposure has NO mockup and stays deferred (no surface in
  this wave).

## 5. Setup / settings screen (MOD-9 deliverable, with A2)

- Roles & access: role list with plain-language grants, user→role mapping surface (MJ standard), the
  approver designation (role membership first iteration — schema plan Q1).
- Company profiles: ACP list + intercompany pair status (A1: which pairs provisioned, 4 accounts each,
  "Provision missing pairs" admin action from B4).
- GLAccountLink mapping manager: the role-mapping screen (product/category/company links, date effectivity)
  — this is where the orders Confirm-failure deep link lands (orders UI §1). Show resolution preview
  ("Product X resolves: Revenue → 4000 via category Software").
- **CoA↔ERP mapping approval (B.3 — added 2026-07-15):** grid beside the link manager over
  `ChartOfAccountsMapping` (GL account, ERP account, direction, status), default filter "needs
  approval", row + bulk Approve/Reject with confirm, "unmapped GL accounts" warning chip. Plain grid
  actions — NOT tasks-routed (ruled 2026-07-15: admin curation, not workflow; contrast C.8 in §1).
- Manual materialization action (B3 Q3, if approved): "Materialize scheduled entries due through [date]"
  with preview + confirm.
- ~~Period close surface~~ — **withdrawn 2026-07-14** (MOD-13 withdrawn; no periods). A simple
  "batched-through" indicator per company on the batching workspace covers the operational awareness.

## 6. Consistency migration sweep

The GUI review's debt list applied to accounting screens: modal/card mixes → slide-ins; any Claude-improvised
non-grid tables → AG grid; every list gets the time-window default; "Open in Accounting/Orders" buttons
navigate cross-app instead of embedding foreign cards. One sweep task, screen checklist authored at
execution time. **Added 2026-07-15:** the RevenueTax dashboard (G.1 — in build with no plan coverage
until now) joins the sweep checklist; the Intercompany dashboard's disposition (trim/keep vs the
receive-only posture) is decided at the Task 65b review.

## 7. Scheduled-JE browser (E.1–E.5 — added 2026-07-15, gap analysis)

- House-idiom grid over `ScheduledJournalEntry`: origin (order/subscription deep link), due date,
  amount, status (Pending/Materialized/Superseded). Default window **trailing 30 + forward 90 days** —
  forward-looking is the point of this screen.
- Slide-in: line items + dimensions (the shared waterfall viewer), supersede chain, materialized-JE
  link when one exists.
- Header action: "Materialize due through [date]" with preview + confirm — the same op §5 exposes,
  surfaced where the schedules live.

## 8. Mockup conversion — per-screen build specs (2026-07-16, binds the build)

> The full interactive mockup set (`design-docs/ui-design/mockups/nav-shell-*.html`, 24 linked
> pages, committed) was APPROVED for implementation by Marcelo 2026-07-16 ("run with it"). This
> section is the authoritative per-screen spec derived from it; §§1–7 above remain the feature-level
> intent it implements. **Mockup retention (deliberate deviation):** `mockups/` is RETAINED as the
> build agents' visual reference until this plan's build completes — then delete the set, fold any
> frame improvements into `shell/`, and update the standing design record (the normal cycle close).
>
> **MJ-wins rule (binds every screen):** where MJ base already ships the idiom — `<mj-page-layout>`
> chrome, form slide-in (FORMS_ARCHITECTURE_GUIDE), AG grid, `mj-loading`, MJ dialogs, `--mj-*`
> tokens — USE IT. Mockups are **directionally** binding (layout, hierarchy, content, flows), not
> pixel-binding. The style-kit `.mjm-*`/`.x-*` classes are mock stand-ins; never ship them.
> **Element doctrine + navigation map** are recorded present-tense in
> `design-docs/ui-design/README.md` (standing design record) — read that first.

### ⚠ 2026-07-17 Amith demo-feedback rulings — FORMS ARE THE BASIS OF THE UI (binds all remaining §8 work)

From `meetings/2026-07-17 - Amith Demo Feedback.md` (Marcelo: fold in and incorporate):

1. **Entity Forms first-class; widgets shared with dashboards — "one UX."** For every core entity
   (JournalEntry, Batch, Account, …) build a **first-class MJ Entity Form** (extend the generated
   form per the `@RegisterClass(BaseFormComponent, …)` pattern; MJ's Forms Architecture guide is
   the recipe) and compose it from **reusable widgets that the dashboards embed directly** — the
   drill-in form and the dashboard panel are the same components, not parallel implementations.
2. **No bespoke pop-ups.** Where the element doctrine calls for a modal or slide-in, its CONTENT
   is the entity form presented through MJ's form host (`forms.open()` / `<mj-form-dialog>` /
   `<mj-form-slide-in>` + `EntityFormConfig`) — never a custom one-off popup component. This
   REFINES the doctrine (modal = quick action, slide-in = quick view stand); it standardizes what
   renders inside them. Existing §8 specs that say "modal"/"slide-in" now mean the form-host
   presentation of the entity's form.
3. **Accounts/COA pages: reuse `ng-entity-viewer` + a User View** rather than rebuilding
   grid/browse UX (§8.3) — same check-MJ-first rule that found `mj-entity-data-grid`.
4. **Manual JEs blessed, with three hard requirements (C.8):** (a) **provenance is unmistakable
   everywhere** — every JE surface shows clear lineage (Orders/Payments/app-origin vs Manual;
   badge + origin links); (b) creating/approving manual JEs is **authorization-gated** (the Q6
   answer's Accounting Approver enforcement is exactly this); (c) the manual-ness itself is
   visually loud, not a subtle field.
5. **Don't over-polish the dashboards** — "good starting point… improve based on user feedback,
   many other things to focus on." Ship, move to the next slice.

### ⚠ 2026-07-17 plan-chain update — MOD-15/16/17 land; three §8 specs are affected (read before building those pages)

New MODs from the Robert P-proposals + Jeremy/Amith sign-offs (`MASTER-PLAN-MODIFICATIONS.md`):

- **MOD-15 (single-company batches):** the Batch workspace/build flow gains a **company picker**
  (a batch is built FOR one company); batch lists/dashboards show per-company batches; approvals
  are per company-batch (Jeremy: better segregation of duties). Surface the cadence-alignment note
  for active-intercompany company pairs where batch schedules are configured.
- **MOD-16 (per-JE posting dates + closed-period holds):** no batch-level posting/document date
  anywhere in the UI; batch summary lines group per (GLAccount × dims × **EffectiveDate**). New UI
  state: a JE **held/flagged for closed-period review** (dispatch exception) — hold, never
  auto-roll; needs a visible exception affordance on batch detail/dispatch status.
- **MOD-17 (forward-dated JEs replace ScheduledJournalEntry):** §8.1's **"Scheduled entries" page
  is re-specced** — it becomes a **future-dated-JE browser** (same window/waterfall-view intent;
  NO "Materialize due through [date]" action — materialization no longer exists). Batch build gets
  the **default cutoff = today** filter (never sweeps forward unless explicitly set), and batch
  approval must display the swept date range. Schema/engine rework is separate work — sequence
  these pages AFTER it lands or build against the MOD-17 shape, not the ScheduledJournalEntry trio.
- Batch-filter presets + remembered user defaults (end-of-yesterday / end-of-week / end-of-month,
  persisted via UserInfoEngine) are confirmed direction (Robert 2026-07-14 meeting).

### Dispatch rulings (Marcelo, 2026-07-16 — bind the build)

- **65b gate WAIVED for this build** (feature-wave sign-off review returns later — output now;
  the review stays HIGH in the instance BACKLOG).
- **Build on the EXISTING grid system** (AG grid + keyset) — LiveDashboardBase is NOT a
  precondition; no rewrite-before-seeing-it-perform. **Interim refresh policy (scaffold-level,
  never per-button wiring):** (a) every action that mutates visible state refetches the affected
  list/stats on completion — correctness, not optional; (b) ONE standard refresh control in the
  page-header actions slot of every list/dashboard — a single seam to delete when live push lands;
  (c) no polling/timers. LiveDashboardBase swaps in behind the scaffold seam when the Live Page
  System spike lands.
- **Users & roles + Approvals settings (8.4) build LAST** — A2 roles/RLS (Marcelo co-design) and
  C.8 policy shape gate them; stubs acceptable until then. Everything else proceeds.
- Approval inbox: build generically against task entities under parking discipline
  (`transfer-pending/`, zero accounting-entity imports) — the bizapps-tasks answer (Ian, ~07-21)
  may move it; that's priced in.
- **Commit authority is NOT delegated through this plan or the handoff brief** — the build agent
  commits only on Marcelo's explicit, directly-given approval. Never push.

### 8.0 App shell (build FIRST — every page hangs off it)

- **Top-nav categories = Explorer app nav items** (`DefaultNavItems` metadata; badges supported
  natively): **Journal Entries · Batches · Accounts · Reports · Configuration**. Each nav item's
  DriverClass is a thin category-shell component hosting the nav rail + the category's routed pages.
- **Nav rail** (the parked shared component, §0): collapsible via hamburger (icons-only when
  collapsed), config-driven groups/items/badges/active-state, scope-chip slot at top. One config
  per category:

| Category | MAIN | Second group |
|---|---|---|
| Journal Entries | Dashboard · All journal entries · JE workspace | VIEWS: Scheduled entries · Awaiting approval (badge = open approval count) |
| Batches | Dashboard · All batches · Batch workspace | WORK: Batch approvals (badge) · Dispatch status |
| Accounts | Chart of accounts · Account links · ERP mapping · Dimensions | — |
| Reports | AR Aging · DefRev Rollforward · Trial balance (AR) · AR↔GL recon · GL detail (subledger) · Dimension P&L · Sales tax liability | — |
| Configuration | Companies · Users & roles · Approvals | — |

- **Company scope chip** (rail-top, app-owned): app-wide company scope, persisted per user via
  UserInfoEngine (key `mj.bizappsacct.companyScope.v1`); filters every list/dashboard/report.
  Relocates to the Explorer header when the upstream widget-slot ask lands (plans/QUESTIONS.md#q26).
- **Workspace-tab framework** (session-scoped): the tab-strip pattern shared by JE workspace,
  Batch workspace (and orders' Order editor): in-progress drafts keep state until the tab is closed
  or the session ends; **NOT DB-persisted in v1**; "Keep as draft tab / Discard" verbs; a "rejected"
  tab state for round-tripped items. Framework-clean — parked here, TRANSFER-BACKLOG row added.
- **Rail badges** come from cheap counts (open approval tasks); no on-demand heavy aggregates (§0).

### 8.1 Journal Entries category (5 pages)

- **JE Dashboard** (`nav-shell-je-dashboard.html`) — stat cards (entries this month, unbatched,
  awaiting approval, scheduled due) + needs-attention list + recent entries. Anything expensive
  (entries-per-day trend) is precomputed-on-schedule or omitted (§0 ruling); v1 ships only stats
  answerable by cheap filtered counts. LiveDashboardBase adoption when the substrate lands.
- **All journal entries** (`nav-shell-all-journal-entries.html`) — §3 built to idiom: house grid,
  keyset "Load more", server search, time-window default, status/company/entry-type filters;
  **expandable rows reveal the JE's lines inline** (Dr/Cr, accounts, dimensions). Row slide-in:
  origin lineage (JournalEntryLink → "Open order ORD-x ↗" cross-app deep link), reversal chain,
  batch membership, C.8 approval chip. Reserved slots: void affordance (Pending only, §14 Q1-gated)
  + attachments panel (§14 Q9-gated). Every row offers "Open in workspace".
- **JE workspace** (`nav-shell-je-workspace.html`) — §1's manual-JE creation home + the full-depth
  target of every JE pop-out. Session tabs (workspace framework); line editor grid (account picker,
  Dr/Cr, dimensions per line) with a **live Dr = Cr balance strip**; header verbs: Submit for
  approval (C.8 manual-JE flow) · Keep as draft tab · Discard. C.10 attachment slot reserved.
- **Scheduled entries** (`nav-shell-scheduled-entries.html`) — §7 as specced (trailing 30 +
  forward 90 window, origin deep links, waterfall-viewer slide-in, "Materialize due through [date]"
  header action with preview + confirm).
- **Awaiting approval** (`nav-shell-je-approvals.html`) — the manual-JE approval inbox (C.8, §1):
  the shared approval-inbox component scoped to `EntryType='Manual'` approval tasks; row → review
  modal (encapsulation-test-passing: full JE lines + criteria/context + Approve/Reject + ↗ pop-out
  to workspace).

### 8.2 Batches category (5 pages)

- **Batches Dashboard** (`nav-shell-batches-dashboard.html`) — stat cards (open batches, awaiting
  approval, dispatch failures, unbatched entries) + per-company **"batched-through" indicators**
  (the §5 operational-awareness strip) + recent batches. **"New batch" navigates STRAIGHT to the
  Batch workspace** (round-2 ruling: batch building fails the modal encapsulation test — no
  New-batch dialog anywhere).
- **All batches** (`nav-shell-all-batches.html`) — house grid (batch №, status, built-at, cutoff,
  count, Dr/Cr totals, approver, target system), time window, expandable rows → netted summary
  lines (MOD-4). Row slide-in → member JEs, dispatch status, ↗ to approvals/workspace.
- **Batch workspace** (`nav-shell-batch-workspace.html`) — §2 built as a **workspace, not a
  wizard/modal**. Session tabs (incl. rejected-batch tabs returning for rework). Left panel =
  **Build criteria — the ONLY filter surface on the page** (round-2 ruling: never a second filter
  system): include-unbatched-through datetime (default now) · companies multi-select · entry types
  (All approved-only / System / Manual) · source (Standard oldest-forward / From a saved MJ User
  View — §2's from-view flow) · **Target system select** (Business Central now, multi-ERP later),
  echoed as a header chip. Right: **Affected accounts summary** (account, name, companies) +
  preview grid of matched entries with **include/exclude checkboxes**; exclusions trigger the
  MOD-8 out-of-order warning ("your exclusions skip N older entries — later entries will batch
  ahead of them; allowed, but visible"). Footer: Included/Excluded counts, live **Dr = Cr totals**,
  per-company subtotals; verbs Build batch · Keep as draft tab · Discard. Criteria are ALWAYS
  visible and travel with the batch (approver visibility, §0).
- **Batch approvals** (`nav-shell-batch-approvals.html`) — §1 rebuilt to house style: approval-inbox
  component scoped to batch approval tasks; grid w/ expandable netted-summary rows; row verbs
  Approve / Reject (reject-unlock semantics + "entries return to the pool" confirm) / Regenerate;
  review modal shows the batch's **build criteria** + summary + drill-through, with ↗ pop-out.
- **Dispatch status** (`nav-shell-dispatch-status.html`) — grid over `vw_BatchDispatchStatus`
  (batch, target ERP, state, attempts, last error), retry affordance for failed dispatches,
  slide-in with the error payload.

### 8.3 Accounts category (4 pages)

- **Chart of accounts** (`nav-shell-accounts.html`) — GLAccount grid (number, name, type, company,
  active), type/company filters, row slide-in (usage stats, links into Account links). Create =
  top-right button → MJ generated form.
- **Account links** (`nav-shell-account-links.html`) — §5's GLAccountLink mapping manager as its own
  page: grid by role (Revenue/AR/DefRev/Tax/…) × target (product/category/company) with date
  effectivity; **GL-resolution preview** component ("Product X resolves: Revenue → 4000 via
  category Software"); "unmapped roles" warning chips. This is the landing target of orders'
  Confirm-failure deep link (orders §1).
- **ERP mapping** (`nav-shell-erp-mapping.html`) — §5's B.3 CoA↔ERP approval grid over
  `ChartOfAccountsMapping` (GL account, ERP account, direction, status), default filter "needs
  approval", row + bulk Approve/Reject with confirm, unmapped-accounts warning chip. Plain grid
  actions — NOT tasks-routed (ruled).
- **Dimensions** (`nav-shell-dimensions.html`) — Dimension + DimensionValue admin: master grid +
  child values panel, active toggles, usage counts.

### 8.4 Configuration category (3 pages)

- **Companies** (`nav-shell-configuration.html`) — §5's ACP list: company profiles grid (functional
  currency, fiscal year start, default accounts state) + intercompany pair status + "Provision
  missing pairs" admin action (B4). Row slide-in → profile form.
- **Users & roles** (`nav-shell-users-roles.html`) — §5's roles & access surface: role list with
  plain-language grants, user→role mapping (MJ standard surfaces — don't rebuild), approver
  designation via role membership (schema plan Q1 first iteration).
- **Approvals** (`nav-shell-approvals-settings.html`) — approval-policy settings: which entry types
  require approval (manual JEs — C.8), batch approval requirement toggle, approver role pickers.
  Form-based; writes app settings (no new schema beyond what C.8/A2 land).

### 8.5 Reports category (7 pages)

Landing = AR Aging (`nav-shell-reports.html`); six siblings (`nav-shell-reports-{defrev,
trial-balance, recon, gl-detail, dimension-pl, sales-tax}.html`). All share ONE **report-page
scaffold**: parameter bar (as-of date / date range, company, entity filters) + deterministic re-run
statement ("as of" shown on the report — Jeremy's reproducibility requirement) + house grid +
export. Drill-through v1 line: aging bucket → the order/JE list behind it (one level; §4 Q3 deeper
drill deferred). Backing read models: `vw_ARAging`, `vw_DefRevRollforward`, `vw_TrialBalance_AR`,
`vw_ARtoGLRecon`, GL detail + dimension P&L + tax liability views (B2). FX exposure: no surface
this wave (deferred).

### 8.6 Build sequencing (resolves wave Q10 for this app)

1. **Shell** — nav items metadata + category shells + nav rail + scope chip + workspace-tab
   framework (8.0). Everything else depends on it.
2. **All journal entries** (8.1) — the list-scaffold pilot; establishes grid/keyset/slide-in idiom
   every other list clones.
3. **Batch workspace + Batch approvals + All batches** (8.2) — the highest-pain flow (§1/§2),
   with B1 actions.
4. **JE workspace + JE approvals** (8.1) — manual JE + C.8 flow.
5. **Accounts category** (8.3) — Account links early if order entry starts first (§4 Q4: yes,
   pull ahead of reports; it's the orders Confirm-failure fix path).
6. **Dashboards** (JE + Batches) — after their categories' lists exist (cheap stats only).
7. **Reports** (8.5) — scaffold once, then the seven pages (B2-dependent).
8. **Configuration** (8.4) + **sweep** (§6) — continuous.

## Sequencing

1 (batch approvals rebuild — highest Marcelo pain) → 2 (builder, with B1) → 3 (JE browser + keyset) →
4 (reports, with B2 + orders data) → 5 (settings, with A2) → 6 (sweep, continuous).
2026-07-15 additions (§1 C.8, §5 B.3, §7 scheduled-JE browser): sequenced at the mockup-cycle scoping
(wave Q10). **Superseded 2026-07-16: §8.6 is the operative build order** (per-screen, shell-first).

## Questions for Marcelo

1. **§1/§2 combined or separate?** ~~Batch approvals + batch builder could be one "Batching" workspace
   (build/review/approve in one place) vs two nav items. I lean one workspace, two tabs.~~
   **RESOLVED 2026-07-16 by mockup approval:** one Batches CATEGORY, separate rail pages — Batch
   workspace (build) and Batch approvals (review/approve), plus All batches + Dispatch status (§8.2).
2. **§3 JE browser scope:** ~~incremental fixes vs rebuild-to-idiom?~~ **RESOLVED 2026-07-16:**
   rebuild to idiom per the approved All-journal-entries mockup (§8.1) — it's also the list-scaffold
   pilot.
3. **§4 drill-through depth for v1:** aging bucket → order list is cheap; bucket → JE lines → dimension
   detail is more. Where's the v1 line? **Working default (§8.5): one level (bucket → list); deeper
   drill deferred — flag at build if that's wrong.**
4. **§5 GLAccountLink manager priority:** ~~pull ahead of reports?~~ **RESOLVED in §8.6: yes** —
   Accounts category (incl. Account links) sequences before Reports.
