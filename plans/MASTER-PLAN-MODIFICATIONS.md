# MASTER-PLAN-MODIFICATIONS — bizapps-accounting

A **living collection** (overlay) of changes to `MASTER-PLAN.md` (the write-forward-only source of
truth) — edit entries in place as decisions evolve; the file must never be self-contradictory (git is
the history). IDs are stable and never reused; keep each entry's reciprocal ⚠ inline marker in
MASTER-PLAN.md in sync when editing/withdrawing. **Precedence: Modification > Update > Extension >
original master-plan text.** Convention: `~/MJDev/shared-plans/repo-planning-system.md` §3.

> **Backfill note (2026-07-10):** MOD-1..10 were backfilled when the planning system was adopted,
> from the decision documents cited in each entry (which remain in `meetings/` and
> `supporting-documents/` as sources). BA-D11 (Currency ownership) and BA-D18 (Recurring* → Scheduled)
> need no MOD — they were revised in-place in the master plan before it was anointed.
> **Retirement note (2026-07-11):** the parallel "master plan v2" doc was DELETED (Marcelo directive —
> it never aligned with, and was never meant to override, MASTER-PLAN.md). Its Amith/Robert source
> rulings are preserved in **`meetings/2026-06 - Amith rescope rulings (extracted from retired v2
> plan).md`** — cited below as "2026-06 rescope rulings". Roadmap content superseded by `action-plans/`;
> full text in git history.

---

## MOD-1 — AccountingPeriod removed from the schema; the ERP owns periods (2026-07-06)
- **Supersedes:** MASTER-PLAN.md §4.4 (AccountingPeriod), §5.4 (period-close trigger), §7 (period close
  workflow), decisions BA-D12 / BA-D13 / BA-D14; also §4.9's period-close materialization trigger (see CA-2).
- **Change:** the schema baseline (`migrations/B202605281200`) ships **no** `AccountingPeriod` table and no
  `AccountingPeriodID` on JournalEntry. Period discipline (close, adjusting-entry routing) is the ERP's job.
- **Why / source (enriched 2026-07-13 per Marcelo's ask):** this is **Amith's ruling from the 2026-07-02
  engine meeting** (CH-1) — *"The concept of accounting period is just irrelevant to us… kill that."*
  His reasoning: our JEs are **multi-company** (CH-2), while a period is a **per-company** concept — it
  only becomes real when the batch splits per company and posts to the ERP, so **period assignment
  happens in the ERP at batch-post time**. Killing the table retired the period-close trigger, W4
  adjusting-entry routing, and period seeding. Sources: change ledger
  `~/MJDev/reports/accounting-engine-meeting-changes/CHANGES.md` CH-1 (transcript ¶5-7, ¶14-21, ¶65-67);
  baseline `B202605281200` revision header 2026-07-06 (AM-1..7 + 07-02 transcript).
- **CONFIRMED 2026-07-13 (Marcelo, from the Amith doc — the definitive fuller verbatim):** *"But the
  concept of accounting period is just irrelevant to us largely because it's going to get settled out
  when the accounting system says it settles out. So when we send a batch over, it's going to go into
  whatever the active accounting period is in the accounting system. That's not our job to worry about.
  We just have to keep track of that. We just don't care. Yeah, just kill that [statement]."* — i.e.
  the ERP's ACTIVE period absorbs whatever we dispatch; period discipline is entirely the ERP's.
- **Consistency note (2026-07-13):** MOD-12 later reversed CH-2 (JEs are single-company again). That
  removes the multi-company-JE *premise* from the rationale above, but the removal ruling **stands on
  its own core rationale** — the fuller verbatim: the ERP settles periods, batches land in its ACTIVE
  period, "not our job to worry about" — which is company-split-agnostic.
- **Status:** Implemented (schema) + **ruling followed-for-now (Marcelo 2026-07-13):** the removal
  stands and **no local period guard is built** — CA-1 is PARKED on this ruling ("there may be changes
  later" — Robert is still researching; revisit only if he overturns it). CA-2 was resolved separately
  by MOD-11 (date-driven scheduled entries).

## MOD-2 — Account-balance materialization deferred; balances compute on demand (2026-06)
- **Supersedes:** MASTER-PLAN.md §4.10, BA-D22 (partially — the account-scope philosophy stands; the
  materialization mechanism is deferred).
- **Change:** no `AccountBalance` / `AccountBalanceByDimension` tables; §10 read-model views compute
  balances on demand. Revisit only if read performance demands.
- **Why / source:** Amith 2026-06-05 ("I might kill this for the first version"); 2026-06 rescope
  rulings C3.
- **Status:** Implemented (schema omits the tables).

## MOD-3 — Batch locking has LEVELS; reject UNLOCKS; open batches regenerate (2026-07-08)
- **Supersedes:** BA-D7 / BA-D16 ("batching is the lock event" as a PERMANENT lock), §8's immutability model.
- **Change:** pre-approval batch = **preliminary, reversible** lock (entries can't be double-batched but can
  be freed); **approval = permanent** lock (through Sent/GLPosted); **reject unlocks** the entries back to
  the unbatched candidate pool; an open/unapproved batch can be **regenerated** (re-gather candidates,
  rebuild summaries — same batch record). Candidate set = every entry not in a batch.
- **Approval mechanism (Amith, 2026-06-28):** the batch approval that makes the lock permanent runs
  **via a task in the `bizapps-tasks` app** — the batch cannot move to `Sent`/dispatch to BC until the
  approval task completes (CFO-level approval requirement).
- **Why / source:** Robert 2026-07-08 (meetings/2026-07-08-robert-meeting-decisions.md D1/D2/D4);
  approval-via-Tasks requirement: 2026-06 rescope rulings ("CFO batch approval").
- **Status:** Implemented — migration `V202607081600__…JEBatch_Reversible_Preliminary_Lock.sql`;
  Implemented-by: `action-plans/ActionPlan - Batch approval lock redesign.md`.

## MOD-4 — Batch summary granularity: NETTED per (Company × GLAccount × Dimension-combo) (2026-06-28)
- **Supersedes:** BA-D26's "GLAccount × dimension combo × side" (separate Dr/Cr summary lines).
- **Change:** one `JournalEntryBatchLineItem` per (Company × GLAccount × Dimension-combo) carrying the **net**
  amount on a single side (e.g. $2,000 Dr + $1,500 Cr same group → one $500 Dr line). Null-dimension entries
  aggregate together within their Company × Account group.
- **Why / source:** Amith 2026-06-28; 2026-06 rescope rulings C5.
- **Status:** Accepted (engine behavior spec).

## MOD-5 — Intercompany: per-company-pair Due-To/Due-From accounts; Payments generates ALL legs (2026-06-28/30)
- **Supersedes/refines:** BA-D17 (confirmed and sharpened) + the seed COA's centralized intercompany accounts.
- **Change:** (a) NO centralized Due-To/Due-From accounts — **per-company-pair** accounts, 4 per pair
  (Amith veto of centralized). (b) **Payments** generates the intercompany balancing legs (Orders posts each
  company's initial JE); Accounting does NOT generate and does NOT net the intercompany position — it
  receives, batches (per MOD-4), locks, posts. Upstream stamps source-entity IDs as the linking key for
  reassembling a logical multi-company transaction. (c) **The `IntercompanyRelationship` wiring table
  does NOT live in accounting** — it was created then DROPPED (net-zero) and deliberately omitted from
  the squashed baseline (2026-07-06 fold header: "Accounting does no intercompany balancing; the
  Payments component owns due-to/due-from"). Payments owns the wiring end-to-end when it's built; the
  per-pair GL accounts themselves will still be `GLAccount` rows (accounting owns COA *storage*), but
  Payments defines/drives them. Amith's OQ-A reference shape for wherever the wiring lands (2026-06-28):

  ```sql
  __mj_BizAppsAccounting.IntercompanyRelationship
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CompanyAID UNIQUEIDENTIFIER NOT NULL,   -- FK → AccountingCompanyProfile; ONE row per UNORDERED pair
    CompanyBID UNIQUEIDENTIFIER NOT NULL,   -- FK → AccountingCompanyProfile
    ADueToBGLAccountID   UNIQUEIDENTIFIER NOT NULL,  -- A's Liability "Due To B"   (GLAccount.CompanyID = CompanyAID)
    ADueFromBGLAccountID UNIQUEIDENTIFIER NOT NULL,  -- A's Asset    "Due From B"  (CompanyAID)
    BDueToAGLAccountID   UNIQUEIDENTIFIER NOT NULL,  -- B's Liability "Due To A"   (CompanyBID)
    BDueFromAGLAccountID UNIQUEIDENTIFIER NOT NULL,  -- B's Asset    "Due From A"  (CompanyBID)
    IsActive BIT NOT NULL DEFAULT 1,
    PK(ID); FKs to ACP + GLAccount; CHECK (CompanyAID <> CompanyBID); UNIQUE (CompanyAID, CompanyBID)
  ```
  Reference-design notes for the Payments-side build: canonical unordered-pair order = **direct UUID
  comparison** (`CompanyAID < CompanyBID` as UUIDs — Marcelo 2026-07-13: robust to renames; readability
  is not a criterion); provisioning is **EAGER per pair** (Amith said eager, eager stands).
- **Ownership sub-question RESOLVED (verified 2026-07-13):** the 2026-06-30 open question ("does
  Accounting still own the wiring?") was answered by the 2026-07-06 baseline squash — **NO** (see (c)
  above; ruling recorded in the migration fold header, lines ~2377/2385). Residual item for Payments/O2
  design time: where the wiring table lives + how per-pair accounts provision into the COA (QUESTIONS
  Q20 residual).
- **Why / source:** Amith 2026-06-28 + 2026-06-30 (2026-06 rescope rulings C1 / OQ-A); baseline
  `B202605281200` fold header 2026-07-06 (the wiring-drop ruling).
- **Status:** Accepted + implemented on the accounting side (nothing to build here); wiring + generator
  land with the Payments subsystem (orders repo, phase O2).

## MOD-6 — All FX (realized + unrealized) computed and posted UPSTREAM (2026-06-29/30)
- **Supersedes:** BA-D10's "realized FX gain/loss auto-emitted by engine", §6.3/§6.4 engine behavior,
  BA-D27's Accounting-side reval action.
- **Change:** Orders/Payments compute + post both realized and unrealized FX. Accounting keeps only the
  GL-account refs (`AccountingCompanyProfile.RealizedFXGainLossGLAccountID`), balance validation, and the
  reporting view (`vw_FxExposure`). ⚠ Note: until the Payments subsystem exists, this responsibility is
  **unowned** — tracked in the schema-alignment action plan.
- **Why / source:** Amith 2026-06-30 ("FX is handled in Orders/Payments"); 2026-06 rescope rulings C1b.
- **Status:** Accepted.

## MOD-7 — Seeded COA trimmed to a minimal AR-subledger set (~10-12 accounts) (2026-06-28)
- **Supersedes:** §4.1's 23-account illustrative seed.
- **Change:** seed only essential subledger accounts (Cash, AR, Sales Tax Payable, Deferred Revenue,
  Commission Payable, Partner Rev Share Payable, Sales/Subscription Revenue, FX gain/loss); the rest sync
  from BC. Centralized intercompany rows removed per MOD-5.
- **Why / source:** Amith ("radical simplification… lean on dimensions"); 2026-06 rescope rulings C2.
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

## MOD-11 — Scheduled-JE recognition is DATE-driven; entries created up-front at booking (2026-07-13)
- **Supersedes:** §4.9's "the period-close engine materializes [each ScheduledJournalEntry] on its target
  period" (BA-D25's period-close trigger), already orphaned by MOD-1. **Resolves CA-2.**
- **Change:** when an order's JEs are booked and locked, **ALL scheduled journal entries are created
  immediately, each bearing its own recognition DATE** (a 12-month $1,200 sub sold 7/13 → 12 × $100
  Dr DefRev / Cr Revenue entries dated 7/13, 8/13, … 6/13; an event product → ONE entry, 100% on the
  event date — the UPD-2/orders two-shape model). Recognition fires **by date, not by period close**:
  the materializer turns due entries (date reached) into Pending JEs, and **batches pick them up by
  their date window** ("batch the July transactions… only the ones in July"). The orders-side
  `RevenueRecognitionSchedule` envelope plays the historical "scheduled transaction group" role.
- **Why / source:** Robert 2026-07-13 (`meetings/2026-07-13-robert-meeting-decisions.md` D1 + the
  transcript), matching Amith's later direction ("create a journal entry at a specific time" — Marcelo).
  Robert's caveat noted: his model is historical practice; flag any collision with Amith rulings back
  to him — none known (CH-1 removed the period trigger; this fills the gap consistently).
- **Status:** Accepted — engine work in the feature action plan B3 (now un-gated on CA-2; CA-1/periods
  remains open and does NOT block this).

## MOD-12 — JournalEntry is SINGLE-COMPANY again (CH-2 reversed; restores master §4.5) (2026-07-13)
- **Supersedes:** the 2026-07-06 baseline revision's "JournalEntry … [is] MULTI-COMPANY: no header
  CompanyID; company is per line" (Amith's 2026-07-02 CH-2 ruling). **Restores the master plan's
  `JournalEntry.CompanyID NOT NULL`** design intent (§4.5) — upstream (orders MOD-11) now books one JE
  per company, so every JE's lines resolve to exactly one company.
- **Change:** (a) `CreateJournalEntry` **validates single-company** (every line's `GLAccount.CompanyID`
  identical) → new typed error `MULTI_COMPANY_DRAFT`; the per-company balance rule (AM-4) collapses to
  plain whole-entry balance. (b) **Schema decision (action-plan item):** reintroduce a
  `JournalEntry.CompanyID` header column (natural home for per-company locks/close + batch splitting +
  numbering) vs keep it derived from lines — lean **reintroduce** (a migration + codegen). (c) Batching
  may now filter/lock **per company** — the enabler for one company closing before another (Marcelo's
  lock-fidelity rationale) and for Robert's future close model; batch summaries/netting (MOD-4)
  unchanged. (d) Per-company JE numbering (`JE-{CompanyCode}-…`, the v2/AD-4 shape) vs the current
  global sequence = open design point for the same action-plan item.
- **Why / source:** Marcelo ruling 2026-07-13 — locks are JE-grained, so per-company close requires
  per-company JEs; accounting must see separate per-company movements; Robert's model concurs
  (meetings/2026-07-13-robert-meeting-decisions.md D3 + postscript). ⚠ Reverses Amith's CH-2 —
  sanity-check with Amith (residual). Orders counterpart: orders MOD-11.
- **Status:** Accepted — schema + engine work added to the schema-alignment action plan (A4).
