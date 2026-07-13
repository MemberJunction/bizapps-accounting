# Accounting Engine Plan — engine pair + `Accounting.CreateJournalEntry`
**bizapps-accounting · v1.2 (RECREATED 2026-07-06)**

> **Status:** Active (core engine + remote op implemented and proven; remaining items live)
> **Created:** 2026-07-02 (v1.2 re-authored 2026-07-06)
> **Implements:** MASTER-PLAN-MODIFICATIONS MOD-10 (this repo) / orders MOD-5; MASTER-PLAN §11 intent
> **Sources:** 07-02 engine meeting + Amith 07-03 response (see Recreation notice below)

> ## ⚠ Recreation notice
> v1.1 was lost with the deleted `accounting-engine-work` instance (never committed). This v1.2 is a
> faithful re-authoring from the surviving change ledger
> (`~/MJDev/reports/accounting-engine-meeting-changes/CHANGES.md` — full CH-1..14 + AM-1..7 detail with
> transcript ¶ refs) and the review report (`~/MJDev/reports/orders-accounting-system-explained/REPORT.md`).
> Content equivalent; wording differs. The meeting source docs (07-02 transcript
> `meeting-with-marcelo-t-amith-n-and-ian-z.md` + Amith's 07-03 response
> `26-7-3-Post-meeting-update-midifications.md`) were lost too — Marcelo to re-supply into the app's
> plans folder.

**Authority chain (highest first):** Amith 07-03 response (AM-1..7) → 07-02 meeting transcript (¶) →
07-01 first meeting (`plans/Meeting with Amith.pdf`, committed) → this plan → orders amendment
(`bizapps-orders/plans/2026-07-02-engine-meeting-amendment.md`) → the June-2026 rescope rulings
(`meetings/2026-06 - Amith rescope rulings (extracted from retired v2 plan).md`; the v2 doc itself was
retired 2026-07-11) → master plan/README. Target-schema diagram: `erd-accounting-target.md` (same folder).

---

## 1. What this is, in plain English

The engine is accounting's **front desk clerk**. It memorizes the small reference tables (chart of
accounts, roles, links, dimensions, company profiles), so lookups are instant; and it accepts journal
entries from anyone — Orders today, Payments/Subscriptions later — checking each one hard before anything
touches the books. It's **dumb but strict** (Amith): it has no idea what a subscription is, but it will not
record an entry that's unbalanced, hits an unknown/inactive account, or invents a dimension. Valid entries
are tidied up (duplicate lines merged, debits first) and written **atomically** — all rows or none.

## 2. Architecture (modeled on AIEngineBase / AIEngine — CH-10)

### 2.1 `AccountingEngineBase` — browser-safe metadata cache
- **New package** `packages/EngineBase` (`@mj-biz-apps/accounting-engine-base`). Deps: `@memberjunction/core`,
  `@memberjunction/global`, `@mj-biz-apps/accounting-entities` only — NO server deps (importable from
  Angular, scripts, and orders' client code).
- Extends `BaseEngine<AccountingEngineBase>`: declarative `Config()` of `BaseEnginePropertyConfig[]`,
  `GetConfigData<E>('_prop')` getters, auto-refresh on BaseEntity save/delete events, multi-tenant keyed by
  provider, `@RegisterForStartup()`.
- **Cached properties + indexes:**
  - `_glAccounts` (`GLAccount`) — Maps by ID and by `CompanyID+Code`
  - `_glAccountRoles` (`GLAccountRole`) — by ID and by Name
  - `_glAccountLinks` (`GLAccountLink`) — by `EntityID+RecordID` (the polymorphic target)
  - `_dimensions` / `_dimensionValues` — by ID and Code; values also by `DimensionID`
  - `_companyProfiles` (`AccountingCompanyProfile`) — by CompanyID
  - `_currencies` — reference only (FX deferred)
- **Helper:** `ResolveLinkedAccount(entityId, recordId, roleId | roleName, asOfDate): GLAccountLink | null`
  — returns the record's Active link for that role whose StartedAt/EndedAt window covers `asOfDate` (+ its
  ordered `GLAccountLinkDimension` list). This is the primitive Orders' resolver walks (product → category
  tree → company default — the *walk order* is Orders' code; the per-record lookup is ours).

### 2.2 `AccountingEngine` — server write path
- Lives in `packages/Server` (`CoreEntitiesServer` role for this app), wraps the base (AIEngine pattern:
  `this.Base` + re-exposed getters).
- **`CreateJournalEntry(draft: JournalEntryDraft, user: UserInfo): Promise<CreateJournalEntryResult>`** —
  the pipeline (CH-11 + AM-4), each stage with typed error codes:
  1. **Shape validation** — ≥2 lines, ≥1 debit + ≥1 credit, each line exactly one side > 0, valid
     EffectiveDate/EntryType → `MALFORMED_DRAFT`
  2. **Account resolution** — every `GLAccountID` exists → `ACCOUNT_UNKNOWN`; is active → `ACCOUNT_INACTIVE`
  3. **Dimension validation** — every DimensionID/DimensionValueID pre-exists (validate-only, NEVER
     auto-create, CH-12) → `DIMENSION_UNKNOWN` / `DIMENSION_VALUE_UNKNOWN`
  4. **Grouping + normalization** — merge same-side lines with identical (GLAccountID, dimension set);
     order debits before credits; assign `LineNumber` 1..n
  5. **Balance check** — Σdebits = Σcredits for the WHOLE entry AND within EACH company (company = the
     line's `GLAccount.CompanyID`; per-company rule is AM-4) → `UNBALANCED` (payload says which)
  6. **Atomic write** — JE header + lines + line-dimensions in ONE transaction (TransactionGroup); entry
     numbering via the existing `JournalEntryEntityServer`/`SequenceService` hooks; full rollback on any
     failure → `INTERNAL_ERROR`
  7. **Result** — success `{JournalEntryID, EntryNumber, LineCount}` or `Errors[]`
- Never throws for logical failures (remote-op convention) — inspect the result.

### 2.3 `CreateJournalEntryOperation` — the callable surface (A5)
- Hand-authored `BaseRemotableOperation<CreateJournalEntryInput, CreateJournalEntryOutput>`,
  `@RegisterClass(BaseRemotableOperation, 'Accounting.CreateJournalEntry')`, `InternalExecute` = thin call
  into `AccountingEngine.Instance`. Code-only (no metadata row — passes the metadata gate per
  `guides/REMOTE_OPERATIONS_GUIDE.md`).
- Registered via the app's server bootstrap. **Input/output types exported from the EngineBase package** so
  Orders and browsers import types without server deps.
- Same call site everywhere: orders-server calls `op.Execute(input, {provider, user})` **in-process**;
  browser/test scripts invoke the identical op over GraphQL `ExecuteRemoteOperation` — that satisfies the
  "run the engine functionality on local" requirement.

## 3. The contract

```ts
interface JournalEntryDraft {
  EffectiveDate: string;                       // ISO date
  EntryType: JournalEntryEntity['EntryType'];  // derived from the generated entity union — never hand-copied
  Description?: string;
  // lineage soft refs (any subset): OrderID, OrderLineID, PaymentID, SubscriptionID, ContractID, …
  OrderID?: string;
  Lines: JournalEntryLineDraft[];
}
interface JournalEntryLineDraft {
  GLAccountID: string;                         // resolved UUID (S2 — Orders resolves via links)
  DebitAmount?: number;                        // exactly one side, > 0
  CreditAmount?: number;
  Description?: string;
  OrderLineID?: string;
  Dimensions?: { DimensionID: string; DimensionValueID: string }[];
}
interface CreateJournalEntryResult {
  Success: boolean;
  JournalEntryID?: string;
  EntryNumber?: string;
  LineCount?: number;
  Errors?: { Code: JEErrorCode; LineIndex?: number; Message: string }[];
}
type JEErrorCode = 'MALFORMED_DRAFT' | 'ACCOUNT_UNKNOWN' | 'ACCOUNT_INACTIVE' | 'DIMENSION_UNKNOWN'
                 | 'DIMENSION_VALUE_UNKNOWN' | 'UNBALANCED' | 'INTERNAL_ERROR';
```

Notes: **no CompanyID anywhere** (multi-company, CH-2); **no period fields** (CH-1); no FX fields in v1
(deferred — the baseline's `Original*` currency triple stays nullable and unused); account NUMBERS are only
the ERP wire format at the batch boundary (AM-4), never in this contract.

## 4. Schema changes (edit the v1.0 baseline `B202605281200__….sql`, then clean DB + CodeGen — AM-7 steps 1-2)

App is pre-release ⇒ the baseline migration is editable; Amith explicitly sanctioned the clean-DB + CodeGen
rebuild. (Note the repo `PUBLISH_NO_BREAK_POLICY` applies from the next *published* version — we are before
that line.)

1. **Remove tables:** `AccountingPeriod` (+ its entity server, period-close trigger, W4 adjusting-entry
   routing, period seeding in the ACP hook), `AccountBalance`, `AccountBalanceByDimension` (AM-1).
2. **`JournalEntry`:** drop `CompanyID`, `AccountingPeriodID`, `OriginalAccountingPeriodID` (CH-2). Status
   flow Pending→Batched→GLPosted unchanged; lineage soft-ref columns + `ReversesJournalEntryID` stay;
   immutability trigger stays (minus the dropped-column compares).
3. **`JournalEntryBatch`:** status CHECK becomes `Pending | Approved | Sent | Posted | Failed | Cancelled`
   (CH-3); drop `AccountingPeriodID`; header `CompanyID` dropped (multi-company batch — per-company lives on
   the line items; ⚠ OQ-F: Robert confirms shape during step 3).
4. **New tables (AM-2/AM-5):**
   - `GLAccountRole` — ID, Name, Description, Status (Active/Inactive), Sequence. Seed: Cash, Accounts
     Receivable, Inventory, Cost of Goods Sold, Sales, Sales Discounts, Sales Returns and Allowances
     (+ Deferred Revenue — ⚠ OQ-H assumed).
   - `GLAccountLink` — ID, GLAccountID FK, **GLAccountRoleID FK (⚠ OQ-G assumed — Amith's list omits it but
     the system can't function without it)**, EntityID + RecordID (TaggedItem-style polymorphic), Status
     (Pending/Active/Disabled), StartedAt/EndedAt (nullable datetimeoffset — date-effective windows),
     Comments nvarchar(max).
   - `GLAccountLinkDimension` — ID, GLAccountLinkID FK, DimensionID FK, Sequence. (Values supplied at
     JE-build time from order context — ⚠ OQ-I.)
5. **`GLAccount.AccountType`** → 5-value CHECK NVARCHAR(15): Asset, Liability, Equity, Revenue, Expense
   (AM-3; replaces the 10-value Contra*/Statistical list).
6. **Ripple:** `TaxLiability.AccountingPeriodID` dropped; `ScheduledJournalEntry.TargetAccountingPeriodID`
   dropped (tables themselves parked, AM-6 — no materializer; domain entity servers will generate SJEs,
   Robert to explain). `ChartOfAccountsMapping`, sequences, `JournalEntryLink`, Currency tables unchanged.
   **⚠ DERIVED DECISION (flagged, not in any meeting doc):** `JournalEntrySequence` is keyed
   (CompanyID, FiscalYear) and `JournalEntryBatchSequence` by CompanyID — both scoping headers just lost
   their CompanyID, so numbering goes **global** (JE: per FiscalYear; batch: single counter). Confirm with
   Marcelo/Amith.
7. **Wire format** (for step 3, batching): batches group by Company+GLAccount+Dimensions, split by company,
   one summary JE per company, **by account number**, all-or-nothing per batch (AM-4, ¶151-153).
8. **Trigger updates:** delete `trg_JournalEntry_PeriodClose` + `trg_AccountingPeriod_NoOverlap`; strip
   dropped-column compares from the JE + batch immutability triggers; update batch triggers to the 6-status
   vocabulary (locked once Approved+; frozen once Sent/Posted); extend the balanced-on-lock + reconcile
   triggers with the AM-4 **per-company** balance check (via GLAccount/line-item CompanyID).

Baseline layout note: hand-authored DDL = lines ~1-2970 (tables → FKs → triggers → sprocs → ext-props →
SchemaInfo insert → read-model views); everything after is the stale CodeGen capture — DELETE it and
re-capture after the clean-DB codegen (the file's own banner documents this workflow). The read-model views
referencing periods/CompanyID/AccountBalance must be reworked or dropped in the same edit.

Per repo convention: update `docs/bizapps-accounting-erd.md` + `docs/lifecycle-hooks.md` in the same change.

## 5. Open questions

| # | Question | Working assumption |
|---|---|---|
| OQ-F | Multi-company batch shape (header CompanyID vs per-company groups) | header CompanyID dropped; line items carry company — Robert confirms during step 3 |
| OQ-G | `GLAccountLink.GLAccountRoleID` (absent from Amith's field list) | ADD it — can't distinguish a record's Revenue link from its AR link without it |
| OQ-H | Deferred Revenue missing from the role seed | ADD it — Amith's own sale example credits it |
| OQ-I | Source of dimension VALUES at JE-build time | order context supplies them — Robert |
| D-SEQ | JE/batch numbering scope after de-companying (derived, §4.6) | global sequences — confirm |

Resolved in prior rounds: OQ-A (period-removal ripple → AM-1), OQ-B (wire format → AM-4), OQ-C (role
lookup table → AM-2), OQ-D (mapping-dimension siblings → AM-5 single table), OQ-E (SJE materializer →
AM-6 none).

## 6. Build order (AM-7) + validation

1. **Schema** — edit the baseline per §4.
2. **Clean DB + CodeGen** — fresh migrate, regenerate entities/resolvers/forms; commit regen with the
   schema change. (This is the one sanctioned codegen run — normal instances never codegen.)
3. **Batching update** — multi-company split, per-batch AND per-company balance, 6-status flow,
   account-number wire (existing `BatchingEngine` reworked). OQ-F lands here.
4. **Engine** — EngineBase pkg + AccountingEngine.CreateJournalEntry + the remotable op.
5. **Orders slice** — see the orders amendment §5 (scaffold app from mj-sample-open-app, schema,
   OrdersEngine, Confirmed hook, basic UI, end-to-end proof).

**Test matrix (dual-layer per TEST-PROTOCOL):**
- **Unit (Vitest):** pipeline against fake cache data — every error code, grouping/merge, Dr-before-Cr
  ordering, overall + per-company balance, `ResolveLinkedAccount` windows/status.
- **Live server harness** (`test-harnesses/server/engine-runtime.ts`, existing block*-runtime.ts pattern):
  real op against the real DB, incl. an induced mid-write failure proving atomic rollback leaves ZERO
  partial rows (verified by raw SQL, not the code under test).
- **Client tier:** the same op over GraphQL `ExecuteRemoteOperation` (proves A5 / "runs on local").
- **GUI:** JEs created by the op render in Explorer; step 5 ends with the UI walk (order → Confirm → JE →
  batch).
- ⚠ **Known cost:** the existing 170/170 suite partially exercises periods/balances and WILL break with §4;
  tests get updated alongside the schema and every change reported — nothing quietly deleted.
