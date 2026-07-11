# MASTER-PLAN-MODIFICATIONS — bizapps-accounting

Append-only ledger of changes to `MASTER-PLAN.md` (the write-forward-only source of truth).
**Precedence: Modification > Extension > original master-plan text.** Every entry has a reciprocal
⚠ inline marker at the superseded section in MASTER-PLAN.md. Convention:
`~/MJDev/shared-plans/repo-planning-system.md`.

> **Backfill note (2026-07-10):** MOD-1..10 were backfilled when the planning system was adopted,
> from the decision documents cited in each entry (which remain in `meetings/` and
> `supporting-documents/` as sources). BA-D11 (Currency ownership) and BA-D18 (Recurring* → Scheduled)
> need no MOD — they were revised in-place in the master plan before it was anointed.

---

## MOD-1 — AccountingPeriod removed from the schema; the ERP owns periods (2026-07-06)
- **Supersedes:** MASTER-PLAN.md §4.4 (AccountingPeriod), §5.4 (period-close trigger), §7 (period close
  workflow), decisions BA-D12 / BA-D13 / BA-D14; also §4.9's period-close materialization trigger (see CA-2).
- **Change:** the schema baseline (`migrations/B202605281200`) ships **no** `AccountingPeriod` table and no
  `AccountingPeriodID` on JournalEntry. Period discipline (close, adjusting-entry routing) is the ERP's job.
- **Why / source:** schema decision 2026-07-06 recorded in the baseline migration header ("REMOVED:
  AccountingPeriod, AccountBalance… the ERP owns periods").
- **Status:** Implemented (schema) — ⚠ **CA-1 and CA-2 are OPEN**: Robert's closed-period guard
  (2026-07-09 D4) and the ScheduledJournalEntry materialization trigger both need this reconciled
  (QUESTIONS Q18 / D-Q2). Do not build period guards until resolved.

## MOD-2 — Account-balance materialization deferred; balances compute on demand (2026-06)
- **Supersedes:** MASTER-PLAN.md §4.10, BA-D22 (partially — the account-scope philosophy stands; the
  materialization mechanism is deferred).
- **Change:** no `AccountBalance` / `AccountBalanceByDimension` tables; §10 read-model views compute
  balances on demand. Revisit only if read performance demands.
- **Why / source:** Amith 2026-06-05 ("I might kill this for the first version"); v2 plan C3 / AD-12
  (`supporting-documents/bizapps-accounting-master-plan-v2.md`).
- **Status:** Implemented (schema omits the tables).

## MOD-3 — Batch locking has LEVELS; reject UNLOCKS; open batches regenerate (2026-07-08)
- **Supersedes:** BA-D7 / BA-D16 ("batching is the lock event" as a PERMANENT lock), §8's immutability model.
- **Change:** pre-approval batch = **preliminary, reversible** lock (entries can't be double-batched but can
  be freed); **approval = permanent** lock (through Sent/GLPosted); **reject unlocks** the entries back to
  the unbatched candidate pool; an open/unapproved batch can be **regenerated** (re-gather candidates,
  rebuild summaries — same batch record). Candidate set = every entry not in a batch.
- **Why / source:** Robert 2026-07-08 (meetings/2026-07-08-robert-meeting-decisions.md D1/D2/D4).
- **Status:** Implemented — migration `V202607081600__…JEBatch_Reversible_Preliminary_Lock.sql`;
  Implemented-by: `action-plans/ActionPlan - Batch approval lock redesign.md`.

## MOD-4 — Batch summary granularity: NETTED per (Company × GLAccount × Dimension-combo) (2026-06-28)
- **Supersedes:** BA-D26's "GLAccount × dimension combo × side" (separate Dr/Cr summary lines).
- **Change:** one `JournalEntryBatchLineItem` per (Company × GLAccount × Dimension-combo) carrying the **net**
  amount on a single side (e.g. $2,000 Dr + $1,500 Cr same group → one $500 Dr line). Null-dimension entries
  aggregate together within their Company × Account group.
- **Why / source:** Amith 2026-06-28; v2 plan C5.
- **Status:** Accepted (engine behavior spec).

## MOD-5 — Intercompany: per-company-pair Due-To/Due-From accounts; Payments generates ALL legs (2026-06-28/30)
- **Supersedes/refines:** BA-D17 (confirmed and sharpened) + the seed COA's centralized intercompany accounts.
- **Change:** (a) NO centralized Due-To/Due-From accounts — **per-company-pair** accounts, 4 per pair
  (Amith veto of centralized). (b) **Payments** generates the intercompany balancing legs (Orders posts each
  company's initial JE); Accounting does NOT generate and does NOT net the intercompany position — it
  receives, batches (per MOD-4), locks, posts. (c) Account wiring lives in a planned
  `IntercompanyRelationship` table joining two AccountingCompanyProfiles with all four accounts,
  eagerly provisioned per pair (Amith-specified schema in the v2 plan Preface OQ-A) — **not yet migrated**.
- **Why / source:** Amith 2026-06-28 + 2026-06-30; v2 plan C1 / OQ-A.
- **Status:** Accepted — schema work (IntercompanyRelationship) pending; generator lands with the
  Payments subsystem (orders side).

## MOD-6 — All FX (realized + unrealized) computed and posted UPSTREAM (2026-06-29/30)
- **Supersedes:** BA-D10's "realized FX gain/loss auto-emitted by engine", §6.3/§6.4 engine behavior,
  BA-D27's Accounting-side reval action.
- **Change:** Orders/Payments compute + post both realized and unrealized FX. Accounting keeps only the
  GL-account refs (`AccountingCompanyProfile.RealizedFXGainLossGLAccountID`), balance validation, and the
  reporting view (`vw_FxExposure`). ⚠ Note: until the Payments subsystem exists, this responsibility is
  **unowned** — tracked in the schema-alignment action plan.
- **Why / source:** Amith 2026-06-30 ("FX is handled in Orders/Payments"); v2 plan C1b.
- **Status:** Accepted.

## MOD-7 — Seeded COA trimmed to a minimal AR-subledger set (~10-12 accounts) (2026-06-28)
- **Supersedes:** §4.1's 23-account illustrative seed.
- **Change:** seed only essential subledger accounts (Cash, AR, Sales Tax Payable, Deferred Revenue,
  Commission Payable, Partner Rev Share Payable, Sales/Subscription Revenue, FX gain/loss); the rest sync
  from BC. Centralized intercompany rows removed per MOD-5.
- **Why / source:** Amith ("radical simplification… lean on dimensions"); v2 plan AD-8 / C2.
- **Status:** Implemented (SeedData).

## MOD-8 — Batching UX/model: oldest-forward default; arbitrary batches via MJ User Views (2026-07-09)
- **Supersedes:** extends §8.4's batch-run grouping with the selection model (additive to MOD-3).
- **Change:** default batch = everything unbatched up to a chosen date-time (oldest-forward). Arbitrary
  batches = build an MJ User View of desired records → "generate batch from view"; engine validates the
  view resolves ONLY unbatched entries (reject loudly otherwise). Out-of-order batching allowed while
  open. No hard batch-by-type restriction (group via filters/views). Reversal workflow = regenerate the
  open batch, not mid-stream cherry-picking.
- **Why / source:** Robert 2026-07-09 (meetings/2026-07-09-robert-meeting-decisions.md D2), Aptify model.
- **Status:** Accepted — View-driven batch builder not yet built.

## MOD-9 — Permissions: standard MJ roles + RLS; the app SEEDS its own roles (2026-07-09)
- **Supersedes:** none (additive — the master plan was silent on permissions).
- **Change:** no bespoke permission system. Seed **Accounting User** + **Accounting Admin** (optionally
  Manager) roles in migrations; entity CRUD permissions + RLS scoping by company; field/status rules layer
  on top (batch-approver, status transitions). CFO-approver is a designated-approver link
  (Employee-vs-User open, D-Q1). Deliverables include a setup/settings screen + install doc.
- **Why / source:** Robert 2026-07-09 D1.
- **Status:** Accepted — not built (plan + backlog; co-design the role tree with Marcelo).

## MOD-10 — Role-based polymorphic GL account mapping (GLAccountRole / GLAccountLink) (2026-07-02)
- **Supersedes:** none in this plan directly (additive; it's what supersedes the ORDERS plan's
  `Product.*GLAccountID` columns — see the orders repo's MOD ledger).
- **Change:** `GLAccountRole` + `GLAccountLink` + `GLAccountLinkDimension` map accounts to external
  records (Product / ProductCategory / Company) by role, date-effective; consumers resolve via
  `AccountingEngineBase.ResolveLinkedAccount` (product → up the category tree → company default).
- **Why / source:** 2026-07-02 engine meeting rulings (see `action-plans/ActionPlan - Accounting engine +
  CreateJournalEntry remote op.md` + the orders repo's `meetings/2026-07-02-engine-meeting-amendment.md`).
- **Status:** Implemented (schema + engine).
