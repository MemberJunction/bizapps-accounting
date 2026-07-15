# Plan — UI layout & workflows (accounting)

> **Status:** ACTIVE (approved for execution — Marcelo review completed 2026-07-14) · **Created:** 2026-07-11
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

**Shared components (cross-app — 2026-07-15 gap analysis, Marcelo-approved):** this plan consumes a set
also consumed by the orders UI plan §0 — approval inbox (tasks-backed) · list-screen scaffold (grid +
time window + keyset + slide-in) · schedule/waterfall viewer · GL-resolution preview widget · cross-app
deep-link service · status stepper/lifecycle chips · money strip · role-gating seam. Build each ONCE.
**Open ruling: physical home for shared UI code — bizapps-common's Angular package? (Marcelo.)**

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

## Sequencing

1 (batch approvals rebuild — highest Marcelo pain) → 2 (builder, with B1) → 3 (JE browser + keyset) →
4 (reports, with B2 + orders data) → 5 (settings, with A2) → 6 (sweep, continuous).
2026-07-15 additions (§1 C.8, §5 B.3, §7 scheduled-JE browser): sequenced at the mockup-cycle scoping
(wave Q10).

## Questions for Marcelo

1. **§1/§2 combined or separate?** Batch approvals + batch builder could be one "Batching" workspace
   (build/review/approve in one place) vs two nav items. I lean one workspace, two tabs.
2. **§3 JE browser scope:** is the existing JE screen worth incremental fixes, or rebuild-to-idiom in one
   pass (my lean, given it's also the LiveDashboardBase pilot)?
3. **§4 drill-through depth for v1:** aging bucket → order list is cheap; bucket → JE lines → dimension
   detail is more. Where's the v1 line?
4. **§5 GLAccountLink manager priority:** it's the admin fix-path for the orders LOUD-failure flow — pull it
   ahead of reports if order entry starts before the reporting pack?
