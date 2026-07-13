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
