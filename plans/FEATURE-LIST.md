# FEATURE-LIST — bizapps-accounting

> Derived from the plan chain @ `PENDING-REPIN` (2026-07-17) · MODs through MOD-18 (13 withdrawn, 11 superseded by 17) · UPDs through UPD-2
> Staleness check: git log abf4b09.. -- plans/MASTER-PLAN.md plans/MASTER-PLAN-MODIFICATIONS.md plans/MASTER-PLAN-UPDATES.md
>
> DERIVED document — the plan chain (MASTER-PLAN + MODs + UPDs) is the authority; when they disagree,
> fix this file. Convention: `~/MJDev/shared-plans/feature-list-amendment.md` (PLANNING-SYSTEM FEATURE-LIST
> section). IDs stable, never reused. Cross-repo prefix: `ACC-`.
> Status vocab: `Shipped` · `Building` · `Planned` · `Deferred` · `Removed (MOD-x)`.
> ⚠ Statuses marked ◇ are taken from action-plan/agent ledgers and are pending the **Task 65b
> feature-wave sign-off review** — claimed-not-verified until that review closes.

## A. Chart of accounts & company setup

| ID | Feature | Status | Source |
|---|---|---|---|
| A.1 | GLAccount + hierarchy (type, normal side, active) | Shipped | §4.1; baseline |
| A.2 | Seeded minimal AR-subledger COA (~10–12 accounts; rest sync from ERP) | Shipped | MOD-7 |
| A.3 | AccountingCompanyProfile — IsA Disjoint child of `__mj.Company` (functional currency, fiscal year, default accounts, CFO approver → `__mj.User`) | Shipped | BA-D9; MOD-9 (ApprovalCFOUserID via A4) |
| A.4 | OperatingTimeZone (presentation-only; storage is UTC) | Shipped | W1; CLAUDE.md convention |

## B. GL account mapping

| ID | Feature | Status | Source |
|---|---|---|---|
| B.1 | Role-based polymorphic mapping: GLAccountRole + GLAccountLink (+ LinkDimension), date-effective | Shipped | MOD-10 |
| B.2 | `ResolveLinkedAccount` resolution (record → category tree → company default) | Shipped | MOD-10; engine |
| B.3 | ChartOfAccountsMapping (ERP account roundtrip) + enforcement | Shipped (schema/service) ◇ | §4.6/§5.5 |

## C. Journal entries (the core primitives)

| ID | Feature | Status | Source |
|---|---|---|---|
| C.1 | JournalEntry + JournalEntryLine; lifecycle `Pending → Batched → GLPosted` | Shipped | §4.5, BA-D6 |
| C.2 | SINGLE-company JEs: `CompanyID NOT NULL` header + 50025 trigger + `MULTI_COMPANY_DRAFT` typed error | Shipped | MOD-12 (A4) |
| C.3 | Balanced-JE invariant at DB level (deferrable trigger; per-company rule collapsed to whole-entry) | Shipped | BA-D5/§5.2; MOD-12a |
| C.4 | Immutability after lock (only GLPostedAt/GLReferenceID/Status mutable; triggers) | Shipped | BA-D7/§5.3 |
| C.5 | Reversal JEs (ReversesJournalEntryID + consistency trigger; pen-not-pencil) | Shipped | §8.2; trg_JE_ReversalConsistency |
| C.6 | Per-company per-FY numbering `JE-{CompanyCode}-{FY}-{seq}` (FY from ACP settings) | Shipped | BA-D15; MOD-12d (A4.4) |
| C.7 | Dimensions on JE lines (Dimension / DimensionValue / JournalEntryLineDimension) | Shipped | BA-D8; §4.3 |
| C.8 | Manual-JE approval gate (CFO approval for `EntryType='Manual'` before batch) | Planned — CONFIRMED yes (Robert Q6.3, 2026-07-16) | §14 Q10 → Q6 answer |
| C.9 | Pending-JE void semantics for voided source events (flag-and-emit-zero vs delete) | Planned — decision open | §14 Q1; orders §15 Q12 |
| C.10 | JE attachments (`FileID → __mj.File`) | Planned — decision open | §14 Q9 |

## D. Batching & ERP dispatch

| ID | Feature | Status | Source |
|---|---|---|---|
| D.1 | JournalEntryBatch + netted summary lines — SINGLE-COMPANY batch (header `CompanyID`; one batch per company per run), netted per (GLAccount × Dim-combo × EffectiveDate) | Building — as-built is multi-company; rework to MOD-15/16 shape pending | BA-D26 + MOD-4 (rev.) + MOD-15/16 |
| D.2 | Lock LEVELS: preliminary/reversible pre-approval → permanent at approval; reject UNLOCKS; open batch regenerates | Shipped | MOD-3 |
| D.3 | Batch approval via bizapps-tasks (CFO gate — `TasksAppApprovalGate`); decider ENFORCED = Accounting Approver for the batch's company (any-linked-person = dev scaffolding only) | Shipped (gate) / Planned (approver enforcement — required before non-dev) | MOD-3; Q6 answer |
| D.4 | Standard batch filter: empty start + inclusive end date, oldest-forward ascending | Shipped ◇ | MOD-8 (Robert 2026-07-14 semantics) |
| D.5 | View-driven batch builder (arbitrary batches from an MJ User View, validated unbatched-only) | Planned | MOD-8; instance Task 33 |
| D.6 | Batch dispatch to ERP (summary foots-to-control-totals trigger; freeze at Sent/Acknowledged) | Building ◇ (mock target; real BC connector later) | §8.4 |
| D.7 | Global batch numbering sequence (batch sequence stays global; JE numbering is per-company) | Shipped — revisit with MOD-15 rework (per-company batch may re-key) | CH-4; A4 |
| D.8 | Per-JE Posting Date (= EffectiveDate) carried to BC per line; no batch-level posting/document date | Planned | MOD-16 |
| D.9 | Closed-period exception handling: HOLD-and-flag on BC rejection, never auto-roll; feedback loop | Planned | MOD-16 (OQ-1, Jeremy) |
| D.10 | BC API dispatch — API v2.0 `journalLines`, Azure AD client-credentials OAuth, separate write-scoped app registration; NO CSV step | Planned — external dep: Jeremy's BC company-config standardization (9+ companies) | UPD-2 |

## E. Scheduled JEs (rev-rec / amortization)

| ID | Feature | Status | Source |
|---|---|---|---|
| E.1 | ScheduledJournalEntry trio (entry + line items + line dimensions), origin-linked, lockable | Removed (MOD-17) — as-built schema/engine retires (migration pending) | BA-D25/§4.9 |
| E.2 | DATE-driven recognition created up-front at booking (principles absorbed into E.6) | Removed (MOD-17) | MOD-11 → MOD-17 |
| E.3 | Materialization of due entries → Pending JEs (`MaterializeDueScheduledEntries`) | Removed (MOD-17) — no materializer | B3.2 |
| E.4 | Daily auto-materialization (Scheduled Action) | Removed (MOD-17) — no daily job by design (Robert: fragile) | MOD-17 |
| E.5 | Supersede pattern for recomputed schedules | Removed (MOD-17) — corrections are correcting-order netting | §4.9 note → MOD-17 |
| E.6 | Rev-rec staged as REAL forward-dated JEs at booking; batch default cutoff = today; future-reaching filter explicit + approval shows swept range | Planned — rework from as-built E.1–E.5 | MOD-17 (P5) |
| E.7 | Correcting-order netting for contract change/cancel (staged entries immutable) | Planned | MOD-17; orders MOD-12 |

## F. Currency & FX

| ID | Feature | Status | Source |
|---|---|---|---|
| F.1 | Currency entity, ISO-4217 seeded (accounting-owned) | Shipped | BA-D11 |
| F.2 | Original-currency tracking fields on JE lines | Shipped | BA-D10/§6.2 |
| F.3 | Exchange-rate table + pluggable rate providers (manual default) | Deferred | BA-D11; FX deferred |
| F.4 | Realized + unrealized FX computation/posting — UPSTREAM (Orders/Payments); accounting keeps refs + `vw_FxExposure` | Deferred — UNOWNED until Payments exists | MOD-6; ISSUES |

## G. Tax

| ID | Feature | Status | Source |
|---|---|---|---|
| G.1 | Tax data entities (TaxAuthority/Jurisdiction/Rate/Liability/Remittance/CustomerTaxProfile) | Shipped | §4.8 |
| G.2 | Tax DELEGATED to third-party engine (Stripe Tax / Avalara class) behind `TaxCalculationProvider`; our tables snapshot what the engine returned — no rate authoring/sync | Deferred — engine selection + launch-timing open (orders Q21 upd.) | BA-D19 → MOD-18 |

## H. Reporting (read models)

| ID | Feature | Status | Source |
|---|---|---|---|
| H.1 | Read-model views (`vw_TrialBalance_AR`, `vw_AROpenByCustomer`, `vw_DefRevRollforward`, `vw_GLDetail_Subledger`, `vw_SalesTaxLiability`, `vw_ARtoGLRecon`, `vw_DimensionPL`, `vw_FxExposure`) | Shipped ◇ | BA-D23/§10.1 |
| H.2 | Skip-generated interactive reports (Report Gallery app) | Deferred | §10.2/10.3; DEFERRALS |
| H.3 | AR-to-GL reconciliation definition | Building ◇ | §10.1; Phase F |

## I. Periods & timing

| ID | Feature | Status | Source |
|---|---|---|---|
| I.1 | AccountingPeriod + hard close + adjusting-entry routing | Removed (MOD-1, FINAL; MOD-13 withdrawn) | MOD-1/MOD-13 |
| I.2 | Successor timing/period restriction system (detect by DATE, never a period FK) | Deferred — a real gap, deferred not accepted | DEFERRALS row 1; ISSUES |

## J. Balances

| ID | Feature | Status | Source |
|---|---|---|---|
| J.1 | AccountBalance materialization (per-scope) | Deferred (views compute on demand) | MOD-2 |

## K. Roles, permissions & RLS

| ID | Feature | Status | Source |
|---|---|---|---|
| K.1 | App-seeded roles (Accounting User/Admin[/Manager]) + entity permissions | Planned — co-design gated (Marcelo role tree) | MOD-9; instance Task 32 |
| K.2 | Company-scoped RLS via the `UserCompanyRole` grant table (per-company roles: User/Approver/Admin siblings + unscoped Global Admin; audit columns; one Accounting MJ role w/ RLS filters on all 4 ops) | Planned — mechanism RULED (Q22/Q24 answers, 2026-07-16); A2 co-design executes; v1 non-blocking | MOD-9; Q22/Q24 answers |
| K.3 | Role-management/setup screens + install doc | Planned — folds into UI wave (R2) | MOD-9; research doc |

## L. Engine & API surface

| ID | Feature | Status | Source |
|---|---|---|---|
| L.1 | AccountingEngineBase (client-safe) + server AccountingEngine | Shipped | engine action plan |
| L.2 | `Accounting.CreateJournalEntry` + atomic `CreateJournalEntries` (one TransactionGroup, all-or-none; E5 rollback proven) | Shipped | MOD-5-adjacent; F1.2b |
| L.3 | `QueueJournalEntries(drafts, tg)` confirm-unit-of-work seam (TG-parameterized queueDraftRows) | Shipped ◇ | F1.2b |
| L.4 | JE validation library (balance, single-company, account existence, typed errors) | Shipped | JournalEntryValidation |
| L.5 | Sequence service (gap-free numbering) | Shipped | BA-D15; SequenceService |

## M. Intercompany

| ID | Feature | Status | Source |
|---|---|---|---|
| M.1 | Accounting posture: RECEIVE-only (no leg generation, no netting, no wiring table — Payments owns all of it; per-pair account shape reserved in MOD-5) | Shipped (posture; nothing to build) | BA-D17 + MOD-5 |
| M.2 | Intercompany receiving-contract tests | Deferred — until orders O2/Payments exists | DEFERRALS |

## N. Demo & test substrate

| ID | Feature | Status | Source |
|---|---|---|---|
| N.1 | Deterministic seed + association-demo data | Shipped | UPD-1 corollary; SeedData/AssociationDemoSeedData |
| N.2 | Tiered test harnesses (pure unit / live server / API / Playwright — committed, never write-then-delete) | Shipped (structure) / ongoing (coverage) | TEST-ARCHITECTURE; test-harnesses/testing.md |
