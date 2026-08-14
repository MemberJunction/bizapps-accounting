import { BaseEntity, EntitySaveOptions, EntityDeleteOptions, CompositeKey, ValidationResult, ValidationErrorInfo, ValidationErrorType, Metadata, ProviderType, DatabaseProviderBase } from "@memberjunction/core";
import { RegisterClass } from "@memberjunction/global";
import { z } from "zod";

export const loadModule = () => {
  // no-op, only used to ensure this file is a valid module and to allow easy loading
}

     
 
/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Accounting Company Profiles
 */
export const mjBizAppsAccountingAccountingCompanyProfileSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: Company ID
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
        * * Display Name: Legal Structure Type
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
    OperatingTimeZone: z.string().nullable().describe(`
        * * Field Name: OperatingTimeZone
        * * Display Name: Operating Time Zone
        * * SQL Data Type: nvarchar(60)
        * * Description: IANA time-zone name for the company's operations (e.g. 'America/Chicago'). All timestamps store in UTC/Zulu; period and rev-rec boundaries are evaluated in this zone so a transaction near midnight lands in the right local day/month.`),
    CompanyCode: z.string().describe(`
        * * Field Name: CompanyCode
        * * Display Name: Company Code
        * * SQL Data Type: nvarchar(20)
        * * Description: Short code used in JE numbering ('JE-{CompanyCode}-{FY}-{seq}'). Uppercase alphanumeric + dash/underscore. UNIQUE per deployment (BA-D15).`),
    FunctionalCurrencyCode: z.string().describe(`
        * * Field Name: FunctionalCurrencyCode
        * * Display Name: Functional Currency Code
        * * SQL Data Type: char(3)
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)
        * * Description: ISO 4217 currency code (CHAR(3)) for the functional currency. All JEs post in this currency; original-currency triple on JE lines records the source-transaction currency when different (BA-D10).`),
    ReportingCurrencyCode: z.string().nullable().describe(`
        * * Field Name: ReportingCurrencyCode
        * * Display Name: Reporting Currency Code
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
    ApprovalCFOUserID: z.string().nullable().describe(`
        * * Field Name: ApprovalCFOUserID
        * * Display Name: Approval CFO User
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
        * * Description: The CFO (an __mj.User — a security identity) who must approve a Journal Entry Batch for this company before it dispatches to the ERP. Resolved by the bizapps-tasks approval gate. Nullable: companies without a configured CFO fall back to the role-based resolver.`),
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
        * * Display Name: Name
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
        * * Display Name: Functional Currency (Virtual)
        * * SQL Data Type: nvarchar(80)`),
    ReportingCurrencyCode_Virtual: z.string().nullable().describe(`
        * * Field Name: ReportingCurrencyCode_Virtual
        * * Display Name: Reporting Currency (Virtual)
        * * SQL Data Type: nvarchar(80)`),
    ApprovalCFOUser: z.string().nullable().describe(`
        * * Field Name: ApprovalCFOUser
        * * Display Name: Approval CFO User Name
        * * SQL Data Type: nvarchar(100)`),
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
        * * Display Name: Root Parent Accounting Company
        * * SQL Data Type: uniqueidentifier`),
});

export type mjBizAppsAccountingAccountingCompanyProfileEntityType = z.infer<typeof mjBizAppsAccountingAccountingCompanyProfileSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Company Tax Nexus
 */
export const mjBizAppsAccountingCompanyTaxNexusSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: The legal entity with the obligation.`),
    TaxJurisdictionID: z.string().describe(`
        * * Field Name: TaxJurisdictionID
        * * Display Name: Tax Jurisdiction
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Jurisdictions (vwTaxJurisdictions.ID)
        * * Description: The jurisdiction it must collect for.`),
    NexusType: z.union([z.literal('Economic'), z.literal('Marketplace'), z.literal('Physical'), z.literal('Voluntary')]).describe(`
        * * Field Name: NexusType
        * * Display Name: Nexus Type
        * * SQL Data Type: nvarchar(20)
        * * Default Value: Economic
    * * Value List Type: List
    * * Possible Values 
    *   * Economic
    *   * Marketplace
    *   * Physical
    *   * Voluntary
        * * Description: WHY the obligation exists: Economic (crossed a revenue or transaction threshold), Physical (people, property or inventory in the state), Marketplace (a facilitator law attributes it) or Voluntary (registered without being required).`),
    RegistrationNumber: z.string().nullable().describe(`
        * * Field Name: RegistrationNumber
        * * Display Name: Registration Number
        * * SQL Data Type: nvarchar(100)
        * * Description: The permit or registration number issued by the jurisdiction.`),
    RegisteredFrom: z.date().describe(`
        * * Field Name: RegisteredFrom
        * * Display Name: Registered From
        * * SQL Data Type: date
        * * Description: When the registration took effect.`),
    RegisteredTo: z.date().nullable().describe(`
        * * Field Name: RegisteredTo
        * * Display Name: Registered To
        * * SQL Data Type: date
        * * Description: When the REGISTRATION ended - not when the activity stopped. Registration is a one-way door: you must keep filing, including zero returns, until the account is formally closed, and a state will not close one with open periods.`),
    ObligationEndsAt: z.date().nullable().describe(`
        * * Field Name: ObligationEndsAt
        * * Display Name: Obligation Ends At
        * * SQL Data Type: date
        * * Description: When the duty to COLLECT ends, which routinely outlasts the activity that created it. California holds a seller through the nexus year plus the whole following calendar year; Colorado, Washington, Wisconsin, Iowa and Michigan through the following calendar year; Texas until twelve consecutive months below the threshold. Separate from RegisteredTo because collapsing the two would end the obligation early.`),
    Status: z.union([z.literal('Active'), z.literal('Inactive')]).describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(10)
        * * Default Value: Active
    * * Value List Type: List
    * * Possible Values 
    *   * Active
    *   * Inactive
        * * Description: Active | Inactive. A closed registration is retained rather than deleted - it is the evidence of what was true during an audited period.`),
    Comments: z.string().nullable().describe(`
        * * Field Name: Comments
        * * Display Name: Comments
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Free-text note, typically the nexus study or ruling that established the obligation.`),
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
    TaxJurisdiction: z.string().describe(`
        * * Field Name: TaxJurisdiction
        * * Display Name: Jurisdiction Name
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsAccountingCompanyTaxNexusEntityType = z.infer<typeof mjBizAppsAccountingCompanyTaxNexusSchema>;

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
        * * Display Name: Code
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
        * * Display Name: Is Active
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
        * * Display Name: From Currency Code
        * * SQL Data Type: char(3)
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.Code)`),
    ToCurrencyCode: z.string().describe(`
        * * Field Name: ToCurrencyCode
        * * Display Name: To Currency Code
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
        * * Display Name: From Currency Virtual
        * * SQL Data Type: nvarchar(80)`),
    ToCurrencyCode_Virtual: z.string().describe(`
        * * Field Name: ToCurrencyCode_Virtual
        * * Display Name: To Currency Virtual
        * * SQL Data Type: nvarchar(80)`),
});

export type mjBizAppsAccountingCurrencySpotRateEntityType = z.infer<typeof mjBizAppsAccountingCurrencySpotRateSchema>;

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
        * * Display Name: Root Parent Value
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
 * zod schema definition for the entity MJ_BizApps_Accounting: GL Account Link Dimensions
 */
export const mjBizAppsAccountingGLAccountLinkDimensionSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    GLAccountLinkID: z.string().describe(`
        * * Field Name: GLAccountLinkID
        * * Display Name: GL Account Link
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Account Links (vwGLAccountLinks.ID)
        * * Description: The link this dimension requirement belongs to.`),
    DimensionID: z.string().describe(`
        * * Field Name: DimensionID
        * * Display Name: Dimension
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimensions (vwDimensions.ID)
        * * Description: The Dimension that applies (validate-only vocabulary — never invented here).`),
    Sequence: z.number().describe(`
        * * Field Name: Sequence
        * * Display Name: Sequence
        * * SQL Data Type: int
        * * Default Value: 0
        * * Description: Ordering of the dimensions for this link (ascending).`),
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
});

export type mjBizAppsAccountingGLAccountLinkDimensionEntityType = z.infer<typeof mjBizAppsAccountingGLAccountLinkDimensionSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: GL Account Links
 */
export const mjBizAppsAccountingGLAccountLinkSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    GLAccountID: z.string().describe(`
        * * Field Name: GLAccountID
        * * Display Name: GL Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: The GL account this link maps its target record to.`),
    GLAccountRoleID: z.string().describe(`
        * * Field Name: GLAccountRoleID
        * * Display Name: GL Account Role
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Account Roles (vwGLAccountRoles.ID)
        * * Description: The role the account plays for the target record (Sales, AR, ...). Assumed correction OQ-G: absent from the 07-03 field list but required to tell a record's Revenue link from its AR link.`),
    EntityID: z.string().describe(`
        * * Field Name: EntityID
        * * Display Name: Entity Type
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
        * * Description: Polymorphic reference part 1: the MJ Entity of the target record (references __mj.Entity). Same TaggedItem-style pattern as JournalEntry.LinkedEntityID/LinkedRecordID (plan D25).`),
    RecordID: z.string().describe(`
        * * Field Name: RecordID
        * * Display Name: Record ID
        * * SQL Data Type: nvarchar(400)
        * * Description: Polymorphic reference part 2: the target record's primary key (NVARCHAR(400) supports stringified composite keys).`),
    Status: z.union([z.literal('Active'), z.literal('Disabled'), z.literal('Pending')]).describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(10)
        * * Default Value: Pending
    * * Value List Type: List
    * * Possible Values 
    *   * Active
    *   * Disabled
    *   * Pending
        * * Description: Pending = entered but not yet in force; Active = used by resolution; Disabled = ignored.`),
    StartedAt: z.date().nullable().describe(`
        * * Field Name: StartedAt
        * * Display Name: Started At
        * * SQL Data Type: datetimeoffset
        * * Description: Start of the date-effective window (NULL = open start). Enables Amith's "new chart of accounts effective Aug 1" pre-entry: resolution flips automatically on the date; historical JEs are never touched.`),
    EndedAt: z.date().nullable().describe(`
        * * Field Name: EndedAt
        * * Display Name: Ended At
        * * SQL Data Type: datetimeoffset
        * * Description: End of the date-effective window (NULL = open end).`),
    Comments: z.string().nullable().describe(`
        * * Field Name: Comments
        * * Display Name: Comments
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Free-text note on why this mapping exists / changed.`),
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
        * * Display Name: GL Account Name
        * * SQL Data Type: nvarchar(200)`),
    GLAccountRole: z.string().describe(`
        * * Field Name: GLAccountRole
        * * Display Name: GL Account Role Name
        * * SQL Data Type: nvarchar(100)`),
    Entity: z.string().describe(`
        * * Field Name: Entity
        * * Display Name: Entity Name
        * * SQL Data Type: nvarchar(255)`),
});

export type mjBizAppsAccountingGLAccountLinkEntityType = z.infer<typeof mjBizAppsAccountingGLAccountLinkSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: GL Account Roles
 */
export const mjBizAppsAccountingGLAccountRoleSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(100)
        * * Description: Display name of the role; unique.`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)
        * * Description: What entries this role is used for and any guidance for pickers.`),
    Status: z.union([z.literal('Active'), z.literal('Inactive')]).describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(10)
        * * Default Value: Active
    * * Value List Type: List
    * * Possible Values 
    *   * Active
    *   * Inactive
        * * Description: Active roles are offered in pickers; Inactive roles are retained for history but not selectable.`),
    Sequence: z.number().describe(`
        * * Field Name: Sequence
        * * Display Name: Sequence
        * * SQL Data Type: int
        * * Default Value: 0
        * * Description: Intentional display order in pickers (ascending).`),
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

export type mjBizAppsAccountingGLAccountRoleEntityType = z.infer<typeof mjBizAppsAccountingGLAccountRoleSchema>;

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
    AccountType: z.union([z.literal('Asset'), z.literal('Equity'), z.literal('Expense'), z.literal('Liability'), z.literal('Revenue')]).describe(`
        * * Field Name: AccountType
        * * Display Name: Account Type
        * * SQL Data Type: nvarchar(15)
    * * Value List Type: List
    * * Possible Values 
    *   * Asset
    *   * Equity
    *   * Expense
    *   * Liability
    *   * Revenue
        * * Description: High-level type: Asset | Liability | Equity | Revenue | Expense (AM-3 five-value enum; contra/statistical variants may return later as a sub-classification).`),
    ParentGLAccountID: z.string().nullable().describe(`
        * * Field Name: ParentGLAccountID
        * * Display Name: Parent Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: Parent account for hierarchical rollup (NULL = top of chart).`),
    CurrencyCode: z.string().nullable().describe(`
        * * Field Name: CurrencyCode
        * * Display Name: Currency
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
        * * Display Name: Active
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
        * * Display Name: Currency (Virtual)
        * * SQL Data Type: nvarchar(80)`),
    RootParentGLAccountID: z.string().nullable().describe(`
        * * Field Name: RootParentGLAccountID
        * * Display Name: Root Parent Account
        * * SQL Data Type: uniqueidentifier`),
});

export type mjBizAppsAccountingGLAccountEntityType = z.infer<typeof mjBizAppsAccountingGLAccountSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Intercompany Account Match Dimensions
 */
export const mjBizAppsAccountingIntercompanyAccountMatchDimensionSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    IntercompanyAccountMatchID: z.string().describe(`
        * * Field Name: IntercompanyAccountMatchID
        * * Display Name: Intercompany Account Match
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Intercompany Account Matches (vwIntercompanyAccountMatches.ID)
        * * Description: The account pair this dimension requirement belongs to.`),
    Side: z.union([z.literal('DueFrom'), z.literal('DueTo')]).describe(`
        * * Field Name: Side
        * * Display Name: Leg Side
        * * SQL Data Type: nvarchar(10)
    * * Value List Type: List
    * * Possible Values 
    *   * DueFrom
    *   * DueTo
        * * Description: Which leg the requirement applies to: DueTo (source company's liability) or DueFrom (target company's receivable). The two legs sit on different companies' books and routinely carry different values for the same Dimension.`),
    DimensionID: z.string().describe(`
        * * Field Name: DimensionID
        * * Display Name: Dimension
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimensions (vwDimensions.ID)
        * * Description: The Dimension that applies (validate-only vocabulary — never invented here).`),
    DimensionValueID: z.string().nullable().describe(`
        * * Field Name: DimensionValueID
        * * Display Name: Dimension Value
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimension Values (vwDimensionValues.ID)
        * * Description: Optional fixed value to stamp. NULL keeps the GLAccountLink behaviour of taking the value from the calling context. Must belong to DimensionID (enforced by trigger).`),
    Sequence: z.number().describe(`
        * * Field Name: Sequence
        * * Display Name: Sequence
        * * SQL Data Type: int
        * * Default Value: 0
        * * Description: Ordering of the dimensions for this side (ascending).`),
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
    DimensionValue: z.string().nullable().describe(`
        * * Field Name: DimensionValue
        * * Display Name: Dimension Value Name
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsAccountingIntercompanyAccountMatchDimensionEntityType = z.infer<typeof mjBizAppsAccountingIntercompanyAccountMatchDimensionSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Intercompany Account Matches
 */
export const mjBizAppsAccountingIntercompanyAccountMatchSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    SourceCompanyID: z.string().describe(`
        * * Field Name: SourceCompanyID
        * * Display Name: Source Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: The company that COLLECTED the cash and therefore owes — the Due To liability sits on its books.`),
    TargetCompanyID: z.string().describe(`
        * * Field Name: TargetCompanyID
        * * Display Name: Target Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: The company that is OWED because it owns the line the cash settled — the Due From receivable sits on its books.`),
    DueToGLAccountID: z.string().describe(`
        * * Field Name: DueToGLAccountID
        * * Display Name: Due To GL Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: The intercompany PAYABLE on the source company's books. Must be a Liability account belonging to SourceCompanyID (enforced by trigger, not merely by convention: a backwards pair still balances).`),
    DueFromGLAccountID: z.string().describe(`
        * * Field Name: DueFromGLAccountID
        * * Display Name: Due From GL Account
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
        * * Description: The intercompany RECEIVABLE on the target company's books. Must be an Asset account belonging to TargetCompanyID.`),
    Status: z.union([z.literal('Active'), z.literal('Disabled'), z.literal('Pending')]).describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(10)
        * * Default Value: Pending
    * * Value List Type: List
    * * Possible Values 
    *   * Active
    *   * Disabled
    *   * Pending
        * * Description: Pending | Active | Disabled. Only Active rows resolve; a pair is never deleted once it has been used.`),
    StartedAt: z.date().nullable().describe(`
        * * Field Name: StartedAt
        * * Display Name: Start Date
        * * SQL Data Type: datetimeoffset
        * * Description: Start of the effective window (inclusive). NULL means open-ended in the past.`),
    EndedAt: z.date().nullable().describe(`
        * * Field Name: EndedAt
        * * Display Name: End Date
        * * SQL Data Type: datetimeoffset
        * * Description: End of the effective window (inclusive). NULL means open-ended. Supersede a mapping by closing this and adding a new row, never by editing history.`),
    Comments: z.string().nullable().describe(`
        * * Field Name: Comments
        * * Display Name: Comments
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Free-text note on why this mapping exists — typically the intercompany agreement it implements.`),
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
    SourceCompany: z.string().describe(`
        * * Field Name: SourceCompany
        * * Display Name: Source Company Name
        * * SQL Data Type: nvarchar(50)`),
    TargetCompany: z.string().describe(`
        * * Field Name: TargetCompany
        * * Display Name: Target Company Name
        * * SQL Data Type: nvarchar(50)`),
    DueToGLAccount: z.string().describe(`
        * * Field Name: DueToGLAccount
        * * Display Name: Due To GL Account Name
        * * SQL Data Type: nvarchar(200)`),
    DueFromGLAccount: z.string().describe(`
        * * Field Name: DueFromGLAccount
        * * Display Name: Due From GL Account Name
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsAccountingIntercompanyAccountMatchEntityType = z.infer<typeof mjBizAppsAccountingIntercompanyAccountMatchSchema>;

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
        * * Description: The single company this journal entry belongs to (plan D3). Every line's GLAccount must belong to this company (trigger-enforced).`),
    EffectiveDate: z.date().describe(`
        * * Field Name: EffectiveDate
        * * Display Name: Effective Date
        * * SQL Data Type: date
        * * Description: Accounting date for the entry (the ERP assigns its own period at posting).`),
    EntryTypeID: z.string().describe(`
        * * Field Name: EntryTypeID
        * * Display Name: Entry Type
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entry Types (vwJournalEntryTypes.ID)
        * * Description: The JournalEntryType classifying this entry (issue #24, BA-D29). Accounting seeds its own ledger-mechanics types; consuming apps seed their domain types as rows.`),
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
    LinkedEntityID: z.string().nullable().describe(`
        * * Field Name: LinkedEntityID
        * * Display Name: Linked Entity
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
        * * Description: Polymorphic origin part 1 (plan D25): the MJ Entity of the single causal source record for this JE (OrderLine for booking/rev-rec entries, Payment for receipts/refunds, ...). FK to __mj.Entity. NULL (with LinkedRecordID) = manual JE.`),
    LinkedRecordID: z.string().nullable().describe(`
        * * Field Name: LinkedRecordID
        * * Display Name: Linked Record ID
        * * SQL Data Type: nvarchar(400)
        * * Description: Polymorphic origin part 2: the source record's primary key (NVARCHAR(400) supports stringified composite keys). Soft by nature — the record lives in a downstream app's schema. Set and NULL together with LinkedEntityID (CK_JournalEntry_LinkedPair).`),
    ReversesJournalEntryID: z.string().nullable().describe(`
        * * Field Name: ReversesJournalEntryID
        * * Display Name: Reverses Journal Entry
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
        * * Description: When set, this JE is a reversal of the referenced original JE. Its JournalEntryType Code MUST be 'Reversal' (trg_JE_ReversalConsistency).`),
    ReversedByJournalEntryID: z.string().nullable().describe(`
        * * Field Name: ReversedByJournalEntryID
        * * Display Name: Reversed By Journal Entry
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
        * * Description: Back-pointer set on the original JE when a reversal is emitted against it.`),
    JournalEntryBatchID: z.string().nullable().describe(`
        * * Field Name: JournalEntryBatchID
        * * Display Name: Journal Entry Batch
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
        * * Display Name: GL Reference ID
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
    EntryType: z.string().describe(`
        * * Field Name: EntryType
        * * Display Name: Entry Type Name
        * * SQL Data Type: nvarchar(100)`),
    LinkedEntity: z.string().nullable().describe(`
        * * Field Name: LinkedEntity
        * * Display Name: Linked Entity Name
        * * SQL Data Type: nvarchar(255)`),
    JournalEntryBatch: z.string().nullable().describe(`
        * * Field Name: JournalEntryBatch
        * * Display Name: Batch Name
        * * SQL Data Type: nvarchar(40)`),
    File: z.string().nullable().describe(`
        * * Field Name: File
        * * Display Name: File Name
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
    ID: z.number().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: int
        * * Default Value: 1`),
    NextSequenceNumber: z.number().describe(`
        * * Field Name: NextSequenceNumber
        * * Display Name: Next Sequence Number
        * * SQL Data Type: int
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
    JournalEntryBatchNumber: z.string().describe(`
        * * Field Name: JournalEntryBatchNumber
        * * Display Name: Batch Number
        * * SQL Data Type: nvarchar(40)
        * * Description: Gap-free batch number assigned by spAssignNextJournalEntryBatchNumber. Format 'BATCH-{CompanyCode}-{seq:000000}'.`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: The single company this batch belongs to (plan D7). One batch per company per run; the batch gathers ONLY this company's Pending JEs.`),
    PostingDate: z.date().describe(`
        * * Field Name: PostingDate
        * * Display Name: Posting Date
        * * SQL Data Type: date
        * * Description: Singular, accountant-set posting date chosen at batch build (plan D8). Carried to the GL's posting date and must match between systems; drives the ERP period. Document dates stay informational.`),
    SummaryJournalEntryID: z.string().nullable().describe(`
        * * Field Name: SummaryJournalEntryID
        * * Display Name: Summary Journal Entry ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
        * * Description: The aggregated summary JournalEntry (its JournalEntryType flagged IsJournalEntryBatchSummary, EffectiveDate=PostingDate) that posts to the GL for this batch (plan D9). Its lines net debits/credits per GLAccount x dimension-combo. The summary carries this batch's JournalEntryBatchID (same derived lock machinery as members) but is excluded from member/netting/sweep queries via its type's IsJournalEntryBatchSummary flag.`),
    TargetSystem: z.union([z.literal('BusinessCentral'), z.literal('NetSuite'), z.literal('Other'), z.literal('QuickBooks'), z.literal('Sage'), z.literal('Xero')]).describe(`
        * * Field Name: TargetSystem
        * * Display Name: Target System
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
    Status: z.union([z.literal('Approved'), z.literal('Cancelled'), z.literal('Failed'), z.literal('Pending'), z.literal('Posted'), z.literal('Sent')]).describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(20)
        * * Default Value: Pending
    * * Value List Type: List
    * * Possible Values 
    *   * Approved
    *   * Cancelled
    *   * Failed
    *   * Pending
    *   * Posted
    *   * Sent
        * * Description: Lifecycle: Pending | Approved | Sent | Posted | Failed | Cancelled. Pending is mutable/deletable; Approved locks content (human sign-off); Posted = the ERP confirmed posting; Failed triggers retry + escalation; Cancelled is terminal from Pending or unsent Approved (trg_JournalEntryBatch_Immutability).`),
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
    ExternalJournalEntryBatchRef: z.string().nullable().describe(`
        * * Field Name: ExternalJournalEntryBatchRef
        * * Display Name: External Batch Reference
        * * SQL Data Type: nvarchar(100)
        * * Description: ERP's reference returned on send (used to correlate the consolidated JE posted in the ERP).`),
    ApprovedAt: z.date().nullable().describe(`
        * * Field Name: ApprovedAt
        * * Display Name: Approved At
        * * SQL Data Type: datetimeoffset
        * * Description: When a human approved the batch for dispatch (locks its content; the new Approved status).`),
    ApprovedByUserID: z.string().nullable().describe(`
        * * Field Name: ApprovedByUserID
        * * Display Name: Approved By User ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
        * * Description: The user who approved the batch (see AccountingCompanyProfile.ApprovalCFOUserID / the bizapps-tasks approval gate).`),
    SentAt: z.date().nullable().describe(`
        * * Field Name: SentAt
        * * Display Name: Sent At
        * * SQL Data Type: datetimeoffset
        * * Description: When the batch was sent to the ERP.`),
    PostedAt: z.date().nullable().describe(`
        * * Field Name: PostedAt
        * * Display Name: Posted At
        * * SQL Data Type: datetimeoffset
        * * Description: When the ERP confirmed it posted the batch (Status=Posted; renames the old AcknowledgedAt).`),
    ErrorMessage: z.string().nullable().describe(`
        * * Field Name: ErrorMessage
        * * Display Name: Error Message
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Error message from a Failed send. JEs revert to Pending for retry.`),
    ApprovalTaskID: z.string().nullable().describe(`
        * * Field Name: ApprovalTaskID
        * * Display Name: Approval Task ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Tasks: Tasks (vwTasks.ID)
        * * Description: The bizapps-tasks approval Task raised for this batch (plan D10). Real FK to __mj_BizAppsTasks.Task (#22) — cross-app references point UP the dependency graph, and tasks installs before this app. Stamped together with ApprovalTaskRaisedAt in the task-raise transaction (both-or-neither CHECK). NULL = task not yet raised (retryable state).`),
    ApprovalTaskRaisedAt: z.date().nullable().describe(`
        * * Field Name: ApprovalTaskRaisedAt
        * * Display Name: Approval Task Raised At
        * * SQL Data Type: datetimeoffset
        * * Description: When the approval task was raised; set together with ApprovalTaskID (both-or-neither CHECK).`),
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
    BatchedByUser: z.string().describe(`
        * * Field Name: BatchedByUser
        * * Display Name: Batched By
        * * SQL Data Type: nvarchar(100)`),
    ApprovedByUser: z.string().nullable().describe(`
        * * Field Name: ApprovedByUser
        * * Display Name: Approved By
        * * SQL Data Type: nvarchar(100)`),
    ApprovalTask: z.string().nullable().describe(`
        * * Field Name: ApprovalTask
        * * Display Name: Approval Task
        * * SQL Data Type: nvarchar(255)`),
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
        * * Display Name: Original Currency Code (Virtual)
        * * SQL Data Type: nvarchar(80)`),
});

export type mjBizAppsAccountingJournalEntryLineEntityType = z.infer<typeof mjBizAppsAccountingJournalEntryLineSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Journal Entry Sequences
 */
export const mjBizAppsAccountingJournalEntrySequenceSchema = z.object({
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)`),
    FiscalYear: z.number().describe(`
        * * Field Name: FiscalYear
        * * Display Name: Fiscal Year
        * * SQL Data Type: int`),
    NextSequenceNumber: z.number().describe(`
        * * Field Name: NextSequenceNumber
        * * Display Name: Next Sequence Number
        * * SQL Data Type: int
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
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company Name
        * * SQL Data Type: nvarchar(50)`),
});

export type mjBizAppsAccountingJournalEntrySequenceEntityType = z.infer<typeof mjBizAppsAccountingJournalEntrySequenceSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Accounting: Journal Entry Types
 */
export const mjBizAppsAccountingJournalEntryTypeSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)
        * * Description: Stable machine code for the type (e.g. Manual, Reversal, JournalEntryBatchSummary, OrderBooking). Unique. Referenced by code; display uses Name.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(100)
        * * Description: Human-readable display name for the type.`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)
        * * Description: What this entry type classifies and which app owns it.`),
    IsSystem: z.boolean().describe(`
        * * Field Name: IsSystem
        * * Display Name: Is System
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: 1 = accounting's own ledger-mechanics type (Manual, Reversal, JournalEntryBatchSummary, ...). Consumers must not repurpose or delete IsSystem rows.`),
    IsJournalEntryBatchSummary: z.boolean().describe(`
        * * Field Name: IsJournalEntryBatchSummary
        * * Display Name: Is Journal Entry Batch Summary
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: 1 = this type marks a batch's aggregated summary JE. Batch member/netting/sweep queries exclude JEs of this type via a join on this flag (replaces the former 'JournalEntryBatchSummary' magic-string match). A filtered unique index allows exactly one flagged row.`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Whether this type may be used on NEW journal entries. Inactive types remain for historical rows.`),
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

export type mjBizAppsAccountingJournalEntryTypeEntityType = z.infer<typeof mjBizAppsAccountingJournalEntryTypeSchema>;

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
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)
        * * Description: Globally unique authority code, e.g. 'US-IRS', 'CA-BOE', 'EU-VAT-DE'.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)
        * * Description: Display name for the authority.`),
    CountryCode: z.string().nullable().describe(`
        * * Field Name: CountryCode
        * * Display Name: Country Code
        * * SQL Data Type: char(2)
        * * Description: ISO 3166-1 alpha-2 country code for the authority's primary jurisdiction.`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
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
        * * Display Name: Code
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
        * * SQL Data Type: decimal(9, 6)
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
    Source: z.string().describe(`
        * * Field Name: Source
        * * Display Name: Source
        * * SQL Data Type: nvarchar(50)
        * * Default Value: Manual
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
    * * CompanyCode: The company code must be between 2 and 20 characters long, written entirely in uppercase, and contain only letters, numbers, underscores, or hyphens.
    * * FiscalYearStartDay: The fiscal year start day must be a valid day of the month, between 1 and 31.
    * * FiscalYearStartMonth: The fiscal year start month must be a valid calendar month represented by a number between 1 and 12.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateCompanyCodeFormat(result);
        this.ValidateFiscalYearStartDayRange(result);
        this.ValidateFiscalYearStartMonthRange(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The company code must be between 2 and 20 characters long, written entirely in uppercase, and contain only letters, numbers, underscores, or hyphens.
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
    				"Company Code must be between 2 and 20 characters, contain only uppercase alphanumeric characters, hyphens, or underscores, and must not contain lowercase letters.",
    				value,
    				ValidationErrorType.Failure
    			));
    		}
    	}
    }

    /**
    * The fiscal year start day must be a valid day of the month, between 1 and 31.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateFiscalYearStartDayRange(result: ValidationResult) {
        if (this.FiscalYearStartDay != null && (this.FiscalYearStartDay < 1 || this.FiscalYearStartDay > 31)) {
            result.Errors.push(new ValidationErrorInfo(
                "FiscalYearStartDay",
                "The fiscal year start day must be between 1 and 31.",
                this.FiscalYearStartDay,
                ValidationErrorType.Failure
            ));
        }
    }

    /**
    * The fiscal year start month must be a valid calendar month represented by a number between 1 and 12.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateFiscalYearStartMonthRange(result: ValidationResult) {
        if (this.FiscalYearStartMonth !== undefined && this.FiscalYearStartMonth !== null) {
            if (this.FiscalYearStartMonth < 1 || this.FiscalYearStartMonth > 12) {
                result.Errors.push(new ValidationErrorInfo(
                    "FiscalYearStartMonth",
                    "The fiscal year start month must be between 1 (January) and 12 (December).",
                    this.FiscalYearStartMonth,
                    ValidationErrorType.Failure
                ));
            }
        }
    }

    /**
    * * Field Name: ID
    * * Display Name: Company ID
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
    * * Display Name: Legal Structure Type
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
    * * Field Name: OperatingTimeZone
    * * Display Name: Operating Time Zone
    * * SQL Data Type: nvarchar(60)
    * * Description: IANA time-zone name for the company's operations (e.g. 'America/Chicago'). All timestamps store in UTC/Zulu; period and rev-rec boundaries are evaluated in this zone so a transaction near midnight lands in the right local day/month.
    */
    get OperatingTimeZone(): string | null {
        return this.Get('OperatingTimeZone');
    }
    set OperatingTimeZone(value: string | null) {
        this.Set('OperatingTimeZone', value);
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
    * * Display Name: Functional Currency Code
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
    * * Display Name: Reporting Currency Code
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
    * * Field Name: ApprovalCFOUserID
    * * Display Name: Approval CFO User
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    * * Description: The CFO (an __mj.User — a security identity) who must approve a Journal Entry Batch for this company before it dispatches to the ERP. Resolved by the bizapps-tasks approval gate. Nullable: companies without a configured CFO fall back to the role-based resolver.
    */
    get ApprovalCFOUserID(): string | null {
        return this.Get('ApprovalCFOUserID');
    }
    set ApprovalCFOUserID(value: string | null) {
        this.Set('ApprovalCFOUserID', value);
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
    * * Display Name: Name
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
    * * Display Name: Functional Currency (Virtual)
    * * SQL Data Type: nvarchar(80)
    */
    get FunctionalCurrencyCode_Virtual(): string {
        return this.Get('FunctionalCurrencyCode_Virtual');
    }

    /**
    * * Field Name: ReportingCurrencyCode_Virtual
    * * Display Name: Reporting Currency (Virtual)
    * * SQL Data Type: nvarchar(80)
    */
    get ReportingCurrencyCode_Virtual(): string | null {
        return this.Get('ReportingCurrencyCode_Virtual');
    }

    /**
    * * Field Name: ApprovalCFOUser
    * * Display Name: Approval CFO User Name
    * * SQL Data Type: nvarchar(100)
    */
    get ApprovalCFOUser(): string | null {
        return this.Get('ApprovalCFOUser');
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
    * * Display Name: Root Parent Accounting Company
    * * SQL Data Type: uniqueidentifier
    */
    get RootParentAccountingCompanyID(): string | null {
        return this.Get('RootParentAccountingCompanyID');
    }
}


/**
 * MJ_BizApps_Accounting: Company Tax Nexus - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: CompanyTaxNexus
 * * Base View: vwCompanyTaxNexus
 * * @description Where THIS company must collect tax. Nexus is a property of our own legal entity's registrations, which is why it lives with Company rather than with the order. The mirror question - whether a BUYER is exempt - is CustomerTaxExemption in bizapps-orders. Both must hold to charge: the seller has nexus AND the buyer is not exempt AND the product is taxable there.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Company Tax Nexus')
export class mjBizAppsAccountingCompanyTaxNexusEntity extends BaseEntity<mjBizAppsAccountingCompanyTaxNexusEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Company Tax Nexus record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Company Tax Nexus record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingCompanyTaxNexusEntity
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
    * * Field Name: CompanyID
    * * Display Name: Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: The legal entity with the obligation.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: TaxJurisdictionID
    * * Display Name: Tax Jurisdiction
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Tax Jurisdictions (vwTaxJurisdictions.ID)
    * * Description: The jurisdiction it must collect for.
    */
    get TaxJurisdictionID(): string {
        return this.Get('TaxJurisdictionID');
    }
    set TaxJurisdictionID(value: string) {
        this.Set('TaxJurisdictionID', value);
    }

    /**
    * * Field Name: NexusType
    * * Display Name: Nexus Type
    * * SQL Data Type: nvarchar(20)
    * * Default Value: Economic
    * * Value List Type: List
    * * Possible Values 
    *   * Economic
    *   * Marketplace
    *   * Physical
    *   * Voluntary
    * * Description: WHY the obligation exists: Economic (crossed a revenue or transaction threshold), Physical (people, property or inventory in the state), Marketplace (a facilitator law attributes it) or Voluntary (registered without being required).
    */
    get NexusType(): 'Economic' | 'Marketplace' | 'Physical' | 'Voluntary' {
        return this.Get('NexusType');
    }
    set NexusType(value: 'Economic' | 'Marketplace' | 'Physical' | 'Voluntary') {
        this.Set('NexusType', value);
    }

    /**
    * * Field Name: RegistrationNumber
    * * Display Name: Registration Number
    * * SQL Data Type: nvarchar(100)
    * * Description: The permit or registration number issued by the jurisdiction.
    */
    get RegistrationNumber(): string | null {
        return this.Get('RegistrationNumber');
    }
    set RegistrationNumber(value: string | null) {
        this.Set('RegistrationNumber', value);
    }

    /**
    * * Field Name: RegisteredFrom
    * * Display Name: Registered From
    * * SQL Data Type: date
    * * Description: When the registration took effect.
    */
    get RegisteredFrom(): Date {
        return this.Get('RegisteredFrom');
    }
    set RegisteredFrom(value: Date) {
        this.Set('RegisteredFrom', value);
    }

    /**
    * * Field Name: RegisteredTo
    * * Display Name: Registered To
    * * SQL Data Type: date
    * * Description: When the REGISTRATION ended - not when the activity stopped. Registration is a one-way door: you must keep filing, including zero returns, until the account is formally closed, and a state will not close one with open periods.
    */
    get RegisteredTo(): Date | null {
        return this.Get('RegisteredTo');
    }
    set RegisteredTo(value: Date | null) {
        this.Set('RegisteredTo', value);
    }

    /**
    * * Field Name: ObligationEndsAt
    * * Display Name: Obligation Ends At
    * * SQL Data Type: date
    * * Description: When the duty to COLLECT ends, which routinely outlasts the activity that created it. California holds a seller through the nexus year plus the whole following calendar year; Colorado, Washington, Wisconsin, Iowa and Michigan through the following calendar year; Texas until twelve consecutive months below the threshold. Separate from RegisteredTo because collapsing the two would end the obligation early.
    */
    get ObligationEndsAt(): Date | null {
        return this.Get('ObligationEndsAt');
    }
    set ObligationEndsAt(value: Date | null) {
        this.Set('ObligationEndsAt', value);
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(10)
    * * Default Value: Active
    * * Value List Type: List
    * * Possible Values 
    *   * Active
    *   * Inactive
    * * Description: Active | Inactive. A closed registration is retained rather than deleted - it is the evidence of what was true during an audited period.
    */
    get Status(): 'Active' | 'Inactive' {
        return this.Get('Status');
    }
    set Status(value: 'Active' | 'Inactive') {
        this.Set('Status', value);
    }

    /**
    * * Field Name: Comments
    * * Display Name: Comments
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Free-text note, typically the nexus study or ruling that established the obligation.
    */
    get Comments(): string | null {
        return this.Get('Comments');
    }
    set Comments(value: string | null) {
        this.Set('Comments', value);
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
    * * Field Name: TaxJurisdiction
    * * Display Name: Jurisdiction Name
    * * SQL Data Type: nvarchar(200)
    */
    get TaxJurisdiction(): string {
        return this.Get('TaxJurisdiction');
    }
}


/**
 * MJ_BizApps_Accounting: Currencies - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: Currency
 * * Base View: vwCurrencies
 * * @description ISO-4217 currency reference data owned by BizAppsAccounting; seeded via metadata sync (metadata/currencies). Referenced by GLAccount, AccountingCompanyProfile, JournalEntryLine, and CurrencySpotRate.
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
    * * Code: The code must be written in uppercase letters to maintain consistent formatting.
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
    * The code must be written in uppercase letters to maintain consistent formatting.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateCodeIsUppercase(result: ValidationResult) {
    	if (this.Code && this.Code !== this.Code.toUpperCase()) {
    		result.Errors.push(new ValidationErrorInfo(
    			"Code",
    			"The Code must be in all uppercase letters.",
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
    * * Display Name: Code
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
    * * Display Name: Is Active
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
    * * Rate: The exchange rate must be a positive number greater than zero.
    * * Table-Level: The source currency and destination currency must be different. An exchange rate cannot be defined between the same currency.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateRateGreaterThanZero(result);
        this.ValidateFromAndToCurrencyCodesAreDifferent(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The exchange rate must be a positive number greater than zero.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateRateGreaterThanZero(result: ValidationResult) {
    	if (this.Rate != null && this.Rate <= 0) {
    		result.Errors.push(new ValidationErrorInfo(
    			"Rate",
    			"The exchange rate must be greater than zero.",
    			this.Rate,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * The source currency and destination currency must be different. An exchange rate cannot be defined between the same currency.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateFromAndToCurrencyCodesAreDifferent(result: ValidationResult) {
    	if (this.FromCurrencyCode != null && this.ToCurrencyCode != null && this.FromCurrencyCode === this.ToCurrencyCode) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ToCurrencyCode",
    			"The destination currency cannot be the same as the source currency.",
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
    * * Display Name: From Currency Code
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
    * * Display Name: To Currency Code
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
    * * Display Name: From Currency Virtual
    * * SQL Data Type: nvarchar(80)
    */
    get FromCurrencyCode_Virtual(): string {
        return this.Get('FromCurrencyCode_Virtual');
    }

    /**
    * * Field Name: ToCurrencyCode_Virtual
    * * Display Name: To Currency Virtual
    * * SQL Data Type: nvarchar(80)
    */
    get ToCurrencyCode_Virtual(): string {
        return this.Get('ToCurrencyCode_Virtual');
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
    * * Display Name: Root Parent Value
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
 * MJ_BizApps_Accounting: GL Account Link Dimensions - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: GLAccountLinkDimension
 * * Base View: vwGLAccountLinkDimensions
 * * @description Which analytical Dimensions apply to journal-entry lines resolved through a GLAccountLink, in display order. Carries the Dimension only — VALUES are supplied from the calling context at entry-build time (OQ-I).
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: GL Account Link Dimensions')
export class mjBizAppsAccountingGLAccountLinkDimensionEntity extends BaseEntity<mjBizAppsAccountingGLAccountLinkDimensionEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: GL Account Link Dimensions record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: GL Account Link Dimensions record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingGLAccountLinkDimensionEntity
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
    * * Field Name: GLAccountLinkID
    * * Display Name: GL Account Link
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Account Links (vwGLAccountLinks.ID)
    * * Description: The link this dimension requirement belongs to.
    */
    get GLAccountLinkID(): string {
        return this.Get('GLAccountLinkID');
    }
    set GLAccountLinkID(value: string) {
        this.Set('GLAccountLinkID', value);
    }

    /**
    * * Field Name: DimensionID
    * * Display Name: Dimension
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimensions (vwDimensions.ID)
    * * Description: The Dimension that applies (validate-only vocabulary — never invented here).
    */
    get DimensionID(): string {
        return this.Get('DimensionID');
    }
    set DimensionID(value: string) {
        this.Set('DimensionID', value);
    }

    /**
    * * Field Name: Sequence
    * * Display Name: Sequence
    * * SQL Data Type: int
    * * Default Value: 0
    * * Description: Ordering of the dimensions for this link (ascending).
    */
    get Sequence(): number {
        return this.Get('Sequence');
    }
    set Sequence(value: number) {
        this.Set('Sequence', value);
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
}


/**
 * MJ_BizApps_Accounting: GL Account Links - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: GLAccountLink
 * * Base View: vwGLAccountLinks
 * * @description Polymorphic, role-based, date-effective mapping from ANY record (Company defaults, Product Category, Product, future types) to a GL account. Replaces the ProductGLAccount / ProductCategoryGLAccount / AccountingCompanyProfileGLAccount trio (AM-5). Resolution filters Status=Active and StartedAt/EndedAt covering the as-of date; the caller (e.g. the Orders resolver) walks product -> category tree -> company default.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: GL Account Links')
export class mjBizAppsAccountingGLAccountLinkEntity extends BaseEntity<mjBizAppsAccountingGLAccountLinkEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: GL Account Links record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: GL Account Links record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingGLAccountLinkEntity
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
    * * Field Name: GLAccountID
    * * Display Name: GL Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: The GL account this link maps its target record to.
    */
    get GLAccountID(): string {
        return this.Get('GLAccountID');
    }
    set GLAccountID(value: string) {
        this.Set('GLAccountID', value);
    }

    /**
    * * Field Name: GLAccountRoleID
    * * Display Name: GL Account Role
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Account Roles (vwGLAccountRoles.ID)
    * * Description: The role the account plays for the target record (Sales, AR, ...). Assumed correction OQ-G: absent from the 07-03 field list but required to tell a record's Revenue link from its AR link.
    */
    get GLAccountRoleID(): string {
        return this.Get('GLAccountRoleID');
    }
    set GLAccountRoleID(value: string) {
        this.Set('GLAccountRoleID', value);
    }

    /**
    * * Field Name: EntityID
    * * Display Name: Entity Type
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
    * * Description: Polymorphic reference part 1: the MJ Entity of the target record (references __mj.Entity). Same TaggedItem-style pattern as JournalEntry.LinkedEntityID/LinkedRecordID (plan D25).
    */
    get EntityID(): string {
        return this.Get('EntityID');
    }
    set EntityID(value: string) {
        this.Set('EntityID', value);
    }

    /**
    * * Field Name: RecordID
    * * Display Name: Record ID
    * * SQL Data Type: nvarchar(400)
    * * Description: Polymorphic reference part 2: the target record's primary key (NVARCHAR(400) supports stringified composite keys).
    */
    get RecordID(): string {
        return this.Get('RecordID');
    }
    set RecordID(value: string) {
        this.Set('RecordID', value);
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(10)
    * * Default Value: Pending
    * * Value List Type: List
    * * Possible Values 
    *   * Active
    *   * Disabled
    *   * Pending
    * * Description: Pending = entered but not yet in force; Active = used by resolution; Disabled = ignored.
    */
    get Status(): 'Active' | 'Disabled' | 'Pending' {
        return this.Get('Status');
    }
    set Status(value: 'Active' | 'Disabled' | 'Pending') {
        this.Set('Status', value);
    }

    /**
    * * Field Name: StartedAt
    * * Display Name: Started At
    * * SQL Data Type: datetimeoffset
    * * Description: Start of the date-effective window (NULL = open start). Enables Amith's "new chart of accounts effective Aug 1" pre-entry: resolution flips automatically on the date; historical JEs are never touched.
    */
    get StartedAt(): Date | null {
        return this.Get('StartedAt');
    }
    set StartedAt(value: Date | null) {
        this.Set('StartedAt', value);
    }

    /**
    * * Field Name: EndedAt
    * * Display Name: Ended At
    * * SQL Data Type: datetimeoffset
    * * Description: End of the date-effective window (NULL = open end).
    */
    get EndedAt(): Date | null {
        return this.Get('EndedAt');
    }
    set EndedAt(value: Date | null) {
        this.Set('EndedAt', value);
    }

    /**
    * * Field Name: Comments
    * * Display Name: Comments
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Free-text note on why this mapping exists / changed.
    */
    get Comments(): string | null {
        return this.Get('Comments');
    }
    set Comments(value: string | null) {
        this.Set('Comments', value);
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
    * * Display Name: GL Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get GLAccount(): string {
        return this.Get('GLAccount');
    }

    /**
    * * Field Name: GLAccountRole
    * * Display Name: GL Account Role Name
    * * SQL Data Type: nvarchar(100)
    */
    get GLAccountRole(): string {
        return this.Get('GLAccountRole');
    }

    /**
    * * Field Name: Entity
    * * Display Name: Entity Name
    * * SQL Data Type: nvarchar(255)
    */
    get Entity(): string {
        return this.Get('Entity');
    }
}


/**
 * MJ_BizApps_Accounting: GL Account Roles - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: GLAccountRole
 * * Base View: vwGLAccountRoles
 * * @description The JOB a GL account plays for a linked record (Cash, Accounts Receivable, Inventory, Cost of Goods Sold, Sales, Sales Discounts, Sales Returns and Allowances, Deferred Revenue). Lookup table so roles are additive at runtime; seeded via metadata sync (metadata/gl-account-roles), never SQL. AM-2.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: GL Account Roles')
export class mjBizAppsAccountingGLAccountRoleEntity extends BaseEntity<mjBizAppsAccountingGLAccountRoleEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: GL Account Roles record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: GL Account Roles record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingGLAccountRoleEntity
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
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(100)
    * * Description: Display name of the role; unique.
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
    * * Description: What entries this role is used for and any guidance for pickers.
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(10)
    * * Default Value: Active
    * * Value List Type: List
    * * Possible Values 
    *   * Active
    *   * Inactive
    * * Description: Active roles are offered in pickers; Inactive roles are retained for history but not selectable.
    */
    get Status(): 'Active' | 'Inactive' {
        return this.Get('Status');
    }
    set Status(value: 'Active' | 'Inactive') {
        this.Set('Status', value);
    }

    /**
    * * Field Name: Sequence
    * * Display Name: Sequence
    * * SQL Data Type: int
    * * Default Value: 0
    * * Description: Intentional display order in pickers (ascending).
    */
    get Sequence(): number {
        return this.Get('Sequence');
    }
    set Sequence(value: number) {
        this.Set('Sequence', value);
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
    * * Table-Level: A General Ledger account cannot be its own parent account. This prevents circular references in the account hierarchy.
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
    * A General Ledger account cannot be its own parent account. This prevents circular references in the account hierarchy.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateParentGLAccountIDNotEqualToID(result: ValidationResult) {
    	if (this.ParentGLAccountID != null && this.ParentGLAccountID === this.ID) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ParentGLAccountID",
    			"A GL Account cannot be configured as its own parent account.",
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
    * * SQL Data Type: nvarchar(15)
    * * Value List Type: List
    * * Possible Values 
    *   * Asset
    *   * Equity
    *   * Expense
    *   * Liability
    *   * Revenue
    * * Description: High-level type: Asset | Liability | Equity | Revenue | Expense (AM-3 five-value enum; contra/statistical variants may return later as a sub-classification).
    */
    get AccountType(): 'Asset' | 'Equity' | 'Expense' | 'Liability' | 'Revenue' {
        return this.Get('AccountType');
    }
    set AccountType(value: 'Asset' | 'Equity' | 'Expense' | 'Liability' | 'Revenue') {
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
    * * Display Name: Currency
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
    * * Display Name: Active
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
    * * Display Name: Currency (Virtual)
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
 * MJ_BizApps_Accounting: Intercompany Account Match Dimensions - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: IntercompanyAccountMatchDimension
 * * Base View: vwIntercompanyAccountMatchDimensions
 * * @description The analytical Dimensions, and optionally their fixed VALUES, to stamp on each leg of an intercompany pair. Unlike GLAccountLinkDimension this can pin a value, because an intercompany leg is raised to balance another company's revenue and has no originating record to read a value from.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Intercompany Account Match Dimensions')
export class mjBizAppsAccountingIntercompanyAccountMatchDimensionEntity extends BaseEntity<mjBizAppsAccountingIntercompanyAccountMatchDimensionEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Intercompany Account Match Dimensions record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Intercompany Account Match Dimensions record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingIntercompanyAccountMatchDimensionEntity
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
    * * Field Name: IntercompanyAccountMatchID
    * * Display Name: Intercompany Account Match
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Intercompany Account Matches (vwIntercompanyAccountMatches.ID)
    * * Description: The account pair this dimension requirement belongs to.
    */
    get IntercompanyAccountMatchID(): string {
        return this.Get('IntercompanyAccountMatchID');
    }
    set IntercompanyAccountMatchID(value: string) {
        this.Set('IntercompanyAccountMatchID', value);
    }

    /**
    * * Field Name: Side
    * * Display Name: Leg Side
    * * SQL Data Type: nvarchar(10)
    * * Value List Type: List
    * * Possible Values 
    *   * DueFrom
    *   * DueTo
    * * Description: Which leg the requirement applies to: DueTo (source company's liability) or DueFrom (target company's receivable). The two legs sit on different companies' books and routinely carry different values for the same Dimension.
    */
    get Side(): 'DueFrom' | 'DueTo' {
        return this.Get('Side');
    }
    set Side(value: 'DueFrom' | 'DueTo') {
        this.Set('Side', value);
    }

    /**
    * * Field Name: DimensionID
    * * Display Name: Dimension
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Dimensions (vwDimensions.ID)
    * * Description: The Dimension that applies (validate-only vocabulary — never invented here).
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
    * * Description: Optional fixed value to stamp. NULL keeps the GLAccountLink behaviour of taking the value from the calling context. Must belong to DimensionID (enforced by trigger).
    */
    get DimensionValueID(): string | null {
        return this.Get('DimensionValueID');
    }
    set DimensionValueID(value: string | null) {
        this.Set('DimensionValueID', value);
    }

    /**
    * * Field Name: Sequence
    * * Display Name: Sequence
    * * SQL Data Type: int
    * * Default Value: 0
    * * Description: Ordering of the dimensions for this side (ascending).
    */
    get Sequence(): number {
        return this.Get('Sequence');
    }
    set Sequence(value: number) {
        this.Set('Sequence', value);
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
    get DimensionValue(): string | null {
        return this.Get('DimensionValue');
    }
}


/**
 * MJ_BizApps_Accounting: Intercompany Account Matches - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: IntercompanyAccountMatch
 * * Base View: vwIntercompanyAccountMatches
 * * @description The Due To / Due From GL account pair for an ORDERED company pair. Read a row as: Source collected cash on Target's behalf, so Source owes Target. Money flowing the other way is a separate row with the companies swapped, because the two directions routinely use different accounts. Date-effective: resolution picks the Active row whose window covers the as-of date, latest StartedAt winning.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Intercompany Account Matches')
export class mjBizAppsAccountingIntercompanyAccountMatchEntity extends BaseEntity<mjBizAppsAccountingIntercompanyAccountMatchEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Intercompany Account Matches record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Intercompany Account Matches record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingIntercompanyAccountMatchEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Intercompany Account Matches entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * Table-Level: The Due To GL Account and Due From GL Account must be different to prevent intercompany transactions from posting to the same account on both sides.
    * * Table-Level: If both the start date and end date are specified, the end date must be later than the start date.
    * * Table-Level: The source company and target company must be different to prevent a company from performing intercompany transactions with itself.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateDueToAndDueFromGLAccountsAreDifferent(result);
        this.ValidateEndedAtAfterStartedAt(result);
        this.ValidateSourceCompanyIDNotEqualToTargetCompanyID(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The Due To GL Account and Due From GL Account must be different to prevent intercompany transactions from posting to the same account on both sides.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateDueToAndDueFromGLAccountsAreDifferent(result: ValidationResult) {
    	if (this.DueToGLAccountID != null && this.DueFromGLAccountID != null && this.DueToGLAccountID === this.DueFromGLAccountID) {
    		result.Errors.push(new ValidationErrorInfo(
    			"DueToGLAccountID",
    			"The Due To GL Account cannot be the same as the Due From GL Account.",
    			this.DueToGLAccountID,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * If both the start date and end date are specified, the end date must be later than the start date.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateEndedAtAfterStartedAt(result: ValidationResult) {
    	if (this.StartedAt != null && this.EndedAt != null) {
    		const start = new Date(this.StartedAt).getTime();
    		const end = new Date(this.EndedAt).getTime();
    		if (end <= start) {
    			result.Errors.push(new ValidationErrorInfo(
    				"EndedAt",
    				"The end date must be after the start date.",
    				this.EndedAt,
    				ValidationErrorType.Failure
    			));
    		}
    	}
    }

    /**
    * The source company and target company must be different to prevent a company from performing intercompany transactions with itself.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateSourceCompanyIDNotEqualToTargetCompanyID(result: ValidationResult) {
    	if (this.SourceCompanyID !== undefined && this.TargetCompanyID !== undefined && this.SourceCompanyID === this.TargetCompanyID) {
    		result.Errors.push(new ValidationErrorInfo(
    			"TargetCompanyID",
    			"The target company must be different from the source company.",
    			this.TargetCompanyID,
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
    * * Field Name: SourceCompanyID
    * * Display Name: Source Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: The company that COLLECTED the cash and therefore owes — the Due To liability sits on its books.
    */
    get SourceCompanyID(): string {
        return this.Get('SourceCompanyID');
    }
    set SourceCompanyID(value: string) {
        this.Set('SourceCompanyID', value);
    }

    /**
    * * Field Name: TargetCompanyID
    * * Display Name: Target Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: The company that is OWED because it owns the line the cash settled — the Due From receivable sits on its books.
    */
    get TargetCompanyID(): string {
        return this.Get('TargetCompanyID');
    }
    set TargetCompanyID(value: string) {
        this.Set('TargetCompanyID', value);
    }

    /**
    * * Field Name: DueToGLAccountID
    * * Display Name: Due To GL Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: The intercompany PAYABLE on the source company's books. Must be a Liability account belonging to SourceCompanyID (enforced by trigger, not merely by convention: a backwards pair still balances).
    */
    get DueToGLAccountID(): string {
        return this.Get('DueToGLAccountID');
    }
    set DueToGLAccountID(value: string) {
        this.Set('DueToGLAccountID', value);
    }

    /**
    * * Field Name: DueFromGLAccountID
    * * Display Name: Due From GL Account
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: GL Accounts (vwGLAccounts.ID)
    * * Description: The intercompany RECEIVABLE on the target company's books. Must be an Asset account belonging to TargetCompanyID.
    */
    get DueFromGLAccountID(): string {
        return this.Get('DueFromGLAccountID');
    }
    set DueFromGLAccountID(value: string) {
        this.Set('DueFromGLAccountID', value);
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(10)
    * * Default Value: Pending
    * * Value List Type: List
    * * Possible Values 
    *   * Active
    *   * Disabled
    *   * Pending
    * * Description: Pending | Active | Disabled. Only Active rows resolve; a pair is never deleted once it has been used.
    */
    get Status(): 'Active' | 'Disabled' | 'Pending' {
        return this.Get('Status');
    }
    set Status(value: 'Active' | 'Disabled' | 'Pending') {
        this.Set('Status', value);
    }

    /**
    * * Field Name: StartedAt
    * * Display Name: Start Date
    * * SQL Data Type: datetimeoffset
    * * Description: Start of the effective window (inclusive). NULL means open-ended in the past.
    */
    get StartedAt(): Date | null {
        return this.Get('StartedAt');
    }
    set StartedAt(value: Date | null) {
        this.Set('StartedAt', value);
    }

    /**
    * * Field Name: EndedAt
    * * Display Name: End Date
    * * SQL Data Type: datetimeoffset
    * * Description: End of the effective window (inclusive). NULL means open-ended. Supersede a mapping by closing this and adding a new row, never by editing history.
    */
    get EndedAt(): Date | null {
        return this.Get('EndedAt');
    }
    set EndedAt(value: Date | null) {
        this.Set('EndedAt', value);
    }

    /**
    * * Field Name: Comments
    * * Display Name: Comments
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Free-text note on why this mapping exists — typically the intercompany agreement it implements.
    */
    get Comments(): string | null {
        return this.Get('Comments');
    }
    set Comments(value: string | null) {
        this.Set('Comments', value);
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
    * * Field Name: SourceCompany
    * * Display Name: Source Company Name
    * * SQL Data Type: nvarchar(50)
    */
    get SourceCompany(): string {
        return this.Get('SourceCompany');
    }

    /**
    * * Field Name: TargetCompany
    * * Display Name: Target Company Name
    * * SQL Data Type: nvarchar(50)
    */
    get TargetCompany(): string {
        return this.Get('TargetCompany');
    }

    /**
    * * Field Name: DueToGLAccount
    * * Display Name: Due To GL Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get DueToGLAccount(): string {
        return this.Get('DueToGLAccount');
    }

    /**
    * * Field Name: DueFromGLAccount
    * * Display Name: Due From GL Account Name
    * * SQL Data Type: nvarchar(200)
    */
    get DueFromGLAccount(): string {
        return this.Get('DueFromGLAccount');
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
  * Related records: MJ_BizApps_Accounting: Journal Entry Lines
  *
  * Loads, validates and persists as one unit with this MJ_BizApps_Accounting: Journal Entries record — see
  * guides/TRANSACTIONS_AND_BATCHING_GUIDE.md. Declared by the RelatedRecordCollection metadata on
  * the 'MJ_BizApps_Accounting: Journal Entries → MJ_BizApps_Accounting: Journal Entry Lines' relationship; edit that row, not this file.
  *
  */
  public readonly Lines = this.DeclareRelatedRecords<mjBizAppsAccountingJournalEntryLineEntity>({
      Name: 'Lines',
        RelatedEntity: 'MJ_BizApps_Accounting: Journal Entry Lines',
        RelatedEntityJoinField: 'JournalEntryID',
        OrderBy: 'LineNumber ASC',
        Load: 'explicit',
        OnRemove: 'delete',
        Source: 'database',
        Sequence: { Field: 'LineNumber', From: 1 },
  });

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
    * * Table-Level: If a journal entry's status is set to 'GLPosted', it must have a valid GL posting date and time recorded in GLPostedAt.
    * * Table-Level: Both Linked Entity and Linked Record must either be both specified or both left blank to ensure complete linkage information.
    * * Table-Level: A journal entry cannot be marked as reversed by itself. The reversing journal entry must be a different record.
    * * Table-Level: A journal entry cannot be configured to reverse itself. The reversing journal entry must be a different journal entry to maintain proper audit trails.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateGLPostedAtWhenStatusIsGLPosted(result);
        this.ValidateLinkedEntityAndLinkedRecordCoexistence(result);
        this.ValidateReversedByJournalEntryNotEqualToID(result);
        this.ValidateReversesJournalEntryIDNotEqualToID(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * If a journal entry's status is set to 'GLPosted', it must have a valid GL posting date and time recorded in GLPostedAt.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateGLPostedAtWhenStatusIsGLPosted(result: ValidationResult) {
        if (this.Status === "GLPosted" && this.GLPostedAt == null) {
            result.Errors.push(new ValidationErrorInfo(
                "GLPostedAt",
                "A GL posting date and time (GLPostedAt) must be provided when the status is set to 'GLPosted'.",
                this.GLPostedAt,
                ValidationErrorType.Failure
            ));
        }
    }

    /**
    * Both Linked Entity and Linked Record must either be both specified or both left blank to ensure complete linkage information.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateLinkedEntityAndLinkedRecordCoexistence(result: ValidationResult) {
    	const hasLinkedEntity = this.LinkedEntityID != null;
    	const hasLinkedRecord = this.LinkedRecordID != null;
    
    	if (hasLinkedEntity !== hasLinkedRecord) {
    		result.Errors.push(new ValidationErrorInfo(
    			"LinkedEntityID",
    			"Both Linked Entity and Linked Record must be specified together, or both must be empty.",
    			this.LinkedEntityID,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * A journal entry cannot be marked as reversed by itself. The reversing journal entry must be a different record.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateReversedByJournalEntryNotEqualToID(result: ValidationResult) {
    	if (this.ReversedByJournalEntryID != null && this.ReversedByJournalEntryID === this.ID) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ReversedByJournalEntryID",
    			"A journal entry cannot be reversed by itself. Please select a different journal entry.",
    			this.ReversedByJournalEntryID,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * A journal entry cannot be configured to reverse itself. The reversing journal entry must be a different journal entry to maintain proper audit trails.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateReversesJournalEntryIDNotEqualToID(result: ValidationResult) {
    	if (this.ReversesJournalEntryID != null && this.ReversesJournalEntryID === this.ID) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ReversesJournalEntryID",
    			"A journal entry cannot be configured to reverse itself. The Reverses Journal Entry ID must be different from the Journal Entry ID.",
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
    * * Description: The single company this journal entry belongs to (plan D3). Every line's GLAccount must belong to this company (trigger-enforced).
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: EffectiveDate
    * * Display Name: Effective Date
    * * SQL Data Type: date
    * * Description: Accounting date for the entry (the ERP assigns its own period at posting).
    */
    get EffectiveDate(): Date {
        return this.Get('EffectiveDate');
    }
    set EffectiveDate(value: Date) {
        this.Set('EffectiveDate', value);
    }

    /**
    * * Field Name: EntryTypeID
    * * Display Name: Entry Type
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entry Types (vwJournalEntryTypes.ID)
    * * Description: The JournalEntryType classifying this entry (issue #24, BA-D29). Accounting seeds its own ledger-mechanics types; consuming apps seed their domain types as rows.
    */
    get EntryTypeID(): string {
        return this.Get('EntryTypeID');
    }
    set EntryTypeID(value: string) {
        this.Set('EntryTypeID', value);
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
    * * Field Name: LinkedEntityID
    * * Display Name: Linked Entity
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
    * * Description: Polymorphic origin part 1 (plan D25): the MJ Entity of the single causal source record for this JE (OrderLine for booking/rev-rec entries, Payment for receipts/refunds, ...). FK to __mj.Entity. NULL (with LinkedRecordID) = manual JE.
    */
    get LinkedEntityID(): string | null {
        return this.Get('LinkedEntityID');
    }
    set LinkedEntityID(value: string | null) {
        this.Set('LinkedEntityID', value);
    }

    /**
    * * Field Name: LinkedRecordID
    * * Display Name: Linked Record ID
    * * SQL Data Type: nvarchar(400)
    * * Description: Polymorphic origin part 2: the source record's primary key (NVARCHAR(400) supports stringified composite keys). Soft by nature — the record lives in a downstream app's schema. Set and NULL together with LinkedEntityID (CK_JournalEntry_LinkedPair).
    */
    get LinkedRecordID(): string | null {
        return this.Get('LinkedRecordID');
    }
    set LinkedRecordID(value: string | null) {
        this.Set('LinkedRecordID', value);
    }

    /**
    * * Field Name: ReversesJournalEntryID
    * * Display Name: Reverses Journal Entry
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
    * * Description: When set, this JE is a reversal of the referenced original JE. Its JournalEntryType Code MUST be 'Reversal' (trg_JE_ReversalConsistency).
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
    * * Field Name: JournalEntryBatchID
    * * Display Name: Journal Entry Batch
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entry Batches (vwJournalEntryBatches.ID)
    * * Description: Batch that locked this JE (set when Status transitions to Batched).
    */
    get JournalEntryBatchID(): string | null {
        return this.Get('JournalEntryBatchID');
    }
    set JournalEntryBatchID(value: string | null) {
        this.Set('JournalEntryBatchID', value);
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
    * * Display Name: GL Reference ID
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
    * * Field Name: EntryType
    * * Display Name: Entry Type Name
    * * SQL Data Type: nvarchar(100)
    */
    get EntryType(): string {
        return this.Get('EntryType');
    }

    /**
    * * Field Name: LinkedEntity
    * * Display Name: Linked Entity Name
    * * SQL Data Type: nvarchar(255)
    */
    get LinkedEntity(): string | null {
        return this.Get('LinkedEntity');
    }

    /**
    * * Field Name: JournalEntryBatch
    * * Display Name: Batch Name
    * * SQL Data Type: nvarchar(40)
    */
    get JournalEntryBatch(): string | null {
        return this.Get('JournalEntryBatch');
    }

    /**
    * * Field Name: File
    * * Display Name: File Name
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
 * * @description GLOBAL singleton counter backing gap-free JournalEntryBatch numbering (plan D19: batch numbering stays global). One row, ID = 1. Consumed only by spAssignNextJournalEntryBatchNumber.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entry Batch Sequences')
export class mjBizAppsAccountingJournalEntryBatchSequenceEntity extends BaseEntity<mjBizAppsAccountingJournalEntryBatchSequenceEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Journal Entry Batch Sequences record from the database
    * @param ID: number - primary key value to load the MJ_BizApps_Accounting: Journal Entry Batch Sequences record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingJournalEntryBatchSequenceEntity
    * @method
    * @override
    */
    public async Load(ID: number, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * Validate() method override for MJ_BizApps_Accounting: Journal Entry Batch Sequences entity. This is an auto-generated method that invokes the generated validators for this entity for the following fields:
    * * ID: The identifier for this record must always be 1, ensuring that only a single, unique configuration record exists.
    * * NextSequenceNumber: The next sequence number must be a positive integer greater than zero to ensure proper sequential ordering.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateIdEqualsOne(result);
        this.ValidateNextSequenceNumberGreaterThanZero(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The identifier for this record must always be 1, ensuring that only a single, unique configuration record exists.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateIdEqualsOne(result: ValidationResult) {
    	if (this.ID !== 1) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ID",
    			"The ID must be exactly 1 to ensure only a single configuration record exists.",
    			this.ID,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * The next sequence number must be a positive integer greater than zero to ensure proper sequential ordering.
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
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: int
    * * Default Value: 1
    */
    get ID(): number {
        return this.Get('ID');
    }
    set ID(value: number) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: NextSequenceNumber
    * * Display Name: Next Sequence Number
    * * SQL Data Type: int
    * * Default Value: 1
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
  * Related records: MJ_BizApps_Accounting: Journal Entries
  *
  * Loads, validates and persists as one unit with this MJ_BizApps_Accounting: Journal Entry Batches record — see
  * guides/TRANSACTIONS_AND_BATCHING_GUIDE.md. Declared by the RelatedRecordCollection metadata on
  * the 'MJ_BizApps_Accounting: Journal Entry Batches → MJ_BizApps_Accounting: Journal Entries' relationship; edit that row, not this file.
  * **Read-only.** Add/Create/Remove/Clear throw, the collection contributes nothing to a save,
  * and it never reports Dirty.
  */
  public readonly Members = this.DeclareRelatedRecords<mjBizAppsAccountingJournalEntryEntity>({
      Name: 'Members',
        RelatedEntity: 'MJ_BizApps_Accounting: Journal Entries',
        RelatedEntityJoinField: 'JournalEntryBatchID',
        OrderBy: 'EntryNumber ASC',
        Load: 'explicit',
        OnRemove: 'refuse',
        Source: 'database',
        ReadOnly: true,
  });

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
    * * Table-Level: Both the approval task ID and the approval task raised date must either be provided together, or both must be omitted.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateApprovalTaskAndRaisedAtCoexistence(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * Both the approval task ID and the approval task raised date must either be provided together, or both must be omitted.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateApprovalTaskAndRaisedAtCoexistence(result: ValidationResult) {
    	const hasTaskId = this.ApprovalTaskID != null;
    	const hasRaisedAt = this.ApprovalTaskRaisedAt != null;
    
    	if (hasTaskId !== hasRaisedAt) {
    		result.Errors.push(new ValidationErrorInfo(
    			"ApprovalTaskID",
    			"Approval Task ID and Approval Task Raised At date must either both be provided or both be empty.",
    			this.ApprovalTaskID,
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
    * * Field Name: JournalEntryBatchNumber
    * * Display Name: Batch Number
    * * SQL Data Type: nvarchar(40)
    * * Description: Gap-free batch number assigned by spAssignNextJournalEntryBatchNumber. Format 'BATCH-{CompanyCode}-{seq:000000}'.
    */
    get JournalEntryBatchNumber(): string {
        return this.Get('JournalEntryBatchNumber');
    }
    set JournalEntryBatchNumber(value: string) {
        this.Set('JournalEntryBatchNumber', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: The single company this batch belongs to (plan D7). One batch per company per run; the batch gathers ONLY this company's Pending JEs.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: PostingDate
    * * Display Name: Posting Date
    * * SQL Data Type: date
    * * Description: Singular, accountant-set posting date chosen at batch build (plan D8). Carried to the GL's posting date and must match between systems; drives the ERP period. Document dates stay informational.
    */
    get PostingDate(): Date {
        return this.Get('PostingDate');
    }
    set PostingDate(value: Date) {
        this.Set('PostingDate', value);
    }

    /**
    * * Field Name: SummaryJournalEntryID
    * * Display Name: Summary Journal Entry ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Journal Entries (vwJournalEntries.ID)
    * * Description: The aggregated summary JournalEntry (its JournalEntryType flagged IsJournalEntryBatchSummary, EffectiveDate=PostingDate) that posts to the GL for this batch (plan D9). Its lines net debits/credits per GLAccount x dimension-combo. The summary carries this batch's JournalEntryBatchID (same derived lock machinery as members) but is excluded from member/netting/sweep queries via its type's IsJournalEntryBatchSummary flag.
    */
    get SummaryJournalEntryID(): string | null {
        return this.Get('SummaryJournalEntryID');
    }
    set SummaryJournalEntryID(value: string | null) {
        this.Set('SummaryJournalEntryID', value);
    }

    /**
    * * Field Name: TargetSystem
    * * Display Name: Target System
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
    *   * Approved
    *   * Cancelled
    *   * Failed
    *   * Pending
    *   * Posted
    *   * Sent
    * * Description: Lifecycle: Pending | Approved | Sent | Posted | Failed | Cancelled. Pending is mutable/deletable; Approved locks content (human sign-off); Posted = the ERP confirmed posting; Failed triggers retry + escalation; Cancelled is terminal from Pending or unsent Approved (trg_JournalEntryBatch_Immutability).
    */
    get Status(): 'Approved' | 'Cancelled' | 'Failed' | 'Pending' | 'Posted' | 'Sent' {
        return this.Get('Status');
    }
    set Status(value: 'Approved' | 'Cancelled' | 'Failed' | 'Pending' | 'Posted' | 'Sent') {
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
    * * Field Name: ExternalJournalEntryBatchRef
    * * Display Name: External Batch Reference
    * * SQL Data Type: nvarchar(100)
    * * Description: ERP's reference returned on send (used to correlate the consolidated JE posted in the ERP).
    */
    get ExternalJournalEntryBatchRef(): string | null {
        return this.Get('ExternalJournalEntryBatchRef');
    }
    set ExternalJournalEntryBatchRef(value: string | null) {
        this.Set('ExternalJournalEntryBatchRef', value);
    }

    /**
    * * Field Name: ApprovedAt
    * * Display Name: Approved At
    * * SQL Data Type: datetimeoffset
    * * Description: When a human approved the batch for dispatch (locks its content; the new Approved status).
    */
    get ApprovedAt(): Date | null {
        return this.Get('ApprovedAt');
    }
    set ApprovedAt(value: Date | null) {
        this.Set('ApprovedAt', value);
    }

    /**
    * * Field Name: ApprovedByUserID
    * * Display Name: Approved By User ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    * * Description: The user who approved the batch (see AccountingCompanyProfile.ApprovalCFOUserID / the bizapps-tasks approval gate).
    */
    get ApprovedByUserID(): string | null {
        return this.Get('ApprovedByUserID');
    }
    set ApprovedByUserID(value: string | null) {
        this.Set('ApprovedByUserID', value);
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
    * * Field Name: PostedAt
    * * Display Name: Posted At
    * * SQL Data Type: datetimeoffset
    * * Description: When the ERP confirmed it posted the batch (Status=Posted; renames the old AcknowledgedAt).
    */
    get PostedAt(): Date | null {
        return this.Get('PostedAt');
    }
    set PostedAt(value: Date | null) {
        this.Set('PostedAt', value);
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
    * * Field Name: ApprovalTaskID
    * * Display Name: Approval Task ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Tasks: Tasks (vwTasks.ID)
    * * Description: The bizapps-tasks approval Task raised for this batch (plan D10). Real FK to __mj_BizAppsTasks.Task (#22) — cross-app references point UP the dependency graph, and tasks installs before this app. Stamped together with ApprovalTaskRaisedAt in the task-raise transaction (both-or-neither CHECK). NULL = task not yet raised (retryable state).
    */
    get ApprovalTaskID(): string | null {
        return this.Get('ApprovalTaskID');
    }
    set ApprovalTaskID(value: string | null) {
        this.Set('ApprovalTaskID', value);
    }

    /**
    * * Field Name: ApprovalTaskRaisedAt
    * * Display Name: Approval Task Raised At
    * * SQL Data Type: datetimeoffset
    * * Description: When the approval task was raised; set together with ApprovalTaskID (both-or-neither CHECK).
    */
    get ApprovalTaskRaisedAt(): Date | null {
        return this.Get('ApprovalTaskRaisedAt');
    }
    set ApprovalTaskRaisedAt(value: Date | null) {
        this.Set('ApprovalTaskRaisedAt', value);
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
    * * Field Name: BatchedByUser
    * * Display Name: Batched By
    * * SQL Data Type: nvarchar(100)
    */
    get BatchedByUser(): string {
        return this.Get('BatchedByUser');
    }

    /**
    * * Field Name: ApprovedByUser
    * * Display Name: Approved By
    * * SQL Data Type: nvarchar(100)
    */
    get ApprovedByUser(): string | null {
        return this.Get('ApprovedByUser');
    }

    /**
    * * Field Name: ApprovalTask
    * * Display Name: Approval Task
    * * SQL Data Type: nvarchar(255)
    */
    get ApprovalTask(): string | null {
        return this.Get('ApprovalTask');
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
  * Related records: MJ_BizApps_Accounting: Journal Entry Line Dimensions
  *
  * Loads, validates and persists as one unit with this MJ_BizApps_Accounting: Journal Entry Lines record — see
  * guides/TRANSACTIONS_AND_BATCHING_GUIDE.md. Declared by the RelatedRecordCollection metadata on
  * the 'MJ_BizApps_Accounting: Journal Entry Lines → MJ_BizApps_Accounting: Journal Entry Line Dimensions' relationship; edit that row, not this file.
  *
  */
  public readonly Dimensions = this.DeclareRelatedRecords<mjBizAppsAccountingJournalEntryLineDimensionEntity>({
      Name: 'Dimensions',
        RelatedEntity: 'MJ_BizApps_Accounting: Journal Entry Line Dimensions',
        RelatedEntityJoinField: 'JournalEntryLineID',
        OrderBy: '__mj_CreatedAt ASC',
        Load: 'explicit',
        OnRemove: 'delete',
        Source: 'database',
  });

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
    * * LineNumber: The line number for a journal entry must be a positive integer greater than zero to ensure proper sequencing and referencing.
    * * Table-Level: Each journal entry line must have either a positive debit amount or a positive credit amount, but not both. One of the amounts must be specified and greater than zero, while the other must be left blank.
    * * Table-Level: If an original debit or credit amount is specified, an exchange rate must also be provided to ensure proper currency conversion.
    * * Table-Level: If an original currency debit or credit amount is specified, its corresponding local currency debit or credit amount must also be provided to ensure proper exchange rate and currency tracking.
    * * Table-Level: If either an original debit or credit amount is specified, an original currency code must also be provided.
    * * Table-Level: An entry cannot have both an original debit amount and an original credit amount specified at the same time. At least one of these fields must be empty.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateLineNumberGreaterThanZero(result);
        this.ValidateDebitAndCreditAmounts(result);
        this.ValidateExchangeRateWhenOriginalAmountsSpecified(result);
        this.ValidateOriginalAndBaseAmounts(result);
        this.ValidateOriginalCurrencyCodeForOriginalAmounts(result);
        this.ValidateOriginalDebitAndCreditAmountExclusivity(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * The line number for a journal entry must be a positive integer greater than zero to ensure proper sequencing and referencing.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateLineNumberGreaterThanZero(result: ValidationResult) {
    	if (this.LineNumber <= 0) {
    		result.Errors.push(new ValidationErrorInfo(
    			"LineNumber",
    			"Line number must be greater than zero.",
    			this.LineNumber,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * Each journal entry line must have either a positive debit amount or a positive credit amount, but not both. One of the amounts must be specified and greater than zero, while the other must be left blank.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateDebitAndCreditAmounts(result: ValidationResult) {
        const debit = this.DebitAmount;
        const credit = this.CreditAmount;
    
        const isDebitValid = debit !== null && debit !== undefined && debit > 0 && (credit === null || credit === undefined);
        const isCreditValid = credit !== null && credit !== undefined && credit > 0 && (debit === null || debit === undefined);
    
        if (!isDebitValid && !isCreditValid) {
            result.Errors.push(new ValidationErrorInfo(
                "DebitAmount",
                "A journal entry line must have either a positive Debit amount or a positive Credit amount, and the other field must be empty.",
                debit,
                ValidationErrorType.Failure
            ));
        }
    }

    /**
    * If an original debit or credit amount is specified, an exchange rate must also be provided to ensure proper currency conversion.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateExchangeRateWhenOriginalAmountsSpecified(result: ValidationResult) {
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
    * If an original currency debit or credit amount is specified, its corresponding local currency debit or credit amount must also be provided to ensure proper exchange rate and currency tracking.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateOriginalAndBaseAmounts(result: ValidationResult) {
    	const hasNoOriginalAmounts = this.OriginalDebitAmount == null && this.OriginalCreditAmount == null;
    	const hasDebitAndOriginalDebit = this.OriginalDebitAmount != null && this.DebitAmount != null;
    	const hasCreditAndOriginalCredit = this.OriginalCreditAmount != null && this.CreditAmount != null;
    
    	if (!(hasNoOriginalAmounts || hasDebitAndOriginalDebit || hasCreditAndOriginalCredit)) {
    		result.Errors.push(new ValidationErrorInfo(
    			"OriginalDebitAmount",
    			"If an original debit or credit amount is specified, the corresponding local currency debit or credit amount must also be provided.",
    			this.OriginalDebitAmount,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * If either an original debit or credit amount is specified, an original currency code must also be provided.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateOriginalCurrencyCodeForOriginalAmounts(result: ValidationResult) {
    	const hasOriginalDebit = this.OriginalDebitAmount !== null && this.OriginalDebitAmount !== undefined;
    	const hasOriginalCredit = this.OriginalCreditAmount !== null && this.OriginalCreditAmount !== undefined;
    	const hasOriginalCurrency = this.OriginalCurrencyCode !== null && this.OriginalCurrencyCode !== undefined;
    
    	if ((hasOriginalDebit || hasOriginalCredit) && !hasOriginalCurrency) {
    		result.Errors.push(new ValidationErrorInfo(
    			"OriginalCurrencyCode",
    			"Original Currency Code must be specified if an Original Debit Amount or Original Credit Amount is provided.",
    			this.OriginalCurrencyCode,
    			ValidationErrorType.Failure
    		));
    	}
    }

    /**
    * An entry cannot have both an original debit amount and an original credit amount specified at the same time. At least one of these fields must be empty.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateOriginalDebitAndCreditAmountExclusivity(result: ValidationResult) {
    	if (this.OriginalDebitAmount != null && this.OriginalCreditAmount != null) {
    		result.Errors.push(new ValidationErrorInfo(
    			"OriginalDebitAmount",
    			"An entry cannot have both an Original Debit Amount and an Original Credit Amount specified. Please provide only one or leave both blank.",
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
    * * Display Name: Original Currency Code (Virtual)
    * * SQL Data Type: nvarchar(80)
    */
    get OriginalCurrencyCode_Virtual(): string | null {
        return this.Get('OriginalCurrencyCode_Virtual');
    }
}


/**
 * MJ_BizApps_Accounting: Journal Entry Sequences - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: JournalEntrySequence
 * * Base View: vwJournalEntrySequences
 * * @description PER-COMPANY per-fiscal-year counter backing gap-free JournalEntry numbering JE-{CompanyCode}-{FY}-{seq} (plan D19). Consumed only by spAssignNextJournalEntryNumber.
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
    * * NextSequenceNumber: The next sequence number must be a positive number greater than 0.
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
    * The next sequence number must be a positive number greater than 0.
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
    * * Display Name: Company Name
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }
}


/**
 * MJ_BizApps_Accounting: Journal Entry Types - strongly typed entity sub-class
 * * Schema: __mj_BizAppsAccounting
 * * Base Table: JournalEntryType
 * * Base View: vwJournalEntryTypes
 * * @description Extensible classification of journal entries (issue #24, BA-D29). Replaces the former closed EntryType CHECK enum. Accounting seeds only the ledger-mechanics types it owns (IsSystem=1, via metadata/journal-entry-types); consuming apps (orders, AP, payroll, ...) seed their own domain types via mj sync push without touching this repo.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entry Types')
export class mjBizAppsAccountingJournalEntryTypeEntity extends BaseEntity<mjBizAppsAccountingJournalEntryTypeEntityType> {
    /**
    * Loads the MJ_BizApps_Accounting: Journal Entry Types record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Accounting: Journal Entry Types record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsAccountingJournalEntryTypeEntity
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
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    * * Description: Stable machine code for the type (e.g. Manual, Reversal, JournalEntryBatchSummary, OrderBooking). Unique. Referenced by code; display uses Name.
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
    * * Description: Human-readable display name for the type.
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
    * * Description: What this entry type classifies and which app owns it.
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: IsSystem
    * * Display Name: Is System
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: 1 = accounting's own ledger-mechanics type (Manual, Reversal, JournalEntryBatchSummary, ...). Consumers must not repurpose or delete IsSystem rows.
    */
    get IsSystem(): boolean {
        return this.Get('IsSystem');
    }
    set IsSystem(value: boolean) {
        this.Set('IsSystem', value);
    }

    /**
    * * Field Name: IsJournalEntryBatchSummary
    * * Display Name: Is Journal Entry Batch Summary
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: 1 = this type marks a batch's aggregated summary JE. Batch member/netting/sweep queries exclude JEs of this type via a join on this flag (replaces the former 'JournalEntryBatchSummary' magic-string match). A filtered unique index allows exactly one flagged row.
    */
    get IsJournalEntryBatchSummary(): boolean {
        return this.Get('IsJournalEntryBatchSummary');
    }
    set IsJournalEntryBatchSummary(value: boolean) {
        this.Set('IsJournalEntryBatchSummary', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Whether this type may be used on NEW journal entries. Inactive types remain for historical rows.
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
    * * Display Name: Code
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
    * * Display Name: Country Code
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
    * * Display Name: Is Active
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
    * * Display Name: Code
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
 * * @description Open tax liability balance per (Company × Authority × Jurisdiction × Period). Accrued from JE postings; remitted to the authority in the ERP (no remittance table here — ERP/GL concern).
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
    * * Table-Level: Accrued amount and remitted amount must both be zero or positive values.
    * @public
    * @method
    * @override
    */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        this.ValidateAccruedAndRemittedAmountsArePositive(result);
        result.Success = result.Success && (result.Errors.length === 0);

        return result;
    }

    /**
    * Accrued amount and remitted amount must both be zero or positive values.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    	public ValidateAccruedAndRemittedAmountsArePositive(result: ValidationResult) {
    		if (this.AccruedAmount < 0) {
    			result.Errors.push(new ValidationErrorInfo(
    				"AccruedAmount",
    				"Accrued amount must be greater than or equal to zero.",
    				this.AccruedAmount,
    				ValidationErrorType.Failure
    			));
    		}
    		if (this.RemittedAmount < 0) {
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
    * * Rate: The tax rate must be a value between 0 and 1 inclusive, representing a percentage from 0% to 100%.
    * * Table-Level: The end date (Effective To) must be on or after the start date (Effective From) to ensure a valid active date range.
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
    * The tax rate must be a value between 0 and 1 inclusive, representing a percentage from 0% to 100%.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateRateRange(result: ValidationResult) {
        if (this.Rate != null && (this.Rate < 0 || this.Rate > 1)) {
            result.Errors.push(new ValidationErrorInfo(
                "Rate",
                "Rate must be between 0 and 1 (inclusive).",
                this.Rate,
                ValidationErrorType.Failure
            ));
        }
    }

    /**
    * The end date (Effective To) must be on or after the start date (Effective From) to ensure a valid active date range.
    * @param result - the ValidationResult object to add any errors or warnings to
    * @public
    * @method
    */
    public ValidateEffectiveToAfterOrEqualEffectiveFrom(result: ValidationResult) {
    	if (this.EffectiveTo != null && this.EffectiveFrom != null) {
    		if (this.EffectiveTo < this.EffectiveFrom) {
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
    * * SQL Data Type: decimal(9, 6)
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
    * * Description: Source of the rate: Avalara | TaxJar | Manual.
    */
    get Source(): string {
        return this.Get('Source');
    }
    set Source(value: string) {
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
