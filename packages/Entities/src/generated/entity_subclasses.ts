import { BaseEntity, EntitySaveOptions, EntityDeleteOptions, CompositeKey, ValidationResult, ValidationErrorInfo, ValidationErrorType, Metadata, ProviderType, DatabaseProviderBase } from "@memberjunction/core";
import { RegisterClass } from "@memberjunction/global";
import { z } from "zod";

export const loadModule = () => {
  // no-op, only used to ensure this file is a valid module and to allow easy loading
}

     
 
/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Account Balance By Dimensions
 */
export const mjBizAppsAccountingAccountBalanceByDimensionSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: Company this balance is for.`),
    GLAccountID: z.string().describe(`
        * * Field Name: GLAccountID
        * * Display Name: GL Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: GLAccount this balance is for.`),
    AccountingPeriodID: z.string().describe(`
        * * Field Name: AccountingPeriodID
        * * Display Name: Accounting Period
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Periods (vwAccountingPeriods.ID)
        * * Description: Period this balance is for.`),
    DimensionValueTagsJson: z.string().describe(`
        * * Field Name: DimensionValueTagsJson
        * * Display Name: Dimension Tags
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Composite dimension key as a normalized JSON object: {"Department":"Marketing","Region":"WestCoast",...}. Keys sorted alphabetically for stable hashing.`),
    DimensionTagsHash: z.string().describe(`
        * * Field Name: DimensionTagsHash
        * * Display Name: Dimension Hash
        * * SQL Data Type: char(64)
        * * Description: SHA-256 hash of DimensionValueTagsJson (UPPER hex, no separators) used as part of the unique key. Stored as CHAR(64) for fast UNIQUE lookups.`),
    PeriodEndBalance: z.number().describe(`
        * * Field Name: PeriodEndBalance
        * * Display Name: Period End Balance
        * * SQL Data Type: decimal(18, 2)
        * * Description: Ending balance for the period for this dimension slice (functional currency).`),
    CurrencyCode: z.string().describe(`
        * * Field Name: CurrencyCode
        * * Display Name: Currency Code
        * * SQL Data Type: char(3)
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
        * * Description: Currency the balance is expressed in.`),
    ComputedAt: z.date().describe(`
        * * Field Name: ComputedAt
        * * Display Name: Computed At
        * * SQL Data Type: datetimeoffset
        * * Default Value: sysdatetimeoffset()
        * * Description: When the materialization ran.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company Name
        * * SQL Data Type: nvarchar(50)`),
    GLAccount: z.string().describe(`
        * * Field Name: GLAccount
        * * Display Name: GL Account Name
        * * SQL Data Type: nvarchar(200)`),
    CurrencyCode_Virtual: z.string().describe(`
        * * Field Name: CurrencyCode_Virtual
        * * Display Name: Currency
        * * SQL Data Type: nvarchar(80)`),
});

export type mjBizAppsAccountingAccountBalanceByDimensionEntityType = z.infer<typeof mjBizAppsAccountingAccountBalanceByDimensionSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Account Balances
 */
export const mjBizAppsAccountingAccountBalanceSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: Company this balance is for.`),
    GLAccountID: z.string().describe(`
        * * Field Name: GLAccountID
        * * Display Name: GL Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: GLAccount this balance is for.`),
    AccountingPeriodID: z.string().describe(`
        * * Field Name: AccountingPeriodID
        * * Display Name: Accounting Period
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Periods (vwAccountingPeriods.ID)
        * * Description: Period this balance is the ending value for.`),
    PeriodEndBalance: z.number().describe(`
        * * Field Name: PeriodEndBalance
        * * Display Name: Period End Balance
        * * SQL Data Type: decimal(18, 2)
        * * Description: Ending balance for the period (functional currency).`),
    CurrencyCode: z.string().describe(`
        * * Field Name: CurrencyCode
        * * Display Name: Currency
        * * SQL Data Type: char(3)
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
        * * Description: Currency the balance is expressed in (Company's functional currency).`),
    ComputedAt: z.date().describe(`
        * * Field Name: ComputedAt
        * * Display Name: Computed At
        * * SQL Data Type: datetimeoffset
        * * Default Value: sysdatetimeoffset()
        * * Description: When the materialization ran.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company Name
        * * SQL Data Type: nvarchar(50)`),
    GLAccount: z.string().describe(`
        * * Field Name: GLAccount
        * * Display Name: GL Account Name
        * * SQL Data Type: nvarchar(200)`),
    CurrencyCode_Virtual: z.string().describe(`
        * * Field Name: CurrencyCode_Virtual
        * * Display Name: Currency (Display)
        * * SQL Data Type: nvarchar(80)`),
});

export type mjBizAppsAccountingAccountBalanceEntityType = z.infer<typeof mjBizAppsAccountingAccountBalanceSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Accounting Company Profiles
 */
export const mjBizAppsAccountingAccountingCompanyProfileSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: Primary key AND foreign key to __mj.Company.ID. Same UUID as the parent Company row — this is the IsA pattern (BA-D9).`),
    EntityType: z.union([z.literal('Branch'), z.literal('CostCenter'), z.literal('Department'), z.literal('Division'), z.literal('JointVenture'), z.literal('LegalEntity'), z.literal('Other'), z.literal('Partner'), z.literal('Subsidiary')]).describe(`
        * * Field Name: EntityType
        * * Display Name: Entity Type
        * * SQL Data Type: nvarchar(30)
        * * Default Value: Subsidiary
    * * Value List Type: List
    * * Possible Values 
    *   * Branch
    *   * CostCenter
    *   * Department
    *   * Division
    *   * JointVenture
    *   * LegalEntity
    *   * Other
    *   * Partner
    *   * Subsidiary
        * * Description: What kind of entity this is in the accounting structure: LegalEntity | Subsidiary | Division | Department | Branch | Partner | JointVenture | CostCenter | Other.`),
    LegalStructureType: z.union([z.literal('C-Corp'), z.literal('International-GmbH'), z.literal('International-Ltd'), z.literal('International-Other'), z.literal('International-Pty'), z.literal('LLC'), z.literal('NonProfit-501c3'), z.literal('NonProfit-501c6'), z.literal('Other'), z.literal('Partnership'), z.literal('S-Corp'), z.literal('SoleProprietorship')]).nullable().describe(`
        * * Field Name: LegalStructureType
        * * Display Name: Legal Structure
        * * SQL Data Type: nvarchar(30)
    * * Value List Type: List
    * * Possible Values 
    *   * C-Corp
    *   * International-GmbH
    *   * International-Ltd
    *   * International-Other
    *   * International-Pty
    *   * LLC
    *   * NonProfit-501c3
    *   * NonProfit-501c6
    *   * Other
    *   * Partnership
    *   * S-Corp
    *   * SoleProprietorship
        * * Description: Legal structure: LLC | C-Corp | S-Corp | Partnership | SoleProprietorship | NonProfit-501c3 | NonProfit-501c6 | International-Ltd | International-GmbH | International-Pty | International-Other | Other. Only meaningful when EntityType is a legal entity / subsidiary / partner.`),
    IncorporationDate: z.date().nullable().describe(`
        * * Field Name: IncorporationDate
        * * Display Name: Incorporation Date
        * * SQL Data Type: date
        * * Description: Date the entity was legally incorporated/registered.`),
    JurisdictionCountry: z.string().nullable().describe(`
        * * Field Name: JurisdictionCountry
        * * Display Name: Jurisdiction Country
        * * SQL Data Type: char(2)
        * * Description: ISO 3166-1 alpha-2 country code where this entity is incorporated. Free-form; not FK-constrained to keep dependency on geography modeling clean.`),
    JurisdictionRegion: z.string().nullable().describe(`
        * * Field Name: JurisdictionRegion
        * * Display Name: Jurisdiction Region
        * * SQL Data Type: nvarchar(50)
        * * Description: State/province sub-national region, free-form.`),
    FederalTaxID: z.string().nullable().describe(`
        * * Field Name: FederalTaxID
        * * Display Name: Federal Tax ID
        * * SQL Data Type: nvarchar(40)
        * * Description: Federal tax identifier — EIN (US), ABN (Australia), VAT registration (EU), etc.`),
    CompanyCode: z.string().describe(`
        * * Field Name: CompanyCode
        * * Display Name: Company Code
        * * SQL Data Type: nvarchar(20)
        * * Description: Short code used in JE numbering ('JE-{CompanyCode}-{FY}-{seq}'). Uppercase alphanumeric + dash/underscore. UNIQUE per deployment (BA-D15).`),
    FunctionalCurrencyCode: z.string().describe(`
        * * Field Name: FunctionalCurrencyCode
        * * Display Name: Functional Currency
        * * SQL Data Type: char(3)
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
        * * Description: ISO 4217 currency code (CHAR(3)) for the functional currency. All JEs post in this currency; original-currency triple on JE lines records the source-transaction currency when different (BA-D10).`),
    ReportingCurrencyCode: z.string().nullable().describe(`
        * * Field Name: ReportingCurrencyCode
        * * Display Name: Reporting Currency
        * * SQL Data Type: char(3)
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
        * * Description: Reporting currency for consolidation. NULL = same as functional currency.`),
    FiscalYearStartMonth: z.number().describe(`
        * * Field Name: FiscalYearStartMonth
        * * Display Name: Fiscal Year Start Month
        * * SQL Data Type: tinyint
        * * Default Value: 1
        * * Description: Calendar month (1-12) when the fiscal year begins. Default 1 (Jan-start calendar).`),
    FiscalYearStartDay: z.number().describe(`
        * * Field Name: FiscalYearStartDay
        * * Display Name: Fiscal Year Start Day
        * * SQL Data Type: tinyint
        * * Default Value: 1
        * * Description: Calendar day-of-month (1-31) when the fiscal year begins. Default 1.`),
    ParentAccountingCompanyID: z.string().nullable().describe(`
        * * Field Name: ParentAccountingCompanyID
        * * Display Name: Parent Accounting Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Company Profiles (vwAccountingCompanyProfiles.ID)
        * * Description: If set, this profile uses the books (COA, periods, JEs) of the referenced profile (consolidated reporting). Chains are forbidden: the referenced profile must NOT itself have a parent (BA-D9; trigger trg_ACP_NoChains).`),
    DefaultPaymentTermsTypeID: z.string().nullable().describe(`
        * * Field Name: DefaultPaymentTermsTypeID
        * * Display Name: Default Payment Terms
        * * SQL Data Type: uniqueidentifier
        * * Description: Default payment terms type for new orders/invoices. FK delegated to BizAppsOrders.PaymentTermsType (soft ref; no FK constraint).`),
    AROpenGLAccountID: z.string().nullable().describe(`
        * * Field Name: AROpenGLAccountID
        * * Display Name: AR GL Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: Which GLAccount represents this company's primary Accounts Receivable. Wired by spSeedDefaultChartOfAccounts.`),
    DeferredRevenueGLAccountID: z.string().nullable().describe(`
        * * Field Name: DeferredRevenueGLAccountID
        * * Display Name: Deferred Revenue GL Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: Which GLAccount represents this company's Deferred Revenue.`),
    SalesTaxPayableGLAccountID: z.string().nullable().describe(`
        * * Field Name: SalesTaxPayableGLAccountID
        * * Display Name: Sales Tax Payable GL Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: Which GLAccount represents Sales Tax Payable for accrual.`),
    RealizedFXGainLossGLAccountID: z.string().nullable().describe(`
        * * Field Name: RealizedFXGainLossGLAccountID
        * * Display Name: Realized FX Gain/Loss GL Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: GLAccount used by the FX engine to record realized FX gains/losses on payment-to-AR rate mismatch (BA-D10).`),
    UnrealizedFXGainLossGLAccountID: z.string().nullable().describe(`
        * * Field Name: UnrealizedFXGainLossGLAccountID
        * * Display Name: Unrealized FX Gain/Loss GL Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: GLAccount used by the period-end FX revaluation template to record unrealized FX adjustments.`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Whether this profile is currently active. Inactive companies cannot have new JEs.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Company Name
        * * SQL Data Type: nvarchar(50)`),
    Description: z.string().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(200)`),
    Website: z.string().nullable().describe(`
        * * Field Name: Website
        * * Display Name: Website
        * * SQL Data Type: nvarchar(100)`),
    LogoURL: z.string().nullable().describe(`
        * * Field Name: LogoURL
        * * Display Name: Logo URL
        * * SQL Data Type: nvarchar(500)`),
    Domain: z.string().nullable().describe(`
        * * Field Name: Domain
        * * Display Name: Domain
        * * SQL Data Type: nvarchar(255)`),
    FunctionalCurrencyCode_Virtual: z.string().describe(`
        * * Field Name: FunctionalCurrencyCode_Virtual
        * * Display Name: Functional Currency (Display)
        * * SQL Data Type: nvarchar(80)`),
    ReportingCurrencyCode_Virtual: z.string().nullable().describe(`
        * * Field Name: ReportingCurrencyCode_Virtual
        * * Display Name: Reporting Currency (Display)
        * * SQL Data Type: nvarchar(80)`),
    AROpenGLAccount: z.string().nullable().describe(`
        * * Field Name: AROpenGLAccount
        * * Display Name: AR GL Account Name
        * * SQL Data Type: nvarchar(200)`),
    DeferredRevenueGLAccount: z.string().nullable().describe(`
        * * Field Name: DeferredRevenueGLAccount
        * * Display Name: Deferred Revenue GL Account Name
        * * SQL Data Type: nvarchar(200)`),
    SalesTaxPayableGLAccount: z.string().nullable().describe(`
        * * Field Name: SalesTaxPayableGLAccount
        * * Display Name: Sales Tax Payable GL Account Name
        * * SQL Data Type: nvarchar(200)`),
    RealizedFXGainLossGLAccount: z.string().nullable().describe(`
        * * Field Name: RealizedFXGainLossGLAccount
        * * Display Name: Realized FX Gain/Loss GL Account Name
        * * SQL Data Type: nvarchar(200)`),
    UnrealizedFXGainLossGLAccount: z.string().nullable().describe(`
        * * Field Name: UnrealizedFXGainLossGLAccount
        * * Display Name: Unrealized FX Gain/Loss GL Account Name
        * * SQL Data Type: nvarchar(200)`),
    __mj_Latitude: z.number().nullable().describe(`
        * * Field Name: __mj_Latitude
        * * Display Name: Mj Latitude
        * * SQL Data Type: decimal(10, 6)`),
    __mj_Longitude: z.number().nullable().describe(`
        * * Field Name: __mj_Longitude
        * * Display Name: Mj Longitude
        * * SQL Data Type: decimal(10, 6)`),
    RootParentAccountingCompanyID: z.string().nullable().describe(`
        * * Field Name: RootParentAccountingCompanyID
        * * Display Name: Root Parent Company
        * * SQL Data Type: uniqueidentifier`),
});

export type mjBizAppsAccountingAccountingCompanyProfileEntityType = z.infer<typeof mjBizAppsAccountingAccountingCompanyProfileSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Accounting Periods
 */
export const mjBizAppsAccountingAccountingPeriodSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: Company that owns this period.`),
    PeriodType: z.union([z.literal('Month'), z.literal('Quarter'), z.literal('Year')]).describe(`
        * * Field Name: PeriodType
        * * Display Name: Period Type
        * * SQL Data Type: nvarchar(10)
    * * Value List Type: List
    * * Possible Values 
    *   * Month
    *   * Quarter
    *   * Year
        * * Description: Period granularity: Month | Quarter | Year.`),
    PeriodStart: z.date().describe(`
        * * Field Name: PeriodStart
        * * Display Name: Period Start
        * * SQL Data Type: date
        * * Description: Period start date (inclusive).`),
    PeriodEnd: z.date().describe(`
        * * Field Name: PeriodEnd
        * * Display Name: Period End
        * * SQL Data Type: date
        * * Description: Period end date (inclusive).`),
    FiscalYear: z.number().describe(`
        * * Field Name: FiscalYear
        * * Display Name: Fiscal Year
        * * SQL Data Type: int
        * * Description: Fiscal year (e.g. 2026). Distinct from calendar year when the FY starts in another month.`),
    FiscalQuarter: z.number().nullable().describe(`
        * * Field Name: FiscalQuarter
        * * Display Name: Fiscal Quarter
        * * SQL Data Type: tinyint
        * * Description: Fiscal quarter (1-4). Set for Month and Quarter rows; NULL for Year.`),
    FiscalMonth: z.number().nullable().describe(`
        * * Field Name: FiscalMonth
        * * Display Name: Fiscal Month
        * * SQL Data Type: tinyint
        * * Description: Fiscal month (1-12). Set for Month rows only.`),
    Status: z.union([z.literal('Closed'), z.literal('Closing'), z.literal('Open'), z.literal('Reopened')]).describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(20)
        * * Default Value: Open
    * * Value List Type: List
    * * Possible Values 
    *   * Closed
    *   * Closing
    *   * Open
    *   * Reopened
        * * Description: Lifecycle: Open | Closing | Closed | Reopened. Hard close blocks JE posts (trg_JournalEntry_PeriodClose).`),
    ClosedAt: z.date().nullable().describe(`
        * * Field Name: ClosedAt
        * * Display Name: Closed At
        * * SQL Data Type: datetimeoffset
        * * Description: When the period was closed.`),
    ClosedByUserID: z.string().nullable().describe(`
        * * Field Name: ClosedByUserID
        * * Display Name: Closed By User ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
        * * Description: User who closed the period.`),
    ReopenReason: z.string().nullable().describe(`
        * * Field Name: ReopenReason
        * * Display Name: Reopen Reason
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Required justification when an admin reopens a closed period (BA-D13).`),
    ReopenedAt: z.date().nullable().describe(`
        * * Field Name: ReopenedAt
        * * Display Name: Reopened At
        * * SQL Data Type: datetimeoffset
        * * Description: When the period was last reopened.`),
    ReopenedByUserID: z.string().nullable().describe(`
        * * Field Name: ReopenedByUserID
        * * Display Name: Reopened By User ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
        * * Description: User who last reopened the period.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company Name
        * * SQL Data Type: nvarchar(50)`),
    ClosedByUser: z.string().nullable().describe(`
        * * Field Name: ClosedByUser
        * * Display Name: Closed By User
        * * SQL Data Type: nvarchar(100)`),
    ReopenedByUser: z.string().nullable().describe(`
        * * Field Name: ReopenedByUser
        * * Display Name: Reopened By User
        * * SQL Data Type: nvarchar(100)`),
});

export type mjBizAppsAccountingAccountingPeriodEntityType = z.infer<typeof mjBizAppsAccountingAccountingPeriodSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Chart Of Accounts Mappings
 */
export const mjBizAppsAccountingChartOfAccountsMappingSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: Company this mapping is for.`),
    ExternalSystem: z.string().describe(`
        * * Field Name: ExternalSystem
        * * Display Name: External System
        * * SQL Data Type: nvarchar(50)
        * * Description: Target ERP system the mapping is for.`),
    ExternalAccountID: z.string().describe(`
        * * Field Name: ExternalAccountID
        * * Display Name: External Account ID
        * * SQL Data Type: nvarchar(100)
        * * Description: Account identifier as known to the external ERP.`),
    ExternalAccountName: z.string().nullable().describe(`
        * * Field Name: ExternalAccountName
        * * Display Name: External Account Name
        * * SQL Data Type: nvarchar(200)
        * * Description: Display name of the external account (snapshot for audit).`),
    InternalGLAccountID: z.string().describe(`
        * * Field Name: InternalGLAccountID
        * * Display Name: Internal GL Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: Internal GLAccount this external account maps to.`),
    EffectiveFrom: z.date().describe(`
        * * Field Name: EffectiveFrom
        * * Display Name: Effective From
        * * SQL Data Type: date
        * * Description: Earliest date this mapping is in effect.`),
    EffectiveTo: z.date().nullable().describe(`
        * * Field Name: EffectiveTo
        * * Display Name: Effective To
        * * SQL Data Type: date
        * * Description: Last date this mapping is in effect (NULL = open-ended).`),
    ApprovedByUserID: z.string().nullable().describe(`
        * * Field Name: ApprovedByUserID
        * * Display Name: Approved By User
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
        * * Description: Admin (typically Finance.Admin role) who approved this mapping.`),
    ApprovedAt: z.date().nullable().describe(`
        * * Field Name: ApprovedAt
        * * Display Name: Approved At
        * * SQL Data Type: datetimeoffset
        * * Description: When the mapping was approved.`),
    ChangeNote: z.string().nullable().describe(`
        * * Field Name: ChangeNote
        * * Display Name: Change Note
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Optional note describing why this mapping was created or changed.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company Name
        * * SQL Data Type: nvarchar(50)`),
    InternalGLAccount: z.string().describe(`
        * * Field Name: InternalGLAccount
        * * Display Name: Internal GL Account Name
        * * SQL Data Type: nvarchar(200)`),
    ApprovedByUser: z.string().nullable().describe(`
        * * Field Name: ApprovedByUser
        * * Display Name: Approved By Name
        * * SQL Data Type: nvarchar(100)`),
});

export type mjBizAppsAccountingChartOfAccountsMappingEntityType = z.infer<typeof mjBizAppsAccountingChartOfAccountsMappingSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Currencies
 */
export const mjBizAppsAccountingCurrencySchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Currency Code
        * * SQL Data Type: char(3)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(80)`),
    Symbol: z.string().nullable().describe(`
        * * Field Name: Symbol
        * * Display Name: Symbol
        * * SQL Data Type: nvarchar(10)`),
    DecimalPlaces: z.number().describe(`
        * * Field Name: DecimalPlaces
        * * Display Name: Decimal Places
        * * SQL Data Type: tinyint
        * * Default Value: 2`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
});

export type mjBizAppsAccountingCurrencyEntityType = z.infer<typeof mjBizAppsAccountingCurrencySchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Currency Spot Rates
 */
export const mjBizAppsAccountingCurrencySpotRateSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    FromCurrencyCode: z.string().describe(`
        * * Field Name: FromCurrencyCode
        * * Display Name: From Currency
        * * SQL Data Type: char(3)
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)`),
    ToCurrencyCode: z.string().describe(`
        * * Field Name: ToCurrencyCode
        * * Display Name: To Currency
        * * SQL Data Type: char(3)
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)`),
    RateDate: z.date().describe(`
        * * Field Name: RateDate
        * * Display Name: Rate Date
        * * SQL Data Type: date`),
    Rate: z.number().describe(`
        * * Field Name: Rate
        * * Display Name: Rate
        * * SQL Data Type: decimal(18, 8)`),
    Source: z.string().describe(`
        * * Field Name: Source
        * * Display Name: Source
        * * SQL Data Type: nvarchar(50)
        * * Default Value: Manual`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    FromCurrencyCode_Virtual: z.string().describe(`
        * * Field Name: FromCurrencyCode_Virtual
        * * Display Name: From Currency (Display)
        * * SQL Data Type: nvarchar(80)`),
    ToCurrencyCode_Virtual: z.string().describe(`
        * * Field Name: ToCurrencyCode_Virtual
        * * Display Name: To Currency (Display)
        * * SQL Data Type: nvarchar(80)`),
});

export type mjBizAppsAccountingCurrencySpotRateEntityType = z.infer<typeof mjBizAppsAccountingCurrencySpotRateSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Customer Tax Profiles
 */
export const mjBizAppsAccountingCustomerTaxProfileSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    OrganizationID: z.string().describe(`
        * * Field Name: OrganizationID
        * * Display Name: Organization
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Common: Organizations (vwOrganizations.ID)
        * * Description: Customer Organization (FK to __mj_BizAppsCommon.Organization).`),
    TaxJurisdictionID: z.string().nullable().describe(`
        * * Field Name: TaxJurisdictionID
        * * Display Name: Tax Jurisdiction
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Jurisdictions (vwTaxJurisdictions.ID)
        * * Description: Jurisdiction where the customer is taxable (primary).`),
    TaxIDNumber: z.string().nullable().describe(`
        * * Field Name: TaxIDNumber
        * * Display Name: Tax ID Number
        * * SQL Data Type: nvarchar(100)
        * * Description: Customer's tax registration number (VAT, EIN, ABN, etc.).`),
    IsExempt: z.boolean().describe(`
        * * Field Name: IsExempt
        * * Display Name: Is Tax Exempt
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Whether the customer is currently tax-exempt.`),
    ExemptionCertificateRef: z.string().nullable().describe(`
        * * Field Name: ExemptionCertificateRef
        * * Display Name: Exemption Certificate Reference
        * * SQL Data Type: nvarchar(200)
        * * Description: Reference to the exemption certificate (file ref, URL, certificate number). Required when IsExempt=1.`),
    ExemptionExpiryDate: z.date().nullable().describe(`
        * * Field Name: ExemptionExpiryDate
        * * Display Name: Exemption Expiry Date
        * * SQL Data Type: date
        * * Description: When the exemption certificate expires.`),
    EffectiveFrom: z.date().describe(`
        * * Field Name: EffectiveFrom
        * * Display Name: Effective From
        * * SQL Data Type: date
        * * Description: Earliest date this profile is in effect.`),
    EffectiveTo: z.date().nullable().describe(`
        * * Field Name: EffectiveTo
        * * Display Name: Effective To
        * * SQL Data Type: date
        * * Description: Last date this profile is in effect (NULL = open-ended).`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Organization: z.string().describe(`
        * * Field Name: Organization
        * * Display Name: Organization Name
        * * SQL Data Type: nvarchar(255)`),
    TaxJurisdiction: z.string().nullable().describe(`
        * * Field Name: TaxJurisdiction
        * * Display Name: Tax Jurisdiction Name
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsAccountingCustomerTaxProfileEntityType = z.infer<typeof mjBizAppsAccountingCustomerTaxProfileSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Dimension Values
 */
export const mjBizAppsAccountingDimensionValueSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    DimensionID: z.string().describe(`
        * * Field Name: DimensionID
        * * Display Name: Dimension
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimensions (vwDimensions.ID)
        * * Description: Dimension this value belongs to.`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(80)
        * * Description: Code for this value (unique within the dimension). E.g. 'Marketing', 'WestCoast', 'ProductLaunch2026'.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)
        * * Description: Display name for this value.`),
    ParentDimensionValueID: z.string().nullable().describe(`
        * * Field Name: ParentDimensionValueID
        * * Display Name: Parent Value
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimension Values (vwDimensionValues.ID)
        * * Description: Parent value for hierarchical dimensions (e.g. Country contains States).`),
    EffectiveFrom: z.date().nullable().describe(`
        * * Field Name: EffectiveFrom
        * * Display Name: Effective From
        * * SQL Data Type: date
        * * Description: Earliest date this value is selectable (NULL = always).`),
    EffectiveTo: z.date().nullable().describe(`
        * * Field Name: EffectiveTo
        * * Display Name: Effective To
        * * SQL Data Type: date
        * * Description: Last date this value is selectable (NULL = never expires).`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Whether this value is available for new tagging.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Dimension: z.string().describe(`
        * * Field Name: Dimension
        * * Display Name: Dimension Name
        * * SQL Data Type: nvarchar(100)`),
    ParentDimensionValue: z.string().nullable().describe(`
        * * Field Name: ParentDimensionValue
        * * Display Name: Parent Value Name
        * * SQL Data Type: nvarchar(200)`),
    RootParentDimensionValueID: z.string().nullable().describe(`
        * * Field Name: RootParentDimensionValueID
        * * Display Name: Root Value
        * * SQL Data Type: uniqueidentifier`),
});

export type mjBizAppsAccountingDimensionValueEntityType = z.infer<typeof mjBizAppsAccountingDimensionValueSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Dimensions
 */
export const mjBizAppsAccountingDimensionSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier (UUID per BA-D3).`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)
        * * Description: Short code for the dimension, e.g. 'Department', 'CostCenter'.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(100)
        * * Description: Display name for the dimension.`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Detailed description of what the dimension tracks and how it is intended to be used in reports.`),
    DisplayOrder: z.number().describe(`
        * * Field Name: DisplayOrder
        * * Display Name: Display Order
        * * SQL Data Type: int
        * * Default Value: 100
        * * Description: Sort order in dropdowns and report filters. Lower values appear first.`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Whether this dimension is available for new JE-line tagging. Inactive dimensions stay in historical data but are hidden from selection.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
});

export type mjBizAppsAccountingDimensionEntityType = z.infer<typeof mjBizAppsAccountingDimensionSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: GL Accounts
 */
export const mjBizAppsAccountingGLAccountSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: Company that owns this account. UNIQUE (CompanyID, Code) — each company has its own chart.`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Account Code
        * * SQL Data Type: nvarchar(40)
        * * Description: Account code matching the ERP COA, e.g. '11201' or '40100-SUB'.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Account Name
        * * SQL Data Type: nvarchar(200)
        * * Description: Display name for the account.`),
    AccountType: z.union([z.literal('Asset'), z.literal('ContraAsset'), z.literal('ContraExpense'), z.literal('ContraLiability'), z.literal('ContraRevenue'), z.literal('Equity'), z.literal('Expense'), z.literal('Liability'), z.literal('Revenue'), z.literal('Statistical')]).describe(`
        * * Field Name: AccountType
        * * Display Name: Account Type
        * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Asset
    *   * ContraAsset
    *   * ContraExpense
    *   * ContraLiability
    *   * ContraRevenue
    *   * Equity
    *   * Expense
    *   * Liability
    *   * Revenue
    *   * Statistical
        * * Description: High-level type: Asset | Liability | Equity | Revenue | Expense | ContraAsset | ContraLiability | ContraRevenue | ContraExpense | Statistical.`),
    ParentGLAccountID: z.string().nullable().describe(`
        * * Field Name: ParentGLAccountID
        * * Display Name: Parent Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: Parent account for hierarchical rollup (NULL = top of chart).`),
    CurrencyCode: z.string().nullable().describe(`
        * * Field Name: CurrencyCode
        * * Display Name: Currency Code
        * * SQL Data Type: char(3)
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
        * * Description: Currency denomination of the account (NULL = uses the Company's functional currency).`),
    ExternalSystem: z.string().nullable().describe(`
        * * Field Name: ExternalSystem
        * * Display Name: External System
        * * SQL Data Type: nvarchar(50)
        * * Description: External system this account synchronizes to: BusinessCentral | QuickBooks | NetSuite | ... NULL if local-only.`),
    ExternalAccountID: z.string().nullable().describe(`
        * * Field Name: ExternalAccountID
        * * Display Name: External Account ID
        * * SQL Data Type: nvarchar(100)
        * * Description: The external system's identifier for this account, used by sync.`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Whether the account is available for new JE lines. Inactive accounts retain historical data.`),
    IsSystemSeeded: z.boolean().describe(`
        * * Field Name: IsSystemSeeded
        * * Display Name: Is System Seeded
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: TRUE if the account was created by spSeedDefaultChartOfAccounts. Lets reports distinguish platform-shipped accounts from deployment customizations.`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Optional description for the account.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company Name
        * * SQL Data Type: nvarchar(50)`),
    ParentGLAccount: z.string().nullable().describe(`
        * * Field Name: ParentGLAccount
        * * Display Name: Parent Account Name
        * * SQL Data Type: nvarchar(200)`),
    CurrencyCode_Virtual: z.string().nullable().describe(`
        * * Field Name: CurrencyCode_Virtual
        * * Display Name: Currency
        * * SQL Data Type: nvarchar(80)`),
    RootParentGLAccountID: z.string().nullable().describe(`
        * * Field Name: RootParentGLAccountID
        * * Display Name: Root Parent Account
        * * SQL Data Type: uniqueidentifier`),
});

export type mjBizAppsAccountingGLAccountEntityType = z.infer<typeof mjBizAppsAccountingGLAccountSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Journal Entries
 */
export const mjBizAppsAccountingJournalEntrySchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier (UUID per BA-D3).`),
    EntryNumber: z.string().describe(`
        * * Field Name: EntryNumber
        * * Display Name: Entry Number
        * * SQL Data Type: nvarchar(40)
        * * Description: Gap-free entry number 'JE-{CompanyCode}-{FY}-{seq:000000}' assigned by spAssignNextJournalEntryNumber (BA-D15).`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: Company that owns this entry.`),
    AccountingPeriodID: z.string().describe(`
        * * Field Name: AccountingPeriodID
        * * Display Name: Accounting Period
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Periods (vwAccountingPeriods.ID)
        * * Description: Accounting period this entry posts to. Must be Open or Reopened (trg_JournalEntry_PeriodClose).`),
    EffectiveDate: z.date().describe(`
        * * Field Name: EffectiveDate
        * * Display Name: Effective Date
        * * SQL Data Type: date
        * * Description: Accounting date for the entry (drives which period it falls in).`),
    EntryType: z.union([z.literal('Adjustment'), z.literal('CommissionAccrual'), z.literal('FXRevaluation'), z.literal('IntercompanyFlow'), z.literal('Manual'), z.literal('OpeningBalance'), z.literal('OrderBooking'), z.literal('PartnerRevShare'), z.literal('PaymentReceipt'), z.literal('PeriodEndAccrual'), z.literal('Refund'), z.literal('RevenueRecognition'), z.literal('Reversal'), z.literal('TaxRemittance'), z.literal('WaterfallDistribution'), z.literal('Writeoff')]).describe(`
        * * Field Name: EntryType
        * * Display Name: Entry Type
        * * SQL Data Type: nvarchar(40)
    * * Value List Type: List
    * * Possible Values 
    *   * Adjustment
    *   * CommissionAccrual
    *   * FXRevaluation
    *   * IntercompanyFlow
    *   * Manual
    *   * OpeningBalance
    *   * OrderBooking
    *   * PartnerRevShare
    *   * PaymentReceipt
    *   * PeriodEndAccrual
    *   * Refund
    *   * RevenueRecognition
    *   * Reversal
    *   * TaxRemittance
    *   * WaterfallDistribution
    *   * Writeoff
        * * Description: OrderBooking | PaymentReceipt | RevenueRecognition | CommissionAccrual | PartnerRevShare | IntercompanyFlow | WaterfallDistribution | Refund | Writeoff | Reversal | Manual | TaxRemittance | PeriodEndAccrual | FXRevaluation | OpeningBalance | Adjustment.`),
    Status: z.union([z.literal('Batched'), z.literal('GLPosted'), z.literal('Pending')]).describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(20)
        * * Default Value: Pending
    * * Value List Type: List
    * * Possible Values 
    *   * Batched
    *   * GLPosted
    *   * Pending
        * * Description: Lifecycle state: Pending | Batched | GLPosted (BA-D6). Locked after Batched; only GLPosted transition and GL-roundtrip fields may change.`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Free-form human description of the entry.`),
    OrderID: z.string().nullable().describe(`
        * * Field Name: OrderID
        * * Display Name: Order
        * * SQL Data Type: uniqueidentifier
        * * Description: Soft polymorphic ref to a source Order in a downstream app. NO FK. Accounting stores the UUID for audit drill-through but has zero knowledge of Order entities.`),
    OrderLineID: z.string().nullable().describe(`
        * * Field Name: OrderLineID
        * * Display Name: Order Line
        * * SQL Data Type: uniqueidentifier
        * * Description: Soft polymorphic ref to a source OrderLine. NO FK.`),
    SubscriptionID: z.string().nullable().describe(`
        * * Field Name: SubscriptionID
        * * Display Name: Subscription
        * * SQL Data Type: uniqueidentifier
        * * Description: Soft polymorphic ref to a source Subscription. NO FK.`),
    PaymentID: z.string().nullable().describe(`
        * * Field Name: PaymentID
        * * Display Name: Payment
        * * SQL Data Type: uniqueidentifier
        * * Description: Soft polymorphic ref to a source Payment. NO FK.`),
    ContractID: z.string().nullable().describe(`
        * * Field Name: ContractID
        * * Display Name: Contract
        * * SQL Data Type: uniqueidentifier
        * * Description: Soft polymorphic ref to a source Contract. NO FK.`),
    RevRecScheduleID: z.string().nullable().describe(`
        * * Field Name: RevRecScheduleID
        * * Display Name: Revenue Recognition Schedule
        * * SQL Data Type: uniqueidentifier
        * * Description: Soft polymorphic ref to a RevenueRecognitionSchedule. NO FK.`),
    IntercompanyFlowID: z.string().nullable().describe(`
        * * Field Name: IntercompanyFlowID
        * * Display Name: Intercompany Flow
        * * SQL Data Type: uniqueidentifier
        * * Description: Soft polymorphic ref to an IntercompanyFlow record orchestrated upstream. NO FK.`),
    RecurringJournalEntryID: z.string().nullable().describe(`
        * * Field Name: RecurringJournalEntryID
        * * Display Name: Recurring Journal Entry
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Recurring Journal Entries (vwRecurringJournalEntries.ID)
        * * Description: When the JE was emitted by a recurring schedule, this is the schedule that produced it.`),
    TaxRemittanceID: z.string().nullable().describe(`
        * * Field Name: TaxRemittanceID
        * * Display Name: Tax Remittance
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Remittances (vwTaxRemittances.ID)
        * * Description: When the JE represents a tax remittance, the remittance record it implements.`),
    ReversesJournalEntryID: z.string().nullable().describe(`
        * * Field Name: ReversesJournalEntryID
        * * Display Name: Reverses Journal Entry
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
        * * Description: When set, this JE is a reversal of the referenced original JE. EntryType MUST be 'Reversal' (trg_JE_ReversalConsistency).`),
    ReversedByJournalEntryID: z.string().nullable().describe(`
        * * Field Name: ReversedByJournalEntryID
        * * Display Name: Reversed By Journal Entry
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
        * * Description: Back-pointer set on the original JE when a reversal is emitted against it.`),
    OriginalAccountingPeriodID: z.string().nullable().describe(`
        * * Field Name: OriginalAccountingPeriodID
        * * Display Name: Original Accounting Period
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Periods (vwAccountingPeriods.ID)
        * * Description: When this JE is an adjusting entry to a previously closed period, this is the closed period it adjusts. The JE itself posts to the NEXT open period (plan §7.5 / BA-D14).`),
    BatchID: z.string().nullable().describe(`
        * * Field Name: BatchID
        * * Display Name: Batch
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entry Batches (vwJournalEntryBatches.ID)
        * * Description: Batch that locked this JE (set when Status transitions to Batched).`),
    GLPostedAt: z.date().nullable().describe(`
        * * Field Name: GLPostedAt
        * * Display Name: GL Posted At
        * * SQL Data Type: datetimeoffset
        * * Description: When the ERP acknowledged the consolidated batch (Status transitions to GLPosted).`),
    GLReferenceID: z.string().nullable().describe(`
        * * Field Name: GLReferenceID
        * * Display Name: GL Reference
        * * SQL Data Type: nvarchar(100)
        * * Description: ERP's reference back to us for this JE (within the consolidated batch posting).`),
    FileID: z.string().nullable().describe(`
        * * Field Name: FileID
        * * Display Name: File
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Files (vwFiles.ID)
        * * Description: Optional attached source document (vendor bill PDF, signed contract, supporting workpaper). FK to __mj.File.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company Name
        * * SQL Data Type: nvarchar(50)`),
    File: z.string().nullable().describe(`
        * * Field Name: File
        * * Display Name: File Description
        * * SQL Data Type: nvarchar(500)`),
    RootReversesJournalEntryID: z.string().nullable().describe(`
        * * Field Name: RootReversesJournalEntryID
        * * Display Name: Root Reverses Journal Entry
        * * SQL Data Type: uniqueidentifier`),
    RootReversedByJournalEntryID: z.string().nullable().describe(`
        * * Field Name: RootReversedByJournalEntryID
        * * Display Name: Root Reversed By Journal Entry
        * * SQL Data Type: uniqueidentifier`),
});

export type mjBizAppsAccountingJournalEntryEntityType = z.infer<typeof mjBizAppsAccountingJournalEntrySchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Journal Entry Batch Sequences
 */
export const mjBizAppsAccountingJournalEntryBatchSequenceSchema = z.object({
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: Company.`),
    NextSequenceNumber: z.number().describe(`
        * * Field Name: NextSequenceNumber
        * * Display Name: Next Sequence Number
        * * SQL Data Type: int
        * * Default Value: 1
        * * Description: Next sequence number to assign.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company
        * * SQL Data Type: nvarchar(50)`),
});

export type mjBizAppsAccountingJournalEntryBatchSequenceEntityType = z.infer<typeof mjBizAppsAccountingJournalEntryBatchSequenceSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Journal Entry Batches
 */
export const mjBizAppsAccountingJournalEntryBatchSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    BatchNumber: z.string().describe(`
        * * Field Name: BatchNumber
        * * Display Name: Batch Number
        * * SQL Data Type: nvarchar(40)
        * * Description: Gap-free batch number assigned by spAssignNextBatchNumber. Format 'BATCH-{CompanyCode}-{seq:000000}'.`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: Company this batch is for. One batch per Company per dispatch run.`),
    AccountingPeriodID: z.string().describe(`
        * * Field Name: AccountingPeriodID
        * * Display Name: Accounting Period
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Periods (vwAccountingPeriods.ID)
        * * Description: Accounting period this batch covers.`),
    TargetSystem: z.union([z.literal('BusinessCentral'), z.literal('NetSuite'), z.literal('Other'), z.literal('QuickBooks'), z.literal('Sage'), z.literal('Xero')]).describe(`
        * * Field Name: TargetSystem
        * * Display Name: Target ERP System
        * * SQL Data Type: nvarchar(50)
    * * Value List Type: List
    * * Possible Values 
    *   * BusinessCentral
    *   * NetSuite
    *   * Other
    *   * QuickBooks
    *   * Sage
    *   * Xero
        * * Description: Target ERP for this batch: BusinessCentral | QuickBooks | NetSuite | Sage | Xero | Other.`),
    BatchedAt: z.date().describe(`
        * * Field Name: BatchedAt
        * * Display Name: Batched At
        * * SQL Data Type: datetimeoffset
        * * Default Value: sysdatetimeoffset()
        * * Description: When the batch was created (Pending JEs flipped to Batched).`),
    BatchedByUserID: z.string().describe(`
        * * Field Name: BatchedByUserID
        * * Display Name: Batched By User ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
        * * Description: User (or system identity for scheduled runs) that performed the batch.`),
    Status: z.union([z.literal('Acknowledged'), z.literal('Failed'), z.literal('Pending'), z.literal('Sent')]).describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(20)
        * * Default Value: Pending
    * * Value List Type: List
    * * Possible Values 
    *   * Acknowledged
    *   * Failed
    *   * Pending
    *   * Sent
        * * Description: Lifecycle: Pending | Sent | Acknowledged | Failed. Once Sent/Acknowledged, the batch is locked (trg_JEBatch_Immutability).`),
    TotalEntries: z.number().describe(`
        * * Field Name: TotalEntries
        * * Display Name: Total Entries
        * * SQL Data Type: int
        * * Default Value: 0
        * * Description: Count of JE rows in this batch (denormalized for fast batch dashboards).`),
    TotalDebits: z.number().describe(`
        * * Field Name: TotalDebits
        * * Display Name: Total Debits
        * * SQL Data Type: decimal(18, 2)
        * * Default Value: 0
        * * Description: Sum of debits across all JE lines in the batch (functional currency).`),
    TotalCredits: z.number().describe(`
        * * Field Name: TotalCredits
        * * Display Name: Total Credits
        * * SQL Data Type: decimal(18, 2)
        * * Default Value: 0
        * * Description: Sum of credits across all JE lines in the batch (functional currency).`),
    ExternalBatchRef: z.string().nullable().describe(`
        * * Field Name: ExternalBatchRef
        * * Display Name: External Batch Reference
        * * SQL Data Type: nvarchar(100)
        * * Description: ERP's reference returned on send (used to correlate the consolidated JE posted in the ERP).`),
    SentAt: z.date().nullable().describe(`
        * * Field Name: SentAt
        * * Display Name: Sent At
        * * SQL Data Type: datetimeoffset
        * * Description: When the batch was sent to the ERP.`),
    AcknowledgedAt: z.date().nullable().describe(`
        * * Field Name: AcknowledgedAt
        * * Display Name: Acknowledged At
        * * SQL Data Type: datetimeoffset
        * * Description: When the ERP acknowledged receipt (triggers JE.Status transition Batched → GLPosted).`),
    ErrorMessage: z.string().nullable().describe(`
        * * Field Name: ErrorMessage
        * * Display Name: Error Message
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Error message from a Failed send. JEs revert to Pending for retry.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company
        * * SQL Data Type: nvarchar(50)`),
    BatchedByUser: z.string().describe(`
        * * Field Name: BatchedByUser
        * * Display Name: Batched By User
        * * SQL Data Type: nvarchar(100)`),
});

export type mjBizAppsAccountingJournalEntryBatchEntityType = z.infer<typeof mjBizAppsAccountingJournalEntryBatchSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Journal Entry Line Dimensions
 */
export const mjBizAppsAccountingJournalEntryLineDimensionSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    JournalEntryLineID: z.string().describe(`
        * * Field Name: JournalEntryLineID
        * * Display Name: Journal Entry Line
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entry Lines (vwJournalEntryLines.ID)
        * * Description: JE line being tagged.`),
    DimensionID: z.string().describe(`
        * * Field Name: DimensionID
        * * Display Name: Dimension
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimensions (vwDimensions.ID)
        * * Description: Dimension being applied. UNIQUE per (Line, Dimension) so a line cannot have two values for the same dimension.`),
    DimensionValueID: z.string().describe(`
        * * Field Name: DimensionValueID
        * * Display Name: Dimension Value
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimension Values (vwDimensionValues.ID)
        * * Description: Value chosen for the dimension on this line.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Dimension: z.string().describe(`
        * * Field Name: Dimension
        * * Display Name: Dimension Name
        * * SQL Data Type: nvarchar(100)`),
    DimensionValue: z.string().describe(`
        * * Field Name: DimensionValue
        * * Display Name: Dimension Value Name
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsAccountingJournalEntryLineDimensionEntityType = z.infer<typeof mjBizAppsAccountingJournalEntryLineDimensionSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Journal Entry Lines
 */
export const mjBizAppsAccountingJournalEntryLineSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    JournalEntryID: z.string().describe(`
        * * Field Name: JournalEntryID
        * * Display Name: Journal Entry
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
        * * Description: Parent JournalEntry.`),
    LineNumber: z.number().describe(`
        * * Field Name: LineNumber
        * * Display Name: Line Number
        * * SQL Data Type: int
        * * Description: 1-based ordering of lines within the parent JE.`),
    GLAccountID: z.string().describe(`
        * * Field Name: GLAccountID
        * * Display Name: GL Account ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: GLAccount this line posts to.`),
    DebitAmount: z.number().nullable().describe(`
        * * Field Name: DebitAmount
        * * Display Name: Debit Amount
        * * SQL Data Type: decimal(18, 2)
        * * Description: Debit amount in the Company's FUNCTIONAL currency. Mutually exclusive with CreditAmount (CK_JEL_OneSide).`),
    CreditAmount: z.number().nullable().describe(`
        * * Field Name: CreditAmount
        * * Display Name: Credit Amount
        * * SQL Data Type: decimal(18, 2)
        * * Description: Credit amount in the Company's FUNCTIONAL currency. Mutually exclusive with DebitAmount.`),
    OriginalCurrencyCode: z.string().nullable().describe(`
        * * Field Name: OriginalCurrencyCode
        * * Display Name: Original Currency Code
        * * SQL Data Type: char(3)
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
        * * Description: ISO 4217 code of the SOURCE-transaction currency (the customer-facing one). NULL when the source is already the functional currency.`),
    OriginalDebitAmount: z.number().nullable().describe(`
        * * Field Name: OriginalDebitAmount
        * * Display Name: Original Debit Amount
        * * SQL Data Type: decimal(18, 2)
        * * Description: Debit amount in the original currency (paired with OriginalCurrencyCode + ExchangeRateUsed).`),
    OriginalCreditAmount: z.number().nullable().describe(`
        * * Field Name: OriginalCreditAmount
        * * Display Name: Original Credit Amount
        * * SQL Data Type: decimal(18, 2)
        * * Description: Credit amount in the original currency.`),
    ExchangeRateUsed: z.number().nullable().describe(`
        * * Field Name: ExchangeRateUsed
        * * Display Name: Exchange Rate Used
        * * SQL Data Type: decimal(18, 8)
        * * Description: Exchange rate (functional per 1 original) used at booking time. Required when an original amount is present.`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Free-form description of the line (memo).`),
    OrderLineID: z.string().nullable().describe(`
        * * Field Name: OrderLineID
        * * Display Name: Order Line
        * * SQL Data Type: uniqueidentifier
        * * Description: Soft polymorphic ref to source OrderLine. NO FK.`),
    CounterpartyOrganizationID: z.string().nullable().describe(`
        * * Field Name: CounterpartyOrganizationID
        * * Display Name: Counterparty Organization ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Common: Organizations (vwOrganizations.ID)
        * * Description: For AR-side lines, the Customer Organization. FK to __mj_BizAppsCommon.Organization.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    GLAccount: z.string().describe(`
        * * Field Name: GLAccount
        * * Display Name: GL Account
        * * SQL Data Type: nvarchar(200)`),
    OriginalCurrencyCode_Virtual: z.string().nullable().describe(`
        * * Field Name: OriginalCurrencyCode_Virtual
        * * Display Name: Original Currency
        * * SQL Data Type: nvarchar(80)`),
    CounterpartyOrganization: z.string().nullable().describe(`
        * * Field Name: CounterpartyOrganization
        * * Display Name: Counterparty Organization
        * * SQL Data Type: nvarchar(255)`),
});

export type mjBizAppsAccountingJournalEntryLineEntityType = z.infer<typeof mjBizAppsAccountingJournalEntryLineSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Journal Entry Links
 */
export const mjBizAppsAccountingJournalEntryLinkSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    JournalEntryID: z.string().describe(`
        * * Field Name: JournalEntryID
        * * Display Name: Journal Entry
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)`),
    EntityID: z.string().describe(`
        * * Field Name: EntityID
        * * Display Name: Entity Definition
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)`),
    RecordID: z.string().describe(`
        * * Field Name: RecordID
        * * Display Name: Target Record ID
        * * SQL Data Type: nvarchar(400)`),
    LinkType: z.string().nullable().describe(`
        * * Field Name: LinkType
        * * Display Name: Link Type
        * * SQL Data Type: nvarchar(50)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Entity: z.string().describe(`
        * * Field Name: Entity
        * * Display Name: Target Entity Name
        * * SQL Data Type: nvarchar(255)`),
});

export type mjBizAppsAccountingJournalEntryLinkEntityType = z.infer<typeof mjBizAppsAccountingJournalEntryLinkSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Journal Entry Sequences
 */
export const mjBizAppsAccountingJournalEntrySequenceSchema = z.object({
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: Company.`),
    FiscalYear: z.number().describe(`
        * * Field Name: FiscalYear
        * * Display Name: Fiscal Year
        * * SQL Data Type: int
        * * Description: Fiscal year. Sequence resets at fiscal-year boundaries (BA-D15).`),
    NextSequenceNumber: z.number().describe(`
        * * Field Name: NextSequenceNumber
        * * Display Name: Next Sequence Number
        * * SQL Data Type: int
        * * Default Value: 1
        * * Description: Next sequence number to assign (1-based). Atomically read and incremented under HOLDLOCK+UPDLOCK.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company
        * * SQL Data Type: nvarchar(50)`),
});

export type mjBizAppsAccountingJournalEntrySequenceEntityType = z.infer<typeof mjBizAppsAccountingJournalEntrySequenceSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Recurring Journal Entries
 */
export const mjBizAppsAccountingRecurringJournalEntrySchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    TemplateID: z.string().describe(`
        * * Field Name: TemplateID
        * * Display Name: Template
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Recurring Journal Entry Templates (vwRecurringJournalEntryTemplates.ID)
        * * Description: Template that this schedule emits.`),
    ScheduleCron: z.string().describe(`
        * * Field Name: ScheduleCron
        * * Display Name: Cron Schedule
        * * SQL Data Type: nvarchar(100)
        * * Description: Standard cron expression for the emit cadence.`),
    StartDate: z.date().describe(`
        * * Field Name: StartDate
        * * Display Name: Start Date
        * * SQL Data Type: date
        * * Description: Earliest date the schedule may emit.`),
    EndDate: z.date().nullable().describe(`
        * * Field Name: EndDate
        * * Display Name: End Date
        * * SQL Data Type: date
        * * Description: Last date the schedule may emit (NULL = open-ended).`),
    LastEmittedAt: z.date().nullable().describe(`
        * * Field Name: LastEmittedAt
        * * Display Name: Last Emitted At
        * * SQL Data Type: datetimeoffset
        * * Description: When this schedule last emitted a JE.`),
    NextScheduledAt: z.date().nullable().describe(`
        * * Field Name: NextScheduledAt
        * * Display Name: Next Scheduled At
        * * SQL Data Type: datetimeoffset
        * * Description: Computed next emit time based on ScheduleCron.`),
    RequiresApproval: z.boolean().describe(`
        * * Field Name: RequiresApproval
        * * Display Name: Requires Approval
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: If TRUE, emitted JEs are Pending awaiting approval before they can be batched.`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Whether the schedule is currently active.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Template: z.string().describe(`
        * * Field Name: Template
        * * Display Name: Template Name
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsAccountingRecurringJournalEntryEntityType = z.infer<typeof mjBizAppsAccountingRecurringJournalEntrySchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Recurring Journal Entry Template Lines
 */
export const mjBizAppsAccountingRecurringJournalEntryTemplateLineSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    TemplateID: z.string().describe(`
        * * Field Name: TemplateID
        * * Display Name: Template
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Recurring Journal Entry Templates (vwRecurringJournalEntryTemplates.ID)
        * * Description: Template this line belongs to.`),
    LineNumber: z.number().describe(`
        * * Field Name: LineNumber
        * * Display Name: Line Number
        * * SQL Data Type: int
        * * Description: Order of this line within the template (1-based).`),
    GLAccountID: z.string().describe(`
        * * Field Name: GLAccountID
        * * Display Name: GL Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: GLAccount the line posts to.`),
    DimensionTagsJson: z.string().nullable().describe(`
        * * Field Name: DimensionTagsJson
        * * Display Name: Dimension Tags
        * * SQL Data Type: nvarchar(MAX)
        * * Description: JSON object of {DimensionCode: DimensionValueCode} pairs to tag the emitted line with.`),
    IsDebitSide: z.boolean().describe(`
        * * Field Name: IsDebitSide
        * * Display Name: Is Debit
        * * SQL Data Type: bit
        * * Description: TRUE = this line posts as a Debit; FALSE = Credit.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Template: z.string().describe(`
        * * Field Name: Template
        * * Display Name: Template Name
        * * SQL Data Type: nvarchar(200)`),
    GLAccount: z.string().describe(`
        * * Field Name: GLAccount
        * * Display Name: GL Account Name
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsAccountingRecurringJournalEntryTemplateLineEntityType = z.infer<typeof mjBizAppsAccountingRecurringJournalEntryTemplateLineSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Recurring Journal Entry Templates
 */
export const mjBizAppsAccountingRecurringJournalEntryTemplateSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)
        * * Description: Display name (e.g. 'Monthly FX Revaluation', 'Office Lease Amortization').`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Detailed description of what the template emits and why.`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: Company that owns this template.`),
    EntryType: z.string().describe(`
        * * Field Name: EntryType
        * * Display Name: Entry Type
        * * SQL Data Type: nvarchar(40)
        * * Description: EntryType assigned to emitted JEs (FXRevaluation | PeriodEndAccrual | ...).`),
    AmountCalculationType: z.union([z.literal('ExternalLookup'), z.literal('Fixed'), z.literal('Formula')]).describe(`
        * * Field Name: AmountCalculationType
        * * Display Name: Calculation Method
        * * SQL Data Type: nvarchar(40)
        * * Default Value: Fixed
    * * Value List Type: List
    * * Possible Values 
    *   * ExternalLookup
    *   * Fixed
    *   * Formula
        * * Description: How the line amounts are determined: Fixed (AmountValue), Formula (AmountFormula), or ExternalLookup (engine fetches at emit time).`),
    AmountValue: z.number().nullable().describe(`
        * * Field Name: AmountValue
        * * Display Name: Fixed Amount
        * * SQL Data Type: decimal(18, 2)
        * * Description: Fixed amount when AmountCalculationType=Fixed.`),
    AmountFormula: z.string().nullable().describe(`
        * * Field Name: AmountFormula
        * * Display Name: Calculation Formula
        * * SQL Data Type: nvarchar(MAX)
        * * Description: SQL formula evaluated at emit time when AmountCalculationType=Formula. Must return a single decimal.`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Whether this template is currently active.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company Name
        * * SQL Data Type: nvarchar(50)`),
});

export type mjBizAppsAccountingRecurringJournalEntryTemplateEntityType = z.infer<typeof mjBizAppsAccountingRecurringJournalEntryTemplateSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Tax Authorities
 */
export const mjBizAppsAccountingTaxAuthoritySchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Authority Code
        * * SQL Data Type: nvarchar(40)
        * * Description: Globally unique authority code, e.g. 'US-IRS', 'CA-BOE', 'EU-VAT-DE'.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)
        * * Description: Display name for the authority.`),
    CountryCode: z.string().nullable().describe(`
        * * Field Name: CountryCode
        * * Display Name: Country
        * * SQL Data Type: char(2)
        * * Description: ISO 3166-1 alpha-2 country code for the authority's primary jurisdiction.`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Active
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Whether this authority is currently active.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_Latitude: z.number().nullable().describe(`
        * * Field Name: __mj_Latitude
        * * Display Name: Mj Latitude
        * * SQL Data Type: decimal(10, 6)`),
    __mj_Longitude: z.number().nullable().describe(`
        * * Field Name: __mj_Longitude
        * * Display Name: Mj Longitude
        * * SQL Data Type: decimal(10, 6)`),
});

export type mjBizAppsAccountingTaxAuthorityEntityType = z.infer<typeof mjBizAppsAccountingTaxAuthoritySchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Tax Jurisdictions
 */
export const mjBizAppsAccountingTaxJurisdictionSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    TaxAuthorityID: z.string().describe(`
        * * Field Name: TaxAuthorityID
        * * Display Name: Tax Authority
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Authorities (vwTaxAuthorities.ID)
        * * Description: TaxAuthority this jurisdiction belongs to.`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Jurisdiction Code
        * * SQL Data Type: nvarchar(80)
        * * Description: Globally unique jurisdiction code.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)
        * * Description: Display name (e.g. 'California State', 'Los Angeles County').`),
    CountryCode: z.string().nullable().describe(`
        * * Field Name: CountryCode
        * * Display Name: Country Code
        * * SQL Data Type: char(2)
        * * Description: ISO 3166-1 alpha-2 country code.`),
    RegionCode: z.string().nullable().describe(`
        * * Field Name: RegionCode
        * * Display Name: Region Code
        * * SQL Data Type: nvarchar(50)
        * * Description: State/province sub-national region, free-form (e.g. 'CA', 'NSW', 'Bavaria').`),
    PostalCode: z.string().nullable().describe(`
        * * Field Name: PostalCode
        * * Display Name: Postal Code
        * * SQL Data Type: nvarchar(20)
        * * Description: Specific postal code scoping (if exact match required).`),
    PostalCodeStart: z.string().nullable().describe(`
        * * Field Name: PostalCodeStart
        * * Display Name: Postal Code Start
        * * SQL Data Type: nvarchar(20)
        * * Description: Start of postal-code range when the jurisdiction covers a contiguous range.`),
    PostalCodeEnd: z.string().nullable().describe(`
        * * Field Name: PostalCodeEnd
        * * Display Name: Postal Code End
        * * SQL Data Type: nvarchar(20)
        * * Description: End of postal-code range.`),
    CityName: z.string().nullable().describe(`
        * * Field Name: CityName
        * * Display Name: City Name
        * * SQL Data Type: nvarchar(200)
        * * Description: City name scoping (if the jurisdiction is city-specific).`),
    ParentTaxJurisdictionID: z.string().nullable().describe(`
        * * Field Name: ParentTaxJurisdictionID
        * * Display Name: Parent Jurisdiction
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Jurisdictions (vwTaxJurisdictions.ID)
        * * Description: Parent jurisdiction for nested scopes (e.g. county inside state).`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Whether this jurisdiction is currently active.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    TaxAuthority: z.string().describe(`
        * * Field Name: TaxAuthority
        * * Display Name: Tax Authority Name
        * * SQL Data Type: nvarchar(200)`),
    ParentTaxJurisdiction: z.string().nullable().describe(`
        * * Field Name: ParentTaxJurisdiction
        * * Display Name: Parent Jurisdiction Name
        * * SQL Data Type: nvarchar(200)`),
    __mj_Latitude: z.number().nullable().describe(`
        * * Field Name: __mj_Latitude
        * * Display Name: Mj Latitude
        * * SQL Data Type: decimal(10, 6)`),
    __mj_Longitude: z.number().nullable().describe(`
        * * Field Name: __mj_Longitude
        * * Display Name: Mj Longitude
        * * SQL Data Type: decimal(10, 6)`),
    RootParentTaxJurisdictionID: z.string().nullable().describe(`
        * * Field Name: RootParentTaxJurisdictionID
        * * Display Name: Root Parent Jurisdiction
        * * SQL Data Type: uniqueidentifier`),
});

export type mjBizAppsAccountingTaxJurisdictionEntityType = z.infer<typeof mjBizAppsAccountingTaxJurisdictionSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Tax Liabilities
 */
export const mjBizAppsAccountingTaxLiabilitySchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: Company this liability belongs to.`),
    TaxAuthorityID: z.string().describe(`
        * * Field Name: TaxAuthorityID
        * * Display Name: Tax Authority
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Authorities (vwTaxAuthorities.ID)
        * * Description: TaxAuthority owed.`),
    TaxJurisdictionID: z.string().describe(`
        * * Field Name: TaxJurisdictionID
        * * Display Name: Tax Jurisdiction
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Jurisdictions (vwTaxJurisdictions.ID)
        * * Description: TaxJurisdiction the liability is scoped to.`),
    AccountingPeriodID: z.string().describe(`
        * * Field Name: AccountingPeriodID
        * * Display Name: Accounting Period
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Periods (vwAccountingPeriods.ID)
        * * Description: Period this liability is reported for.`),
    AccruedAmount: z.number().describe(`
        * * Field Name: AccruedAmount
        * * Display Name: Accrued Amount
        * * SQL Data Type: decimal(18, 2)
        * * Default Value: 0
        * * Description: Total tax accrued during the period (in functional currency).`),
    RemittedAmount: z.number().describe(`
        * * Field Name: RemittedAmount
        * * Display Name: Remitted Amount
        * * SQL Data Type: decimal(18, 2)
        * * Default Value: 0
        * * Description: Total amount remitted against this liability so far.`),
    Status: z.union([z.literal('Filed'), z.literal('Open'), z.literal('Paid'), z.literal('PartiallyPaid')]).describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(20)
        * * Default Value: Open
    * * Value List Type: List
    * * Possible Values 
    *   * Filed
    *   * Open
    *   * Paid
    *   * PartiallyPaid
        * * Description: Lifecycle: Open | Filed | Paid | PartiallyPaid.`),
    DueDate: z.date().nullable().describe(`
        * * Field Name: DueDate
        * * Display Name: Due Date
        * * SQL Data Type: date
        * * Description: Statutory due date for filing/remittance.`),
    FilingFrequency: z.union([z.literal('Annual'), z.literal('Monthly'), z.literal('OnDemand'), z.literal('Quarterly'), z.literal('SemiAnnual')]).nullable().describe(`
        * * Field Name: FilingFrequency
        * * Display Name: Filing Frequency
        * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Annual
    *   * Monthly
    *   * OnDemand
    *   * Quarterly
    *   * SemiAnnual
        * * Description: Filing cadence: Monthly | Quarterly | SemiAnnual | Annual | OnDemand.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company Name
        * * SQL Data Type: nvarchar(50)`),
    TaxAuthority: z.string().describe(`
        * * Field Name: TaxAuthority
        * * Display Name: Tax Authority Name
        * * SQL Data Type: nvarchar(200)`),
    TaxJurisdiction: z.string().describe(`
        * * Field Name: TaxJurisdiction
        * * Display Name: Tax Jurisdiction Name
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsAccountingTaxLiabilityEntityType = z.infer<typeof mjBizAppsAccountingTaxLiabilitySchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Tax Rates
 */
export const mjBizAppsAccountingTaxRateSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    TaxJurisdictionID: z.string().describe(`
        * * Field Name: TaxJurisdictionID
        * * Display Name: Tax Jurisdiction ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Jurisdictions (vwTaxJurisdictions.ID)
        * * Description: Jurisdiction this rate applies to.`),
    TaxCategory: z.union([z.literal('Custom'), z.literal('Exempt'), z.literal('Reduced'), z.literal('Standard'), z.literal('Zero')]).describe(`
        * * Field Name: TaxCategory
        * * Display Name: Tax Category
        * * SQL Data Type: nvarchar(50)
    * * Value List Type: List
    * * Possible Values 
    *   * Custom
    *   * Exempt
    *   * Reduced
    *   * Standard
    *   * Zero
        * * Description: Tax category: Standard | Reduced | Zero | Exempt | Custom.`),
    Rate: z.number().describe(`
        * * Field Name: Rate
        * * Display Name: Rate
        * * SQL Data Type: decimal(7, 4)
        * * Description: Rate as a decimal fraction. 0.0825 = 8.25%.`),
    EffectiveFrom: z.date().describe(`
        * * Field Name: EffectiveFrom
        * * Display Name: Effective From
        * * SQL Data Type: date
        * * Description: Earliest date this rate is effective.`),
    EffectiveTo: z.date().nullable().describe(`
        * * Field Name: EffectiveTo
        * * Display Name: Effective To
        * * SQL Data Type: date
        * * Description: Last date this rate is effective (NULL = open-ended).`),
    Source: z.union([z.literal('Avalara'), z.literal('Manual'), z.literal('TaxJar')]).describe(`
        * * Field Name: Source
        * * Display Name: Source
        * * SQL Data Type: nvarchar(50)
        * * Default Value: Manual
    * * Value List Type: List
    * * Possible Values 
    *   * Avalara
    *   * Manual
    *   * TaxJar
        * * Description: Source of the rate: Avalara | TaxJar | Manual.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    TaxJurisdiction: z.string().describe(`
        * * Field Name: TaxJurisdiction
        * * Display Name: Tax Jurisdiction
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsAccountingTaxRateEntityType = z.infer<typeof mjBizAppsAccountingTaxRateSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Tax Remittances
 */
export const mjBizAppsAccountingTaxRemittanceSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()
        * * Description: Unique identifier.`),
    TaxLiabilityID: z.string().describe(`
        * * Field Name: TaxLiabilityID
        * * Display Name: Tax Liability
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Liabilities (vwTaxLiabilities.ID)
        * * Description: Liability this payment is against.`),
    RemittedAmount: z.number().describe(`
        * * Field Name: RemittedAmount
        * * Display Name: Remitted Amount
        * * SQL Data Type: decimal(18, 2)
        * * Description: Amount remitted (functional currency).`),
    RemittedDate: z.date().describe(`
        * * Field Name: RemittedDate
        * * Display Name: Remitted Date
        * * SQL Data Type: date
        * * Description: Date the remittance was paid.`),
    PaymentReference: z.string().nullable().describe(`
        * * Field Name: PaymentReference
        * * Display Name: Payment Reference
        * * SQL Data Type: nvarchar(100)
        * * Description: External payment reference (wire ID, check number, confirmation code).`),
    PostedJournalEntryID: z.string().nullable().describe(`
        * * Field Name: PostedJournalEntryID
        * * Display Name: Posted Journal Entry
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
        * * Description: JE that records this remittance.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
});

export type mjBizAppsAccountingTaxRemittanceEntityType = z.infer<typeof mjBizAppsAccountingTaxRemittanceSchema>;
 
 

/**
 * MJ_BizApps_Accounting: Account Balance By Dimensions - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: AccountBalanceByDimension
 * * Base View: vwAccountBalanceByDimensions
 * * @description Materialized period-end balance with a composite dimension key. Supports analytical drilldowns (Dimension × DimensionValue) without scanning JournalEntryLine.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Account Balance By Dimensions')
export class mjBizAppsAccountingAccountBalanceByDimensionEntity extends BaseEntity<mjBizAppsAccountingAccountBalanceByDimensionEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Account Balance By Dimensions record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Account Balance By Dimensions record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingAccountBalanceByDimensionEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: Company this balance is for.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: GLAccountID
    * * Display Name: GL Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: GLAccount this balance is for.
    */
    get GLAccountID(): string {
        return this.Get('GLAccountID');
    }
    set GLAccountID(value: string) {
        this.Set('GLAccountID', value);
    }

    /**
    * * Field Name: AccountingPeriodID
    * * Display Name: Accounting Period
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Periods (vwAccountingPeriods.ID)
    * * Description: Period this balance is for.
    */
    get AccountingPeriodID(): string {
        return this.Get('AccountingPeriodID');
    }
    set AccountingPeriodID(value: string) {
        this.Set('AccountingPeriodID', value);
    }

    /**
    * * Field Name: DimensionValueTagsJson
    * * Display Name: Dimension Tags
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Composite dimension key as a normalized JSON object: {"Department":"Marketing","Region":"WestCoast",...}. Keys sorted alphabetically for stable hashing.
    */
    get DimensionValueTagsJson(): string {
        return this.Get('DimensionValueTagsJson');
    }
    set DimensionValueTagsJson(value: string) {
        this.Set('DimensionValueTagsJson', value);
    }

    /**
    * * Field Name: DimensionTagsHash
    * * Display Name: Dimension Hash
    * * SQL Data Type: char(64)
    * * Description: SHA-256 hash of DimensionValueTagsJson (UPPER hex, no separators) used as part of the unique key. Stored as CHAR(64) for fast UNIQUE lookups.
    */
    get DimensionTagsHash(): string {
        return this.Get('DimensionTagsHash');
    }
    set DimensionTagsHash(value: string) {
        this.Set('DimensionTagsHash', value);
    }

    /**
    * * Field Name: PeriodEndBalance
    * * Display Name: Period End Balance
    * * SQL Data Type: decimal(18, 2)
    * * Description: Ending balance for the period for this dimension slice (functional currency).
    */
    get PeriodEndBalance(): number {
        return this.Get('PeriodEndBalance');
    }
    set PeriodEndBalance(value: number) {
        this.Set('PeriodEndBalance', value);
    }

    /**
    * * Field Name: CurrencyCode
    * * Display Name: Currency Code
    * * SQL Data Type: char(3)
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
    * * Description: Currency the balance is expressed in.
    */
    get CurrencyCode(): string {
        return this.Get('CurrencyCode');
    }
    set CurrencyCode(value: string) {
        this.Set('CurrencyCode', value);
    }

    /**
    * * Field Name: ComputedAt
    * * Display Name: Computed At
    * * SQL Data Type: datetimeoffset
    * * Default Value: sysdatetimeoffset()
    * * Description: When the materialization ran.
    */
    get ComputedAt(): Date {
        return this.Get('ComputedAt');
    }
    set ComputedAt(value: Date) {
        this.Set('ComputedAt', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company Name
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }

    /**
    * * Field Name: GLAccount
    * * Display Name: GL Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get GLAccount(): string {
        return this.Get('GLAccount');
    }

    /**
    * * Field Name: CurrencyCode_Virtual
    * * Display Name: Currency
    * * SQL Data Type: nvarchar(80)
    */
    get CurrencyCode_Virtual(): string {
        return this.Get('CurrencyCode_Virtual');
    }
}


/**
 * MJ_BizApps_Accounting: Account Balances - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: AccountBalance
 * * Base View: vwAccountBalances
 * * @description Materialized period-end balance per Company × GLAccount × AccountingPeriod. Per BA-D22, only subledger accounts are materialized; computed at period close. Open-period balances are computed on demand from JournalEntryLine, not stored here.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Account Balances')
export class mjBizAppsAccountingAccountBalanceEntity extends BaseEntity<mjBizAppsAccountingAccountBalanceEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Account Balances record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Account Balances record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingAccountBalanceEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: Company this balance is for.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: GLAccountID
    * * Display Name: GL Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: GLAccount this balance is for.
    */
    get GLAccountID(): string {
        return this.Get('GLAccountID');
    }
    set GLAccountID(value: string) {
        this.Set('GLAccountID', value);
    }

    /**
    * * Field Name: AccountingPeriodID
    * * Display Name: Accounting Period
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Periods (vwAccountingPeriods.ID)
    * * Description: Period this balance is the ending value for.
    */
    get AccountingPeriodID(): string {
        return this.Get('AccountingPeriodID');
    }
    set AccountingPeriodID(value: string) {
        this.Set('AccountingPeriodID', value);
    }

    /**
    * * Field Name: PeriodEndBalance
    * * Display Name: Period End Balance
    * * SQL Data Type: decimal(18, 2)
    * * Description: Ending balance for the period (functional currency).
    */
    get PeriodEndBalance(): number {
        return this.Get('PeriodEndBalance');
    }
    set PeriodEndBalance(value: number) {
        this.Set('PeriodEndBalance', value);
    }

    /**
    * * Field Name: CurrencyCode
    * * Display Name: Currency
    * * SQL Data Type: char(3)
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
    * * Description: Currency the balance is expressed in (Company's functional currency).
    */
    get CurrencyCode(): string {
        return this.Get('CurrencyCode');
    }
    set CurrencyCode(value: string) {
        this.Set('CurrencyCode', value);
    }

    /**
    * * Field Name: ComputedAt
    * * Display Name: Computed At
    * * SQL Data Type: datetimeoffset
    * * Default Value: sysdatetimeoffset()
    * * Description: When the materialization ran.
    */
    get ComputedAt(): Date {
        return this.Get('ComputedAt');
    }
    set ComputedAt(value: Date) {
        this.Set('ComputedAt', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company Name
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }

    /**
    * * Field Name: GLAccount
    * * Display Name: GL Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get GLAccount(): string {
        return this.Get('GLAccount');
    }

    /**
    * * Field Name: CurrencyCode_Virtual
    * * Display Name: Currency (Display)
    * * SQL Data Type: nvarchar(80)
    */
    get CurrencyCode_Virtual(): string {
        return this.Get('CurrencyCode_Virtual');
    }
}


/**
 * MJ_BizApps_Accounting: Accounting Company Profiles - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: AccountingCompanyProfile
 * * Base View: vwAccountingCompanyProfiles
 * * @description IsA Disjoint child of __mj.Company (same UUID as the parent). Holds all Company-attribute extensions required by Accounting: business profile (EntityType, LegalStructure, jurisdiction, tax ID) and accounting-specific settings (functional currency, fiscal year, default GL accounts). MJ core stays minimal; nothing accounting-flavored leaks into it (BA-D9).
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Accounting Company Profiles')
export class mjBizAppsAccountingAccountingCompanyProfileEntity extends BaseEntity<mjBizAppsAccountingAccountingCompanyProfileEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Accounting Company Profiles record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Accounting Company Profiles record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingAccountingCompanyProfileEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Accounting Company Profiles entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * CompanyCode: The company code must be between 2 and 20 characters in length, written entirely in uppercase, and contain only letters, numbers, hyphens, and underscores.
    * * FiscalYearStartDay: The fiscal year start day must be a valid day of the month, between 1 and 31 inclusive.
    * * FiscalYearStartMonth: The fiscal year start month must be a valid calendar month between 1 (January) and 12 (December).
    * * Table-Level: A company cannot be assigned as its own parent accounting company to prevent circular reference loops in the organizational hierarchy.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateCompanyCodeFormat(result);
        this.ValidateFiscalYearStartDayRange(result);
        this.ValidateFiscalYearStartMonthRange(result);
        this.ValidateParentAccountingCompanyIDNotEqualToID(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The company code must be between 2 and 20 characters in length, written entirely in uppercase, and contain only letters, numbers, hyphens, and underscores.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    	public ValidateCompanyCodeFormat(result: ValidationResult) {
    		if (this.CompanyCode != null) {
    			const value = this.CompanyCode;
    			const isUppercase = value === value.toUpperCase();
    			const hasValidLength = value.length >= 2 && value.length <= 20;
    			const hasValidChars = /^[A-Z0-9_-]+$/.test(value);
    
    			if (!isUppercase || !hasValidLength || !hasValidChars) {
    				result.Errors.push(new ValidationErrorInfo(
    					"CompanyCode",
    					"Company Code must be between 2 and 20 characters, in uppercase, and contain only letters, numbers, hyphens, and underscores.",
    					this.CompanyCode,
    					ValidationErrorType.Failure
    				));
    			}
    		}
    	}

    /**
    * The fiscal year start day must be a valid day of the month, between 1 and 31 inclusive.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateFiscalYearStartDayRange(result: ValidationResult) {
    	if (this.FiscalYearStartDay !== null && this.FiscalYearStartDay !== undefined) {
    		if (this.FiscalYearStartDay < 1 || this.FiscalYearStartDay > 31) {
    			result.Errors.push(new ValidationErrorInfo(
    				"FiscalYearStartDay",
    				"Fiscal year start day must be between 1 and 31.",
    				this.FiscalYearStartDay,
    				ValidationErrorType.Failure
    			));
    		}
    	}
    }

    /**
    * The fiscal year start month must be a valid calendar month between 1 (January) and 12 (December).
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    	public ValidateFiscalYearStartMonthRange(result: ValidationResult) {
    		if (this.FiscalYearStartMonth != null && (this.FiscalYearStartMonth < 1 || this.FiscalYearStartMonth > 12)) {
    			result.Errors.push(new ValidationErrorInfo(
    				"FiscalYearStartMonth",
    				"Fiscal year start month must be a valid calendar month between 1 and 12.",
    				this.FiscalYearStartMonth,
    				ValidationErrorType.Failure
    			));
    		}
    	}

    /**
    * A company cannot be assigned as its own parent accounting company to prevent circular reference loops in the organizational hierarchy.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    	public ValidateParentAccountingCompanyIDNotEqualToID(result: ValidationResult) {
    		if (this.ParentAccountingCompanyID != null && this.ParentAccountingCompanyID === this.ID) {
    			result.Errors.push(new ValidationErrorInfo(
    				"ParentAccountingCompanyID",
    				"A company cannot be its own parent accounting company.",
    				this.ParentAccountingCompanyID,
    				ValidationErrorType.Failure
    			));
    		}
    	}

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: Primary key AND foreign key to __mj.Company.ID. Same UUID as the parent Company row — this is the IsA pattern (BA-D9).
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: EntityType
    * * Display Name: Entity Type
    * * SQL Data Type: nvarchar(30)
    * * Default Value: Subsidiary
    * * Value List Type: List
    * * Possible Values 
    *   * Branch
    *   * CostCenter
    *   * Department
    *   * Division
    *   * JointVenture
    *   * LegalEntity
    *   * Other
    *   * Partner
    *   * Subsidiary
    * * Description: What kind of entity this is in the accounting structure: LegalEntity | Subsidiary | Division | Department | Branch | Partner | JointVenture | CostCenter | Other.
    */
    get EntityType(): 'Branch' | 'CostCenter' | 'Department' | 'Division' | 'JointVenture' | 'LegalEntity' | 'Other' | 'Partner' | 'Subsidiary' {
        return this.Get('EntityType');
    }
    set EntityType(value: 'Branch' | 'CostCenter' | 'Department' | 'Division' | 'JointVenture' | 'LegalEntity' | 'Other' | 'Partner' | 'Subsidiary') {
        this.Set('EntityType', value);
    }

    /**
    * * Field Name: LegalStructureType
    * * Display Name: Legal Structure
    * * SQL Data Type: nvarchar(30)
    * * Value List Type: List
    * * Possible Values 
    *   * C-Corp
    *   * International-GmbH
    *   * International-Ltd
    *   * International-Other
    *   * International-Pty
    *   * LLC
    *   * NonProfit-501c3
    *   * NonProfit-501c6
    *   * Other
    *   * Partnership
    *   * S-Corp
    *   * SoleProprietorship
    * * Description: Legal structure: LLC | C-Corp | S-Corp | Partnership | SoleProprietorship | NonProfit-501c3 | NonProfit-501c6 | International-Ltd | International-GmbH | International-Pty | International-Other | Other. Only meaningful when EntityType is a legal entity / subsidiary / partner.
    */
    get LegalStructureType(): 'C-Corp' | 'International-GmbH' | 'International-Ltd' | 'International-Other' | 'International-Pty' | 'LLC' | 'NonProfit-501c3' | 'NonProfit-501c6' | 'Other' | 'Partnership' | 'S-Corp' | 'SoleProprietorship' | null {
        return this.Get('LegalStructureType');
    }
    set LegalStructureType(value: 'C-Corp' | 'International-GmbH' | 'International-Ltd' | 'International-Other' | 'International-Pty' | 'LLC' | 'NonProfit-501c3' | 'NonProfit-501c6' | 'Other' | 'Partnership' | 'S-Corp' | 'SoleProprietorship' | null) {
        this.Set('LegalStructureType', value);
    }

    /**
    * * Field Name: IncorporationDate
    * * Display Name: Incorporation Date
    * * SQL Data Type: date
    * * Description: Date the entity was legally incorporated/registered.
    */
    get IncorporationDate(): Date | null {
        return this.Get('IncorporationDate');
    }
    set IncorporationDate(value: Date | null) {
        this.Set('IncorporationDate', value);
    }

    /**
    * * Field Name: JurisdictionCountry
    * * Display Name: Jurisdiction Country
    * * SQL Data Type: char(2)
    * * Description: ISO 3166-1 alpha-2 country code where this entity is incorporated. Free-form; not FK-constrained to keep dependency on geography modeling clean.
    */
    get JurisdictionCountry(): string | null {
        return this.Get('JurisdictionCountry');
    }
    set JurisdictionCountry(value: string | null) {
        this.Set('JurisdictionCountry', value);
    }

    /**
    * * Field Name: JurisdictionRegion
    * * Display Name: Jurisdiction Region
    * * SQL Data Type: nvarchar(50)
    * * Description: State/province sub-national region, free-form.
    */
    get JurisdictionRegion(): string | null {
        return this.Get('JurisdictionRegion');
    }
    set JurisdictionRegion(value: string | null) {
        this.Set('JurisdictionRegion', value);
    }

    /**
    * * Field Name: FederalTaxID
    * * Display Name: Federal Tax ID
    * * SQL Data Type: nvarchar(40)
    * * Description: Federal tax identifier — EIN (US), ABN (Australia), VAT registration (EU), etc.
    */
    get FederalTaxID(): string | null {
        return this.Get('FederalTaxID');
    }
    set FederalTaxID(value: string | null) {
        this.Set('FederalTaxID', value);
    }

    /**
    * * Field Name: CompanyCode
    * * Display Name: Company Code
    * * SQL Data Type: nvarchar(20)
    * * Description: Short code used in JE numbering ('JE-{CompanyCode}-{FY}-{seq}'). Uppercase alphanumeric + dash/underscore. UNIQUE per deployment (BA-D15).
    */
    get CompanyCode(): string {
        return this.Get('CompanyCode');
    }
    set CompanyCode(value: string) {
        this.Set('CompanyCode', value);
    }

    /**
    * * Field Name: FunctionalCurrencyCode
    * * Display Name: Functional Currency
    * * SQL Data Type: char(3)
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
    * * Description: ISO 4217 currency code (CHAR(3)) for the functional currency. All JEs post in this currency; original-currency triple on JE lines records the source-transaction currency when different (BA-D10).
    */
    get FunctionalCurrencyCode(): string {
        return this.Get('FunctionalCurrencyCode');
    }
    set FunctionalCurrencyCode(value: string) {
        this.Set('FunctionalCurrencyCode', value);
    }

    /**
    * * Field Name: ReportingCurrencyCode
    * * Display Name: Reporting Currency
    * * SQL Data Type: char(3)
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
    * * Description: Reporting currency for consolidation. NULL = same as functional currency.
    */
    get ReportingCurrencyCode(): string | null {
        return this.Get('ReportingCurrencyCode');
    }
    set ReportingCurrencyCode(value: string | null) {
        this.Set('ReportingCurrencyCode', value);
    }

    /**
    * * Field Name: FiscalYearStartMonth
    * * Display Name: Fiscal Year Start Month
    * * SQL Data Type: tinyint
    * * Default Value: 1
    * * Description: Calendar month (1-12) when the fiscal year begins. Default 1 (Jan-start calendar).
    */
    get FiscalYearStartMonth(): number {
        return this.Get('FiscalYearStartMonth');
    }
    set FiscalYearStartMonth(value: number) {
        this.Set('FiscalYearStartMonth', value);
    }

    /**
    * * Field Name: FiscalYearStartDay
    * * Display Name: Fiscal Year Start Day
    * * SQL Data Type: tinyint
    * * Default Value: 1
    * * Description: Calendar day-of-month (1-31) when the fiscal year begins. Default 1.
    */
    get FiscalYearStartDay(): number {
        return this.Get('FiscalYearStartDay');
    }
    set FiscalYearStartDay(value: number) {
        this.Set('FiscalYearStartDay', value);
    }

    /**
    * * Field Name: ParentAccountingCompanyID
    * * Display Name: Parent Accounting Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Company Profiles (vwAccountingCompanyProfiles.ID)
    * * Description: If set, this profile uses the books (COA, periods, JEs) of the referenced profile (consolidated reporting). Chains are forbidden: the referenced profile must NOT itself have a parent (BA-D9; trigger trg_ACP_NoChains).
    */
    get ParentAccountingCompanyID(): string | null {
        return this.Get('ParentAccountingCompanyID');
    }
    set ParentAccountingCompanyID(value: string | null) {
        this.Set('ParentAccountingCompanyID', value);
    }

    /**
    * * Field Name: DefaultPaymentTermsTypeID
    * * Display Name: Default Payment Terms
    * * SQL Data Type: uniqueidentifier
    * * Description: Default payment terms type for new orders/invoices. FK delegated to BizAppsOrders.PaymentTermsType (soft ref; no FK constraint).
    */
    get DefaultPaymentTermsTypeID(): string | null {
        return this.Get('DefaultPaymentTermsTypeID');
    }
    set DefaultPaymentTermsTypeID(value: string | null) {
        this.Set('DefaultPaymentTermsTypeID', value);
    }

    /**
    * * Field Name: AROpenGLAccountID
    * * Display Name: AR GL Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: Which GLAccount represents this company's primary Accounts Receivable. Wired by spSeedDefaultChartOfAccounts.
    */
    get AROpenGLAccountID(): string | null {
        return this.Get('AROpenGLAccountID');
    }
    set AROpenGLAccountID(value: string | null) {
        this.Set('AROpenGLAccountID', value);
    }

    /**
    * * Field Name: DeferredRevenueGLAccountID
    * * Display Name: Deferred Revenue GL Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: Which GLAccount represents this company's Deferred Revenue.
    */
    get DeferredRevenueGLAccountID(): string | null {
        return this.Get('DeferredRevenueGLAccountID');
    }
    set DeferredRevenueGLAccountID(value: string | null) {
        this.Set('DeferredRevenueGLAccountID', value);
    }

    /**
    * * Field Name: SalesTaxPayableGLAccountID
    * * Display Name: Sales Tax Payable GL Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: Which GLAccount represents Sales Tax Payable for accrual.
    */
    get SalesTaxPayableGLAccountID(): string | null {
        return this.Get('SalesTaxPayableGLAccountID');
    }
    set SalesTaxPayableGLAccountID(value: string | null) {
        this.Set('SalesTaxPayableGLAccountID', value);
    }

    /**
    * * Field Name: RealizedFXGainLossGLAccountID
    * * Display Name: Realized FX Gain/Loss GL Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: GLAccount used by the FX engine to record realized FX gains/losses on payment-to-AR rate mismatch (BA-D10).
    */
    get RealizedFXGainLossGLAccountID(): string | null {
        return this.Get('RealizedFXGainLossGLAccountID');
    }
    set RealizedFXGainLossGLAccountID(value: string | null) {
        this.Set('RealizedFXGainLossGLAccountID', value);
    }

    /**
    * * Field Name: UnrealizedFXGainLossGLAccountID
    * * Display Name: Unrealized FX Gain/Loss GL Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: GLAccount used by the period-end FX revaluation template to record unrealized FX adjustments.
    */
    get UnrealizedFXGainLossGLAccountID(): string | null {
        return this.Get('UnrealizedFXGainLossGLAccountID');
    }
    set UnrealizedFXGainLossGLAccountID(value: string | null) {
        this.Set('UnrealizedFXGainLossGLAccountID', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Whether this profile is currently active. Inactive companies cannot have new JEs.
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Name
    * * Display Name: Company Name
    * * SQL Data Type: nvarchar(50)
    * * IS-A Source: Inherited from MJ: Companies
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(200)
    * * IS-A Source: Inherited from MJ: Companies
    */
    get Description(): string {
        return this.Get('Description');
    }
    set Description(value: string) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: Website
    * * Display Name: Website
    * * SQL Data Type: nvarchar(100)
    * * IS-A Source: Inherited from MJ: Companies
    */
    get Website(): string | null {
        return this.Get('Website');
    }
    set Website(value: string | null) {
        this.Set('Website', value);
    }

    /**
    * * Field Name: LogoURL
    * * Display Name: Logo URL
    * * SQL Data Type: nvarchar(500)
    * * IS-A Source: Inherited from MJ: Companies
    */
    get LogoURL(): string | null {
        return this.Get('LogoURL');
    }
    set LogoURL(value: string | null) {
        this.Set('LogoURL', value);
    }

    /**
    * * Field Name: Domain
    * * Display Name: Domain
    * * SQL Data Type: nvarchar(255)
    * * IS-A Source: Inherited from MJ: Companies
    */
    get Domain(): string | null {
        return this.Get('Domain');
    }
    set Domain(value: string | null) {
        this.Set('Domain', value);
    }

    /**
    * * Field Name: FunctionalCurrencyCode_Virtual
    * * Display Name: Functional Currency (Display)
    * * SQL Data Type: nvarchar(80)
    */
    get FunctionalCurrencyCode_Virtual(): string {
        return this.Get('FunctionalCurrencyCode_Virtual');
    }

    /**
    * * Field Name: ReportingCurrencyCode_Virtual
    * * Display Name: Reporting Currency (Display)
    * * SQL Data Type: nvarchar(80)
    */
    get ReportingCurrencyCode_Virtual(): string | null {
        return this.Get('ReportingCurrencyCode_Virtual');
    }

    /**
    * * Field Name: AROpenGLAccount
    * * Display Name: AR GL Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get AROpenGLAccount(): string | null {
        return this.Get('AROpenGLAccount');
    }

    /**
    * * Field Name: DeferredRevenueGLAccount
    * * Display Name: Deferred Revenue GL Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get DeferredRevenueGLAccount(): string | null {
        return this.Get('DeferredRevenueGLAccount');
    }

    /**
    * * Field Name: SalesTaxPayableGLAccount
    * * Display Name: Sales Tax Payable GL Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get SalesTaxPayableGLAccount(): string | null {
        return this.Get('SalesTaxPayableGLAccount');
    }

    /**
    * * Field Name: RealizedFXGainLossGLAccount
    * * Display Name: Realized FX Gain/Loss GL Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get RealizedFXGainLossGLAccount(): string | null {
        return this.Get('RealizedFXGainLossGLAccount');
    }

    /**
    * * Field Name: UnrealizedFXGainLossGLAccount
    * * Display Name: Unrealized FX Gain/Loss GL Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get UnrealizedFXGainLossGLAccount(): string | null {
        return this.Get('UnrealizedFXGainLossGLAccount');
    }

    /**
    * * Field Name: __mj_Latitude
    * * Display Name: Mj Latitude
    * * SQL Data Type: decimal(10, 6)
    */
    get __mj_Latitude(): number | null {
        return this.Get('__mj_Latitude');
    }

    /**
    * * Field Name: __mj_Longitude
    * * Display Name: Mj Longitude
    * * SQL Data Type: decimal(10, 6)
    */
    get __mj_Longitude(): number | null {
        return this.Get('__mj_Longitude');
    }

    /**
    * * Field Name: RootParentAccountingCompanyID
    * * Display Name: Root Parent Company
    * * SQL Data Type: uniqueidentifier
    */
    get RootParentAccountingCompanyID(): string | null {
        return this.Get('RootParentAccountingCompanyID');
    }
}


/**
 * MJ_BizApps_Accounting: Accounting Periods - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: AccountingPeriod
 * * Base View: vwAccountingPeriods
 * * @description Per-Company accounting period (Month/Quarter/Year). Hard-close semantics per BA-D13: once Status=Closed, no JE may post with EffectiveDate in this period unless flagged as an adjusting entry (OriginalAccountingPeriodID set).
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Accounting Periods')
export class mjBizAppsAccountingAccountingPeriodEntity extends BaseEntity<mjBizAppsAccountingAccountingPeriodEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Accounting Periods record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Accounting Periods record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingAccountingPeriodEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Accounting Periods entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * FiscalMonth: If a fiscal month is specified, it must be a valid month number between 1 and 12.
    * * FiscalQuarter: The fiscal quarter, if specified, must be a number between 1 and 4 to ensure accurate financial reporting.
    * * Table-Level: A closed date must be provided if the status is Reopened or Closed, and must not be set for any other status.
    * * Table-Level: The period end date must be on or after the period start date to ensure a valid date range.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateFiscalMonthRange(result);
        this.ValidateFiscalQuarterRange(result);
        this.ValidateClosedAtComparedToStatus(result);
        this.ValidatePeriodEndGreaterThanOrEqualToPeriodStart(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * If a fiscal month is specified, it must be a valid month number between 1 and 12.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateFiscalMonthRange(result: ValidationResult) {
    	if (this.FiscalMonth != null && (this.FiscalMonth < 1 || this.FiscalMonth > 12)) {
    		result.Errors.push(new ValidationErrorInfo(
    			"FiscalMonth",
    			"Fiscal month must be a number between 1 and 12.",
    			this.FiscalMonth,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * The fiscal quarter, if specified, must be a number between 1 and 4 to ensure accurate financial reporting.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateFiscalQuarterRange(result: ValidationResult) {
    	if (this.FiscalQuarter != null && (this.FiscalQuarter < 1 || this.FiscalQuarter > 4)) {
    		result.Errors.push(new ValidationErrorInfo(
    			"FiscalQuarter",
    			"Fiscal Quarter must be between 1 and 4.",
    			this.FiscalQuarter,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * A closed date must be provided if the status is Reopened or Closed, and must not be set for any other status.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateClosedAtComparedToStatus(result: ValidationResult) {
    	const isClosedOrReopened = this.Status === "Reopened" || this.Status === "Closed";
    	if (isClosedOrReopened && this.ClosedAt == null) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ClosedAt",
    			"A closed date must be provided when the status is Reopened or Closed.",
    			this.ClosedAt,
    			ValidationErrorType.Failure
    		));
    	} else if (!isClosedOrReopened && this.ClosedAt != null) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ClosedAt",
    			"A closed date cannot be set when the status is " + this.Status + ". It must only be set for Reopened or Closed statuses.",
    			this.ClosedAt,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * The period end date must be on or after the period start date to ensure a valid date range.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidatePeriodEndGreaterThanOrEqualToPeriodStart(result: ValidationResult) {
    	if (this.PeriodStart != null && this.PeriodEnd != null && this.PeriodEnd < this.PeriodStart) {
    		result.Errors.push(new ValidationErrorInfo(
    			"PeriodEnd",
    			"The Period End date must be greater than or equal to the Period Start date.",
    			this.PeriodEnd,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: Company that owns this period.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: PeriodType
    * * Display Name: Period Type
    * * SQL Data Type: nvarchar(10)
    * * Value List Type: List
    * * Possible Values 
    *   * Month
    *   * Quarter
    *   * Year
    * * Description: Period granularity: Month | Quarter | Year.
    */
    get PeriodType(): 'Month' | 'Quarter' | 'Year' {
        return this.Get('PeriodType');
    }
    set PeriodType(value: 'Month' | 'Quarter' | 'Year') {
        this.Set('PeriodType', value);
    }

    /**
    * * Field Name: PeriodStart
    * * Display Name: Period Start
    * * SQL Data Type: date
    * * Description: Period start date (inclusive).
    */
    get PeriodStart(): Date {
        return this.Get('PeriodStart');
    }
    set PeriodStart(value: Date) {
        this.Set('PeriodStart', value);
    }

    /**
    * * Field Name: PeriodEnd
    * * Display Name: Period End
    * * SQL Data Type: date
    * * Description: Period end date (inclusive).
    */
    get PeriodEnd(): Date {
        return this.Get('PeriodEnd');
    }
    set PeriodEnd(value: Date) {
        this.Set('PeriodEnd', value);
    }

    /**
    * * Field Name: FiscalYear
    * * Display Name: Fiscal Year
    * * SQL Data Type: int
    * * Description: Fiscal year (e.g. 2026). Distinct from calendar year when the FY starts in another month.
    */
    get FiscalYear(): number {
        return this.Get('FiscalYear');
    }
    set FiscalYear(value: number) {
        this.Set('FiscalYear', value);
    }

    /**
    * * Field Name: FiscalQuarter
    * * Display Name: Fiscal Quarter
    * * SQL Data Type: tinyint
    * * Description: Fiscal quarter (1-4). Set for Month and Quarter rows; NULL for Year.
    */
    get FiscalQuarter(): number | null {
        return this.Get('FiscalQuarter');
    }
    set FiscalQuarter(value: number | null) {
        this.Set('FiscalQuarter', value);
    }

    /**
    * * Field Name: FiscalMonth
    * * Display Name: Fiscal Month
    * * SQL Data Type: tinyint
    * * Description: Fiscal month (1-12). Set for Month rows only.
    */
    get FiscalMonth(): number | null {
        return this.Get('FiscalMonth');
    }
    set FiscalMonth(value: number | null) {
        this.Set('FiscalMonth', value);
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(20)
    * * Default Value: Open
    * * Value List Type: List
    * * Possible Values 
    *   * Closed
    *   * Closing
    *   * Open
    *   * Reopened
    * * Description: Lifecycle: Open | Closing | Closed | Reopened. Hard close blocks JE posts (trg_JournalEntry_PeriodClose).
    */
    get Status(): 'Closed' | 'Closing' | 'Open' | 'Reopened' {
        return this.Get('Status');
    }
    set Status(value: 'Closed' | 'Closing' | 'Open' | 'Reopened') {
        this.Set('Status', value);
    }

    /**
    * * Field Name: ClosedAt
    * * Display Name: Closed At
    * * SQL Data Type: datetimeoffset
    * * Description: When the period was closed.
    */
    get ClosedAt(): Date | null {
        return this.Get('ClosedAt');
    }
    set ClosedAt(value: Date | null) {
        this.Set('ClosedAt', value);
    }

    /**
    * * Field Name: ClosedByUserID
    * * Display Name: Closed By User ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    * * Description: User who closed the period.
    */
    get ClosedByUserID(): string | null {
        return this.Get('ClosedByUserID');
    }
    set ClosedByUserID(value: string | null) {
        this.Set('ClosedByUserID', value);
    }

    /**
    * * Field Name: ReopenReason
    * * Display Name: Reopen Reason
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Required justification when an admin reopens a closed period (BA-D13).
    */
    get ReopenReason(): string | null {
        return this.Get('ReopenReason');
    }
    set ReopenReason(value: string | null) {
        this.Set('ReopenReason', value);
    }

    /**
    * * Field Name: ReopenedAt
    * * Display Name: Reopened At
    * * SQL Data Type: datetimeoffset
    * * Description: When the period was last reopened.
    */
    get ReopenedAt(): Date | null {
        return this.Get('ReopenedAt');
    }
    set ReopenedAt(value: Date | null) {
        this.Set('ReopenedAt', value);
    }

    /**
    * * Field Name: ReopenedByUserID
    * * Display Name: Reopened By User ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    * * Description: User who last reopened the period.
    */
    get ReopenedByUserID(): string | null {
        return this.Get('ReopenedByUserID');
    }
    set ReopenedByUserID(value: string | null) {
        this.Set('ReopenedByUserID', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company Name
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }

    /**
    * * Field Name: ClosedByUser
    * * Display Name: Closed By User
    * * SQL Data Type: nvarchar(100)
    */
    get ClosedByUser(): string | null {
        return this.Get('ClosedByUser');
    }

    /**
    * * Field Name: ReopenedByUser
    * * Display Name: Reopened By User
    * * SQL Data Type: nvarchar(100)
    */
    get ReopenedByUser(): string | null {
        return this.Get('ReopenedByUser');
    }
}


/**
 * MJ_BizApps_Accounting: Chart Of Accounts Mappings - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: ChartOfAccountsMapping
 * * Base View: vwChartOfAccountsMappings
 * * @description Maps an internal GLAccount to an external ERP account code. Required so a Batch can ship JE postings with the right external IDs. Admin approval enforced per master plan M16/D27 (unmapped accounts hard-fail at batch time).
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Chart Of Accounts Mappings')
export class mjBizAppsAccountingChartOfAccountsMappingEntity extends BaseEntity<mjBizAppsAccountingChartOfAccountsMappingEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Chart Of Accounts Mappings record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Chart Of Accounts Mappings record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingChartOfAccountsMappingEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Chart Of Accounts Mappings entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Table-Level: Approval date and the approving user must either both be provided or both be empty. An approval cannot have a date without a user, or a user without a date.
    * * Table-Level: The end date (Effective To) must be on or after the start date (Effective From) to ensure a valid active period.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateApprovedAtAndApprovedByUserID(result);
        this.ValidateEffectiveToGreaterThanOrEqualToEffectiveFrom(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * Approval date and the approving user must either both be provided or both be empty. An approval cannot have a date without a user, or a user without a date.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateApprovedAtAndApprovedByUserID(result: ValidationResult) {
    	const hasApprovedAt = this.ApprovedAt != null;
    	const hasApprovedBy = this.ApprovedByUserID != null;
    
    	if (hasApprovedAt !== hasApprovedBy) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ApprovedAt",
    			"Both Approval Date and Approved By User must be provided together, or both must be empty.",
    			this.ApprovedAt,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * The end date (Effective To) must be on or after the start date (Effective From) to ensure a valid active period.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateEffectiveToGreaterThanOrEqualToEffectiveFrom(result: ValidationResult) {
    	if (this.EffectiveTo != null && this.EffectiveFrom != null) {
    		const effectiveToDate = new Date(this.EffectiveTo);
    		const effectiveFromDate = new Date(this.EffectiveFrom);
    		if (effectiveToDate < effectiveFromDate) {
    			result.Errors.push(new ValidationErrorInfo(
    				"EffectiveTo",
    				"The end date (Effective To) must be on or after the start date (Effective From).",
    				this.EffectiveTo,
    				ValidationErrorType.Failure
    			));
    		}
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: Company this mapping is for.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: ExternalSystem
    * * Display Name: External System
    * * SQL Data Type: nvarchar(50)
    * * Description: Target ERP system the mapping is for.
    */
    get ExternalSystem(): string {
        return this.Get('ExternalSystem');
    }
    set ExternalSystem(value: string) {
        this.Set('ExternalSystem', value);
    }

    /**
    * * Field Name: ExternalAccountID
    * * Display Name: External Account ID
    * * SQL Data Type: nvarchar(100)
    * * Description: Account identifier as known to the external ERP.
    */
    get ExternalAccountID(): string {
        return this.Get('ExternalAccountID');
    }
    set ExternalAccountID(value: string) {
        this.Set('ExternalAccountID', value);
    }

    /**
    * * Field Name: ExternalAccountName
    * * Display Name: External Account Name
    * * SQL Data Type: nvarchar(200)
    * * Description: Display name of the external account (snapshot for audit).
    */
    get ExternalAccountName(): string | null {
        return this.Get('ExternalAccountName');
    }
    set ExternalAccountName(value: string | null) {
        this.Set('ExternalAccountName', value);
    }

    /**
    * * Field Name: InternalGLAccountID
    * * Display Name: Internal GL Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: Internal GLAccount this external account maps to.
    */
    get InternalGLAccountID(): string {
        return this.Get('InternalGLAccountID');
    }
    set InternalGLAccountID(value: string) {
        this.Set('InternalGLAccountID', value);
    }

    /**
    * * Field Name: EffectiveFrom
    * * Display Name: Effective From
    * * SQL Data Type: date
    * * Description: Earliest date this mapping is in effect.
    */
    get EffectiveFrom(): Date {
        return this.Get('EffectiveFrom');
    }
    set EffectiveFrom(value: Date) {
        this.Set('EffectiveFrom', value);
    }

    /**
    * * Field Name: EffectiveTo
    * * Display Name: Effective To
    * * SQL Data Type: date
    * * Description: Last date this mapping is in effect (NULL = open-ended).
    */
    get EffectiveTo(): Date | null {
        return this.Get('EffectiveTo');
    }
    set EffectiveTo(value: Date | null) {
        this.Set('EffectiveTo', value);
    }

    /**
    * * Field Name: ApprovedByUserID
    * * Display Name: Approved By User
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    * * Description: Admin (typically Finance.Admin role) who approved this mapping.
    */
    get ApprovedByUserID(): string | null {
        return this.Get('ApprovedByUserID');
    }
    set ApprovedByUserID(value: string | null) {
        this.Set('ApprovedByUserID', value);
    }

    /**
    * * Field Name: ApprovedAt
    * * Display Name: Approved At
    * * SQL Data Type: datetimeoffset
    * * Description: When the mapping was approved.
    */
    get ApprovedAt(): Date | null {
        return this.Get('ApprovedAt');
    }
    set ApprovedAt(value: Date | null) {
        this.Set('ApprovedAt', value);
    }

    /**
    * * Field Name: ChangeNote
    * * Display Name: Change Note
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Optional note describing why this mapping was created or changed.
    */
    get ChangeNote(): string | null {
        return this.Get('ChangeNote');
    }
    set ChangeNote(value: string | null) {
        this.Set('ChangeNote', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company Name
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }

    /**
    * * Field Name: InternalGLAccount
    * * Display Name: Internal GL Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get InternalGLAccount(): string {
        return this.Get('InternalGLAccount');
    }

    /**
    * * Field Name: ApprovedByUser
    * * Display Name: Approved By Name
    * * SQL Data Type: nvarchar(100)
    */
    get ApprovedByUser(): string | null {
        return this.Get('ApprovedByUser');
    }
}


/**
 * MJ_BizApps_Accounting: Currencies - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: Currency
 * * Base View: vwCurrencies
 * * @description ISO-4217 currency reference data owned by BizAppsAccounting; seeded via metadata sync (metadata/currencies). Referenced by GLAccount, AccountingCompanyProfile, JournalEntryLine, AccountBalance, and CurrencySpotRate.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Currencies')
export class mjBizAppsAccountingCurrencyEntity extends BaseEntity<mjBizAppsAccountingCurrencyEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Currencies record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Currencies record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingCurrencyEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Currencies entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Code: The code must be in uppercase letters to ensure consistent formatting across the system.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateCodeIsUppercase(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The code must be in uppercase letters to ensure consistent formatting across the system.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    	public ValidateCodeIsUppercase(result: ValidationResult) {
    		if (this.Code != null && this.Code !== this.Code.toUpperCase()) {
    			result.Errors.push(new ValidationErrorInfo(
    				"Code",
    				"Code must be in uppercase letters.",
    				this.Code,
    				ValidationErrorType.Failure
    			));
    		}
    	}

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Currency Code
    * * SQL Data Type: char(3)
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(80)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Symbol
    * * Display Name: Symbol
    * * SQL Data Type: nvarchar(10)
    */
    get Symbol(): string | null {
        return this.Get('Symbol');
    }
    set Symbol(value: string | null) {
        this.Set('Symbol', value);
    }

    /**
    * * Field Name: DecimalPlaces
    * * Display Name: Decimal Places
    * * SQL Data Type: tinyint
    * * Default Value: 2
    */
    get DecimalPlaces(): number {
        return this.Get('DecimalPlaces');
    }
    set DecimalPlaces(value: number) {
        this.Set('DecimalPlaces', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }
}


/**
 * MJ_BizApps_Accounting: Currency Spot Rates - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: CurrencySpotRate
 * * Base View: vwCurrencySpotRates
 * * @description Spot FX rate: units of ToCurrency per 1 unit of FromCurrency, on RateDate, from Source (ExchangeRate-API | ECB | OpenExchangeRates | Manual). Used for JE booking, period-end revaluation, and realized FX. Spot-only by design.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Currency Spot Rates')
export class mjBizAppsAccountingCurrencySpotRateEntity extends BaseEntity<mjBizAppsAccountingCurrencySpotRateEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Currency Spot Rates record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Currency Spot Rates record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingCurrencySpotRateEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Currency Spot Rates entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Rate: The exchange rate must be greater than zero to ensure valid currency conversions.
    * * Table-Level: The source currency and destination currency must be different. A currency exchange rate cannot be defined between the same currency.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateRateGreaterThanZero(result);
        this.ValidateFromCurrencyCodeDifferentFromToCurrencyCode(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The exchange rate must be greater than zero to ensure valid currency conversions.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateRateGreaterThanZero(result: ValidationResult) {
    	if (this.Rate != null && this.Rate <= 0) {
    		result.Errors.push(new ValidationErrorInfo(
    			"Rate",
    			"Rate must be greater than 0.",
    			this.Rate,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * The source currency and destination currency must be different. A currency exchange rate cannot be defined between the same currency.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateFromCurrencyCodeDifferentFromToCurrencyCode(result: ValidationResult) {
    	if (this.FromCurrencyCode != null && this.ToCurrencyCode != null && this.FromCurrencyCode === this.ToCurrencyCode) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ToCurrencyCode",
    			"The destination currency code must be different from the source currency code.",
    			this.ToCurrencyCode,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: FromCurrencyCode
    * * Display Name: From Currency
    * * SQL Data Type: char(3)
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
    */
    get FromCurrencyCode(): string {
        return this.Get('FromCurrencyCode');
    }
    set FromCurrencyCode(value: string) {
        this.Set('FromCurrencyCode', value);
    }

    /**
    * * Field Name: ToCurrencyCode
    * * Display Name: To Currency
    * * SQL Data Type: char(3)
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
    */
    get ToCurrencyCode(): string {
        return this.Get('ToCurrencyCode');
    }
    set ToCurrencyCode(value: string) {
        this.Set('ToCurrencyCode', value);
    }

    /**
    * * Field Name: RateDate
    * * Display Name: Rate Date
    * * SQL Data Type: date
    */
    get RateDate(): Date {
        return this.Get('RateDate');
    }
    set RateDate(value: Date) {
        this.Set('RateDate', value);
    }

    /**
    * * Field Name: Rate
    * * Display Name: Rate
    * * SQL Data Type: decimal(18, 8)
    */
    get Rate(): number {
        return this.Get('Rate');
    }
    set Rate(value: number) {
        this.Set('Rate', value);
    }

    /**
    * * Field Name: Source
    * * Display Name: Source
    * * SQL Data Type: nvarchar(50)
    * * Default Value: Manual
    */
    get Source(): string {
        return this.Get('Source');
    }
    set Source(value: string) {
        this.Set('Source', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: FromCurrencyCode_Virtual
    * * Display Name: From Currency (Display)
    * * SQL Data Type: nvarchar(80)
    */
    get FromCurrencyCode_Virtual(): string {
        return this.Get('FromCurrencyCode_Virtual');
    }

    /**
    * * Field Name: ToCurrencyCode_Virtual
    * * Display Name: To Currency (Display)
    * * SQL Data Type: nvarchar(80)
    */
    get ToCurrencyCode_Virtual(): string {
        return this.Get('ToCurrencyCode_Virtual');
    }
}


/**
 * MJ_BizApps_Accounting: Customer Tax Profiles - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: CustomerTaxProfile
 * * Base View: vwCustomerTaxProfiles
 * * @description Taxability profile for an Organization (customer). Captures their tax ID, where they are taxable, and any exemption certificate.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Customer Tax Profiles')
export class mjBizAppsAccountingCustomerTaxProfileEntity extends BaseEntity<mjBizAppsAccountingCustomerTaxProfileEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Customer Tax Profiles record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Customer Tax Profiles record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingCustomerTaxProfileEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Customer Tax Profiles entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Table-Level: The effective end date must be on or after the effective start date.
    * * Table-Level: An exemption certificate reference must be provided if the record is marked as tax-exempt.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateEffectiveToGreaterOrEqualToEffectiveFrom(result);
        this.ValidateExemptionCertificateRefWhenIsExempt(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The effective end date must be on or after the effective start date.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateEffectiveToGreaterOrEqualToEffectiveFrom(result: ValidationResult) {
    	if (this.EffectiveTo != null && this.EffectiveFrom != null) {
    		const effectiveToDate = new Date(this.EffectiveTo);
    		const effectiveFromDate = new Date(this.EffectiveFrom);
    		if (effectiveToDate < effectiveFromDate) {
    			result.Errors.push(new ValidationErrorInfo(
    				"EffectiveTo",
    				"The effective end date cannot be earlier than the effective start date.",
    				this.EffectiveTo,
    				ValidationErrorType.Failure
    			));
    		}
    	}
    }

    /**
    * An exemption certificate reference must be provided if the record is marked as tax-exempt.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateExemptionCertificateRefWhenIsExempt(result: ValidationResult) {
    	if (this.IsExempt && (this.ExemptionCertificateRef == null || this.ExemptionCertificateRef.trim() === "")) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ExemptionCertificateRef",
    			"An exemption certificate reference is required when the record is marked as tax-exempt.",
    			this.ExemptionCertificateRef,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: OrganizationID
    * * Display Name: Organization
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Common: Organizations (vwOrganizations.ID)
    * * Description: Customer Organization (FK to __mj_BizAppsCommon.Organization).
    */
    get OrganizationID(): string {
        return this.Get('OrganizationID');
    }
    set OrganizationID(value: string) {
        this.Set('OrganizationID', value);
    }

    /**
    * * Field Name: TaxJurisdictionID
    * * Display Name: Tax Jurisdiction
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Jurisdictions (vwTaxJurisdictions.ID)
    * * Description: Jurisdiction where the customer is taxable (primary).
    */
    get TaxJurisdictionID(): string | null {
        return this.Get('TaxJurisdictionID');
    }
    set TaxJurisdictionID(value: string | null) {
        this.Set('TaxJurisdictionID', value);
    }

    /**
    * * Field Name: TaxIDNumber
    * * Display Name: Tax ID Number
    * * SQL Data Type: nvarchar(100)
    * * Description: Customer's tax registration number (VAT, EIN, ABN, etc.).
    */
    get TaxIDNumber(): string | null {
        return this.Get('TaxIDNumber');
    }
    set TaxIDNumber(value: string | null) {
        this.Set('TaxIDNumber', value);
    }

    /**
    * * Field Name: IsExempt
    * * Display Name: Is Tax Exempt
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Whether the customer is currently tax-exempt.
    */
    get IsExempt(): boolean {
        return this.Get('IsExempt');
    }
    set IsExempt(value: boolean) {
        this.Set('IsExempt', value);
    }

    /**
    * * Field Name: ExemptionCertificateRef
    * * Display Name: Exemption Certificate Reference
    * * SQL Data Type: nvarchar(200)
    * * Description: Reference to the exemption certificate (file ref, URL, certificate number). Required when IsExempt=1.
    */
    get ExemptionCertificateRef(): string | null {
        return this.Get('ExemptionCertificateRef');
    }
    set ExemptionCertificateRef(value: string | null) {
        this.Set('ExemptionCertificateRef', value);
    }

    /**
    * * Field Name: ExemptionExpiryDate
    * * Display Name: Exemption Expiry Date
    * * SQL Data Type: date
    * * Description: When the exemption certificate expires.
    */
    get ExemptionExpiryDate(): Date | null {
        return this.Get('ExemptionExpiryDate');
    }
    set ExemptionExpiryDate(value: Date | null) {
        this.Set('ExemptionExpiryDate', value);
    }

    /**
    * * Field Name: EffectiveFrom
    * * Display Name: Effective From
    * * SQL Data Type: date
    * * Description: Earliest date this profile is in effect.
    */
    get EffectiveFrom(): Date {
        return this.Get('EffectiveFrom');
    }
    set EffectiveFrom(value: Date) {
        this.Set('EffectiveFrom', value);
    }

    /**
    * * Field Name: EffectiveTo
    * * Display Name: Effective To
    * * SQL Data Type: date
    * * Description: Last date this profile is in effect (NULL = open-ended).
    */
    get EffectiveTo(): Date | null {
        return this.Get('EffectiveTo');
    }
    set EffectiveTo(value: Date | null) {
        this.Set('EffectiveTo', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Organization
    * * Display Name: Organization Name
    * * SQL Data Type: nvarchar(255)
    */
    get Organization(): string {
        return this.Get('Organization');
    }

    /**
    * * Field Name: TaxJurisdiction
    * * Display Name: Tax Jurisdiction Name
    * * SQL Data Type: nvarchar(200)
    */
    get TaxJurisdiction(): string | null {
        return this.Get('TaxJurisdiction');
    }
}


/**
 * MJ_BizApps_Accounting: Dimension Values - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: DimensionValue
 * * Base View: vwDimensionValues
 * * @description Hierarchical value within a Dimension. ParentDimensionValueID allows e.g. Region → State → City rollups.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Dimension Values')
export class mjBizAppsAccountingDimensionValueEntity extends BaseEntity<mjBizAppsAccountingDimensionValueEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Dimension Values record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Dimension Values record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingDimensionValueEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Dimension Values entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Table-Level: The effective end date must be on or after the effective start date.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateEffectiveToGreaterThanOrEqualToEffectiveFrom(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The effective end date must be on or after the effective start date.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateEffectiveToGreaterThanOrEqualToEffectiveFrom(result: ValidationResult) {
    	if (this.EffectiveTo != null && this.EffectiveFrom != null) {
    		if (this.EffectiveTo < this.EffectiveFrom) {
    			result.Errors.push(new ValidationErrorInfo(
    				"EffectiveTo",
    				"The effective end date must be on or after the effective start date.",
    				this.EffectiveTo,
    				ValidationErrorType.Failure
    			));
    		}
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: DimensionID
    * * Display Name: Dimension
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimensions (vwDimensions.ID)
    * * Description: Dimension this value belongs to.
    */
    get DimensionID(): string {
        return this.Get('DimensionID');
    }
    set DimensionID(value: string) {
        this.Set('DimensionID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(80)
    * * Description: Code for this value (unique within the dimension). E.g. 'Marketing', 'WestCoast', 'ProductLaunch2026'.
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    * * Description: Display name for this value.
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: ParentDimensionValueID
    * * Display Name: Parent Value
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimension Values (vwDimensionValues.ID)
    * * Description: Parent value for hierarchical dimensions (e.g. Country contains States).
    */
    get ParentDimensionValueID(): string | null {
        return this.Get('ParentDimensionValueID');
    }
    set ParentDimensionValueID(value: string | null) {
        this.Set('ParentDimensionValueID', value);
    }

    /**
    * * Field Name: EffectiveFrom
    * * Display Name: Effective From
    * * SQL Data Type: date
    * * Description: Earliest date this value is selectable (NULL = always).
    */
    get EffectiveFrom(): Date | null {
        return this.Get('EffectiveFrom');
    }
    set EffectiveFrom(value: Date | null) {
        this.Set('EffectiveFrom', value);
    }

    /**
    * * Field Name: EffectiveTo
    * * Display Name: Effective To
    * * SQL Data Type: date
    * * Description: Last date this value is selectable (NULL = never expires).
    */
    get EffectiveTo(): Date | null {
        return this.Get('EffectiveTo');
    }
    set EffectiveTo(value: Date | null) {
        this.Set('EffectiveTo', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Whether this value is available for new tagging.
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Dimension
    * * Display Name: Dimension Name
    * * SQL Data Type: nvarchar(100)
    */
    get Dimension(): string {
        return this.Get('Dimension');
    }

    /**
    * * Field Name: ParentDimensionValue
    * * Display Name: Parent Value Name
    * * SQL Data Type: nvarchar(200)
    */
    get ParentDimensionValue(): string | null {
        return this.Get('ParentDimensionValue');
    }

    /**
    * * Field Name: RootParentDimensionValueID
    * * Display Name: Root Value
    * * SQL Data Type: uniqueidentifier
    */
    get RootParentDimensionValueID(): string | null {
        return this.Get('RootParentDimensionValueID');
    }
}


/**
 * MJ_BizApps_Accounting: Dimensions - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: Dimension
 * * Base View: vwDimensions
 * * @description First-class analytical dimension used to tag JE lines (Department, CostCenter, Project, Region, ...). Optional — deployments with no dimensions defined just have a flat chart.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Dimensions')
export class mjBizAppsAccountingDimensionEntity extends BaseEntity<mjBizAppsAccountingDimensionEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Dimensions record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Dimensions record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingDimensionEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier (UUID per BA-D3).
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    * * Description: Short code for the dimension, e.g. 'Department', 'CostCenter'.
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(100)
    * * Description: Display name for the dimension.
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Detailed description of what the dimension tracks and how it is intended to be used in reports.
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: DisplayOrder
    * * Display Name: Display Order
    * * SQL Data Type: int
    * * Default Value: 100
    * * Description: Sort order in dropdowns and report filters. Lower values appear first.
    */
    get DisplayOrder(): number {
        return this.Get('DisplayOrder');
    }
    set DisplayOrder(value: number) {
        this.Set('DisplayOrder', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Whether this dimension is available for new JE-line tagging. Inactive dimensions stay in historical data but are hidden from selection.
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }
}


/**
 * MJ_BizApps_Accounting: GL Accounts - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: GLAccount
 * * Base View: vwGLAccounts
 * * @description Chart-of-accounts entry. Per-Company; mirrors the ERP's COA so JE lines have a stable internal reference. Hierarchical via ParentGLAccountID for rollup reporting.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: GL Accounts')
export class mjBizAppsAccountingGLAccountEntity extends BaseEntity<mjBizAppsAccountingGLAccountEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: GL Accounts record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: GL Accounts record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingGLAccountEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: GL Accounts entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Table-Level: A GL account cannot be assigned as its own parent account to prevent circular relationships in the account hierarchy.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateParentGLAccountIDNotEqualToID(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * A GL account cannot be assigned as its own parent account to prevent circular relationships in the account hierarchy.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateParentGLAccountIDNotEqualToID(result: ValidationResult) {
    	if (this.ParentGLAccountID != null && this.ParentGLAccountID === this.ID) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ParentGLAccountID",
    			"A GL account cannot be assigned as its own parent account.",
    			this.ParentGLAccountID,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: Company that owns this account. UNIQUE (CompanyID, Code) — each company has its own chart.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Account Code
    * * SQL Data Type: nvarchar(40)
    * * Description: Account code matching the ERP COA, e.g. '11201' or '40100-SUB'.
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Account Name
    * * SQL Data Type: nvarchar(200)
    * * Description: Display name for the account.
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: AccountType
    * * Display Name: Account Type
    * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Asset
    *   * ContraAsset
    *   * ContraExpense
    *   * ContraLiability
    *   * ContraRevenue
    *   * Equity
    *   * Expense
    *   * Liability
    *   * Revenue
    *   * Statistical
    * * Description: High-level type: Asset | Liability | Equity | Revenue | Expense | ContraAsset | ContraLiability | ContraRevenue | ContraExpense | Statistical.
    */
    get AccountType(): 'Asset' | 'ContraAsset' | 'ContraExpense' | 'ContraLiability' | 'ContraRevenue' | 'Equity' | 'Expense' | 'Liability' | 'Revenue' | 'Statistical' {
        return this.Get('AccountType');
    }
    set AccountType(value: 'Asset' | 'ContraAsset' | 'ContraExpense' | 'ContraLiability' | 'ContraRevenue' | 'Equity' | 'Expense' | 'Liability' | 'Revenue' | 'Statistical') {
        this.Set('AccountType', value);
    }

    /**
    * * Field Name: ParentGLAccountID
    * * Display Name: Parent Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: Parent account for hierarchical rollup (NULL = top of chart).
    */
    get ParentGLAccountID(): string | null {
        return this.Get('ParentGLAccountID');
    }
    set ParentGLAccountID(value: string | null) {
        this.Set('ParentGLAccountID', value);
    }

    /**
    * * Field Name: CurrencyCode
    * * Display Name: Currency Code
    * * SQL Data Type: char(3)
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
    * * Description: Currency denomination of the account (NULL = uses the Company's functional currency).
    */
    get CurrencyCode(): string | null {
        return this.Get('CurrencyCode');
    }
    set CurrencyCode(value: string | null) {
        this.Set('CurrencyCode', value);
    }

    /**
    * * Field Name: ExternalSystem
    * * Display Name: External System
    * * SQL Data Type: nvarchar(50)
    * * Description: External system this account synchronizes to: BusinessCentral | QuickBooks | NetSuite | ... NULL if local-only.
    */
    get ExternalSystem(): string | null {
        return this.Get('ExternalSystem');
    }
    set ExternalSystem(value: string | null) {
        this.Set('ExternalSystem', value);
    }

    /**
    * * Field Name: ExternalAccountID
    * * Display Name: External Account ID
    * * SQL Data Type: nvarchar(100)
    * * Description: The external system's identifier for this account, used by sync.
    */
    get ExternalAccountID(): string | null {
        return this.Get('ExternalAccountID');
    }
    set ExternalAccountID(value: string | null) {
        this.Set('ExternalAccountID', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Whether the account is available for new JE lines. Inactive accounts retain historical data.
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: IsSystemSeeded
    * * Display Name: Is System Seeded
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: TRUE if the account was created by spSeedDefaultChartOfAccounts. Lets reports distinguish platform-shipped accounts from deployment customizations.
    */
    get IsSystemSeeded(): boolean {
        return this.Get('IsSystemSeeded');
    }
    set IsSystemSeeded(value: boolean) {
        this.Set('IsSystemSeeded', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Optional description for the account.
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company Name
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }

    /**
    * * Field Name: ParentGLAccount
    * * Display Name: Parent Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get ParentGLAccount(): string | null {
        return this.Get('ParentGLAccount');
    }

    /**
    * * Field Name: CurrencyCode_Virtual
    * * Display Name: Currency
    * * SQL Data Type: nvarchar(80)
    */
    get CurrencyCode_Virtual(): string | null {
        return this.Get('CurrencyCode_Virtual');
    }

    /**
    * * Field Name: RootParentGLAccountID
    * * Display Name: Root Parent Account
    * * SQL Data Type: uniqueidentifier
    */
    get RootParentGLAccountID(): string | null {
        return this.Get('RootParentGLAccountID');
    }
}


/**
 * MJ_BizApps_Accounting: Journal Entries - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: JournalEntry
 * * Base View: vwJournalEntries
 * * @description Top-level ledger row. Balanced (Sum Debits = Sum Credits) at the lock event. Immutable after Status transitions to Batched/GLPosted. Lifecycle: Pending → Batched → GLPosted (BA-D6). Reversals happen via NEW Pending JEs with ReversesJournalEntryID set, never by modifying historical rows.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entries')
export class mjBizAppsAccountingJournalEntryEntity extends BaseEntity<mjBizAppsAccountingJournalEntryEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Journal Entries record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Journal Entries record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingJournalEntryEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Journal Entries entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Table-Level: A batch ID must be assigned to all entries unless they are still in a 'Pending' status.
    * * Table-Level: If a record's status is set to 'GLPosted', a GL posting date and time must be provided.
    * * Table-Level: A journal entry cannot be reversed by itself. If a reversing journal entry is specified, it must be a different journal entry.
    * * Table-Level: A journal entry cannot be set to reverse itself.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateBatchIDRequiredForNonPendingStatus(result);
        this.ValidateGLPostedAtWhenStatusIsGLPosted(result);
        this.ValidateReversedByJournalEntryIDNotEqualToID(result);
        this.ValidateReversesJournalEntryIDNotEqualToID(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * A batch ID must be assigned to all entries unless they are still in a 'Pending' status.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    	public ValidateBatchIDRequiredForNonPendingStatus(result: ValidationResult) {
    		if (this.Status !== "Pending" && this.BatchID == null) {
    			result.Errors.push(new ValidationErrorInfo(
    				"BatchID",
    				"A Batch ID is required for entries that are not in a Pending status.",
    				this.BatchID,
    				ValidationErrorType.Failure
    			));
    		}
    	}

    /**
    * If a record's status is set to 'GLPosted', a GL posting date and time must be provided.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateGLPostedAtWhenStatusIsGLPosted(result: ValidationResult) {
    	if (this.Status === "GLPosted" && this.GLPostedAt == null) {
    		result.Errors.push(new ValidationErrorInfo(
    			"GLPostedAt",
    			"A GL posting date and time is required when the status is 'GLPosted'.",
    			this.GLPostedAt,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * A journal entry cannot be reversed by itself. If a reversing journal entry is specified, it must be a different journal entry.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateReversedByJournalEntryIDNotEqualToID(result: ValidationResult) {
    	if (this.ReversedByJournalEntryID != null && this.ReversedByJournalEntryID === this.ID) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ReversedByJournalEntryID",
    			"A journal entry cannot be reversed by itself. The reversing journal entry must be a different entry.",
    			this.ReversedByJournalEntryID,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * A journal entry cannot be set to reverse itself.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateReversesJournalEntryIDNotEqualToID(result: ValidationResult) {
    	if (this.ReversesJournalEntryID != null && this.ReversesJournalEntryID === this.ID) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ReversesJournalEntryID",
    			"A journal entry cannot reverse itself. Reverses Journal Entry ID must be different from the Journal Entry ID.",
    			this.ReversesJournalEntryID,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier (UUID per BA-D3).
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: EntryNumber
    * * Display Name: Entry Number
    * * SQL Data Type: nvarchar(40)
    * * Description: Gap-free entry number 'JE-{CompanyCode}-{FY}-{seq:000000}' assigned by spAssignNextJournalEntryNumber (BA-D15).
    */
    get EntryNumber(): string {
        return this.Get('EntryNumber');
    }
    set EntryNumber(value: string) {
        this.Set('EntryNumber', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: Company that owns this entry.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: AccountingPeriodID
    * * Display Name: Accounting Period
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Periods (vwAccountingPeriods.ID)
    * * Description: Accounting period this entry posts to. Must be Open or Reopened (trg_JournalEntry_PeriodClose).
    */
    get AccountingPeriodID(): string {
        return this.Get('AccountingPeriodID');
    }
    set AccountingPeriodID(value: string) {
        this.Set('AccountingPeriodID', value);
    }

    /**
    * * Field Name: EffectiveDate
    * * Display Name: Effective Date
    * * SQL Data Type: date
    * * Description: Accounting date for the entry (drives which period it falls in).
    */
    get EffectiveDate(): Date {
        return this.Get('EffectiveDate');
    }
    set EffectiveDate(value: Date) {
        this.Set('EffectiveDate', value);
    }

    /**
    * * Field Name: EntryType
    * * Display Name: Entry Type
    * * SQL Data Type: nvarchar(40)
    * * Value List Type: List
    * * Possible Values 
    *   * Adjustment
    *   * CommissionAccrual
    *   * FXRevaluation
    *   * IntercompanyFlow
    *   * Manual
    *   * OpeningBalance
    *   * OrderBooking
    *   * PartnerRevShare
    *   * PaymentReceipt
    *   * PeriodEndAccrual
    *   * Refund
    *   * RevenueRecognition
    *   * Reversal
    *   * TaxRemittance
    *   * WaterfallDistribution
    *   * Writeoff
    * * Description: OrderBooking | PaymentReceipt | RevenueRecognition | CommissionAccrual | PartnerRevShare | IntercompanyFlow | WaterfallDistribution | Refund | Writeoff | Reversal | Manual | TaxRemittance | PeriodEndAccrual | FXRevaluation | OpeningBalance | Adjustment.
    */
    get EntryType(): 'Adjustment' | 'CommissionAccrual' | 'FXRevaluation' | 'IntercompanyFlow' | 'Manual' | 'OpeningBalance' | 'OrderBooking' | 'PartnerRevShare' | 'PaymentReceipt' | 'PeriodEndAccrual' | 'Refund' | 'RevenueRecognition' | 'Reversal' | 'TaxRemittance' | 'WaterfallDistribution' | 'Writeoff' {
        return this.Get('EntryType');
    }
    set EntryType(value: 'Adjustment' | 'CommissionAccrual' | 'FXRevaluation' | 'IntercompanyFlow' | 'Manual' | 'OpeningBalance' | 'OrderBooking' | 'PartnerRevShare' | 'PaymentReceipt' | 'PeriodEndAccrual' | 'Refund' | 'RevenueRecognition' | 'Reversal' | 'TaxRemittance' | 'WaterfallDistribution' | 'Writeoff') {
        this.Set('EntryType', value);
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(20)
    * * Default Value: Pending
    * * Value List Type: List
    * * Possible Values 
    *   * Batched
    *   * GLPosted
    *   * Pending
    * * Description: Lifecycle state: Pending | Batched | GLPosted (BA-D6). Locked after Batched; only GLPosted transition and GL-roundtrip fields may change.
    */
    get Status(): 'Batched' | 'GLPosted' | 'Pending' {
        return this.Get('Status');
    }
    set Status(value: 'Batched' | 'GLPosted' | 'Pending') {
        this.Set('Status', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Free-form human description of the entry.
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: OrderID
    * * Display Name: Order
    * * SQL Data Type: uniqueidentifier
    * * Description: Soft polymorphic ref to a source Order in a downstream app. NO FK. Accounting stores the UUID for audit drill-through but has zero knowledge of Order entities.
    */
    get OrderID(): string | null {
        return this.Get('OrderID');
    }
    set OrderID(value: string | null) {
        this.Set('OrderID', value);
    }

    /**
    * * Field Name: OrderLineID
    * * Display Name: Order Line
    * * SQL Data Type: uniqueidentifier
    * * Description: Soft polymorphic ref to a source OrderLine. NO FK.
    */
    get OrderLineID(): string | null {
        return this.Get('OrderLineID');
    }
    set OrderLineID(value: string | null) {
        this.Set('OrderLineID', value);
    }

    /**
    * * Field Name: SubscriptionID
    * * Display Name: Subscription
    * * SQL Data Type: uniqueidentifier
    * * Description: Soft polymorphic ref to a source Subscription. NO FK.
    */
    get SubscriptionID(): string | null {
        return this.Get('SubscriptionID');
    }
    set SubscriptionID(value: string | null) {
        this.Set('SubscriptionID', value);
    }

    /**
    * * Field Name: PaymentID
    * * Display Name: Payment
    * * SQL Data Type: uniqueidentifier
    * * Description: Soft polymorphic ref to a source Payment. NO FK.
    */
    get PaymentID(): string | null {
        return this.Get('PaymentID');
    }
    set PaymentID(value: string | null) {
        this.Set('PaymentID', value);
    }

    /**
    * * Field Name: ContractID
    * * Display Name: Contract
    * * SQL Data Type: uniqueidentifier
    * * Description: Soft polymorphic ref to a source Contract. NO FK.
    */
    get ContractID(): string | null {
        return this.Get('ContractID');
    }
    set ContractID(value: string | null) {
        this.Set('ContractID', value);
    }

    /**
    * * Field Name: RevRecScheduleID
    * * Display Name: Revenue Recognition Schedule
    * * SQL Data Type: uniqueidentifier
    * * Description: Soft polymorphic ref to a RevenueRecognitionSchedule. NO FK.
    */
    get RevRecScheduleID(): string | null {
        return this.Get('RevRecScheduleID');
    }
    set RevRecScheduleID(value: string | null) {
        this.Set('RevRecScheduleID', value);
    }

    /**
    * * Field Name: IntercompanyFlowID
    * * Display Name: Intercompany Flow
    * * SQL Data Type: uniqueidentifier
    * * Description: Soft polymorphic ref to an IntercompanyFlow record orchestrated upstream. NO FK.
    */
    get IntercompanyFlowID(): string | null {
        return this.Get('IntercompanyFlowID');
    }
    set IntercompanyFlowID(value: string | null) {
        this.Set('IntercompanyFlowID', value);
    }

    /**
    * * Field Name: RecurringJournalEntryID
    * * Display Name: Recurring Journal Entry
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Recurring Journal Entries (vwRecurringJournalEntries.ID)
    * * Description: When the JE was emitted by a recurring schedule, this is the schedule that produced it.
    */
    get RecurringJournalEntryID(): string | null {
        return this.Get('RecurringJournalEntryID');
    }
    set RecurringJournalEntryID(value: string | null) {
        this.Set('RecurringJournalEntryID', value);
    }

    /**
    * * Field Name: TaxRemittanceID
    * * Display Name: Tax Remittance
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Remittances (vwTaxRemittances.ID)
    * * Description: When the JE represents a tax remittance, the remittance record it implements.
    */
    get TaxRemittanceID(): string | null {
        return this.Get('TaxRemittanceID');
    }
    set TaxRemittanceID(value: string | null) {
        this.Set('TaxRemittanceID', value);
    }

    /**
    * * Field Name: ReversesJournalEntryID
    * * Display Name: Reverses Journal Entry
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
    * * Description: When set, this JE is a reversal of the referenced original JE. EntryType MUST be 'Reversal' (trg_JE_ReversalConsistency).
    */
    get ReversesJournalEntryID(): string | null {
        return this.Get('ReversesJournalEntryID');
    }
    set ReversesJournalEntryID(value: string | null) {
        this.Set('ReversesJournalEntryID', value);
    }

    /**
    * * Field Name: ReversedByJournalEntryID
    * * Display Name: Reversed By Journal Entry
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
    * * Description: Back-pointer set on the original JE when a reversal is emitted against it.
    */
    get ReversedByJournalEntryID(): string | null {
        return this.Get('ReversedByJournalEntryID');
    }
    set ReversedByJournalEntryID(value: string | null) {
        this.Set('ReversedByJournalEntryID', value);
    }

    /**
    * * Field Name: OriginalAccountingPeriodID
    * * Display Name: Original Accounting Period
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Periods (vwAccountingPeriods.ID)
    * * Description: When this JE is an adjusting entry to a previously closed period, this is the closed period it adjusts. The JE itself posts to the NEXT open period (plan §7.5 / BA-D14).
    */
    get OriginalAccountingPeriodID(): string | null {
        return this.Get('OriginalAccountingPeriodID');
    }
    set OriginalAccountingPeriodID(value: string | null) {
        this.Set('OriginalAccountingPeriodID', value);
    }

    /**
    * * Field Name: BatchID
    * * Display Name: Batch
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entry Batches (vwJournalEntryBatches.ID)
    * * Description: Batch that locked this JE (set when Status transitions to Batched).
    */
    get BatchID(): string | null {
        return this.Get('BatchID');
    }
    set BatchID(value: string | null) {
        this.Set('BatchID', value);
    }

    /**
    * * Field Name: GLPostedAt
    * * Display Name: GL Posted At
    * * SQL Data Type: datetimeoffset
    * * Description: When the ERP acknowledged the consolidated batch (Status transitions to GLPosted).
    */
    get GLPostedAt(): Date | null {
        return this.Get('GLPostedAt');
    }
    set GLPostedAt(value: Date | null) {
        this.Set('GLPostedAt', value);
    }

    /**
    * * Field Name: GLReferenceID
    * * Display Name: GL Reference
    * * SQL Data Type: nvarchar(100)
    * * Description: ERP's reference back to us for this JE (within the consolidated batch posting).
    */
    get GLReferenceID(): string | null {
        return this.Get('GLReferenceID');
    }
    set GLReferenceID(value: string | null) {
        this.Set('GLReferenceID', value);
    }

    /**
    * * Field Name: FileID
    * * Display Name: File
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Files (vwFiles.ID)
    * * Description: Optional attached source document (vendor bill PDF, signed contract, supporting workpaper). FK to __mj.File.
    */
    get FileID(): string | null {
        return this.Get('FileID');
    }
    set FileID(value: string | null) {
        this.Set('FileID', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company Name
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }

    /**
    * * Field Name: File
    * * Display Name: File Description
    * * SQL Data Type: nvarchar(500)
    */
    get File(): string | null {
        return this.Get('File');
    }

    /**
    * * Field Name: RootReversesJournalEntryID
    * * Display Name: Root Reverses Journal Entry
    * * SQL Data Type: uniqueidentifier
    */
    get RootReversesJournalEntryID(): string | null {
        return this.Get('RootReversesJournalEntryID');
    }

    /**
    * * Field Name: RootReversedByJournalEntryID
    * * Display Name: Root Reversed By Journal Entry
    * * SQL Data Type: uniqueidentifier
    */
    get RootReversedByJournalEntryID(): string | null {
        return this.Get('RootReversedByJournalEntryID');
    }
}


/**
 * MJ_BizApps_Accounting: Journal Entry Batch Sequences - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: JournalEntryBatchSequence
 * * Base View: vwJournalEntryBatchSequences
 * * @description Per-Company gap-free counter for JournalEntryBatch numbering. Maintained by spAssignNextBatchNumber; do not write directly.
 * * Primary Key: CompanyID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entry Batch Sequences')
export class mjBizAppsAccountingJournalEntryBatchSequenceEntity extends BaseEntity<mjBizAppsAccountingJournalEntryBatchSequenceEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Journal Entry Batch Sequences record from the database
    * @param CompanyID: string - primary key value to load the MJ_BizApps_Accounting: Journal Entry Batch Sequences record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingJournalEntryBatchSequenceEntity
    * @method
    * @override
    */
    public async Load(CompanyID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'CompanyID', Value: CompanyID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Journal Entry Batch Sequences entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * NextSequenceNumber: The next sequence number must be a positive integer greater than zero.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateNextSequenceNumberGreaterThanZero(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The next sequence number must be a positive integer greater than zero.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateNextSequenceNumberGreaterThanZero(result: ValidationResult) {
    	if (this.NextSequenceNumber != null && this.NextSequenceNumber <= 0) {
    		result.Errors.push(new ValidationErrorInfo(
    			"NextSequenceNumber",
    			"The next sequence number must be greater than zero.",
    			this.NextSequenceNumber,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: Company.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: NextSequenceNumber
    * * Display Name: Next Sequence Number
    * * SQL Data Type: int
    * * Default Value: 1
    * * Description: Next sequence number to assign.
    */
    get NextSequenceNumber(): number {
        return this.Get('NextSequenceNumber');
    }
    set NextSequenceNumber(value: number) {
        this.Set('NextSequenceNumber', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }
}


/**
 * MJ_BizApps_Accounting: Journal Entry Batches - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: JournalEntryBatch
 * * Base View: vwJournalEntryBatches
 * * @description Aggregation event that ships Pending JEs to the external ERP for the period. Per BA-D16, batching IS the locking event — JEs cannot be modified after they are referenced by a Batched row.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entry Batches')
export class mjBizAppsAccountingJournalEntryBatchEntity extends BaseEntity<mjBizAppsAccountingJournalEntryBatchEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Journal Entry Batches record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Journal Entry Batches record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingJournalEntryBatchEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Journal Entry Batches entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Table-Level: Total debits, total credits, and total entries must all be greater than or equal to zero to prevent negative financial values and counts.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateTotalsAreNonNegative(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * Total debits, total credits, and total entries must all be greater than or equal to zero to prevent negative financial values and counts.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateTotalsAreNonNegative(result: ValidationResult) {
    	if (this.TotalDebits != null && this.TotalDebits < 0) {
    		result.Errors.push(new ValidationErrorInfo(
    			"TotalDebits",
    			"Total debits must be greater than or equal to zero.",
    			this.TotalDebits,
    			ValidationErrorType.Failure
    		));
    	}
    	if (this.TotalCredits != null && this.TotalCredits < 0) {
    		result.Errors.push(new ValidationErrorInfo(
    			"TotalCredits",
    			"Total credits must be greater than or equal to zero.",
    			this.TotalCredits,
    			ValidationErrorType.Failure
    		));
    	}
    	if (this.TotalEntries != null && this.TotalEntries < 0) {
    		result.Errors.push(new ValidationErrorInfo(
    			"TotalEntries",
    			"Total entries must be greater than or equal to zero.",
    			this.TotalEntries,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: BatchNumber
    * * Display Name: Batch Number
    * * SQL Data Type: nvarchar(40)
    * * Description: Gap-free batch number assigned by spAssignNextBatchNumber. Format 'BATCH-{CompanyCode}-{seq:000000}'.
    */
    get BatchNumber(): string {
        return this.Get('BatchNumber');
    }
    set BatchNumber(value: string) {
        this.Set('BatchNumber', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: Company this batch is for. One batch per Company per dispatch run.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: AccountingPeriodID
    * * Display Name: Accounting Period
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Periods (vwAccountingPeriods.ID)
    * * Description: Accounting period this batch covers.
    */
    get AccountingPeriodID(): string {
        return this.Get('AccountingPeriodID');
    }
    set AccountingPeriodID(value: string) {
        this.Set('AccountingPeriodID', value);
    }

    /**
    * * Field Name: TargetSystem
    * * Display Name: Target ERP System
    * * SQL Data Type: nvarchar(50)
    * * Value List Type: List
    * * Possible Values 
    *   * BusinessCentral
    *   * NetSuite
    *   * Other
    *   * QuickBooks
    *   * Sage
    *   * Xero
    * * Description: Target ERP for this batch: BusinessCentral | QuickBooks | NetSuite | Sage | Xero | Other.
    */
    get TargetSystem(): 'BusinessCentral' | 'NetSuite' | 'Other' | 'QuickBooks' | 'Sage' | 'Xero' {
        return this.Get('TargetSystem');
    }
    set TargetSystem(value: 'BusinessCentral' | 'NetSuite' | 'Other' | 'QuickBooks' | 'Sage' | 'Xero') {
        this.Set('TargetSystem', value);
    }

    /**
    * * Field Name: BatchedAt
    * * Display Name: Batched At
    * * SQL Data Type: datetimeoffset
    * * Default Value: sysdatetimeoffset()
    * * Description: When the batch was created (Pending JEs flipped to Batched).
    */
    get BatchedAt(): Date {
        return this.Get('BatchedAt');
    }
    set BatchedAt(value: Date) {
        this.Set('BatchedAt', value);
    }

    /**
    * * Field Name: BatchedByUserID
    * * Display Name: Batched By User ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    * * Description: User (or system identity for scheduled runs) that performed the batch.
    */
    get BatchedByUserID(): string {
        return this.Get('BatchedByUserID');
    }
    set BatchedByUserID(value: string) {
        this.Set('BatchedByUserID', value);
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(20)
    * * Default Value: Pending
    * * Value List Type: List
    * * Possible Values 
    *   * Acknowledged
    *   * Failed
    *   * Pending
    *   * Sent
    * * Description: Lifecycle: Pending | Sent | Acknowledged | Failed. Once Sent/Acknowledged, the batch is locked (trg_JEBatch_Immutability).
    */
    get Status(): 'Acknowledged' | 'Failed' | 'Pending' | 'Sent' {
        return this.Get('Status');
    }
    set Status(value: 'Acknowledged' | 'Failed' | 'Pending' | 'Sent') {
        this.Set('Status', value);
    }

    /**
    * * Field Name: TotalEntries
    * * Display Name: Total Entries
    * * SQL Data Type: int
    * * Default Value: 0
    * * Description: Count of JE rows in this batch (denormalized for fast batch dashboards).
    */
    get TotalEntries(): number {
        return this.Get('TotalEntries');
    }
    set TotalEntries(value: number) {
        this.Set('TotalEntries', value);
    }

    /**
    * * Field Name: TotalDebits
    * * Display Name: Total Debits
    * * SQL Data Type: decimal(18, 2)
    * * Default Value: 0
    * * Description: Sum of debits across all JE lines in the batch (functional currency).
    */
    get TotalDebits(): number {
        return this.Get('TotalDebits');
    }
    set TotalDebits(value: number) {
        this.Set('TotalDebits', value);
    }

    /**
    * * Field Name: TotalCredits
    * * Display Name: Total Credits
    * * SQL Data Type: decimal(18, 2)
    * * Default Value: 0
    * * Description: Sum of credits across all JE lines in the batch (functional currency).
    */
    get TotalCredits(): number {
        return this.Get('TotalCredits');
    }
    set TotalCredits(value: number) {
        this.Set('TotalCredits', value);
    }

    /**
    * * Field Name: ExternalBatchRef
    * * Display Name: External Batch Reference
    * * SQL Data Type: nvarchar(100)
    * * Description: ERP's reference returned on send (used to correlate the consolidated JE posted in the ERP).
    */
    get ExternalBatchRef(): string | null {
        return this.Get('ExternalBatchRef');
    }
    set ExternalBatchRef(value: string | null) {
        this.Set('ExternalBatchRef', value);
    }

    /**
    * * Field Name: SentAt
    * * Display Name: Sent At
    * * SQL Data Type: datetimeoffset
    * * Description: When the batch was sent to the ERP.
    */
    get SentAt(): Date | null {
        return this.Get('SentAt');
    }
    set SentAt(value: Date | null) {
        this.Set('SentAt', value);
    }

    /**
    * * Field Name: AcknowledgedAt
    * * Display Name: Acknowledged At
    * * SQL Data Type: datetimeoffset
    * * Description: When the ERP acknowledged receipt (triggers JE.Status transition Batched → GLPosted).
    */
    get AcknowledgedAt(): Date | null {
        return this.Get('AcknowledgedAt');
    }
    set AcknowledgedAt(value: Date | null) {
        this.Set('AcknowledgedAt', value);
    }

    /**
    * * Field Name: ErrorMessage
    * * Display Name: Error Message
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Error message from a Failed send. JEs revert to Pending for retry.
    */
    get ErrorMessage(): string | null {
        return this.Get('ErrorMessage');
    }
    set ErrorMessage(value: string | null) {
        this.Set('ErrorMessage', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }

    /**
    * * Field Name: BatchedByUser
    * * Display Name: Batched By User
    * * SQL Data Type: nvarchar(100)
    */
    get BatchedByUser(): string {
        return this.Get('BatchedByUser');
    }
}


/**
 * MJ_BizApps_Accounting: Journal Entry Line Dimensions - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: JournalEntryLineDimension
 * * Base View: vwJournalEntryLineDimensions
 * * @description Many-to-many between JournalEntryLine and (Dimension, DimensionValue). Optional — lines without any dimension rows are simply un-tagged. Reports filter and group by dimension via this table.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entry Line Dimensions')
export class mjBizAppsAccountingJournalEntryLineDimensionEntity extends BaseEntity<mjBizAppsAccountingJournalEntryLineDimensionEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Journal Entry Line Dimensions record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Journal Entry Line Dimensions record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingJournalEntryLineDimensionEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: JournalEntryLineID
    * * Display Name: Journal Entry Line
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entry Lines (vwJournalEntryLines.ID)
    * * Description: JE line being tagged.
    */
    get JournalEntryLineID(): string {
        return this.Get('JournalEntryLineID');
    }
    set JournalEntryLineID(value: string) {
        this.Set('JournalEntryLineID', value);
    }

    /**
    * * Field Name: DimensionID
    * * Display Name: Dimension
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimensions (vwDimensions.ID)
    * * Description: Dimension being applied. UNIQUE per (Line, Dimension) so a line cannot have two values for the same dimension.
    */
    get DimensionID(): string {
        return this.Get('DimensionID');
    }
    set DimensionID(value: string) {
        this.Set('DimensionID', value);
    }

    /**
    * * Field Name: DimensionValueID
    * * Display Name: Dimension Value
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimension Values (vwDimensionValues.ID)
    * * Description: Value chosen for the dimension on this line.
    */
    get DimensionValueID(): string {
        return this.Get('DimensionValueID');
    }
    set DimensionValueID(value: string) {
        this.Set('DimensionValueID', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Dimension
    * * Display Name: Dimension Name
    * * SQL Data Type: nvarchar(100)
    */
    get Dimension(): string {
        return this.Get('Dimension');
    }

    /**
    * * Field Name: DimensionValue
    * * Display Name: Dimension Value Name
    * * SQL Data Type: nvarchar(200)
    */
    get DimensionValue(): string {
        return this.Get('DimensionValue');
    }
}


/**
 * MJ_BizApps_Accounting: Journal Entry Lines - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: JournalEntryLine
 * * Base View: vwJournalEntryLines
 * * @description A debit or credit line under a JournalEntry. Exactly one of DebitAmount/CreditAmount is set per row (CK_JEL_OneSide). Multi-currency aware: OriginalCurrencyCode/OriginalDebit/OriginalCredit/ExchangeRateUsed capture the source-transaction currency when different from the Company's functional currency.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entry Lines')
export class mjBizAppsAccountingJournalEntryLineEntity extends BaseEntity<mjBizAppsAccountingJournalEntryLineEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Journal Entry Lines record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Journal Entry Lines record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingJournalEntryLineEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Journal Entry Lines entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * LineNumber: Line number must be greater than 0 to ensure journal entry lines are validly numbered.
    * * Table-Level: Each journal entry line must have either a positive debit amount or a positive credit amount, but not both.
    * * Table-Level: An exchange rate must be provided if an original debit or credit amount is specified.
    * * Table-Level: If an original debit or credit amount is specified, its corresponding base debit or credit amount must also be provided. If there are no original amounts, both original fields must remain empty.
    * * Table-Level: If an original debit or credit amount is specified, the original currency code must also be provided to ensure proper currency tracking.
    * * Table-Level: A journal entry line cannot have both an original debit amount and an original credit amount specified at the same time.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateLineNumberGreaterThanZero(result);
        this.ValidateDebitOrCreditAmount(result);
        this.ValidateExchangeRateWhenOriginalAmountsExist(result);
        this.ValidateOriginalAndBaseAmounts(result);
        this.ValidateOriginalCurrencyCodeWhenOriginalAmountsExist(result);
        this.ValidateOriginalDebitAndCreditAmountExclusivity(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * Line number must be greater than 0 to ensure journal entry lines are validly numbered.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateLineNumberGreaterThanZero(result: ValidationResult) {
    	if (this.LineNumber != null && this.LineNumber <= 0) {
    		result.Errors.push(new ValidationErrorInfo(
    			"LineNumber",
    			"Line number must be greater than 0.",
    			this.LineNumber,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * Each journal entry line must have either a positive debit amount or a positive credit amount, but not both.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateDebitOrCreditAmount(result: ValidationResult) {
    	const debit = this.DebitAmount;
    	const credit = this.CreditAmount;
    
    	const isValidDebit = debit != null && debit > 0 && credit == null;
    	const isValidCredit = credit != null && credit > 0 && debit == null;
    
    	if (!isValidDebit && !isValidCredit) {
    		if (debit != null && credit != null) {
    			result.Errors.push(new ValidationErrorInfo(
    				"DebitAmount",
    				"A journal entry line cannot have both a Debit Amount and a Credit Amount specified.",
    				debit,
    				ValidationErrorType.Failure
    			));
    		} else if (debit == null && credit == null) {
    			result.Errors.push(new ValidationErrorInfo(
    				"DebitAmount",
    				"A journal entry line must have either a Debit Amount or a Credit Amount specified.",
    				null,
    				ValidationErrorType.Failure
    			));
    		} else if (debit != null && debit <= 0) {
    			result.Errors.push(new ValidationErrorInfo(
    				"DebitAmount",
    				"Debit Amount must be greater than zero.",
    				debit,
    				ValidationErrorType.Failure
    			));
    		} else if (credit != null && credit <= 0) {
    			result.Errors.push(new ValidationErrorInfo(
    				"CreditAmount",
    				"Credit Amount must be greater than zero.",
    				credit,
    				ValidationErrorType.Failure
    			));
    		}
    	}
    }

    /**
    * An exchange rate must be provided if an original debit or credit amount is specified.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateExchangeRateWhenOriginalAmountsExist(result: ValidationResult) {
    	if ((this.OriginalDebitAmount != null || this.OriginalCreditAmount != null) && this.ExchangeRateUsed == null) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ExchangeRateUsed",
    			"An exchange rate must be provided when an original debit or credit amount is specified.",
    			this.ExchangeRateUsed,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * If an original debit or credit amount is specified, its corresponding base debit or credit amount must also be provided. If there are no original amounts, both original fields must remain empty.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    	public ValidateOriginalAndBaseAmounts(result: ValidationResult) {
    		const hasNoOriginals = this.OriginalDebitAmount == null && this.OriginalCreditAmount == null;
    		const hasDebitPair = this.OriginalDebitAmount != null && this.DebitAmount != null;
    		const hasCreditPair = this.OriginalCreditAmount != null && this.CreditAmount != null;
    
    		if (!(hasNoOriginals || hasDebitPair || hasCreditPair)) {
    			result.Errors.push(new ValidationErrorInfo(
    				"OriginalDebitAmount",
    				"If an original debit or credit amount is specified, its corresponding base debit or credit amount must also be provided.",
    				this.OriginalDebitAmount,
    				ValidationErrorType.Failure
    			));
    		}
    	}

    /**
    * If an original debit or credit amount is specified, the original currency code must also be provided to ensure proper currency tracking.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateOriginalCurrencyCodeWhenOriginalAmountsExist(result: ValidationResult) {
    	if ((this.OriginalDebitAmount != null || this.OriginalCreditAmount != null) && this.OriginalCurrencyCode == null) {
    		result.Errors.push(new ValidationErrorInfo(
    			"OriginalCurrencyCode",
    			"An original currency code must be specified if an original debit or credit amount is provided.",
    			this.OriginalCurrencyCode,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * A journal entry line cannot have both an original debit amount and an original credit amount specified at the same time.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateOriginalDebitAndCreditAmountExclusivity(result: ValidationResult) {
    	if (this.OriginalDebitAmount != null && this.OriginalCreditAmount != null) {
    		result.Errors.push(new ValidationErrorInfo(
    			"OriginalDebitAmount",
    			"A journal entry line cannot have both an Original Debit Amount and an Original Credit Amount specified.",
    			this.OriginalDebitAmount,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: JournalEntryID
    * * Display Name: Journal Entry
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
    * * Description: Parent JournalEntry.
    */
    get JournalEntryID(): string {
        return this.Get('JournalEntryID');
    }
    set JournalEntryID(value: string) {
        this.Set('JournalEntryID', value);
    }

    /**
    * * Field Name: LineNumber
    * * Display Name: Line Number
    * * SQL Data Type: int
    * * Description: 1-based ordering of lines within the parent JE.
    */
    get LineNumber(): number {
        return this.Get('LineNumber');
    }
    set LineNumber(value: number) {
        this.Set('LineNumber', value);
    }

    /**
    * * Field Name: GLAccountID
    * * Display Name: GL Account ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: GLAccount this line posts to.
    */
    get GLAccountID(): string {
        return this.Get('GLAccountID');
    }
    set GLAccountID(value: string) {
        this.Set('GLAccountID', value);
    }

    /**
    * * Field Name: DebitAmount
    * * Display Name: Debit Amount
    * * SQL Data Type: decimal(18, 2)
    * * Description: Debit amount in the Company's FUNCTIONAL currency. Mutually exclusive with CreditAmount (CK_JEL_OneSide).
    */
    get DebitAmount(): number | null {
        return this.Get('DebitAmount');
    }
    set DebitAmount(value: number | null) {
        this.Set('DebitAmount', value);
    }

    /**
    * * Field Name: CreditAmount
    * * Display Name: Credit Amount
    * * SQL Data Type: decimal(18, 2)
    * * Description: Credit amount in the Company's FUNCTIONAL currency. Mutually exclusive with DebitAmount.
    */
    get CreditAmount(): number | null {
        return this.Get('CreditAmount');
    }
    set CreditAmount(value: number | null) {
        this.Set('CreditAmount', value);
    }

    /**
    * * Field Name: OriginalCurrencyCode
    * * Display Name: Original Currency Code
    * * SQL Data Type: char(3)
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
    * * Description: ISO 4217 code of the SOURCE-transaction currency (the customer-facing one). NULL when the source is already the functional currency.
    */
    get OriginalCurrencyCode(): string | null {
        return this.Get('OriginalCurrencyCode');
    }
    set OriginalCurrencyCode(value: string | null) {
        this.Set('OriginalCurrencyCode', value);
    }

    /**
    * * Field Name: OriginalDebitAmount
    * * Display Name: Original Debit Amount
    * * SQL Data Type: decimal(18, 2)
    * * Description: Debit amount in the original currency (paired with OriginalCurrencyCode + ExchangeRateUsed).
    */
    get OriginalDebitAmount(): number | null {
        return this.Get('OriginalDebitAmount');
    }
    set OriginalDebitAmount(value: number | null) {
        this.Set('OriginalDebitAmount', value);
    }

    /**
    * * Field Name: OriginalCreditAmount
    * * Display Name: Original Credit Amount
    * * SQL Data Type: decimal(18, 2)
    * * Description: Credit amount in the original currency.
    */
    get OriginalCreditAmount(): number | null {
        return this.Get('OriginalCreditAmount');
    }
    set OriginalCreditAmount(value: number | null) {
        this.Set('OriginalCreditAmount', value);
    }

    /**
    * * Field Name: ExchangeRateUsed
    * * Display Name: Exchange Rate Used
    * * SQL Data Type: decimal(18, 8)
    * * Description: Exchange rate (functional per 1 original) used at booking time. Required when an original amount is present.
    */
    get ExchangeRateUsed(): number | null {
        return this.Get('ExchangeRateUsed');
    }
    set ExchangeRateUsed(value: number | null) {
        this.Set('ExchangeRateUsed', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Free-form description of the line (memo).
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: OrderLineID
    * * Display Name: Order Line
    * * SQL Data Type: uniqueidentifier
    * * Description: Soft polymorphic ref to source OrderLine. NO FK.
    */
    get OrderLineID(): string | null {
        return this.Get('OrderLineID');
    }
    set OrderLineID(value: string | null) {
        this.Set('OrderLineID', value);
    }

    /**
    * * Field Name: CounterpartyOrganizationID
    * * Display Name: Counterparty Organization ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Common: Organizations (vwOrganizations.ID)
    * * Description: For AR-side lines, the Customer Organization. FK to __mj_BizAppsCommon.Organization.
    */
    get CounterpartyOrganizationID(): string | null {
        return this.Get('CounterpartyOrganizationID');
    }
    set CounterpartyOrganizationID(value: string | null) {
        this.Set('CounterpartyOrganizationID', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: GLAccount
    * * Display Name: GL Account
    * * SQL Data Type: nvarchar(200)
    */
    get GLAccount(): string {
        return this.Get('GLAccount');
    }

    /**
    * * Field Name: OriginalCurrencyCode_Virtual
    * * Display Name: Original Currency
    * * SQL Data Type: nvarchar(80)
    */
    get OriginalCurrencyCode_Virtual(): string | null {
        return this.Get('OriginalCurrencyCode_Virtual');
    }

    /**
    * * Field Name: CounterpartyOrganization
    * * Display Name: Counterparty Organization
    * * SQL Data Type: nvarchar(255)
    */
    get CounterpartyOrganization(): string | null {
        return this.Get('CounterpartyOrganization');
    }
}


/**
 * MJ_BizApps_Accounting: Journal Entry Links - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: JournalEntryLink
 * * Base View: vwJournalEntryLinks
 * * @description Polymorphic link from a JournalEntry to any MJ entity record (order/payment/invoice lineage, supporting documents, etc.). EntityID references __mj.Entity; RecordID is the target primary key (NVARCHAR(400) supports stringified composite keys). Upstream apps populate these; Accounting stores them for lineage/drill-through.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entry Links')
export class mjBizAppsAccountingJournalEntryLinkEntity extends BaseEntity<mjBizAppsAccountingJournalEntryLinkEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Journal Entry Links record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Journal Entry Links record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingJournalEntryLinkEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: JournalEntryID
    * * Display Name: Journal Entry
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
    */
    get JournalEntryID(): string {
        return this.Get('JournalEntryID');
    }
    set JournalEntryID(value: string) {
        this.Set('JournalEntryID', value);
    }

    /**
    * * Field Name: EntityID
    * * Display Name: Entity Definition
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
    */
    get EntityID(): string {
        return this.Get('EntityID');
    }
    set EntityID(value: string) {
        this.Set('EntityID', value);
    }

    /**
    * * Field Name: RecordID
    * * Display Name: Target Record ID
    * * SQL Data Type: nvarchar(400)
    */
    get RecordID(): string {
        return this.Get('RecordID');
    }
    set RecordID(value: string) {
        this.Set('RecordID', value);
    }

    /**
    * * Field Name: LinkType
    * * Display Name: Link Type
    * * SQL Data Type: nvarchar(50)
    */
    get LinkType(): string | null {
        return this.Get('LinkType');
    }
    set LinkType(value: string | null) {
        this.Set('LinkType', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Entity
    * * Display Name: Target Entity Name
    * * SQL Data Type: nvarchar(255)
    */
    get Entity(): string {
        return this.Get('Entity');
    }
}


/**
 * MJ_BizApps_Accounting: Journal Entry Sequences - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: JournalEntrySequence
 * * Base View: vwJournalEntrySequences
 * * @description Per-Company × FiscalYear gap-free counter for JournalEntry numbering (BA-D15). Maintained by spAssignNextJournalEntryNumber; do not write directly.
 * * Primary Keys: CompanyID, FiscalYear
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entry Sequences')
export class mjBizAppsAccountingJournalEntrySequenceEntity extends BaseEntity<mjBizAppsAccountingJournalEntrySequenceEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Journal Entry Sequences record from the database
    * @param CompanyID: string - primary key value to load the MJ_BizApps_Accounting: Journal Entry Sequences record.
    * @param FiscalYear: number - primary key value to load the MJ_BizApps_Accounting: Journal Entry Sequences record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingJournalEntrySequenceEntity
    * @method
    * @override
    */
    public async Load(CompanyID: string, FiscalYear: number, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'CompanyID', Value: CompanyID });
        compositeKey.KeyValuePairs.push({ FieldName: 'FiscalYear', Value: FiscalYear });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Journal Entry Sequences entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * NextSequenceNumber: The next sequence number must be a positive number greater than zero to ensure sequence tracking remains valid.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateNextSequenceNumberGreaterThanZero(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The next sequence number must be a positive number greater than zero to ensure sequence tracking remains valid.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateNextSequenceNumberGreaterThanZero(result: ValidationResult) {
    	if (this.NextSequenceNumber != null && this.NextSequenceNumber <= 0) {
    		result.Errors.push(new ValidationErrorInfo(
    			"NextSequenceNumber",
    			"The next sequence number must be greater than 0.",
    			this.NextSequenceNumber,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: Company.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: FiscalYear
    * * Display Name: Fiscal Year
    * * SQL Data Type: int
    * * Description: Fiscal year. Sequence resets at fiscal-year boundaries (BA-D15).
    */
    get FiscalYear(): number {
        return this.Get('FiscalYear');
    }
    set FiscalYear(value: number) {
        this.Set('FiscalYear', value);
    }

    /**
    * * Field Name: NextSequenceNumber
    * * Display Name: Next Sequence Number
    * * SQL Data Type: int
    * * Default Value: 1
    * * Description: Next sequence number to assign (1-based). Atomically read and incremented under HOLDLOCK+UPDLOCK.
    */
    get NextSequenceNumber(): number {
        return this.Get('NextSequenceNumber');
    }
    set NextSequenceNumber(value: number) {
        this.Set('NextSequenceNumber', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }
}


/**
 * MJ_BizApps_Accounting: Recurring Journal Entries - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: RecurringJournalEntry
 * * Base View: vwRecurringJournalEntries
 * * @description Scheduled instance of a RecurringJournalEntryTemplate. Cron-driven; emits Pending JEs on its cadence.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Recurring Journal Entries')
export class mjBizAppsAccountingRecurringJournalEntryEntity extends BaseEntity<mjBizAppsAccountingRecurringJournalEntryEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Recurring Journal Entries record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Recurring Journal Entries record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingRecurringJournalEntryEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Recurring Journal Entries entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Table-Level: The end date must be on or after the start date.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateEndDateAfterStartDate(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The end date must be on or after the start date.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateEndDateAfterStartDate(result: ValidationResult) {
    	if (this.EndDate != null && this.StartDate != null && this.EndDate < this.StartDate) {
    		result.Errors.push(new ValidationErrorInfo(
    			"EndDate",
    			"The end date must be on or after the start date.",
    			this.EndDate,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: TemplateID
    * * Display Name: Template
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Recurring Journal Entry Templates (vwRecurringJournalEntryTemplates.ID)
    * * Description: Template that this schedule emits.
    */
    get TemplateID(): string {
        return this.Get('TemplateID');
    }
    set TemplateID(value: string) {
        this.Set('TemplateID', value);
    }

    /**
    * * Field Name: ScheduleCron
    * * Display Name: Cron Schedule
    * * SQL Data Type: nvarchar(100)
    * * Description: Standard cron expression for the emit cadence.
    */
    get ScheduleCron(): string {
        return this.Get('ScheduleCron');
    }
    set ScheduleCron(value: string) {
        this.Set('ScheduleCron', value);
    }

    /**
    * * Field Name: StartDate
    * * Display Name: Start Date
    * * SQL Data Type: date
    * * Description: Earliest date the schedule may emit.
    */
    get StartDate(): Date {
        return this.Get('StartDate');
    }
    set StartDate(value: Date) {
        this.Set('StartDate', value);
    }

    /**
    * * Field Name: EndDate
    * * Display Name: End Date
    * * SQL Data Type: date
    * * Description: Last date the schedule may emit (NULL = open-ended).
    */
    get EndDate(): Date | null {
        return this.Get('EndDate');
    }
    set EndDate(value: Date | null) {
        this.Set('EndDate', value);
    }

    /**
    * * Field Name: LastEmittedAt
    * * Display Name: Last Emitted At
    * * SQL Data Type: datetimeoffset
    * * Description: When this schedule last emitted a JE.
    */
    get LastEmittedAt(): Date | null {
        return this.Get('LastEmittedAt');
    }
    set LastEmittedAt(value: Date | null) {
        this.Set('LastEmittedAt', value);
    }

    /**
    * * Field Name: NextScheduledAt
    * * Display Name: Next Scheduled At
    * * SQL Data Type: datetimeoffset
    * * Description: Computed next emit time based on ScheduleCron.
    */
    get NextScheduledAt(): Date | null {
        return this.Get('NextScheduledAt');
    }
    set NextScheduledAt(value: Date | null) {
        this.Set('NextScheduledAt', value);
    }

    /**
    * * Field Name: RequiresApproval
    * * Display Name: Requires Approval
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: If TRUE, emitted JEs are Pending awaiting approval before they can be batched.
    */
    get RequiresApproval(): boolean {
        return this.Get('RequiresApproval');
    }
    set RequiresApproval(value: boolean) {
        this.Set('RequiresApproval', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Whether the schedule is currently active.
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Template
    * * Display Name: Template Name
    * * SQL Data Type: nvarchar(200)
    */
    get Template(): string {
        return this.Get('Template');
    }
}


/**
 * MJ_BizApps_Accounting: Recurring Journal Entry Template Lines - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: RecurringJournalEntryTemplateLine
 * * Base View: vwRecurringJournalEntryTemplateLines
 * * @description Shape of one line in a recurring-JE template. Engine instantiates these with amounts at emit time.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Recurring Journal Entry Template Lines')
export class mjBizAppsAccountingRecurringJournalEntryTemplateLineEntity extends BaseEntity<mjBizAppsAccountingRecurringJournalEntryTemplateLineEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Recurring Journal Entry Template Lines record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Recurring Journal Entry Template Lines record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingRecurringJournalEntryTemplateLineEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: TemplateID
    * * Display Name: Template
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Recurring Journal Entry Templates (vwRecurringJournalEntryTemplates.ID)
    * * Description: Template this line belongs to.
    */
    get TemplateID(): string {
        return this.Get('TemplateID');
    }
    set TemplateID(value: string) {
        this.Set('TemplateID', value);
    }

    /**
    * * Field Name: LineNumber
    * * Display Name: Line Number
    * * SQL Data Type: int
    * * Description: Order of this line within the template (1-based).
    */
    get LineNumber(): number {
        return this.Get('LineNumber');
    }
    set LineNumber(value: number) {
        this.Set('LineNumber', value);
    }

    /**
    * * Field Name: GLAccountID
    * * Display Name: GL Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: GLAccount the line posts to.
    */
    get GLAccountID(): string {
        return this.Get('GLAccountID');
    }
    set GLAccountID(value: string) {
        this.Set('GLAccountID', value);
    }

    /**
    * * Field Name: DimensionTagsJson
    * * Display Name: Dimension Tags
    * * SQL Data Type: nvarchar(MAX)
    * * Description: JSON object of {DimensionCode: DimensionValueCode} pairs to tag the emitted line with.
    */
    get DimensionTagsJson(): string | null {
        return this.Get('DimensionTagsJson');
    }
    set DimensionTagsJson(value: string | null) {
        this.Set('DimensionTagsJson', value);
    }

    /**
    * * Field Name: IsDebitSide
    * * Display Name: Is Debit
    * * SQL Data Type: bit
    * * Description: TRUE = this line posts as a Debit; FALSE = Credit.
    */
    get IsDebitSide(): boolean {
        return this.Get('IsDebitSide');
    }
    set IsDebitSide(value: boolean) {
        this.Set('IsDebitSide', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Template
    * * Display Name: Template Name
    * * SQL Data Type: nvarchar(200)
    */
    get Template(): string {
        return this.Get('Template');
    }

    /**
    * * Field Name: GLAccount
    * * Display Name: GL Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get GLAccount(): string {
        return this.Get('GLAccount');
    }
}


/**
 * MJ_BizApps_Accounting: Recurring Journal Entry Templates - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: RecurringJournalEntryTemplate
 * * Base View: vwRecurringJournalEntryTemplates
 * * @description Reusable JE pattern emitted on a schedule — accruals, FX revaluation, depreciation, prepaid amortization (plan §4.9, BA-D18).
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Recurring Journal Entry Templates')
export class mjBizAppsAccountingRecurringJournalEntryTemplateEntity extends BaseEntity<mjBizAppsAccountingRecurringJournalEntryTemplateEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Recurring Journal Entry Templates record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Recurring Journal Entry Templates record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingRecurringJournalEntryTemplateEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Recurring Journal Entry Templates entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Table-Level: Ensures that a valid amount calculation type is selected, requiring an Amount Value when 'Fixed' is chosen, and an Amount Formula when 'Formula' is chosen.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateAmountCalculationTypeFields(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * Ensures that a valid amount calculation type is selected, requiring an Amount Value when 'Fixed' is chosen, and an Amount Formula when 'Formula' is chosen.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateAmountCalculationTypeFields(result: ValidationResult) {
    	if (this.AmountCalculationType === "Fixed") {
    		if (this.AmountValue == null) {
    			result.Errors.push(new ValidationErrorInfo(
    				"AmountValue",
    				"An Amount Value must be specified when the Amount Calculation Type is 'Fixed'.",
    				this.AmountValue,
    				ValidationErrorType.Failure
    			));
    		}
    	} else if (this.AmountCalculationType === "Formula") {
    		if (this.AmountFormula == null || this.AmountFormula.trim() === "") {
    			result.Errors.push(new ValidationErrorInfo(
    				"AmountFormula",
    				"An Amount Formula must be specified when the Amount Calculation Type is 'Formula'.",
    				this.AmountFormula,
    				ValidationErrorType.Failure
    			));
    		}
    	} else if (this.AmountCalculationType !== "ExternalLookup") {
    		result.Errors.push(new ValidationErrorInfo(
    			"AmountCalculationType",
    			"The Amount Calculation Type must be 'Fixed', 'Formula', or 'ExternalLookup'.",
    			this.AmountCalculationType,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    * * Description: Display name (e.g. 'Monthly FX Revaluation', 'Office Lease Amortization').
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Detailed description of what the template emits and why.
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: Company that owns this template.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: EntryType
    * * Display Name: Entry Type
    * * SQL Data Type: nvarchar(40)
    * * Description: EntryType assigned to emitted JEs (FXRevaluation | PeriodEndAccrual | ...).
    */
    get EntryType(): string {
        return this.Get('EntryType');
    }
    set EntryType(value: string) {
        this.Set('EntryType', value);
    }

    /**
    * * Field Name: AmountCalculationType
    * * Display Name: Calculation Method
    * * SQL Data Type: nvarchar(40)
    * * Default Value: Fixed
    * * Value List Type: List
    * * Possible Values 
    *   * ExternalLookup
    *   * Fixed
    *   * Formula
    * * Description: How the line amounts are determined: Fixed (AmountValue), Formula (AmountFormula), or ExternalLookup (engine fetches at emit time).
    */
    get AmountCalculationType(): 'ExternalLookup' | 'Fixed' | 'Formula' {
        return this.Get('AmountCalculationType');
    }
    set AmountCalculationType(value: 'ExternalLookup' | 'Fixed' | 'Formula') {
        this.Set('AmountCalculationType', value);
    }

    /**
    * * Field Name: AmountValue
    * * Display Name: Fixed Amount
    * * SQL Data Type: decimal(18, 2)
    * * Description: Fixed amount when AmountCalculationType=Fixed.
    */
    get AmountValue(): number | null {
        return this.Get('AmountValue');
    }
    set AmountValue(value: number | null) {
        this.Set('AmountValue', value);
    }

    /**
    * * Field Name: AmountFormula
    * * Display Name: Calculation Formula
    * * SQL Data Type: nvarchar(MAX)
    * * Description: SQL formula evaluated at emit time when AmountCalculationType=Formula. Must return a single decimal.
    */
    get AmountFormula(): string | null {
        return this.Get('AmountFormula');
    }
    set AmountFormula(value: string | null) {
        this.Set('AmountFormula', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Whether this template is currently active.
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company Name
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }
}


/**
 * MJ_BizApps_Accounting: Tax Authorities - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: TaxAuthority
 * * Base View: vwTaxAuthorities
 * * @description Taxing body — federal, state, or sub-national authority that levies and collects tax. Examples: US-IRS, CA-BOE, EU-VAT-DE.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Tax Authorities')
export class mjBizAppsAccountingTaxAuthorityEntity extends BaseEntity<mjBizAppsAccountingTaxAuthorityEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Tax Authorities record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Tax Authorities record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingTaxAuthorityEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Authority Code
    * * SQL Data Type: nvarchar(40)
    * * Description: Globally unique authority code, e.g. 'US-IRS', 'CA-BOE', 'EU-VAT-DE'.
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    * * Description: Display name for the authority.
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: CountryCode
    * * Display Name: Country
    * * SQL Data Type: char(2)
    * * Description: ISO 3166-1 alpha-2 country code for the authority's primary jurisdiction.
    */
    get CountryCode(): string | null {
        return this.Get('CountryCode');
    }
    set CountryCode(value: string | null) {
        this.Set('CountryCode', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Active
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Whether this authority is currently active.
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: __mj_Latitude
    * * Display Name: Mj Latitude
    * * SQL Data Type: decimal(10, 6)
    */
    get __mj_Latitude(): number | null {
        return this.Get('__mj_Latitude');
    }

    /**
    * * Field Name: __mj_Longitude
    * * Display Name: Mj Longitude
    * * SQL Data Type: decimal(10, 6)
    */
    get __mj_Longitude(): number | null {
        return this.Get('__mj_Longitude');
    }
}


/**
 * MJ_BizApps_Accounting: Tax Jurisdictions - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: TaxJurisdiction
 * * Base View: vwTaxJurisdictions
 * * @description Geographic scope within a TaxAuthority. May nest (state → county → city) via ParentTaxJurisdictionID. Used to look up the applicable TaxRate for a transaction.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Tax Jurisdictions')
export class mjBizAppsAccountingTaxJurisdictionEntity extends BaseEntity<mjBizAppsAccountingTaxJurisdictionEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Tax Jurisdictions record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Tax Jurisdictions record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingTaxJurisdictionEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: TaxAuthorityID
    * * Display Name: Tax Authority
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Authorities (vwTaxAuthorities.ID)
    * * Description: TaxAuthority this jurisdiction belongs to.
    */
    get TaxAuthorityID(): string {
        return this.Get('TaxAuthorityID');
    }
    set TaxAuthorityID(value: string) {
        this.Set('TaxAuthorityID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Jurisdiction Code
    * * SQL Data Type: nvarchar(80)
    * * Description: Globally unique jurisdiction code.
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    * * Description: Display name (e.g. 'California State', 'Los Angeles County').
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: CountryCode
    * * Display Name: Country Code
    * * SQL Data Type: char(2)
    * * Description: ISO 3166-1 alpha-2 country code.
    */
    get CountryCode(): string | null {
        return this.Get('CountryCode');
    }
    set CountryCode(value: string | null) {
        this.Set('CountryCode', value);
    }

    /**
    * * Field Name: RegionCode
    * * Display Name: Region Code
    * * SQL Data Type: nvarchar(50)
    * * Description: State/province sub-national region, free-form (e.g. 'CA', 'NSW', 'Bavaria').
    */
    get RegionCode(): string | null {
        return this.Get('RegionCode');
    }
    set RegionCode(value: string | null) {
        this.Set('RegionCode', value);
    }

    /**
    * * Field Name: PostalCode
    * * Display Name: Postal Code
    * * SQL Data Type: nvarchar(20)
    * * Description: Specific postal code scoping (if exact match required).
    */
    get PostalCode(): string | null {
        return this.Get('PostalCode');
    }
    set PostalCode(value: string | null) {
        this.Set('PostalCode', value);
    }

    /**
    * * Field Name: PostalCodeStart
    * * Display Name: Postal Code Start
    * * SQL Data Type: nvarchar(20)
    * * Description: Start of postal-code range when the jurisdiction covers a contiguous range.
    */
    get PostalCodeStart(): string | null {
        return this.Get('PostalCodeStart');
    }
    set PostalCodeStart(value: string | null) {
        this.Set('PostalCodeStart', value);
    }

    /**
    * * Field Name: PostalCodeEnd
    * * Display Name: Postal Code End
    * * SQL Data Type: nvarchar(20)
    * * Description: End of postal-code range.
    */
    get PostalCodeEnd(): string | null {
        return this.Get('PostalCodeEnd');
    }
    set PostalCodeEnd(value: string | null) {
        this.Set('PostalCodeEnd', value);
    }

    /**
    * * Field Name: CityName
    * * Display Name: City Name
    * * SQL Data Type: nvarchar(200)
    * * Description: City name scoping (if the jurisdiction is city-specific).
    */
    get CityName(): string | null {
        return this.Get('CityName');
    }
    set CityName(value: string | null) {
        this.Set('CityName', value);
    }

    /**
    * * Field Name: ParentTaxJurisdictionID
    * * Display Name: Parent Jurisdiction
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Jurisdictions (vwTaxJurisdictions.ID)
    * * Description: Parent jurisdiction for nested scopes (e.g. county inside state).
    */
    get ParentTaxJurisdictionID(): string | null {
        return this.Get('ParentTaxJurisdictionID');
    }
    set ParentTaxJurisdictionID(value: string | null) {
        this.Set('ParentTaxJurisdictionID', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Whether this jurisdiction is currently active.
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: TaxAuthority
    * * Display Name: Tax Authority Name
    * * SQL Data Type: nvarchar(200)
    */
    get TaxAuthority(): string {
        return this.Get('TaxAuthority');
    }

    /**
    * * Field Name: ParentTaxJurisdiction
    * * Display Name: Parent Jurisdiction Name
    * * SQL Data Type: nvarchar(200)
    */
    get ParentTaxJurisdiction(): string | null {
        return this.Get('ParentTaxJurisdiction');
    }

    /**
    * * Field Name: __mj_Latitude
    * * Display Name: Mj Latitude
    * * SQL Data Type: decimal(10, 6)
    */
    get __mj_Latitude(): number | null {
        return this.Get('__mj_Latitude');
    }

    /**
    * * Field Name: __mj_Longitude
    * * Display Name: Mj Longitude
    * * SQL Data Type: decimal(10, 6)
    */
    get __mj_Longitude(): number | null {
        return this.Get('__mj_Longitude');
    }

    /**
    * * Field Name: RootParentTaxJurisdictionID
    * * Display Name: Root Parent Jurisdiction
    * * SQL Data Type: uniqueidentifier
    */
    get RootParentTaxJurisdictionID(): string | null {
        return this.Get('RootParentTaxJurisdictionID');
    }
}


/**
 * MJ_BizApps_Accounting: Tax Liabilities - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: TaxLiability
 * * Base View: vwTaxLiabilities
 * * @description Open tax liability balance per (Company × Authority × Jurisdiction × Period). Accrued from JE postings; paid down via TaxRemittance records.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Tax Liabilities')
export class mjBizAppsAccountingTaxLiabilityEntity extends BaseEntity<mjBizAppsAccountingTaxLiabilityEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Tax Liabilities record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Tax Liabilities record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingTaxLiabilityEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Tax Liabilities entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Table-Level: Accrued and remitted amounts must be greater than or equal to zero to prevent negative financial entries.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateAccruedAndRemittedAmountsAreNonNegative(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * Accrued and remitted amounts must be greater than or equal to zero to prevent negative financial entries.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateAccruedAndRemittedAmountsAreNonNegative(result: ValidationResult) {
    	if (this.AccruedAmount != null && this.AccruedAmount < 0) {
    		result.Errors.push(new ValidationErrorInfo(
    			"AccruedAmount",
    			"Accrued amount must be greater than or equal to zero.",
    			this.AccruedAmount,
    			ValidationErrorType.Failure
    		));
    	}
    	if (this.RemittedAmount != null && this.RemittedAmount < 0) {
    		result.Errors.push(new ValidationErrorInfo(
    			"RemittedAmount",
    			"Remitted amount must be greater than or equal to zero.",
    			this.RemittedAmount,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: Company this liability belongs to.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: TaxAuthorityID
    * * Display Name: Tax Authority
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Authorities (vwTaxAuthorities.ID)
    * * Description: TaxAuthority owed.
    */
    get TaxAuthorityID(): string {
        return this.Get('TaxAuthorityID');
    }
    set TaxAuthorityID(value: string) {
        this.Set('TaxAuthorityID', value);
    }

    /**
    * * Field Name: TaxJurisdictionID
    * * Display Name: Tax Jurisdiction
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Jurisdictions (vwTaxJurisdictions.ID)
    * * Description: TaxJurisdiction the liability is scoped to.
    */
    get TaxJurisdictionID(): string {
        return this.Get('TaxJurisdictionID');
    }
    set TaxJurisdictionID(value: string) {
        this.Set('TaxJurisdictionID', value);
    }

    /**
    * * Field Name: AccountingPeriodID
    * * Display Name: Accounting Period
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Accounting Periods (vwAccountingPeriods.ID)
    * * Description: Period this liability is reported for.
    */
    get AccountingPeriodID(): string {
        return this.Get('AccountingPeriodID');
    }
    set AccountingPeriodID(value: string) {
        this.Set('AccountingPeriodID', value);
    }

    /**
    * * Field Name: AccruedAmount
    * * Display Name: Accrued Amount
    * * SQL Data Type: decimal(18, 2)
    * * Default Value: 0
    * * Description: Total tax accrued during the period (in functional currency).
    */
    get AccruedAmount(): number {
        return this.Get('AccruedAmount');
    }
    set AccruedAmount(value: number) {
        this.Set('AccruedAmount', value);
    }

    /**
    * * Field Name: RemittedAmount
    * * Display Name: Remitted Amount
    * * SQL Data Type: decimal(18, 2)
    * * Default Value: 0
    * * Description: Total amount remitted against this liability so far.
    */
    get RemittedAmount(): number {
        return this.Get('RemittedAmount');
    }
    set RemittedAmount(value: number) {
        this.Set('RemittedAmount', value);
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(20)
    * * Default Value: Open
    * * Value List Type: List
    * * Possible Values 
    *   * Filed
    *   * Open
    *   * Paid
    *   * PartiallyPaid
    * * Description: Lifecycle: Open | Filed | Paid | PartiallyPaid.
    */
    get Status(): 'Filed' | 'Open' | 'Paid' | 'PartiallyPaid' {
        return this.Get('Status');
    }
    set Status(value: 'Filed' | 'Open' | 'Paid' | 'PartiallyPaid') {
        this.Set('Status', value);
    }

    /**
    * * Field Name: DueDate
    * * Display Name: Due Date
    * * SQL Data Type: date
    * * Description: Statutory due date for filing/remittance.
    */
    get DueDate(): Date | null {
        return this.Get('DueDate');
    }
    set DueDate(value: Date | null) {
        this.Set('DueDate', value);
    }

    /**
    * * Field Name: FilingFrequency
    * * Display Name: Filing Frequency
    * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Annual
    *   * Monthly
    *   * OnDemand
    *   * Quarterly
    *   * SemiAnnual
    * * Description: Filing cadence: Monthly | Quarterly | SemiAnnual | Annual | OnDemand.
    */
    get FilingFrequency(): 'Annual' | 'Monthly' | 'OnDemand' | 'Quarterly' | 'SemiAnnual' | null {
        return this.Get('FilingFrequency');
    }
    set FilingFrequency(value: 'Annual' | 'Monthly' | 'OnDemand' | 'Quarterly' | 'SemiAnnual' | null) {
        this.Set('FilingFrequency', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company Name
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }

    /**
    * * Field Name: TaxAuthority
    * * Display Name: Tax Authority Name
    * * SQL Data Type: nvarchar(200)
    */
    get TaxAuthority(): string {
        return this.Get('TaxAuthority');
    }

    /**
    * * Field Name: TaxJurisdiction
    * * Display Name: Tax Jurisdiction Name
    * * SQL Data Type: nvarchar(200)
    */
    get TaxJurisdiction(): string {
        return this.Get('TaxJurisdiction');
    }
}


/**
 * MJ_BizApps_Accounting: Tax Rates - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: TaxRate
 * * Base View: vwTaxRates
 * * @description Rate applicable to a jurisdiction × category × effective range. Populated manually for simple cases or auto-synced from Avalara/TaxJar (per BA-D19).
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Tax Rates')
export class mjBizAppsAccountingTaxRateEntity extends BaseEntity<mjBizAppsAccountingTaxRateEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Tax Rates record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Tax Rates record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingTaxRateEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Tax Rates entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Rate: The rate must be a decimal value between 0 and 1 (inclusive), representing a percentage from 0% to 100%.
    * * Table-Level: The end date (Effective To) must be on or after the start date (Effective From) if an end date is specified.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateRateRange(result);
        this.ValidateEffectiveToAfterOrEqualEffectiveFrom(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The rate must be a decimal value between 0 and 1 (inclusive), representing a percentage from 0% to 100%.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateRateRange(result: ValidationResult) {
    	if (this.Rate != null && (this.Rate < 0 || this.Rate > 1)) {
    		result.Errors.push(new ValidationErrorInfo(
    			"Rate",
    			"The Rate must be a decimal value between 0 and 1 (inclusive).",
    			this.Rate,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * The end date (Effective To) must be on or after the start date (Effective From) if an end date is specified.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateEffectiveToAfterOrEqualEffectiveFrom(result: ValidationResult) {
    	if (this.EffectiveTo != null && this.EffectiveFrom != null) {
    		if (new Date(this.EffectiveTo) < new Date(this.EffectiveFrom)) {
    			result.Errors.push(new ValidationErrorInfo(
    				"EffectiveTo",
    				"The 'Effective To' date must be on or after the 'Effective From' date.",
    				this.EffectiveTo,
    				ValidationErrorType.Failure
    			));
    		}
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: TaxJurisdictionID
    * * Display Name: Tax Jurisdiction ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Jurisdictions (vwTaxJurisdictions.ID)
    * * Description: Jurisdiction this rate applies to.
    */
    get TaxJurisdictionID(): string {
        return this.Get('TaxJurisdictionID');
    }
    set TaxJurisdictionID(value: string) {
        this.Set('TaxJurisdictionID', value);
    }

    /**
    * * Field Name: TaxCategory
    * * Display Name: Tax Category
    * * SQL Data Type: nvarchar(50)
    * * Value List Type: List
    * * Possible Values 
    *   * Custom
    *   * Exempt
    *   * Reduced
    *   * Standard
    *   * Zero
    * * Description: Tax category: Standard | Reduced | Zero | Exempt | Custom.
    */
    get TaxCategory(): 'Custom' | 'Exempt' | 'Reduced' | 'Standard' | 'Zero' {
        return this.Get('TaxCategory');
    }
    set TaxCategory(value: 'Custom' | 'Exempt' | 'Reduced' | 'Standard' | 'Zero') {
        this.Set('TaxCategory', value);
    }

    /**
    * * Field Name: Rate
    * * Display Name: Rate
    * * SQL Data Type: decimal(7, 4)
    * * Description: Rate as a decimal fraction. 0.0825 = 8.25%.
    */
    get Rate(): number {
        return this.Get('Rate');
    }
    set Rate(value: number) {
        this.Set('Rate', value);
    }

    /**
    * * Field Name: EffectiveFrom
    * * Display Name: Effective From
    * * SQL Data Type: date
    * * Description: Earliest date this rate is effective.
    */
    get EffectiveFrom(): Date {
        return this.Get('EffectiveFrom');
    }
    set EffectiveFrom(value: Date) {
        this.Set('EffectiveFrom', value);
    }

    /**
    * * Field Name: EffectiveTo
    * * Display Name: Effective To
    * * SQL Data Type: date
    * * Description: Last date this rate is effective (NULL = open-ended).
    */
    get EffectiveTo(): Date | null {
        return this.Get('EffectiveTo');
    }
    set EffectiveTo(value: Date | null) {
        this.Set('EffectiveTo', value);
    }

    /**
    * * Field Name: Source
    * * Display Name: Source
    * * SQL Data Type: nvarchar(50)
    * * Default Value: Manual
    * * Value List Type: List
    * * Possible Values 
    *   * Avalara
    *   * Manual
    *   * TaxJar
    * * Description: Source of the rate: Avalara | TaxJar | Manual.
    */
    get Source(): 'Avalara' | 'Manual' | 'TaxJar' {
        return this.Get('Source');
    }
    set Source(value: 'Avalara' | 'Manual' | 'TaxJar') {
        this.Set('Source', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: TaxJurisdiction
    * * Display Name: Tax Jurisdiction
    * * SQL Data Type: nvarchar(200)
    */
    get TaxJurisdiction(): string {
        return this.Get('TaxJurisdiction');
    }
}


/**
 * MJ_BizApps_Accounting: Tax Remittances - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: TaxRemittance
 * * Base View: vwTaxRemittances
 * * @description A payment made against a TaxLiability. Generates a JE of EntryType=TaxRemittance via PostedJournalEntryID.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Tax Remittances')
export class mjBizAppsAccountingTaxRemittanceEntity extends BaseEntity<mjBizAppsAccountingTaxRemittanceEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Tax Remittances record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Tax Remittances record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingTaxRemittanceEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Tax Remittances entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * RemittedAmount: The remitted amount must be greater than zero.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateRemittedAmountGreaterThanZero(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The remitted amount must be greater than zero.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateRemittedAmountGreaterThanZero(result: ValidationResult) {
    	if (this.RemittedAmount != null && this.RemittedAmount <= 0) {
    		result.Errors.push(new ValidationErrorInfo(
    			"RemittedAmount",
    			"The remitted amount must be greater than zero.",
    			this.RemittedAmount,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    * * Description: Unique identifier.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: TaxLiabilityID
    * * Display Name: Tax Liability
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Liabilities (vwTaxLiabilities.ID)
    * * Description: Liability this payment is against.
    */
    get TaxLiabilityID(): string {
        return this.Get('TaxLiabilityID');
    }
    set TaxLiabilityID(value: string) {
        this.Set('TaxLiabilityID', value);
    }

    /**
    * * Field Name: RemittedAmount
    * * Display Name: Remitted Amount
    * * SQL Data Type: decimal(18, 2)
    * * Description: Amount remitted (functional currency).
    */
    get RemittedAmount(): number {
        return this.Get('RemittedAmount');
    }
    set RemittedAmount(value: number) {
        this.Set('RemittedAmount', value);
    }

    /**
    * * Field Name: RemittedDate
    * * Display Name: Remitted Date
    * * SQL Data Type: date
    * * Description: Date the remittance was paid.
    */
    get RemittedDate(): Date {
        return this.Get('RemittedDate');
    }
    set RemittedDate(value: Date) {
        this.Set('RemittedDate', value);
    }

    /**
    * * Field Name: PaymentReference
    * * Display Name: Payment Reference
    * * SQL Data Type: nvarchar(100)
    * * Description: External payment reference (wire ID, check number, confirmation code).
    */
    get PaymentReference(): string | null {
        return this.Get('PaymentReference');
    }
    set PaymentReference(value: string | null) {
        this.Set('PaymentReference', value);
    }

    /**
    * * Field Name: PostedJournalEntryID
    * * Display Name: Posted Journal Entry
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
    * * Description: JE that records this remittance.
    */
    get PostedJournalEntryID(): string | null {
        return this.Get('PostedJournalEntryID');
    }
    set PostedJournalEntryID(value: string | null) {
        this.Set('PostedJournalEntryID', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }
}
