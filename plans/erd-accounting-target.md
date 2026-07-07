# ERD — bizapps-accounting TARGET schema (post 2026-07-03 rulings)
**v1.2 (RECREATED 2026-07-06 — original lost with the `accounting-engine-work` instance)**

Companion to `accounting-engine-plan.md` §4. System-wide views: `erd-orders-accounting-interface.md` +
`erd-full-system.md` (same folder). Authority: AM-1..7 > 07-02 transcript (¶). ⚠ = open question.
Review artifact — baseline not edited yet.

**Removed from today's v1.0 baseline:** ~~`AccountingPeriod`~~ ~~`AccountBalance`~~
~~`AccountBalanceByDimension`~~ + the period FK columns everywhere + `JournalEntry.CompanyID` +
`JournalEntryBatch.CompanyID` (multi-company).
**New:** `GLAccountRole`, `GLAccountLink`, `GLAccountLinkDimension`.
**Changed:** `GLAccount.AccountType` → 5-enum · batch statuses → 6-value.

## Chart of accounts + the mapping system (A1/A2)

```mermaid
erDiagram
    Company ||--o| AccountingCompanyProfile : "IsA — same UUID"
    AccountingCompanyProfile ||--o{ GLAccount : "owns CoA"
    GLAccount ||--o{ GLAccount : "ParentGLAccountID"
    GLAccount ||--o{ GLAccountLink : ""
    GLAccountRole ||--o{ GLAccountLink : "⚠OQ-G col assumed"
    GLAccountLink ||--o{ GLAccountLinkDimension : "which dims apply, ordered"
    Dimension ||--o{ GLAccountLinkDimension : ""
    GLAccountLink }o..|| Company : "polymorphic: company DEFAULTS"
    GLAccountLink }o..|| AnyRecord : "polymorphic: ProductCategory / Product / future"
    GLAccount ||--o{ ChartOfAccountsMapping : "our account ↔ ERP account"

    GLAccount { uuid ID PK
                uuid CompanyID FK
                string Code "account NUMBER — unique per company (UQ), ERP wire id"
                string Name
                enum AccountType "Asset|Liability|Equity|Revenue|Expense (AM-3, was 10-value)"
                bool IsActive }
    GLAccountRole { uuid ID PK
                    string Name "Cash · AR · Inventory · COGS · Sales · Sales Discounts · Sales Returns and Allowances (⚠OQ-H: +Deferred Revenue assumed)"
                    string Description
                    enum Status "Active|Inactive"
                    int Sequence }
    GLAccountLink { uuid ID PK
                    uuid GLAccountID FK
                    uuid GLAccountRoleID FK "⚠OQ-G assumed"
                    uuid EntityID "polymorphic pair (TaggedItem-style)"
                    string RecordID ""
                    enum Status "Pending|Active|Disabled"
                    datetimeoffset StartedAt "nullable — date-effective window"
                    datetimeoffset EndedAt "nullable"
                    string Comments }
    GLAccountLinkDimension { uuid ID PK
                             uuid GLAccountLinkID FK
                             uuid DimensionID FK "values at JE time ⚠OQ-I"
                             int Sequence }
```

The date-effective window is Amith's "new CoA effective Aug 1" scenario: enter the new link today with
StartedAt, EndedAt the old one; resolution flips automatically; old JEs never touched.

## Journal entries (A3) — multi-company, no periods

```mermaid
erDiagram
    JournalEntry ||--|{ JournalEntryLine : "≥2 lines, ≥1 Dr + ≥1 Cr"
    GLAccount ||--o{ JournalEntryLine : "account ⇒ the LINE's company"
    JournalEntryLine ||--o{ JournalEntryLineDimension : "pre-existing dims only (CH-12)"
    Dimension ||--o{ JournalEntryLineDimension : ""
    DimensionValue ||--o{ JournalEntryLineDimension : ""
    Dimension ||--o{ DimensionValue : ""
    JournalEntry ||--o{ JournalEntry : "ReversesJournalEntryID"
    JournalEntry ||..o{ JournalEntryLink : "polymorphic lineage"
    JournalEntrySequence ||..o{ JournalEntry : "numbering (global per FY — derived D-SEQ)"

    JournalEntry { uuid ID PK
                   string EntryNumber UK
                   date EffectiveDate
                   enum EntryType
                   enum Status "Pending|Batched|GLPosted (unchanged)"
                   uuid OrderID "soft lineage (+OrderLineID, PaymentID, SubscriptionID, …)"
                   uuid BatchID FK "null until batched"
                   string NOTE "NO CompanyID (CH-2) · NO period (CH-1)" }
    JournalEntryLine { uuid ID PK
                       int LineNumber "engine-assigned, Dr before Cr"
                       uuid GLAccountID FK
                       decimal DebitAmount "XOR Credit, >0 (CK_JEL_OneSide stays)"
                       decimal CreditAmount ""
                       uuid OrderLineID "soft ref"
                       string FX "Original* triple stays nullable/unused — FX deferred" }
```

Balance rules: Σ Dr = Σ Cr for the whole entry **and** within each company (AM-4) — company is implicit
via `GLAccount.CompanyID`; enforced in the engine AND the balanced-on-lock triggers. Immutability trigger
(locked after Batched/GLPosted) stays.

## Batching to the ERP (A4)

```mermaid
erDiagram
    JournalEntryBatch ||--o{ JournalEntry : "BatchID — an order's JEs land in ONE batch (¶44)"
    JournalEntryBatch ||--|{ JournalEntryBatchLineItem : "summaries: group Co+GL+Dims, SPLIT by company (⚠OQ-F)"
    JournalEntryBatchLineItem ||--o{ JournalEntryBatchLineDimension : ""
    GLAccount ||--o{ JournalEntryBatchLineItem : "sent as account NUMBER (AM-4)"
    JournalEntryBatchSequence ||..o{ JournalEntryBatch : "numbering (global — derived D-SEQ)"
    ERP_External }o..|| JournalEntryBatch : "all-or-nothing per batch; ERP owns periods"

    JournalEntryBatch { uuid ID PK
                        string BatchNumber UK
                        enum Status "Pending|Approved|Sent|Posted|Failed|Cancelled (CH-3, was 4)"
                        string TargetSystem
                        datetimeoffset SentAt "nullable"
                        string NOTE "NO CompanyID — multi-company; line items carry company" }
    JournalEntryBatchLineItem { uuid ID PK
                                uuid CompanyID FK "per-company grouping lives HERE"
                                uuid GLAccountID FK }
    ERP_External { string name "Business Central / QuickBooks / NetSuite / Sage" }
```

Status meanings: Pending = mutable/deletable · Approved = human-locked (new control step) · Sent = on the
wire · Posted = ERP confirmed (renames Acknowledged) · Failed = ERP rejected (retry loop + escalating
alerts) · Cancelled = terminal, from Pending or unsent Approved.

## Kept but parked (out of the fence)

- **Scheduled JEs** (3 tables) — `TargetAccountingPeriodID` dropped; NO materializer (AM-6): domain entity
  servers generate them; Robert to walk through.
- **Tax** (6 tables) — `TaxLiability.AccountingPeriodID` dropped; otherwise untouched; v1-not-phase-1.
- **Plumbing** — `ChartOfAccountsMapping`, sequences, `JournalEntryLink`, `Currency`/`CurrencySpotRate`.

## Removed, and why that's safe

| Gone | Why |
|---|---|
| `AccountingPeriod` + every FK to it | company-specific + ERP-owned; multi-company JEs made ours a liability (¶5-7, 65-67) |
| `AccountBalance` / `AccountBalanceByDimension` | "Claude-isms" (AM-1) — balance tracking is the ERP's job |
| `JournalEntry.CompanyID` / `JournalEntryBatch.CompanyID` | entries + batches span companies (CH-2/CH-4) |

Pre-release app ⇒ baseline migration is editable; rebuild = clean DB + CodeGen (Amith-sanctioned, AM-7).
