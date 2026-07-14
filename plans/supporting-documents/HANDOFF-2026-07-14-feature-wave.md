# Handoff — accounting feature wave (from the schema-plan run, 2026-07-14)

> For the agent executing `action-plans/ActionPlan - Feature build (batching, reporting,
> materialization).md`. Written by the orchestrator at A3/A4 completion. Companion packet:
> bizapps-orders `plans/supporting-documents/HANDOFF-2026-07-14-feature-wave.md`.

## What you inherit (committed on `feature/je-entry-engine`, HEAD ≈ `113eef1`)

- **MOD-12 single-company JEs are LIVE**: `JournalEntry.CompanyID NOT NULL` (+50025 lock-coherence
  trigger, CompanyID in the frozen set); pipeline stage 5 rejects `MULTI_COMPANY_DRAFT`; numbering is
  per-company **`JE-{CompanyCode}-{FY}-{seq}`** (`JournalEntrySequence` keyed `(CompanyID, FiscalYear)`;
  FY from ACP `FiscalYearStartMonth/Day`); batch sequence stays GLOBAL (batches still span companies —
  CH-4). Baseline is `B202605281200` (the V202607081600 lock rework is FOLDED in; edit the baseline in
  place — collapse-into-baseline strategy holds until versioning).
- **The atomic SET op exists**: `Accounting.CreateJournalEntries` (all drafts' rows in ONE
  TransactionGroup; `JEValidationError.DraftIndex`). Orders books through it. The row-writer
  (`AccountingEngine.queueDraftRows`) is TG-parameterized — **orders F1.2b will ask you for a public
  `QueueJournalEntries(drafts, tg)` seam** (queue-only, no Submit; caller owns the TG). That is the
  FIRST cross-app item of the wave.
- **A4.6**: the approver is `ApprovalCFOUserID` (FK `__mj.User`); `TasksAppApprovalGate` assigns tasks
  to Users; decisions stay Person-keyed (tasks-app FK). A3 audit verdicts: ERD appendix
  (`docs/bizapps-accounting-erd.md`) — **no period machinery, no IntercompanyRelationship; do not
  rebuild either** (MOD-1 final / MOD-5(c); timing = DEFERRALS).
- **Suites green** (sweep demo Pending JEs BEFORE tier-2 runs; reseed after): EngineBase 39/39 ·
  CoreEntitiesServer 39/39 · blocks 12/13/25/7/13 · multicompany 9/9 · engine-runtime 16/16 (incl. the
  E5 set-op atomicity trio) · API 8/8 · seed-demo 6/6 views. Ledger: `test-harnesses/testing.md`.
  Playwright tier-5 fixtures were updated for ApprovalCFOUserID but NOT re-run (the UI workstream owns
  that; their WIP is live in this repo — Angular customs/specs — DO NOT sweep it into commits).

## Your wave (per the ACTIVE feature plan; order as written)

**B1** batching: oldest-forward default with Robert's 2026-07-14 filter semantics (empty start +
populated end date/time; date-only end INCLUSIVE `< end + 1 day`; boundary test 23:59:59) + netting
goldens + dimensions · **B1.2 batch-from-view is the FIRST post-wave item** (B-Q1 snapshot-vs-re-resolve
still open with Marcelo) · **B2** Jeremy reporting pack + batched-through view · **B3**
`CreateScheduledJournalEntries` op + DATE-driven materializer + daily action (MOD-11: dated rows created
up-front at booking-lock; NEVER a period FK) · **B4** stays dormant until Payments/O2.

## Gates / conventions

- **Commits need Marcelo's per-wave grant** (report state, never ask mid-flow). NEVER push.
- A2 roles/RLS is NOT yours — gated on Marcelo's co-design + Ethan (LXP) input; R1/R3 research findings:
  `plans/research/A2-R1-R3-rls-and-person-linkage.md` (companion to this packet).
- Docs are part of Done: ERD + lifecycle-hooks per schema/hook change. Tests first-class, full matrix,
  integrated into the harness; honest labels. The `_maint-clear-cross-app-links.ts` script (UNTRACKED)
  runs before any drop-schema until the mjdev fix lands.
