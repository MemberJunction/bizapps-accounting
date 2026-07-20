# Meetings — processed index

Tracks which meeting recordings in this folder have been read + distilled into decision docs. When you process a
new meeting, add a row (newest first) and prepend a `> ✅ PROCESSED` banner to the recording file itself.

| Meeting recording | Date | Status | Distilled into |
| --- | --- | --- | --- |
| `07102026 - Matt & Marcelo GUI Review.md` | 2026-07-10 | ✅ PROCESSED (2026-07-10) | `2026-07-10-decisions.md` §1. UI direction: consistency + AG-grid tables, slide-in default + centered dialog for already-on-screen pages (Company), curated-useful default view → pop-out full edit, orders board time-span + curated statuses, batch-approvals sorting, the Live-Dashboard/keyset-table performance system. |
| `07102026 - Marcelo Ian & Robert Accounting Check-in 2.md` | 2026-07-10 | ✅ PROCESSED (2026-07-10) | `2026-07-10-decisions.md` §2 (+ orders companion §A–I). Orders=invoices=AR primitive; we're the subledger (BC stays GL); payments/Stripe now in scope; subscriptions+deferred-rev; taxes; cutover ≥ Aug 17; SCHEMA-GAP directive (re-pass orders master, compare built vs plan). |
| `07102026 - Marcelo & Jeremy H Accounting Feature Collection.md` | 2026-07-10 | ✅ PROCESSED (2026-07-10) | `2026-07-10-decisions.md` §2 (+ orders companion §C–H). Real BC/bill.com/AIDP workflow: customer needs email(s)/address/contacts/sales-rep, external doc number, posting+due dates, AR customer subledger + payment application, deferred-rev monthly, sales-tax collect/remit, FP&A cash-flow model. |
| `Accounting Meeting-20260709_121044-Meeting Recording.md` | 2026-07-09 | ✅ PROCESSED (2026-07-09) | `2026-07-09-robert-meeting-decisions.md` (+ orders companion). Roles/RLS, batching-via-Views, moving-window presets (shipped), closed-period-vs-periods-removed conflict (Q18), fulfillment↔deferred-rev disconnected (Q16 answered). |
| `Accounting Meeting-20260708_120251-Meeting Recording.md` | 2026-07-08 | ✅ PROCESSED | `2026-07-08-robert-meeting-decisions.md`. Batch levels-of-locking, reject-unlocks, regenerate. |
| `Transcript of Amith's Explanation.md` | 2026-06-05 | ✅ PROCESSED (design input) | the June-2026 rescope work — now formalized as MOD-1..10 + UPD-1 (the distillation doc, "master plan v2", was RETIRED/deleted 2026-07-11; rulings preserved in `2026-06 - Amith rescope rulings (extracted from retired v2 plan).md`). |

### 2026-07-11--Amith's Demo Feedback.md — ✅ PROCESSED 2026-07-11
Accounting-side impact (full triage in the orders copy's _PROCESSED.md — the file is identical):
- Singular-transactional-call requirement extended to `CreateScheduledJournalEntries` → feature action
  plan B3.1 updated with the Amith citation.
- Engine-base/server split: accounting already HAS it (`accounting-engine-base` + `AccountingEngine`) —
  Amith's pattern confirmed as-built here; the refactor lands orders-side (orders UPD-5 / F0).

### 2026-07-13 - Marcelo & Robert accounting meeting.md — ✅ PROCESSED 2026-07-13
Distilled → `2026-07-13-robert-meeting-decisions.md`. Landings: **MOD-11** (scheduled JEs DATE-driven,
created up-front at booking — resolves CA-2; CA table + §4.9 marker + ISSUES + BACKLOG + feature plan B3
updated); Q18 progressed (Robert researching CH-1; batch-as-lock rejected; change ledger imported as
`2026-07-02 - engine meeting change ledger (recreated) [CH+AM].md`); D3 tension flagged (company-owns-order
vs CH-2 multi-company JE → orders Q2 escalated); D4 process (public-repo transcripts OK'd; 24h-intent notes
to Robert; demo ~Tue). Transcript renamed from "2026-13-2026 - …".

### 2026-07-17 intake batch (seven docs) — ✅ PROCESSED 2026-07-17 (orchestrator Task 97a)
| Doc | Landed as |
| --- | --- |
| `2026-07-14 - je-single-company-batching-proposal.md` (Robert P1–P5 + OQ-1) | **MOD-15** (single-company batches, P3), **MOD-16** (per-JE posting dates + OQ-1 hold-and-flag), **MOD-17** (forward-dated JEs replace ScheduledJournalEntry, P5; supersedes MOD-11), MOD-4 key revised; Q30 ANSWERED. P2 was already MOD-12. |
| `2026-07-17 - User Feedabck over the week 07-12.md` (Jeremy/Amith/Robert/Marcelo) | Sign-offs + conditions folded into MOD-15/16; **UPD-2** (BC API direct, write-scoped registration, company-config standardization — Jeremy owns). |
| `2026-07-16 - marcelo-questions-draft-answers.md` (Robert's rulings) | **Q22/Q24/Q6/Q7/Q3 ANSWERED** (UserCompanyRole grant table; audit-cols-now; per-company approval task + enforced Approver; manual-JE gate YES; bless as-built IDs w/ FYI-to-Amith); Q19 amended (default window never forward; company out of dimension list); K.2/C.8/D.3 feature rows updated. Orders-side: Q2/Q21 answers, OF4/OQD/OS7 → orders plan chain. |
| `2026-07-14 - lxp-open-items-response.md` (Robert A1–A4) | **MOD-18** (tax delegated to third-party engine); orders coupon-provider UPD + orders Q21; A1 (DueDate) closed in place. |
| `2026-07-14 - lxp-commerce-and-fulfillment 2.md` (Ethan v3 — decisions locked) | orders UPD-6 edit (LXP→Orders DIRECT at launch; Teams-first contingency; A7 date ask) + `ROADMAP-lxp-launch.md` (orders repo). |
| `2026-07-14 - Accounting Meeting.md` | REST-over-MCP + "just create them" rulings (inside MOD-16/17 + UPD-2); orders Order↔JE junction UPD; batch-UI defaults note in UI plan §8. |
| `2026-07-16 - Accounting Meeting.md` | Process items only (answers doc incoming — now landed above; "on hold ≠ deferred" framing; Q22 ownership superseded by the answers doc same day). |

### 2026-07-17 - Amith Demo Feedback.md — ✅ PROCESSED 2026-07-17 (Task 98a)
Landings: **forms-first UI ruling** (Entity Forms first-class, widgets shared with dashboards, no
bespoke pop-ups — form host renders inside modal/slide-in; UI plan §8 ruling block, mirrored in
orders §13) · **manual-JE requirements** (provenance loud, authorization-gated — folds into C.8) ·
**ng-entity-viewer for COA** (§8.3) · **multi-company batches = BACKLOG** (Amith's per-company-
sections lean recorded; MOD-15 stands for v1; Robert/Jeremy asked by Amith himself) · don't
over-polish dashboards.

### 2026-07-20 - Accounting Meeting - Marcelo robert Ian.md — ✅ PROCESSED 2026-07-20 (Task 116a)
Q23/Q38/Q39 ANSWERED (see stocks). Landings: MOD-5 REVISED (booking legs from Orders; cash-clearing
stays Payments) · UPD-5 REVISED (categories COMPANY-OWNED — supersedes shared-taxonomy; AR-vs-revenue
anchor split) · orders MOD-14 (seller-of-record booking JE shape) · per-line fulfillment YES +
order-splitting practice + fulfillment-groups future idea (orders BACKLOG) · tax remit = selling
company (Jeremy verifies via Q19) · Robert to send his review + D2D example (expectations R8) ·
process note: send packets the night before meetings.

### 2026-07-20 - Accounting UI Review - Matt and.md — ✅ PROCESSED 2026-07-20 (Task 116a)
Landings: **UPD-6** (container queries · sticky interior chrome + internal tab scroll · tab
required-indicators · filter variants · table-to-edge) · Q25 PARTIAL (deep-link helper → MJ core
via OUR PR, Amith review) · Q27/Q35 raised live (awaiting Matt) · routing BACKLOG row updated
(shift-click/split EXISTS; gap = discoverability + split button + active-window top bar) ·
workspace-tab framework: Matt's nav-rethink may absorb (no commitment).
