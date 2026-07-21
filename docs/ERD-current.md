# BizApps Accounting — ERD (CURRENT, as-built)

**Date:** 2026-07-20
**Basis:** AS-BUILT from migrations @ `V202607171000__v1.0.x__Batch_Memo.sql` (baseline `B202605281200__v1.0.x__Schema_and_Tables.sql` + `V202607161700__v1.0.x__Batch_ApprovalTask_Pointer.sql` + `V202607171000__v1.0.x__Batch_Memo.sql`; `V202607060828` is metadata-only). The plan-chain view is **ERD-planned.md**.

**Conventions:**
- All app tables live in schema **`__mj_BizAppsAccounting`**; names below omit the prefix. Cross-schema pseudo-entities are labeled (`__mj.Company`, `__mj.User`, `__mj.File`, `__mj.Entity`, `__mj_BizAppsCommon.Organization`).
- Every table also carries CodeGen-owned **`__mj_CreatedAt` / `__mj_UpdatedAt`** columns — omitted from every diagram.
- Types simplified: `uniqueidentifier`→UUID, `nvarchar`/`char`→string, `decimal`→decimal, `datetimeoffset`→datetime, `bit`→bool, `date`→date, `int`/`tinyint`→int.
- Dotted relationship lines (`..`) = **soft references (no FK constraint)** — polymorphic or cross-app keys.

**Table count: 28.**

---

## §1 Overview — all entities and relationships

```mermaid
erDiagram
    %% ===== IsA + chart of accounts =====
    Company ||--|| AccountingCompanyProfile : "IsA disjoint child (same UUID)"
    AccountingCompanyProfile |o--o{ AccountingCompanyProfile : "parent (no chains)"
    Currency ||--o{ AccountingCompanyProfile : "functional and reporting"
    GLAccount |o--o{ AccountingCompanyProfile : "5 default-account FKs"
    Company ||--o{ GLAccount : "owns CoA"
    GLAccount |o--o{ GLAccount : parent
    Currency |o--o{ GLAccount : denominates
    GLAccountRole ||--o{ GLAccountLink : role
    GLAccount ||--o{ GLAccountLink : "maps to"
    Entity ||--o{ GLAccountLink : "EntityID (polymorphic)"
    GLAccountLink ||--o{ GLAccountLinkDimension : "dimensions to apply"
    Dimension ||--o{ GLAccountLinkDimension : dimension
    %% GLAccountLink target = EntityID + RecordID; soft polymorphic targets:
    Product ||..o{ GLAccountLink : "soft RecordID target"
    ProductCategory ||..o{ GLAccountLink : "soft RecordID target"
    Company ||..o{ GLAccountLink : "soft RecordID target"
    Company ||--o{ ChartOfAccountsMapping : company
    GLAccount ||--o{ ChartOfAccountsMapping : internal
    User |o--o{ ChartOfAccountsMapping : "approved by"

    %% ===== Journal entries =====
    Company ||--o{ JournalEntry : "single-company (MOD-12)"
    JournalEntryBatch |o--o{ JournalEntry : "BatchID when batched"
    JournalEntry |o--o| JournalEntry : "reverses / reversed-by"
    ScheduledJournalEntry |o--o{ JournalEntry : "materialized from"
    TaxRemittance |o--o{ JournalEntry : "remittance origin"
    File |o--o{ JournalEntry : "attached source doc"
    JournalEntry ||--o{ JournalEntryLine : lines
    GLAccount ||--o{ JournalEntryLine : account
    Currency |o--o{ JournalEntryLine : "original currency"
    Organization |o--o{ JournalEntryLine : counterparty
    JournalEntryLine ||--o{ JournalEntryLineDimension : tags
    Dimension ||--o{ JournalEntryLineDimension : dimension
    DimensionValue ||--o{ JournalEntryLineDimension : value
    Dimension ||--o{ DimensionValue : values
    DimensionValue |o--o{ DimensionValue : parent
    JournalEntry ||--o{ JournalEntryLink : "lineage links"
    Entity ||--o{ JournalEntryLink : "EntityID (polymorphic)"
    AnyEntityRecord ||..o{ JournalEntryLink : "soft RecordID target"
    Company ||--o{ JournalEntrySequence : "per-company per-FY"
    %% Orders-side soft origin keys on JournalEntry (no FK, by design):
    Order ||..o{ JournalEntry : "soft OrderID"
    OrderLine ||..o{ JournalEntry : "soft OrderLineID"
    OrderLine ||..o{ JournalEntryLine : "soft OrderLineID"
    Subscription ||..o{ JournalEntry : "soft SubscriptionID"
    Payment ||..o{ JournalEntry : "soft PaymentID"
    Contract ||..o{ JournalEntry : "soft ContractID"
    RevRecSchedule ||..o{ JournalEntry : "soft RevRecScheduleID"
    IntercompanyFlow ||..o{ JournalEntry : "soft IntercompanyFlowID"

    %% ===== Batching =====
    User ||--o{ JournalEntryBatch : "batched by"
    User |o--o{ JournalEntryBatch : "approved by"
    Task ||..o{ JournalEntryBatch : "soft ApprovalTaskID (bizapps-tasks)"
    JournalEntryBatch ||--o{ JournalEntryBatchLineItem : "summary lines"
    Company ||--o{ JournalEntryBatchLineItem : "per-line company (AM-4)"
    GLAccount ||--o{ JournalEntryBatchLineItem : account
    JournalEntryBatchLineItem ||--o{ JournalEntryBatchLineDimension : tags
    Dimension ||--o{ JournalEntryBatchLineDimension : dimension
    DimensionValue ||--o{ JournalEntryBatchLineDimension : value
    JournalEntryBatchSequence {
    }

    %% ===== Scheduled JEs =====
    Company ||--o{ ScheduledJournalEntry : company
    Currency ||--o{ ScheduledJournalEntry : currency
    ScheduledJournalEntry |o--o{ ScheduledJournalEntry : "superseded by"
    ScheduledJournalEntry ||--o{ ScheduledJournalEntryLineItem : lines
    GLAccount ||--o{ ScheduledJournalEntryLineItem : account
    ScheduledJournalEntryLineItem ||--o{ ScheduledJournalEntryLineDimension : tags
    Dimension ||--o{ ScheduledJournalEntryLineDimension : dimension
    DimensionValue ||--o{ ScheduledJournalEntryLineDimension : value
    Subscription ||..o{ ScheduledJournalEntry : "soft origin"
    Order ||..o{ ScheduledJournalEntry : "soft origin"
    Contract ||..o{ ScheduledJournalEntry : "soft origin"

    %% ===== Tax =====
    TaxAuthority ||--o{ TaxJurisdiction : jurisdictions
    TaxJurisdiction |o--o{ TaxJurisdiction : parent
    TaxJurisdiction ||--o{ TaxRate : rates
    Company ||--o{ TaxLiability : company
    TaxAuthority ||--o{ TaxLiability : authority
    TaxJurisdiction ||--o{ TaxLiability : jurisdiction
    TaxLiability ||--o{ TaxRemittance : payments
    Organization ||--o{ CustomerTaxProfile : customer
    TaxJurisdiction |o--o{ CustomerTaxProfile : jurisdiction

    %% ===== Currency =====
    Currency ||--o{ CurrencySpotRate : "from / to"
```

Pseudo-entities (not in this schema): `Company`/`User`/`File`/`Entity` = `__mj` core; `Organization` = `__mj_BizAppsCommon`; `Order`/`OrderLine`/`Subscription`/`Payment`/`Contract`/`RevRecSchedule`/`IntercompanyFlow` = downstream apps (soft UUIDs, no FKs); `Task` = bizapps-tasks; `Product`/`ProductCategory`/`AnyEntityRecord` = polymorphic `EntityID + RecordID` targets.

---

## §2 Chart of accounts & mapping

```mermaid
erDiagram
    AccountingCompanyProfile {
        UUID ID PK, FK "same UUID as __mj.Company (IsA disjoint)"
        string EntityType "CHECK: LegalEntity,Subsidiary,Division,Department,Branch,Partner,JointVenture,CostCenter,Other; default Subsidiary"
        string LegalStructureType "NULL; CHECK: LLC,C-Corp,S-Corp,Partnership,SoleProprietorship,NonProfit-501c3,NonProfit-501c6,International-*,Other"
        date IncorporationDate "NULL"
        string JurisdictionCountry "NULL, char(2)"
        string JurisdictionRegion "NULL"
        string FederalTaxID "NULL"
        string OperatingTimeZone "NULL (display only; storage is UTC)"
        string CompanyCode UK "CHECK: uppercase A-Z0-9_-, len 2-20"
        string FunctionalCurrencyCode FK "Currency.Code"
        string ReportingCurrencyCode FK "NULL, Currency.Code"
        int FiscalYearStartMonth "CHECK 1-12, default 1"
        int FiscalYearStartDay "CHECK 1-31, default 1"
        UUID ParentAccountingCompanyID FK "NULL, self; CHECK no self-parent; trigger: no chains (50010)"
        UUID DefaultPaymentTermsTypeID "NULL, soft ref"
        UUID AROpenGLAccountID FK "NULL, GLAccount"
        UUID DeferredRevenueGLAccountID FK "NULL, GLAccount"
        UUID SalesTaxPayableGLAccountID FK "NULL, GLAccount"
        UUID RealizedFXGainLossGLAccountID FK "NULL, GLAccount"
        UUID UnrealizedFXGainLossGLAccountID FK "NULL, GLAccount"
        bool IsActive "default 1"
    }
    GLAccount {
        UUID ID PK
        UUID CompanyID FK "__mj.Company"
        string Code UK "unique per (CompanyID, Code)"
        string Name
        string AccountType "CHECK: Asset,Liability,Equity,Revenue,Expense"
        UUID ParentGLAccountID FK "NULL, self; CHECK no self-parent"
        string CurrencyCode FK "NULL, Currency.Code"
        string ExternalSystem "NULL"
        string ExternalAccountID "NULL"
        bool IsActive "default 1"
        bool IsSystemSeeded "default 0"
        string Description "NULL"
    }
    GLAccountRole {
        UUID ID PK
        string Name UK
        string Description "NULL"
        string Status "CHECK: Active,Inactive; default Active"
        int Sequence "default 0"
    }
    GLAccountLink {
        UUID ID PK
        UUID GLAccountID FK
        UUID GLAccountRoleID FK
        UUID EntityID FK "__mj.Entity (polymorphic target type)"
        string RecordID "nvarchar(400); target PK, soft"
        string Status "CHECK: Pending,Active,Disabled; default Pending"
        datetime StartedAt "NULL; CHECK EndedAt > StartedAt"
        datetime EndedAt "NULL"
        string Comments "NULL"
    }
    GLAccountLinkDimension {
        UUID ID PK
        UUID GLAccountLinkID FK, UK "unique with DimensionID"
        UUID DimensionID FK, UK
        int Sequence "default 0"
    }
    ChartOfAccountsMapping {
        UUID ID PK
        UUID CompanyID FK, UK "__mj.Company; unique with ExternalSystem+ExternalAccountID+EffectiveFrom"
        string ExternalSystem UK
        string ExternalAccountID UK
        string ExternalAccountName "NULL"
        UUID InternalGLAccountID FK "GLAccount"
        date EffectiveFrom UK
        date EffectiveTo "NULL; CHECK >= EffectiveFrom"
        UUID ApprovedByUserID FK "NULL, __mj.User; CHECK paired with ApprovedAt"
        datetime ApprovedAt "NULL"
        string ChangeNote "NULL"
    }
    GLAccount ||--o{ GLAccountLink : "maps to"
    GLAccountRole ||--o{ GLAccountLink : role
    GLAccountLink ||--o{ GLAccountLinkDimension : dims
    GLAccount ||--o{ ChartOfAccountsMapping : internal
    GLAccount |o--o{ AccountingCompanyProfile : defaults
    GLAccount |o--o{ GLAccount : parent
```

`AccountingCompanyProfile` is an IsA Disjoint child of `__mj.Company` (same UUID; `FK_ACP_Company` on ID) — never insert a profile without its Company row. `GLAccountLink` (AM-5) is the polymorphic role-based account resolver replacing the per-target GL-account trio; resolution filters `Status='Active'` + date window. `trg_ACP_NoChains` (50010) forbids parent chains.

---

## §3 Journal entries

```mermaid
erDiagram
    JournalEntry {
        UUID ID PK
        string EntryNumber UK "JE-{CompanyCode}-{FY}-{seq}"
        UUID CompanyID FK "__mj.Company; single-company per MOD-12"
        date EffectiveDate
        string EntryType "CHECK: OrderBooking,PaymentReceipt,RevenueRecognition,CommissionAccrual,PartnerRevShare,IntercompanyFlow,WaterfallDistribution,Refund,Writeoff,Reversal,Manual,TaxRemittance,PeriodEndAccrual,FXRevaluation,OpeningBalance,Adjustment"
        string Status "CHECK: Pending,Batched,GLPosted; default Pending"
        string Description "NULL"
        UUID OrderID "NULL, soft ref (orders)"
        UUID OrderLineID "NULL, soft ref (orders)"
        UUID SubscriptionID "NULL, soft ref (orders)"
        UUID PaymentID "NULL, soft ref (orders)"
        UUID ContractID "NULL, soft ref (contracts)"
        UUID RevRecScheduleID "NULL, soft ref (orders)"
        UUID IntercompanyFlowID "NULL, soft ref (orders)"
        UUID ScheduledJournalEntryID FK "NULL, ScheduledJournalEntry"
        UUID TaxRemittanceID FK "NULL, TaxRemittance"
        UUID ReversesJournalEntryID FK "NULL, self; requires EntryType=Reversal (50012)"
        UUID ReversedByJournalEntryID FK "NULL, self"
        UUID BatchID FK "NULL, JournalEntryBatch; CHECK required when Status<>Pending"
        datetime GLPostedAt "NULL; CHECK required when GLPosted"
        string GLReferenceID "NULL"
        UUID FileID FK "NULL, __mj.File"
    }
    JournalEntryLine {
        UUID ID PK
        UUID JournalEntryID FK, UK "unique with LineNumber"
        int LineNumber UK "CHECK > 0"
        UUID GLAccountID FK
        decimal DebitAmount "NULL; CHECK exactly one side, > 0"
        decimal CreditAmount "NULL"
        string OriginalCurrencyCode FK "NULL, Currency.Code; required when Original* present"
        decimal OriginalDebitAmount "NULL; CHECK side matches functional side"
        decimal OriginalCreditAmount "NULL"
        decimal ExchangeRateUsed "NULL; required when Original* present"
        string Description "NULL"
        UUID OrderLineID "NULL, soft ref (orders)"
        UUID CounterpartyOrganizationID FK "NULL, __mj_BizAppsCommon.Organization"
    }
    JournalEntryLineDimension {
        UUID ID PK
        UUID JournalEntryLineID FK, UK "unique with DimensionID"
        UUID DimensionID FK, UK
        UUID DimensionValueID FK
    }
    Dimension {
        UUID ID PK
        string Code UK
        string Name
        string Description "NULL"
        int DisplayOrder "default 100"
        bool IsActive "default 1"
    }
    DimensionValue {
        UUID ID PK
        UUID DimensionID FK, UK "unique with Code"
        string Code UK
        string Name
        UUID ParentDimensionValueID FK "NULL, self"
        date EffectiveFrom "NULL; CHECK EffectiveTo >= EffectiveFrom"
        date EffectiveTo "NULL"
        bool IsActive "default 1"
    }
    JournalEntryLink {
        UUID ID PK
        UUID JournalEntryID FK, UK "unique with EntityID+RecordID"
        UUID EntityID FK, UK "__mj.Entity"
        string RecordID UK "nvarchar(400), soft polymorphic target PK"
        string LinkType "NULL"
        string Description "NULL"
    }
    JournalEntrySequence {
        UUID CompanyID PK, FK "__mj.Company; composite PK"
        int FiscalYear PK
        int NextSequenceNumber "CHECK > 0; default 1"
    }
    JournalEntry ||--o{ JournalEntryLine : lines
    JournalEntryLine ||--o{ JournalEntryLineDimension : tags
    Dimension ||--o{ DimensionValue : values
    Dimension ||--o{ JournalEntryLineDimension : dim
    DimensionValue ||--o{ JournalEntryLineDimension : value
    JournalEntry ||--o{ JournalEntryLink : links
    JournalEntry |o--o| JournalEntry : reverses
```

Invariants (DB triggers): **balanced-JE on lock** — Sum(Dr)=Sum(Cr) required to enter Batched/GLPosted (50001), per-company balance (50019), and **single-company 50025** (every line's `GLAccount.CompanyID` must equal the entry's `CompanyID`, MOD-12). **Immutability**: locked JEs (Batched/GLPosted) allow only `GLPostedAt`/`GLReferenceID`/`ReversedByJournalEntryID`/`Status` forward-moves + the reversible Batched→Pending unlock of an unapproved batch (50003-50006); no status regression (50005). No period machinery — JEs carry dates only (MOD-1).

---

## §4 Batching

```mermaid
erDiagram
    JournalEntryBatch {
        UUID ID PK
        string BatchNumber UK
        string TargetSystem "CHECK: BusinessCentral,QuickBooks,NetSuite,Sage,Xero,Other"
        datetime BatchedAt "default now"
        UUID BatchedByUserID FK "__mj.User"
        string Status "CHECK: Pending,Approved,Sent,Posted,Failed,Cancelled; default Pending"
        int TotalEntries "control totals; CHECK >= 0"
        decimal TotalDebits "CHECK >= 0"
        decimal TotalCredits "CHECK >= 0"
        string ExternalBatchRef "NULL"
        datetime ApprovedAt "NULL"
        UUID ApprovedByUserID FK "NULL, __mj.User"
        datetime SentAt "NULL"
        datetime PostedAt "NULL"
        string ErrorMessage "NULL"
        UUID ApprovalTaskID "NULL, soft ref to bizapps-tasks Task (V202607161700); CHECK paired with ApprovalTaskRaisedAt"
        datetime ApprovalTaskRaisedAt "NULL"
        string Memo "NULL, nvarchar(500) (V202607171000)"
    }
    JournalEntryBatchLineItem {
        UUID ID PK
        UUID BatchID FK, UK "unique with LineNumber"
        UUID CompanyID FK "__mj.Company (multi-company batch, AM-4)"
        UUID GLAccountID FK
        int LineNumber UK "CHECK > 0"
        decimal DebitAmount "NULL; CHECK exactly one side, > 0"
        decimal CreditAmount "NULL"
        int SourceLineCount "JE lines rolled up; CHECK >= 0"
        string ExternalAccountID "NULL, resolved via ChartOfAccountsMapping at batch time"
        string Description "NULL"
    }
    JournalEntryBatchLineDimension {
        UUID ID PK
        UUID JournalEntryBatchLineItemID FK, UK "unique with DimensionID"
        UUID DimensionID FK, UK
        UUID DimensionValueID FK
    }
    JournalEntryBatchSequence {
        int ID PK "CHECK ID = 1 (global singleton)"
        int NextSequenceNumber "CHECK > 0; default 1"
    }
    JournalEntryBatch ||--o{ JournalEntryBatchLineItem : "summary lines"
    JournalEntryBatchLineItem ||--o{ JournalEntryBatchLineDimension : tags
```

Batches are **multi-company** as built (no header CompanyID; per-company grouping on line items, AM-4/CH-4 — superseded in the plan chain, see ERD-planned). Control totals are header columns, not a table; `trg_JEBatch_SummaryReconciles` requires summary lines to foot to totals and balance overall (50014) and per company (50023) before Sent. Batch + line items + line dimensions are immutable once Approved/Sent/Posted (50008/50009/50013/50015); summary lines net JE detail by (GLAccount × dimension combo × side) per BA-D16/BA-D26.

---

## §5 Scheduled journal entries (as built)

```mermaid
erDiagram
    ScheduledJournalEntry {
        UUID ID PK
        UUID CompanyID FK "__mj.Company"
        string EntryType "CHECK: RevenueRecognition,DeferredRevenueRelease,PrepaidAmortization,DepreciationAccrual,PeriodEndAccrual,Manual"
        string Status "CHECK: Scheduled,Generated,Cancelled,Superseded"
        int ScheduleSequence "CHECK > 0 and <= ScheduleCount"
        int ScheduleCount
        date ScheduledEffectiveDate
        string CurrencyCode FK "Currency.Code"
        decimal TotalAmount "CHECK >= 0"
        string Description "NULL"
        UUID SubscriptionID "NULL, soft ref"
        UUID SubscriptionTermID "NULL, soft ref"
        UUID OrderID "NULL, soft ref"
        UUID OrderLineID "NULL, soft ref"
        UUID ContractID "NULL, soft ref"
        UUID RevRecScheduleID "NULL, soft ref"
        UUID GeneratedJournalEntryID FK "NULL, JournalEntry; CHECK coherent with Status=Generated"
        datetime GeneratedAt "NULL"
        UUID SupersededByScheduledJournalEntryID FK "NULL, self; required when Superseded"
    }
    ScheduledJournalEntryLineItem {
        UUID ID PK
        UUID ScheduledJournalEntryID FK, UK "unique with LineNumber"
        int LineNumber UK "CHECK > 0"
        UUID GLAccountID FK
        decimal DebitAmount "NULL; CHECK exactly one side, > 0"
        decimal CreditAmount "NULL"
        string Description "NULL"
    }
    ScheduledJournalEntryLineDimension {
        UUID ID PK
        UUID ScheduledJournalEntryLineItemID FK, UK "unique with DimensionID"
        UUID DimensionID FK, UK
        UUID DimensionValueID FK
    }
    ScheduledJournalEntry ||--o{ ScheduledJournalEntryLineItem : lines
    ScheduledJournalEntryLineItem ||--o{ ScheduledJournalEntryLineDimension : tags
    ScheduledJournalEntry |o--o{ ScheduledJournalEntry : "superseded by"
```

Pre-computed future JEs for rev-rec/amortization waterfalls (BA-D25); schedule computed upstream (orders), stored here; locked once Generated (50016/50017). **The plan chain retires this trio (MOD-17)** — see ERD-planned.md.

---

## §6 Tax

```mermaid
erDiagram
    TaxAuthority {
        UUID ID PK
        string Code UK
        string Name
        string CountryCode "NULL, char(2)"
        bool IsActive "default 1"
    }
    TaxJurisdiction {
        UUID ID PK
        UUID TaxAuthorityID FK
        string Code UK
        string Name
        string CountryCode "NULL, char(2)"
        string RegionCode "NULL"
        string PostalCode "NULL"
        string PostalCodeStart "NULL"
        string PostalCodeEnd "NULL"
        string CityName "NULL"
        UUID ParentTaxJurisdictionID FK "NULL, self"
        bool IsActive "default 1"
    }
    TaxRate {
        UUID ID PK
        UUID TaxJurisdictionID FK
        string TaxCategory "CHECK: Standard,Reduced,Zero,Exempt,Custom"
        decimal Rate "CHECK 0-1"
        date EffectiveFrom
        date EffectiveTo "NULL; CHECK >= EffectiveFrom"
        string Source "CHECK: Avalara,TaxJar,Manual; default Manual"
    }
    TaxLiability {
        UUID ID PK
        UUID CompanyID FK "__mj.Company"
        UUID TaxAuthorityID FK
        UUID TaxJurisdictionID FK
        decimal AccruedAmount "CHECK >= 0; default 0"
        decimal RemittedAmount "CHECK >= 0; default 0"
        string Status "CHECK: Open,Filed,Paid,PartiallyPaid; default Open"
        date DueDate "NULL"
        string FilingFrequency "NULL; CHECK: Monthly,Quarterly,SemiAnnual,Annual,OnDemand"
    }
    TaxRemittance {
        UUID ID PK
        UUID TaxLiabilityID FK
        decimal RemittedAmount "CHECK > 0"
        date RemittedDate
        string PaymentReference "NULL"
        UUID PostedJournalEntryID FK "NULL, JournalEntry"
    }
    CustomerTaxProfile {
        UUID ID PK
        UUID OrganizationID FK "__mj_BizAppsCommon.Organization"
        UUID TaxJurisdictionID FK "NULL"
        string TaxIDNumber "NULL"
        bool IsExempt "default 0; CHECK exempt requires certificate ref"
        string ExemptionCertificateRef "NULL"
        date ExemptionExpiryDate "NULL"
        date EffectiveFrom
        date EffectiveTo "NULL; CHECK >= EffectiveFrom"
    }
    TaxAuthority ||--o{ TaxJurisdiction : jurisdictions
    TaxJurisdiction ||--o{ TaxRate : rates
    TaxAuthority ||--o{ TaxLiability : authority
    TaxJurisdiction ||--o{ TaxLiability : jurisdiction
    TaxLiability ||--o{ TaxRemittance : payments
    TaxJurisdiction |o--o{ CustomerTaxProfile : jurisdiction
```

No period FK anywhere (`AccountingPeriodID` was removed 2026-07-06 — the ERP owns periods). A `TaxRemittance` can produce a JE (`PostedJournalEntryID`, and `JournalEntry.TaxRemittanceID` points back).

---

## §7 Currency

```mermaid
erDiagram
    Currency {
        UUID ID PK
        string Code UK "char(3) ISO-4217; CHECK uppercase"
        string Name
        string Symbol "NULL"
        int DecimalPlaces "tinyint; default 2"
        bool IsActive "default 1"
    }
    CurrencySpotRate {
        UUID ID PK
        string FromCurrencyCode FK, UK "Currency.Code; unique with To+RateDate+Source"
        string ToCurrencyCode FK, UK
        date RateDate UK
        decimal Rate "CHECK > 0"
        string Source UK "default Manual (ExchangeRate-API, ECB, OpenExchangeRates, Manual)"
        bool IsActive "default 1"
    }
    Currency ||--o{ CurrencySpotRate : "from / to"
```

Currency is owned by this schema (referenced by code, not ID); seed rows come from metadata sync, not the migration. Spot-only by design — forward/average rates are out of scope. (Note: the table is `CurrencySpotRate`; there is no `CurrencyExchangeRate` table.)

---

## §8 Interfaces with other apps (soft keys & cross-schema touchpoints)

- **`__mj.Company`** — hard FKs from AccountingCompanyProfile (IsA, same UUID), GLAccount, JournalEntry, JournalEntryBatchLineItem, ChartOfAccountsMapping, TaxLiability, JournalEntrySequence, ScheduledJournalEntry.
- **`__mj.User`** — hard FKs for actor stamps: JournalEntryBatch.BatchedBy/ApprovedBy, ChartOfAccountsMapping.ApprovedBy.
- **`__mj.File`** — JournalEntry.FileID (attached source document).
- **`__mj.Entity`** — hard FK on the polymorphic pattern's EntityID (JournalEntryLink, GLAccountLink); the paired `RecordID` (nvarchar 400) is soft.
- **`__mj_BizAppsCommon.Organization`** — hard FKs: JournalEntryLine.CounterpartyOrganizationID, CustomerTaxProfile.OrganizationID.
- **Orders/contracts soft origin keys (no FK by design)** — JournalEntry.{OrderID, OrderLineID, SubscriptionID, PaymentID, ContractID, RevRecScheduleID, IntercompanyFlowID}, JournalEntryLine.OrderLineID, ScheduledJournalEntry.{SubscriptionID, SubscriptionTermID, OrderID, OrderLineID, ContractID, RevRecScheduleID}: downstream apps populate the UUIDs; accounting stores them for drill-through only.
- **bizapps-tasks** — JournalEntryBatch.ApprovalTaskID is a deliberate soft pointer (cross-OpenApp FK would couple DDL).
- **AccountingCompanyProfile.DefaultPaymentTermsTypeID** — soft ref (no FK in the baseline DDL).
