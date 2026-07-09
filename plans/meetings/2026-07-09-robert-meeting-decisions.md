# Decisions — 2026-07-09 Robert meeting (Accounting)

Source: `plans/meetings/Accounting Meeting-20260709_121044-Meeting Recording.md` (Robert Kihm, Marcelo Torres,
Ian Zygmunt). Distilled, accounting-relevant decisions. Precedence: **this doc > accounting master plan** on the
points below. The orders-side companion is `bizapps-orders/plans/2026-07-09-robert-meeting-decisions.md`.

> Recurring theme: **features over polish** for the LXP (internal) demo — "the interface is rough; the features
> is what I'm focused on." And: **Jeremy** (BC/accounting SME) is now the authority for golden-path + exception
> rules; Marcelo will get feature lists from Jeremy + Ethan. Route the GAAP-judgment questions there.

## D1 — Permissions/roles: use standard MJ users+roles+RLS; the app SEEDS its own roles
Robert's ruling on how accounting security works (answers the "CFO approver" scoping question + Q17 direction):

- **No new bespoke permission system** unless the plan explicitly called one out. Use MJ's standard stack:
  **Users + Roles + User Roles + entity permissions (CRUD) + row-level security (RLS)**.
- **The open app SEEDS its own roles in its migration files.** At minimum **Accounting User** and **Accounting
  Admin**; optionally an in-between **Accounting Manager** (elevated). Orders does the same for order entry.
- **RLS scopes by company** — e.g. an admin for company Betty can CRUD Betty's `AccountingCompanyProfile` but not
  other companies'; an Accounting-Admin-super role sees everything.
- **Field/status rules layer on top** — "you need to be an Accounting Admin to change this status to that value,"
  "you need this role to be a batch approver." The CFO-approver link on `AccountingCompanyProfile` is a
  *designated approver* (not necessarily the literal CFO); who may edit that link must be permission-gated.
- **CFO-approver field type:** Robert leaned **Employee** join over User ("the approver is always internal"),
  but the mechanism is the MJ role system regardless. → open question (D-Q1) on whether an Employee entity exists.
- **Deliverables:** (a) role-seed migration(s); (b) entity permissions + RLS; (c) a **setup/settings screen +
  doc** explaining which roles a client must assign on install. Marcelo will co-design the role tree ("I'll
  create my own tree of rules within Accounting… I'll help Claude with that"). → **plan + backlog** (below);
  NOT built unilaterally.

## D2 — Batching: default is oldest-forward; arbitrary batches via the MJ VIEW system (Aptify model)
Answers Q13/Q14. Robert re-derived the Aptify batching model as the target:

- **Default batch = everything unbatched up to a chosen date-time** (oldest-forward, continuous). This is the
  common path.
- **Arbitrary batches = leverage MJ User Views.** The user builds a **View** of the records they want in the
  batch (smart filters → arbitrary), then "generate a batch from this view." The engine **validates the view's
  contents**: the universe is **only unbatched entries** — if the view pulls in an already-batched entry, it
  must **reject and yell**. This gives total, auditable control (the view IS the record of "what went in").
- **Out-of-order batching is allowed while the period is open** — do NOT force "can't batch Thursday before
  Wednesday." Natural progression is the default; give control when the period is open. (Closed periods → D4.)
- **No hard batch-by-TYPE restriction.** Aptify siloed batches by type (orders / payments / scheduled txns); for
  us, do NOT hard-code that — let users group via filters/views (company, dimension, account, type). Only enforce
  a type restriction if the plan explicitly says a mix "would never be valid." (Consistent with the 2026-07-02
  multi-company/mixed-batch ruling.) Ask Jeremy how he actually separates payments vs orders. → **plan + backlog**
  (the View-driven batch builder is a real schema/engine feature; Robert is still reviewing Aptify + wants Jeremy).
- **Reversals / cherry-picking (Q12):** Robert's real workflow is **regenerate the open batch** (review → post
  correcting entries same day → regenerate → post) — NOT arbitrary mid-stream cherry-picking. This is already what
  our #12 Regenerate does. GAAP continuity of reversals → route to **Jeremy**.

## D3 — Filter UX: moving-window presets + remembered defaults (DELIVERED in part)
- Robert wants **moving-window presets** ("Today / last week / last month") on Batch Status — more valuable than
  a bare From/To, because "every time I come in here, I want to look at my last period of time that I'm batching."
- His personal default focus = **Pending** (+ Approved in the last week). Exact defaults → ask Jeremy.
- ✅ **Done this pass:** Today / 7 days / 30 days / Clear moving-window presets added to Batch Status (and the
  orders Order History page). Initial defaults left unbounded so nothing is hidden unexpectedly. **Remembered
  per-user defaults** (via `UserInfoEngine`, NOT localStorage) + the exact default window/status → **backlog**
  (pending Jeremy's default values).

## D4 — Closed-period posting guards — CONFLICTS with the 2026-07-06 "periods removed" decision ⚠
Robert wants a **closed-period guard at BOTH the order layer AND the journal-entry layer** ("sorry, June is
closed") plus documented **exception/correcting-entry rules** for extraordinary items that should have been in a
closed period.

- **Conflict:** our current schema **removed `AccountingPeriod`** (migration `B202605281200`: *"REMOVED:
  AccountingPeriod, AccountBalance… AccountingPeriodID removed 2026-07-06 — the ERP owns periods"*). With the ERP
  owning periods, MJ accounting has no local notion of "June is closed" to guard against.
- **Do NOT implement period guards until this is reconciled.** → open question (D-Q2): if the ERP owns periods,
  how do we honor Robert's closed-period guard? Options: (a) ERP rejects the batch post-hoc (`Failed`), (b)
  reintroduce a lightweight per-company "close date," (c) a guard fed by ERP period state. Needs Amith/Robert +
  Jeremy's exception rules. Backdating (order carries its `OrderDate`; JE bears the order date) is **allowed** —
  the only real constraint is the closed-period guard, so this is gated on the same reconciliation.

## Cross-references
- Fulfillment ↔ deferred-revenue mechanics (the Scheduled-Transactions rev-rec model) are an **orders-led** topic;
  see the orders companion doc D-O and QUESTIONS Q16 (now answered). Accounting already plans this as **AD-11
  `ScheduledJournalEntry`** in `bizapps-accounting-master-plan-v2.md` — Robert's explanation validates that design.
