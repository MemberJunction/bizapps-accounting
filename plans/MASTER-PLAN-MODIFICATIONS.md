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
- **Status:** Implemented (schema) + **FINAL (Marcelo 2026-07-14, after a same-day MOD-13 detour,
  withdrawn):** the removal stands in full — **no local period guard, no close machinery**. Added
  rationale: batching consolidates entries into summaries that lose date information anyway; the app is
  an AR subledger and the ACCOUNTANTS are responsible for batching entries into the right periods.
  Future timing complexities will be handled when they arise. Jeremy validation stays queued (Q19f:
  "we don't lock anything in the AR subledger — concerns?"). CA-2 was resolved separately by MOD-11.

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

## MOD-4 — Batch summary granularity: NETTED per (Company × GLAccount × Dimension-combo) (2026-06-28; reaffirmed 2026-07-17)
- **Supersedes:** BA-D26's "GLAccount × dimension combo × side" (separate Dr/Cr summary lines).
- **Change:** one `JournalEntryBatchLineItem` per **(Company × GLAccount × Dimension-combo)**
  carrying the **net** amount on a single side (e.g. $2,000 Dr + $1,500 Cr same group → one $500
  Dr line). Null-dimension entries aggregate together within their Company × Account group.
- **Key notes (2026-07-17, Marcelo reaffirmation — the canonical key KEEPS Company):** under
  MOD-15 single-company batches the Company dimension is degenerate (every line shares the batch
  header's company) — but it stays in the stated key: it is correct today at zero cost, and it is
  REQUIRED the day the backlogged multi-company-batch evolution lands (Amith's per-company-
  sections-inside-a-batch lean — BACKLOG row). A brief 2026-07-14 draft added EffectiveDate to
  the key (per-JE posting dates, Robert P1) — **withdrawn 2026-07-17** when the thread consensus
  landed on Amith's singular batch Posting Date (MOD-16): one date per batch ⇒ nothing per-date
  to preserve in the summary.
- **Why / source:** Amith 2026-06-28; 2026-06 rescope rulings C5; Marcelo 2026-07-17 ("remember
  we split by company × account × dimension"); MOD-15/16 evolution.
- **Status:** Accepted (engine behavior spec — rework lands with MOD-15/16).

## MOD-5 — Intercompany: per-company-pair Due-To/Due-From accounts; Payments generates ALL legs (2026-06-28/30)
> ⚠ **Pending revision (2026-07-17):** orders [Q39](QUESTIONS.md#q39)'s ruled model (b)
> (seller-of-record holds the customer AR) implies intercompany legs arise **at booking**, not at
> payment — which would supersede "Payments generates ALL legs." Flagged, not yet rewritten;
> Jeremy's Q39 confirmation is the trigger.
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
- **Standard filter semantics (Robert 2026-07-14):** the canonical batch filter is an **EMPTY start
  date + a populated end date/time** — pulling ALL unbatched entries from earlier dates, **sorted by
  date ascending**. A date-only end value is **inclusive of that whole date** (i.e. `< end date + 1 day`
  when no time component is given).
- **Why / source:** Robert 2026-07-09 (meetings/2026-07-09-robert-meeting-decisions.md D2), Aptify model.
- **Status:** Accepted — View-driven batch builder not yet built.

## MOD-9 — Permissions: standard MJ roles + RLS; the app SEEDS its own roles (2026-07-09)
- **Supersedes:** none (additive — the master plan was silent on permissions).
- **Change:** no bespoke permission system. Seed **Accounting User** + **Accounting Admin** (optionally
  Manager) roles in migrations; entity CRUD permissions + RLS scoping by company; field/status rules layer
  on top (batch-approver, status transitions). CFO-approver is a designated-approver link **to
  `__mj.User`** (D-Q1/Q17 RESOLVED, Marcelo 2026-07-13 — no Employee entity exists; the approver is a
  security identity; as-built `ApprovalCFOPersonID` (Person) migrates to `ApprovalCFOUserID` in the A4
  wave). Deliverables include a setup/settings screen + install doc.
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

## MOD-11 — ~~Scheduled-JE recognition is DATE-driven; entries created up-front at booking~~ — **SUPERSEDED by MOD-17 (2026-07-14/15)**
> ⚠ **This entry is superseded by MOD-17:** the schedule-record + materializer mechanism below is
> replaced by REAL forward-dated JEs written at booking (no `ScheduledJournalEntry` records, no
> materializer, no daily job). MOD-11's two lasting contributions survive INSIDE MOD-17: recognition
> is date-driven (never period-close), and all recognition entries are created up-front at booking.
> Original text retained for history. (ID retained, never reused.)

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
  unchanged. (d) **JE numbering: per-company `JE-{CompanyCode}-{FY}-{seq}` per the master (RESOLVED, Marcelo
  2026-07-14)** — the global sequence existed only for the multi-company-JE era; re-keyed in A4.4.
- **Why / source:** Marcelo ruling 2026-07-13 — locks are JE-grained, so per-company close requires
  per-company JEs; accounting must see separate per-company movements; Robert's model concurs
  (meetings/2026-07-13-robert-meeting-decisions.md D3 + postscripts). Reverses Amith's CH-2 —
  **LOCKED (Marcelo 2026-07-13): a logical requirement** (per-company close independence). We build on
  it now rather than wait for Amith (out of town); only a later Amith-ordered BROAD restructure would
  revisit it (considered unlikely — we'd adapt then). Orders counterpart: orders MOD-11.
- **Status:** Accepted + **LOCKED** — schema + engine work in the schema-alignment action plan (A4).

## MOD-13 — ~~Manual period close reinstated~~ — **WITHDRAWN (same day, 2026-07-14)**
- **Status: WITHDRAWN by Marcelo, 2026-07-14** (hours after acceptance; ID retained, never reused).
- **What it was:** a lightweight manual period-close guard (close table + closed-span trigger + actions),
  motivated by a batch-then-BC-close race-condition argument.
- **Why withdrawn (Marcelo):** periods stay REMOVED — *"when someone creates a batch, it creates
  consolidated entries that lose the date information anyway, so having closed periods doesn't really
  make sense. The accounting app is just an AR subledger — it's not meant to worry about which period is
  open or closed. The accountants that use it are responsible for batching the entries into the right
  periods."* No closed periods for now; other timing complexities may come later and will be handled then.
- **Net effect:** MOD-1 stands in full (the 2026-07-13 follow-Amith's-removal ruling is final); CA-1 is
  Resolved on the removal; the A5 action-plan item, the closed-span trigger, the close UI, and the orders
  Confirm closed-span check are all struck. The design constraint stated here survives as a general
  principle: **JEs carry only their posted date — any future timing rule detects by time, never a period FK.**

## MOD-14 — Batch build and approval-task raise are TWO transactions; the batch carries a task pointer (2026-07-16)

- **Supersedes:** the current batching behaviour in which building a batch is **gated on the approval
  task succeeding** — `BatchingEngine.raiseApprovalTaskOrReverse` calls `cancelBatch(batchId)` and
  rethrows if `gate.onBatchBuilt` throws, so a tasks-side failure destroys an otherwise valid batch.
- **Status:** **Proposed** — pending Marcelo's confirmation, see [Q28](QUESTIONS.md#q28).
  (Schema + engine are being built against it now; the shape is his ruling, the confirmation is on
  the details.)
- **Why / source:** Marcelo, 2026-07-16, during the §8.2 Batch-workspace build.

### The change

1. **Transaction 1 — the batch, atomic.** Batch header + summary lines + summary-line dimensions +
   control totals + the JE `Pending→Batched` locks commit in ONE `TransactionGroup` (all rows or
   none). Today these are **12 sequential `.Save()` calls with no transaction**: a failure partway
   through leaves a header, summary lines, control totals, and *some* of the JEs locked to a batch —
   a half-built batch. This is a live latent defect, independent of the UI work.
2. **Transaction 2 — the approval task, separate, accounting-owned.** Raising the CFO Task is its
   own action in its own transaction, which **also stamps `JournalEntryBatch.ApprovalTaskID` +
   `ApprovalTaskRaisedAt`**. The two commit together, so a Task without a pointer (or a pointer
   without a Task) is unrepresentable. It runs as part of the batch-creation process.
3. **Batch creation is NOT gated on task success.** `cancelBatch`-on-task-failure is removed. A built
   batch with `ApprovalTaskID IS NULL` is a **detectable, retryable** state — not a destroyed batch.
4. **Accounting owns transaction 2**, because bizapps-tasks is a dependency OF accounting, not the
   reverse.

### Consequences

- **Schema (applied):** `V202607161700__v1.0.x__Batch_ApprovalTask_Pointer.sql` adds `ApprovalTaskID`
  + `ApprovalTaskRaisedAt`, a CHECK making the half-stamped state unrepresentable, and a filtered
  index. **No FK** — a cross-app FK would couple accounting's DDL to the tasks schema; integrity comes
  from the single transaction that writes both rows.
- **Validation becomes a column check**, not a cross-schema join through `MJ_BizApps_Tasks: Task Links`
  (which is how `TasksAppApprovalGate` finds a batch's task today — see its
  "Batch X has no approval Task" path). That was Marcelo's stated motivation.
- The dispatch gate (`assertApproved`) is unaffected: an unapproved batch still cannot dispatch. What
  changes is only that a *task-raise* failure no longer annihilates the batch.
- Implemented via a Remote Operation over the engine (the app's established pattern —
  `Accounting.CreateJournalEntry`, `Accounting.MaterializeDueScheduledEntries`), not a hand-written
  resolver.

## MOD-15 — Batches are SINGLE-COMPANY: `JournalEntryBatch.CompanyID` header; one batch per company per run (2026-07-14/17)
- **Supersedes:** the as-built multi-company batch (the un-recorded "D-SEQ 2026-07-06" SQL-comment
  decision — batches spanning companies with per-line `CompanyID` and a send-time per-company
  split; `BatchingEngine` OQ-F). **Restores BA-D16's intent** ("one consolidated JE per Company",
  Company in the grouping key). Resolves [Q30](QUESTIONS.md#q30) — Marcelo had independently ruled
  one-company-per-batch 2026-07-16; Robert's P3 proposal + Jeremy's sign-off confirm it.
- **Change:** (a) `JournalEntryBatch` gains a header `CompanyID`; `buildBatch(companyId, dateFilter)`
  gathers ONLY that company's Pending JEs, on that company's own schedule.
  (b) `JournalEntryBatchLineItem.CompanyID` is **dropped** (redundant — every line shares the header
  company); netting key per revised MOD-4. (c) The per-company footing trigger (50023) collapses
  into the overall footing check (50014) — same assertion. (d) The send-time per-company split
  disappears. (e) The "an order's JEs land in exactly one batch" rule is rewritten: a multi-company
  order's JEs land in **one batch per company**, tied via the JEs' order lineage. (f) Per-company
  batches make **TargetSystem-per-company** work for free (each batch carries one company AND one
  target — the single-`TargetSystem`-column contradiction Q30 flagged dissolves).
- **Accepted trade-offs (Jeremy, 2026-07-17 — with two CONDITIONS):** approvals multiply to one per
  company-batch — Jeremy calls this "actually a better control" (per-entity approvers = segregation
  of duties). Intercompany legs may post at different times — accepted ONLY with: **(1) companies
  with an active intercompany relationship keep their batch cadences ALIGNED** (both weekly, not one
  weekly/one monthly) so the in-transit window stays short — a configuration/ops rule the batch UI
  should surface; **(2) the intercompany rec process explicitly tracks "posted in source, not yet in
  BC" as a reconciling item TYPE**, not a break — lands with the AR-to-GL recon definition (H.3).
- **Why / source:** Robert P2-reason-2 extended to batches (companies batch on different cadences;
  all-or-nothing multi-company sends trap one company's postables behind another's closed period) —
  `meetings/2026-07-14 - je-single-company-batching-proposal.md` P3; Jeremy's conditions + Amith's
  alignment in `meetings/2026-07-17 - User Feedabck over the week 07-12.md`.
- **Status:** Accepted (Jeremy ✅ w/ conditions; Marcelo ✅ [Q30]; Robert authored; Amith aligned on
  the posting-date thread — his formal P3 sign-off rides the same channel). Schema + engine rework
  to schedule.

## MOD-16 — The batch carries a SINGULAR Posting Date; one aggregated JE per batch to the GL; closed-period = HOLD-and-flag (2026-07-14/17; reworked 2026-07-17 per the thread consensus)

- **Supersedes:** Robert's P1-as-amended per-JE posting-date model (and this entry's own first
  draft of it — edited in place per ledger hygiene; git holds the history). The thread's FINAL
  consensus is **Amith's model, Jeremy explicitly on board** ("I had a quick chat with Robert…
  I'm 100% on board with this approach and agree the Posting Date is a critical element and needs
  to match between systems").
- **Change:**
  1. **One aggregated journal entry per batch** goes to the GL — "we do not send individual
     transactions, we aggregate and roll up… you never get individual JEs/dates into the GL
     system" (Amith). The detail lives only in the subledger (his standing philosophy).
  2. **`JournalEntryBatch.PostingDate` — a singular, accountant-set date per batch** (chosen at
     batch build; sensible default from the batch window, e.g. the cutoff date). It is carried to
     the GL's posting date and **must match between systems**. `BatchedAt`/`SentAt`/
     `AcknowledgedAt` remain process timestamps.
  3. **Document date is informational; posting date drives the period** (Jeremy's field-mapping
     warning stands — never cross the two).
  4. **Period-boundary discipline is the ACCOUNTANT's, aided by the UI** (consistent with MOD-1
     FINAL: "the accountants are responsible for batching the entries into the right periods"):
     batch windows shouldn't straddle a period boundary that matters; the batch UI's presets
     (end-of-yesterday / end-of-week / end-of-month) + the displayed swept date range are the
     guardrails, not engine machinery.
  5. **Closed-period rule (OQ-1 — ANSWERED, Jeremy restated for the record):** "an
     exceptions/flagging process — the system should know when a period is closed in BC (via a
     feedback loop) and flag the entry rather than attempt to post blind. That's the 'hold for
     review' option, NOT auto-roll." v1 mechanism: dispatch-time exception handling (a BC
     rejection flags the batch/entry for review — the in-flight/exceptions inbox surface); a
     proactive BC period-status pull is the later feedback-loop enhancement.
- **Netting consequence:** with one posting date per batch there are no per-line dates to
  preserve → the MOD-4 netting key stays **(GLAccount × Dimension-combo)** within the
  single-company batch (the brief EffectiveDate-in-the-key draft is withdrawn with the P1 model).
- **Follow-up owed to Robert:** his P1 proposal doc + BatchingEngine model implement per-JE dates
  ("I am going to stick with my model for now… changing the batching strategy is fairly
  straightforward. I will keep an ear open to future changes") — the thread consensus supersedes
  it; Jeremy also asked him to update OQ-1's status in that doc. Tracked in
  EXTERNAL-EXPECTATIONS R2.
- **Why / source:** Amith's posting-date chime-in + Jeremy's alignment + OQ-1 restatement,
  `meetings/2026-07-17 - User Feedabck over the week 07-12.md`; Marcelo ruling 2026-07-17 (Q37:
  "answered directly by Amith"). Resolves [Q37](QUESTIONS.md#q37).
- **Status:** Accepted (Amith ✅ author · Jeremy ✅ 100% · Marcelo ✅; Robert to sync his doc).

## MOD-17 — Deferred revenue = REAL forward-dated JEs at booking; `ScheduledJournalEntry` machinery retired (2026-07-14/15)
- **Supersedes:** **MOD-11** (schedule records + date-driven materializer + daily materialization),
  BA-D25's `ScheduledJournalEntry` design, and §4.9's schedule machinery. Orders counterpart:
  orders MOD-12 (BO-D11 rewrite). MOD-11's principles survive: date-driven (never period-close),
  created up-front at booking.
- **Change:** at booking, the recognition waterfall is written as **actual future-dated JEs** (a
  12-month $1,200 sub → 12 × $100 Dr DefRev / Cr Revenue JEs, each with its own EffectiveDate). No
  schedule records, **no materializer, no daily scheduled job** (Robert: a wake-up task is "fragile
  — just create them"). Batches pick up forward-dated entries ONLY if the batch date filter reaches
  that far forward: **default cutoff = today** (the default filter never reaches forward); building
  a future-reaching batch requires explicitly setting the filter; batch approval displays the date
  range being swept (the accountants are trusted + the UI makes the right thing easy).
- **Changes & cancellations — correcting-order netting:** staged forward-dated entries are **never
  edited or deleted**. A contract change/cancel produces a **correcting Order** emitting new
  rev-rec entries that NET against what's staged (immutable history; every correction auditable).
  Consistent with the orders reversal model (orders MOD-7). Jeremy: "fully addresses the concern I
  raised about orphaned forward-dated entries… cleaner model than what I had in mind."
- **Why / source:** P5 (`meetings/2026-07-14 - je-single-company-batching-proposal.md`) + Robert's
  ruling in the 2026-07-14 meeting + Jeremy sign-off 2026-07-15 (recorded in the 2026-07-17
  feedback doc).
- **Status:** Accepted. ⚠ **Build impact is real:** the shipped `ScheduledJournalEntry` trio +
  `MaterializeDueScheduledEntries` op retire (feature rows E.1–E.5 → Removed); the UI plan's
  "Scheduled entries" page (§8.1) becomes a **future-dated-JE browser** (no Materialize action);
  batch-filter defaults + approval date-range display land in the batch workspace spec (§8.2).

## MOD-18 — Tax calculation DELEGATED to a third-party engine; our tax tables RECORD, never author rates (2026-07-14)
- **Supersedes:** §9's implied self-maintained rate authority (Local provider + rate sync as a
  primary path) and any "build a sales-&-use-tax rate package" ambition (LXP D13's long-term wish —
  the engine IS that package).
- **Change:** BizApps will **not implement tax calculation**. A third-party engine (Stripe Tax /
  Avalara / Vertex class) calculates; our responsibilities are exactly two: **(1) send** the engine
  its inputs at order-line time (ship-to/customer address, product tax category, customer tax
  profile incl. exemption status); **(2) record** what returns — multiple taxes per line per
  jurisdiction (`OrderLineTaxLine`-shape). The provider seam (`TaxCalculationProvider`) stands; the
  engine is a provider implementation. **Consequence:** `TaxJurisdiction`/`TaxRate` become
  **reference/snapshot data recording what the engine returned** — never a rate authority we
  maintain or sync.
- **Open (tracked in orders [Q21](../../bizapps-orders/plans/QUESTIONS.md#q21), updated):**
  engine selection (Stripe Tax = low-friction LH4I candidate; Avalara-class when non-Stripe
  channels/exemption-cert management matter — finance + cost call, Robert/Marcelo + Jeremy);
  launch timing (tax is deliberately NOT phase one — LH4I launching WITH tax vs without is an
  explicit business call, Jeremy/John); exemption certificates (we sell to nonprofits — profile is
  ours, cert validation may come from the engine).
- **Why / source:** Robert's A4 position, `meetings/2026-07-14 - lxp-open-items-response.md`.
- **Status:** Accepted (position stated by Robert; Marcelo folding it as plan of record 2026-07-17).
