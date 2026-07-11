# 2026-07-10 — Decisions & directives (3 meetings)

Distilled from three 2026-07-10 recordings (raw transcripts in this folder):
1. **Matt & Marcelo — GUI Review** → UI/UX + performance direction (full write-up below).
2. **Marcelo, Ian & Robert — Accounting Check-in 2** → domain scope + terminology (accounting slice below; orders slice in the orders companion `bizapps-orders/plans/meetings/2026-07-10-decisions.md`).
3. **Marcelo & Jeremy H — Accounting Feature Collection** → finance-user requirements.

> Working decisions doc, NOT a master plan. `*-master*.md` are left untouched. Orders-domain schema decisions live in the
> **orders companion doc**; this one owns the UI/UX direction + accounting-side domain items.

---

## 1. UI/UX direction (GUI Review — Matt Chriest)

### 1.1 Consistency over per-page invention
- **Standardize views across pages** so a user re-orienting between pages sees the same shapes. MJExplorer today is a
  hodgepodge (tech debt); Matt is consolidating shared components (standard **card**, **search**, **table views**).
  Don't reinvent per page; propose shared components to Matt rather than rebuilding the wheel.
- **Lean into AG-grid tables, not dropdown/accordion cards, for record lists.** Accountants know tables; dropdown cards
  can't sort. Align our tables with the clean AG-grid look (e.g. Trial Balance). **Batch Approvals** specifically needs
  sorting/filtering added (it has none today).

### 1.2 Dialog / side-panel — the shape decision (refines tasks #54–56)
- **Kill the bulky center modal** (the current "open in Accounting" WIP on the order detail — slow, dropdown-heavy, feels
  out of place). Two sanctioned surfaces, chosen by context:
  - **Slide-in side panel (from the right, overlays content)** — the DEFAULT for "see/edit more detail about a row." This is
    the MJ side-panel infra; use + skin it.
  - **Centered pop-up dialog** — for pages that **already show the record's data on screen** (e.g. the **Company** page):
    a slide-in there would imply you can edit the page AND the panel at once (confusing). Instead: curated company view on
    screen + a button that pops a **well-skinned centered dialog** showing everything to edit. So **we need BOTH** a slide-in
    and a good centered dialog — both skinned (not bulky/slow/clunky).
- **Curated "useful" default view → pop out for full/advanced.** The front layer shows only *useful* fields (hide raw
  UIDs / external-system foreign-key IDs; show the **name + a link** to the related record instead). Click "Details" to pop
  into the dialog/side-panel for full viewing + editing. **For now: full exposure** (to discover what's useful), then narrow.
- **Editability flows from entity metadata** (`AllowUpdateAPI` etc.) — **no per-field editability overlays**, especially in the
  generic dialog. Custom pages (order/company creation) curate their own fields — that's the sanctioned exception.
- Engine = MJ form host (`MJFormPresenterService` / `EntityFormConfig` / `<mj-form-slide-in>`), already adopted in 5 dashboards.
  Emphasis is **functionality** (smoother viewing + real editing); polish/skin as we go.

### 1.3 Orders board (Orders Management)
- Current infinite-scroll, single-heavy-column kanban is disliked. Fixes: add a **time-span filter** (default ~7–30 days),
  reduce the board to a **curated set of statuses**, and push the deep/large-volume view to **Order History**. A CFO with a
  million orders must not load them all. Kanban (Trello-like) stays; **accordion-per-status was considered and set aside**
  (breaks the salesperson's "advance the order" flow).

### 1.4 Performance / Live-Dashboard base class (the big table effort)
Marcelo's written plan (connects to the "Live Page System" plan in shared-plans):
- **Keyset pagination** (constant-time; live on the server) → bring into the tables. A **composite-keyset** stub exists to
  order-by-any-column in constant time with the PK as tiebreaker (no skips/dupes on scroll). Replaces offset queries
  (offset re-scans everything each page — the CDP slowness).
- **`setVisible`** — pages are kept alive in the background; manage visibility so background pages stop running updates.
- **Base Live Dashboard class** — integrates `setVisible` + auto-builds refresh queries + receives DB pushes + updates
  intelligently (no per-button manual refresh). Push to the server must echo back to the same session's other views.
- **WebSocket reconnect event** → mark all data **dirty** on reconnect (no stale data). No page listens to this today.
- **Custom table dropdown/expand** (AG community has no master/detail; we don't pay for AG Enterprise). Build our own,
  handling updates without invalidating requests. Consider AG Enterprise later — **ask Amith** (he drove AG grid) before big moves.

## 2. Accounting-domain (Check-in 2 + Jeremy)

- **We are the SUBLEDGER; Business Central stays the GL.** NOT building: a general ledger / year-end close / financial-statement
  generation (those remain in BC).
- **AR customer subledger:** book AR to the **customer account** (subledger), not just the GL account. Jeremy's BC flow: booking
  to the customer auto-offsets AR *and* credits that customer's running balance; booking to a bare GL account leaves the customer
  looking unpaid. We must model the **customer running balance / customer subledger**, and **payment application** closes the
  specific order (see orders doc §B).
- **Deferred-revenue recognition:** monthly today (one line/customer/month, Dr Deferred Rev / Cr Revenue). Amith's vision =
  **continuous running balance** (no month-end true-up). Reproducibility (closed periods / fixed time windows → identical
  re-runs) is the hard requirement. Batching the recognition entries is acceptable.
- **Sales tax:** collect + remit capability needed (none today). Jurisdiction-specific; provider (Avalara-style) via BizApps
  Accounting, needs shipping address; `TaxLiability`/`TaxRemittance` already modeled. (Details in orders doc §E.)
- **Reporting / FP&A:** Power BI off SQL is **cutover-gating** for Jeremy. The weekly cash-flow model (fragile multi-source Excel:
  renewals + HubSpot pipeline + budget + actuals) → automate into an **FP&A layer** in the platform. Reproducible, not
  formula-in-a-broken-spreadsheet. This is net-new scope on the accounting side.

## 3. Cutover / process
- **Earliest cutover 2026-08-17** (NOT this Friday). Baseline → daily-ish demos → correct → iterate. Expect rework.
- Prefer plans with **counter-examples** ("NOT building X today") to surface hidden assumptions (Robert).

## Cross-references
- **Orders-domain schema decisions** (orders=invoices, payments/Stripe/PaymentLine, subscriptions, taxes, customer/contact
  schema, contracts, intercompany, the SCHEMA-GAP directive): `bizapps-orders/plans/meetings/2026-07-10-decisions.md`.
- UI direction refines tasks **#54** (form-host slide-in adoption), **#55** (skin/de-bulk — now: slide-in AND centered dialog),
  **#56** (creation-page field exposure). New effort surfaced: the **Live-Dashboard / keyset-table** performance system.
- Deferred-rev-on-fulfillment conflict (Task #48 / Robert D-O1) is unchanged by these meetings.
