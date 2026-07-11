# Plan — UI layout & workflows (accounting)

> **Status:** Draft (awaiting Marcelo review) · **Created:** 2026-07-11
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

## 1. Batch approvals page (Marcelo: "I'm not a lover" — rebuild to house style)

- Replace the hand-rolled table with the standard AG grid: sortable/filterable columns (batch №, status,
  built-at, cutoff, entry count, total Dr/Cr, approver), expandable rows → netted summary lines
  (Company × Account × Dimension, per MOD-4).
- Row actions per role (A2): Approve / Reject (reject-unlock semantics from the completed lock redesign,
  with a "entries return to the pool" confirm), Regenerate (open batches).
- Batch detail slide-in: summary lines + drill-through to member JEs + dispatch status
  (`vw_BatchDispatchStatus`).

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

## 4. Reporting surfaces (B2)

- **AR Aging** and **DefRev Rollforward** first: parameterized (as-of date, company, customer filter),
  drill-through (aging bucket → orders/JEs behind it), export. Deterministic re-run (Jeremy's
  reproducibility requirement) stated in the UI (as-of shown on the report).
- Report home: an Accounting Reports nav item listing the pack (§10.2 list) — simple launcher, no separate
  gallery app (out of scope per §10.3).

## 5. Setup / settings screen (MOD-9 deliverable, with A2)

- Roles & access: role list with plain-language grants, user→role mapping surface (MJ standard), the
  approver designation (role membership first iteration — schema plan Q1).
- Company profiles: ACP list + intercompany pair status (A1: which pairs provisioned, 4 accounts each,
  "Provision missing pairs" admin action from B4).
- GLAccountLink mapping manager: the role-mapping screen (product/category/company links, date effectivity)
  — this is where the orders Confirm-failure deep link lands (orders UI §1). Show resolution preview
  ("Product X resolves: Revenue → 4000 via category Software").
- Manual materialization action (B3 Q3, if approved): "Materialize scheduled entries due through [date]"
  with preview + confirm.

## 6. Consistency migration sweep

The GUI review's debt list applied to accounting screens: modal/card mixes → slide-ins; any Claude-improvised
non-grid tables → AG grid; every list gets the time-window default; "Open in Accounting/Orders" buttons
navigate cross-app instead of embedding foreign cards. One sweep task, screen checklist authored at
execution time.

## Sequencing

1 (batch approvals rebuild — highest Marcelo pain) → 2 (builder, with B1) → 3 (JE browser + keyset) →
4 (reports, with B2 + orders data) → 5 (settings, with A2) → 6 (sweep, continuous).

## Questions for Marcelo

1. **§1/§2 combined or separate?** Batch approvals + batch builder could be one "Batching" workspace
   (build/review/approve in one place) vs two nav items. I lean one workspace, two tabs.
2. **§3 JE browser scope:** is the existing JE screen worth incremental fixes, or rebuild-to-idiom in one
   pass (my lean, given it's also the LiveDashboardBase pilot)?
3. **§4 drill-through depth for v1:** aging bucket → order list is cheap; bucket → JE lines → dimension
   detail is more. Where's the v1 line?
4. **§5 GLAccountLink manager priority:** it's the admin fix-path for the orders LOUD-failure flow — pull it
   ahead of reports if order entry starts before the reporting pack?
