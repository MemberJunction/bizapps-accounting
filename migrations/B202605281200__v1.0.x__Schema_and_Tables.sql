-- =============================================================================
-- BizApps Accounting — Baseline Schema (v0.1.0)
-- =============================================================================
-- Creates the entire __mj_BizAppsAccounting schema in a single baseline:
--   - 22 tables (chart of accounts + roles/links, JEs + lines + dimensions +
--     links, single-company batches w/ summary-JE model, currency, tax,
--     JE/Batch numbering sequences)
--   - Foreign keys (cross-schema to __mj.Company, __mj.User, __mj.Entity, and
--     __mj_BizAppsAccounting.Currency / __mj_BizAppsCommon.Organization)
--   - CHECK constraints (one-side-per-line, status enums, original-currency
--     coherence, CompanyCode format, summary-JE-never-a-member)
--   - Business-rule triggers (balanced JE on lock, levels-of-locking
--     immutability, single-company enforcement, batch immutability,
--     AccountingCompanyProfile chain guard, reversal consistency)
--   - Stored procs for gap-free per-company JE / global batch numbering
--   - MS_Description extended properties for the schema, every table, and
--     every column
--
-- References: plans/bizapps-accounting-master.md §4 (entities), §5 (DB-level
-- enforcement), BA-D5..BA-D13 (decisions). SQL Server is the source of truth;
-- the PostgreSQL counterpart is produced via @memberjunction/sql-converter
-- (see migrations-pg/README.md).
-- =============================================================================

-- =============================================================================
-- REVISION 2026-07-06 (engine-meeting rulings AM-1..7 + 07-02 transcript):
--   * REMOVED: AccountingPeriod, AccountBalance, AccountBalanceByDimension
--     (+ every period FK/trigger; the ERP owns periods + balances).
--   * JournalEntry + JournalEntryBatch are MULTI-COMPANY: no header CompanyID;
--     company is per line via GLAccount.CompanyID / BatchLineItem.CompanyID.
--   * Batch statuses: Pending|Approved|Sent|Posted|Failed|Cancelled.
--   * GLAccount.AccountType: 5-value enum (Asset/Liability/Equity/Revenue/Expense).
--   * NEW: GLAccountRole + polymorphic GLAccountLink + GLAccountLinkDimension.
--   * JE/batch numbering sequences are GLOBAL (D-SEQ derived decision).
--   See plans/accounting-engine-plan.md (+ erd-accounting-target.md).
-- =============================================================================

-- =============================================================================
-- REVISION 2026-07-22 (rewritten to plans/bizapps-accounting-master.md — the
-- consolidated single-source-of-truth plan; edit-the-baseline practice):
--   * JournalEntry is SINGLE-COMPANY again (D3): header CompanyID NOT NULL,
--     line-company-match trigger, PER-COMPANY per-FY numbering
--     'JE-{CompanyCode}-{FY}-{seq}' (D19).
--   * JournalEntryBatch is SINGLE-COMPANY (D7) with an accountant-set
--     PostingDate (D8); the aggregated summary is ONE JournalEntry
--     (EntryType='BatchSummary') referenced via SummaryJournalEntryID —
--     JournalEntryBatchLineItem + JournalEntryBatchLineDimension REMOVED
--     (Amith's simplified summary model, D9). Approval-task pointer columns
--     (ApprovalTaskID + ApprovalTaskRaisedAt, both-or-neither) added (D10).
--   * ScheduledJournalEntry trio + JournalEntry.ScheduledJournalEntryID +
--     RevRecScheduleID REMOVED (D15: rev-rec = REAL forward-dated JEs at
--     booking; no schedule tables, no materializer).
--   * ChartOfAccountsMapping REMOVED (D13: ERP identity lives on GLAccount).
--   * AccountingCompanyProfile default-GL-account FK columns REMOVED (D12:
--     company defaults = company-level GLAccountLink rows); the CFO approver
--     is ApprovalCFOUserID → __mj.User (a security identity, not a Person).
--   * Reversible preliminary batch lock (former V202607081600) FOLDED IN.
--   * CodeGen output is APPENDED below the banner at the end of this file;
--     regenerate it on a clean DB rather than hand-editing it.
-- =============================================================================

-- =============================================================================
-- REVISION 2026-07-27 (schema realignment — issues #22 + #24):
--   * AccountingCompanyProfile.DefaultPaymentTermsTypeID REMOVED (#22): it
--     soft-referenced downstream BizAppsOrders.PaymentTermsType — accounting
--     must never reference its own dependents, hard or soft. Per-company
--     default payment terms move to the orders side.
--   * NEW: JournalEntryType lookup (#24, BA-D29) replaces the closed
--     CK_JournalEntry_EntryType 17-value enum; JournalEntry.EntryType →
--     EntryTypeID FK. Accounting seeds only its ledger-mechanics types
--     (IsSystem=1, metadata/journal-entry-types/); domain types (OrderBooking,
--     PaymentReceipt, ...) become their owning app's metadata. IsBatchSummary
--     flag replaces the 'BatchSummary' magic string in triggers/queries; a
--     filtered unique index allows exactly one flagged row.
--   * JournalEntryBatch.ApprovalTaskID hard-FK to bizapps-tasks (#22 item 1)
--     is DEFERRED — held until bizapps-tasks installs cleanly as a dependency.
-- =============================================================================
-- 1. SCHEMA
-- =============================================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = '__mj_BizAppsAccounting')
    EXEC('CREATE SCHEMA __mj_BizAppsAccounting');
GO

-- =============================================================================
-- 2. TABLES (created without foreign keys; FKs added in section 3 so we can
--    cleanly handle circular references such as
--    JournalEntryBatch and JournalEntry (SummaryJournalEntryID),
--    AccountingCompanyProfile parent chains, etc.)
-- =============================================================================

---------------------------------------------------------------------------
-- 2.0 Currency — ISO-4217 reference data, OWNED BY BizAppsAccounting.
--     (Revises master-plan §4.7 / BA-D11: Currency was originally slated to
--     live in bizapps-common, but common never shipped it. BizAppsAccounting
--     is a free OSS app, so owning Currency here and letting other apps take a
--     dependency on it keeps the infra under our control.)
--     Referenced by GLAccount, AccountingCompanyProfile, JournalEntryLine,
--     CurrencySpotRate.
--     SEED ROWS ARE NOT INSERTED HERE — currency reference data is managed as
--     metadata and loaded via `mj sync push` from metadata/currencies/, so the
--     set is versioned + auditable rather than hardcoded in the migration.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.Currency (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Code CHAR(3) NOT NULL,
    Name NVARCHAR(80) NOT NULL,
    Symbol NVARCHAR(10) NULL,
    DecimalPlaces TINYINT NOT NULL DEFAULT 2,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_Currency PRIMARY KEY (ID),
    CONSTRAINT UQ_Currency_Code UNIQUE (Code),
    CONSTRAINT CK_Currency_Code CHECK (Code = UPPER(Code))
);
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'ISO-4217 currency reference data owned by BizAppsAccounting; seeded via metadata sync (metadata/currencies). Referenced by GLAccount, AccountingCompanyProfile, JournalEntryLine, and CurrencySpotRate.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'Currency';
GO

---------------------------------------------------------------------------
-- 2.0b CurrencySpotRate — spot FX rate (units of ToCurrency per 1 unit of
--      FromCurrency) on a given date, from a named source. Spot-only by
--      design: JE booking, period-end revaluation, and realized-FX on payment
--      all use spot rates. Forward/average rates are intentionally out of
--      scope; if ever needed they belong in a separate structure rather than
--      overloading this table.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.CurrencySpotRate (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    FromCurrencyCode CHAR(3) NOT NULL,
    ToCurrencyCode CHAR(3) NOT NULL,
    RateDate DATE NOT NULL,
    Rate DECIMAL(18,8) NOT NULL,
    Source NVARCHAR(50) NOT NULL DEFAULT 'Manual',
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_CurrencySpotRate PRIMARY KEY (ID),
    CONSTRAINT UQ_CurrencySpotRate UNIQUE (FromCurrencyCode, ToCurrencyCode, RateDate, Source),
    CONSTRAINT CK_CurrencySpotRate_Distinct CHECK (FromCurrencyCode <> ToCurrencyCode),
    CONSTRAINT CK_CurrencySpotRate_Positive CHECK (Rate > 0)
);
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Spot FX rate: units of ToCurrency per 1 unit of FromCurrency, on RateDate, from Source (ExchangeRate-API | ECB | OpenExchangeRates | Manual). Used for JE booking, period-end revaluation, and realized FX. Spot-only by design.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'CurrencySpotRate';
GO

---------------------------------------------------------------------------
-- 2.1 Dimension — first-class analytical tag (Department, CostCenter, ...)
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.Dimension (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    DisplayOrder INT NOT NULL DEFAULT 100,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_Dimension PRIMARY KEY (ID),
    CONSTRAINT UQ_Dimension_Code UNIQUE (Code)
);
GO

---------------------------------------------------------------------------
-- 2.2 DimensionValue — hierarchical values within a dimension
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.DimensionValue (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    DimensionID UNIQUEIDENTIFIER NOT NULL,
    Code NVARCHAR(80) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    ParentDimensionValueID UNIQUEIDENTIFIER NULL,
    EffectiveFrom DATE NULL,
    EffectiveTo DATE NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_DimensionValue PRIMARY KEY (ID),
    CONSTRAINT UQ_DimensionValue_DimensionID_Code UNIQUE (DimensionID, Code),
    CONSTRAINT CK_DimensionValue_EffectiveRange CHECK (EffectiveTo IS NULL OR EffectiveFrom IS NULL OR EffectiveTo >= EffectiveFrom)
);
GO

---------------------------------------------------------------------------
-- 2.3 TaxAuthority — taxing body (US-IRS, CA-BOE, EU-VAT-DE, ...)
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.TaxAuthority (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    CountryCode CHAR(2) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_TaxAuthority PRIMARY KEY (ID),
    CONSTRAINT UQ_TaxAuthority_Code UNIQUE (Code)
);
GO

---------------------------------------------------------------------------
-- 2.4 TaxJurisdiction — geographic scope within an authority
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.TaxJurisdiction (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    TaxAuthorityID UNIQUEIDENTIFIER NOT NULL,
    Code NVARCHAR(80) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    CountryCode CHAR(2) NULL,
    RegionCode NVARCHAR(50) NULL,
    PostalCode NVARCHAR(20) NULL,
    PostalCodeStart NVARCHAR(20) NULL,
    PostalCodeEnd NVARCHAR(20) NULL,
    CityName NVARCHAR(200) NULL,
    ParentTaxJurisdictionID UNIQUEIDENTIFIER NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_TaxJurisdiction PRIMARY KEY (ID),
    CONSTRAINT UQ_TaxJurisdiction_Code UNIQUE (Code)
);
GO

---------------------------------------------------------------------------
-- 2.5 TaxRate — rate by jurisdiction × category × effective range
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.TaxRate (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    TaxJurisdictionID UNIQUEIDENTIFIER NOT NULL,
    TaxCategory NVARCHAR(50) NOT NULL,
    -- DECIMAL(9,6), NOT (7,4). Four decimal places cannot hold a real US rate: San Mateo County is
    -- 9.375% (0.09375) and rounds to 0.0938, San Francisco 8.625% to 0.0863, New York City 8.875%
    -- to 0.0888. California district taxes come in 0.125% increments, so component rates need five
    -- places on their own. Orders' OrderCharge.Rate is already DECIMAL(9,6), so the narrower type
    -- here meant orders could record a rate accounting could not store.
    Rate DECIMAL(9,6) NOT NULL,
    EffectiveFrom DATE NOT NULL,
    EffectiveTo DATE NULL,
    Source NVARCHAR(50) NOT NULL DEFAULT 'Manual',
    CONSTRAINT PK_TaxRate PRIMARY KEY (ID),
    CONSTRAINT CK_TaxRate_Category CHECK (TaxCategory IN ('Standard','Reduced','Zero','Exempt','Custom')),
    -- NO CHECK on Source, deliberately. Enumerating providers in DDL makes every new rate feed a
    -- migration, which is the opposite of a plug-in architecture — and the original list named
    -- TaxJar, which Stripe has visibly deprioritised since acquiring it. Free sources matter more
    -- than the commercial ones here: the Streamlined Sales Tax rate files carry STATUTORY
    -- hold-harmless relief in their 24 member states, and that relief attaches to the state's own
    -- artifact rather than to the technique, so recording WHICH source a rate came from is an audit
    -- fact rather than a label.

    CONSTRAINT CK_TaxRate_Range CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom),
    CONSTRAINT CK_TaxRate_Rate CHECK (Rate >= 0 AND Rate <= 1)
);
GO

---------------------------------------------------------------------------
-- 2.6 AccountingCompanyProfile — IsA Disjoint child of __mj.Company.
--     ID is the SAME UUID as the parent Company row (no separate gen'd PK).
--     Holds business-profile + accounting-specific extensions.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.AccountingCompanyProfile (
    ID UNIQUEIDENTIFIER NOT NULL,
    EntityType NVARCHAR(30) NOT NULL DEFAULT 'Subsidiary',
    LegalStructureType NVARCHAR(30) NULL,
    IncorporationDate DATE NULL,
    JurisdictionCountry CHAR(2) NULL,
    JurisdictionRegion NVARCHAR(50) NULL,
    FederalTaxID NVARCHAR(40) NULL,
    OperatingTimeZone NVARCHAR(60) NULL,
    CompanyCode NVARCHAR(20) NOT NULL,
    FunctionalCurrencyCode CHAR(3) NOT NULL,
    ReportingCurrencyCode CHAR(3) NULL,
    FiscalYearStartMonth TINYINT NOT NULL DEFAULT 1,
    FiscalYearStartDay TINYINT NOT NULL DEFAULT 1,
    ParentAccountingCompanyID UNIQUEIDENTIFIER NULL,
    -- NO DefaultPaymentTermsTypeID (issue #22): payment terms are an ORDERS
    -- concern — accounting never references its own dependents, hard or soft.
    -- Per-company default terms will be modeled on the orders side.
    -- NO default-GL-account columns (plan D12): a company's default accounts are
    -- company-level GLAccountLink rows (roles: AR, Sales, Deferred Revenue, ...).
    ApprovalCFOUserID UNIQUEIDENTIFIER NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_AccountingCompanyProfile PRIMARY KEY (ID),
    CONSTRAINT UQ_AccountingCompanyProfile_CompanyCode UNIQUE (CompanyCode),
    CONSTRAINT CK_AccountingCompanyProfile_EntityType CHECK (EntityType IN ('LegalEntity','Subsidiary','Division','Department','Branch','Partner','JointVenture','CostCenter','Other')),
    CONSTRAINT CK_AccountingCompanyProfile_LegalStructure CHECK (LegalStructureType IS NULL OR LegalStructureType IN ('LLC','C-Corp','S-Corp','Partnership','SoleProprietorship','NonProfit-501c3','NonProfit-501c6','International-Ltd','International-GmbH','International-Pty','International-Other','Other')),
    CONSTRAINT CK_AccountingCompanyProfile_FiscalMonth CHECK (FiscalYearStartMonth BETWEEN 1 AND 12),
    CONSTRAINT CK_AccountingCompanyProfile_FiscalDay CHECK (FiscalYearStartDay BETWEEN 1 AND 31),
    CONSTRAINT CK_AccountingCompanyProfile_NoSelfParent CHECK (ParentAccountingCompanyID IS NULL OR ParentAccountingCompanyID <> ID),
    CONSTRAINT CK_AccountingCompanyProfile_CompanyCodeFormat CHECK (CompanyCode = UPPER(CompanyCode) AND CompanyCode NOT LIKE '%[^A-Z0-9_-]%' AND LEN(CompanyCode) BETWEEN 2 AND 20)
);
GO

---------------------------------------------------------------------------
-- 2.7 GLAccount — chart of accounts (mirrors ERP COA per Company)
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.GLAccount (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    AccountType NVARCHAR(15) NOT NULL,
    ParentGLAccountID UNIQUEIDENTIFIER NULL,
    CurrencyCode CHAR(3) NULL,
    ExternalSystem NVARCHAR(50) NULL,
    ExternalAccountID NVARCHAR(100) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    IsSystemSeeded BIT NOT NULL DEFAULT 0,
    Description NVARCHAR(MAX) NULL,
    CONSTRAINT PK_GLAccount PRIMARY KEY (ID),
    CONSTRAINT UQ_GLAccount_CompanyID_Code UNIQUE (CompanyID, Code),
    CONSTRAINT CK_GLAccount_AccountType CHECK (AccountType IN ('Asset','Liability','Equity','Revenue','Expense')),
    CONSTRAINT CK_GLAccount_NoSelfParent CHECK (ParentGLAccountID IS NULL OR ParentGLAccountID <> ID)
);
GO

---------------------------------------------------------------------------
-- 2.9 JournalEntryBatch — SINGLE-COMPANY aggregation that ships to the ERP
--     (plan D7/D8): header CompanyID; a singular accountant-set PostingDate that
--     must match the GL; the aggregated summary is ONE JournalEntry
--     (its type flagged IsBatchSummary, EffectiveDate=PostingDate) referenced
--     via SummaryJournalEntryID. Approval rides bizapps-tasks (D10): the batch
--     commits atomically first, then the task-raise stamps ApprovalTaskID +
--     ApprovalTaskRaisedAt in its own transaction (both-or-neither CHECK).
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntryBatch (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    BatchNumber NVARCHAR(40) NOT NULL,
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    PostingDate DATE NOT NULL,
    SummaryJournalEntryID UNIQUEIDENTIFIER NULL,
    TargetSystem NVARCHAR(50) NOT NULL,
    BatchedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    BatchedByUserID UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    TotalEntries INT NOT NULL DEFAULT 0,
    TotalDebits DECIMAL(18,2) NOT NULL DEFAULT 0,
    TotalCredits DECIMAL(18,2) NOT NULL DEFAULT 0,
    ExternalBatchRef NVARCHAR(100) NULL,
    ApprovedAt DATETIMEOFFSET NULL,
    ApprovedByUserID UNIQUEIDENTIFIER NULL,
    SentAt DATETIMEOFFSET NULL,
    PostedAt DATETIMEOFFSET NULL,
    ErrorMessage NVARCHAR(MAX) NULL,
    ApprovalTaskID UNIQUEIDENTIFIER NULL,
    ApprovalTaskRaisedAt DATETIMEOFFSET NULL,
    CONSTRAINT PK_JournalEntryBatch PRIMARY KEY (ID),
    CONSTRAINT UQ_JournalEntryBatch_Number UNIQUE (BatchNumber),
    CONSTRAINT CK_JournalEntryBatch_Status CHECK (Status IN ('Pending','Approved','Sent','Posted','Failed','Cancelled')),
    CONSTRAINT CK_JournalEntryBatch_Totals CHECK (TotalDebits >= 0 AND TotalCredits >= 0 AND TotalEntries >= 0),
    CONSTRAINT CK_JournalEntryBatch_TargetSystem CHECK (TargetSystem IN ('BusinessCentral','QuickBooks','NetSuite','Sage','Xero','Other')),
    CONSTRAINT CK_JournalEntryBatch_ApprovalTask CHECK (
        (ApprovalTaskID IS NULL AND ApprovalTaskRaisedAt IS NULL) OR
        (ApprovalTaskID IS NOT NULL AND ApprovalTaskRaisedAt IS NOT NULL)
    )
);
GO

---------------------------------------------------------------------------
-- 2.12 JournalEntryType — extensible JE classification (issue #24, BA-D29).
--      Replaces the closed CK_JournalEntry_EntryType enum: accounting cannot
--      know what apps will exist, so consuming apps add their OWN types as
--      rows (seeded via their `mj sync push` metadata) instead of requiring
--      an accounting migration per new domain. Accounting seeds only the
--      ledger-mechanics set it genuinely owns (IsSystem=1, via
--      metadata/journal-entry-types/): Manual, Reversal, Adjustment,
--      OpeningBalance, BatchSummary, FXRevaluation, PeriodEndAccrual,
--      Writeoff. IsBatchSummary replaces the 'BatchSummary' magic string as
--      the batch-summary discriminator (a flag beats a string match).
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntryType (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    IsSystem BIT NOT NULL DEFAULT 0,
    IsBatchSummary BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_JournalEntryType PRIMARY KEY (ID),
    CONSTRAINT UQ_JournalEntryType_Code UNIQUE (Code)
);
GO

-- Exactly ONE row may carry the batch-summary flag. Two flagged rows would
-- silently split the member/netting exclusion — the same invisible,
-- still-balanced failure mode the intercompany triggers guard against.
CREATE UNIQUE INDEX UX_JournalEntryType_BatchSummary
    ON __mj_BizAppsAccounting.JournalEntryType (IsBatchSummary)
    WHERE IsBatchSummary = 1;
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Extensible classification of journal entries (issue #24, BA-D29). Replaces the former closed EntryType CHECK enum. Accounting seeds only the ledger-mechanics types it owns (IsSystem=1, via metadata/journal-entry-types); consuming apps (orders, AP, payroll, ...) seed their own domain types via mj sync push without touching this repo.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'JournalEntryType';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Stable machine code for the type (e.g. Manual, Reversal, BatchSummary, OrderBooking). Unique. Referenced by code; display uses Name.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryType', @level2type = N'COLUMN', @level2name = N'Code';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Human-readable display name for the type.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryType', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What this entry type classifies and which app owns it.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryType', @level2type = N'COLUMN', @level2name = N'Description';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'1 = accounting''s own ledger-mechanics type (Manual, Reversal, BatchSummary, ...). Consumers must not repurpose or delete IsSystem rows.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryType', @level2type = N'COLUMN', @level2name = N'IsSystem';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'1 = this type marks a batch''s aggregated summary JE. Batch member/netting/sweep queries exclude JEs of this type via a join on this flag (replaces the former ''BatchSummary'' magic-string match). A filtered unique index allows exactly one flagged row.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryType', @level2type = N'COLUMN', @level2name = N'IsBatchSummary';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether this type may be used on NEW journal entries. Inactive types remain for historical rows.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryType', @level2type = N'COLUMN', @level2name = N'IsActive';
GO

---------------------------------------------------------------------------
-- 2.13 JournalEntry — top-level entity; the ledger row. SINGLE-COMPANY (plan
--      D3): CompanyID NOT NULL; every line's GLAccount must belong to it
--      (trigger 4.5). No period — the ERP assigns periods at posting.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntry (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    EntryNumber NVARCHAR(40) NOT NULL,
    CompanyID UNIQUEIDENTIFIER NOT NULL,   -- SINGLE-company JE (plan D3); every line's GLAccount must belong to this company (trigger 4.5)
    EffectiveDate DATE NOT NULL,
    EntryTypeID UNIQUEIDENTIFIER NOT NULL,   -- FK to JournalEntryType (issue #24, BA-D29); replaces the closed EntryType CHECK enum
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    Description NVARCHAR(MAX) NULL,
    -- Polymorphic origin (plan D25): every JE has exactly ONE causal source
    -- record (OrderLine, Payment, ...). LinkedEntityID is a hard
    -- FK to __mj.Entity; LinkedRecordID is the target record's primary key —
    -- soft by nature (the record lives in a downstream app's schema this repo
    -- has zero knowledge of). Both NULL = manual JE. Replaces the former
    -- per-entity soft-ref columns AND the JournalEntryLink table.
    LinkedEntityID UNIQUEIDENTIFIER NULL,
    LinkedRecordID NVARCHAR(400) NULL,
    -- Internal refs (NO ScheduledJournalEntryID — rev-rec is REAL forward-dated
    -- JEs written at booking, plan D15; no schedule tables, no materializer)
    ReversesJournalEntryID UNIQUEIDENTIFIER NULL,
    ReversedByJournalEntryID UNIQUEIDENTIFIER NULL,
    BatchID UNIQUEIDENTIFIER NULL,
    GLPostedAt DATETIMEOFFSET NULL,
    GLReferenceID NVARCHAR(100) NULL,
    -- Optional attached source document (vendor bills, signed contracts, etc.)
    FileID UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_JournalEntry PRIMARY KEY (ID),
    CONSTRAINT UQ_JournalEntry_Number UNIQUE (EntryNumber),
    CONSTRAINT CK_JournalEntry_Status CHECK (Status IN ('Pending','Batched','GLPosted')),
    -- NO EntryType CHECK enum (issue #24): the classification is the
    -- JournalEntryType lookup via EntryTypeID — extensible by consuming apps
    -- without an accounting migration.
    CONSTRAINT CK_JournalEntry_LinkedPair CHECK (
        (LinkedEntityID IS NULL AND LinkedRecordID IS NULL) OR
        (LinkedEntityID IS NOT NULL AND LinkedRecordID IS NOT NULL)
    ),
    CONSTRAINT CK_JournalEntry_NoSelfReverse CHECK (ReversesJournalEntryID IS NULL OR ReversesJournalEntryID <> ID),
    CONSTRAINT CK_JournalEntry_NoSelfReversedBy CHECK (ReversedByJournalEntryID IS NULL OR ReversedByJournalEntryID <> ID),
    -- The summary JE (its JournalEntryType flagged IsBatchSummary=1) carries
    -- its batch's BatchID like any other JE in the batch's orbit, so it rides
    -- the SAME derived lock machinery (preliminary while its batch is Pending,
    -- permanent from approval, GLPosted at post). It is NOT a member: netting /
    -- count / sweep queries exclude it via the type's IsBatchSummary flag (the
    -- ruled default exclusion — the type is THE discriminator; the batch's
    -- SummaryJournalEntryID is the redundant cross-check).
    CONSTRAINT CK_JournalEntry_BatchedHasBatch CHECK (Status = 'Pending' OR BatchID IS NOT NULL),
    CONSTRAINT CK_JournalEntry_GLPostedHasRef CHECK (Status <> 'GLPosted' OR (GLPostedAt IS NOT NULL))
);
GO

---------------------------------------------------------------------------
-- 2.14 JournalEntryLine — debit/credit line; multi-currency aware
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntryLine (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    JournalEntryID UNIQUEIDENTIFIER NOT NULL,
    LineNumber INT NOT NULL,
    GLAccountID UNIQUEIDENTIFIER NOT NULL,
    DebitAmount DECIMAL(18,2) NULL,
    CreditAmount DECIMAL(18,2) NULL,
    OriginalCurrencyCode CHAR(3) NULL,
    OriginalDebitAmount DECIMAL(18,2) NULL,
    OriginalCreditAmount DECIMAL(18,2) NULL,
    ExchangeRateUsed DECIMAL(18,8) NULL,
    Description NVARCHAR(MAX) NULL,
    -- (CounterpartyOrganizationID REMOVED — Amith 2026-07-29: customer attribution is
    --  orders'-side business logic, not an accounting-line appendage.)
    CONSTRAINT PK_JournalEntryLine PRIMARY KEY (ID),
    CONSTRAINT UQ_JournalEntryLine_JE_LineNumber UNIQUE (JournalEntryID, LineNumber),
    CONSTRAINT CK_JEL_OneSide CHECK (
        (DebitAmount IS NOT NULL AND CreditAmount IS NULL AND DebitAmount > 0) OR
        (CreditAmount IS NOT NULL AND DebitAmount IS NULL AND CreditAmount > 0)
    ),
    CONSTRAINT CK_JEL_OriginalPaired CHECK (
        (OriginalDebitAmount IS NULL AND OriginalCreditAmount IS NULL) OR
        (OriginalDebitAmount IS NOT NULL AND OriginalCreditAmount IS NULL) OR
        (OriginalDebitAmount IS NULL AND OriginalCreditAmount IS NOT NULL)
    ),
    CONSTRAINT CK_JEL_OriginalCurrencyRequired CHECK (
        (OriginalDebitAmount IS NULL AND OriginalCreditAmount IS NULL) OR
        OriginalCurrencyCode IS NOT NULL
    ),
    CONSTRAINT CK_JEL_OriginalRateRequired CHECK (
        (OriginalDebitAmount IS NULL AND OriginalCreditAmount IS NULL) OR
        ExchangeRateUsed IS NOT NULL
    ),
    CONSTRAINT CK_JEL_OriginalSideMatches CHECK (
        (OriginalDebitAmount IS NULL AND OriginalCreditAmount IS NULL) OR
        (OriginalDebitAmount IS NOT NULL AND DebitAmount IS NOT NULL) OR
        (OriginalCreditAmount IS NOT NULL AND CreditAmount IS NOT NULL)
    ),
    CONSTRAINT CK_JEL_LineNumber CHECK (LineNumber > 0)
);
GO

---------------------------------------------------------------------------
-- 2.15 JournalEntryLineDimension — analytical tag on a JE line
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntryLineDimension (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    JournalEntryLineID UNIQUEIDENTIFIER NOT NULL,
    DimensionID UNIQUEIDENTIFIER NOT NULL,
    DimensionValueID UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_JELDimension PRIMARY KEY (ID),
    CONSTRAINT UQ_JELDimension_Line_Dimension UNIQUE (JournalEntryLineID, DimensionID)
);
GO

---------------------------------------------------------------------------
-- 2.17 TaxLiability — accrued tax balance per authority × jurisdiction
--      (AccountingPeriodID removed 2026-07-06 — the ERP owns periods)
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.TaxLiability (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    TaxAuthorityID UNIQUEIDENTIFIER NOT NULL,
    TaxJurisdictionID UNIQUEIDENTIFIER NOT NULL,
    AccruedAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    RemittedAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Open',
    DueDate DATE NULL,
    FilingFrequency NVARCHAR(20) NULL,
    CONSTRAINT PK_TaxLiability PRIMARY KEY (ID),
    CONSTRAINT CK_TaxLiability_Status CHECK (Status IN ('Open','Filed','Paid','PartiallyPaid')),
    CONSTRAINT CK_TaxLiability_FilingFreq CHECK (FilingFrequency IS NULL OR FilingFrequency IN ('Monthly','Quarterly','SemiAnnual','Annual','OnDemand')),
    CONSTRAINT CK_TaxLiability_Amounts CHECK (AccruedAmount >= 0 AND RemittedAmount >= 0)
);
GO

---------------------------------------------------------------------------
-- (2.18 TaxRemittance REMOVED — Amith PR-27 review 2026-07-29: remitting tax
--  to an authority is an ERP/GL concern, not this subledger's. Accounting
--  keeps the ACCRUAL only (TaxLiability); the payment happens in the ERP.)
---------------------------------------------------------------------------

---------------------------------------------------------------------------
-- 2.19 CompanyTaxNexus — WHERE THIS COMPANY MUST COLLECT TAX (BA-D29).
--
--      REPLACES CustomerTaxProfile, which was dropped in the same change. That
--      table asked "is this CUSTOMER exempt" — a fact about somebody else's
--      business, and the only customer-shaped row type in a schema otherwise
--      made of companies, accounts and entries. It had to reach into
--      __mj_BizAppsCommon for Organization to exist at all, which was the tell.
--      Exemption now lives in bizapps-orders as CustomerTaxExemption, where
--      customer concerns belong (Amith 2026-07-27), and can express what the old
--      table could not: a Person as well as an Organization, several exemption
--      TYPES, and a product-category scope — so "exempt from state tax on
--      publications but not on merchandise" is sayable.
--
--      NEXUS IS THE OPPOSITE QUESTION and it genuinely belongs here: it is a
--      property of OUR legal entity's registrations, and Company is already this
--      schema's vocabulary. Both must hold to charge tax: the seller has nexus
--      AND the buyer is not exempt AND the product is taxable there.
--
--      REGISTRATION IS A ONE-WAY DOOR. Once registered you must file in that
--      jurisdiction — including zero returns — until the account is formally
--      closed, and a state will not close one with open periods. `RegisteredTo`
--      is therefore the date the REGISTRATION ended, which is not the date the
--      activity stopped.
--
--      TRAILING NEXUS is why ObligationEndsAt exists separately. The duty to
--      collect routinely outlasts the activity that created it: California holds
--      a seller through the nexus year PLUS the whole following calendar year,
--      Colorado, Washington, Wisconsin, Iowa and Michigan through the following
--      calendar year, Texas until twelve consecutive months below the threshold.
--      Collapsing that into RegisteredTo would end the obligation early, which is
--      the expensive direction to be wrong in.
--
--      Threshold MONITORING — the running gross/retail/taxable totals that say
--      when nexus is about to be triggered — is deliberately NOT here. This table
--      records the obligations that exist; deciding when a new one arises reads
--      order history and belongs upstream.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.CompanyTaxNexus (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    TaxJurisdictionID UNIQUEIDENTIFIER NOT NULL,
    -- WHY the obligation exists. Economic (crossed a revenue/transaction
    -- threshold), Physical (people, property or inventory in the state),
    -- Marketplace (a facilitator law attributes it), or Voluntary (registered
    -- without being required, which is a real and deliberate choice).
    NexusType NVARCHAR(20) NOT NULL DEFAULT 'Economic',
    RegistrationNumber NVARCHAR(100) NULL,
    RegisteredFrom DATE NOT NULL,
    RegisteredTo DATE NULL,
    -- Trailing nexus: the duty to COLLECT can outlast the registration window.
    ObligationEndsAt DATE NULL,
    Status NVARCHAR(10) NOT NULL DEFAULT 'Active',
    Comments NVARCHAR(MAX) NULL,
    CONSTRAINT PK_CompanyTaxNexus PRIMARY KEY (ID),
    CONSTRAINT UQ_CompanyTaxNexus UNIQUE (CompanyID, TaxJurisdictionID, RegisteredFrom),
    CONSTRAINT CK_CompanyTaxNexus_Type CHECK (NexusType IN ('Economic','Physical','Marketplace','Voluntary')),
    CONSTRAINT CK_CompanyTaxNexus_Status CHECK (Status IN ('Active','Inactive')),
    CONSTRAINT CK_CompanyTaxNexus_Window CHECK (RegisteredTo IS NULL OR RegisteredTo >= RegisteredFrom)
);
GO

---------------------------------------------------------------------------
-- 2.22 JournalEntrySequence — PER-COMPANY per-FY counter for gap-free JE
--      numbers 'JE-{CompanyCode}-{FY}-{seq}' (plan D19: JEs are single-company,
--      so numbering is company-scoped; FY from the company's fiscal settings).
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntrySequence (
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    FiscalYear INT NOT NULL,
    NextSequenceNumber INT NOT NULL DEFAULT 1,
    CONSTRAINT PK_JournalEntrySequence PRIMARY KEY (CompanyID, FiscalYear),
    CONSTRAINT CK_JournalEntrySequence_NextSeq CHECK (NextSequenceNumber > 0)
);
GO

---------------------------------------------------------------------------
-- 2.23 JournalEntryBatchSequence — GLOBAL singleton counter for gap-free batch
--      numbers (plan D19: batch numbering stays a global sequence).
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntryBatchSequence (
    ID INT NOT NULL DEFAULT 1,
    NextSequenceNumber INT NOT NULL DEFAULT 1,
    CONSTRAINT PK_JournalEntryBatchSequence PRIMARY KEY (ID),
    CONSTRAINT CK_JournalEntryBatchSequence_Singleton CHECK (ID = 1),
    CONSTRAINT CK_JournalEntryBatchSequence_NextSeq CHECK (NextSequenceNumber > 0)
);
GO

---------------------------------------------------------------------------
-- (2.24 JournalEntryLink REMOVED, plan D25: every JE has exactly ONE causal
--  origin, carried as the LinkedEntityID/LinkedRecordID pair on JournalEntry
--  itself. Multi-record relationships — e.g. a payment clearing several
--  orders — live in the owning app's domain tables, not in JE links.)
---------------------------------------------------------------------------

---------------------------------------------------------------------------
-- 2.28 GLAccountRole — the JOB a GL account plays for a linked record
--      (AM-2: Cash, Accounts Receivable, Inventory, COGS, Sales, ...).
--      Lookup table (NOT a CHECK) so roles are additive at runtime. Seed data
--      ships via metadata sync (metadata/gl-account-roles), never SQL INSERTs.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.GLAccountRole (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Status NVARCHAR(10) NOT NULL DEFAULT 'Active',
    Sequence INT NOT NULL DEFAULT 0,
    CONSTRAINT PK_GLAccountRole PRIMARY KEY (ID),
    CONSTRAINT UQ_GLAccountRole_Name UNIQUE (Name),
    CONSTRAINT CK_GLAccountRole_Status CHECK (Status IN ('Active','Inactive'))
);
GO

---------------------------------------------------------------------------
-- 2.29 GLAccountLink — polymorphic, role-based, date-effective mapping from
--      ANY record (Company defaults / ProductCategory / Product / future) to
--      a GLAccount (AM-5; replaces the ProductGLAccount /
--      ProductCategoryGLAccount / AccountingCompanyProfileGLAccount trio).
--      EntityID + RecordID = MJ's TaggedItem-style polymorphic reference
--      (same pattern as JournalEntry.LinkedEntityID/LinkedRecordID, plan D25).
--      GLAccountRoleID is an
--      assumed correction (⚠OQ-G): without it a record's Revenue link is
--      indistinguishable from its AR link. StartedAt/EndedAt give Amith's
--      "new CoA effective Aug 1" pre-entered-flip behavior; resolution filters
--      Status='Active' + window covering the as-of date.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.GLAccountLink (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    GLAccountID UNIQUEIDENTIFIER NOT NULL,
    GLAccountRoleID UNIQUEIDENTIFIER NOT NULL,
    EntityID UNIQUEIDENTIFIER NOT NULL,
    RecordID NVARCHAR(400) NOT NULL,
    Status NVARCHAR(10) NOT NULL DEFAULT 'Pending',
    StartedAt DATETIMEOFFSET NULL,
    EndedAt DATETIMEOFFSET NULL,
    Comments NVARCHAR(MAX) NULL,
    CONSTRAINT PK_GLAccountLink PRIMARY KEY (ID),
    CONSTRAINT CK_GLAccountLink_Status CHECK (Status IN ('Pending','Active','Disabled')),
    CONSTRAINT CK_GLAccountLink_Window CHECK (StartedAt IS NULL OR EndedAt IS NULL OR EndedAt > StartedAt)
);
GO

---------------------------------------------------------------------------
-- 2.30 GLAccountLinkDimension — which Dimensions apply to entries resolved
--      through a link, in display order (AM-5). Carries DimensionID ONLY;
--      the VALUES come from the caller's context at JE-build time (⚠OQ-I).
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.GLAccountLinkDimension (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    GLAccountLinkID UNIQUEIDENTIFIER NOT NULL,
    DimensionID UNIQUEIDENTIFIER NOT NULL,
    Sequence INT NOT NULL DEFAULT 0,
    CONSTRAINT PK_GLAccountLinkDimension PRIMARY KEY (ID),
    CONSTRAINT UQ_GLAccountLinkDimension UNIQUE (GLAccountLinkID, DimensionID)
);
GO

---------------------------------------------------------------------------
-- 2.31 IntercompanyAccountMatch — the Due To / Due From account pair for an
--      ORDERED company pair (BA-D26). When one company collects cash that
--      settles a line owned by another, the collector owes the owner; this
--      table says which two accounts carry that obligation.
--
--      WHY ORDERED, NOT SYMMETRIC. A row is read strictly as: "Source collected
--      on Target's behalf, so Source owes Target." DueToGLAccountID is the
--      LIABILITY on SOURCE's books; DueFromGLAccountID is the ASSET on TARGET's
--      books. Money flowing the other way is a DIFFERENT row (Source/Target
--      swapped), because the two directions routinely use different accounts and
--      may be configured at different times. Packing four accounts into one
--      symmetric row invites reading the pair backwards, and a backwards pair
--      still BALANCES — so nothing downstream would look wrong (BA-D27).
--
--      Date-effective like GLAccountLink, with the same resolution rule (Active,
--      window covers the as-of date, latest StartedAt wins). Deliberately NOT
--      UNIQUE on the pair: superseding a mapping means adding a row and closing
--      the old one's window, never editing history.
--
--      No GLAccountRole is involved. Roles resolve per-RECORD (this product's
--      revenue account); an intercompany account is per-company-PAIR and cannot
--      be expressed that way, so this table is the sole resolution path for it
--      rather than a second, competing one (BA-D28).
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.IntercompanyAccountMatch (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    SourceCompanyID UNIQUEIDENTIFIER NOT NULL,
    TargetCompanyID UNIQUEIDENTIFIER NOT NULL,
    DueToGLAccountID UNIQUEIDENTIFIER NOT NULL,
    DueFromGLAccountID UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(10) NOT NULL DEFAULT 'Pending',
    StartedAt DATETIMEOFFSET NULL,
    EndedAt DATETIMEOFFSET NULL,
    Comments NVARCHAR(MAX) NULL,
    CONSTRAINT PK_IntercompanyAccountMatch PRIMARY KEY (ID),
    CONSTRAINT CK_IntercompanyAccountMatch_Status CHECK (Status IN ('Pending','Active','Disabled')),
    CONSTRAINT CK_IntercompanyAccountMatch_Window CHECK (StartedAt IS NULL OR EndedAt IS NULL OR EndedAt > StartedAt),
    CONSTRAINT CK_IntercompanyAccountMatch_Companies CHECK (SourceCompanyID <> TargetCompanyID),
    CONSTRAINT CK_IntercompanyAccountMatch_Accounts CHECK (DueToGLAccountID <> DueFromGLAccountID)
);
GO

---------------------------------------------------------------------------
-- 2.32 IntercompanyAccountMatchDimension — the analytical Dimensions, and
--      optionally their VALUES, to stamp on each leg of an intercompany pair.
--
--      DIFFERS FROM GLAccountLinkDimension ON PURPOSE. That table carries the
--      Dimension only, because a transaction supplies the value from context
--      (OQ-I). An intercompany leg has no such context: it is raised by the
--      payment engine to balance somebody else's revenue, so there is no
--      originating record to read a department or cost centre from. Hence
--      DimensionValueID, nullable — set it to pin a fixed value, leave it NULL
--      to keep the GLAccountLink behaviour of taking the value from context.
--
--      Side exists because the two legs sit on DIFFERENT companies' books and
--      routinely carry different values for the same Dimension — each entity
--      tags the balance with its own cost centre.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.IntercompanyAccountMatchDimension (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    IntercompanyAccountMatchID UNIQUEIDENTIFIER NOT NULL,
    Side NVARCHAR(10) NOT NULL,
    DimensionID UNIQUEIDENTIFIER NOT NULL,
    DimensionValueID UNIQUEIDENTIFIER NULL,
    Sequence INT NOT NULL DEFAULT 0,
    CONSTRAINT PK_IntercompanyAccountMatchDimension PRIMARY KEY (ID),
    CONSTRAINT UQ_IntercompanyAccountMatchDimension UNIQUE (IntercompanyAccountMatchID, Side, DimensionID),
    CONSTRAINT CK_IntercompanyAccountMatchDimension_Side CHECK (Side IN ('DueTo','DueFrom'))
);
GO

-- =============================================================================
-- 3. FOREIGN KEYS
-- =============================================================================
-- Cross-schema FKs reference __mj.Company, __mj.User, __mj.File, __mj.Entity and
-- __mj_BizAppsCommon.Organization; Currency now lives in THIS schema. These
-- schemas/tables MUST exist (MJ core + BizAppsCommon migrations run first).
-- See plans/bizapps-accounting-master.md §3.
--
-- JE provenance (plan D25): JournalEntry.LinkedEntityID takes a hard FK to
-- __mj.Entity; LinkedRecordID stays a soft ref by nature — it points at a
-- record owned by a downstream app (BizAppsOrders et al.) that this repo has
-- no knowledge of. Apps populate the pair; Accounting stores it for audit
-- drill-through.
-- =============================================================================

---------------------------------------------------------------------------
-- 3.1 DimensionValue → Dimension (and self-ref)
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.DimensionValue
    ADD CONSTRAINT FK_DimensionValue_Dimension
    FOREIGN KEY (DimensionID) REFERENCES __mj_BizAppsAccounting.Dimension(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.DimensionValue
    ADD CONSTRAINT FK_DimensionValue_Parent
    FOREIGN KEY (ParentDimensionValueID) REFERENCES __mj_BizAppsAccounting.DimensionValue(ID);
GO

---------------------------------------------------------------------------
-- 3.2 TaxJurisdiction → TaxAuthority (and self-ref)
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.TaxJurisdiction
    ADD CONSTRAINT FK_TaxJurisdiction_Authority
    FOREIGN KEY (TaxAuthorityID) REFERENCES __mj_BizAppsAccounting.TaxAuthority(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.TaxJurisdiction
    ADD CONSTRAINT FK_TaxJurisdiction_Parent
    FOREIGN KEY (ParentTaxJurisdictionID) REFERENCES __mj_BizAppsAccounting.TaxJurisdiction(ID);
GO

---------------------------------------------------------------------------
-- 3.3 TaxRate → TaxJurisdiction
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.TaxRate
    ADD CONSTRAINT FK_TaxRate_Jurisdiction
    FOREIGN KEY (TaxJurisdictionID) REFERENCES __mj_BizAppsAccounting.TaxJurisdiction(ID);
GO

---------------------------------------------------------------------------
-- 3.4 AccountingCompanyProfile → __mj.Company (IsA inheritance: ID = Company.ID)
--     plus self-ref parent and currency/payment-terms refs.
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD CONSTRAINT FK_ACP_Company
    FOREIGN KEY (ID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD CONSTRAINT FK_ACP_Parent
    FOREIGN KEY (ParentAccountingCompanyID) REFERENCES __mj_BizAppsAccounting.AccountingCompanyProfile(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD CONSTRAINT FK_ACP_FunctionalCurrency
    FOREIGN KEY (FunctionalCurrencyCode) REFERENCES __mj_BizAppsAccounting.Currency(Code);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD CONSTRAINT FK_ACP_ReportingCurrency
    FOREIGN KEY (ReportingCurrencyCode) REFERENCES __mj_BizAppsAccounting.Currency(Code);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD CONSTRAINT FK_ACP_ApprovalCFOUser
    FOREIGN KEY (ApprovalCFOUserID) REFERENCES __mj.[User](ID);
GO

---------------------------------------------------------------------------
-- 3.5 GLAccount → __mj.Company, self-ref, currency
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.GLAccount
    ADD CONSTRAINT FK_GLAccount_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.GLAccount
    ADD CONSTRAINT FK_GLAccount_Parent
    FOREIGN KEY (ParentGLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.GLAccount
    ADD CONSTRAINT FK_GLAccount_Currency
    FOREIGN KEY (CurrencyCode) REFERENCES __mj_BizAppsAccounting.Currency(Code);
GO

---------------------------------------------------------------------------
-- 3.8 JournalEntryBatch → __mj.Company (single-company batch), __mj.User
--     (approve/batch audit), JournalEntry (the aggregated summary JE)
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD CONSTRAINT FK_JEBatch_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD CONSTRAINT FK_JEBatch_SummaryJE
    FOREIGN KEY (SummaryJournalEntryID) REFERENCES __mj_BizAppsAccounting.JournalEntry(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD CONSTRAINT FK_JEBatch_ApprovedBy
    FOREIGN KEY (ApprovedByUserID) REFERENCES __mj.[User](ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD CONSTRAINT FK_JEBatch_BatchedBy
    FOREIGN KEY (BatchedByUserID) REFERENCES __mj.[User](ID);
GO

-- (3.9–3.11 removed: Recurring* tables dropped per BA-D18 revision. 3.24–3.28
--  removed 2026-07-22: the batch line-item + scheduled-JE tables are retired.)

---------------------------------------------------------------------------
-- 3.12 JournalEntry — all internal FKs (polymorphic soft refs intentionally omitted)
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_Batch
    FOREIGN KEY (BatchID) REFERENCES __mj_BizAppsAccounting.JournalEntryBatch(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_EntryType
    FOREIGN KEY (EntryTypeID) REFERENCES __mj_BizAppsAccounting.JournalEntryType(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_LinkedEntity
    FOREIGN KEY (LinkedEntityID) REFERENCES __mj.Entity(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_Reverses
    FOREIGN KEY (ReversesJournalEntryID) REFERENCES __mj_BizAppsAccounting.JournalEntry(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_ReversedBy
    FOREIGN KEY (ReversedByJournalEntryID) REFERENCES __mj_BizAppsAccounting.JournalEntry(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_File
    FOREIGN KEY (FileID) REFERENCES __mj.[File](ID);
GO

---------------------------------------------------------------------------
-- 3.13 JournalEntryLine → JournalEntry, GLAccount, Currency
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryLine
    ADD CONSTRAINT FK_JEL_JournalEntry
    FOREIGN KEY (JournalEntryID) REFERENCES __mj_BizAppsAccounting.JournalEntry(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryLine
    ADD CONSTRAINT FK_JEL_GLAccount
    FOREIGN KEY (GLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryLine
    ADD CONSTRAINT FK_JEL_OriginalCurrency
    FOREIGN KEY (OriginalCurrencyCode) REFERENCES __mj_BizAppsAccounting.Currency(Code);
GO

---------------------------------------------------------------------------
-- 3.14 JournalEntryLineDimension → JournalEntryLine, Dimension, DimensionValue
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryLineDimension
    ADD CONSTRAINT FK_JELDimension_Line
    FOREIGN KEY (JournalEntryLineID) REFERENCES __mj_BizAppsAccounting.JournalEntryLine(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryLineDimension
    ADD CONSTRAINT FK_JELDimension_Dimension
    FOREIGN KEY (DimensionID) REFERENCES __mj_BizAppsAccounting.Dimension(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryLineDimension
    ADD CONSTRAINT FK_JELDimension_DimensionValue
    FOREIGN KEY (DimensionValueID) REFERENCES __mj_BizAppsAccounting.DimensionValue(ID);
GO

---------------------------------------------------------------------------
-- 3.16 TaxLiability → __mj.Company, TaxAuthority, TaxJurisdiction, AccountingPeriod
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.TaxLiability
    ADD CONSTRAINT FK_TaxLiability_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.TaxLiability
    ADD CONSTRAINT FK_TaxLiability_Authority
    FOREIGN KEY (TaxAuthorityID) REFERENCES __mj_BizAppsAccounting.TaxAuthority(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.TaxLiability
    ADD CONSTRAINT FK_TaxLiability_Jurisdiction
    FOREIGN KEY (TaxJurisdictionID) REFERENCES __mj_BizAppsAccounting.TaxJurisdiction(ID);
GO

---------------------------------------------------------------------------
-- (3.17 TaxRemittance FKs removed with the table — see the 2.18 note.)
---------------------------------------------------------------------------

---------------------------------------------------------------------------
-- 3.18 CompanyTaxNexus → __mj.Company, TaxJurisdiction
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.CompanyTaxNexus
    ADD CONSTRAINT FK_CompanyTaxNexus_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.CompanyTaxNexus
    ADD CONSTRAINT FK_CompanyTaxNexus_Jurisdiction
    FOREIGN KEY (TaxJurisdictionID) REFERENCES __mj_BizAppsAccounting.TaxJurisdiction(ID);
GO

---------------------------------------------------------------------------
-- 3.21 JournalEntrySequence → __mj.Company (per-company numbering, D19)
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntrySequence
    ADD CONSTRAINT FK_JESequence_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

---------------------------------------------------------------------------
-- 3.22 CurrencySpotRate → Currency (from/to)
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.CurrencySpotRate
    ADD CONSTRAINT FK_CurrencySpotRate_From
    FOREIGN KEY (FromCurrencyCode) REFERENCES __mj_BizAppsAccounting.Currency(Code);
GO

ALTER TABLE __mj_BizAppsAccounting.CurrencySpotRate
    ADD CONSTRAINT FK_CurrencySpotRate_To
    FOREIGN KEY (ToCurrencyCode) REFERENCES __mj_BizAppsAccounting.Currency(Code);
GO

---------------------------------------------------------------------------
-- (3.23 JournalEntryLink FKs REMOVED with the table, plan D25. The origin
--  pair's FK_JE_LinkedEntity lives with the other JournalEntry FKs above.)
---------------------------------------------------------------------------

---------------------------------------------------------------------------
-- 3.29 GLAccountRole / GLAccountLink / GLAccountLinkDimension (new, AM-5)
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.GLAccountLink
    ADD CONSTRAINT FK_GLAccountLink_GLAccount
    FOREIGN KEY (GLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.GLAccountLink
    ADD CONSTRAINT FK_GLAccountLink_Role
    FOREIGN KEY (GLAccountRoleID) REFERENCES __mj_BizAppsAccounting.GLAccountRole(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.GLAccountLink
    ADD CONSTRAINT FK_GLAccountLink_Entity
    FOREIGN KEY (EntityID) REFERENCES __mj.Entity(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.GLAccountLinkDimension
    ADD CONSTRAINT FK_GLALD_Link
    FOREIGN KEY (GLAccountLinkID) REFERENCES __mj_BizAppsAccounting.GLAccountLink(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.GLAccountLinkDimension
    ADD CONSTRAINT FK_GLALD_Dimension
    FOREIGN KEY (DimensionID) REFERENCES __mj_BizAppsAccounting.Dimension(ID);
GO

---------------------------------------------------------------------------
-- 3.31 IntercompanyAccountMatch / ...Dimension (new, BA-D26)
---------------------------------------------------------------------------
-- NOTE: the two Company FKs both point at __mj.Company, and the two GLAccount
-- FKs both point at GLAccount. SQL Server allows this (no multiple-cascade-path
-- problem) because none of them cascade — every one is NO ACTION, matching the
-- rest of this schema.
ALTER TABLE __mj_BizAppsAccounting.IntercompanyAccountMatch
    ADD CONSTRAINT FK_IntercompanyAccountMatch_SourceCompany
    FOREIGN KEY (SourceCompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.IntercompanyAccountMatch
    ADD CONSTRAINT FK_IntercompanyAccountMatch_TargetCompany
    FOREIGN KEY (TargetCompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.IntercompanyAccountMatch
    ADD CONSTRAINT FK_IntercompanyAccountMatch_DueToGLAccount
    FOREIGN KEY (DueToGLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.IntercompanyAccountMatch
    ADD CONSTRAINT FK_IntercompanyAccountMatch_DueFromGLAccount
    FOREIGN KEY (DueFromGLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.IntercompanyAccountMatchDimension
    ADD CONSTRAINT FK_IAMD_Match
    FOREIGN KEY (IntercompanyAccountMatchID) REFERENCES __mj_BizAppsAccounting.IntercompanyAccountMatch(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.IntercompanyAccountMatchDimension
    ADD CONSTRAINT FK_IAMD_Dimension
    FOREIGN KEY (DimensionID) REFERENCES __mj_BizAppsAccounting.Dimension(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.IntercompanyAccountMatchDimension
    ADD CONSTRAINT FK_IAMD_DimensionValue
    FOREIGN KEY (DimensionValueID) REFERENCES __mj_BizAppsAccounting.DimensionValue(ID);
GO

-- =============================================================================
-- 4. TRIGGERS — DB-level enforcement of business rules
-- =============================================================================
-- Per plan §5, critical invariants are enforced at the DB level so SA-level
-- direct writes cannot violate them. T-SQL does not have PG's DEFERRABLE
-- constraint triggers, so we enforce balance at the LOCK event (Status
-- transitioning to Batched/GLPosted) rather than at every micro-edit. Pending
-- entries can be in flux; the moment you try to Batch, balance is enforced.
-- =============================================================================

---------------------------------------------------------------------------
-- 4.1 trg_JournalEntry_BalancedOnLock
--     Enforces SUM(Debits) = SUM(Credits) whenever a JE transitions to
--     Batched or GLPosted. Pending JEs may have temporary imbalance during
--     line construction.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JournalEntry_BalancedOnLock
ON __mj_BizAppsAccounting.JournalEntry
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(Status) AND NOT EXISTS (SELECT 1 FROM inserted WHERE Status IN ('Batched','GLPosted'))
        RETURN;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        WHERE i.Status IN ('Batched','GLPosted')
          AND ABS(
            ISNULL((SELECT SUM(jel.DebitAmount)  FROM __mj_BizAppsAccounting.JournalEntryLine jel WHERE jel.JournalEntryID = i.ID), 0) -
            ISNULL((SELECT SUM(jel.CreditAmount) FROM __mj_BizAppsAccounting.JournalEntryLine jel WHERE jel.JournalEntryID = i.ID), 0)
          ) > 0.005
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50001, 'JournalEntry cannot transition to Batched/GLPosted unless Sum(Debits) = Sum(Credits). See plan §5.2 / BA-D5.', 1;
    END;

    -- (The former AM-4 per-company balance check is retired: JEs are
    --  SINGLE-company (plan D3) — whole-entry balance + the company-match
    --  trigger (4.5) make a per-company check redundant.)
END;
GO

---------------------------------------------------------------------------
-- 4.2 trg_JournalEntryLine_RecheckParentBalance
--     If a line is added/edited/deleted on a JE that is ALREADY Batched or
--     GLPosted, re-verify balance after the change. Belt-and-suspenders with
--     the immutability trigger below.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JEL_RecheckParentBalance
ON __mj_BizAppsAccounting.JournalEntryLine
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @AffectedJEs TABLE (JournalEntryID UNIQUEIDENTIFIER PRIMARY KEY);
    INSERT INTO @AffectedJEs (JournalEntryID)
        SELECT DISTINCT JournalEntryID FROM inserted
        UNION
        SELECT DISTINCT JournalEntryID FROM deleted;

    IF EXISTS (
        SELECT 1
        FROM @AffectedJEs aj
        JOIN __mj_BizAppsAccounting.JournalEntry je ON je.ID = aj.JournalEntryID
        WHERE je.Status IN ('Batched','GLPosted')
          AND ABS(
            ISNULL((SELECT SUM(jel.DebitAmount)  FROM __mj_BizAppsAccounting.JournalEntryLine jel WHERE jel.JournalEntryID = je.ID), 0) -
            ISNULL((SELECT SUM(jel.CreditAmount) FROM __mj_BizAppsAccounting.JournalEntryLine jel WHERE jel.JournalEntryID = je.ID), 0)
          ) > 0.005
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50002, 'JournalEntryLine change broke balance on a locked JournalEntry (Status=Batched/GLPosted).', 1;
    END;

END;
GO

---------------------------------------------------------------------------
-- 4.3 trg_JournalEntry_Immutability — LEVELS OF LOCKING (folds the former
--     V202607081600 reversible-preliminary-lock rework, Robert 2026-07-08).
--     A JE Batched into a STILL-PENDING (unapproved) batch is only
--     PRELIMINARILY locked: the SANCTIONED reversal — Status Batched→Pending
--     AND BatchID→NULL, and NOTHING else, while the owning batch is still
--     Pending — is permitted. Once the batch is Approved (or beyond), the lock
--     is PERMANENT. Every other mutation on a locked JE stays blocked; DELETE
--     is blocked entirely. Reversals happen via NEW Pending JEs (plan §7).
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JournalEntry_Immutability
ON __mj_BizAppsAccounting.JournalEntry
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- DELETE: block if any deleted row was locked
    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted WHERE Status IN ('Batched','GLPosted'))
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50003, 'JournalEntry cannot be deleted once Status is Batched or GLPosted. Use the reversal pattern (new Pending JE with ReversesJournalEntryID).', 1;
    END;

    -- UPDATE: block changes to frozen fields when previous Status was locked.
    -- Allowed on a locked row: GLPostedAt, GLReferenceID, ReversedByJournalEntryID,
    -- Status Batched→GLPosted, and the reversible PRELIMINARY unlock (Status
    -- Batched→Pending + BatchID→NULL while the owning batch is still Pending).
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Batched','GLPosted')
          AND (
            -- (A) any frozen field OTHER THAN BatchID changed → never allowed on a locked row
            i.EntryNumber                 <> d.EntryNumber                 OR
            i.CompanyID                   <> d.CompanyID                   OR
            i.EffectiveDate               <> d.EffectiveDate               OR
            i.EntryTypeID                 <> d.EntryTypeID                 OR
            ISNULL(CAST(i.Description AS NVARCHAR(MAX)),N'') <> ISNULL(CAST(d.Description AS NVARCHAR(MAX)),N'') OR
            ISNULL(i.LinkedEntityID,           '00000000-0000-0000-0000-000000000000') <> ISNULL(d.LinkedEntityID,           '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.LinkedRecordID,           N'')                                    <> ISNULL(d.LinkedRecordID,           N'')                                    OR
            ISNULL(i.ReversesJournalEntryID,   '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ReversesJournalEntryID,   '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.FileID,                   '00000000-0000-0000-0000-000000000000') <> ISNULL(d.FileID,                   '00000000-0000-0000-0000-000000000000') OR
            -- (B) BatchID changed, and this is NOT the sanctioned reversible preliminary unlock
            (
                ISNULL(i.BatchID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.BatchID, '00000000-0000-0000-0000-000000000000')
                AND NOT (
                    d.Status = 'Batched'
                    AND i.Status = 'Pending'
                    AND i.BatchID IS NULL
                    AND EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.JournalEntryBatch b WHERE b.ID = d.BatchID AND b.Status = 'Pending')
                )
            )
          )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50004, 'JournalEntry is locked (Status=Batched/GLPosted). Only GLPostedAt, GLReferenceID, ReversedByJournalEntryID, Status (Batched→GLPosted), and the reversible unlock (Batched→Pending + BatchID→NULL while the batch is still Pending) may change.', 1;
    END;

    -- Disallow regressing Status backwards on a locked row. Batched→Pending is permitted ONLY as the
    -- reversible preliminary unlock (BatchID cleared, owning batch still Pending); GLPosted never regresses.
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE (d.Status = 'GLPosted' AND i.Status IN ('Pending','Batched'))
           OR (
               d.Status = 'Batched' AND i.Status = 'Pending'
               AND NOT (
                   i.BatchID IS NULL
                   AND EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.JournalEntryBatch b WHERE b.ID = d.BatchID AND b.Status = 'Pending')
               )
           )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50005, 'JournalEntry Status cannot regress (only Pending→Batched, Batched→GLPosted, and the reversible Batched→Pending unlock of an unapproved batch are allowed).', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.4 trg_JournalEntryLine_Immutability
--     Lines inherit their parent JE's lock state. Once parent is Batched or
--     GLPosted, lines cannot be UPDATE/DELETE/INSERT.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JEL_Immutability
ON __mj_BizAppsAccounting.JournalEntryLine
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @LockedJEs TABLE (JournalEntryID UNIQUEIDENTIFIER PRIMARY KEY);
    INSERT INTO @LockedJEs (JournalEntryID)
        SELECT DISTINCT je.ID
          FROM __mj_BizAppsAccounting.JournalEntry je
         WHERE je.ID IN (SELECT JournalEntryID FROM inserted UNION SELECT JournalEntryID FROM deleted)
           AND je.Status IN ('Batched','GLPosted');

    IF EXISTS (SELECT 1 FROM @LockedJEs)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50006, 'JournalEntryLine on a locked JournalEntry (Status=Batched/GLPosted) cannot be inserted, modified, or deleted. Use the reversal pattern.', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.5 Single-company enforcement (plan D3): every line's GLAccount must belong
--     to the parent JournalEntry's company. Two triggers cover both edit paths.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JEL_CompanyMatch
ON __mj_BizAppsAccounting.JournalEntryLine
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.JournalEntry je ON je.ID = i.JournalEntryID
        JOIN __mj_BizAppsAccounting.GLAccount gl ON gl.ID = i.GLAccountID
        WHERE gl.CompanyID <> je.CompanyID
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50019, 'JournalEntryLine.GLAccountID must belong to the parent JournalEntry''s company (single-company JE, plan D3).', 1;
    END;
END;
GO

CREATE TRIGGER __mj_BizAppsAccounting.trg_JE_CompanyMatch
ON __mj_BizAppsAccounting.JournalEntry
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(CompanyID) AND EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.JournalEntryLine jel ON jel.JournalEntryID = i.ID
        JOIN __mj_BizAppsAccounting.GLAccount gl ON gl.ID = jel.GLAccountID
        WHERE gl.CompanyID <> i.CompanyID
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50022, 'JournalEntry.CompanyID cannot change to a company that does not own every line''s GLAccount (single-company JE, plan D3).', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.6 trg_JournalEntryBatch_Immutability
--     Batches are content-frozen once APPROVED (locked by a human) and beyond
--     (Sent / Posted). Status / SentAt / PostedAt / ExternalBatchRef /
--     ErrorMessage are the only fields that may evolve after approval;
--     deletion is blocked from Approved onward (Pending batches are
--     mutable + deletable; Cancelled is a status, not a delete).
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JEBatch_Immutability
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted WHERE Status IN ('Approved','Sent','Posted'))
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50008, 'JournalEntryBatch cannot be deleted once Status is Approved, Sent, or Posted. Cancel it instead.', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Approved','Sent','Posted')
          AND (
            i.BatchNumber          <> d.BatchNumber          OR
            i.CompanyID            <> d.CompanyID            OR
            i.PostingDate          <> d.PostingDate          OR
            ISNULL(i.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') OR
            i.TargetSystem         <> d.TargetSystem         OR
            i.BatchedAt            <> d.BatchedAt            OR
            i.BatchedByUserID      <> d.BatchedByUserID      OR
            i.TotalEntries         <> d.TotalEntries         OR
            i.TotalDebits          <> d.TotalDebits          OR
            i.TotalCredits         <> d.TotalCredits
          )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50009, 'JournalEntryBatch is locked (Status=Approved/Sent/Posted). Only Status / ApprovedAt / ApprovedByUserID / SentAt / PostedAt / ExternalBatchRef / ErrorMessage may evolve (CompanyID, PostingDate, SummaryJournalEntryID, and the approval-task pointer freeze at approval).', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.6b trg_JEBatch_SummaryCoherence
--      When a batch's SummaryJournalEntryID is set, the referenced JE must be
--      wired correctly: its JournalEntryType flagged IsBatchSummary=1,
--      BatchID = THIS batch, and the
--      same CompanyID. Catches every summary mis-wiring in one place (pointing
--      at a regular JE, at another batch's summary, or across companies).
--      Batch-side only, so the engine's create-summary-then-stamp-pointer order
--      works in one transaction (stamp the pointer while the summary is locked
--      into the batch, i.e. Batched with BatchID set).
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JEBatch_SummaryCoherence
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted b
        LEFT JOIN __mj_BizAppsAccounting.JournalEntry s ON s.ID = b.SummaryJournalEntryID
        LEFT JOIN __mj_BizAppsAccounting.JournalEntryType st ON st.ID = s.EntryTypeID
        WHERE b.SummaryJournalEntryID IS NOT NULL
          AND (
            s.ID IS NULL
            OR ISNULL(st.IsBatchSummary, 0) = 0
            OR ISNULL(s.BatchID, '00000000-0000-0000-0000-000000000000') <> b.ID
            OR s.CompanyID <> b.CompanyID
          )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50023, 'JournalEntryBatch.SummaryJournalEntryID must reference a JournalEntry whose JournalEntryType has IsBatchSummary=1, BatchID = this batch, and the batch''s CompanyID.', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.7 trg_AccountingCompanyProfile_NoChains
--     Per BA-D9, ParentAccountingCompanyID may be set, but the referenced
--     parent must NOT itself have a parent. No chains.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_ACP_NoChains
ON __mj_BizAppsAccounting.AccountingCompanyProfile
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.AccountingCompanyProfile parent
          ON parent.ID = i.ParentAccountingCompanyID
        WHERE parent.ParentAccountingCompanyID IS NOT NULL
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50010, 'AccountingCompanyProfile.ParentAccountingCompanyID cannot point to a profile that itself has a parent (no chains, per BA-D9).', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.9 trg_JournalEntry_ReversalPairConsistency
--     If a JE has ReversesJournalEntryID set, the referenced JE must NOT
--     itself reverse anything (no chains of reversals). The reverser must
--     be typed with the system JournalEntryType Code='Reversal'.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JE_ReversalConsistency
ON __mj_BizAppsAccounting.JournalEntry
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.JournalEntryType t ON t.ID = i.EntryTypeID
        WHERE i.ReversesJournalEntryID IS NOT NULL
          AND t.Code <> 'Reversal'
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50012, 'JournalEntry that sets ReversesJournalEntryID must be typed with JournalEntryType Code = ''Reversal''.', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.11 trg_IAM_AccountIntegrity — the intercompany pair means what it says.
--
--      THIS IS THE IMPORTANT ONE. A mis-configured pair still produces a
--      BALANCED journal entry, so no downstream check catches it: debits equal
--      credits, the entry posts, and the error only surfaces as two companies'
--      balance sheets quietly disagreeing. There is no self-evident symptom, so
--      the invariant has to be enforced where it cannot be bypassed.
--
--      Three separable rules, three error codes:
--        50024  DueTo must be an account OF THE SOURCE COMPANY (Source owes).
--        50025  DueFrom must be an account OF THE TARGET COMPANY (Target is owed).
--        50026  DueTo is a payable (Liability); DueFrom is a receivable (Asset).
--
--      50026 is deliberately strict. Pointing either leg at a Revenue or Expense
--      account is a configuration slip that would misstate the P&L while still
--      balancing — precisely the failure this trigger exists to prevent. If a
--      deployment ever has a defensible reason to map otherwise, relaxing this
--      is a considered schema change, not a silent allowance.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_IAM_AccountIntegrity
ON __mj_BizAppsAccounting.IntercompanyAccountMatch
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.GLAccount gl ON gl.ID = i.DueToGLAccountID
        WHERE gl.CompanyID <> i.SourceCompanyID
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50024, 'IntercompanyAccountMatch.DueToGLAccountID must belong to SourceCompanyID — the Due To liability sits on the books of the company that owes (BA-D27).', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.GLAccount gl ON gl.ID = i.DueFromGLAccountID
        WHERE gl.CompanyID <> i.TargetCompanyID
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50025, 'IntercompanyAccountMatch.DueFromGLAccountID must belong to TargetCompanyID — the Due From receivable sits on the books of the company that is owed (BA-D27).', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.GLAccount dt ON dt.ID = i.DueToGLAccountID
        JOIN __mj_BizAppsAccounting.GLAccount df ON df.ID = i.DueFromGLAccountID
        WHERE dt.AccountType <> 'Liability' OR df.AccountType <> 'Asset'
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50026, 'IntercompanyAccountMatch requires DueToGLAccountID to be a Liability account and DueFromGLAccountID to be an Asset account.', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.12 trg_IAMD_DimensionValueBelongs — a pinned dimension VALUE must belong to
--      the Dimension it is pinned under.
--
--      JournalEntryLineDimension gets this check from the draft pipeline
--      (PipelineLookups.dimensionValueBelongs) because every line goes through
--      it. These rows are CONFIGURATION — written by an admin screen or a seed,
--      never through that pipeline — so nothing else would catch a mismatch.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_IAMD_DimensionValueBelongs
ON __mj_BizAppsAccounting.IntercompanyAccountMatchDimension
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.DimensionValue dv ON dv.ID = i.DimensionValueID
        WHERE i.DimensionValueID IS NOT NULL
          AND dv.DimensionID <> i.DimensionID
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50027, 'IntercompanyAccountMatchDimension.DimensionValueID must be a value of DimensionID.', 1;
    END;
END;
GO

-- =============================================================================
-- 5. STORED PROCEDURES — seeding and atomic sequence assignment
-- =============================================================================
-- The default chart of accounts is PER-COMPANY scoped, so it cannot be inserted
-- in a schema-creation migration. Instead, this migration ships sprocs that the
-- AccountingCompanyProfile entity's server-side Save() hook calls on initial
-- creation. The sprocs are idempotent.
-- =============================================================================

---------------------------------------------------------------------------
-- 5.1 spAssignNextJournalEntryNumber
--     Atomically increments the PER-COMPANY per-FiscalYear sequence and returns
--     the formatted EntryNumber 'JE-{CompanyCode}-{FY}-{seq:000000}' (plan D19).
--     Uses HOLDLOCK + UPDLOCK for serializable read-modify-write under
--     concurrency. Gap-free per BA-D15.
---------------------------------------------------------------------------
CREATE PROCEDURE __mj_BizAppsAccounting.spAssignNextJournalEntryNumber
    @CompanyID UNIQUEIDENTIFIER,
    @FiscalYear INT,
    @EntryNumber NVARCHAR(40) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NextSeq INT;
    DECLARE @CompanyCode NVARCHAR(20);

    SELECT @CompanyCode = CompanyCode
      FROM __mj_BizAppsAccounting.AccountingCompanyProfile
     WHERE ID = @CompanyID;
    IF @CompanyCode IS NULL
        THROW 50020, 'spAssignNextJournalEntryNumber: no AccountingCompanyProfile exists for @CompanyID (the company must be accounting-enabled before JEs can be numbered).', 1;

    BEGIN TRANSACTION;
        -- Upsert the seq row (HOLDLOCK for serializable read-modify-write under contention)
        IF NOT EXISTS (
            SELECT 1 FROM __mj_BizAppsAccounting.JournalEntrySequence WITH (HOLDLOCK, UPDLOCK)
             WHERE CompanyID = @CompanyID AND FiscalYear = @FiscalYear
        )
        BEGIN
            INSERT INTO __mj_BizAppsAccounting.JournalEntrySequence (CompanyID, FiscalYear, NextSequenceNumber)
            VALUES (@CompanyID, @FiscalYear, 2);
            SET @NextSeq = 1;
        END
        ELSE
        BEGIN
            UPDATE __mj_BizAppsAccounting.JournalEntrySequence WITH (HOLDLOCK, UPDLOCK)
               SET @NextSeq = NextSequenceNumber, NextSequenceNumber = NextSequenceNumber + 1
             WHERE CompanyID = @CompanyID AND FiscalYear = @FiscalYear;
        END;
    COMMIT TRANSACTION;

    SET @EntryNumber = N'JE-' + @CompanyCode + N'-' + CAST(@FiscalYear AS NVARCHAR(4)) + N'-' + RIGHT(N'000000' + CAST(@NextSeq AS NVARCHAR(6)), 6);
END;
GO

---------------------------------------------------------------------------
-- 5.2 spAssignNextBatchNumber
--     Atomically increments the GLOBAL singleton batch sequence and returns
--     'BATCH-{seq:000000}'. (D-SEQ 2026-07-06: batches are multi-company.)
---------------------------------------------------------------------------
CREATE PROCEDURE __mj_BizAppsAccounting.spAssignNextBatchNumber
    @BatchNumber NVARCHAR(40) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NextSeq INT;

    BEGIN TRANSACTION;
        IF NOT EXISTS (
            SELECT 1 FROM __mj_BizAppsAccounting.JournalEntryBatchSequence WITH (HOLDLOCK, UPDLOCK)
             WHERE ID = 1
        )
        BEGIN
            INSERT INTO __mj_BizAppsAccounting.JournalEntryBatchSequence (ID, NextSequenceNumber)
            VALUES (1, 2);
            SET @NextSeq = 1;
        END
        ELSE
        BEGIN
            UPDATE __mj_BizAppsAccounting.JournalEntryBatchSequence WITH (HOLDLOCK, UPDLOCK)
               SET @NextSeq = NextSequenceNumber, NextSequenceNumber = NextSequenceNumber + 1
             WHERE ID = 1;
        END;
    COMMIT TRANSACTION;

    SET @BatchNumber = N'BATCH-' + RIGHT(N'000000' + CAST(@NextSeq AS NVARCHAR(6)), 6);
END;
GO

---------------------------------------------------------------------------
-- 5.2.1 EXECUTE grants for the numbering sprocs (5.1, 5.2)
--   These two sprocs are hand-authored in this baseline, so CodeGen's
--   "Applying permissions" step never grants EXECUTE on them — it grants only
--   the sprocs IT generates (every spCreate/spUpdate/spDelete gets
--   GRANT EXECUTE TO cdp_Developer, cdp_Integration). Without this block the
--   numbering sprocs are the only app sprocs with no cdp-role EXECUTE grant, so
--   a runtime user whose EXECUTE comes solely from cdp-role membership (e.g. a
--   plain `mj migrate` deploy that does NOT also receive the installer's
--   database-scoped GRANT EXECUTE) is denied at JE/batch creation. Grant to the
--   same roles CodeGen uses so the app works under the cdp-role permission model
--   too. Uses the literal app schema to match the CREATE PROCEDURE statements
--   above (5.1/5.2), guaranteeing the grant targets exactly those objects.
---------------------------------------------------------------------------
GRANT EXECUTE ON __mj_BizAppsAccounting.spAssignNextJournalEntryNumber TO [cdp_Developer], [cdp_Integration];
GRANT EXECUTE ON __mj_BizAppsAccounting.spAssignNextBatchNumber TO [cdp_Developer], [cdp_Integration];
GO

---------------------------------------------------------------------------
-- 5.3 — Seeding / initialization sprocs intentionally NOT in this migration.
--
-- Earlier drafts had spSeedDefaultChartOfAccounts, spGenerateAccountingPeriods,
-- and spInitializeAccountingCompanyProfile here. They've been moved to TypeScript
-- BaseEntity subclasses in packages/CoreEntitiesServer/ so that:
--   1. Each row created during init flows through BaseEntity.Save(), which
--      writes a __mj.RecordChange row for audit (we lose this if we bulk-INSERT
--      from a sproc).
--   2. Logic is testable / debuggable / version-controlled in TypeScript.
--   3. Deployments can subclass via @RegisterClass to customize the COA seed
--      per Company.
--
-- The DB-level numbering sprocs above (5.1, 5.2) STAY at DB level because
-- they need atomic HOLDLOCK+UPDLOCK semantics. The BaseEntity Save() hooks
-- call them via the data provider before super.Save() commits the row.
---------------------------------------------------------------------------


-- =============================================================================
-- 6. EXTENDED PROPERTIES (MS_Description) — schema, tables, and every column
-- =============================================================================
-- SQL Server convention. CodeGen reads these to surface descriptions in
-- entity metadata, GraphQL docstrings, and MJ Explorer. The PG converter
-- maps these to PG COMMENT ON statements.
-- =============================================================================

---------------------------------------------------------------------------
-- 6.0 Schema
---------------------------------------------------------------------------
EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'BizApps Accounting — AR subsidiary ledger of record and journal-entry primitives for the MemberJunction ecosystem. Provides balanced JEs, multi-currency mechanics, dimensions, tax engine integration, and per-Company batch-to-ERP. Not a general ledger; downstream apps emit JEs by calling AccountingService.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting';
GO

---------------------------------------------------------------------------
-- 6.1 Dimension
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'First-class analytical dimension used to tag JE lines (Department, CostCenter, Project, Region, ...). Optional — deployments with no dimensions defined just have a flat chart.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'Dimension';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier (UUID per BA-D3).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'Dimension', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Short code for the dimension, e.g. ''Department'', ''CostCenter''.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'Dimension', @level2type = N'COLUMN', @level2name = N'Code';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display name for the dimension.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'Dimension', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Detailed description of what the dimension tracks and how it is intended to be used in reports.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'Dimension', @level2type = N'COLUMN', @level2name = N'Description';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Sort order in dropdowns and report filters. Lower values appear first.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'Dimension', @level2type = N'COLUMN', @level2name = N'DisplayOrder';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether this dimension is available for new JE-line tagging. Inactive dimensions stay in historical data but are hidden from selection.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'Dimension', @level2type = N'COLUMN', @level2name = N'IsActive';
GO

---------------------------------------------------------------------------
-- 6.2 DimensionValue
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Hierarchical value within a Dimension. ParentDimensionValueID allows e.g. Region → State → City rollups.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'DimensionValue';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'DimensionValue', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Dimension this value belongs to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'DimensionValue', @level2type = N'COLUMN', @level2name = N'DimensionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Code for this value (unique within the dimension). E.g. ''Marketing'', ''WestCoast'', ''ProductLaunch2026''.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'DimensionValue', @level2type = N'COLUMN', @level2name = N'Code';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display name for this value.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'DimensionValue', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Parent value for hierarchical dimensions (e.g. Country contains States).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'DimensionValue', @level2type = N'COLUMN', @level2name = N'ParentDimensionValueID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Earliest date this value is selectable (NULL = always).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'DimensionValue', @level2type = N'COLUMN', @level2name = N'EffectiveFrom';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Last date this value is selectable (NULL = never expires).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'DimensionValue', @level2type = N'COLUMN', @level2name = N'EffectiveTo';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether this value is available for new tagging.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'DimensionValue', @level2type = N'COLUMN', @level2name = N'IsActive';
GO

---------------------------------------------------------------------------
-- 6.3 TaxAuthority
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Taxing body — federal, state, or sub-national authority that levies and collects tax. Examples: US-IRS, CA-BOE, EU-VAT-DE.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxAuthority';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxAuthority', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Globally unique authority code, e.g. ''US-IRS'', ''CA-BOE'', ''EU-VAT-DE''.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxAuthority', @level2type = N'COLUMN', @level2name = N'Code';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display name for the authority.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxAuthority', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'ISO 3166-1 alpha-2 country code for the authority''s primary jurisdiction.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxAuthority', @level2type = N'COLUMN', @level2name = N'CountryCode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether this authority is currently active.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxAuthority', @level2type = N'COLUMN', @level2name = N'IsActive';
GO

---------------------------------------------------------------------------
-- 6.4 TaxJurisdiction
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Geographic scope within a TaxAuthority. May nest (state → county → city) via ParentTaxJurisdictionID. Used to look up the applicable TaxRate for a transaction.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'TaxAuthority this jurisdiction belongs to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction', @level2type = N'COLUMN', @level2name = N'TaxAuthorityID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Globally unique jurisdiction code.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction', @level2type = N'COLUMN', @level2name = N'Code';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display name (e.g. ''California State'', ''Los Angeles County'').',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'ISO 3166-1 alpha-2 country code.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction', @level2type = N'COLUMN', @level2name = N'CountryCode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'State/province sub-national region, free-form (e.g. ''CA'', ''NSW'', ''Bavaria'').',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction', @level2type = N'COLUMN', @level2name = N'RegionCode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Specific postal code scoping (if exact match required).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction', @level2type = N'COLUMN', @level2name = N'PostalCode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Start of postal-code range when the jurisdiction covers a contiguous range.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction', @level2type = N'COLUMN', @level2name = N'PostalCodeStart';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'End of postal-code range.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction', @level2type = N'COLUMN', @level2name = N'PostalCodeEnd';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'City name scoping (if the jurisdiction is city-specific).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction', @level2type = N'COLUMN', @level2name = N'CityName';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Parent jurisdiction for nested scopes (e.g. county inside state).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction', @level2type = N'COLUMN', @level2name = N'ParentTaxJurisdictionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether this jurisdiction is currently active.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxJurisdiction', @level2type = N'COLUMN', @level2name = N'IsActive';
GO

---------------------------------------------------------------------------
-- 6.5 TaxRate
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Rate applicable to a jurisdiction × category × effective range. Populated manually for simple cases or auto-synced from Avalara/TaxJar (per BA-D19).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRate', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Jurisdiction this rate applies to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRate', @level2type = N'COLUMN', @level2name = N'TaxJurisdictionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Tax category: Standard | Reduced | Zero | Exempt | Custom.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRate', @level2type = N'COLUMN', @level2name = N'TaxCategory';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Rate as a decimal fraction. 0.0825 = 8.25%.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRate', @level2type = N'COLUMN', @level2name = N'Rate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Earliest date this rate is effective.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRate', @level2type = N'COLUMN', @level2name = N'EffectiveFrom';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Last date this rate is effective (NULL = open-ended).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRate', @level2type = N'COLUMN', @level2name = N'EffectiveTo';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Source of the rate: Avalara | TaxJar | Manual.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRate', @level2type = N'COLUMN', @level2name = N'Source';
GO

---------------------------------------------------------------------------
-- 6.6 AccountingCompanyProfile
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'IsA Disjoint child of __mj.Company (same UUID as the parent). Holds all Company-attribute extensions required by Accounting: business profile (EntityType, LegalStructure, jurisdiction, tax ID) and accounting-specific settings (functional currency, fiscal year, default GL accounts). MJ core stays minimal; nothing accounting-flavored leaks into it (BA-D9).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Primary key AND foreign key to __mj.Company.ID. Same UUID as the parent Company row — this is the IsA pattern (BA-D9).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What kind of entity this is in the accounting structure: LegalEntity | Subsidiary | Division | Department | Branch | Partner | JointVenture | CostCenter | Other.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'EntityType';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Legal structure: LLC | C-Corp | S-Corp | Partnership | SoleProprietorship | NonProfit-501c3 | NonProfit-501c6 | International-Ltd | International-GmbH | International-Pty | International-Other | Other. Only meaningful when EntityType is a legal entity / subsidiary / partner.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'LegalStructureType';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Date the entity was legally incorporated/registered.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'IncorporationDate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'ISO 3166-1 alpha-2 country code where this entity is incorporated. Free-form; not FK-constrained to keep dependency on geography modeling clean.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'JurisdictionCountry';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'State/province sub-national region, free-form.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'JurisdictionRegion';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Federal tax identifier — EIN (US), ABN (Australia), VAT registration (EU), etc.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'FederalTaxID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'IANA time-zone name for the company''s operations (e.g. ''America/Chicago''). All timestamps store in UTC/Zulu; period and rev-rec boundaries are evaluated in this zone so a transaction near midnight lands in the right local day/month.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'OperatingTimeZone';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Short code used in JE numbering (''JE-{CompanyCode}-{FY}-{seq}''). Uppercase alphanumeric + dash/underscore. UNIQUE per deployment (BA-D15).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'CompanyCode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'ISO 4217 currency code (CHAR(3)) for the functional currency. All JEs post in this currency; original-currency triple on JE lines records the source-transaction currency when different (BA-D10).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'FunctionalCurrencyCode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Reporting currency for consolidation. NULL = same as functional currency.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'ReportingCurrencyCode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Calendar month (1-12) when the fiscal year begins. Default 1 (Jan-start calendar).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'FiscalYearStartMonth';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Calendar day-of-month (1-31) when the fiscal year begins. Default 1.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'FiscalYearStartDay';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'If set, this profile uses the books (COA, periods, JEs) of the referenced profile (consolidated reporting). Chains are forbidden: the referenced profile must NOT itself have a parent (BA-D9; trigger trg_ACP_NoChains).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'ParentAccountingCompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether this profile is currently active. Inactive companies cannot have new JEs.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'IsActive';
GO

---------------------------------------------------------------------------
-- 6.7 GLAccount
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Chart-of-accounts entry. Per-Company; mirrors the ERP''s COA so JE lines have a stable internal reference. Hierarchical via ParentGLAccountID for rollup reporting.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company that owns this account. UNIQUE (CompanyID, Code) — each company has its own chart.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Account code matching the ERP COA, e.g. ''11201'' or ''40100-SUB''.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'Code';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display name for the account.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'High-level type: Asset | Liability | Equity | Revenue | Expense (AM-3 five-value enum; contra/statistical variants may return later as a sub-classification).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'AccountType';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Parent account for hierarchical rollup (NULL = top of chart).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'ParentGLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Currency denomination of the account (NULL = uses the Company''s functional currency).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'CurrencyCode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'External system this account synchronizes to: BusinessCentral | QuickBooks | NetSuite | ... NULL if local-only.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'ExternalSystem';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The external system''s identifier for this account, used by sync.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'ExternalAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether the account is available for new JE lines. Inactive accounts retain historical data.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'IsActive';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'TRUE if the account was created by spSeedDefaultChartOfAccounts. Lets reports distinguish platform-shipped accounts from deployment customizations.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'IsSystemSeeded';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Optional description for the account.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'Description';
GO

---------------------------------------------------------------------------
-- 6.9 JournalEntryBatch
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Aggregation event that ships Pending JEs to the external ERP for the period. Per BA-D16, batching IS the locking event — JEs cannot be modified after they are referenced by a Batched row.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Gap-free batch number assigned by spAssignNextBatchNumber. Format ''BATCH-{CompanyCode}-{seq:000000}''.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'BatchNumber';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Target ERP for this batch: BusinessCentral | QuickBooks | NetSuite | Sage | Xero | Other.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'TargetSystem';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the batch was created (Pending JEs flipped to Batched).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'BatchedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'User (or system identity for scheduled runs) that performed the batch.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'BatchedByUserID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Lifecycle: Pending | Approved | Sent | Posted | Failed | Cancelled. Pending is mutable/deletable; Approved locks content (human sign-off); Posted = the ERP confirmed posting; Failed triggers retry + escalation; Cancelled is terminal from Pending or unsent Approved (trg_JEBatch_Immutability).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'Status';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Count of JE rows in this batch (denormalized for fast batch dashboards).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'TotalEntries';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Sum of debits across all JE lines in the batch (functional currency).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'TotalDebits';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Sum of credits across all JE lines in the batch (functional currency).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'TotalCredits';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'ERP''s reference returned on send (used to correlate the consolidated JE posted in the ERP).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ExternalBatchRef';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the batch was sent to the ERP.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'SentAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Error message from a Failed send. JEs revert to Pending for retry.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ErrorMessage';
GO

---------------------------------------------------------------------------
-- 6.13 JournalEntry
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Top-level ledger row. Balanced (Sum Debits = Sum Credits) at the lock event. Immutable after Status transitions to Batched/GLPosted. Lifecycle: Pending → Batched → GLPosted (BA-D6). Reversals happen via NEW Pending JEs with ReversesJournalEntryID set, never by modifying historical rows.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier (UUID per BA-D3).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Gap-free entry number ''JE-{CompanyCode}-{FY}-{seq:000000}'' assigned by spAssignNextJournalEntryNumber (BA-D15).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'EntryNumber';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Accounting date for the entry (the ERP assigns its own period at posting).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'EffectiveDate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The JournalEntryType classifying this entry (issue #24, BA-D29). Accounting seeds its own ledger-mechanics types; consuming apps seed their domain types as rows.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'EntryTypeID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Lifecycle state: Pending | Batched | GLPosted (BA-D6). Locked after Batched; only GLPosted transition and GL-roundtrip fields may change.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'Status';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Free-form human description of the entry.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'Description';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Polymorphic origin part 1 (plan D25): the MJ Entity of the single causal source record for this JE (OrderLine for booking/rev-rec entries, Payment for receipts/refunds, ...). FK to __mj.Entity. NULL (with LinkedRecordID) = manual JE.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'LinkedEntityID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Polymorphic origin part 2: the source record''s primary key (NVARCHAR(400) supports stringified composite keys). Soft by nature — the record lives in a downstream app''s schema. Set and NULL together with LinkedEntityID (CK_JournalEntry_LinkedPair).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'LinkedRecordID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When set, this JE is a reversal of the referenced original JE. Its JournalEntryType Code MUST be ''Reversal'' (trg_JE_ReversalConsistency).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'ReversesJournalEntryID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Back-pointer set on the original JE when a reversal is emitted against it.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'ReversedByJournalEntryID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Batch that locked this JE (set when Status transitions to Batched).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'BatchID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the ERP acknowledged the consolidated batch (Status transitions to GLPosted).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'GLPostedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'ERP''s reference back to us for this JE (within the consolidated batch posting).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'GLReferenceID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Optional attached source document (vendor bill PDF, signed contract, supporting workpaper). FK to __mj.File.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'FileID';
GO

---------------------------------------------------------------------------
-- 6.14 JournalEntryLine
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A debit or credit line under a JournalEntry. Exactly one of DebitAmount/CreditAmount is set per row (CK_JEL_OneSide). Multi-currency aware: OriginalCurrencyCode/OriginalDebit/OriginalCredit/ExchangeRateUsed capture the source-transaction currency when different from the Company''s functional currency.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Parent JournalEntry.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'JournalEntryID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'1-based ordering of lines within the parent JE.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'LineNumber';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'GLAccount this line posts to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'GLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Debit amount in the Company''s FUNCTIONAL currency. Mutually exclusive with CreditAmount (CK_JEL_OneSide).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'DebitAmount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Credit amount in the Company''s FUNCTIONAL currency. Mutually exclusive with DebitAmount.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'CreditAmount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'ISO 4217 code of the SOURCE-transaction currency (the customer-facing one). NULL when the source is already the functional currency.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'OriginalCurrencyCode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Debit amount in the original currency (paired with OriginalCurrencyCode + ExchangeRateUsed).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'OriginalDebitAmount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Credit amount in the original currency.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'OriginalCreditAmount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Exchange rate (functional per 1 original) used at booking time. Required when an original amount is present.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'ExchangeRateUsed';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Free-form description of the line (memo).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'Description';
GO

---------------------------------------------------------------------------
-- 6.15 JournalEntryLineDimension
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Many-to-many between JournalEntryLine and (Dimension, DimensionValue). Optional — lines without any dimension rows are simply un-tagged. Reports filter and group by dimension via this table.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLineDimension';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLineDimension', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'JE line being tagged.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLineDimension', @level2type = N'COLUMN', @level2name = N'JournalEntryLineID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Dimension being applied. UNIQUE per (Line, Dimension) so a line cannot have two values for the same dimension.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLineDimension', @level2type = N'COLUMN', @level2name = N'DimensionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Value chosen for the dimension on this line.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLineDimension', @level2type = N'COLUMN', @level2name = N'DimensionValueID';
GO

---------------------------------------------------------------------------
-- 6.17 TaxLiability
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Open tax liability balance per (Company × Authority × Jurisdiction × Period). Accrued from JE postings; remitted to the authority in the ERP (no remittance table here — ERP/GL concern).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company this liability belongs to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'TaxAuthority owed.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'TaxAuthorityID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'TaxJurisdiction the liability is scoped to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'TaxJurisdictionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Total tax accrued during the period (in functional currency).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'AccruedAmount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Total amount remitted against this liability so far.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'RemittedAmount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Lifecycle: Open | Filed | Paid | PartiallyPaid.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'Status';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Statutory due date for filing/remittance.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'DueDate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Filing cadence: Monthly | Quarterly | SemiAnnual | Annual | OnDemand.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'FilingFrequency';
GO

---------------------------------------------------------------------------
-- (6.18 TaxRemittance descriptions removed with the table — see the 2.18 note.)
---------------------------------------------------------------------------
GO

---------------------------------------------------------------------------
-- 6.19 CompanyTaxNexus (replaces CustomerTaxProfile, BA-D29)
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Where THIS company must collect tax. Nexus is a property of our own legal entity''s registrations, which is why it lives with Company rather than with the order. The mirror question - whether a BUYER is exempt - is CustomerTaxExemption in bizapps-orders. Both must hold to charge: the seller has nexus AND the buyer is not exempt AND the product is taxable there.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CompanyTaxNexus';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The legal entity with the obligation.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CompanyTaxNexus', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The jurisdiction it must collect for.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CompanyTaxNexus', @level2type = N'COLUMN', @level2name = N'TaxJurisdictionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'WHY the obligation exists: Economic (crossed a revenue or transaction threshold), Physical (people, property or inventory in the state), Marketplace (a facilitator law attributes it) or Voluntary (registered without being required).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CompanyTaxNexus', @level2type = N'COLUMN', @level2name = N'NexusType';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The permit or registration number issued by the jurisdiction.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CompanyTaxNexus', @level2type = N'COLUMN', @level2name = N'RegistrationNumber';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the registration took effect.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CompanyTaxNexus', @level2type = N'COLUMN', @level2name = N'RegisteredFrom';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the REGISTRATION ended - not when the activity stopped. Registration is a one-way door: you must keep filing, including zero returns, until the account is formally closed, and a state will not close one with open periods.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CompanyTaxNexus', @level2type = N'COLUMN', @level2name = N'RegisteredTo';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the duty to COLLECT ends, which routinely outlasts the activity that created it. California holds a seller through the nexus year plus the whole following calendar year; Colorado, Washington, Wisconsin, Iowa and Michigan through the following calendar year; Texas until twelve consecutive months below the threshold. Separate from RegisteredTo because collapsing the two would end the obligation early.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CompanyTaxNexus', @level2type = N'COLUMN', @level2name = N'ObligationEndsAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Active | Inactive. A closed registration is retained rather than deleted - it is the evidence of what was true during an audited period.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CompanyTaxNexus', @level2type = N'COLUMN', @level2name = N'Status';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Free-text note, typically the nexus study or ruling that established the obligation.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CompanyTaxNexus', @level2type = N'COLUMN', @level2name = N'Comments';
GO

---------------------------------------------------------------------------
-- 6.24 GLAccountRole (new 2026-07-06, AM-2)
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The JOB a GL account plays for a linked record (Cash, Accounts Receivable, Inventory, Cost of Goods Sold, Sales, Sales Discounts, Sales Returns and Allowances, Deferred Revenue). Lookup table so roles are additive at runtime; seeded via metadata sync (metadata/gl-account-roles), never SQL. AM-2.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountRole';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display name of the role; unique.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountRole', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What entries this role is used for and any guidance for pickers.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountRole', @level2type = N'COLUMN', @level2name = N'Description';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Active roles are offered in pickers; Inactive roles are retained for history but not selectable.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountRole', @level2type = N'COLUMN', @level2name = N'Status';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Intentional display order in pickers (ascending).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountRole', @level2type = N'COLUMN', @level2name = N'Sequence';
GO

---------------------------------------------------------------------------
-- 6.25 GLAccountLink (new 2026-07-06, AM-5)
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Polymorphic, role-based, date-effective mapping from ANY record (Company defaults, Product Category, Product, future types) to a GL account. Replaces the ProductGLAccount / ProductCategoryGLAccount / AccountingCompanyProfileGLAccount trio (AM-5). Resolution filters Status=Active and StartedAt/EndedAt covering the as-of date; the caller (e.g. the Orders resolver) walks product -> category tree -> company default.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLink';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The GL account this link maps its target record to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLink', @level2type = N'COLUMN', @level2name = N'GLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The role the account plays for the target record (Sales, AR, ...). Assumed correction OQ-G: absent from the 07-03 field list but required to tell a record''s Revenue link from its AR link.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLink', @level2type = N'COLUMN', @level2name = N'GLAccountRoleID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Polymorphic reference part 1: the MJ Entity of the target record (references __mj.Entity). Same TaggedItem-style pattern as JournalEntry.LinkedEntityID/LinkedRecordID (plan D25).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLink', @level2type = N'COLUMN', @level2name = N'EntityID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Polymorphic reference part 2: the target record''s primary key (NVARCHAR(400) supports stringified composite keys).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLink', @level2type = N'COLUMN', @level2name = N'RecordID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Pending = entered but not yet in force; Active = used by resolution; Disabled = ignored.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLink', @level2type = N'COLUMN', @level2name = N'Status';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Start of the date-effective window (NULL = open start). Enables Amith''s "new chart of accounts effective Aug 1" pre-entry: resolution flips automatically on the date; historical JEs are never touched.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLink', @level2type = N'COLUMN', @level2name = N'StartedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'End of the date-effective window (NULL = open end).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLink', @level2type = N'COLUMN', @level2name = N'EndedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Free-text note on why this mapping exists / changed.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLink', @level2type = N'COLUMN', @level2name = N'Comments';
GO

---------------------------------------------------------------------------
-- 6.26 GLAccountLinkDimension (new 2026-07-06, AM-5)
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Which analytical Dimensions apply to journal-entry lines resolved through a GLAccountLink, in display order. Carries the Dimension only — VALUES are supplied from the calling context at entry-build time (OQ-I).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLinkDimension';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The link this dimension requirement belongs to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLinkDimension', @level2type = N'COLUMN', @level2name = N'GLAccountLinkID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The Dimension that applies (validate-only vocabulary — never invented here).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLinkDimension', @level2type = N'COLUMN', @level2name = N'DimensionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Ordering of the dimensions for this link (ascending).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccountLinkDimension', @level2type = N'COLUMN', @level2name = N'Sequence';
GO

---------------------------------------------------------------------------
-- 6.28 IntercompanyAccountMatch (new 2026-07-26, BA-D26)
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The Due To / Due From GL account pair for an ORDERED company pair. Read a row as: Source collected cash on Target''s behalf, so Source owes Target. Money flowing the other way is a separate row with the companies swapped, because the two directions routinely use different accounts. Date-effective: resolution picks the Active row whose window covers the as-of date, latest StartedAt winning.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatch';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The company that COLLECTED the cash and therefore owes — the Due To liability sits on its books.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatch', @level2type = N'COLUMN', @level2name = N'SourceCompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The company that is OWED because it owns the line the cash settled — the Due From receivable sits on its books.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatch', @level2type = N'COLUMN', @level2name = N'TargetCompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The intercompany PAYABLE on the source company''s books. Must be a Liability account belonging to SourceCompanyID (enforced by trigger, not merely by convention: a backwards pair still balances).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatch', @level2type = N'COLUMN', @level2name = N'DueToGLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The intercompany RECEIVABLE on the target company''s books. Must be an Asset account belonging to TargetCompanyID.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatch', @level2type = N'COLUMN', @level2name = N'DueFromGLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Pending | Active | Disabled. Only Active rows resolve; a pair is never deleted once it has been used.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatch', @level2type = N'COLUMN', @level2name = N'Status';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Start of the effective window (inclusive). NULL means open-ended in the past.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatch', @level2type = N'COLUMN', @level2name = N'StartedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'End of the effective window (inclusive). NULL means open-ended. Supersede a mapping by closing this and adding a new row, never by editing history.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatch', @level2type = N'COLUMN', @level2name = N'EndedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Free-text note on why this mapping exists — typically the intercompany agreement it implements.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatch', @level2type = N'COLUMN', @level2name = N'Comments';
GO

---------------------------------------------------------------------------
-- 6.29 IntercompanyAccountMatchDimension (new 2026-07-26, BA-D26)
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The analytical Dimensions, and optionally their fixed VALUES, to stamp on each leg of an intercompany pair. Unlike GLAccountLinkDimension this can pin a value, because an intercompany leg is raised to balance another company''s revenue and has no originating record to read a value from.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatchDimension';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The account pair this dimension requirement belongs to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatchDimension', @level2type = N'COLUMN', @level2name = N'IntercompanyAccountMatchID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Which leg the requirement applies to: DueTo (source company''s liability) or DueFrom (target company''s receivable). The two legs sit on different companies'' books and routinely carry different values for the same Dimension.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatchDimension', @level2type = N'COLUMN', @level2name = N'Side';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The Dimension that applies (validate-only vocabulary — never invented here).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatchDimension', @level2type = N'COLUMN', @level2name = N'DimensionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Optional fixed value to stamp. NULL keeps the GLAccountLink behaviour of taking the value from the calling context. Must belong to DimensionID (enforced by trigger).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatchDimension', @level2type = N'COLUMN', @level2name = N'DimensionValueID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Ordering of the dimensions for this side (ascending).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyAccountMatchDimension', @level2type = N'COLUMN', @level2name = N'Sequence';
GO

---------------------------------------------------------------------------
-- 6.27 JournalEntryBatch new columns + sequences (2026-07-06)
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When a human approved the batch for dispatch (locks its content; the new Approved status).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ApprovedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The user who approved the batch (see AccountingCompanyProfile.ApprovalCFOUserID / the bizapps-tasks approval gate).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ApprovedByUserID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the ERP confirmed it posted the batch (Status=Posted; renames the old AcknowledgedAt).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'PostedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'PER-COMPANY per-fiscal-year counter backing gap-free JournalEntry numbering JE-{CompanyCode}-{FY}-{seq} (plan D19). Consumed only by spAssignNextJournalEntryNumber.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntrySequence';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'GLOBAL singleton counter backing gap-free JournalEntryBatch numbering (plan D19: batch numbering stays global). One row, ID = 1. Consumed only by spAssignNextBatchNumber.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchSequence';
GO

---------------------------------------------------------------------------
-- 6.28 Columns added by the 2026-07-22 plan rewrite
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The single company this journal entry belongs to (plan D3). Every line''s GLAccount must belong to this company (trigger-enforced).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The single company this batch belongs to (plan D7). One batch per company per run; the batch gathers ONLY this company''s Pending JEs.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Singular, accountant-set posting date chosen at batch build (plan D8). Carried to the GL''s posting date and must match between systems; drives the ERP period. Document dates stay informational.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'PostingDate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The aggregated summary JournalEntry (its JournalEntryType flagged IsBatchSummary, EffectiveDate=PostingDate) that posts to the GL for this batch (plan D9). Its lines net debits/credits per GLAccount x dimension-combo. The summary carries this batch''s BatchID (same derived lock machinery as members) but is excluded from member/netting/sweep queries via its type''s IsBatchSummary flag.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'SummaryJournalEntryID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The bizapps-tasks approval Task raised for this batch (plan D10). NO FK by design (cross-app); stamped together with ApprovalTaskRaisedAt in the task-raise transaction (both-or-neither CHECK). NULL = task not yet raised (retryable state).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ApprovalTaskID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the approval task was raised; set together with ApprovalTaskID (both-or-neither CHECK).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ApprovalTaskRaisedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The CFO (an __mj.User — a security identity) who must approve a Journal Entry Batch for this company before it dispatches to the ERP. Resolved by the bizapps-tasks approval gate. Nullable: companies without a configured CFO fall back to the role-based resolver.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'ApprovalCFOUserID';
GO

-- =============================================================================
-- End of hand-authored DDL.
--
-- NOTE: CodeGen output is appended BELOW the banner at the end of this file.
-- After a clean-DB migrate, run CodeGen against this schema to (re)create the
-- MJ entity metadata, base views, CRUD sprocs, and permissions, then run
-- scripts/append-codegen.sh to put it back. The PostgreSQL counterpart is
-- produced via @memberjunction/sql-converter (see migrations-pg/README.md).
-- =============================================================================


-- MANUAL UPDATE OF SCHEMA INFO from metadata file to ensure we have things set for the codegeneration
INSERT INTO __mj.SchemaInfo 
(
  ID,
  SchemaName,
  EntityIDMin, EntityIDMax,
  Comments,
  Description,
  EntityNamePrefix, EntityNameSuffix
)
VALUES
(
  '7F2F85AF-0DCF-4DF3-939A-38EA459AC820',
  '__mj_BizAppsAccounting',
  1, 1000000,
  NULL,
  'MemberJunction: Accounting Business App Data',
  'MJ_BizApps_Accounting: ', NULL
)

GO


-- =============================================================================
-- (Read-model reporting views REMOVED 2026-07-22 per Amith: "way overdone and
--  not needed... we can come back to that later as needed, we probably will not."
--  The former Block 6 vw_* views live in git history if ever wanted.)
-- =============================================================================

-- =============================================================================
-- END OF HAND-AUTHORED BASELINE (2026-07-06 revision).

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE
-- =============================================================================
-- Everything above is hand-authored DDL. Everything below is CodeGen's output
-- (MJ entity + field metadata, base views, CRUD sprocs, permissions, FK
-- indexes) and is what makes a fresh `mj migrate` produce a WORKING database
-- rather than bare tables.
--
-- REGENERATE, NEVER HAND-EDIT below this line:
--   scripts/rebuild-db.sh          # clean DB -> MJ core -> common -> this app
--   npm run mj:codegen             # regenerate into migrations/codegen/
--   scripts/append-codegen.sh      # replace everything below this banner
--   npm run mj -- sync push --dir metadata
--
-- The PostgreSQL counterpart is produced via @memberjunction/sql-converter
-- (see migrations-pg/README.md).
-- =============================================================================
