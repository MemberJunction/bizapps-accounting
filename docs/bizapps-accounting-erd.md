# BizApps Accounting — Entity-Relationship Diagram

> **Source of truth:** `migrations/B202605281200__v0.1.0__Schema_and_Tables.sql` (the frozen baseline).
> **28 entities** in schema `__mj_BizAppsAccounting`. MJ entity names are `MJ_BizApps_Accounting: <PluralName>`
> (e.g. table `JournalEntry` → entity `MJ_BizApps_Accounting: Journal Entries`).
> **Generated 2026-06-29** from the baseline; regenerate if the schema changes.

## How to read this
- **Hard FK** = an enforced foreign key (drawn as a relationship line / marked `FK`).
- **soft-ref** = a plain `UNIQUEIDENTIFIER` with **no FK constraint** — by design, for IDs owned by
  downstream apps this repo has no knowledge of (Orders/Payments/Contracts). Marked `"soft-ref"`; **not**
  drawn as a relationship. This is how lineage is kept without coupling (AD-15).
- **External** (not in this schema): `Company`, `User`, `File`, `Entity` (`__mj`), `Organization` (`__mj_BizAppsCommon`).
- **Status flags:** ✅ built+used · 🟡 schema present, feature later (`CurrencySpotRate` FX follow-on) ·
  ⏸ **deferred** (`AccountBalance*` — AD-12, unused in v1) · 🟦 **proposed, not yet migrated**
  (`IntercompanyRelationship` — OQ-A; shown at the end for context).

---

## 1. Relationship map (the whole shape)

```mermaid
erDiagram
    Company ||--o| AccountingCompanyProfile : "IS-A (same ID)"
    Company ||--o{ GLAccount : ""
    Company ||--o{ AccountingPeriod : ""
    Company ||--o{ JournalEntry : ""
    Company ||--o{ JournalEntryBatch : ""
    Company ||--o{ ChartOfAccountsMapping : ""
    Company ||--o{ TaxLiability : ""
    Company ||--o{ AccountBalance : ""
    Company ||--o{ ScheduledJournalEntry : ""
    Company ||--o{ JournalEntrySequence : ""
    Company ||--o{ JournalEntryBatchSequence : ""

    Currency ||--o{ GLAccount : "denominates"
    Currency ||--o{ AccountingCompanyProfile : "functional/reporting"
    Currency ||--o{ JournalEntryLine : "original ccy"
    Currency ||--o{ CurrencySpotRate : "from/to"

    GLAccount ||--o{ GLAccount : "parent rollup"
    AccountingCompanyProfile ||--o{ AccountingCompanyProfile : "uses-books-of"
    AccountingCompanyProfile }o--o{ GLAccount : "5 default GL refs"

    AccountingPeriod ||--o{ JournalEntry : "posts-in"
    AccountingPeriod ||--o{ JournalEntryBatch : ""
    AccountingPeriod ||--o{ TaxLiability : ""
    AccountingPeriod ||--o{ AccountBalance : ""

    JournalEntry ||--o{ JournalEntryLine : "has"
    JournalEntry ||--o{ JournalEntryLink : "lineage"
    JournalEntry ||--o| JournalEntry : "reverses"
    JournalEntryBatch ||--o{ JournalEntry : "locks"
    JournalEntryBatch ||--o{ JournalEntryBatchLineItem : "summary lines"
    JournalEntryBatchLineItem ||--o{ JournalEntryBatchLineDimension : ""
    JournalEntryLine ||--o{ JournalEntryLineDimension : ""
    GLAccount ||--o{ JournalEntryLine : ""
    GLAccount ||--o{ JournalEntryBatchLineItem : ""

    Dimension ||--o{ DimensionValue : ""
    Dimension ||--o{ JournalEntryLineDimension : ""
    DimensionValue ||--o{ JournalEntryLineDimension : ""

    ScheduledJournalEntry ||--o{ ScheduledJournalEntryLineItem : ""
    ScheduledJournalEntryLineItem ||--o{ ScheduledJournalEntryLineDimension : ""
    ScheduledJournalEntry ||--o| JournalEntry : "materializes-into"

    TaxAuthority ||--o{ TaxJurisdiction : ""
    TaxJurisdiction ||--o{ TaxRate : ""
    TaxJurisdiction ||--o{ TaxLiability : ""
    TaxAuthority ||--o{ TaxLiability : ""
    TaxLiability ||--o{ TaxRemittance : ""
    TaxRemittance ||--o| JournalEntry : "posts"
    Organization ||--o{ CustomerTaxProfile : ""
    TaxJurisdiction ||--o{ CustomerTaxProfile : ""

    GLAccount ||--o{ ChartOfAccountsMapping : ""
    GLAccount ||--o{ AccountBalance : ""
    Entity ||--o{ JournalEntryLink : "polymorphic"
    File ||--o{ JournalEntry : "attachment"
    User ||--o{ JournalEntryBatch : "batched-by"
    AccountingCompanyProfile ||--o{ IntercompanyRelationship : "🟦 proposed (pair)"
    GLAccount ||--o{ IntercompanyRelationship : "🟦 Due-To/Due-From accts"
```

> Soft-refs (no lines above): `JournalEntry.{OrderID, OrderLineID, SubscriptionID, PaymentID, ContractID,
> RevRecScheduleID, IntercompanyFlowID}`, `JournalEntryLine.OrderLineID`, and the `ScheduledJournalEntry`
> origin IDs — all point at Orders/Contracts records and carry **no FK** by design.

---

## 2. Company · Chart of Accounts · Periods · COA mapping

```mermaid
erDiagram
    AccountingCompanyProfile {
        uuid ID PK "= __mj.Company.ID (IS-A Disjoint child)"
        string EntityType "LegalEntity|Subsidiary|Division|..."
        string LegalStructureType "LLC|C-Corp|... (nullable)"
        date IncorporationDate
        string JurisdictionCountry "ISO-3166 a2"
        string JurisdictionRegion
        string FederalTaxID
        string OperatingTimeZone "IANA tz; default UTC (W1)"
        string CompanyCode UK "uppercased, used in JE numbering"
        string FunctionalCurrencyCode FK "→ Currency.Code"
        string ReportingCurrencyCode FK "→ Currency.Code (nullable)"
        int FiscalYearStartMonth
        int FiscalYearStartDay
        uuid ParentAccountingCompanyID FK "→ self (no chains)"
        uuid DefaultPaymentTermsTypeID "soft-ref → Orders"
        uuid AROpenGLAccountID FK "→ GLAccount"
        uuid DeferredRevenueGLAccountID FK "→ GLAccount"
        uuid SalesTaxPayableGLAccountID FK "→ GLAccount"
        uuid RealizedFXGainLossGLAccountID FK "→ GLAccount"
        uuid UnrealizedFXGainLossGLAccountID FK "→ GLAccount"
        bool IsActive
    }
    GLAccount {
        uuid ID PK
        uuid CompanyID FK "→ __mj.Company"
        string Code "UQ per Company"
        string Name
        string AccountType "Asset|Liability|Equity|Revenue|Expense|Contra*|Statistical"
        uuid ParentGLAccountID FK "→ self"
        string CurrencyCode FK "→ Currency.Code (nullable)"
        string ExternalSystem
        string ExternalAccountID
        bool IsActive
        bool IsSystemSeeded "true for the W1-seeded starter chart"
        string Description
    }
    AccountingPeriod {
        uuid ID PK
        uuid CompanyID FK "→ __mj.Company"
        string PeriodType "Month|Quarter|Year"
        date PeriodStart
        date PeriodEnd
        int FiscalYear
        int FiscalQuarter "nullable"
        int FiscalMonth "nullable"
        string Status "Open|Closing|Closed|Reopened"
        datetime ClosedAt "required when Closed/Reopened"
        uuid ClosedByUserID FK "→ __mj.User"
        string ReopenReason
        datetime ReopenedAt
        uuid ReopenedByUserID FK "→ __mj.User"
    }
    ChartOfAccountsMapping {
        uuid ID PK
        uuid CompanyID FK "→ __mj.Company"
        string ExternalSystem
        string ExternalAccountID
        string ExternalAccountName
        uuid InternalGLAccountID FK "→ GLAccount"
        date EffectiveFrom
        date EffectiveTo
        uuid ApprovedByUserID FK "→ __mj.User (CFO approval)"
        datetime ApprovedAt
        string ChangeNote
    }
    AccountingCompanyProfile ||--o{ GLAccount : ""
    AccountingCompanyProfile ||--o{ AccountingPeriod : ""
    GLAccount ||--o{ GLAccount : "parent"
    GLAccount ||--o{ ChartOfAccountsMapping : ""
```

---

## 3. Journal Entries (the ledger core)

```mermaid
erDiagram
    JournalEntry {
        uuid ID PK
        string EntryNumber UK "JE-{CompanyCode}-{FY}-{seq} (W2)"
        uuid CompanyID FK "→ __mj.Company"
        uuid AccountingPeriodID FK "→ AccountingPeriod"
        date EffectiveDate
        string EntryType "OrderBooking|PaymentReceipt|RevenueRecognition|Reversal|Manual|..."
        string Status "Pending|Batched|GLPosted"
        string Description
        uuid OrderID "soft-ref"
        uuid OrderLineID "soft-ref"
        uuid SubscriptionID "soft-ref"
        uuid PaymentID "soft-ref"
        uuid ContractID "soft-ref"
        uuid RevRecScheduleID "soft-ref"
        uuid IntercompanyFlowID "soft-ref (groups intercompany legs)"
        uuid ScheduledJournalEntryID FK "→ ScheduledJournalEntry"
        uuid TaxRemittanceID FK "→ TaxRemittance"
        uuid ReversesJournalEntryID FK "→ self (W6)"
        uuid ReversedByJournalEntryID FK "→ self (W6)"
        uuid OriginalAccountingPeriodID FK "→ AccountingPeriod (W4 adjusting)"
        uuid BatchID FK "→ JournalEntryBatch (required once Batched)"
        datetime GLPostedAt
        string GLReferenceID "ERP ref back to us"
        uuid FileID FK "→ __mj.File (attachment, W9)"
    }
    JournalEntryLine {
        uuid ID PK
        uuid JournalEntryID FK "→ JournalEntry"
        int LineNumber "UQ per JE"
        uuid GLAccountID FK "→ GLAccount"
        decimal DebitAmount "exactly one of Debit/Credit > 0"
        decimal CreditAmount
        string OriginalCurrencyCode FK "→ Currency (when non-functional)"
        decimal OriginalDebitAmount
        decimal OriginalCreditAmount
        decimal ExchangeRateUsed
        string Description
        uuid OrderLineID "soft-ref"
        uuid CounterpartyOrganizationID FK "→ BizAppsCommon.Organization (e.g. customer)"
    }
    JournalEntryLineDimension {
        uuid ID PK
        uuid JournalEntryLineID FK "→ JournalEntryLine"
        uuid DimensionID FK "→ Dimension"
        uuid DimensionValueID FK "→ DimensionValue"
    }
    JournalEntryLink {
        uuid ID PK
        uuid JournalEntryID FK "→ JournalEntry"
        uuid EntityID FK "→ __mj.Entity (polymorphic)"
        string RecordID "target PK as string (composite-key safe)"
        string LinkType
        string Description
    }
    JournalEntrySequence {
        uuid CompanyID PK "→ __mj.Company"
        int FiscalYear PK
        int NextSequenceNumber "atomic counter (sproc)"
    }
    JournalEntry ||--o{ JournalEntryLine : "has"
    JournalEntryLine ||--o{ JournalEntryLineDimension : "tagged"
    JournalEntry ||--o{ JournalEntryLink : "lineage"
    JournalEntry ||--o| JournalEntry : "reverses / reversed-by"
```

---

## 4. Batching → ERP (the headline process)

```mermaid
erDiagram
    JournalEntryBatch {
        uuid ID PK
        string BatchNumber UK "BATCH-{CompanyCode}-{seq} (W3)"
        uuid CompanyID FK "→ __mj.Company"
        uuid AccountingPeriodID FK "→ AccountingPeriod"
        string TargetSystem "BusinessCentral|QuickBooks|NetSuite|..."
        datetime BatchedAt
        uuid BatchedByUserID FK "→ __mj.User"
        string Status "Pending|Sent|Acknowledged|Failed"
        int TotalEntries
        decimal TotalDebits
        decimal TotalCredits
        string ExternalBatchRef
        datetime SentAt
        datetime AcknowledgedAt
        string ErrorMessage
    }
    JournalEntryBatchLineItem {
        uuid ID PK
        uuid BatchID FK "→ JournalEntryBatch"
        uuid CompanyID FK "→ __mj.Company"
        uuid GLAccountID FK "→ GLAccount"
        int LineNumber "UQ per batch"
        decimal DebitAmount "netted; exactly one side > 0 (§C5)"
        decimal CreditAmount
        int SourceLineCount "# of JE lines rolled up"
        string ExternalAccountID "resolved via ChartOfAccountsMapping"
        string Description
    }
    JournalEntryBatchLineDimension {
        uuid ID PK
        uuid JournalEntryBatchLineItemID FK "→ JournalEntryBatchLineItem"
        uuid DimensionID FK "→ Dimension"
        uuid DimensionValueID FK "→ DimensionValue"
    }
    JournalEntryBatchSequence {
        uuid CompanyID PK "→ __mj.Company"
        int NextSequenceNumber "atomic counter (sproc)"
    }
    JournalEntryBatch ||--o{ JournalEntryBatchLineItem : "summary lines"
    JournalEntryBatchLineItem ||--o{ JournalEntryBatchLineDimension : "tagged"
```

> Per §C5: a batch's summary lines group by **Company × GLAccount × Dimension-combo** with Dr/Cr **netted**
> to one side. The detailed `JournalEntryLine` rows stay for drill-through.

---

## 5. Scheduled rev-rec waterfall (deferred revenue / amortization)

```mermaid
erDiagram
    ScheduledJournalEntry {
        uuid ID PK
        uuid CompanyID FK "→ __mj.Company"
        string EntryType "RevenueRecognition|DeferredRevenueRelease|PrepaidAmortization|..."
        string Status "Scheduled|Generated|Cancelled|Superseded"
        int ScheduleSequence "the '3' of '3 of 12'"
        int ScheduleCount "the '12' (1 = single-date deferral)"
        date ScheduledEffectiveDate
        uuid TargetAccountingPeriodID FK "→ AccountingPeriod (nullable)"
        string CurrencyCode FK "→ Currency"
        decimal TotalAmount
        string Description
        uuid SubscriptionID "soft-ref"
        uuid SubscriptionTermID "soft-ref"
        uuid OrderID "soft-ref"
        uuid OrderLineID "soft-ref"
        uuid ContractID "soft-ref"
        uuid RevRecScheduleID "soft-ref"
        uuid GeneratedJournalEntryID FK "→ JournalEntry (when materialized)"
        datetime GeneratedAt
        uuid SupersededByScheduledJournalEntryID FK "→ self (renewal/amendment)"
    }
    ScheduledJournalEntryLineItem {
        uuid ID PK
        uuid ScheduledJournalEntryID FK "→ ScheduledJournalEntry"
        int LineNumber
        uuid GLAccountID FK "→ GLAccount"
        decimal DebitAmount
        decimal CreditAmount
        string Description
    }
    ScheduledJournalEntryLineDimension {
        uuid ID PK
        uuid ScheduledJournalEntryLineItemID FK "→ ScheduledJournalEntryLineItem"
        uuid DimensionID FK "→ Dimension"
        uuid DimensionValueID FK "→ DimensionValue"
    }
    ScheduledJournalEntry ||--o{ ScheduledJournalEntryLineItem : "has"
    ScheduledJournalEntryLineItem ||--o{ ScheduledJournalEntryLineDimension : "tagged"
```

> The schedule is **computed upstream** (BizAppsOrders) and persisted here; the period-close materializer
> turns each due `Scheduled` row into a real Pending `JournalEntry` (Dr Deferred Revenue / Cr Revenue) and
> sets `GeneratedJournalEntryID` (AD-11). Block 4.

---

## 6. Dimensions · Currency · Tax · Balances

```mermaid
erDiagram
    Dimension {
        uuid ID PK
        string Code UK
        string Name
        string Description
        int DisplayOrder
        bool IsActive
    }
    DimensionValue {
        uuid ID PK
        uuid DimensionID FK "→ Dimension"
        string Code "UQ per Dimension"
        string Name
        uuid ParentDimensionValueID FK "→ self (hierarchy)"
        date EffectiveFrom
        date EffectiveTo
        bool IsActive
    }
    Currency {
        uuid ID PK
        string Code UK "ISO-4217, uppercased"
        string Name
        string Symbol
        int DecimalPlaces
        bool IsActive
    }
    CurrencySpotRate {
        uuid ID PK
        string FromCurrencyCode FK "→ Currency"
        string ToCurrencyCode FK "→ Currency"
        date RateDate
        decimal Rate
        string Source "ExchangeRate-API|ECB|OpenExchangeRates|Manual"
        bool IsActive
    }
    TaxAuthority {
        uuid ID PK
        string Code UK
        string Name
        string CountryCode
        bool IsActive
    }
    TaxJurisdiction {
        uuid ID PK
        uuid TaxAuthorityID FK "→ TaxAuthority"
        string Code UK
        string Name
        string CountryCode
        string RegionCode
        string PostalCode
        string CityName
        uuid ParentTaxJurisdictionID FK "→ self"
        bool IsActive
    }
    TaxRate {
        uuid ID PK
        uuid TaxJurisdictionID FK "→ TaxJurisdiction"
        string TaxCategory "Standard|Reduced|Zero|Exempt|Custom"
        decimal Rate "0..1"
        date EffectiveFrom
        date EffectiveTo
        string Source "Avalara|TaxJar|Manual"
    }
    TaxLiability {
        uuid ID PK
        uuid CompanyID FK "→ __mj.Company"
        uuid TaxAuthorityID FK "→ TaxAuthority"
        uuid TaxJurisdictionID FK "→ TaxJurisdiction"
        uuid AccountingPeriodID FK "→ AccountingPeriod"
        decimal AccruedAmount
        decimal RemittedAmount
        string Status "Open|Filed|Paid|PartiallyPaid"
        date DueDate
        string FilingFrequency
    }
    TaxRemittance {
        uuid ID PK
        uuid TaxLiabilityID FK "→ TaxLiability"
        decimal RemittedAmount
        date RemittedDate
        string PaymentReference
        uuid PostedJournalEntryID FK "→ JournalEntry"
    }
    CustomerTaxProfile {
        uuid ID PK
        uuid OrganizationID FK "→ BizAppsCommon.Organization"
        uuid TaxJurisdictionID FK "→ TaxJurisdiction"
        string TaxIDNumber
        bool IsExempt
        string ExemptionCertificateRef
        date ExemptionExpiryDate
        date EffectiveFrom
        date EffectiveTo
    }
    AccountBalance {
        uuid ID PK "⏸ DEFERRED (AD-12, unused in v1)"
        uuid CompanyID FK "→ __mj.Company"
        uuid GLAccountID FK "→ GLAccount"
        uuid AccountingPeriodID FK "→ AccountingPeriod"
        decimal PeriodEndBalance
        string CurrencyCode FK "→ Currency"
        datetime ComputedAt
    }
    AccountBalanceByDimension {
        uuid ID PK "⏸ DEFERRED (AD-12)"
        uuid CompanyID FK "→ __mj.Company"
        uuid GLAccountID FK "→ GLAccount"
        uuid AccountingPeriodID FK "→ AccountingPeriod"
        string DimensionValueTagsJson
        string DimensionTagsHash
        decimal PeriodEndBalance
        string CurrencyCode FK "→ Currency"
        datetime ComputedAt
    }
    Dimension ||--o{ DimensionValue : ""
    DimensionValue ||--o{ DimensionValue : "parent"
    TaxAuthority ||--o{ TaxJurisdiction : ""
    TaxJurisdiction ||--o{ TaxRate : ""
    TaxJurisdiction ||--o{ TaxLiability : ""
    TaxLiability ||--o{ TaxRemittance : ""
    Currency ||--o{ CurrencySpotRate : ""
```

---

## 7. Proposed (not yet migrated) — Intercompany relationship (OQ-A)

Per Amith's OQ-A answer — **under review now** (added for Marcelo to confirm it "fits"). The schema is
**finalized for review, NOT yet migrated**; the intercompany *engine* stays deferred (§C1: balancing-leg
generation lives upstream in Orders/Payments).

```mermaid
erDiagram
    IntercompanyRelationship {
        uuid ID PK "🟦 PROPOSED — not migrated"
        uuid CompanyAID FK "→ AccountingCompanyProfile (canonical-ordered pair)"
        uuid CompanyBID FK "→ AccountingCompanyProfile"
        uuid ADueToBGLAccountID FK "→ GLAccount (A's Liability)"
        uuid ADueFromBGLAccountID FK "→ GLAccount (A's Asset)"
        uuid BDueToAGLAccountID FK "→ GLAccount (B's Liability)"
        uuid BDueFromAGLAccountID FK "→ GLAccount (B's Asset)"
        bool IsActive
    }
```

---

### Consistency review (for Marcelo — does it fit?)
- **One row per unordered pair** (Amith: "a single row… track all 4 accounts"). `CompanyAID`/`CompanyBID` FK
  to `AccountingCompanyProfile(ID)` (= the company id; ensures both ends are accounting-enabled). Enforce a
  **canonical order** (e.g. by `CompanyCode`) so `(B,A)` can't duplicate `(A,B)`: `UQ(CompanyAID,CompanyBID)`
  + `CK(CompanyAID <> CompanyBID)` + a trigger for the ordering.
- **4 GL accounts, 2 per side** — A's *Due-To-B* (Liability) / *Due-From-B* (Asset); B's mirror. Each must
  live in its owner's COA (`GLAccount.CompanyID = CompanyAID` / `= CompanyBID`) with the right `AccountType` —
  FKs can't enforce that, so a **trigger** does (joins the §11.1 invariant matrix), consistent with how the
  rest of the system enforces invariants at the DB level.
- **Provisioning (eager):** when an ACP is added, a hook creates the relationship row + the 4 GL accounts
  against every existing ACP. The **account-code scheme** (e.g. `11211-<counterpartyCode>` /
  `21501-<counterpartyCode>`) is the main open naming decision.
- **Naming for review:** table `IntercompanyRelationship` (entity `MJ_BizApps_Accounting: Intercompany
  Relationships`) — Amith's alternative was `AccountingCompanyProfileIntercompanyRelationship`. The column
  names (`CompanyAID`, `ADueToBGLAccountID`, …) are placeholders — rename freely.
- **Ties to the rest:** the 4 accounts are ordinary `GLAccount` rows (per-company COA, `IsSystemSeeded`); the
  pair is two `AccountingCompanyProfile`s; a multi-company transaction's legs are grouped by
  `JournalEntry.IntercompanyFlowID` (soft-ref). Per **§C1** this table holds **only the account wiring** — the
  balancing legs themselves are generated **upstream** (Orders/Payments), not by Accounting.

## Domain index (28 entities)
- **Company/COA/Periods (§2):** AccountingCompanyProfile, GLAccount, AccountingPeriod, ChartOfAccountsMapping
- **Journal entries (§3):** JournalEntry, JournalEntryLine, JournalEntryLineDimension, JournalEntryLink, JournalEntrySequence
- **Batching (§4):** JournalEntryBatch, JournalEntryBatchLineItem, JournalEntryBatchLineDimension, JournalEntryBatchSequence
- **Scheduled rev-rec (§5):** ScheduledJournalEntry, ScheduledJournalEntryLineItem, ScheduledJournalEntryLineDimension
- **Dimensions/Currency/Tax/Balances (§6):** Dimension, DimensionValue, Currency, CurrencySpotRate, TaxAuthority, TaxJurisdiction, TaxRate, TaxLiability, TaxRemittance, CustomerTaxProfile, AccountBalance ⏸, AccountBalanceByDimension ⏸
