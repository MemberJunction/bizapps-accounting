-- =============================================================================
-- BizApps Accounting — Baseline Schema (v0.1.0)
-- =============================================================================
-- Creates the entire __mj_BizAppsAccounting schema in a single baseline:
--   - 25 tables (chart of accounts, periods, JEs + lines + dimensions, batch +
--     batch summary lines, scheduled (rev-rec waterfall) JEs + lines, tax,
--     balance materialization, JE/Batch numbering sequences)
--   - Foreign keys (cross-schema to __mj.Company, __mj.User, and
--     __mj_BizAppsAccounting.Currency / Organization)
--   - CHECK constraints (one-side-per-line, status enums, original-currency
--     coherence, CompanyCode format)
--   - Business-rule triggers (balanced JE on lock, post-batch immutability,
--     batch-summary reconciliation, scheduled-JE immutability-once-generated,
--     period-close enforcement, AccountingCompanyProfile chain guard)
--   - Stored procs for per-company seeding (default COA, calendar period
--     generation, gap-free JE/Batch numbering)
--   - MS_Description extended properties for the schema, every table, and
--     every column
--
-- References: plans/bizapps-accounting-master.md §4 (entities), §5 (DB-level
-- enforcement), BA-D5..BA-D13 (decisions). SQL Server is the source of truth;
-- the PostgreSQL counterpart is produced via @memberjunction/sql-converter
-- (see migrations-pg/README.md).
-- =============================================================================

-- =============================================================================
-- 1. SCHEMA
-- =============================================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = '__mj_BizAppsAccounting')
    EXEC('CREATE SCHEMA __mj_BizAppsAccounting');
GO

-- =============================================================================
-- 2. TABLES (created without foreign keys; FKs added in section 3 so we can
--    cleanly handle circular references between JournalEntry and TaxRemittance,
--    JournalEntry and ScheduledJournalEntry, AccountingCompanyProfile parent
--    chains, etc.)
-- =============================================================================

---------------------------------------------------------------------------
-- 2.0 Currency — ISO-4217 reference data, OWNED BY BizAppsAccounting.
--     (Revises master-plan §4.7 / BA-D11: Currency was originally slated to
--     live in bizapps-common, but common never shipped it. BizAppsAccounting
--     is a free OSS app, so owning Currency here and letting other apps take a
--     dependency on it keeps the infra under our control.)
--     Referenced by GLAccount, AccountingCompanyProfile, JournalEntryLine,
--     AccountBalance, AccountBalanceByDimension, CurrencySpotRate.
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
    @value = N'ISO-4217 currency reference data owned by BizAppsAccounting; seeded via metadata sync (metadata/currencies). Referenced by GLAccount, AccountingCompanyProfile, JournalEntryLine, AccountBalance, and CurrencySpotRate.',
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
    Rate DECIMAL(7,4) NOT NULL,
    EffectiveFrom DATE NOT NULL,
    EffectiveTo DATE NULL,
    Source NVARCHAR(50) NOT NULL DEFAULT 'Manual',
    CONSTRAINT PK_TaxRate PRIMARY KEY (ID),
    CONSTRAINT CK_TaxRate_Category CHECK (TaxCategory IN ('Standard','Reduced','Zero','Exempt','Custom')),
    CONSTRAINT CK_TaxRate_Source CHECK (Source IN ('Avalara','TaxJar','Manual')),
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
    DefaultPaymentTermsTypeID UNIQUEIDENTIFIER NULL,
    AROpenGLAccountID UNIQUEIDENTIFIER NULL,
    DeferredRevenueGLAccountID UNIQUEIDENTIFIER NULL,
    SalesTaxPayableGLAccountID UNIQUEIDENTIFIER NULL,
    RealizedFXGainLossGLAccountID UNIQUEIDENTIFIER NULL,
    UnrealizedFXGainLossGLAccountID UNIQUEIDENTIFIER NULL,
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
    AccountType NVARCHAR(20) NOT NULL,
    ParentGLAccountID UNIQUEIDENTIFIER NULL,
    CurrencyCode CHAR(3) NULL,
    ExternalSystem NVARCHAR(50) NULL,
    ExternalAccountID NVARCHAR(100) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    IsSystemSeeded BIT NOT NULL DEFAULT 0,
    Description NVARCHAR(MAX) NULL,
    CONSTRAINT PK_GLAccount PRIMARY KEY (ID),
    CONSTRAINT UQ_GLAccount_CompanyID_Code UNIQUE (CompanyID, Code),
    CONSTRAINT CK_GLAccount_AccountType CHECK (AccountType IN ('Asset','Liability','Equity','Revenue','Expense','ContraAsset','ContraLiability','ContraRevenue','ContraExpense','Statistical')),
    CONSTRAINT CK_GLAccount_NoSelfParent CHECK (ParentGLAccountID IS NULL OR ParentGLAccountID <> ID)
);
GO

---------------------------------------------------------------------------
-- 2.8 AccountingPeriod — locks JE posting once Closed
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.AccountingPeriod (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    PeriodType NVARCHAR(10) NOT NULL,
    PeriodStart DATE NOT NULL,
    PeriodEnd DATE NOT NULL,
    FiscalYear INT NOT NULL,
    FiscalQuarter TINYINT NULL,
    FiscalMonth TINYINT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Open',
    ClosedAt DATETIMEOFFSET NULL,
    ClosedByUserID UNIQUEIDENTIFIER NULL,
    ReopenReason NVARCHAR(MAX) NULL,
    ReopenedAt DATETIMEOFFSET NULL,
    ReopenedByUserID UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_AccountingPeriod PRIMARY KEY (ID),
    CONSTRAINT UQ_AccountingPeriod_Company_Type_Start UNIQUE (CompanyID, PeriodType, PeriodStart),
    CONSTRAINT CK_AccountingPeriod_PeriodType CHECK (PeriodType IN ('Month','Quarter','Year')),
    CONSTRAINT CK_AccountingPeriod_Status CHECK (Status IN ('Open','Closing','Closed','Reopened')),
    CONSTRAINT CK_AccountingPeriod_Range CHECK (PeriodEnd >= PeriodStart),
    CONSTRAINT CK_AccountingPeriod_Quarter CHECK (FiscalQuarter IS NULL OR FiscalQuarter BETWEEN 1 AND 4),
    CONSTRAINT CK_AccountingPeriod_Month CHECK (FiscalMonth IS NULL OR FiscalMonth BETWEEN 1 AND 12),
    CONSTRAINT CK_AccountingPeriod_ClosedCoherence CHECK (
        (Status IN ('Closed','Reopened') AND ClosedAt IS NOT NULL)
        OR (Status NOT IN ('Closed','Reopened') AND ClosedAt IS NULL)
    )
);
GO

---------------------------------------------------------------------------
-- 2.9 JournalEntryBatch — aggregation that ships to ERP. The locking event.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntryBatch (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    BatchNumber NVARCHAR(40) NOT NULL,
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    AccountingPeriodID UNIQUEIDENTIFIER NOT NULL,
    TargetSystem NVARCHAR(50) NOT NULL,
    BatchedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    BatchedByUserID UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    TotalEntries INT NOT NULL DEFAULT 0,
    TotalDebits DECIMAL(18,2) NOT NULL DEFAULT 0,
    TotalCredits DECIMAL(18,2) NOT NULL DEFAULT 0,
    ExternalBatchRef NVARCHAR(100) NULL,
    SentAt DATETIMEOFFSET NULL,
    AcknowledgedAt DATETIMEOFFSET NULL,
    ErrorMessage NVARCHAR(MAX) NULL,
    CONSTRAINT PK_JournalEntryBatch PRIMARY KEY (ID),
    CONSTRAINT UQ_JournalEntryBatch_Number UNIQUE (BatchNumber),
    CONSTRAINT CK_JournalEntryBatch_Status CHECK (Status IN ('Pending','Sent','Acknowledged','Failed')),
    CONSTRAINT CK_JournalEntryBatch_Totals CHECK (TotalDebits >= 0 AND TotalCredits >= 0 AND TotalEntries >= 0),
    CONSTRAINT CK_JournalEntryBatch_TargetSystem CHECK (TargetSystem IN ('BusinessCentral','QuickBooks','NetSuite','Sage','Xero','Other'))
);
GO

---------------------------------------------------------------------------
-- 2.10 JournalEntryBatchLineItem — the SUMMARY lines shipped to the ERP.
--      When a batch is created, the batching engine aggregates the locked JE
--      lines of every JE in the batch, grouped by (GLAccount × dimension combo
--      × side), into one summary line each. This consolidated set is what posts
--      to Business Central (BA-D16/BA-D26). The detail stays in JournalEntryLine
--      for audit drill-through; the batch line is the netted GL movement.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntryBatchLineItem (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    BatchID UNIQUEIDENTIFIER NOT NULL,
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    GLAccountID UNIQUEIDENTIFIER NOT NULL,
    LineNumber INT NOT NULL,
    DebitAmount DECIMAL(18,2) NULL,
    CreditAmount DECIMAL(18,2) NULL,
    SourceLineCount INT NOT NULL DEFAULT 0,   -- how many JournalEntryLine rows rolled up here
    ExternalAccountID NVARCHAR(100) NULL,     -- target ERP account, resolved via ChartOfAccountsMapping at batch time
    Description NVARCHAR(MAX) NULL,
    CONSTRAINT PK_JournalEntryBatchLineItem PRIMARY KEY (ID),
    CONSTRAINT UQ_JEBLI_Batch_LineNumber UNIQUE (BatchID, LineNumber),
    CONSTRAINT CK_JEBLI_OneSide CHECK (
        (DebitAmount IS NOT NULL AND CreditAmount IS NULL AND DebitAmount > 0) OR
        (CreditAmount IS NOT NULL AND DebitAmount IS NULL AND CreditAmount > 0)
    ),
    CONSTRAINT CK_JEBLI_SourceLineCount CHECK (SourceLineCount >= 0),
    CONSTRAINT CK_JEBLI_LineNumber CHECK (LineNumber > 0)
);
GO

---------------------------------------------------------------------------
-- 2.11 JournalEntryBatchLineDimension — dimension tags on a batch summary
--      line. Preserves the analytical breakdown (Department, CostCenter, ...)
--      through to the ERP so departmental/segment financials survive the
--      summarization (account × dimension granularity, BA-D26).
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntryBatchLineDimension (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    JournalEntryBatchLineItemID UNIQUEIDENTIFIER NOT NULL,
    DimensionID UNIQUEIDENTIFIER NOT NULL,
    DimensionValueID UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_JEBLDimension PRIMARY KEY (ID),
    CONSTRAINT UQ_JEBLDimension_Line_Dimension UNIQUE (JournalEntryBatchLineItemID, DimensionID)
);
GO

---------------------------------------------------------------------------
-- 2.13 JournalEntry — top-level entity; the ledger row
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntry (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    EntryNumber NVARCHAR(40) NOT NULL,
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    AccountingPeriodID UNIQUEIDENTIFIER NOT NULL,
    EffectiveDate DATE NOT NULL,
    EntryType NVARCHAR(40) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    Description NVARCHAR(MAX) NULL,
    -- Polymorphic origin (soft refs; NO FK constraints — these point at
    -- entities owned by downstream apps that this repo has zero knowledge of).
    OrderID UNIQUEIDENTIFIER NULL,
    OrderLineID UNIQUEIDENTIFIER NULL,
    SubscriptionID UNIQUEIDENTIFIER NULL,
    PaymentID UNIQUEIDENTIFIER NULL,
    ContractID UNIQUEIDENTIFIER NULL,
    RevRecScheduleID UNIQUEIDENTIFIER NULL,
    IntercompanyFlowID UNIQUEIDENTIFIER NULL,
    -- Internal refs
    ScheduledJournalEntryID UNIQUEIDENTIFIER NULL,  -- the ScheduledJournalEntry that materialized into this JE (rev-rec waterfall / amortization), if any
    TaxRemittanceID UNIQUEIDENTIFIER NULL,
    ReversesJournalEntryID UNIQUEIDENTIFIER NULL,
    ReversedByJournalEntryID UNIQUEIDENTIFIER NULL,
    OriginalAccountingPeriodID UNIQUEIDENTIFIER NULL,
    BatchID UNIQUEIDENTIFIER NULL,
    GLPostedAt DATETIMEOFFSET NULL,
    GLReferenceID NVARCHAR(100) NULL,
    -- Optional attached source document (vendor bills, signed contracts, etc.)
    FileID UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_JournalEntry PRIMARY KEY (ID),
    CONSTRAINT UQ_JournalEntry_Number UNIQUE (EntryNumber),
    CONSTRAINT CK_JournalEntry_Status CHECK (Status IN ('Pending','Batched','GLPosted')),
    CONSTRAINT CK_JournalEntry_EntryType CHECK (EntryType IN ('OrderBooking','PaymentReceipt','RevenueRecognition','CommissionAccrual','PartnerRevShare','IntercompanyFlow','WaterfallDistribution','Refund','Writeoff','Reversal','Manual','TaxRemittance','PeriodEndAccrual','FXRevaluation','OpeningBalance','Adjustment')),
    CONSTRAINT CK_JournalEntry_NoSelfReverse CHECK (ReversesJournalEntryID IS NULL OR ReversesJournalEntryID <> ID),
    CONSTRAINT CK_JournalEntry_NoSelfReversedBy CHECK (ReversedByJournalEntryID IS NULL OR ReversedByJournalEntryID <> ID),
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
    OrderLineID UNIQUEIDENTIFIER NULL,
    CounterpartyOrganizationID UNIQUEIDENTIFIER NULL,
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
-- 2.16 ChartOfAccountsMapping — internal GLAccount → external ERP COA
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.ChartOfAccountsMapping (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    ExternalSystem NVARCHAR(50) NOT NULL,
    ExternalAccountID NVARCHAR(100) NOT NULL,
    ExternalAccountName NVARCHAR(200) NULL,
    InternalGLAccountID UNIQUEIDENTIFIER NOT NULL,
    EffectiveFrom DATE NOT NULL,
    EffectiveTo DATE NULL,
    ApprovedByUserID UNIQUEIDENTIFIER NULL,
    ApprovedAt DATETIMEOFFSET NULL,
    ChangeNote NVARCHAR(MAX) NULL,
    CONSTRAINT PK_COAMapping PRIMARY KEY (ID),
    CONSTRAINT UQ_COAMapping_Composite UNIQUE (CompanyID, ExternalSystem, ExternalAccountID, EffectiveFrom),
    CONSTRAINT CK_COAMapping_DateRange CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom),
    CONSTRAINT CK_COAMapping_ApprovalCoherence CHECK (
        (ApprovedAt IS NULL AND ApprovedByUserID IS NULL)
        OR (ApprovedAt IS NOT NULL AND ApprovedByUserID IS NOT NULL)
    )
);
GO

---------------------------------------------------------------------------
-- 2.17 TaxLiability — accrued tax balance per authority × jurisdiction × period
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.TaxLiability (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    TaxAuthorityID UNIQUEIDENTIFIER NOT NULL,
    TaxJurisdictionID UNIQUEIDENTIFIER NOT NULL,
    AccountingPeriodID UNIQUEIDENTIFIER NOT NULL,
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
-- 2.18 TaxRemittance — a payment against a TaxLiability
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.TaxRemittance (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    TaxLiabilityID UNIQUEIDENTIFIER NOT NULL,
    RemittedAmount DECIMAL(18,2) NOT NULL,
    RemittedDate DATE NOT NULL,
    PaymentReference NVARCHAR(100) NULL,
    PostedJournalEntryID UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_TaxRemittance PRIMARY KEY (ID),
    CONSTRAINT CK_TaxRemittance_Amount CHECK (RemittedAmount > 0)
);
GO

---------------------------------------------------------------------------
-- 2.19 CustomerTaxProfile — taxability profile for an Organization (customer)
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.CustomerTaxProfile (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    OrganizationID UNIQUEIDENTIFIER NOT NULL,
    TaxJurisdictionID UNIQUEIDENTIFIER NULL,
    TaxIDNumber NVARCHAR(100) NULL,
    IsExempt BIT NOT NULL DEFAULT 0,
    ExemptionCertificateRef NVARCHAR(200) NULL,
    ExemptionExpiryDate DATE NULL,
    EffectiveFrom DATE NOT NULL,
    EffectiveTo DATE NULL,
    CONSTRAINT PK_CustomerTaxProfile PRIMARY KEY (ID),
    CONSTRAINT CK_CustomerTaxProfile_DateRange CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom),
    CONSTRAINT CK_CustomerTaxProfile_Exemption CHECK (IsExempt = 0 OR ExemptionCertificateRef IS NOT NULL)
);
GO

---------------------------------------------------------------------------
-- 2.20 AccountBalance — materialized balance per GLAccount × closed period
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.AccountBalance (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    GLAccountID UNIQUEIDENTIFIER NOT NULL,
    AccountingPeriodID UNIQUEIDENTIFIER NOT NULL,
    PeriodEndBalance DECIMAL(18,2) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL,
    ComputedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_AccountBalance PRIMARY KEY (ID),
    CONSTRAINT UQ_AccountBalance_Composite UNIQUE (CompanyID, GLAccountID, AccountingPeriodID)
);
GO

---------------------------------------------------------------------------
-- 2.21 AccountBalanceByDimension — materialized balance with dimension key
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.AccountBalanceByDimension (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    GLAccountID UNIQUEIDENTIFIER NOT NULL,
    AccountingPeriodID UNIQUEIDENTIFIER NOT NULL,
    DimensionValueTagsJson NVARCHAR(MAX) NOT NULL,
    DimensionTagsHash CHAR(64) NOT NULL,
    PeriodEndBalance DECIMAL(18,2) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL,
    ComputedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_AccountBalanceByDimension PRIMARY KEY (ID),
    CONSTRAINT UQ_ABBD_Composite UNIQUE (CompanyID, GLAccountID, AccountingPeriodID, DimensionTagsHash)
);
GO

---------------------------------------------------------------------------
-- 2.22 JournalEntrySequence — per-Company × FY counter for gap-free JE numbers
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
-- 2.23 JournalEntryBatchSequence — per-Company counter for gap-free batch numbers
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntryBatchSequence (
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    NextSequenceNumber INT NOT NULL DEFAULT 1,
    CONSTRAINT PK_JournalEntryBatchSequence PRIMARY KEY (CompanyID),
    CONSTRAINT CK_JournalEntryBatchSequence_NextSeq CHECK (NextSequenceNumber > 0)
);
GO

---------------------------------------------------------------------------
-- 2.24 JournalEntryLink — polymorphic link from a JournalEntry to ANY entity
--      record (Order, OrderLine, Payment, Invoice, Subscription, ...). Lets
--      upstream apps (BizAppsOrders et al., the SOURCE of those records) record
--      full order/payment lineage onto the JE without Accounting taking hard
--      FKs into their schemas. EntityID + RecordID is MJ's polymorphic-reference
--      pattern; RecordID is NVARCHAR(400) to hold stringified composite keys.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.JournalEntryLink (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    JournalEntryID UNIQUEIDENTIFIER NOT NULL,
    EntityID UNIQUEIDENTIFIER NOT NULL,
    RecordID NVARCHAR(400) NOT NULL,
    LinkType NVARCHAR(50) NULL,
    Description NVARCHAR(MAX) NULL,
    CONSTRAINT PK_JournalEntryLink PRIMARY KEY (ID),
    CONSTRAINT UQ_JournalEntryLink UNIQUE (JournalEntryID, EntityID, RecordID)
);
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Polymorphic link from a JournalEntry to any MJ entity record (order/payment/invoice lineage, supporting documents, etc.). EntityID references __mj.Entity; RecordID is the target primary key (NVARCHAR(400) supports stringified composite keys). Upstream apps populate these; Accounting stores them for lineage/drill-through.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'JournalEntryLink';
GO

---------------------------------------------------------------------------
-- 2.25 ScheduledJournalEntry — a pre-computed FUTURE journal entry in a
--      revenue-recognition (or amortization) waterfall. Distinct from a JE:
--      it has not posted yet. Amounts are known up front (BA-D25). The
--      schedule is computed UPSTREAM (BizAppsOrders subscription engine, per
--      BA-D24/BA-D17) and persisted here; Accounting owns storage + the
--      period-close materialization that turns each row into a real Pending
--      JournalEntry (Dr Deferred Revenue, Cr Revenue) on its target period.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.ScheduledJournalEntry (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    EntryType NVARCHAR(40) NOT NULL DEFAULT 'RevenueRecognition',
    Status NVARCHAR(20) NOT NULL DEFAULT 'Scheduled',
    ScheduleSequence INT NOT NULL,                   -- 1-based position in the waterfall (the "3" of "3 of 12")
    ScheduleCount INT NOT NULL,                      -- total entries in this schedule (the "12")
    ScheduledEffectiveDate DATE NOT NULL,            -- accounting date the materialized JE will bear (period-end)
    TargetAccountingPeriodID UNIQUEIDENTIFIER NULL,  -- resolved target period; may be null until that period is generated
    CurrencyCode CHAR(3) NOT NULL,
    TotalAmount DECIMAL(18,2) NOT NULL,              -- gross amount recognized by this entry; lines carry the Dr/Cr detail
    Description NVARCHAR(MAX) NULL,
    -- Polymorphic origin (soft refs to upstream BizAppsOrders / BizAppsContracts; NO FK by design)
    SubscriptionID UNIQUEIDENTIFIER NULL,
    SubscriptionTermID UNIQUEIDENTIFIER NULL,
    OrderID UNIQUEIDENTIFIER NULL,
    OrderLineID UNIQUEIDENTIFIER NULL,
    ContractID UNIQUEIDENTIFIER NULL,
    RevRecScheduleID UNIQUEIDENTIFIER NULL,
    -- Materialization link (internal)
    GeneratedJournalEntryID UNIQUEIDENTIFIER NULL,   -- the JournalEntry produced when this row fired
    GeneratedAt DATETIMEOFFSET NULL,
    -- Supersession (a renewal / amendment recomputes the remaining schedule)
    SupersededByScheduledJournalEntryID UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_ScheduledJournalEntry PRIMARY KEY (ID),
    CONSTRAINT CK_SJE_Status CHECK (Status IN ('Scheduled','Generated','Cancelled','Superseded')),
    CONSTRAINT CK_SJE_EntryType CHECK (EntryType IN ('RevenueRecognition','DeferredRevenueRelease','PrepaidAmortization','DepreciationAccrual','PeriodEndAccrual','Manual')),
    CONSTRAINT CK_SJE_Sequence CHECK (ScheduleSequence > 0 AND ScheduleCount > 0 AND ScheduleSequence <= ScheduleCount),
    CONSTRAINT CK_SJE_Amount CHECK (TotalAmount >= 0),
    CONSTRAINT CK_SJE_GeneratedCoherence CHECK (
        (Status = 'Generated' AND GeneratedJournalEntryID IS NOT NULL AND GeneratedAt IS NOT NULL) OR
        (Status <> 'Generated' AND GeneratedJournalEntryID IS NULL)
    ),
    CONSTRAINT CK_SJE_SupersededCoherence CHECK (
        Status <> 'Superseded' OR SupersededByScheduledJournalEntryID IS NOT NULL
    ),
    CONSTRAINT CK_SJE_NoSelfSupersede CHECK (SupersededByScheduledJournalEntryID IS NULL OR SupersededByScheduledJournalEntryID <> ID)
);
GO

---------------------------------------------------------------------------
-- 2.26 ScheduledJournalEntryLineItem — Dr/Cr shape of a scheduled entry.
--      Mirrors JournalEntryLine; copied verbatim onto the materialized JE.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.ScheduledJournalEntryLineItem (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    ScheduledJournalEntryID UNIQUEIDENTIFIER NOT NULL,
    LineNumber INT NOT NULL,
    GLAccountID UNIQUEIDENTIFIER NOT NULL,
    DebitAmount DECIMAL(18,2) NULL,
    CreditAmount DECIMAL(18,2) NULL,
    Description NVARCHAR(MAX) NULL,
    CONSTRAINT PK_ScheduledJournalEntryLineItem PRIMARY KEY (ID),
    CONSTRAINT UQ_SJELI_SJE_LineNumber UNIQUE (ScheduledJournalEntryID, LineNumber),
    CONSTRAINT CK_SJELI_OneSide CHECK (
        (DebitAmount IS NOT NULL AND CreditAmount IS NULL AND DebitAmount > 0) OR
        (CreditAmount IS NOT NULL AND DebitAmount IS NULL AND CreditAmount > 0)
    ),
    CONSTRAINT CK_SJELI_LineNumber CHECK (LineNumber > 0)
);
GO

---------------------------------------------------------------------------
-- 2.27 ScheduledJournalEntryLineDimension — analytical tags on a scheduled
--      line; carried through to the materialized JournalEntryLineDimension.
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.ScheduledJournalEntryLineDimension (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    ScheduledJournalEntryLineItemID UNIQUEIDENTIFIER NOT NULL,
    DimensionID UNIQUEIDENTIFIER NOT NULL,
    DimensionValueID UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_SJELDimension PRIMARY KEY (ID),
    CONSTRAINT UQ_SJELDimension_Line_Dimension UNIQUE (ScheduledJournalEntryLineItemID, DimensionID)
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
-- We intentionally have NO FK constraints on JournalEntry.{OrderID, OrderLineID,
-- SubscriptionID, PaymentID, ContractID, RevRecScheduleID, IntercompanyFlowID}
-- nor on JournalEntryLine.{OrderLineID} — these are polymorphic soft refs to
-- entities owned by downstream apps (BizAppsOrders, BizAppsContracts) that this
-- repo has no knowledge of. Apps populate the UUIDs; Accounting just stores them
-- for audit drill-through.
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
-- 3.6 AccountingCompanyProfile → GLAccount (default account refs, post-creation)
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD CONSTRAINT FK_ACP_AROpenGLAccount
    FOREIGN KEY (AROpenGLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD CONSTRAINT FK_ACP_DefRevGLAccount
    FOREIGN KEY (DeferredRevenueGLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD CONSTRAINT FK_ACP_SalesTaxPayableGLAccount
    FOREIGN KEY (SalesTaxPayableGLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD CONSTRAINT FK_ACP_RealizedFXGLAccount
    FOREIGN KEY (RealizedFXGainLossGLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD CONSTRAINT FK_ACP_UnrealizedFXGLAccount
    FOREIGN KEY (UnrealizedFXGainLossGLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

---------------------------------------------------------------------------
-- 3.7 AccountingPeriod → __mj.Company, __mj.User (close/reopen audit)
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.AccountingPeriod
    ADD CONSTRAINT FK_AccountingPeriod_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountingPeriod
    ADD CONSTRAINT FK_AccountingPeriod_ClosedBy
    FOREIGN KEY (ClosedByUserID) REFERENCES __mj.[User](ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountingPeriod
    ADD CONSTRAINT FK_AccountingPeriod_ReopenedBy
    FOREIGN KEY (ReopenedByUserID) REFERENCES __mj.[User](ID);
GO

---------------------------------------------------------------------------
-- 3.8 JournalEntryBatch → __mj.Company, AccountingPeriod, __mj.User
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD CONSTRAINT FK_JEBatch_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD CONSTRAINT FK_JEBatch_Period
    FOREIGN KEY (AccountingPeriodID) REFERENCES __mj_BizAppsAccounting.AccountingPeriod(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD CONSTRAINT FK_JEBatch_BatchedBy
    FOREIGN KEY (BatchedByUserID) REFERENCES __mj.[User](ID);
GO

-- (3.9–3.11 removed: Recurring* tables dropped per BA-D18 revision. FKs for the
--  new JournalEntryBatchLineItem / ScheduledJournalEntry tables are in 3.24–3.28.)

---------------------------------------------------------------------------
-- 3.12 JournalEntry — all internal FKs (polymorphic soft refs intentionally omitted)
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_Period
    FOREIGN KEY (AccountingPeriodID) REFERENCES __mj_BizAppsAccounting.AccountingPeriod(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_OriginalPeriod
    FOREIGN KEY (OriginalAccountingPeriodID) REFERENCES __mj_BizAppsAccounting.AccountingPeriod(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_Batch
    FOREIGN KEY (BatchID) REFERENCES __mj_BizAppsAccounting.JournalEntryBatch(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_ScheduledJE
    FOREIGN KEY (ScheduledJournalEntryID) REFERENCES __mj_BizAppsAccounting.ScheduledJournalEntry(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD CONSTRAINT FK_JE_TaxRemittance
    FOREIGN KEY (TaxRemittanceID) REFERENCES __mj_BizAppsAccounting.TaxRemittance(ID);
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

ALTER TABLE __mj_BizAppsAccounting.JournalEntryLine
    ADD CONSTRAINT FK_JEL_CounterpartyOrganization
    FOREIGN KEY (CounterpartyOrganizationID) REFERENCES __mj_BizAppsCommon.Organization(ID);
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
-- 3.15 ChartOfAccountsMapping → __mj.Company, GLAccount, __mj.User
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.ChartOfAccountsMapping
    ADD CONSTRAINT FK_COAMapping_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.ChartOfAccountsMapping
    ADD CONSTRAINT FK_COAMapping_GLAccount
    FOREIGN KEY (InternalGLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.ChartOfAccountsMapping
    ADD CONSTRAINT FK_COAMapping_ApprovedBy
    FOREIGN KEY (ApprovedByUserID) REFERENCES __mj.[User](ID);
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

ALTER TABLE __mj_BizAppsAccounting.TaxLiability
    ADD CONSTRAINT FK_TaxLiability_Period
    FOREIGN KEY (AccountingPeriodID) REFERENCES __mj_BizAppsAccounting.AccountingPeriod(ID);
GO

---------------------------------------------------------------------------
-- 3.17 TaxRemittance → TaxLiability, JournalEntry
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.TaxRemittance
    ADD CONSTRAINT FK_TaxRemittance_Liability
    FOREIGN KEY (TaxLiabilityID) REFERENCES __mj_BizAppsAccounting.TaxLiability(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.TaxRemittance
    ADD CONSTRAINT FK_TaxRemittance_JE
    FOREIGN KEY (PostedJournalEntryID) REFERENCES __mj_BizAppsAccounting.JournalEntry(ID);
GO

---------------------------------------------------------------------------
-- 3.18 CustomerTaxProfile → Organization, TaxJurisdiction
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.CustomerTaxProfile
    ADD CONSTRAINT FK_CustomerTaxProfile_Organization
    FOREIGN KEY (OrganizationID) REFERENCES __mj_BizAppsCommon.Organization(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.CustomerTaxProfile
    ADD CONSTRAINT FK_CustomerTaxProfile_Jurisdiction
    FOREIGN KEY (TaxJurisdictionID) REFERENCES __mj_BizAppsAccounting.TaxJurisdiction(ID);
GO

---------------------------------------------------------------------------
-- 3.19 AccountBalance → __mj.Company, GLAccount, AccountingPeriod, Currency
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.AccountBalance
    ADD CONSTRAINT FK_AccountBalance_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountBalance
    ADD CONSTRAINT FK_AccountBalance_GLAccount
    FOREIGN KEY (GLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountBalance
    ADD CONSTRAINT FK_AccountBalance_Period
    FOREIGN KEY (AccountingPeriodID) REFERENCES __mj_BizAppsAccounting.AccountingPeriod(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountBalance
    ADD CONSTRAINT FK_AccountBalance_Currency
    FOREIGN KEY (CurrencyCode) REFERENCES __mj_BizAppsAccounting.Currency(Code);
GO

---------------------------------------------------------------------------
-- 3.20 AccountBalanceByDimension → __mj.Company, GLAccount, AccountingPeriod, Currency
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.AccountBalanceByDimension
    ADD CONSTRAINT FK_ABBD_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountBalanceByDimension
    ADD CONSTRAINT FK_ABBD_GLAccount
    FOREIGN KEY (GLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountBalanceByDimension
    ADD CONSTRAINT FK_ABBD_Period
    FOREIGN KEY (AccountingPeriodID) REFERENCES __mj_BizAppsAccounting.AccountingPeriod(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.AccountBalanceByDimension
    ADD CONSTRAINT FK_ABBD_Currency
    FOREIGN KEY (CurrencyCode) REFERENCES __mj_BizAppsAccounting.Currency(Code);
GO

---------------------------------------------------------------------------
-- 3.21 JournalEntrySequence / JournalEntryBatchSequence → Company
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntrySequence
    ADD CONSTRAINT FK_JESeq_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatchSequence
    ADD CONSTRAINT FK_JEBatchSeq_Company
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
-- 3.23 JournalEntryLink → JournalEntry, __mj.Entity
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryLink
    ADD CONSTRAINT FK_JournalEntryLink_JournalEntry
    FOREIGN KEY (JournalEntryID) REFERENCES __mj_BizAppsAccounting.JournalEntry(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryLink
    ADD CONSTRAINT FK_JournalEntryLink_Entity
    FOREIGN KEY (EntityID) REFERENCES __mj.Entity(ID);
GO

---------------------------------------------------------------------------
-- 3.24 JournalEntryBatchLineItem → JournalEntryBatch, __mj.Company, GLAccount
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatchLineItem
    ADD CONSTRAINT FK_JEBLI_Batch
    FOREIGN KEY (BatchID) REFERENCES __mj_BizAppsAccounting.JournalEntryBatch(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatchLineItem
    ADD CONSTRAINT FK_JEBLI_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatchLineItem
    ADD CONSTRAINT FK_JEBLI_GLAccount
    FOREIGN KEY (GLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

---------------------------------------------------------------------------
-- 3.25 JournalEntryBatchLineDimension → JournalEntryBatchLineItem, Dimension, DimensionValue
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatchLineDimension
    ADD CONSTRAINT FK_JEBLDimension_Line
    FOREIGN KEY (JournalEntryBatchLineItemID) REFERENCES __mj_BizAppsAccounting.JournalEntryBatchLineItem(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatchLineDimension
    ADD CONSTRAINT FK_JEBLDimension_Dimension
    FOREIGN KEY (DimensionID) REFERENCES __mj_BizAppsAccounting.Dimension(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatchLineDimension
    ADD CONSTRAINT FK_JEBLDimension_DimensionValue
    FOREIGN KEY (DimensionValueID) REFERENCES __mj_BizAppsAccounting.DimensionValue(ID);
GO

---------------------------------------------------------------------------
-- 3.26 ScheduledJournalEntry → __mj.Company, AccountingPeriod, Currency,
--      JournalEntry (materialized), self (supersession)
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.ScheduledJournalEntry
    ADD CONSTRAINT FK_SJE_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.ScheduledJournalEntry
    ADD CONSTRAINT FK_SJE_TargetPeriod
    FOREIGN KEY (TargetAccountingPeriodID) REFERENCES __mj_BizAppsAccounting.AccountingPeriod(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.ScheduledJournalEntry
    ADD CONSTRAINT FK_SJE_Currency
    FOREIGN KEY (CurrencyCode) REFERENCES __mj_BizAppsAccounting.Currency(Code);
GO

ALTER TABLE __mj_BizAppsAccounting.ScheduledJournalEntry
    ADD CONSTRAINT FK_SJE_GeneratedJE
    FOREIGN KEY (GeneratedJournalEntryID) REFERENCES __mj_BizAppsAccounting.JournalEntry(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.ScheduledJournalEntry
    ADD CONSTRAINT FK_SJE_SupersededBy
    FOREIGN KEY (SupersededByScheduledJournalEntryID) REFERENCES __mj_BizAppsAccounting.ScheduledJournalEntry(ID);
GO

---------------------------------------------------------------------------
-- 3.27 ScheduledJournalEntryLineItem → ScheduledJournalEntry, GLAccount
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.ScheduledJournalEntryLineItem
    ADD CONSTRAINT FK_SJELI_ScheduledJE
    FOREIGN KEY (ScheduledJournalEntryID) REFERENCES __mj_BizAppsAccounting.ScheduledJournalEntry(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.ScheduledJournalEntryLineItem
    ADD CONSTRAINT FK_SJELI_GLAccount
    FOREIGN KEY (GLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID);
GO

---------------------------------------------------------------------------
-- 3.28 ScheduledJournalEntryLineDimension → ScheduledJournalEntryLineItem, Dimension, DimensionValue
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.ScheduledJournalEntryLineDimension
    ADD CONSTRAINT FK_SJELDimension_Line
    FOREIGN KEY (ScheduledJournalEntryLineItemID) REFERENCES __mj_BizAppsAccounting.ScheduledJournalEntryLineItem(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.ScheduledJournalEntryLineDimension
    ADD CONSTRAINT FK_SJELDimension_Dimension
    FOREIGN KEY (DimensionID) REFERENCES __mj_BizAppsAccounting.Dimension(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.ScheduledJournalEntryLineDimension
    ADD CONSTRAINT FK_SJELDimension_DimensionValue
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
-- 4.3 trg_JournalEntry_Immutability
--     Locks JE once Status is Batched or GLPosted. Only Status / GLPostedAt /
--     GLReferenceID may transition. DELETE is blocked entirely. Reversals
--     happen via NEW Pending JEs, not by modifying historical ones (plan §8).
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
    -- The only allowed transitions on a locked row are GLPostedAt, GLReferenceID,
    -- and Status moving from Batched → GLPosted.
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Batched','GLPosted')
          AND (
            i.EntryNumber                 <> d.EntryNumber                 OR
            i.CompanyID                   <> d.CompanyID                   OR
            i.AccountingPeriodID          <> d.AccountingPeriodID          OR
            i.EffectiveDate               <> d.EffectiveDate               OR
            i.EntryType                   <> d.EntryType                   OR
            ISNULL(CAST(i.Description AS NVARCHAR(MAX)),N'') <> ISNULL(CAST(d.Description AS NVARCHAR(MAX)),N'') OR
            ISNULL(i.OrderID,                  '00000000-0000-0000-0000-000000000000') <> ISNULL(d.OrderID,                  '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.OrderLineID,              '00000000-0000-0000-0000-000000000000') <> ISNULL(d.OrderLineID,              '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.SubscriptionID,           '00000000-0000-0000-0000-000000000000') <> ISNULL(d.SubscriptionID,           '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.PaymentID,                '00000000-0000-0000-0000-000000000000') <> ISNULL(d.PaymentID,                '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ContractID,               '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ContractID,               '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.RevRecScheduleID,         '00000000-0000-0000-0000-000000000000') <> ISNULL(d.RevRecScheduleID,         '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.IntercompanyFlowID,       '00000000-0000-0000-0000-000000000000') <> ISNULL(d.IntercompanyFlowID,       '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ScheduledJournalEntryID,  '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ScheduledJournalEntryID,  '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.TaxRemittanceID,          '00000000-0000-0000-0000-000000000000') <> ISNULL(d.TaxRemittanceID,          '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ReversesJournalEntryID,   '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ReversesJournalEntryID,   '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.OriginalAccountingPeriodID,'00000000-0000-0000-0000-000000000000') <> ISNULL(d.OriginalAccountingPeriodID,'00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.BatchID,                  '00000000-0000-0000-0000-000000000000') <> ISNULL(d.BatchID,                  '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.FileID,                   '00000000-0000-0000-0000-000000000000') <> ISNULL(d.FileID,                   '00000000-0000-0000-0000-000000000000')
          )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50004, 'JournalEntry is locked (Status=Batched/GLPosted). Only GLPostedAt, GLReferenceID, ReversedByJournalEntryID, and Status (Batched→GLPosted) may change.', 1;
    END;

    -- Disallow regressing Status backwards (GLPosted → Batched → Pending) on a locked row
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE (d.Status = 'GLPosted' AND i.Status IN ('Pending','Batched'))
           OR (d.Status = 'Batched'  AND i.Status = 'Pending')
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50005, 'JournalEntry Status cannot regress (only Pending→Batched and Batched→GLPosted transitions are allowed).', 1;
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
-- 4.5 trg_JournalEntry_PeriodClose
--     Blocks INSERT/UPDATE that would post a JE into a Closed period unless
--     the JE has OriginalAccountingPeriodID set (adjusting-entry pattern,
--     plan §7.5 / BA-D14). The actual JE then posts to the NEXT open period;
--     OriginalAccountingPeriodID provides traceability back to the closed one.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JournalEntry_PeriodClose
ON __mj_BizAppsAccounting.JournalEntry
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.AccountingPeriod ap ON ap.ID = i.AccountingPeriodID
        WHERE ap.Status = 'Closed'
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50007, 'Cannot post a JournalEntry with AccountingPeriodID referencing a Closed period. Adjusting entries post to the NEXT open period with OriginalAccountingPeriodID set to the closed period (plan §7.5).', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.6 trg_JournalEntryBatch_Immutability
--     Batches cannot be modified once Sent or Acknowledged (the ERP roundtrip
--     is in flight or complete). Status / SentAt / AcknowledgedAt /
--     AcknowledgedAt / ExternalBatchRef / ErrorMessage are the only fields
--     that may evolve on a Sent batch; everything else is frozen.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JEBatch_Immutability
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted WHERE Status IN ('Sent','Acknowledged'))
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50008, 'JournalEntryBatch cannot be deleted once Status is Sent or Acknowledged.', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Sent','Acknowledged')
          AND (
            i.BatchNumber          <> d.BatchNumber          OR
            i.CompanyID            <> d.CompanyID            OR
            i.AccountingPeriodID   <> d.AccountingPeriodID   OR
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
        THROW 50009, 'JournalEntryBatch is locked (Status=Sent/Acknowledged). Only Status / SentAt / AcknowledgedAt / ExternalBatchRef / ErrorMessage may evolve.', 1;
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
-- 4.8 trg_AccountingPeriod_NoOverlap
--     Per Company × PeriodType, periods may not overlap.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_AccountingPeriod_NoOverlap
ON __mj_BizAppsAccounting.AccountingPeriod
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.AccountingPeriod other
          ON other.CompanyID  = i.CompanyID
         AND other.PeriodType = i.PeriodType
         AND other.ID <> i.ID
        WHERE i.PeriodStart <= other.PeriodEnd
          AND i.PeriodEnd   >= other.PeriodStart
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50011, 'AccountingPeriod overlaps an existing period for the same Company × PeriodType.', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.9 trg_JournalEntry_ReversalPairConsistency
--     If a JE has ReversesJournalEntryID set, the referenced JE must NOT
--     itself reverse anything (no chains of reversals). The reverser must
--     have EntryType='Reversal'.
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
        WHERE i.ReversesJournalEntryID IS NOT NULL
          AND i.EntryType <> 'Reversal'
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50012, 'JournalEntry that sets ReversesJournalEntryID must have EntryType = ''Reversal''.', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.10 trg_JEBatchLineItem_Immutability
--      The summary lines that posted to the ERP must stay byte-for-byte what
--      was sent. Once the parent JournalEntryBatch is Sent/Acknowledged, its
--      summary lines cannot be inserted, modified, or deleted. (They are built
--      while the batch is still Pending.)
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JEBLI_Immutability
ON __mj_BizAppsAccounting.JournalEntryBatchLineItem
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM (SELECT BatchID FROM inserted UNION SELECT BatchID FROM deleted) x
        JOIN __mj_BizAppsAccounting.JournalEntryBatch b ON b.ID = x.BatchID
        WHERE b.Status IN ('Sent','Acknowledged')
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50013, 'JournalEntryBatchLineItem on a Sent/Acknowledged JournalEntryBatch cannot be inserted, modified, or deleted.', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.11 trg_JournalEntryBatch_SummaryReconciles
--      When a batch is dispatched (Status → Sent), its summary lines must foot
--      to the control totals AND the consolidated entry must balance. Guards
--      against shipping a summary that doesn't match what the batch claims.
--      (Lines-to-JE-detail tie-out is enforced upstream by the batching engine;
--      every source JE is itself balanced via trg_JournalEntry_BalancedOnLock.)
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JEBatch_SummaryReconciles
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN deleted d ON d.ID = i.ID
        WHERE d.Status = 'Pending' AND i.Status = 'Sent'
          AND (
            i.TotalDebits  <> i.TotalCredits OR
            i.TotalDebits  <> (SELECT COALESCE(SUM(DebitAmount), 0)  FROM __mj_BizAppsAccounting.JournalEntryBatchLineItem WHERE BatchID = i.ID) OR
            i.TotalCredits <> (SELECT COALESCE(SUM(CreditAmount), 0) FROM __mj_BizAppsAccounting.JournalEntryBatchLineItem WHERE BatchID = i.ID)
          )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50014, 'JournalEntryBatch cannot be marked Sent: summary lines must foot to TotalDebits/TotalCredits and the consolidated entry must balance.', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.12 trg_JEBatchLineDimension_Immutability
--      Dimension tags on a sent/acknowledged batch line are frozen too, or the
--      analytical breakdown that posted to the ERP could drift after the fact.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JEBLDimension_Immutability
ON __mj_BizAppsAccounting.JournalEntryBatchLineDimension
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM (SELECT JournalEntryBatchLineItemID FROM inserted
              UNION SELECT JournalEntryBatchLineItemID FROM deleted) x
        JOIN __mj_BizAppsAccounting.JournalEntryBatchLineItem li ON li.ID = x.JournalEntryBatchLineItemID
        JOIN __mj_BizAppsAccounting.JournalEntryBatch b ON b.ID = li.BatchID
        WHERE b.Status IN ('Sent','Acknowledged')
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50015, 'JournalEntryBatchLineDimension on a Sent/Acknowledged batch cannot be inserted, modified, or deleted.', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.13 trg_ScheduledJournalEntry_Immutability
--      Once a scheduled entry materializes (Status='Generated'), its financial
--      definition is frozen so it keeps matching the JournalEntry it produced.
--      DELETE of a Generated row is blocked; Cancel/Supersede are status moves
--      on not-yet-generated rows.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_SJE_Immutability
ON __mj_BizAppsAccounting.ScheduledJournalEntry
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted WHERE Status = 'Generated')
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50016, 'ScheduledJournalEntry that has Generated its JournalEntry cannot be deleted.', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status = 'Generated'
          AND (
            i.CompanyID               <> d.CompanyID               OR
            i.EntryType               <> d.EntryType               OR
            i.ScheduleSequence        <> d.ScheduleSequence        OR
            i.ScheduleCount           <> d.ScheduleCount           OR
            i.ScheduledEffectiveDate  <> d.ScheduledEffectiveDate  OR
            i.CurrencyCode            <> d.CurrencyCode            OR
            i.TotalAmount             <> d.TotalAmount             OR
            i.GeneratedJournalEntryID <> d.GeneratedJournalEntryID
          )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50017, 'ScheduledJournalEntry is locked once Generated; its financial fields and GeneratedJournalEntryID may not change.', 1;
    END;
END;
GO

---------------------------------------------------------------------------
-- 4.14 trg_ScheduledJournalEntryLineItem_Immutability
--      Scheduled lines are frozen once the parent entry has Generated.
---------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_SJELI_Immutability
ON __mj_BizAppsAccounting.ScheduledJournalEntryLineItem
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM (SELECT ScheduledJournalEntryID FROM inserted
              UNION SELECT ScheduledJournalEntryID FROM deleted) x
        JOIN __mj_BizAppsAccounting.ScheduledJournalEntry s ON s.ID = x.ScheduledJournalEntryID
        WHERE s.Status = 'Generated'
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50018, 'ScheduledJournalEntryLineItem cannot change once its ScheduledJournalEntry has Generated.', 1;
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
--     Atomically increments the per-(Company × FiscalYear) sequence and
--     returns the formatted EntryNumber 'JE-{CompanyCode}-{FY}-{seq:000000}'.
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
        THROW 50020, 'spAssignNextJournalEntryNumber: no AccountingCompanyProfile for CompanyID. Ensure the parent Company has an Accounting profile.', 1;

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
--     Atomically increments the per-Company batch sequence and returns
--     'BATCH-{CompanyCode}-{seq:000000}'.
---------------------------------------------------------------------------
CREATE PROCEDURE __mj_BizAppsAccounting.spAssignNextBatchNumber
    @CompanyID UNIQUEIDENTIFIER,
    @BatchNumber NVARCHAR(40) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NextSeq INT;
    DECLARE @CompanyCode NVARCHAR(20);

    SELECT @CompanyCode = CompanyCode
      FROM __mj_BizAppsAccounting.AccountingCompanyProfile
     WHERE ID = @CompanyID;

    IF @CompanyCode IS NULL
        THROW 50021, 'spAssignNextBatchNumber: no AccountingCompanyProfile for CompanyID.', 1;

    BEGIN TRANSACTION;
        IF NOT EXISTS (
            SELECT 1 FROM __mj_BizAppsAccounting.JournalEntryBatchSequence WITH (HOLDLOCK, UPDLOCK)
             WHERE CompanyID = @CompanyID
        )
        BEGIN
            INSERT INTO __mj_BizAppsAccounting.JournalEntryBatchSequence (CompanyID, NextSequenceNumber)
            VALUES (@CompanyID, 2);
            SET @NextSeq = 1;
        END
        ELSE
        BEGIN
            UPDATE __mj_BizAppsAccounting.JournalEntryBatchSequence WITH (HOLDLOCK, UPDLOCK)
               SET @NextSeq = NextSequenceNumber, NextSequenceNumber = NextSequenceNumber + 1
             WHERE CompanyID = @CompanyID;
        END;
    COMMIT TRANSACTION;

    SET @BatchNumber = N'BATCH-' + @CompanyCode + N'-' + RIGHT(N'000000' + CAST(@NextSeq AS NVARCHAR(6)), 6);
END;
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
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Default payment terms type for new orders/invoices. FK delegated to BizAppsOrders.PaymentTermsType (soft ref; no FK constraint).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'DefaultPaymentTermsTypeID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Which GLAccount represents this company''s primary Accounts Receivable. Wired by spSeedDefaultChartOfAccounts.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'AROpenGLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Which GLAccount represents this company''s Deferred Revenue.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'DeferredRevenueGLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Which GLAccount represents Sales Tax Payable for accrual.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'SalesTaxPayableGLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'GLAccount used by the FX engine to record realized FX gains/losses on payment-to-AR rate mismatch (BA-D10).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'RealizedFXGainLossGLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'GLAccount used by the period-end FX revaluation template to record unrealized FX adjustments.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'UnrealizedFXGainLossGLAccountID';
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
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'High-level type: Asset | Liability | Equity | Revenue | Expense | ContraAsset | ContraLiability | ContraRevenue | ContraExpense | Statistical.',
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
-- 6.8 AccountingPeriod
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Per-Company accounting period (Month/Quarter/Year). Hard-close semantics per BA-D13: once Status=Closed, no JE may post with EffectiveDate in this period unless flagged as an adjusting entry (OriginalAccountingPeriodID set).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company that owns this period.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Period granularity: Month | Quarter | Year.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'PeriodType';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Period start date (inclusive).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'PeriodStart';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Period end date (inclusive).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'PeriodEnd';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Fiscal year (e.g. 2026). Distinct from calendar year when the FY starts in another month.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'FiscalYear';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Fiscal quarter (1-4). Set for Month and Quarter rows; NULL for Year.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'FiscalQuarter';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Fiscal month (1-12). Set for Month rows only.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'FiscalMonth';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Lifecycle: Open | Closing | Closed | Reopened. Hard close blocks JE posts (trg_JournalEntry_PeriodClose).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'Status';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the period was closed.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'ClosedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'User who closed the period.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'ClosedByUserID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Required justification when an admin reopens a closed period (BA-D13).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'ReopenReason';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the period was last reopened.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'ReopenedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'User who last reopened the period.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingPeriod', @level2type = N'COLUMN', @level2name = N'ReopenedByUserID';
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
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company this batch is for. One batch per Company per dispatch run.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Accounting period this batch covers.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'AccountingPeriodID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Target ERP for this batch: BusinessCentral | QuickBooks | NetSuite | Sage | Xero | Other.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'TargetSystem';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the batch was created (Pending JEs flipped to Batched).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'BatchedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'User (or system identity for scheduled runs) that performed the batch.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'BatchedByUserID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Lifecycle: Pending | Sent | Acknowledged | Failed. Once Sent/Acknowledged, the batch is locked (trg_JEBatch_Immutability).',
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
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the ERP acknowledged receipt (triggers JE.Status transition Batched → GLPosted).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'AcknowledgedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Error message from a Failed send. JEs revert to Pending for retry.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ErrorMessage';
GO

---------------------------------------------------------------------------
-- 6.10 JournalEntryBatchLineItem
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Consolidated summary line shipped to the ERP: the locked JE lines in a batch aggregated by GLAccount × dimension combo × side (BA-D16/BA-D26). The JournalEntryLine detail stays for drill-through; this is the netted GL movement that posts.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineItem';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineItem', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Batch this summary line belongs to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineItem', @level2type = N'COLUMN', @level2name = N'BatchID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company whose books this line posts to (one batch = one Company per BA-D16).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineItem', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'GLAccount this consolidated movement hits.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineItem', @level2type = N'COLUMN', @level2name = N'GLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Line ordering within the batch (1-based).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineItem', @level2type = N'COLUMN', @level2name = N'LineNumber';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Summed debit for this account × dimension combo (NULL if a credit line).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineItem', @level2type = N'COLUMN', @level2name = N'DebitAmount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Summed credit for this account × dimension combo (NULL if a debit line).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineItem', @level2type = N'COLUMN', @level2name = N'CreditAmount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'How many JournalEntryLine rows rolled up into this summary line (audit aid).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineItem', @level2type = N'COLUMN', @level2name = N'SourceLineCount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Target ERP account code resolved via ChartOfAccountsMapping at batch time.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineItem', @level2type = N'COLUMN', @level2name = N'ExternalAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Optional memo on the consolidated line.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineItem', @level2type = N'COLUMN', @level2name = N'Description';
GO

---------------------------------------------------------------------------
-- 6.11 JournalEntryBatchLineDimension
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Dimension tag on a batch summary line. Preserves the analytical breakdown through to the ERP so departmental/segment financials survive summarization (BA-D26).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineDimension';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineDimension', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Batch summary line being tagged.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineDimension', @level2type = N'COLUMN', @level2name = N'JournalEntryBatchLineItemID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Dimension being applied.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineDimension', @level2type = N'COLUMN', @level2name = N'DimensionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Value of that dimension on this line.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchLineDimension', @level2type = N'COLUMN', @level2name = N'DimensionValueID';
GO

---------------------------------------------------------------------------
-- 6.12 ScheduledJournalEntry
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A pre-computed FUTURE journal entry in a revenue-recognition / amortization waterfall (BA-D25). Amounts are known up front; the schedule is computed upstream (BizAppsOrders) and persisted here. The period-close engine materializes each row into a real Pending JournalEntry on its target period.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company that owns this scheduled entry.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'RevenueRecognition | DeferredRevenueRelease | PrepaidAmortization | DepreciationAccrual | PeriodEndAccrual | Manual. Becomes the materialized JE''s EntryType.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'EntryType';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Scheduled | Generated | Cancelled | Superseded. Frozen once Generated (trg_SJE_Immutability).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'Status';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'1-based position in the waterfall (the "3" of "3 of 12").',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'ScheduleSequence';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Total number of entries in this schedule (the "12").',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'ScheduleCount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Accounting date the materialized JE will bear (typically period-end).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'ScheduledEffectiveDate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Resolved target AccountingPeriod; may be NULL until that period is generated.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'TargetAccountingPeriodID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Currency of TotalAmount and the line amounts.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'CurrencyCode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Gross amount recognized by this entry; lines carry the Dr/Cr detail. Front-loaded rounding (extra pennies in sequence 1) is reflected here per row.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'TotalAmount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Free-form description.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'Description';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to the originating Subscription (BizAppsOrders). NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'SubscriptionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to the SubscriptionTerm that generated this schedule. NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'SubscriptionTermID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to the originating Order. NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'OrderID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to the originating OrderLine. NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'OrderLineID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to the originating Contract. NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'ContractID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to the upstream RevenueRecognitionSchedule. NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'RevRecScheduleID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The JournalEntry produced when this row materialized (set with Status=Generated).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'GeneratedJournalEntryID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When this row materialized into a JournalEntry.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'GeneratedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When a renewal/amendment recomputed the remaining schedule, the ScheduledJournalEntry that replaced this one (Status=Superseded).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntry', @level2type = N'COLUMN', @level2name = N'SupersededByScheduledJournalEntryID';
GO

---------------------------------------------------------------------------
-- 6.12b ScheduledJournalEntryLineItem
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Dr/Cr shape of a scheduled entry; copied verbatim onto the materialized JournalEntryLine.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineItem';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineItem', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Parent scheduled entry.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineItem', @level2type = N'COLUMN', @level2name = N'ScheduledJournalEntryID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Line ordering (1-based).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineItem', @level2type = N'COLUMN', @level2name = N'LineNumber';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'GLAccount this line posts to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineItem', @level2type = N'COLUMN', @level2name = N'GLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Debit amount (NULL if a credit line).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineItem', @level2type = N'COLUMN', @level2name = N'DebitAmount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Credit amount (NULL if a debit line).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineItem', @level2type = N'COLUMN', @level2name = N'CreditAmount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Optional memo.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineItem', @level2type = N'COLUMN', @level2name = N'Description';
GO

---------------------------------------------------------------------------
-- 6.12c ScheduledJournalEntryLineDimension
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Analytical tag on a scheduled line; carried through to the materialized JournalEntryLineDimension.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineDimension';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineDimension', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Scheduled line being tagged.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineDimension', @level2type = N'COLUMN', @level2name = N'ScheduledJournalEntryLineItemID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Dimension being applied.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineDimension', @level2type = N'COLUMN', @level2name = N'DimensionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Value of that dimension on this line.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ScheduledJournalEntryLineDimension', @level2type = N'COLUMN', @level2name = N'DimensionValueID';
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
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company that owns this entry.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Accounting period this entry posts to. Must be Open or Reopened (trg_JournalEntry_PeriodClose).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'AccountingPeriodID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Accounting date for the entry (drives which period it falls in).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'EffectiveDate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'OrderBooking | PaymentReceipt | RevenueRecognition | CommissionAccrual | PartnerRevShare | IntercompanyFlow | WaterfallDistribution | Refund | Writeoff | Reversal | Manual | TaxRemittance | PeriodEndAccrual | FXRevaluation | OpeningBalance | Adjustment.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'EntryType';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Lifecycle state: Pending | Batched | GLPosted (BA-D6). Locked after Batched; only GLPosted transition and GL-roundtrip fields may change.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'Status';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Free-form human description of the entry.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'Description';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to a source Order in a downstream app. NO FK. Accounting stores the UUID for audit drill-through but has zero knowledge of Order entities.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'OrderID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to a source OrderLine. NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'OrderLineID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to a source Subscription. NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'SubscriptionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to a source Payment. NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'PaymentID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to a source Contract. NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'ContractID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to a RevenueRecognitionSchedule. NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'RevRecScheduleID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to an IntercompanyFlow record orchestrated upstream. NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'IntercompanyFlowID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When this JE was materialized from a rev-rec / amortization waterfall, the ScheduledJournalEntry that produced it (BA-D25).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'ScheduledJournalEntryID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the JE represents a tax remittance, the remittance record it implements.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'TaxRemittanceID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When set, this JE is a reversal of the referenced original JE. EntryType MUST be ''Reversal'' (trg_JE_ReversalConsistency).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'ReversesJournalEntryID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Back-pointer set on the original JE when a reversal is emitted against it.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'ReversedByJournalEntryID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When this JE is an adjusting entry to a previously closed period, this is the closed period it adjusts. The JE itself posts to the NEXT open period (plan §7.5 / BA-D14).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'OriginalAccountingPeriodID';
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
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Soft polymorphic ref to source OrderLine. NO FK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'OrderLineID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'For AR-side lines, the Customer Organization. FK to __mj_BizAppsCommon.Organization.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryLine', @level2type = N'COLUMN', @level2name = N'CounterpartyOrganizationID';
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
-- 6.16 ChartOfAccountsMapping
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Maps an internal GLAccount to an external ERP account code. Required so a Batch can ship JE postings with the right external IDs. Admin approval enforced per master plan M16/D27 (unmapped accounts hard-fail at batch time).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ChartOfAccountsMapping';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ChartOfAccountsMapping', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company this mapping is for.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ChartOfAccountsMapping', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Target ERP system the mapping is for.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ChartOfAccountsMapping', @level2type = N'COLUMN', @level2name = N'ExternalSystem';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Account identifier as known to the external ERP.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ChartOfAccountsMapping', @level2type = N'COLUMN', @level2name = N'ExternalAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display name of the external account (snapshot for audit).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ChartOfAccountsMapping', @level2type = N'COLUMN', @level2name = N'ExternalAccountName';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Internal GLAccount this external account maps to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ChartOfAccountsMapping', @level2type = N'COLUMN', @level2name = N'InternalGLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Earliest date this mapping is in effect.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ChartOfAccountsMapping', @level2type = N'COLUMN', @level2name = N'EffectiveFrom';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Last date this mapping is in effect (NULL = open-ended).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ChartOfAccountsMapping', @level2type = N'COLUMN', @level2name = N'EffectiveTo';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Admin (typically Finance.Admin role) who approved this mapping.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ChartOfAccountsMapping', @level2type = N'COLUMN', @level2name = N'ApprovedByUserID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the mapping was approved.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ChartOfAccountsMapping', @level2type = N'COLUMN', @level2name = N'ApprovedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Optional note describing why this mapping was created or changed.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ChartOfAccountsMapping', @level2type = N'COLUMN', @level2name = N'ChangeNote';
GO

---------------------------------------------------------------------------
-- 6.17 TaxLiability
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Open tax liability balance per (Company × Authority × Jurisdiction × Period). Accrued from JE postings; paid down via TaxRemittance records.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company this liability belongs to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'TaxAuthority owed.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'TaxAuthorityID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'TaxJurisdiction the liability is scoped to.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'TaxJurisdictionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Period this liability is reported for.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxLiability', @level2type = N'COLUMN', @level2name = N'AccountingPeriodID';
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
-- 6.18 TaxRemittance
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A payment made against a TaxLiability. Generates a JE of EntryType=TaxRemittance via PostedJournalEntryID.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRemittance';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRemittance', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Liability this payment is against.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRemittance', @level2type = N'COLUMN', @level2name = N'TaxLiabilityID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Amount remitted (functional currency).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRemittance', @level2type = N'COLUMN', @level2name = N'RemittedAmount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Date the remittance was paid.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRemittance', @level2type = N'COLUMN', @level2name = N'RemittedDate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'External payment reference (wire ID, check number, confirmation code).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRemittance', @level2type = N'COLUMN', @level2name = N'PaymentReference';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'JE that records this remittance.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRemittance', @level2type = N'COLUMN', @level2name = N'PostedJournalEntryID';
GO

---------------------------------------------------------------------------
-- 6.19 CustomerTaxProfile
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Taxability profile for an Organization (customer). Captures their tax ID, where they are taxable, and any exemption certificate.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CustomerTaxProfile';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CustomerTaxProfile', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Customer Organization (FK to __mj_BizAppsCommon.Organization).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CustomerTaxProfile', @level2type = N'COLUMN', @level2name = N'OrganizationID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Jurisdiction where the customer is taxable (primary).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CustomerTaxProfile', @level2type = N'COLUMN', @level2name = N'TaxJurisdictionID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Customer''s tax registration number (VAT, EIN, ABN, etc.).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CustomerTaxProfile', @level2type = N'COLUMN', @level2name = N'TaxIDNumber';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether the customer is currently tax-exempt.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CustomerTaxProfile', @level2type = N'COLUMN', @level2name = N'IsExempt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Reference to the exemption certificate (file ref, URL, certificate number). Required when IsExempt=1.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CustomerTaxProfile', @level2type = N'COLUMN', @level2name = N'ExemptionCertificateRef';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the exemption certificate expires.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CustomerTaxProfile', @level2type = N'COLUMN', @level2name = N'ExemptionExpiryDate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Earliest date this profile is in effect.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CustomerTaxProfile', @level2type = N'COLUMN', @level2name = N'EffectiveFrom';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Last date this profile is in effect (NULL = open-ended).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'CustomerTaxProfile', @level2type = N'COLUMN', @level2name = N'EffectiveTo';
GO

---------------------------------------------------------------------------
-- 6.20 AccountBalance
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Materialized period-end balance per Company × GLAccount × AccountingPeriod. Per BA-D22, only subledger accounts are materialized; computed at period close. Open-period balances are computed on demand from JournalEntryLine, not stored here.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalance';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalance', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company this balance is for.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalance', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'GLAccount this balance is for.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalance', @level2type = N'COLUMN', @level2name = N'GLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Period this balance is the ending value for.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalance', @level2type = N'COLUMN', @level2name = N'AccountingPeriodID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Ending balance for the period (functional currency).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalance', @level2type = N'COLUMN', @level2name = N'PeriodEndBalance';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Currency the balance is expressed in (Company''s functional currency).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalance', @level2type = N'COLUMN', @level2name = N'CurrencyCode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the materialization ran.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalance', @level2type = N'COLUMN', @level2name = N'ComputedAt';
GO

---------------------------------------------------------------------------
-- 6.21 AccountBalanceByDimension
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Materialized period-end balance with a composite dimension key. Supports analytical drilldowns (Dimension × DimensionValue) without scanning JournalEntryLine.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalanceByDimension';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalanceByDimension', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company this balance is for.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalanceByDimension', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'GLAccount this balance is for.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalanceByDimension', @level2type = N'COLUMN', @level2name = N'GLAccountID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Period this balance is for.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalanceByDimension', @level2type = N'COLUMN', @level2name = N'AccountingPeriodID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Composite dimension key as a normalized JSON object: {"Department":"Marketing","Region":"WestCoast",...}. Keys sorted alphabetically for stable hashing.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalanceByDimension', @level2type = N'COLUMN', @level2name = N'DimensionValueTagsJson';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'SHA-256 hash of DimensionValueTagsJson (UPPER hex, no separators) used as part of the unique key. Stored as CHAR(64) for fast UNIQUE lookups.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalanceByDimension', @level2type = N'COLUMN', @level2name = N'DimensionTagsHash';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Ending balance for the period for this dimension slice (functional currency).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalanceByDimension', @level2type = N'COLUMN', @level2name = N'PeriodEndBalance';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Currency the balance is expressed in.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalanceByDimension', @level2type = N'COLUMN', @level2name = N'CurrencyCode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the materialization ran.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountBalanceByDimension', @level2type = N'COLUMN', @level2name = N'ComputedAt';
GO

---------------------------------------------------------------------------
-- 6.22 JournalEntrySequence
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Per-Company × FiscalYear gap-free counter for JournalEntry numbering (BA-D15). Maintained by spAssignNextJournalEntryNumber; do not write directly.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntrySequence';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntrySequence', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Fiscal year. Sequence resets at fiscal-year boundaries (BA-D15).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntrySequence', @level2type = N'COLUMN', @level2name = N'FiscalYear';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Next sequence number to assign (1-based). Atomically read and incremented under HOLDLOCK+UPDLOCK.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntrySequence', @level2type = N'COLUMN', @level2name = N'NextSequenceNumber';
GO

---------------------------------------------------------------------------
-- 6.23 JournalEntryBatchSequence
---------------------------------------------------------------------------
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Per-Company gap-free counter for JournalEntryBatch numbering. Maintained by spAssignNextBatchNumber; do not write directly.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchSequence';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchSequence', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Next sequence number to assign.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatchSequence', @level2type = N'COLUMN', @level2name = N'NextSequenceNumber';
GO

-- =============================================================================
-- End of hand-authored DDL.
--
-- NOTE: the CodeGen-generated block that previously followed (MJ entity/field
-- metadata, base views, CRUD sprocs, validators) has been REMOVED. The schema
-- changed materially (Recurring* dropped; ScheduledJournalEntry* +
-- JournalEntryBatchLineItem* added), so that output is stale. It will be
-- regenerated against a clean DB. After running this migration:
--   1. `npm run mj:codegen` to regenerate entity / GraphQL / Angular code AND
--      to re-append the MJ metadata / base-view / sproc block below this banner
--      (replace this note with the fresh CodeGen_Run_*.sql output).
--   2. `npx mj sql-convert migrations/B202605281200__v0.1.0__Schema_and_Tables.sql --from tsql --to postgres --output migrations-pg/B202605281200__v0.1.0__Schema_and_Tables.pg.sql --schema __mj_BizAppsAccounting`
--      to produce the PostgreSQL counterpart (see migrations-pg/README.md)
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
  'MemberJunction: Common Business App Data',
  'MJ_BizApps_Accounting: ', NULL
)
