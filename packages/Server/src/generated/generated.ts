/********************************************************************************
* ALL ENTITIES - TypeGraphQL Type Class Definition - AUTO GENERATED FILE
* Generated Entities and Resolvers for Server
*
*   >>> DO NOT MODIFY THIS FILE!!!!!!!!!!!!
*   >>> YOUR CHANGES WILL BE OVERWRITTEN
*   >>> THE NEXT TIME THIS FILE IS GENERATED
*
**********************************************************************************/
import { Arg, Ctx, Int, Query, Resolver, Field, Float, ObjectType, FieldResolver, Root, InputType, Mutation,
            PubSub, PubSubEngine, ResolverBase, RunViewByIDInput, RunViewByNameInput, RunDynamicViewInput,
            AppContext, KeyValuePairInput, DeleteOptionsInput, GraphQLTimestamp as Timestamp,
            GetReadOnlyProvider, GetReadWriteProvider, RestoreContextInput } from '@memberjunction/server';
import { Metadata, EntityPermissionType, CompositeKey, UserInfo } from '@memberjunction/core'

import { MaxLength } from 'class-validator';
import * as mj_core_schema_server_object_types from '@memberjunction/server'


import { mjBizAppsAccountingAccountingCompanyProfileEntity, mjBizAppsAccountingChartOfAccountsMappingEntity, mjBizAppsAccountingCurrencyEntity, mjBizAppsAccountingCurrencySpotRateEntity, mjBizAppsAccountingCustomerTaxProfileEntity, mjBizAppsAccountingDimensionValueEntity, mjBizAppsAccountingDimensionEntity, mjBizAppsAccountingGLAccountLinkDimensionEntity, mjBizAppsAccountingGLAccountLinkEntity, mjBizAppsAccountingGLAccountRoleEntity, mjBizAppsAccountingGLAccountEntity, mjBizAppsAccountingJournalEntryEntity, mjBizAppsAccountingJournalEntryBatchLineDimensionEntity, mjBizAppsAccountingJournalEntryBatchLineItemEntity, mjBizAppsAccountingJournalEntryBatchSequenceEntity, mjBizAppsAccountingJournalEntryBatchEntity, mjBizAppsAccountingJournalEntryLineDimensionEntity, mjBizAppsAccountingJournalEntryLineEntity, mjBizAppsAccountingJournalEntryLinkEntity, mjBizAppsAccountingJournalEntrySequenceEntity, mjBizAppsAccountingScheduledJournalEntryEntity, mjBizAppsAccountingScheduledJournalEntryLineDimensionEntity, mjBizAppsAccountingScheduledJournalEntryLineItemEntity, mjBizAppsAccountingTaxAuthorityEntity, mjBizAppsAccountingTaxJurisdictionEntity, mjBizAppsAccountingTaxLiabilityEntity, mjBizAppsAccountingTaxRateEntity, mjBizAppsAccountingTaxRemittanceEntity } from '@mj-biz-apps/accounting-entities';
    

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Accounting Company Profiles
//****************************************************************************
@ObjectType({ description: `IsA Disjoint child of __mj.Company (same UUID as the parent). Holds all Company-attribute extensions required by Accounting: business profile (EntityType, LegalStructure, jurisdiction, tax ID) and accounting-specific settings (functional currency, fiscal year, default GL accounts). MJ core stays minimal; nothing accounting-flavored leaks into it (BA-D9).` })
export class mjBizAppsAccountingAccountingCompanyProfile_ {
    @Field({description: `Primary key AND foreign key to __mj.Company.ID. Same UUID as the parent Company row — this is the IsA pattern (BA-D9).`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `What kind of entity this is in the accounting structure: LegalEntity | Subsidiary | Division | Department | Branch | Partner | JointVenture | CostCenter | Other.`}) 
    @MaxLength(30)
    EntityType: string;
        
    @Field({nullable: true, description: `Legal structure: LLC | C-Corp | S-Corp | Partnership | SoleProprietorship | NonProfit-501c3 | NonProfit-501c6 | International-Ltd | International-GmbH | International-Pty | International-Other | Other. Only meaningful when EntityType is a legal entity / subsidiary / partner.`}) 
    @MaxLength(30)
    LegalStructureType?: string;
        
    @Field({nullable: true, description: `Date the entity was legally incorporated/registered.`}) 
    IncorporationDate?: Date;
        
    @Field({nullable: true, description: `ISO 3166-1 alpha-2 country code where this entity is incorporated. Free-form; not FK-constrained to keep dependency on geography modeling clean.`}) 
    @MaxLength(2)
    JurisdictionCountry?: string;
        
    @Field({nullable: true, description: `State/province sub-national region, free-form.`}) 
    @MaxLength(50)
    JurisdictionRegion?: string;
        
    @Field({nullable: true, description: `Federal tax identifier — EIN (US), ABN (Australia), VAT registration (EU), etc.`}) 
    @MaxLength(40)
    FederalTaxID?: string;
        
    @Field({nullable: true, description: `IANA time-zone name for the company's operations (e.g. 'America/Chicago'). All timestamps store in UTC/Zulu; period and rev-rec boundaries are evaluated in this zone so a transaction near midnight lands in the right local day/month.`}) 
    @MaxLength(60)
    OperatingTimeZone?: string;
        
    @Field({description: `Short code used in JE numbering ('JE-{CompanyCode}-{FY}-{seq}'). Uppercase alphanumeric + dash/underscore. UNIQUE per deployment (BA-D15).`}) 
    @MaxLength(20)
    CompanyCode: string;
        
    @Field({description: `ISO 4217 currency code (CHAR(3)) for the functional currency. All JEs post in this currency; original-currency triple on JE lines records the source-transaction currency when different (BA-D10).`}) 
    @MaxLength(3)
    FunctionalCurrencyCode: string;
        
    @Field({nullable: true, description: `Reporting currency for consolidation. NULL = same as functional currency.`}) 
    @MaxLength(3)
    ReportingCurrencyCode?: string;
        
    @Field(() => Int, {description: `Calendar month (1-12) when the fiscal year begins. Default 1 (Jan-start calendar).`}) 
    FiscalYearStartMonth: number;
        
    @Field(() => Int, {description: `Calendar day-of-month (1-31) when the fiscal year begins. Default 1.`}) 
    FiscalYearStartDay: number;
        
    @Field({nullable: true, description: `If set, this profile uses the books (COA, periods, JEs) of the referenced profile (consolidated reporting). Chains are forbidden: the referenced profile must NOT itself have a parent (BA-D9; trigger trg_ACP_NoChains).`}) 
    @MaxLength(36)
    ParentAccountingCompanyID?: string;
        
    @Field({nullable: true, description: `Default payment terms type for new orders/invoices. FK delegated to BizAppsOrders.PaymentTermsType (soft ref; no FK constraint).`}) 
    @MaxLength(36)
    DefaultPaymentTermsTypeID?: string;
        
    @Field({nullable: true, description: `Which GLAccount represents this company's primary Accounts Receivable. Wired by spSeedDefaultChartOfAccounts.`}) 
    @MaxLength(36)
    AROpenGLAccountID?: string;
        
    @Field({nullable: true, description: `Which GLAccount represents this company's Deferred Revenue.`}) 
    @MaxLength(36)
    DeferredRevenueGLAccountID?: string;
        
    @Field({nullable: true, description: `Which GLAccount represents Sales Tax Payable for accrual.`}) 
    @MaxLength(36)
    SalesTaxPayableGLAccountID?: string;
        
    @Field({nullable: true, description: `GLAccount used by the FX engine to record realized FX gains/losses on payment-to-AR rate mismatch (BA-D10).`}) 
    @MaxLength(36)
    RealizedFXGainLossGLAccountID?: string;
        
    @Field({nullable: true, description: `GLAccount used by the period-end FX revaluation template to record unrealized FX adjustments.`}) 
    @MaxLength(36)
    UnrealizedFXGainLossGLAccountID?: string;
        
    @Field(() => Boolean, {description: `Whether this profile is currently active. Inactive companies cannot have new JEs.`}) 
    IsActive: boolean;
        
    @Field({nullable: true, description: `The CFO (a bizapps-common Person) who must approve a Journal Entry Batch for this company before it dispatches to the ERP. Resolved by the bizapps-tasks approval gate. Nullable: companies without a configured CFO fall back to the role-based resolver.`}) 
    @MaxLength(36)
    ApprovalCFOPersonID?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(50)
    Name: string;
        
    @Field() 
    @MaxLength(200)
    Description: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    Website?: string;
        
    @Field({nullable: true}) 
    @MaxLength(500)
    LogoURL?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    Domain?: string;
        
    @Field() 
    @MaxLength(80)
    FunctionalCurrencyCode_Virtual: string;
        
    @Field({nullable: true}) 
    @MaxLength(80)
    ReportingCurrencyCode_Virtual?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    AROpenGLAccount?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DeferredRevenueGLAccount?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    SalesTaxPayableGLAccount?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    RealizedFXGainLossGLAccount?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    UnrealizedFXGainLossGLAccount?: string;
        
    @Field({nullable: true}) 
    @MaxLength(201)
    ApprovalCFOPerson?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    RootParentAccountingCompanyID?: string;
        
    @Field(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    mjBizAppsAccountingAccountingCompanyProfiles_ParentAccountingCompanyIDArray: mjBizAppsAccountingAccountingCompanyProfile_[]; // Link to mjBizAppsAccountingAccountingCompanyProfiles
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Accounting Company Profiles
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingAccountingCompanyProfileInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    EntityType?: string;

    @Field({ nullable: true })
    LegalStructureType: string | null;

    @Field({ nullable: true })
    IncorporationDate: Date | null;

    @Field({ nullable: true })
    JurisdictionCountry: string | null;

    @Field({ nullable: true })
    JurisdictionRegion: string | null;

    @Field({ nullable: true })
    FederalTaxID: string | null;

    @Field({ nullable: true })
    OperatingTimeZone: string | null;

    @Field({ nullable: true })
    CompanyCode?: string;

    @Field({ nullable: true })
    FunctionalCurrencyCode?: string;

    @Field({ nullable: true })
    ReportingCurrencyCode: string | null;

    @Field(() => Int, { nullable: true })
    FiscalYearStartMonth?: number;

    @Field(() => Int, { nullable: true })
    FiscalYearStartDay?: number;

    @Field({ nullable: true })
    ParentAccountingCompanyID: string | null;

    @Field({ nullable: true })
    DefaultPaymentTermsTypeID: string | null;

    @Field({ nullable: true })
    AROpenGLAccountID: string | null;

    @Field({ nullable: true })
    DeferredRevenueGLAccountID: string | null;

    @Field({ nullable: true })
    SalesTaxPayableGLAccountID: string | null;

    @Field({ nullable: true })
    RealizedFXGainLossGLAccountID: string | null;

    @Field({ nullable: true })
    UnrealizedFXGainLossGLAccountID: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field({ nullable: true })
    ApprovalCFOPersonID: string | null;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string;

    @Field({ nullable: true })
    Website: string | null;

    @Field({ nullable: true })
    LogoURL: string | null;

    @Field({ nullable: true })
    Domain: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Accounting Company Profiles
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingAccountingCompanyProfileInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    EntityType?: string;

    @Field({ nullable: true })
    LegalStructureType?: string | null;

    @Field({ nullable: true })
    IncorporationDate?: Date | null;

    @Field({ nullable: true })
    JurisdictionCountry?: string | null;

    @Field({ nullable: true })
    JurisdictionRegion?: string | null;

    @Field({ nullable: true })
    FederalTaxID?: string | null;

    @Field({ nullable: true })
    OperatingTimeZone?: string | null;

    @Field({ nullable: true })
    CompanyCode?: string;

    @Field({ nullable: true })
    FunctionalCurrencyCode?: string;

    @Field({ nullable: true })
    ReportingCurrencyCode?: string | null;

    @Field(() => Int, { nullable: true })
    FiscalYearStartMonth?: number;

    @Field(() => Int, { nullable: true })
    FiscalYearStartDay?: number;

    @Field({ nullable: true })
    ParentAccountingCompanyID?: string | null;

    @Field({ nullable: true })
    DefaultPaymentTermsTypeID?: string | null;

    @Field({ nullable: true })
    AROpenGLAccountID?: string | null;

    @Field({ nullable: true })
    DeferredRevenueGLAccountID?: string | null;

    @Field({ nullable: true })
    SalesTaxPayableGLAccountID?: string | null;

    @Field({ nullable: true })
    RealizedFXGainLossGLAccountID?: string | null;

    @Field({ nullable: true })
    UnrealizedFXGainLossGLAccountID?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field({ nullable: true })
    ApprovalCFOPersonID?: string | null;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string;

    @Field({ nullable: true })
    Website?: string | null;

    @Field({ nullable: true })
    LogoURL?: string | null;

    @Field({ nullable: true })
    Domain?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Accounting Company Profiles
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingAccountingCompanyProfileViewResult {
    @Field(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    Results: mjBizAppsAccountingAccountingCompanyProfile_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingAccountingCompanyProfile_)
export class mjBizAppsAccountingAccountingCompanyProfileResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingAccountingCompanyProfileViewResult)
    async RunmjBizAppsAccountingAccountingCompanyProfileViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingAccountingCompanyProfileViewResult)
    async RunmjBizAppsAccountingAccountingCompanyProfileViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingAccountingCompanyProfileViewResult)
    async RunmjBizAppsAccountingAccountingCompanyProfileDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Accounting Company Profiles';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingAccountingCompanyProfile_, { nullable: true })
    async mjBizAppsAccountingAccountingCompanyProfile(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingAccountingCompanyProfile_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Accounting Company Profiles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwAccountingCompanyProfiles')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Accounting Company Profiles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Accounting Company Profiles', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    async mjBizAppsAccountingAccountingCompanyProfiles_ParentAccountingCompanyIDArray(@Root() mjbizappsaccountingaccountingcompanyprofile_: mjBizAppsAccountingAccountingCompanyProfile_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Accounting Company Profiles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwAccountingCompanyProfiles')} WHERE ${provider.QuoteIdentifier('ParentAccountingCompanyID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Accounting Company Profiles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingaccountingcompanyprofile_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Accounting Company Profiles', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingAccountingCompanyProfile_)
    async CreatemjBizAppsAccountingAccountingCompanyProfile(
        @Arg('input', () => CreatemjBizAppsAccountingAccountingCompanyProfileInput) input: CreatemjBizAppsAccountingAccountingCompanyProfileInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Accounting Company Profiles', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingAccountingCompanyProfile_)
    async UpdatemjBizAppsAccountingAccountingCompanyProfile(
        @Arg('input', () => UpdatemjBizAppsAccountingAccountingCompanyProfileInput) input: UpdatemjBizAppsAccountingAccountingCompanyProfileInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Accounting Company Profiles', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingAccountingCompanyProfile_)
    async DeletemjBizAppsAccountingAccountingCompanyProfile(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Accounting Company Profiles', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Chart Of Accounts Mappings
//****************************************************************************
@ObjectType({ description: `Maps an internal GLAccount to an external ERP account code. Required so a Batch can ship JE postings with the right external IDs. Admin approval enforced per master plan M16/D27 (unmapped accounts hard-fail at batch time).` })
export class mjBizAppsAccountingChartOfAccountsMapping_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Company this mapping is for.`}) 
    @MaxLength(36)
    CompanyID: string;
        
    @Field({description: `Target ERP system the mapping is for.`}) 
    @MaxLength(50)
    ExternalSystem: string;
        
    @Field({description: `Account identifier as known to the external ERP.`}) 
    @MaxLength(100)
    ExternalAccountID: string;
        
    @Field({nullable: true, description: `Display name of the external account (snapshot for audit).`}) 
    @MaxLength(200)
    ExternalAccountName?: string;
        
    @Field({description: `Internal GLAccount this external account maps to.`}) 
    @MaxLength(36)
    InternalGLAccountID: string;
        
    @Field({description: `Earliest date this mapping is in effect.`}) 
    EffectiveFrom: Date;
        
    @Field({nullable: true, description: `Last date this mapping is in effect (NULL = open-ended).`}) 
    EffectiveTo?: Date;
        
    @Field({nullable: true, description: `Admin (typically Finance.Admin role) who approved this mapping.`}) 
    @MaxLength(36)
    ApprovedByUserID?: string;
        
    @Field({nullable: true, description: `When the mapping was approved.`}) 
    ApprovedAt?: Date;
        
    @Field({nullable: true, description: `Optional note describing why this mapping was created or changed.`}) 
    ChangeNote?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(50)
    Company: string;
        
    @Field() 
    @MaxLength(200)
    InternalGLAccount: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    ApprovedByUser?: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Chart Of Accounts Mappings
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingChartOfAccountsMappingInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    ExternalSystem?: string;

    @Field({ nullable: true })
    ExternalAccountID?: string;

    @Field({ nullable: true })
    ExternalAccountName: string | null;

    @Field({ nullable: true })
    InternalGLAccountID?: string;

    @Field({ nullable: true })
    EffectiveFrom?: Date;

    @Field({ nullable: true })
    EffectiveTo: Date | null;

    @Field({ nullable: true })
    ApprovedByUserID: string | null;

    @Field({ nullable: true })
    ApprovedAt: Date | null;

    @Field({ nullable: true })
    ChangeNote: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Chart Of Accounts Mappings
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingChartOfAccountsMappingInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    ExternalSystem?: string;

    @Field({ nullable: true })
    ExternalAccountID?: string;

    @Field({ nullable: true })
    ExternalAccountName?: string | null;

    @Field({ nullable: true })
    InternalGLAccountID?: string;

    @Field({ nullable: true })
    EffectiveFrom?: Date;

    @Field({ nullable: true })
    EffectiveTo?: Date | null;

    @Field({ nullable: true })
    ApprovedByUserID?: string | null;

    @Field({ nullable: true })
    ApprovedAt?: Date | null;

    @Field({ nullable: true })
    ChangeNote?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Chart Of Accounts Mappings
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingChartOfAccountsMappingViewResult {
    @Field(() => [mjBizAppsAccountingChartOfAccountsMapping_])
    Results: mjBizAppsAccountingChartOfAccountsMapping_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingChartOfAccountsMapping_)
export class mjBizAppsAccountingChartOfAccountsMappingResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingChartOfAccountsMappingViewResult)
    async RunmjBizAppsAccountingChartOfAccountsMappingViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingChartOfAccountsMappingViewResult)
    async RunmjBizAppsAccountingChartOfAccountsMappingViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingChartOfAccountsMappingViewResult)
    async RunmjBizAppsAccountingChartOfAccountsMappingDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Chart Of Accounts Mappings';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingChartOfAccountsMapping_, { nullable: true })
    async mjBizAppsAccountingChartOfAccountsMapping(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingChartOfAccountsMapping_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Chart Of Accounts Mappings', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwChartOfAccountsMappings')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Chart Of Accounts Mappings', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Chart Of Accounts Mappings', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingChartOfAccountsMapping_)
    async CreatemjBizAppsAccountingChartOfAccountsMapping(
        @Arg('input', () => CreatemjBizAppsAccountingChartOfAccountsMappingInput) input: CreatemjBizAppsAccountingChartOfAccountsMappingInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Chart Of Accounts Mappings', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingChartOfAccountsMapping_)
    async UpdatemjBizAppsAccountingChartOfAccountsMapping(
        @Arg('input', () => UpdatemjBizAppsAccountingChartOfAccountsMappingInput) input: UpdatemjBizAppsAccountingChartOfAccountsMappingInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Chart Of Accounts Mappings', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingChartOfAccountsMapping_)
    async DeletemjBizAppsAccountingChartOfAccountsMapping(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Chart Of Accounts Mappings', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Currencies
//****************************************************************************
@ObjectType({ description: `ISO-4217 currency reference data owned by BizAppsAccounting; seeded via metadata sync (metadata/currencies). Referenced by GLAccount, AccountingCompanyProfile, JournalEntryLine, and CurrencySpotRate.` })
export class mjBizAppsAccountingCurrency_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(3)
    Code: string;
        
    @Field() 
    @MaxLength(80)
    Name: string;
        
    @Field({nullable: true}) 
    @MaxLength(10)
    Symbol?: string;
        
    @Field(() => Int) 
    DecimalPlaces: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsAccountingCurrencySpotRate_])
    mjBizAppsAccountingCurrencySpotRates_FromCurrencyCodeArray: mjBizAppsAccountingCurrencySpotRate_[]; // Link to mjBizAppsAccountingCurrencySpotRates
    
    @Field(() => [mjBizAppsAccountingCurrencySpotRate_])
    mjBizAppsAccountingCurrencySpotRates_ToCurrencyCodeArray: mjBizAppsAccountingCurrencySpotRate_[]; // Link to mjBizAppsAccountingCurrencySpotRates
    
    @Field(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    mjBizAppsAccountingAccountingCompanyProfiles_FunctionalCurrencyCodeArray: mjBizAppsAccountingAccountingCompanyProfile_[]; // Link to mjBizAppsAccountingAccountingCompanyProfiles
    
    @Field(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    mjBizAppsAccountingAccountingCompanyProfiles_ReportingCurrencyCodeArray: mjBizAppsAccountingAccountingCompanyProfile_[]; // Link to mjBizAppsAccountingAccountingCompanyProfiles
    
    @Field(() => [mjBizAppsAccountingJournalEntryLine_])
    mjBizAppsAccountingJournalEntryLines_OriginalCurrencyCodeArray: mjBizAppsAccountingJournalEntryLine_[]; // Link to mjBizAppsAccountingJournalEntryLines
    
    @Field(() => [mjBizAppsAccountingScheduledJournalEntry_])
    mjBizAppsAccountingScheduledJournalEntries_CurrencyCodeArray: mjBizAppsAccountingScheduledJournalEntry_[]; // Link to mjBizAppsAccountingScheduledJournalEntries
    
    @Field(() => [mjBizAppsAccountingGLAccount_])
    mjBizAppsAccountingGLAccounts_CurrencyCodeArray: mjBizAppsAccountingGLAccount_[]; // Link to mjBizAppsAccountingGLAccounts
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Currencies
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingCurrencyInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Symbol: string | null;

    @Field(() => Int, { nullable: true })
    DecimalPlaces?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Currencies
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingCurrencyInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Symbol?: string | null;

    @Field(() => Int, { nullable: true })
    DecimalPlaces?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Currencies
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingCurrencyViewResult {
    @Field(() => [mjBizAppsAccountingCurrency_])
    Results: mjBizAppsAccountingCurrency_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingCurrency_)
export class mjBizAppsAccountingCurrencyResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingCurrencyViewResult)
    async RunmjBizAppsAccountingCurrencyViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingCurrencyViewResult)
    async RunmjBizAppsAccountingCurrencyViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingCurrencyViewResult)
    async RunmjBizAppsAccountingCurrencyDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Currencies';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingCurrency_, { nullable: true })
    async mjBizAppsAccountingCurrency(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingCurrency_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Currencies', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwCurrencies')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Currencies', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Currencies', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingCurrencySpotRate_])
    async mjBizAppsAccountingCurrencySpotRates_FromCurrencyCodeArray(@Root() mjbizappsaccountingcurrency_: mjBizAppsAccountingCurrency_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Currency Spot Rates', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwCurrencySpotRates')} WHERE ${provider.QuoteIdentifier('FromCurrencyCode')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Currency Spot Rates', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingcurrency_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Currency Spot Rates', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingCurrencySpotRate_])
    async mjBizAppsAccountingCurrencySpotRates_ToCurrencyCodeArray(@Root() mjbizappsaccountingcurrency_: mjBizAppsAccountingCurrency_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Currency Spot Rates', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwCurrencySpotRates')} WHERE ${provider.QuoteIdentifier('ToCurrencyCode')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Currency Spot Rates', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingcurrency_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Currency Spot Rates', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    async mjBizAppsAccountingAccountingCompanyProfiles_FunctionalCurrencyCodeArray(@Root() mjbizappsaccountingcurrency_: mjBizAppsAccountingCurrency_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Accounting Company Profiles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwAccountingCompanyProfiles')} WHERE ${provider.QuoteIdentifier('FunctionalCurrencyCode')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Accounting Company Profiles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingcurrency_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Accounting Company Profiles', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    async mjBizAppsAccountingAccountingCompanyProfiles_ReportingCurrencyCodeArray(@Root() mjbizappsaccountingcurrency_: mjBizAppsAccountingCurrency_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Accounting Company Profiles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwAccountingCompanyProfiles')} WHERE ${provider.QuoteIdentifier('ReportingCurrencyCode')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Accounting Company Profiles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingcurrency_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Accounting Company Profiles', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingJournalEntryLine_])
    async mjBizAppsAccountingJournalEntryLines_OriginalCurrencyCodeArray(@Root() mjbizappsaccountingcurrency_: mjBizAppsAccountingCurrency_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Lines', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryLines')} WHERE ${provider.QuoteIdentifier('OriginalCurrencyCode')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Lines', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingcurrency_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Lines', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingScheduledJournalEntry_])
    async mjBizAppsAccountingScheduledJournalEntries_CurrencyCodeArray(@Root() mjbizappsaccountingcurrency_: mjBizAppsAccountingCurrency_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Scheduled Journal Entries', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwScheduledJournalEntries')} WHERE ${provider.QuoteIdentifier('CurrencyCode')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Scheduled Journal Entries', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingcurrency_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Scheduled Journal Entries', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingGLAccount_])
    async mjBizAppsAccountingGLAccounts_CurrencyCodeArray(@Root() mjbizappsaccountingcurrency_: mjBizAppsAccountingCurrency_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: GL Accounts', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwGLAccounts')} WHERE ${provider.QuoteIdentifier('CurrencyCode')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: GL Accounts', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingcurrency_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: GL Accounts', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingCurrency_)
    async CreatemjBizAppsAccountingCurrency(
        @Arg('input', () => CreatemjBizAppsAccountingCurrencyInput) input: CreatemjBizAppsAccountingCurrencyInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Currencies', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingCurrency_)
    async UpdatemjBizAppsAccountingCurrency(
        @Arg('input', () => UpdatemjBizAppsAccountingCurrencyInput) input: UpdatemjBizAppsAccountingCurrencyInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Currencies', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingCurrency_)
    async DeletemjBizAppsAccountingCurrency(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Currencies', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Currency Spot Rates
//****************************************************************************
@ObjectType({ description: `Spot FX rate: units of ToCurrency per 1 unit of FromCurrency, on RateDate, from Source (ExchangeRate-API | ECB | OpenExchangeRates | Manual). Used for JE booking, period-end revaluation, and realized FX. Spot-only by design.` })
export class mjBizAppsAccountingCurrencySpotRate_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(3)
    FromCurrencyCode: string;
        
    @Field() 
    @MaxLength(3)
    ToCurrencyCode: string;
        
    @Field() 
    RateDate: Date;
        
    @Field(() => Float) 
    Rate: number;
        
    @Field() 
    @MaxLength(50)
    Source: string;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(80)
    FromCurrencyCode_Virtual: string;
        
    @Field() 
    @MaxLength(80)
    ToCurrencyCode_Virtual: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Currency Spot Rates
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingCurrencySpotRateInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    FromCurrencyCode?: string;

    @Field({ nullable: true })
    ToCurrencyCode?: string;

    @Field({ nullable: true })
    RateDate?: Date;

    @Field(() => Float, { nullable: true })
    Rate?: number;

    @Field({ nullable: true })
    Source?: string;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Currency Spot Rates
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingCurrencySpotRateInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    FromCurrencyCode?: string;

    @Field({ nullable: true })
    ToCurrencyCode?: string;

    @Field({ nullable: true })
    RateDate?: Date;

    @Field(() => Float, { nullable: true })
    Rate?: number;

    @Field({ nullable: true })
    Source?: string;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Currency Spot Rates
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingCurrencySpotRateViewResult {
    @Field(() => [mjBizAppsAccountingCurrencySpotRate_])
    Results: mjBizAppsAccountingCurrencySpotRate_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingCurrencySpotRate_)
export class mjBizAppsAccountingCurrencySpotRateResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingCurrencySpotRateViewResult)
    async RunmjBizAppsAccountingCurrencySpotRateViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingCurrencySpotRateViewResult)
    async RunmjBizAppsAccountingCurrencySpotRateViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingCurrencySpotRateViewResult)
    async RunmjBizAppsAccountingCurrencySpotRateDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Currency Spot Rates';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingCurrencySpotRate_, { nullable: true })
    async mjBizAppsAccountingCurrencySpotRate(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingCurrencySpotRate_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Currency Spot Rates', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwCurrencySpotRates')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Currency Spot Rates', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Currency Spot Rates', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingCurrencySpotRate_)
    async CreatemjBizAppsAccountingCurrencySpotRate(
        @Arg('input', () => CreatemjBizAppsAccountingCurrencySpotRateInput) input: CreatemjBizAppsAccountingCurrencySpotRateInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Currency Spot Rates', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingCurrencySpotRate_)
    async UpdatemjBizAppsAccountingCurrencySpotRate(
        @Arg('input', () => UpdatemjBizAppsAccountingCurrencySpotRateInput) input: UpdatemjBizAppsAccountingCurrencySpotRateInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Currency Spot Rates', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingCurrencySpotRate_)
    async DeletemjBizAppsAccountingCurrencySpotRate(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Currency Spot Rates', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Customer Tax Profiles
//****************************************************************************
@ObjectType({ description: `Taxability profile for an Organization (customer). Captures their tax ID, where they are taxable, and any exemption certificate.` })
export class mjBizAppsAccountingCustomerTaxProfile_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Customer Organization (FK to __mj_BizAppsCommon.Organization).`}) 
    @MaxLength(36)
    OrganizationID: string;
        
    @Field({nullable: true, description: `Jurisdiction where the customer is taxable (primary).`}) 
    @MaxLength(36)
    TaxJurisdictionID?: string;
        
    @Field({nullable: true, description: `Customer's tax registration number (VAT, EIN, ABN, etc.).`}) 
    @MaxLength(100)
    TaxIDNumber?: string;
        
    @Field(() => Boolean, {description: `Whether the customer is currently tax-exempt.`}) 
    IsExempt: boolean;
        
    @Field({nullable: true, description: `Reference to the exemption certificate (file ref, URL, certificate number). Required when IsExempt=1.`}) 
    @MaxLength(200)
    ExemptionCertificateRef?: string;
        
    @Field({nullable: true, description: `When the exemption certificate expires.`}) 
    ExemptionExpiryDate?: Date;
        
    @Field({description: `Earliest date this profile is in effect.`}) 
    EffectiveFrom: Date;
        
    @Field({nullable: true, description: `Last date this profile is in effect (NULL = open-ended).`}) 
    EffectiveTo?: Date;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(255)
    Organization: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    TaxJurisdiction?: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Customer Tax Profiles
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingCustomerTaxProfileInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    OrganizationID?: string;

    @Field({ nullable: true })
    TaxJurisdictionID: string | null;

    @Field({ nullable: true })
    TaxIDNumber: string | null;

    @Field(() => Boolean, { nullable: true })
    IsExempt?: boolean;

    @Field({ nullable: true })
    ExemptionCertificateRef: string | null;

    @Field({ nullable: true })
    ExemptionExpiryDate: Date | null;

    @Field({ nullable: true })
    EffectiveFrom?: Date;

    @Field({ nullable: true })
    EffectiveTo: Date | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Customer Tax Profiles
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingCustomerTaxProfileInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    OrganizationID?: string;

    @Field({ nullable: true })
    TaxJurisdictionID?: string | null;

    @Field({ nullable: true })
    TaxIDNumber?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsExempt?: boolean;

    @Field({ nullable: true })
    ExemptionCertificateRef?: string | null;

    @Field({ nullable: true })
    ExemptionExpiryDate?: Date | null;

    @Field({ nullable: true })
    EffectiveFrom?: Date;

    @Field({ nullable: true })
    EffectiveTo?: Date | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Customer Tax Profiles
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingCustomerTaxProfileViewResult {
    @Field(() => [mjBizAppsAccountingCustomerTaxProfile_])
    Results: mjBizAppsAccountingCustomerTaxProfile_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingCustomerTaxProfile_)
export class mjBizAppsAccountingCustomerTaxProfileResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingCustomerTaxProfileViewResult)
    async RunmjBizAppsAccountingCustomerTaxProfileViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingCustomerTaxProfileViewResult)
    async RunmjBizAppsAccountingCustomerTaxProfileViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingCustomerTaxProfileViewResult)
    async RunmjBizAppsAccountingCustomerTaxProfileDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Customer Tax Profiles';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingCustomerTaxProfile_, { nullable: true })
    async mjBizAppsAccountingCustomerTaxProfile(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingCustomerTaxProfile_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Customer Tax Profiles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwCustomerTaxProfiles')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Customer Tax Profiles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Customer Tax Profiles', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingCustomerTaxProfile_)
    async CreatemjBizAppsAccountingCustomerTaxProfile(
        @Arg('input', () => CreatemjBizAppsAccountingCustomerTaxProfileInput) input: CreatemjBizAppsAccountingCustomerTaxProfileInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Customer Tax Profiles', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingCustomerTaxProfile_)
    async UpdatemjBizAppsAccountingCustomerTaxProfile(
        @Arg('input', () => UpdatemjBizAppsAccountingCustomerTaxProfileInput) input: UpdatemjBizAppsAccountingCustomerTaxProfileInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Customer Tax Profiles', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingCustomerTaxProfile_)
    async DeletemjBizAppsAccountingCustomerTaxProfile(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Customer Tax Profiles', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Dimension Values
//****************************************************************************
@ObjectType({ description: `Hierarchical value within a Dimension. ParentDimensionValueID allows e.g. Region → State → City rollups.` })
export class mjBizAppsAccountingDimensionValue_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Dimension this value belongs to.`}) 
    @MaxLength(36)
    DimensionID: string;
        
    @Field({description: `Code for this value (unique within the dimension). E.g. 'Marketing', 'WestCoast', 'ProductLaunch2026'.`}) 
    @MaxLength(80)
    Code: string;
        
    @Field({description: `Display name for this value.`}) 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true, description: `Parent value for hierarchical dimensions (e.g. Country contains States).`}) 
    @MaxLength(36)
    ParentDimensionValueID?: string;
        
    @Field({nullable: true, description: `Earliest date this value is selectable (NULL = always).`}) 
    EffectiveFrom?: Date;
        
    @Field({nullable: true, description: `Last date this value is selectable (NULL = never expires).`}) 
    EffectiveTo?: Date;
        
    @Field(() => Boolean, {description: `Whether this value is available for new tagging.`}) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(100)
    Dimension: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    ParentDimensionValue?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    RootParentDimensionValueID?: string;
        
    @Field(() => [mjBizAppsAccountingJournalEntryLineDimension_])
    mjBizAppsAccountingJournalEntryLineDimensions_DimensionValueIDArray: mjBizAppsAccountingJournalEntryLineDimension_[]; // Link to mjBizAppsAccountingJournalEntryLineDimensions
    
    @Field(() => [mjBizAppsAccountingScheduledJournalEntryLineDimension_])
    mjBizAppsAccountingScheduledJournalEntryLineDimensions_DimensionValueIDArray: mjBizAppsAccountingScheduledJournalEntryLineDimension_[]; // Link to mjBizAppsAccountingScheduledJournalEntryLineDimensions
    
    @Field(() => [mjBizAppsAccountingJournalEntryBatchLineDimension_])
    mjBizAppsAccountingJournalEntryBatchLineDimensions_DimensionValueIDArray: mjBizAppsAccountingJournalEntryBatchLineDimension_[]; // Link to mjBizAppsAccountingJournalEntryBatchLineDimensions
    
    @Field(() => [mjBizAppsAccountingDimensionValue_])
    mjBizAppsAccountingDimensionValues_ParentDimensionValueIDArray: mjBizAppsAccountingDimensionValue_[]; // Link to mjBizAppsAccountingDimensionValues
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Dimension Values
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingDimensionValueInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    DimensionID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    ParentDimensionValueID: string | null;

    @Field({ nullable: true })
    EffectiveFrom: Date | null;

    @Field({ nullable: true })
    EffectiveTo: Date | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Dimension Values
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingDimensionValueInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    DimensionID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    ParentDimensionValueID?: string | null;

    @Field({ nullable: true })
    EffectiveFrom?: Date | null;

    @Field({ nullable: true })
    EffectiveTo?: Date | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Dimension Values
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingDimensionValueViewResult {
    @Field(() => [mjBizAppsAccountingDimensionValue_])
    Results: mjBizAppsAccountingDimensionValue_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingDimensionValue_)
export class mjBizAppsAccountingDimensionValueResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingDimensionValueViewResult)
    async RunmjBizAppsAccountingDimensionValueViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingDimensionValueViewResult)
    async RunmjBizAppsAccountingDimensionValueViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingDimensionValueViewResult)
    async RunmjBizAppsAccountingDimensionValueDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Dimension Values';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingDimensionValue_, { nullable: true })
    async mjBizAppsAccountingDimensionValue(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingDimensionValue_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Dimension Values', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwDimensionValues')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Dimension Values', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Dimension Values', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingJournalEntryLineDimension_])
    async mjBizAppsAccountingJournalEntryLineDimensions_DimensionValueIDArray(@Root() mjbizappsaccountingdimensionvalue_: mjBizAppsAccountingDimensionValue_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Line Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryLineDimensions')} WHERE ${provider.QuoteIdentifier('DimensionValueID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Line Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingdimensionvalue_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Line Dimensions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingScheduledJournalEntryLineDimension_])
    async mjBizAppsAccountingScheduledJournalEntryLineDimensions_DimensionValueIDArray(@Root() mjbizappsaccountingdimensionvalue_: mjBizAppsAccountingDimensionValue_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwScheduledJournalEntryLineDimensions')} WHERE ${provider.QuoteIdentifier('DimensionValueID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingdimensionvalue_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingJournalEntryBatchLineDimension_])
    async mjBizAppsAccountingJournalEntryBatchLineDimensions_DimensionValueIDArray(@Root() mjbizappsaccountingdimensionvalue_: mjBizAppsAccountingDimensionValue_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryBatchLineDimensions')} WHERE ${provider.QuoteIdentifier('DimensionValueID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingdimensionvalue_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingDimensionValue_])
    async mjBizAppsAccountingDimensionValues_ParentDimensionValueIDArray(@Root() mjbizappsaccountingdimensionvalue_: mjBizAppsAccountingDimensionValue_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Dimension Values', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwDimensionValues')} WHERE ${provider.QuoteIdentifier('ParentDimensionValueID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Dimension Values', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingdimensionvalue_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Dimension Values', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingDimensionValue_)
    async CreatemjBizAppsAccountingDimensionValue(
        @Arg('input', () => CreatemjBizAppsAccountingDimensionValueInput) input: CreatemjBizAppsAccountingDimensionValueInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Dimension Values', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingDimensionValue_)
    async UpdatemjBizAppsAccountingDimensionValue(
        @Arg('input', () => UpdatemjBizAppsAccountingDimensionValueInput) input: UpdatemjBizAppsAccountingDimensionValueInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Dimension Values', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingDimensionValue_)
    async DeletemjBizAppsAccountingDimensionValue(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Dimension Values', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Dimensions
//****************************************************************************
@ObjectType({ description: `First-class analytical dimension used to tag JE lines (Department, CostCenter, Project, Region, ...). Optional — deployments with no dimensions defined just have a flat chart.` })
export class mjBizAppsAccountingDimension_ {
    @Field({description: `Unique identifier (UUID per BA-D3).`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Short code for the dimension, e.g. 'Department', 'CostCenter'.`}) 
    @MaxLength(40)
    Code: string;
        
    @Field({description: `Display name for the dimension.`}) 
    @MaxLength(100)
    Name: string;
        
    @Field({nullable: true, description: `Detailed description of what the dimension tracks and how it is intended to be used in reports.`}) 
    Description?: string;
        
    @Field(() => Int, {description: `Sort order in dropdowns and report filters. Lower values appear first.`}) 
    DisplayOrder: number;
        
    @Field(() => Boolean, {description: `Whether this dimension is available for new JE-line tagging. Inactive dimensions stay in historical data but are hidden from selection.`}) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsAccountingJournalEntryLineDimension_])
    mjBizAppsAccountingJournalEntryLineDimensions_DimensionIDArray: mjBizAppsAccountingJournalEntryLineDimension_[]; // Link to mjBizAppsAccountingJournalEntryLineDimensions
    
    @Field(() => [mjBizAppsAccountingJournalEntryBatchLineDimension_])
    mjBizAppsAccountingJournalEntryBatchLineDimensions_DimensionIDArray: mjBizAppsAccountingJournalEntryBatchLineDimension_[]; // Link to mjBizAppsAccountingJournalEntryBatchLineDimensions
    
    @Field(() => [mjBizAppsAccountingGLAccountLinkDimension_])
    mjBizAppsAccountingGLAccountLinkDimensions_DimensionIDArray: mjBizAppsAccountingGLAccountLinkDimension_[]; // Link to mjBizAppsAccountingGLAccountLinkDimensions
    
    @Field(() => [mjBizAppsAccountingScheduledJournalEntryLineDimension_])
    mjBizAppsAccountingScheduledJournalEntryLineDimensions_DimensionIDArray: mjBizAppsAccountingScheduledJournalEntryLineDimension_[]; // Link to mjBizAppsAccountingScheduledJournalEntryLineDimensions
    
    @Field(() => [mjBizAppsAccountingDimensionValue_])
    mjBizAppsAccountingDimensionValues_DimensionIDArray: mjBizAppsAccountingDimensionValue_[]; // Link to mjBizAppsAccountingDimensionValues
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Dimensions
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingDimensionInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Int, { nullable: true })
    DisplayOrder?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Dimensions
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingDimensionInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Int, { nullable: true })
    DisplayOrder?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Dimensions
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingDimensionViewResult {
    @Field(() => [mjBizAppsAccountingDimension_])
    Results: mjBizAppsAccountingDimension_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingDimension_)
export class mjBizAppsAccountingDimensionResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingDimensionViewResult)
    async RunmjBizAppsAccountingDimensionViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingDimensionViewResult)
    async RunmjBizAppsAccountingDimensionViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingDimensionViewResult)
    async RunmjBizAppsAccountingDimensionDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Dimensions';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingDimension_, { nullable: true })
    async mjBizAppsAccountingDimension(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingDimension_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwDimensions')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Dimensions', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingJournalEntryLineDimension_])
    async mjBizAppsAccountingJournalEntryLineDimensions_DimensionIDArray(@Root() mjbizappsaccountingdimension_: mjBizAppsAccountingDimension_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Line Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryLineDimensions')} WHERE ${provider.QuoteIdentifier('DimensionID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Line Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingdimension_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Line Dimensions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingJournalEntryBatchLineDimension_])
    async mjBizAppsAccountingJournalEntryBatchLineDimensions_DimensionIDArray(@Root() mjbizappsaccountingdimension_: mjBizAppsAccountingDimension_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryBatchLineDimensions')} WHERE ${provider.QuoteIdentifier('DimensionID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingdimension_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingGLAccountLinkDimension_])
    async mjBizAppsAccountingGLAccountLinkDimensions_DimensionIDArray(@Root() mjbizappsaccountingdimension_: mjBizAppsAccountingDimension_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: GL Account Link Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwGLAccountLinkDimensions')} WHERE ${provider.QuoteIdentifier('DimensionID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: GL Account Link Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingdimension_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: GL Account Link Dimensions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingScheduledJournalEntryLineDimension_])
    async mjBizAppsAccountingScheduledJournalEntryLineDimensions_DimensionIDArray(@Root() mjbizappsaccountingdimension_: mjBizAppsAccountingDimension_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwScheduledJournalEntryLineDimensions')} WHERE ${provider.QuoteIdentifier('DimensionID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingdimension_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingDimensionValue_])
    async mjBizAppsAccountingDimensionValues_DimensionIDArray(@Root() mjbizappsaccountingdimension_: mjBizAppsAccountingDimension_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Dimension Values', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwDimensionValues')} WHERE ${provider.QuoteIdentifier('DimensionID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Dimension Values', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingdimension_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Dimension Values', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingDimension_)
    async CreatemjBizAppsAccountingDimension(
        @Arg('input', () => CreatemjBizAppsAccountingDimensionInput) input: CreatemjBizAppsAccountingDimensionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Dimensions', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingDimension_)
    async UpdatemjBizAppsAccountingDimension(
        @Arg('input', () => UpdatemjBizAppsAccountingDimensionInput) input: UpdatemjBizAppsAccountingDimensionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Dimensions', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingDimension_)
    async DeletemjBizAppsAccountingDimension(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Dimensions', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: GL Account Link Dimensions
//****************************************************************************
@ObjectType({ description: `Which analytical Dimensions apply to journal-entry lines resolved through a GLAccountLink, in display order. Carries the Dimension only — VALUES are supplied from the calling context at entry-build time (OQ-I).` })
export class mjBizAppsAccountingGLAccountLinkDimension_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `The link this dimension requirement belongs to.`}) 
    @MaxLength(36)
    GLAccountLinkID: string;
        
    @Field({description: `The Dimension that applies (validate-only vocabulary — never invented here).`}) 
    @MaxLength(36)
    DimensionID: string;
        
    @Field(() => Int, {description: `Ordering of the dimensions for this link (ascending).`}) 
    Sequence: number;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(100)
    Dimension: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: GL Account Link Dimensions
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingGLAccountLinkDimensionInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    GLAccountLinkID?: string;

    @Field({ nullable: true })
    DimensionID?: string;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: GL Account Link Dimensions
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingGLAccountLinkDimensionInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    GLAccountLinkID?: string;

    @Field({ nullable: true })
    DimensionID?: string;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: GL Account Link Dimensions
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingGLAccountLinkDimensionViewResult {
    @Field(() => [mjBizAppsAccountingGLAccountLinkDimension_])
    Results: mjBizAppsAccountingGLAccountLinkDimension_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingGLAccountLinkDimension_)
export class mjBizAppsAccountingGLAccountLinkDimensionResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingGLAccountLinkDimensionViewResult)
    async RunmjBizAppsAccountingGLAccountLinkDimensionViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingGLAccountLinkDimensionViewResult)
    async RunmjBizAppsAccountingGLAccountLinkDimensionViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingGLAccountLinkDimensionViewResult)
    async RunmjBizAppsAccountingGLAccountLinkDimensionDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: GL Account Link Dimensions';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingGLAccountLinkDimension_, { nullable: true })
    async mjBizAppsAccountingGLAccountLinkDimension(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingGLAccountLinkDimension_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: GL Account Link Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwGLAccountLinkDimensions')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: GL Account Link Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: GL Account Link Dimensions', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingGLAccountLinkDimension_)
    async CreatemjBizAppsAccountingGLAccountLinkDimension(
        @Arg('input', () => CreatemjBizAppsAccountingGLAccountLinkDimensionInput) input: CreatemjBizAppsAccountingGLAccountLinkDimensionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: GL Account Link Dimensions', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingGLAccountLinkDimension_)
    async UpdatemjBizAppsAccountingGLAccountLinkDimension(
        @Arg('input', () => UpdatemjBizAppsAccountingGLAccountLinkDimensionInput) input: UpdatemjBizAppsAccountingGLAccountLinkDimensionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: GL Account Link Dimensions', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingGLAccountLinkDimension_)
    async DeletemjBizAppsAccountingGLAccountLinkDimension(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: GL Account Link Dimensions', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: GL Account Links
//****************************************************************************
@ObjectType({ description: `Polymorphic, role-based, date-effective mapping from ANY record (Company defaults, Product Category, Product, future types) to a GL account. Replaces the ProductGLAccount / ProductCategoryGLAccount / AccountingCompanyProfileGLAccount trio (AM-5). Resolution filters Status=Active and StartedAt/EndedAt covering the as-of date; the caller (e.g. the Orders resolver) walks product -> category tree -> company default.` })
export class mjBizAppsAccountingGLAccountLink_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `The GL account this link maps its target record to.`}) 
    @MaxLength(36)
    GLAccountID: string;
        
    @Field({description: `The role the account plays for the target record (Sales, AR, ...). Assumed correction OQ-G: absent from the 07-03 field list but required to tell a record's Revenue link from its AR link.`}) 
    @MaxLength(36)
    GLAccountRoleID: string;
        
    @Field({description: `Polymorphic reference part 1: the MJ Entity of the target record (references __mj.Entity). Same TaggedItem-style pattern as JournalEntryLink.`}) 
    @MaxLength(36)
    EntityID: string;
        
    @Field({description: `Polymorphic reference part 2: the target record's primary key (NVARCHAR(400) supports stringified composite keys).`}) 
    @MaxLength(400)
    RecordID: string;
        
    @Field({description: `Pending = entered but not yet in force; Active = used by resolution; Disabled = ignored.`}) 
    @MaxLength(10)
    Status: string;
        
    @Field({nullable: true, description: `Start of the date-effective window (NULL = open start). Enables Amith's "new chart of accounts effective Aug 1" pre-entry: resolution flips automatically on the date; historical JEs are never touched.`}) 
    StartedAt?: Date;
        
    @Field({nullable: true, description: `End of the date-effective window (NULL = open end).`}) 
    EndedAt?: Date;
        
    @Field({nullable: true, description: `Free-text note on why this mapping exists / changed.`}) 
    Comments?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(200)
    GLAccount: string;
        
    @Field() 
    @MaxLength(100)
    GLAccountRole: string;
        
    @Field() 
    @MaxLength(255)
    Entity: string;
        
    @Field(() => [mjBizAppsAccountingGLAccountLinkDimension_])
    mjBizAppsAccountingGLAccountLinkDimensions_GLAccountLinkIDArray: mjBizAppsAccountingGLAccountLinkDimension_[]; // Link to mjBizAppsAccountingGLAccountLinkDimensions
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: GL Account Links
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingGLAccountLinkInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    GLAccountID?: string;

    @Field({ nullable: true })
    GLAccountRoleID?: string;

    @Field({ nullable: true })
    EntityID?: string;

    @Field({ nullable: true })
    RecordID?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field({ nullable: true })
    StartedAt: Date | null;

    @Field({ nullable: true })
    EndedAt: Date | null;

    @Field({ nullable: true })
    Comments: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: GL Account Links
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingGLAccountLinkInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    GLAccountID?: string;

    @Field({ nullable: true })
    GLAccountRoleID?: string;

    @Field({ nullable: true })
    EntityID?: string;

    @Field({ nullable: true })
    RecordID?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field({ nullable: true })
    StartedAt?: Date | null;

    @Field({ nullable: true })
    EndedAt?: Date | null;

    @Field({ nullable: true })
    Comments?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: GL Account Links
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingGLAccountLinkViewResult {
    @Field(() => [mjBizAppsAccountingGLAccountLink_])
    Results: mjBizAppsAccountingGLAccountLink_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingGLAccountLink_)
export class mjBizAppsAccountingGLAccountLinkResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingGLAccountLinkViewResult)
    async RunmjBizAppsAccountingGLAccountLinkViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingGLAccountLinkViewResult)
    async RunmjBizAppsAccountingGLAccountLinkViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingGLAccountLinkViewResult)
    async RunmjBizAppsAccountingGLAccountLinkDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: GL Account Links';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingGLAccountLink_, { nullable: true })
    async mjBizAppsAccountingGLAccountLink(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingGLAccountLink_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: GL Account Links', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwGLAccountLinks')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: GL Account Links', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: GL Account Links', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingGLAccountLinkDimension_])
    async mjBizAppsAccountingGLAccountLinkDimensions_GLAccountLinkIDArray(@Root() mjbizappsaccountingglaccountlink_: mjBizAppsAccountingGLAccountLink_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: GL Account Link Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwGLAccountLinkDimensions')} WHERE ${provider.QuoteIdentifier('GLAccountLinkID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: GL Account Link Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccountlink_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: GL Account Link Dimensions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingGLAccountLink_)
    async CreatemjBizAppsAccountingGLAccountLink(
        @Arg('input', () => CreatemjBizAppsAccountingGLAccountLinkInput) input: CreatemjBizAppsAccountingGLAccountLinkInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: GL Account Links', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingGLAccountLink_)
    async UpdatemjBizAppsAccountingGLAccountLink(
        @Arg('input', () => UpdatemjBizAppsAccountingGLAccountLinkInput) input: UpdatemjBizAppsAccountingGLAccountLinkInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: GL Account Links', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingGLAccountLink_)
    async DeletemjBizAppsAccountingGLAccountLink(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: GL Account Links', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: GL Account Roles
//****************************************************************************
@ObjectType({ description: `The JOB a GL account plays for a linked record (Cash, Accounts Receivable, Inventory, Cost of Goods Sold, Sales, Sales Discounts, Sales Returns and Allowances, Deferred Revenue). Lookup table so roles are additive at runtime; seeded via metadata sync (metadata/gl-account-roles), never SQL. AM-2.` })
export class mjBizAppsAccountingGLAccountRole_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Display name of the role; unique.`}) 
    @MaxLength(100)
    Name: string;
        
    @Field({nullable: true, description: `What entries this role is used for and any guidance for pickers.`}) 
    Description?: string;
        
    @Field({description: `Active roles are offered in pickers; Inactive roles are retained for history but not selectable.`}) 
    @MaxLength(10)
    Status: string;
        
    @Field(() => Int, {description: `Intentional display order in pickers (ascending).`}) 
    Sequence: number;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsAccountingGLAccountLink_])
    mjBizAppsAccountingGLAccountLinks_GLAccountRoleIDArray: mjBizAppsAccountingGLAccountLink_[]; // Link to mjBizAppsAccountingGLAccountLinks
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: GL Account Roles
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingGLAccountRoleInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: GL Account Roles
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingGLAccountRoleInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: GL Account Roles
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingGLAccountRoleViewResult {
    @Field(() => [mjBizAppsAccountingGLAccountRole_])
    Results: mjBizAppsAccountingGLAccountRole_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingGLAccountRole_)
export class mjBizAppsAccountingGLAccountRoleResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingGLAccountRoleViewResult)
    async RunmjBizAppsAccountingGLAccountRoleViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingGLAccountRoleViewResult)
    async RunmjBizAppsAccountingGLAccountRoleViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingGLAccountRoleViewResult)
    async RunmjBizAppsAccountingGLAccountRoleDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: GL Account Roles';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingGLAccountRole_, { nullable: true })
    async mjBizAppsAccountingGLAccountRole(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingGLAccountRole_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: GL Account Roles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwGLAccountRoles')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: GL Account Roles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: GL Account Roles', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingGLAccountLink_])
    async mjBizAppsAccountingGLAccountLinks_GLAccountRoleIDArray(@Root() mjbizappsaccountingglaccountrole_: mjBizAppsAccountingGLAccountRole_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: GL Account Links', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwGLAccountLinks')} WHERE ${provider.QuoteIdentifier('GLAccountRoleID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: GL Account Links', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccountrole_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: GL Account Links', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingGLAccountRole_)
    async CreatemjBizAppsAccountingGLAccountRole(
        @Arg('input', () => CreatemjBizAppsAccountingGLAccountRoleInput) input: CreatemjBizAppsAccountingGLAccountRoleInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: GL Account Roles', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingGLAccountRole_)
    async UpdatemjBizAppsAccountingGLAccountRole(
        @Arg('input', () => UpdatemjBizAppsAccountingGLAccountRoleInput) input: UpdatemjBizAppsAccountingGLAccountRoleInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: GL Account Roles', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingGLAccountRole_)
    async DeletemjBizAppsAccountingGLAccountRole(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: GL Account Roles', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: GL Accounts
//****************************************************************************
@ObjectType({ description: `Chart-of-accounts entry. Per-Company; mirrors the ERP\'s COA so JE lines have a stable internal reference. Hierarchical via ParentGLAccountID for rollup reporting.` })
export class mjBizAppsAccountingGLAccount_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Company that owns this account. UNIQUE (CompanyID, Code) — each company has its own chart.`}) 
    @MaxLength(36)
    CompanyID: string;
        
    @Field({description: `Account code matching the ERP COA, e.g. '11201' or '40100-SUB'.`}) 
    @MaxLength(40)
    Code: string;
        
    @Field({description: `Display name for the account.`}) 
    @MaxLength(200)
    Name: string;
        
    @Field({description: `High-level type: Asset | Liability | Equity | Revenue | Expense (AM-3 five-value enum; contra/statistical variants may return later as a sub-classification).`}) 
    @MaxLength(15)
    AccountType: string;
        
    @Field({nullable: true, description: `Parent account for hierarchical rollup (NULL = top of chart).`}) 
    @MaxLength(36)
    ParentGLAccountID?: string;
        
    @Field({nullable: true, description: `Currency denomination of the account (NULL = uses the Company's functional currency).`}) 
    @MaxLength(3)
    CurrencyCode?: string;
        
    @Field({nullable: true, description: `External system this account synchronizes to: BusinessCentral | QuickBooks | NetSuite | ... NULL if local-only.`}) 
    @MaxLength(50)
    ExternalSystem?: string;
        
    @Field({nullable: true, description: `The external system's identifier for this account, used by sync.`}) 
    @MaxLength(100)
    ExternalAccountID?: string;
        
    @Field(() => Boolean, {description: `Whether the account is available for new JE lines. Inactive accounts retain historical data.`}) 
    IsActive: boolean;
        
    @Field(() => Boolean, {description: `TRUE if the account was created by spSeedDefaultChartOfAccounts. Lets reports distinguish platform-shipped accounts from deployment customizations.`}) 
    IsSystemSeeded: boolean;
        
    @Field({nullable: true, description: `Optional description for the account.`}) 
    Description?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(50)
    Company: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    ParentGLAccount?: string;
        
    @Field({nullable: true}) 
    @MaxLength(80)
    CurrencyCode_Virtual?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    RootParentGLAccountID?: string;
        
    @Field(() => [mjBizAppsAccountingJournalEntryLine_])
    mjBizAppsAccountingJournalEntryLines_GLAccountIDArray: mjBizAppsAccountingJournalEntryLine_[]; // Link to mjBizAppsAccountingJournalEntryLines
    
    @Field(() => [mjBizAppsAccountingGLAccount_])
    mjBizAppsAccountingGLAccounts_ParentGLAccountIDArray: mjBizAppsAccountingGLAccount_[]; // Link to mjBizAppsAccountingGLAccounts
    
    @Field(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    mjBizAppsAccountingAccountingCompanyProfiles_DeferredRevenueGLAccountIDArray: mjBizAppsAccountingAccountingCompanyProfile_[]; // Link to mjBizAppsAccountingAccountingCompanyProfiles
    
    @Field(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    mjBizAppsAccountingAccountingCompanyProfiles_UnrealizedFXGainLossGLAccountIDArray: mjBizAppsAccountingAccountingCompanyProfile_[]; // Link to mjBizAppsAccountingAccountingCompanyProfiles
    
    @Field(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    mjBizAppsAccountingAccountingCompanyProfiles_SalesTaxPayableGLAccountIDArray: mjBizAppsAccountingAccountingCompanyProfile_[]; // Link to mjBizAppsAccountingAccountingCompanyProfiles
    
    @Field(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    mjBizAppsAccountingAccountingCompanyProfiles_RealizedFXGainLossGLAccountIDArray: mjBizAppsAccountingAccountingCompanyProfile_[]; // Link to mjBizAppsAccountingAccountingCompanyProfiles
    
    @Field(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    mjBizAppsAccountingAccountingCompanyProfiles_AROpenGLAccountIDArray: mjBizAppsAccountingAccountingCompanyProfile_[]; // Link to mjBizAppsAccountingAccountingCompanyProfiles
    
    @Field(() => [mjBizAppsAccountingGLAccountLink_])
    mjBizAppsAccountingGLAccountLinks_GLAccountIDArray: mjBizAppsAccountingGLAccountLink_[]; // Link to mjBizAppsAccountingGLAccountLinks
    
    @Field(() => [mjBizAppsAccountingChartOfAccountsMapping_])
    mjBizAppsAccountingChartOfAccountsMappings_InternalGLAccountIDArray: mjBizAppsAccountingChartOfAccountsMapping_[]; // Link to mjBizAppsAccountingChartOfAccountsMappings
    
    @Field(() => [mjBizAppsAccountingJournalEntryBatchLineItem_])
    mjBizAppsAccountingJournalEntryBatchLineItems_GLAccountIDArray: mjBizAppsAccountingJournalEntryBatchLineItem_[]; // Link to mjBizAppsAccountingJournalEntryBatchLineItems
    
    @Field(() => [mjBizAppsAccountingScheduledJournalEntryLineItem_])
    mjBizAppsAccountingScheduledJournalEntryLineItems_GLAccountIDArray: mjBizAppsAccountingScheduledJournalEntryLineItem_[]; // Link to mjBizAppsAccountingScheduledJournalEntryLineItems
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: GL Accounts
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingGLAccountInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    AccountType?: string;

    @Field({ nullable: true })
    ParentGLAccountID: string | null;

    @Field({ nullable: true })
    CurrencyCode: string | null;

    @Field({ nullable: true })
    ExternalSystem: string | null;

    @Field({ nullable: true })
    ExternalAccountID: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsSystemSeeded?: boolean;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: GL Accounts
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingGLAccountInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    AccountType?: string;

    @Field({ nullable: true })
    ParentGLAccountID?: string | null;

    @Field({ nullable: true })
    CurrencyCode?: string | null;

    @Field({ nullable: true })
    ExternalSystem?: string | null;

    @Field({ nullable: true })
    ExternalAccountID?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsSystemSeeded?: boolean;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: GL Accounts
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingGLAccountViewResult {
    @Field(() => [mjBizAppsAccountingGLAccount_])
    Results: mjBizAppsAccountingGLAccount_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingGLAccount_)
export class mjBizAppsAccountingGLAccountResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingGLAccountViewResult)
    async RunmjBizAppsAccountingGLAccountViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingGLAccountViewResult)
    async RunmjBizAppsAccountingGLAccountViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingGLAccountViewResult)
    async RunmjBizAppsAccountingGLAccountDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: GL Accounts';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingGLAccount_, { nullable: true })
    async mjBizAppsAccountingGLAccount(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingGLAccount_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: GL Accounts', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwGLAccounts')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: GL Accounts', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: GL Accounts', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingJournalEntryLine_])
    async mjBizAppsAccountingJournalEntryLines_GLAccountIDArray(@Root() mjbizappsaccountingglaccount_: mjBizAppsAccountingGLAccount_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Lines', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryLines')} WHERE ${provider.QuoteIdentifier('GLAccountID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Lines', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccount_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Lines', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingGLAccount_])
    async mjBizAppsAccountingGLAccounts_ParentGLAccountIDArray(@Root() mjbizappsaccountingglaccount_: mjBizAppsAccountingGLAccount_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: GL Accounts', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwGLAccounts')} WHERE ${provider.QuoteIdentifier('ParentGLAccountID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: GL Accounts', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccount_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: GL Accounts', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    async mjBizAppsAccountingAccountingCompanyProfiles_DeferredRevenueGLAccountIDArray(@Root() mjbizappsaccountingglaccount_: mjBizAppsAccountingGLAccount_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Accounting Company Profiles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwAccountingCompanyProfiles')} WHERE ${provider.QuoteIdentifier('DeferredRevenueGLAccountID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Accounting Company Profiles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccount_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Accounting Company Profiles', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    async mjBizAppsAccountingAccountingCompanyProfiles_UnrealizedFXGainLossGLAccountIDArray(@Root() mjbizappsaccountingglaccount_: mjBizAppsAccountingGLAccount_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Accounting Company Profiles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwAccountingCompanyProfiles')} WHERE ${provider.QuoteIdentifier('UnrealizedFXGainLossGLAccountID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Accounting Company Profiles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccount_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Accounting Company Profiles', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    async mjBizAppsAccountingAccountingCompanyProfiles_SalesTaxPayableGLAccountIDArray(@Root() mjbizappsaccountingglaccount_: mjBizAppsAccountingGLAccount_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Accounting Company Profiles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwAccountingCompanyProfiles')} WHERE ${provider.QuoteIdentifier('SalesTaxPayableGLAccountID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Accounting Company Profiles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccount_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Accounting Company Profiles', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    async mjBizAppsAccountingAccountingCompanyProfiles_RealizedFXGainLossGLAccountIDArray(@Root() mjbizappsaccountingglaccount_: mjBizAppsAccountingGLAccount_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Accounting Company Profiles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwAccountingCompanyProfiles')} WHERE ${provider.QuoteIdentifier('RealizedFXGainLossGLAccountID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Accounting Company Profiles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccount_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Accounting Company Profiles', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingAccountingCompanyProfile_])
    async mjBizAppsAccountingAccountingCompanyProfiles_AROpenGLAccountIDArray(@Root() mjbizappsaccountingglaccount_: mjBizAppsAccountingGLAccount_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Accounting Company Profiles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwAccountingCompanyProfiles')} WHERE ${provider.QuoteIdentifier('AROpenGLAccountID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Accounting Company Profiles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccount_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Accounting Company Profiles', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingGLAccountLink_])
    async mjBizAppsAccountingGLAccountLinks_GLAccountIDArray(@Root() mjbizappsaccountingglaccount_: mjBizAppsAccountingGLAccount_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: GL Account Links', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwGLAccountLinks')} WHERE ${provider.QuoteIdentifier('GLAccountID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: GL Account Links', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccount_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: GL Account Links', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingChartOfAccountsMapping_])
    async mjBizAppsAccountingChartOfAccountsMappings_InternalGLAccountIDArray(@Root() mjbizappsaccountingglaccount_: mjBizAppsAccountingGLAccount_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Chart Of Accounts Mappings', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwChartOfAccountsMappings')} WHERE ${provider.QuoteIdentifier('InternalGLAccountID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Chart Of Accounts Mappings', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccount_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Chart Of Accounts Mappings', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingJournalEntryBatchLineItem_])
    async mjBizAppsAccountingJournalEntryBatchLineItems_GLAccountIDArray(@Root() mjbizappsaccountingglaccount_: mjBizAppsAccountingGLAccount_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Batch Line Items', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryBatchLineItems')} WHERE ${provider.QuoteIdentifier('GLAccountID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Batch Line Items', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccount_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Batch Line Items', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingScheduledJournalEntryLineItem_])
    async mjBizAppsAccountingScheduledJournalEntryLineItems_GLAccountIDArray(@Root() mjbizappsaccountingglaccount_: mjBizAppsAccountingGLAccount_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Scheduled Journal Entry Line Items', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwScheduledJournalEntryLineItems')} WHERE ${provider.QuoteIdentifier('GLAccountID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Items', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingglaccount_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Scheduled Journal Entry Line Items', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingGLAccount_)
    async CreatemjBizAppsAccountingGLAccount(
        @Arg('input', () => CreatemjBizAppsAccountingGLAccountInput) input: CreatemjBizAppsAccountingGLAccountInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: GL Accounts', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingGLAccount_)
    async UpdatemjBizAppsAccountingGLAccount(
        @Arg('input', () => UpdatemjBizAppsAccountingGLAccountInput) input: UpdatemjBizAppsAccountingGLAccountInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: GL Accounts', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingGLAccount_)
    async DeletemjBizAppsAccountingGLAccount(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: GL Accounts', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Journal Entries
//****************************************************************************
@ObjectType({ description: `Top-level ledger row. Balanced (Sum Debits = Sum Credits) at the lock event. Immutable after Status transitions to Batched/GLPosted. Lifecycle: Pending → Batched → GLPosted (BA-D6). Reversals happen via NEW Pending JEs with ReversesJournalEntryID set, never by modifying historical rows.` })
export class mjBizAppsAccountingJournalEntry_ {
    @Field({description: `Unique identifier (UUID per BA-D3).`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Gap-free entry number 'JE-{CompanyCode}-{FY}-{seq:000000}' assigned by spAssignNextJournalEntryNumber (BA-D15).`}) 
    @MaxLength(40)
    EntryNumber: string;
        
    @Field({description: `Accounting date for the entry (the ERP assigns its own period at posting).`}) 
    EffectiveDate: Date;
        
    @Field({description: `OrderBooking | PaymentReceipt | RevenueRecognition | CommissionAccrual | PartnerRevShare | IntercompanyFlow | WaterfallDistribution | Refund | Writeoff | Reversal | Manual | TaxRemittance | PeriodEndAccrual | FXRevaluation | OpeningBalance | Adjustment.`}) 
    @MaxLength(40)
    EntryType: string;
        
    @Field({description: `Lifecycle state: Pending | Batched | GLPosted (BA-D6). Locked after Batched; only GLPosted transition and GL-roundtrip fields may change.`}) 
    @MaxLength(20)
    Status: string;
        
    @Field({nullable: true, description: `Free-form human description of the entry.`}) 
    Description?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to a source Order in a downstream app. NO FK. Accounting stores the UUID for audit drill-through but has zero knowledge of Order entities.`}) 
    @MaxLength(36)
    OrderID?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to a source OrderLine. NO FK.`}) 
    @MaxLength(36)
    OrderLineID?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to a source Subscription. NO FK.`}) 
    @MaxLength(36)
    SubscriptionID?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to a source Payment. NO FK.`}) 
    @MaxLength(36)
    PaymentID?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to a source Contract. NO FK.`}) 
    @MaxLength(36)
    ContractID?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to a RevenueRecognitionSchedule. NO FK.`}) 
    @MaxLength(36)
    RevRecScheduleID?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to an IntercompanyFlow record orchestrated upstream. NO FK.`}) 
    @MaxLength(36)
    IntercompanyFlowID?: string;
        
    @Field({nullable: true, description: `When this JE was materialized from a rev-rec / amortization waterfall, the ScheduledJournalEntry that produced it (BA-D25).`}) 
    @MaxLength(36)
    ScheduledJournalEntryID?: string;
        
    @Field({nullable: true, description: `When the JE represents a tax remittance, the remittance record it implements.`}) 
    @MaxLength(36)
    TaxRemittanceID?: string;
        
    @Field({nullable: true, description: `When set, this JE is a reversal of the referenced original JE. EntryType MUST be 'Reversal' (trg_JE_ReversalConsistency).`}) 
    @MaxLength(36)
    ReversesJournalEntryID?: string;
        
    @Field({nullable: true, description: `Back-pointer set on the original JE when a reversal is emitted against it.`}) 
    @MaxLength(36)
    ReversedByJournalEntryID?: string;
        
    @Field({nullable: true, description: `Batch that locked this JE (set when Status transitions to Batched).`}) 
    @MaxLength(36)
    BatchID?: string;
        
    @Field({nullable: true, description: `When the ERP acknowledged the consolidated batch (Status transitions to GLPosted).`}) 
    GLPostedAt?: Date;
        
    @Field({nullable: true, description: `ERP's reference back to us for this JE (within the consolidated batch posting).`}) 
    @MaxLength(100)
    GLReferenceID?: string;
        
    @Field({nullable: true, description: `Optional attached source document (vendor bill PDF, signed contract, supporting workpaper). FK to __mj.File.`}) 
    @MaxLength(36)
    FileID?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(500)
    File?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    RootReversesJournalEntryID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    RootReversedByJournalEntryID?: string;
        
    @Field(() => [mjBizAppsAccountingTaxRemittance_])
    mjBizAppsAccountingTaxRemittances_PostedJournalEntryIDArray: mjBizAppsAccountingTaxRemittance_[]; // Link to mjBizAppsAccountingTaxRemittances
    
    @Field(() => [mjBizAppsAccountingJournalEntryLine_])
    mjBizAppsAccountingJournalEntryLines_JournalEntryIDArray: mjBizAppsAccountingJournalEntryLine_[]; // Link to mjBizAppsAccountingJournalEntryLines
    
    @Field(() => [mjBizAppsAccountingJournalEntryLink_])
    mjBizAppsAccountingJournalEntryLinks_JournalEntryIDArray: mjBizAppsAccountingJournalEntryLink_[]; // Link to mjBizAppsAccountingJournalEntryLinks
    
    @Field(() => [mjBizAppsAccountingJournalEntry_])
    mjBizAppsAccountingJournalEntries_ReversedByJournalEntryIDArray: mjBizAppsAccountingJournalEntry_[]; // Link to mjBizAppsAccountingJournalEntries
    
    @Field(() => [mjBizAppsAccountingJournalEntry_])
    mjBizAppsAccountingJournalEntries_ReversesJournalEntryIDArray: mjBizAppsAccountingJournalEntry_[]; // Link to mjBizAppsAccountingJournalEntries
    
    @Field(() => [mjBizAppsAccountingScheduledJournalEntry_])
    mjBizAppsAccountingScheduledJournalEntries_GeneratedJournalEntryIDArray: mjBizAppsAccountingScheduledJournalEntry_[]; // Link to mjBizAppsAccountingScheduledJournalEntries
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entries
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingJournalEntryInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    EntryNumber?: string;

    @Field({ nullable: true })
    EffectiveDate?: Date;

    @Field({ nullable: true })
    EntryType?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field({ nullable: true })
    OrderID: string | null;

    @Field({ nullable: true })
    OrderLineID: string | null;

    @Field({ nullable: true })
    SubscriptionID: string | null;

    @Field({ nullable: true })
    PaymentID: string | null;

    @Field({ nullable: true })
    ContractID: string | null;

    @Field({ nullable: true })
    RevRecScheduleID: string | null;

    @Field({ nullable: true })
    IntercompanyFlowID: string | null;

    @Field({ nullable: true })
    ScheduledJournalEntryID: string | null;

    @Field({ nullable: true })
    TaxRemittanceID: string | null;

    @Field({ nullable: true })
    ReversesJournalEntryID: string | null;

    @Field({ nullable: true })
    ReversedByJournalEntryID: string | null;

    @Field({ nullable: true })
    BatchID: string | null;

    @Field({ nullable: true })
    GLPostedAt: Date | null;

    @Field({ nullable: true })
    GLReferenceID: string | null;

    @Field({ nullable: true })
    FileID: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entries
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingJournalEntryInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    EntryNumber?: string;

    @Field({ nullable: true })
    EffectiveDate?: Date;

    @Field({ nullable: true })
    EntryType?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field({ nullable: true })
    OrderID?: string | null;

    @Field({ nullable: true })
    OrderLineID?: string | null;

    @Field({ nullable: true })
    SubscriptionID?: string | null;

    @Field({ nullable: true })
    PaymentID?: string | null;

    @Field({ nullable: true })
    ContractID?: string | null;

    @Field({ nullable: true })
    RevRecScheduleID?: string | null;

    @Field({ nullable: true })
    IntercompanyFlowID?: string | null;

    @Field({ nullable: true })
    ScheduledJournalEntryID?: string | null;

    @Field({ nullable: true })
    TaxRemittanceID?: string | null;

    @Field({ nullable: true })
    ReversesJournalEntryID?: string | null;

    @Field({ nullable: true })
    ReversedByJournalEntryID?: string | null;

    @Field({ nullable: true })
    BatchID?: string | null;

    @Field({ nullable: true })
    GLPostedAt?: Date | null;

    @Field({ nullable: true })
    GLReferenceID?: string | null;

    @Field({ nullable: true })
    FileID?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Journal Entries
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingJournalEntryViewResult {
    @Field(() => [mjBizAppsAccountingJournalEntry_])
    Results: mjBizAppsAccountingJournalEntry_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingJournalEntry_)
export class mjBizAppsAccountingJournalEntryResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingJournalEntryViewResult)
    async RunmjBizAppsAccountingJournalEntryViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryViewResult)
    async RunmjBizAppsAccountingJournalEntryViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryViewResult)
    async RunmjBizAppsAccountingJournalEntryDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Journal Entries';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingJournalEntry_, { nullable: true })
    async mjBizAppsAccountingJournalEntry(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingJournalEntry_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entries', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntries')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entries', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entries', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingTaxRemittance_])
    async mjBizAppsAccountingTaxRemittances_PostedJournalEntryIDArray(@Root() mjbizappsaccountingjournalentry_: mjBizAppsAccountingJournalEntry_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Tax Remittances', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwTaxRemittances')} WHERE ${provider.QuoteIdentifier('PostedJournalEntryID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Tax Remittances', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingjournalentry_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Tax Remittances', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingJournalEntryLine_])
    async mjBizAppsAccountingJournalEntryLines_JournalEntryIDArray(@Root() mjbizappsaccountingjournalentry_: mjBizAppsAccountingJournalEntry_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Lines', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryLines')} WHERE ${provider.QuoteIdentifier('JournalEntryID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Lines', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingjournalentry_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Lines', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingJournalEntryLink_])
    async mjBizAppsAccountingJournalEntryLinks_JournalEntryIDArray(@Root() mjbizappsaccountingjournalentry_: mjBizAppsAccountingJournalEntry_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Links', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryLinks')} WHERE ${provider.QuoteIdentifier('JournalEntryID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Links', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingjournalentry_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Links', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingJournalEntry_])
    async mjBizAppsAccountingJournalEntries_ReversedByJournalEntryIDArray(@Root() mjbizappsaccountingjournalentry_: mjBizAppsAccountingJournalEntry_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entries', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntries')} WHERE ${provider.QuoteIdentifier('ReversedByJournalEntryID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entries', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingjournalentry_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entries', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingJournalEntry_])
    async mjBizAppsAccountingJournalEntries_ReversesJournalEntryIDArray(@Root() mjbizappsaccountingjournalentry_: mjBizAppsAccountingJournalEntry_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entries', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntries')} WHERE ${provider.QuoteIdentifier('ReversesJournalEntryID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entries', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingjournalentry_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entries', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingScheduledJournalEntry_])
    async mjBizAppsAccountingScheduledJournalEntries_GeneratedJournalEntryIDArray(@Root() mjbizappsaccountingjournalentry_: mjBizAppsAccountingJournalEntry_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Scheduled Journal Entries', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwScheduledJournalEntries')} WHERE ${provider.QuoteIdentifier('GeneratedJournalEntryID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Scheduled Journal Entries', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingjournalentry_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Scheduled Journal Entries', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntry_)
    async CreatemjBizAppsAccountingJournalEntry(
        @Arg('input', () => CreatemjBizAppsAccountingJournalEntryInput) input: CreatemjBizAppsAccountingJournalEntryInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Journal Entries', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntry_)
    async UpdatemjBizAppsAccountingJournalEntry(
        @Arg('input', () => UpdatemjBizAppsAccountingJournalEntryInput) input: UpdatemjBizAppsAccountingJournalEntryInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Journal Entries', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntry_)
    async DeletemjBizAppsAccountingJournalEntry(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Journal Entries', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions
//****************************************************************************
@ObjectType({ description: `Dimension tag on a batch summary line. Preserves the analytical breakdown through to the ERP so departmental/segment financials survive summarization (BA-D26).` })
export class mjBizAppsAccountingJournalEntryBatchLineDimension_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Batch summary line being tagged.`}) 
    @MaxLength(36)
    JournalEntryBatchLineItemID: string;
        
    @Field({description: `Dimension being applied.`}) 
    @MaxLength(36)
    DimensionID: string;
        
    @Field({description: `Value of that dimension on this line.`}) 
    @MaxLength(36)
    DimensionValueID: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(100)
    Dimension: string;
        
    @Field() 
    @MaxLength(200)
    DimensionValue: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingJournalEntryBatchLineDimensionInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    JournalEntryBatchLineItemID?: string;

    @Field({ nullable: true })
    DimensionID?: string;

    @Field({ nullable: true })
    DimensionValueID?: string;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingJournalEntryBatchLineDimensionInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    JournalEntryBatchLineItemID?: string;

    @Field({ nullable: true })
    DimensionID?: string;

    @Field({ nullable: true })
    DimensionValueID?: string;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingJournalEntryBatchLineDimensionViewResult {
    @Field(() => [mjBizAppsAccountingJournalEntryBatchLineDimension_])
    Results: mjBizAppsAccountingJournalEntryBatchLineDimension_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingJournalEntryBatchLineDimension_)
export class mjBizAppsAccountingJournalEntryBatchLineDimensionResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingJournalEntryBatchLineDimensionViewResult)
    async RunmjBizAppsAccountingJournalEntryBatchLineDimensionViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryBatchLineDimensionViewResult)
    async RunmjBizAppsAccountingJournalEntryBatchLineDimensionViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryBatchLineDimensionViewResult)
    async RunmjBizAppsAccountingJournalEntryBatchLineDimensionDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingJournalEntryBatchLineDimension_, { nullable: true })
    async mjBizAppsAccountingJournalEntryBatchLineDimension(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingJournalEntryBatchLineDimension_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryBatchLineDimensions')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryBatchLineDimension_)
    async CreatemjBizAppsAccountingJournalEntryBatchLineDimension(
        @Arg('input', () => CreatemjBizAppsAccountingJournalEntryBatchLineDimensionInput) input: CreatemjBizAppsAccountingJournalEntryBatchLineDimensionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntryBatchLineDimension_)
    async UpdatemjBizAppsAccountingJournalEntryBatchLineDimension(
        @Arg('input', () => UpdatemjBizAppsAccountingJournalEntryBatchLineDimensionInput) input: UpdatemjBizAppsAccountingJournalEntryBatchLineDimensionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryBatchLineDimension_)
    async DeletemjBizAppsAccountingJournalEntryBatchLineDimension(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Journal Entry Batch Line Items
//****************************************************************************
@ObjectType({ description: `Consolidated summary line shipped to the ERP: the locked JE lines in a batch aggregated by GLAccount × dimension combo × side (BA-D16/BA-D26). The JournalEntryLine detail stays for drill-through; this is the netted GL movement that posts.` })
export class mjBizAppsAccountingJournalEntryBatchLineItem_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Batch this summary line belongs to.`}) 
    @MaxLength(36)
    BatchID: string;
        
    @Field({description: `Company whose books this line posts to (one batch = one Company per BA-D16).`}) 
    @MaxLength(36)
    CompanyID: string;
        
    @Field({description: `GLAccount this consolidated movement hits.`}) 
    @MaxLength(36)
    GLAccountID: string;
        
    @Field(() => Int, {description: `Line ordering within the batch (1-based).`}) 
    LineNumber: number;
        
    @Field(() => Float, {nullable: true, description: `Summed debit for this account × dimension combo (NULL if a credit line).`}) 
    DebitAmount?: number;
        
    @Field(() => Float, {nullable: true, description: `Summed credit for this account × dimension combo (NULL if a debit line).`}) 
    CreditAmount?: number;
        
    @Field(() => Int, {description: `How many JournalEntryLine rows rolled up into this summary line (audit aid).`}) 
    SourceLineCount: number;
        
    @Field({nullable: true, description: `Target ERP account code resolved via ChartOfAccountsMapping at batch time.`}) 
    @MaxLength(100)
    ExternalAccountID?: string;
        
    @Field({nullable: true, description: `Optional memo on the consolidated line.`}) 
    Description?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(50)
    Company: string;
        
    @Field() 
    @MaxLength(200)
    GLAccount: string;
        
    @Field(() => [mjBizAppsAccountingJournalEntryBatchLineDimension_])
    mjBizAppsAccountingJournalEntryBatchLineDimensions_JournalEntryBatchLineItemIDArray: mjBizAppsAccountingJournalEntryBatchLineDimension_[]; // Link to mjBizAppsAccountingJournalEntryBatchLineDimensions
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Batch Line Items
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingJournalEntryBatchLineItemInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    BatchID?: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    GLAccountID?: string;

    @Field(() => Int, { nullable: true })
    LineNumber?: number;

    @Field(() => Float, { nullable: true })
    DebitAmount: number | null;

    @Field(() => Float, { nullable: true })
    CreditAmount: number | null;

    @Field(() => Int, { nullable: true })
    SourceLineCount?: number;

    @Field({ nullable: true })
    ExternalAccountID: string | null;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Batch Line Items
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingJournalEntryBatchLineItemInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    BatchID?: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    GLAccountID?: string;

    @Field(() => Int, { nullable: true })
    LineNumber?: number;

    @Field(() => Float, { nullable: true })
    DebitAmount?: number | null;

    @Field(() => Float, { nullable: true })
    CreditAmount?: number | null;

    @Field(() => Int, { nullable: true })
    SourceLineCount?: number;

    @Field({ nullable: true })
    ExternalAccountID?: string | null;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Journal Entry Batch Line Items
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingJournalEntryBatchLineItemViewResult {
    @Field(() => [mjBizAppsAccountingJournalEntryBatchLineItem_])
    Results: mjBizAppsAccountingJournalEntryBatchLineItem_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingJournalEntryBatchLineItem_)
export class mjBizAppsAccountingJournalEntryBatchLineItemResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingJournalEntryBatchLineItemViewResult)
    async RunmjBizAppsAccountingJournalEntryBatchLineItemViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryBatchLineItemViewResult)
    async RunmjBizAppsAccountingJournalEntryBatchLineItemViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryBatchLineItemViewResult)
    async RunmjBizAppsAccountingJournalEntryBatchLineItemDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Journal Entry Batch Line Items';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingJournalEntryBatchLineItem_, { nullable: true })
    async mjBizAppsAccountingJournalEntryBatchLineItem(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingJournalEntryBatchLineItem_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Batch Line Items', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryBatchLineItems')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Batch Line Items', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Batch Line Items', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingJournalEntryBatchLineDimension_])
    async mjBizAppsAccountingJournalEntryBatchLineDimensions_JournalEntryBatchLineItemIDArray(@Root() mjbizappsaccountingjournalentrybatchlineitem_: mjBizAppsAccountingJournalEntryBatchLineItem_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryBatchLineDimensions')} WHERE ${provider.QuoteIdentifier('JournalEntryBatchLineItemID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingjournalentrybatchlineitem_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntryBatchLineItem_)
    async CreatemjBizAppsAccountingJournalEntryBatchLineItem(
        @Arg('input', () => CreatemjBizAppsAccountingJournalEntryBatchLineItemInput) input: CreatemjBizAppsAccountingJournalEntryBatchLineItemInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Journal Entry Batch Line Items', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntryBatchLineItem_)
    async UpdatemjBizAppsAccountingJournalEntryBatchLineItem(
        @Arg('input', () => UpdatemjBizAppsAccountingJournalEntryBatchLineItemInput) input: UpdatemjBizAppsAccountingJournalEntryBatchLineItemInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Journal Entry Batch Line Items', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryBatchLineItem_)
    async DeletemjBizAppsAccountingJournalEntryBatchLineItem(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Journal Entry Batch Line Items', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Journal Entry Batch Sequences
//****************************************************************************
@ObjectType({ description: `GLOBAL singleton counter backing gap-free JournalEntryBatch numbering (D-SEQ 2026-07-06: batches are multi-company). One row, ID = 1. Consumed only by spAssignNextBatchNumber.` })
export class mjBizAppsAccountingJournalEntryBatchSequence_ {
    @Field(() => Int) 
    ID: number;
        
    @Field(() => Int) 
    NextSequenceNumber: number;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Batch Sequences
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingJournalEntryBatchSequenceInput {
    @Field(() => Int, { nullable: true })
    ID?: number;

    @Field(() => Int, { nullable: true })
    NextSequenceNumber?: number;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Batch Sequences
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingJournalEntryBatchSequenceInput {
    @Field(() => Int)
    ID: number;

    @Field(() => Int, { nullable: true })
    NextSequenceNumber?: number;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Journal Entry Batch Sequences
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingJournalEntryBatchSequenceViewResult {
    @Field(() => [mjBizAppsAccountingJournalEntryBatchSequence_])
    Results: mjBizAppsAccountingJournalEntryBatchSequence_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingJournalEntryBatchSequence_)
export class mjBizAppsAccountingJournalEntryBatchSequenceResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingJournalEntryBatchSequenceViewResult)
    async RunmjBizAppsAccountingJournalEntryBatchSequenceViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryBatchSequenceViewResult)
    async RunmjBizAppsAccountingJournalEntryBatchSequenceViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryBatchSequenceViewResult)
    async RunmjBizAppsAccountingJournalEntryBatchSequenceDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Journal Entry Batch Sequences';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingJournalEntryBatchSequence_, { nullable: true })
    async mjBizAppsAccountingJournalEntryBatchSequence(@Arg('ID', () => Int) ID: number, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingJournalEntryBatchSequence_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Batch Sequences', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryBatchSequences')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Batch Sequences', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Batch Sequences', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryBatchSequence_)
    async CreatemjBizAppsAccountingJournalEntryBatchSequence(
        @Arg('input', () => CreatemjBizAppsAccountingJournalEntryBatchSequenceInput) input: CreatemjBizAppsAccountingJournalEntryBatchSequenceInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Journal Entry Batch Sequences', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntryBatchSequence_)
    async UpdatemjBizAppsAccountingJournalEntryBatchSequence(
        @Arg('input', () => UpdatemjBizAppsAccountingJournalEntryBatchSequenceInput) input: UpdatemjBizAppsAccountingJournalEntryBatchSequenceInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Journal Entry Batch Sequences', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryBatchSequence_)
    async DeletemjBizAppsAccountingJournalEntryBatchSequence(@Arg('ID', () => Int) ID: number, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Journal Entry Batch Sequences', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Journal Entry Batches
//****************************************************************************
@ObjectType({ description: `Aggregation event that ships Pending JEs to the external ERP for the period. Per BA-D16, batching IS the locking event — JEs cannot be modified after they are referenced by a Batched row.` })
export class mjBizAppsAccountingJournalEntryBatch_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Gap-free batch number assigned by spAssignNextBatchNumber. Format 'BATCH-{CompanyCode}-{seq:000000}'.`}) 
    @MaxLength(40)
    BatchNumber: string;
        
    @Field({description: `Target ERP for this batch: BusinessCentral | QuickBooks | NetSuite | Sage | Xero | Other.`}) 
    @MaxLength(50)
    TargetSystem: string;
        
    @Field({description: `When the batch was created (Pending JEs flipped to Batched).`}) 
    BatchedAt: Date;
        
    @Field({description: `User (or system identity for scheduled runs) that performed the batch.`}) 
    @MaxLength(36)
    BatchedByUserID: string;
        
    @Field({description: `Lifecycle: Pending | Approved | Sent | Posted | Failed | Cancelled. Pending is mutable/deletable; Approved locks content (human sign-off); Posted = the ERP confirmed posting; Failed triggers retry + escalation; Cancelled is terminal from Pending or unsent Approved (trg_JEBatch_Immutability).`}) 
    @MaxLength(20)
    Status: string;
        
    @Field(() => Int, {description: `Count of JE rows in this batch (denormalized for fast batch dashboards).`}) 
    TotalEntries: number;
        
    @Field(() => Float, {description: `Sum of debits across all JE lines in the batch (functional currency).`}) 
    TotalDebits: number;
        
    @Field(() => Float, {description: `Sum of credits across all JE lines in the batch (functional currency).`}) 
    TotalCredits: number;
        
    @Field({nullable: true, description: `ERP's reference returned on send (used to correlate the consolidated JE posted in the ERP).`}) 
    @MaxLength(100)
    ExternalBatchRef?: string;
        
    @Field({nullable: true, description: `When a human approved the batch for dispatch (locks its content; the new Approved status).`}) 
    ApprovedAt?: Date;
        
    @Field({nullable: true, description: `The user who approved the batch (see AccountingCompanyProfile.ApprovalCFOPersonID / the bizapps-tasks approval gate).`}) 
    @MaxLength(36)
    ApprovedByUserID?: string;
        
    @Field({nullable: true, description: `When the batch was sent to the ERP.`}) 
    SentAt?: Date;
        
    @Field({nullable: true, description: `When the ERP confirmed it posted the batch (Status=Posted; renames the old AcknowledgedAt).`}) 
    PostedAt?: Date;
        
    @Field({nullable: true, description: `Error message from a Failed send. JEs revert to Pending for retry.`}) 
    ErrorMessage?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(100)
    BatchedByUser: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    ApprovedByUser?: string;
        
    @Field(() => [mjBizAppsAccountingJournalEntry_])
    mjBizAppsAccountingJournalEntries_BatchIDArray: mjBizAppsAccountingJournalEntry_[]; // Link to mjBizAppsAccountingJournalEntries
    
    @Field(() => [mjBizAppsAccountingJournalEntryBatchLineItem_])
    mjBizAppsAccountingJournalEntryBatchLineItems_BatchIDArray: mjBizAppsAccountingJournalEntryBatchLineItem_[]; // Link to mjBizAppsAccountingJournalEntryBatchLineItems
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Batches
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingJournalEntryBatchInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    BatchNumber?: string;

    @Field({ nullable: true })
    TargetSystem?: string;

    @Field({ nullable: true })
    BatchedAt?: Date;

    @Field({ nullable: true })
    BatchedByUserID?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => Int, { nullable: true })
    TotalEntries?: number;

    @Field(() => Float, { nullable: true })
    TotalDebits?: number;

    @Field(() => Float, { nullable: true })
    TotalCredits?: number;

    @Field({ nullable: true })
    ExternalBatchRef: string | null;

    @Field({ nullable: true })
    ApprovedAt: Date | null;

    @Field({ nullable: true })
    ApprovedByUserID: string | null;

    @Field({ nullable: true })
    SentAt: Date | null;

    @Field({ nullable: true })
    PostedAt: Date | null;

    @Field({ nullable: true })
    ErrorMessage: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Batches
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingJournalEntryBatchInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    BatchNumber?: string;

    @Field({ nullable: true })
    TargetSystem?: string;

    @Field({ nullable: true })
    BatchedAt?: Date;

    @Field({ nullable: true })
    BatchedByUserID?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => Int, { nullable: true })
    TotalEntries?: number;

    @Field(() => Float, { nullable: true })
    TotalDebits?: number;

    @Field(() => Float, { nullable: true })
    TotalCredits?: number;

    @Field({ nullable: true })
    ExternalBatchRef?: string | null;

    @Field({ nullable: true })
    ApprovedAt?: Date | null;

    @Field({ nullable: true })
    ApprovedByUserID?: string | null;

    @Field({ nullable: true })
    SentAt?: Date | null;

    @Field({ nullable: true })
    PostedAt?: Date | null;

    @Field({ nullable: true })
    ErrorMessage?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Journal Entry Batches
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingJournalEntryBatchViewResult {
    @Field(() => [mjBizAppsAccountingJournalEntryBatch_])
    Results: mjBizAppsAccountingJournalEntryBatch_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingJournalEntryBatch_)
export class mjBizAppsAccountingJournalEntryBatchResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingJournalEntryBatchViewResult)
    async RunmjBizAppsAccountingJournalEntryBatchViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryBatchViewResult)
    async RunmjBizAppsAccountingJournalEntryBatchViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryBatchViewResult)
    async RunmjBizAppsAccountingJournalEntryBatchDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Journal Entry Batches';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingJournalEntryBatch_, { nullable: true })
    async mjBizAppsAccountingJournalEntryBatch(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingJournalEntryBatch_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Batches', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryBatches')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Batches', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Batches', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingJournalEntry_])
    async mjBizAppsAccountingJournalEntries_BatchIDArray(@Root() mjbizappsaccountingjournalentrybatch_: mjBizAppsAccountingJournalEntryBatch_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entries', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntries')} WHERE ${provider.QuoteIdentifier('BatchID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entries', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingjournalentrybatch_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entries', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingJournalEntryBatchLineItem_])
    async mjBizAppsAccountingJournalEntryBatchLineItems_BatchIDArray(@Root() mjbizappsaccountingjournalentrybatch_: mjBizAppsAccountingJournalEntryBatch_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Batch Line Items', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryBatchLineItems')} WHERE ${provider.QuoteIdentifier('BatchID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Batch Line Items', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingjournalentrybatch_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Batch Line Items', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntryBatch_)
    async CreatemjBizAppsAccountingJournalEntryBatch(
        @Arg('input', () => CreatemjBizAppsAccountingJournalEntryBatchInput) input: CreatemjBizAppsAccountingJournalEntryBatchInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Journal Entry Batches', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntryBatch_)
    async UpdatemjBizAppsAccountingJournalEntryBatch(
        @Arg('input', () => UpdatemjBizAppsAccountingJournalEntryBatchInput) input: UpdatemjBizAppsAccountingJournalEntryBatchInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Journal Entry Batches', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryBatch_)
    async DeletemjBizAppsAccountingJournalEntryBatch(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Journal Entry Batches', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Journal Entry Line Dimensions
//****************************************************************************
@ObjectType({ description: `Many-to-many between JournalEntryLine and (Dimension, DimensionValue). Optional — lines without any dimension rows are simply un-tagged. Reports filter and group by dimension via this table.` })
export class mjBizAppsAccountingJournalEntryLineDimension_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `JE line being tagged.`}) 
    @MaxLength(36)
    JournalEntryLineID: string;
        
    @Field({description: `Dimension being applied. UNIQUE per (Line, Dimension) so a line cannot have two values for the same dimension.`}) 
    @MaxLength(36)
    DimensionID: string;
        
    @Field({description: `Value chosen for the dimension on this line.`}) 
    @MaxLength(36)
    DimensionValueID: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(100)
    Dimension: string;
        
    @Field() 
    @MaxLength(200)
    DimensionValue: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Line Dimensions
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingJournalEntryLineDimensionInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    JournalEntryLineID?: string;

    @Field({ nullable: true })
    DimensionID?: string;

    @Field({ nullable: true })
    DimensionValueID?: string;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Line Dimensions
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingJournalEntryLineDimensionInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    JournalEntryLineID?: string;

    @Field({ nullable: true })
    DimensionID?: string;

    @Field({ nullable: true })
    DimensionValueID?: string;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Journal Entry Line Dimensions
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingJournalEntryLineDimensionViewResult {
    @Field(() => [mjBizAppsAccountingJournalEntryLineDimension_])
    Results: mjBizAppsAccountingJournalEntryLineDimension_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingJournalEntryLineDimension_)
export class mjBizAppsAccountingJournalEntryLineDimensionResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingJournalEntryLineDimensionViewResult)
    async RunmjBizAppsAccountingJournalEntryLineDimensionViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryLineDimensionViewResult)
    async RunmjBizAppsAccountingJournalEntryLineDimensionViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryLineDimensionViewResult)
    async RunmjBizAppsAccountingJournalEntryLineDimensionDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingJournalEntryLineDimension_, { nullable: true })
    async mjBizAppsAccountingJournalEntryLineDimension(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingJournalEntryLineDimension_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Line Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryLineDimensions')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Line Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Line Dimensions', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryLineDimension_)
    async CreatemjBizAppsAccountingJournalEntryLineDimension(
        @Arg('input', () => CreatemjBizAppsAccountingJournalEntryLineDimensionInput) input: CreatemjBizAppsAccountingJournalEntryLineDimensionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Journal Entry Line Dimensions', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntryLineDimension_)
    async UpdatemjBizAppsAccountingJournalEntryLineDimension(
        @Arg('input', () => UpdatemjBizAppsAccountingJournalEntryLineDimensionInput) input: UpdatemjBizAppsAccountingJournalEntryLineDimensionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Journal Entry Line Dimensions', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryLineDimension_)
    async DeletemjBizAppsAccountingJournalEntryLineDimension(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Journal Entry Line Dimensions', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Journal Entry Lines
//****************************************************************************
@ObjectType({ description: `A debit or credit line under a JournalEntry. Exactly one of DebitAmount/CreditAmount is set per row (CK_JEL_OneSide). Multi-currency aware: OriginalCurrencyCode/OriginalDebit/OriginalCredit/ExchangeRateUsed capture the source-transaction currency when different from the Company\'s functional currency.` })
export class mjBizAppsAccountingJournalEntryLine_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Parent JournalEntry.`}) 
    @MaxLength(36)
    JournalEntryID: string;
        
    @Field(() => Int, {description: `1-based ordering of lines within the parent JE.`}) 
    LineNumber: number;
        
    @Field({description: `GLAccount this line posts to.`}) 
    @MaxLength(36)
    GLAccountID: string;
        
    @Field(() => Float, {nullable: true, description: `Debit amount in the Company's FUNCTIONAL currency. Mutually exclusive with CreditAmount (CK_JEL_OneSide).`}) 
    DebitAmount?: number;
        
    @Field(() => Float, {nullable: true, description: `Credit amount in the Company's FUNCTIONAL currency. Mutually exclusive with DebitAmount.`}) 
    CreditAmount?: number;
        
    @Field({nullable: true, description: `ISO 4217 code of the SOURCE-transaction currency (the customer-facing one). NULL when the source is already the functional currency.`}) 
    @MaxLength(3)
    OriginalCurrencyCode?: string;
        
    @Field(() => Float, {nullable: true, description: `Debit amount in the original currency (paired with OriginalCurrencyCode + ExchangeRateUsed).`}) 
    OriginalDebitAmount?: number;
        
    @Field(() => Float, {nullable: true, description: `Credit amount in the original currency.`}) 
    OriginalCreditAmount?: number;
        
    @Field(() => Float, {nullable: true, description: `Exchange rate (functional per 1 original) used at booking time. Required when an original amount is present.`}) 
    ExchangeRateUsed?: number;
        
    @Field({nullable: true, description: `Free-form description of the line (memo).`}) 
    Description?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to source OrderLine. NO FK.`}) 
    @MaxLength(36)
    OrderLineID?: string;
        
    @Field({nullable: true, description: `For AR-side lines, the Customer Organization. FK to __mj_BizAppsCommon.Organization.`}) 
    @MaxLength(36)
    CounterpartyOrganizationID?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(200)
    GLAccount: string;
        
    @Field({nullable: true}) 
    @MaxLength(80)
    OriginalCurrencyCode_Virtual?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    CounterpartyOrganization?: string;
        
    @Field(() => [mjBizAppsAccountingJournalEntryLineDimension_])
    mjBizAppsAccountingJournalEntryLineDimensions_JournalEntryLineIDArray: mjBizAppsAccountingJournalEntryLineDimension_[]; // Link to mjBizAppsAccountingJournalEntryLineDimensions
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Lines
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingJournalEntryLineInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    JournalEntryID?: string;

    @Field(() => Int, { nullable: true })
    LineNumber?: number;

    @Field({ nullable: true })
    GLAccountID?: string;

    @Field(() => Float, { nullable: true })
    DebitAmount: number | null;

    @Field(() => Float, { nullable: true })
    CreditAmount: number | null;

    @Field({ nullable: true })
    OriginalCurrencyCode: string | null;

    @Field(() => Float, { nullable: true })
    OriginalDebitAmount: number | null;

    @Field(() => Float, { nullable: true })
    OriginalCreditAmount: number | null;

    @Field(() => Float, { nullable: true })
    ExchangeRateUsed: number | null;

    @Field({ nullable: true })
    Description: string | null;

    @Field({ nullable: true })
    OrderLineID: string | null;

    @Field({ nullable: true })
    CounterpartyOrganizationID: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Lines
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingJournalEntryLineInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    JournalEntryID?: string;

    @Field(() => Int, { nullable: true })
    LineNumber?: number;

    @Field({ nullable: true })
    GLAccountID?: string;

    @Field(() => Float, { nullable: true })
    DebitAmount?: number | null;

    @Field(() => Float, { nullable: true })
    CreditAmount?: number | null;

    @Field({ nullable: true })
    OriginalCurrencyCode?: string | null;

    @Field(() => Float, { nullable: true })
    OriginalDebitAmount?: number | null;

    @Field(() => Float, { nullable: true })
    OriginalCreditAmount?: number | null;

    @Field(() => Float, { nullable: true })
    ExchangeRateUsed?: number | null;

    @Field({ nullable: true })
    Description?: string | null;

    @Field({ nullable: true })
    OrderLineID?: string | null;

    @Field({ nullable: true })
    CounterpartyOrganizationID?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Journal Entry Lines
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingJournalEntryLineViewResult {
    @Field(() => [mjBizAppsAccountingJournalEntryLine_])
    Results: mjBizAppsAccountingJournalEntryLine_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingJournalEntryLine_)
export class mjBizAppsAccountingJournalEntryLineResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingJournalEntryLineViewResult)
    async RunmjBizAppsAccountingJournalEntryLineViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryLineViewResult)
    async RunmjBizAppsAccountingJournalEntryLineViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryLineViewResult)
    async RunmjBizAppsAccountingJournalEntryLineDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Journal Entry Lines';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingJournalEntryLine_, { nullable: true })
    async mjBizAppsAccountingJournalEntryLine(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingJournalEntryLine_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Lines', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryLines')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Lines', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Lines', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingJournalEntryLineDimension_])
    async mjBizAppsAccountingJournalEntryLineDimensions_JournalEntryLineIDArray(@Root() mjbizappsaccountingjournalentryline_: mjBizAppsAccountingJournalEntryLine_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Line Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryLineDimensions')} WHERE ${provider.QuoteIdentifier('JournalEntryLineID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Line Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingjournalentryline_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Line Dimensions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntryLine_)
    async CreatemjBizAppsAccountingJournalEntryLine(
        @Arg('input', () => CreatemjBizAppsAccountingJournalEntryLineInput) input: CreatemjBizAppsAccountingJournalEntryLineInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Journal Entry Lines', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntryLine_)
    async UpdatemjBizAppsAccountingJournalEntryLine(
        @Arg('input', () => UpdatemjBizAppsAccountingJournalEntryLineInput) input: UpdatemjBizAppsAccountingJournalEntryLineInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Journal Entry Lines', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryLine_)
    async DeletemjBizAppsAccountingJournalEntryLine(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Journal Entry Lines', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Journal Entry Links
//****************************************************************************
@ObjectType({ description: `Polymorphic link from a JournalEntry to any MJ entity record (order/payment/invoice lineage, supporting documents, etc.). EntityID references __mj.Entity; RecordID is the target primary key (NVARCHAR(400) supports stringified composite keys). Upstream apps populate these; Accounting stores them for lineage/drill-through.` })
export class mjBizAppsAccountingJournalEntryLink_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(36)
    JournalEntryID: string;
        
    @Field() 
    @MaxLength(36)
    EntityID: string;
        
    @Field() 
    @MaxLength(400)
    RecordID: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    LinkType?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(255)
    Entity: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Links
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingJournalEntryLinkInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    JournalEntryID?: string;

    @Field({ nullable: true })
    EntityID?: string;

    @Field({ nullable: true })
    RecordID?: string;

    @Field({ nullable: true })
    LinkType: string | null;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Links
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingJournalEntryLinkInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    JournalEntryID?: string;

    @Field({ nullable: true })
    EntityID?: string;

    @Field({ nullable: true })
    RecordID?: string;

    @Field({ nullable: true })
    LinkType?: string | null;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Journal Entry Links
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingJournalEntryLinkViewResult {
    @Field(() => [mjBizAppsAccountingJournalEntryLink_])
    Results: mjBizAppsAccountingJournalEntryLink_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingJournalEntryLink_)
export class mjBizAppsAccountingJournalEntryLinkResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingJournalEntryLinkViewResult)
    async RunmjBizAppsAccountingJournalEntryLinkViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryLinkViewResult)
    async RunmjBizAppsAccountingJournalEntryLinkViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryLinkViewResult)
    async RunmjBizAppsAccountingJournalEntryLinkDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Journal Entry Links';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingJournalEntryLink_, { nullable: true })
    async mjBizAppsAccountingJournalEntryLink(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingJournalEntryLink_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Links', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryLinks')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Links', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Links', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryLink_)
    async CreatemjBizAppsAccountingJournalEntryLink(
        @Arg('input', () => CreatemjBizAppsAccountingJournalEntryLinkInput) input: CreatemjBizAppsAccountingJournalEntryLinkInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Journal Entry Links', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntryLink_)
    async UpdatemjBizAppsAccountingJournalEntryLink(
        @Arg('input', () => UpdatemjBizAppsAccountingJournalEntryLinkInput) input: UpdatemjBizAppsAccountingJournalEntryLinkInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Journal Entry Links', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryLink_)
    async DeletemjBizAppsAccountingJournalEntryLink(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Journal Entry Links', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Journal Entry Sequences
//****************************************************************************
@ObjectType({ description: `GLOBAL per-fiscal-year counter backing gap-free JournalEntry numbering (D-SEQ 2026-07-06: JEs are multi-company, so numbering is not company-scoped). Consumed only by spAssignNextJournalEntryNumber.` })
export class mjBizAppsAccountingJournalEntrySequence_ {
    @Field(() => Int) 
    FiscalYear: number;
        
    @Field(() => Int) 
    NextSequenceNumber: number;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Sequences
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingJournalEntrySequenceInput {
    @Field(() => Int, { nullable: true })
    FiscalYear?: number;

    @Field(() => Int, { nullable: true })
    NextSequenceNumber?: number;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Sequences
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingJournalEntrySequenceInput {
    @Field(() => Int)
    FiscalYear: number;

    @Field(() => Int, { nullable: true })
    NextSequenceNumber?: number;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Journal Entry Sequences
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingJournalEntrySequenceViewResult {
    @Field(() => [mjBizAppsAccountingJournalEntrySequence_])
    Results: mjBizAppsAccountingJournalEntrySequence_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingJournalEntrySequence_)
export class mjBizAppsAccountingJournalEntrySequenceResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingJournalEntrySequenceViewResult)
    async RunmjBizAppsAccountingJournalEntrySequenceViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntrySequenceViewResult)
    async RunmjBizAppsAccountingJournalEntrySequenceViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntrySequenceViewResult)
    async RunmjBizAppsAccountingJournalEntrySequenceDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Journal Entry Sequences';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingJournalEntrySequence_, { nullable: true })
    async mjBizAppsAccountingJournalEntrySequence(@Arg('FiscalYear', () => Int) FiscalYear: number, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingJournalEntrySequence_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Sequences', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntrySequences')} WHERE ${provider.QuoteIdentifier('FiscalYear')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Sequences', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [FiscalYear], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Sequences', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntrySequence_)
    async CreatemjBizAppsAccountingJournalEntrySequence(
        @Arg('input', () => CreatemjBizAppsAccountingJournalEntrySequenceInput) input: CreatemjBizAppsAccountingJournalEntrySequenceInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Journal Entry Sequences', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntrySequence_)
    async UpdatemjBizAppsAccountingJournalEntrySequence(
        @Arg('input', () => UpdatemjBizAppsAccountingJournalEntrySequenceInput) input: UpdatemjBizAppsAccountingJournalEntrySequenceInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Journal Entry Sequences', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntrySequence_)
    async DeletemjBizAppsAccountingJournalEntrySequence(@Arg('FiscalYear', () => Int) FiscalYear: number, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'FiscalYear', Value: FiscalYear}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Journal Entry Sequences', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Scheduled Journal Entries
//****************************************************************************
@ObjectType({ description: `A pre-computed FUTURE journal entry in a revenue-recognition / amortization waterfall (BA-D25). Amounts are known up front; the schedule is computed upstream (BizAppsOrders) and persisted here. The period-close engine materializes each row into a real Pending JournalEntry on its target period.` })
export class mjBizAppsAccountingScheduledJournalEntry_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Company that owns this scheduled entry.`}) 
    @MaxLength(36)
    CompanyID: string;
        
    @Field({description: `RevenueRecognition | DeferredRevenueRelease | PrepaidAmortization | DepreciationAccrual | PeriodEndAccrual | Manual. Becomes the materialized JE's EntryType.`}) 
    @MaxLength(40)
    EntryType: string;
        
    @Field({description: `Scheduled | Generated | Cancelled | Superseded. Frozen once Generated (trg_SJE_Immutability).`}) 
    @MaxLength(20)
    Status: string;
        
    @Field(() => Int, {description: `1-based position in the waterfall (the "3" of "3 of 12").`}) 
    ScheduleSequence: number;
        
    @Field(() => Int, {description: `Total number of entries in this schedule (the "12").`}) 
    ScheduleCount: number;
        
    @Field({description: `Accounting date the materialized JE will bear (typically period-end).`}) 
    ScheduledEffectiveDate: Date;
        
    @Field({description: `Currency of TotalAmount and the line amounts.`}) 
    @MaxLength(3)
    CurrencyCode: string;
        
    @Field(() => Float, {description: `Gross amount recognized by this entry; lines carry the Dr/Cr detail. Front-loaded rounding (extra pennies in sequence 1) is reflected here per row.`}) 
    TotalAmount: number;
        
    @Field({nullable: true, description: `Free-form description.`}) 
    Description?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to the originating Subscription (BizAppsOrders). NO FK.`}) 
    @MaxLength(36)
    SubscriptionID?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to the SubscriptionTerm that generated this schedule. NO FK.`}) 
    @MaxLength(36)
    SubscriptionTermID?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to the originating Order. NO FK.`}) 
    @MaxLength(36)
    OrderID?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to the originating OrderLine. NO FK.`}) 
    @MaxLength(36)
    OrderLineID?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to the originating Contract. NO FK.`}) 
    @MaxLength(36)
    ContractID?: string;
        
    @Field({nullable: true, description: `Soft polymorphic ref to the upstream RevenueRecognitionSchedule. NO FK.`}) 
    @MaxLength(36)
    RevRecScheduleID?: string;
        
    @Field({nullable: true, description: `The JournalEntry produced when this row materialized (set with Status=Generated).`}) 
    @MaxLength(36)
    GeneratedJournalEntryID?: string;
        
    @Field({nullable: true, description: `When this row materialized into a JournalEntry.`}) 
    GeneratedAt?: Date;
        
    @Field({nullable: true, description: `When a renewal/amendment recomputed the remaining schedule, the ScheduledJournalEntry that replaced this one (Status=Superseded).`}) 
    @MaxLength(36)
    SupersededByScheduledJournalEntryID?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(50)
    Company: string;
        
    @Field() 
    @MaxLength(80)
    CurrencyCode_Virtual: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    RootSupersededByScheduledJournalEntryID?: string;
        
    @Field(() => [mjBizAppsAccountingJournalEntry_])
    mjBizAppsAccountingJournalEntries_ScheduledJournalEntryIDArray: mjBizAppsAccountingJournalEntry_[]; // Link to mjBizAppsAccountingJournalEntries
    
    @Field(() => [mjBizAppsAccountingScheduledJournalEntryLineItem_])
    mjBizAppsAccountingScheduledJournalEntryLineItems_ScheduledJournalEntryIDArray: mjBizAppsAccountingScheduledJournalEntryLineItem_[]; // Link to mjBizAppsAccountingScheduledJournalEntryLineItems
    
    @Field(() => [mjBizAppsAccountingScheduledJournalEntry_])
    mjBizAppsAccountingScheduledJournalEntries_SupersededByScheduledJournalEntryIDArray: mjBizAppsAccountingScheduledJournalEntry_[]; // Link to mjBizAppsAccountingScheduledJournalEntries
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Scheduled Journal Entries
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingScheduledJournalEntryInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    EntryType?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => Int, { nullable: true })
    ScheduleSequence?: number;

    @Field(() => Int, { nullable: true })
    ScheduleCount?: number;

    @Field({ nullable: true })
    ScheduledEffectiveDate?: Date;

    @Field({ nullable: true })
    CurrencyCode?: string;

    @Field(() => Float, { nullable: true })
    TotalAmount?: number;

    @Field({ nullable: true })
    Description: string | null;

    @Field({ nullable: true })
    SubscriptionID: string | null;

    @Field({ nullable: true })
    SubscriptionTermID: string | null;

    @Field({ nullable: true })
    OrderID: string | null;

    @Field({ nullable: true })
    OrderLineID: string | null;

    @Field({ nullable: true })
    ContractID: string | null;

    @Field({ nullable: true })
    RevRecScheduleID: string | null;

    @Field({ nullable: true })
    GeneratedJournalEntryID: string | null;

    @Field({ nullable: true })
    GeneratedAt: Date | null;

    @Field({ nullable: true })
    SupersededByScheduledJournalEntryID: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Scheduled Journal Entries
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingScheduledJournalEntryInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    EntryType?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => Int, { nullable: true })
    ScheduleSequence?: number;

    @Field(() => Int, { nullable: true })
    ScheduleCount?: number;

    @Field({ nullable: true })
    ScheduledEffectiveDate?: Date;

    @Field({ nullable: true })
    CurrencyCode?: string;

    @Field(() => Float, { nullable: true })
    TotalAmount?: number;

    @Field({ nullable: true })
    Description?: string | null;

    @Field({ nullable: true })
    SubscriptionID?: string | null;

    @Field({ nullable: true })
    SubscriptionTermID?: string | null;

    @Field({ nullable: true })
    OrderID?: string | null;

    @Field({ nullable: true })
    OrderLineID?: string | null;

    @Field({ nullable: true })
    ContractID?: string | null;

    @Field({ nullable: true })
    RevRecScheduleID?: string | null;

    @Field({ nullable: true })
    GeneratedJournalEntryID?: string | null;

    @Field({ nullable: true })
    GeneratedAt?: Date | null;

    @Field({ nullable: true })
    SupersededByScheduledJournalEntryID?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Scheduled Journal Entries
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingScheduledJournalEntryViewResult {
    @Field(() => [mjBizAppsAccountingScheduledJournalEntry_])
    Results: mjBizAppsAccountingScheduledJournalEntry_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingScheduledJournalEntry_)
export class mjBizAppsAccountingScheduledJournalEntryResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingScheduledJournalEntryViewResult)
    async RunmjBizAppsAccountingScheduledJournalEntryViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingScheduledJournalEntryViewResult)
    async RunmjBizAppsAccountingScheduledJournalEntryViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingScheduledJournalEntryViewResult)
    async RunmjBizAppsAccountingScheduledJournalEntryDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Scheduled Journal Entries';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingScheduledJournalEntry_, { nullable: true })
    async mjBizAppsAccountingScheduledJournalEntry(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingScheduledJournalEntry_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Scheduled Journal Entries', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwScheduledJournalEntries')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Scheduled Journal Entries', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Scheduled Journal Entries', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingJournalEntry_])
    async mjBizAppsAccountingJournalEntries_ScheduledJournalEntryIDArray(@Root() mjbizappsaccountingscheduledjournalentry_: mjBizAppsAccountingScheduledJournalEntry_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entries', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntries')} WHERE ${provider.QuoteIdentifier('ScheduledJournalEntryID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entries', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingscheduledjournalentry_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entries', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingScheduledJournalEntryLineItem_])
    async mjBizAppsAccountingScheduledJournalEntryLineItems_ScheduledJournalEntryIDArray(@Root() mjbizappsaccountingscheduledjournalentry_: mjBizAppsAccountingScheduledJournalEntry_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Scheduled Journal Entry Line Items', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwScheduledJournalEntryLineItems')} WHERE ${provider.QuoteIdentifier('ScheduledJournalEntryID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Items', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingscheduledjournalentry_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Scheduled Journal Entry Line Items', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingScheduledJournalEntry_])
    async mjBizAppsAccountingScheduledJournalEntries_SupersededByScheduledJournalEntryIDArray(@Root() mjbizappsaccountingscheduledjournalentry_: mjBizAppsAccountingScheduledJournalEntry_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Scheduled Journal Entries', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwScheduledJournalEntries')} WHERE ${provider.QuoteIdentifier('SupersededByScheduledJournalEntryID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Scheduled Journal Entries', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingscheduledjournalentry_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Scheduled Journal Entries', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingScheduledJournalEntry_)
    async CreatemjBizAppsAccountingScheduledJournalEntry(
        @Arg('input', () => CreatemjBizAppsAccountingScheduledJournalEntryInput) input: CreatemjBizAppsAccountingScheduledJournalEntryInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Scheduled Journal Entries', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingScheduledJournalEntry_)
    async UpdatemjBizAppsAccountingScheduledJournalEntry(
        @Arg('input', () => UpdatemjBizAppsAccountingScheduledJournalEntryInput) input: UpdatemjBizAppsAccountingScheduledJournalEntryInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Scheduled Journal Entries', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingScheduledJournalEntry_)
    async DeletemjBizAppsAccountingScheduledJournalEntry(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Scheduled Journal Entries', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions
//****************************************************************************
@ObjectType({ description: `Analytical tag on a scheduled line; carried through to the materialized JournalEntryLineDimension.` })
export class mjBizAppsAccountingScheduledJournalEntryLineDimension_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Scheduled line being tagged.`}) 
    @MaxLength(36)
    ScheduledJournalEntryLineItemID: string;
        
    @Field({description: `Dimension being applied.`}) 
    @MaxLength(36)
    DimensionID: string;
        
    @Field({description: `Value of that dimension on this line.`}) 
    @MaxLength(36)
    DimensionValueID: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(100)
    Dimension: string;
        
    @Field() 
    @MaxLength(200)
    DimensionValue: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingScheduledJournalEntryLineDimensionInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    ScheduledJournalEntryLineItemID?: string;

    @Field({ nullable: true })
    DimensionID?: string;

    @Field({ nullable: true })
    DimensionValueID?: string;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingScheduledJournalEntryLineDimensionInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    ScheduledJournalEntryLineItemID?: string;

    @Field({ nullable: true })
    DimensionID?: string;

    @Field({ nullable: true })
    DimensionValueID?: string;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingScheduledJournalEntryLineDimensionViewResult {
    @Field(() => [mjBizAppsAccountingScheduledJournalEntryLineDimension_])
    Results: mjBizAppsAccountingScheduledJournalEntryLineDimension_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingScheduledJournalEntryLineDimension_)
export class mjBizAppsAccountingScheduledJournalEntryLineDimensionResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingScheduledJournalEntryLineDimensionViewResult)
    async RunmjBizAppsAccountingScheduledJournalEntryLineDimensionViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingScheduledJournalEntryLineDimensionViewResult)
    async RunmjBizAppsAccountingScheduledJournalEntryLineDimensionViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingScheduledJournalEntryLineDimensionViewResult)
    async RunmjBizAppsAccountingScheduledJournalEntryLineDimensionDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingScheduledJournalEntryLineDimension_, { nullable: true })
    async mjBizAppsAccountingScheduledJournalEntryLineDimension(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingScheduledJournalEntryLineDimension_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwScheduledJournalEntryLineDimensions')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingScheduledJournalEntryLineDimension_)
    async CreatemjBizAppsAccountingScheduledJournalEntryLineDimension(
        @Arg('input', () => CreatemjBizAppsAccountingScheduledJournalEntryLineDimensionInput) input: CreatemjBizAppsAccountingScheduledJournalEntryLineDimensionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingScheduledJournalEntryLineDimension_)
    async UpdatemjBizAppsAccountingScheduledJournalEntryLineDimension(
        @Arg('input', () => UpdatemjBizAppsAccountingScheduledJournalEntryLineDimensionInput) input: UpdatemjBizAppsAccountingScheduledJournalEntryLineDimensionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingScheduledJournalEntryLineDimension_)
    async DeletemjBizAppsAccountingScheduledJournalEntryLineDimension(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Scheduled Journal Entry Line Items
//****************************************************************************
@ObjectType({ description: `Dr/Cr shape of a scheduled entry; copied verbatim onto the materialized JournalEntryLine.` })
export class mjBizAppsAccountingScheduledJournalEntryLineItem_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Parent scheduled entry.`}) 
    @MaxLength(36)
    ScheduledJournalEntryID: string;
        
    @Field(() => Int, {description: `Line ordering (1-based).`}) 
    LineNumber: number;
        
    @Field({description: `GLAccount this line posts to.`}) 
    @MaxLength(36)
    GLAccountID: string;
        
    @Field(() => Float, {nullable: true, description: `Debit amount (NULL if a credit line).`}) 
    DebitAmount?: number;
        
    @Field(() => Float, {nullable: true, description: `Credit amount (NULL if a debit line).`}) 
    CreditAmount?: number;
        
    @Field({nullable: true, description: `Optional memo.`}) 
    Description?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(200)
    GLAccount: string;
        
    @Field(() => [mjBizAppsAccountingScheduledJournalEntryLineDimension_])
    mjBizAppsAccountingScheduledJournalEntryLineDimensions_ScheduledJournalEntryLineItemIDArray: mjBizAppsAccountingScheduledJournalEntryLineDimension_[]; // Link to mjBizAppsAccountingScheduledJournalEntryLineDimensions
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Scheduled Journal Entry Line Items
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingScheduledJournalEntryLineItemInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    ScheduledJournalEntryID?: string;

    @Field(() => Int, { nullable: true })
    LineNumber?: number;

    @Field({ nullable: true })
    GLAccountID?: string;

    @Field(() => Float, { nullable: true })
    DebitAmount: number | null;

    @Field(() => Float, { nullable: true })
    CreditAmount: number | null;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Scheduled Journal Entry Line Items
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingScheduledJournalEntryLineItemInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    ScheduledJournalEntryID?: string;

    @Field(() => Int, { nullable: true })
    LineNumber?: number;

    @Field({ nullable: true })
    GLAccountID?: string;

    @Field(() => Float, { nullable: true })
    DebitAmount?: number | null;

    @Field(() => Float, { nullable: true })
    CreditAmount?: number | null;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Scheduled Journal Entry Line Items
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingScheduledJournalEntryLineItemViewResult {
    @Field(() => [mjBizAppsAccountingScheduledJournalEntryLineItem_])
    Results: mjBizAppsAccountingScheduledJournalEntryLineItem_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingScheduledJournalEntryLineItem_)
export class mjBizAppsAccountingScheduledJournalEntryLineItemResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingScheduledJournalEntryLineItemViewResult)
    async RunmjBizAppsAccountingScheduledJournalEntryLineItemViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingScheduledJournalEntryLineItemViewResult)
    async RunmjBizAppsAccountingScheduledJournalEntryLineItemViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingScheduledJournalEntryLineItemViewResult)
    async RunmjBizAppsAccountingScheduledJournalEntryLineItemDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Items';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingScheduledJournalEntryLineItem_, { nullable: true })
    async mjBizAppsAccountingScheduledJournalEntryLineItem(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingScheduledJournalEntryLineItem_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Scheduled Journal Entry Line Items', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwScheduledJournalEntryLineItems')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Items', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Scheduled Journal Entry Line Items', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingScheduledJournalEntryLineDimension_])
    async mjBizAppsAccountingScheduledJournalEntryLineDimensions_ScheduledJournalEntryLineItemIDArray(@Root() mjbizappsaccountingscheduledjournalentrylineitem_: mjBizAppsAccountingScheduledJournalEntryLineItem_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwScheduledJournalEntryLineDimensions')} WHERE ${provider.QuoteIdentifier('ScheduledJournalEntryLineItemID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingscheduledjournalentrylineitem_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingScheduledJournalEntryLineItem_)
    async CreatemjBizAppsAccountingScheduledJournalEntryLineItem(
        @Arg('input', () => CreatemjBizAppsAccountingScheduledJournalEntryLineItemInput) input: CreatemjBizAppsAccountingScheduledJournalEntryLineItemInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Scheduled Journal Entry Line Items', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingScheduledJournalEntryLineItem_)
    async UpdatemjBizAppsAccountingScheduledJournalEntryLineItem(
        @Arg('input', () => UpdatemjBizAppsAccountingScheduledJournalEntryLineItemInput) input: UpdatemjBizAppsAccountingScheduledJournalEntryLineItemInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Scheduled Journal Entry Line Items', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingScheduledJournalEntryLineItem_)
    async DeletemjBizAppsAccountingScheduledJournalEntryLineItem(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Scheduled Journal Entry Line Items', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Tax Authorities
//****************************************************************************
@ObjectType({ description: `Taxing body — federal, state, or sub-national authority that levies and collects tax. Examples: US-IRS, CA-BOE, EU-VAT-DE.` })
export class mjBizAppsAccountingTaxAuthority_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Globally unique authority code, e.g. 'US-IRS', 'CA-BOE', 'EU-VAT-DE'.`}) 
    @MaxLength(40)
    Code: string;
        
    @Field({description: `Display name for the authority.`}) 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true, description: `ISO 3166-1 alpha-2 country code for the authority's primary jurisdiction.`}) 
    @MaxLength(2)
    CountryCode?: string;
        
    @Field(() => Boolean, {description: `Whether this authority is currently active.`}) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsAccountingTaxJurisdiction_])
    mjBizAppsAccountingTaxJurisdictions_TaxAuthorityIDArray: mjBizAppsAccountingTaxJurisdiction_[]; // Link to mjBizAppsAccountingTaxJurisdictions
    
    @Field(() => [mjBizAppsAccountingTaxLiability_])
    mjBizAppsAccountingTaxLiabilities_TaxAuthorityIDArray: mjBizAppsAccountingTaxLiability_[]; // Link to mjBizAppsAccountingTaxLiabilities
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Tax Authorities
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingTaxAuthorityInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    CountryCode: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Tax Authorities
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingTaxAuthorityInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    CountryCode?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Tax Authorities
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingTaxAuthorityViewResult {
    @Field(() => [mjBizAppsAccountingTaxAuthority_])
    Results: mjBizAppsAccountingTaxAuthority_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingTaxAuthority_)
export class mjBizAppsAccountingTaxAuthorityResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingTaxAuthorityViewResult)
    async RunmjBizAppsAccountingTaxAuthorityViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingTaxAuthorityViewResult)
    async RunmjBizAppsAccountingTaxAuthorityViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingTaxAuthorityViewResult)
    async RunmjBizAppsAccountingTaxAuthorityDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Tax Authorities';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingTaxAuthority_, { nullable: true })
    async mjBizAppsAccountingTaxAuthority(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingTaxAuthority_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Tax Authorities', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwTaxAuthorities')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Tax Authorities', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Tax Authorities', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingTaxJurisdiction_])
    async mjBizAppsAccountingTaxJurisdictions_TaxAuthorityIDArray(@Root() mjbizappsaccountingtaxauthority_: mjBizAppsAccountingTaxAuthority_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Tax Jurisdictions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwTaxJurisdictions')} WHERE ${provider.QuoteIdentifier('TaxAuthorityID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Tax Jurisdictions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingtaxauthority_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Tax Jurisdictions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingTaxLiability_])
    async mjBizAppsAccountingTaxLiabilities_TaxAuthorityIDArray(@Root() mjbizappsaccountingtaxauthority_: mjBizAppsAccountingTaxAuthority_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Tax Liabilities', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwTaxLiabilities')} WHERE ${provider.QuoteIdentifier('TaxAuthorityID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Tax Liabilities', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingtaxauthority_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Tax Liabilities', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingTaxAuthority_)
    async CreatemjBizAppsAccountingTaxAuthority(
        @Arg('input', () => CreatemjBizAppsAccountingTaxAuthorityInput) input: CreatemjBizAppsAccountingTaxAuthorityInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Tax Authorities', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingTaxAuthority_)
    async UpdatemjBizAppsAccountingTaxAuthority(
        @Arg('input', () => UpdatemjBizAppsAccountingTaxAuthorityInput) input: UpdatemjBizAppsAccountingTaxAuthorityInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Tax Authorities', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingTaxAuthority_)
    async DeletemjBizAppsAccountingTaxAuthority(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Tax Authorities', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Tax Jurisdictions
//****************************************************************************
@ObjectType({ description: `Geographic scope within a TaxAuthority. May nest (state → county → city) via ParentTaxJurisdictionID. Used to look up the applicable TaxRate for a transaction.` })
export class mjBizAppsAccountingTaxJurisdiction_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `TaxAuthority this jurisdiction belongs to.`}) 
    @MaxLength(36)
    TaxAuthorityID: string;
        
    @Field({description: `Globally unique jurisdiction code.`}) 
    @MaxLength(80)
    Code: string;
        
    @Field({description: `Display name (e.g. 'California State', 'Los Angeles County').`}) 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true, description: `ISO 3166-1 alpha-2 country code.`}) 
    @MaxLength(2)
    CountryCode?: string;
        
    @Field({nullable: true, description: `State/province sub-national region, free-form (e.g. 'CA', 'NSW', 'Bavaria').`}) 
    @MaxLength(50)
    RegionCode?: string;
        
    @Field({nullable: true, description: `Specific postal code scoping (if exact match required).`}) 
    @MaxLength(20)
    PostalCode?: string;
        
    @Field({nullable: true, description: `Start of postal-code range when the jurisdiction covers a contiguous range.`}) 
    @MaxLength(20)
    PostalCodeStart?: string;
        
    @Field({nullable: true, description: `End of postal-code range.`}) 
    @MaxLength(20)
    PostalCodeEnd?: string;
        
    @Field({nullable: true, description: `City name scoping (if the jurisdiction is city-specific).`}) 
    @MaxLength(200)
    CityName?: string;
        
    @Field({nullable: true, description: `Parent jurisdiction for nested scopes (e.g. county inside state).`}) 
    @MaxLength(36)
    ParentTaxJurisdictionID?: string;
        
    @Field(() => Boolean, {description: `Whether this jurisdiction is currently active.`}) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(200)
    TaxAuthority: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    ParentTaxJurisdiction?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    RootParentTaxJurisdictionID?: string;
        
    @Field(() => [mjBizAppsAccountingTaxJurisdiction_])
    mjBizAppsAccountingTaxJurisdictions_ParentTaxJurisdictionIDArray: mjBizAppsAccountingTaxJurisdiction_[]; // Link to mjBizAppsAccountingTaxJurisdictions
    
    @Field(() => [mjBizAppsAccountingCustomerTaxProfile_])
    mjBizAppsAccountingCustomerTaxProfiles_TaxJurisdictionIDArray: mjBizAppsAccountingCustomerTaxProfile_[]; // Link to mjBizAppsAccountingCustomerTaxProfiles
    
    @Field(() => [mjBizAppsAccountingTaxLiability_])
    mjBizAppsAccountingTaxLiabilities_TaxJurisdictionIDArray: mjBizAppsAccountingTaxLiability_[]; // Link to mjBizAppsAccountingTaxLiabilities
    
    @Field(() => [mjBizAppsAccountingTaxRate_])
    mjBizAppsAccountingTaxRates_TaxJurisdictionIDArray: mjBizAppsAccountingTaxRate_[]; // Link to mjBizAppsAccountingTaxRates
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Tax Jurisdictions
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingTaxJurisdictionInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    TaxAuthorityID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    CountryCode: string | null;

    @Field({ nullable: true })
    RegionCode: string | null;

    @Field({ nullable: true })
    PostalCode: string | null;

    @Field({ nullable: true })
    PostalCodeStart: string | null;

    @Field({ nullable: true })
    PostalCodeEnd: string | null;

    @Field({ nullable: true })
    CityName: string | null;

    @Field({ nullable: true })
    ParentTaxJurisdictionID: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Tax Jurisdictions
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingTaxJurisdictionInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    TaxAuthorityID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    CountryCode?: string | null;

    @Field({ nullable: true })
    RegionCode?: string | null;

    @Field({ nullable: true })
    PostalCode?: string | null;

    @Field({ nullable: true })
    PostalCodeStart?: string | null;

    @Field({ nullable: true })
    PostalCodeEnd?: string | null;

    @Field({ nullable: true })
    CityName?: string | null;

    @Field({ nullable: true })
    ParentTaxJurisdictionID?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Tax Jurisdictions
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingTaxJurisdictionViewResult {
    @Field(() => [mjBizAppsAccountingTaxJurisdiction_])
    Results: mjBizAppsAccountingTaxJurisdiction_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingTaxJurisdiction_)
export class mjBizAppsAccountingTaxJurisdictionResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingTaxJurisdictionViewResult)
    async RunmjBizAppsAccountingTaxJurisdictionViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingTaxJurisdictionViewResult)
    async RunmjBizAppsAccountingTaxJurisdictionViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingTaxJurisdictionViewResult)
    async RunmjBizAppsAccountingTaxJurisdictionDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Tax Jurisdictions';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingTaxJurisdiction_, { nullable: true })
    async mjBizAppsAccountingTaxJurisdiction(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingTaxJurisdiction_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Tax Jurisdictions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwTaxJurisdictions')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Tax Jurisdictions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Tax Jurisdictions', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingTaxJurisdiction_])
    async mjBizAppsAccountingTaxJurisdictions_ParentTaxJurisdictionIDArray(@Root() mjbizappsaccountingtaxjurisdiction_: mjBizAppsAccountingTaxJurisdiction_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Tax Jurisdictions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwTaxJurisdictions')} WHERE ${provider.QuoteIdentifier('ParentTaxJurisdictionID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Tax Jurisdictions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingtaxjurisdiction_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Tax Jurisdictions', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingCustomerTaxProfile_])
    async mjBizAppsAccountingCustomerTaxProfiles_TaxJurisdictionIDArray(@Root() mjbizappsaccountingtaxjurisdiction_: mjBizAppsAccountingTaxJurisdiction_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Customer Tax Profiles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwCustomerTaxProfiles')} WHERE ${provider.QuoteIdentifier('TaxJurisdictionID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Customer Tax Profiles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingtaxjurisdiction_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Customer Tax Profiles', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingTaxLiability_])
    async mjBizAppsAccountingTaxLiabilities_TaxJurisdictionIDArray(@Root() mjbizappsaccountingtaxjurisdiction_: mjBizAppsAccountingTaxJurisdiction_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Tax Liabilities', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwTaxLiabilities')} WHERE ${provider.QuoteIdentifier('TaxJurisdictionID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Tax Liabilities', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingtaxjurisdiction_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Tax Liabilities', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsAccountingTaxRate_])
    async mjBizAppsAccountingTaxRates_TaxJurisdictionIDArray(@Root() mjbizappsaccountingtaxjurisdiction_: mjBizAppsAccountingTaxJurisdiction_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Tax Rates', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwTaxRates')} WHERE ${provider.QuoteIdentifier('TaxJurisdictionID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Tax Rates', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingtaxjurisdiction_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Tax Rates', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingTaxJurisdiction_)
    async CreatemjBizAppsAccountingTaxJurisdiction(
        @Arg('input', () => CreatemjBizAppsAccountingTaxJurisdictionInput) input: CreatemjBizAppsAccountingTaxJurisdictionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Tax Jurisdictions', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingTaxJurisdiction_)
    async UpdatemjBizAppsAccountingTaxJurisdiction(
        @Arg('input', () => UpdatemjBizAppsAccountingTaxJurisdictionInput) input: UpdatemjBizAppsAccountingTaxJurisdictionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Tax Jurisdictions', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingTaxJurisdiction_)
    async DeletemjBizAppsAccountingTaxJurisdiction(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Tax Jurisdictions', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Tax Liabilities
//****************************************************************************
@ObjectType({ description: `Open tax liability balance per (Company × Authority × Jurisdiction × Period). Accrued from JE postings; paid down via TaxRemittance records.` })
export class mjBizAppsAccountingTaxLiability_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Company this liability belongs to.`}) 
    @MaxLength(36)
    CompanyID: string;
        
    @Field({description: `TaxAuthority owed.`}) 
    @MaxLength(36)
    TaxAuthorityID: string;
        
    @Field({description: `TaxJurisdiction the liability is scoped to.`}) 
    @MaxLength(36)
    TaxJurisdictionID: string;
        
    @Field(() => Float, {description: `Total tax accrued during the period (in functional currency).`}) 
    AccruedAmount: number;
        
    @Field(() => Float, {description: `Total amount remitted against this liability so far.`}) 
    RemittedAmount: number;
        
    @Field({description: `Lifecycle: Open | Filed | Paid | PartiallyPaid.`}) 
    @MaxLength(20)
    Status: string;
        
    @Field({nullable: true, description: `Statutory due date for filing/remittance.`}) 
    DueDate?: Date;
        
    @Field({nullable: true, description: `Filing cadence: Monthly | Quarterly | SemiAnnual | Annual | OnDemand.`}) 
    @MaxLength(20)
    FilingFrequency?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(50)
    Company: string;
        
    @Field() 
    @MaxLength(200)
    TaxAuthority: string;
        
    @Field() 
    @MaxLength(200)
    TaxJurisdiction: string;
        
    @Field(() => [mjBizAppsAccountingTaxRemittance_])
    mjBizAppsAccountingTaxRemittances_TaxLiabilityIDArray: mjBizAppsAccountingTaxRemittance_[]; // Link to mjBizAppsAccountingTaxRemittances
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Tax Liabilities
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingTaxLiabilityInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    TaxAuthorityID?: string;

    @Field({ nullable: true })
    TaxJurisdictionID?: string;

    @Field(() => Float, { nullable: true })
    AccruedAmount?: number;

    @Field(() => Float, { nullable: true })
    RemittedAmount?: number;

    @Field({ nullable: true })
    Status?: string;

    @Field({ nullable: true })
    DueDate: Date | null;

    @Field({ nullable: true })
    FilingFrequency: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Tax Liabilities
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingTaxLiabilityInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    TaxAuthorityID?: string;

    @Field({ nullable: true })
    TaxJurisdictionID?: string;

    @Field(() => Float, { nullable: true })
    AccruedAmount?: number;

    @Field(() => Float, { nullable: true })
    RemittedAmount?: number;

    @Field({ nullable: true })
    Status?: string;

    @Field({ nullable: true })
    DueDate?: Date | null;

    @Field({ nullable: true })
    FilingFrequency?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Tax Liabilities
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingTaxLiabilityViewResult {
    @Field(() => [mjBizAppsAccountingTaxLiability_])
    Results: mjBizAppsAccountingTaxLiability_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingTaxLiability_)
export class mjBizAppsAccountingTaxLiabilityResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingTaxLiabilityViewResult)
    async RunmjBizAppsAccountingTaxLiabilityViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingTaxLiabilityViewResult)
    async RunmjBizAppsAccountingTaxLiabilityViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingTaxLiabilityViewResult)
    async RunmjBizAppsAccountingTaxLiabilityDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Tax Liabilities';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingTaxLiability_, { nullable: true })
    async mjBizAppsAccountingTaxLiability(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingTaxLiability_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Tax Liabilities', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwTaxLiabilities')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Tax Liabilities', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Tax Liabilities', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingTaxRemittance_])
    async mjBizAppsAccountingTaxRemittances_TaxLiabilityIDArray(@Root() mjbizappsaccountingtaxliability_: mjBizAppsAccountingTaxLiability_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Tax Remittances', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwTaxRemittances')} WHERE ${provider.QuoteIdentifier('TaxLiabilityID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Tax Remittances', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingtaxliability_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Tax Remittances', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingTaxLiability_)
    async CreatemjBizAppsAccountingTaxLiability(
        @Arg('input', () => CreatemjBizAppsAccountingTaxLiabilityInput) input: CreatemjBizAppsAccountingTaxLiabilityInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Tax Liabilities', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingTaxLiability_)
    async UpdatemjBizAppsAccountingTaxLiability(
        @Arg('input', () => UpdatemjBizAppsAccountingTaxLiabilityInput) input: UpdatemjBizAppsAccountingTaxLiabilityInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Tax Liabilities', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingTaxLiability_)
    async DeletemjBizAppsAccountingTaxLiability(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Tax Liabilities', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Tax Rates
//****************************************************************************
@ObjectType({ description: `Rate applicable to a jurisdiction × category × effective range. Populated manually for simple cases or auto-synced from Avalara/TaxJar (per BA-D19).` })
export class mjBizAppsAccountingTaxRate_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Jurisdiction this rate applies to.`}) 
    @MaxLength(36)
    TaxJurisdictionID: string;
        
    @Field({description: `Tax category: Standard | Reduced | Zero | Exempt | Custom.`}) 
    @MaxLength(50)
    TaxCategory: string;
        
    @Field(() => Float, {description: `Rate as a decimal fraction. 0.0825 = 8.25%.`}) 
    Rate: number;
        
    @Field({description: `Earliest date this rate is effective.`}) 
    EffectiveFrom: Date;
        
    @Field({nullable: true, description: `Last date this rate is effective (NULL = open-ended).`}) 
    EffectiveTo?: Date;
        
    @Field({description: `Source of the rate: Avalara | TaxJar | Manual.`}) 
    @MaxLength(50)
    Source: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(200)
    TaxJurisdiction: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Tax Rates
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingTaxRateInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    TaxJurisdictionID?: string;

    @Field({ nullable: true })
    TaxCategory?: string;

    @Field(() => Float, { nullable: true })
    Rate?: number;

    @Field({ nullable: true })
    EffectiveFrom?: Date;

    @Field({ nullable: true })
    EffectiveTo: Date | null;

    @Field({ nullable: true })
    Source?: string;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Tax Rates
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingTaxRateInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    TaxJurisdictionID?: string;

    @Field({ nullable: true })
    TaxCategory?: string;

    @Field(() => Float, { nullable: true })
    Rate?: number;

    @Field({ nullable: true })
    EffectiveFrom?: Date;

    @Field({ nullable: true })
    EffectiveTo?: Date | null;

    @Field({ nullable: true })
    Source?: string;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Tax Rates
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingTaxRateViewResult {
    @Field(() => [mjBizAppsAccountingTaxRate_])
    Results: mjBizAppsAccountingTaxRate_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingTaxRate_)
export class mjBizAppsAccountingTaxRateResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingTaxRateViewResult)
    async RunmjBizAppsAccountingTaxRateViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingTaxRateViewResult)
    async RunmjBizAppsAccountingTaxRateViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingTaxRateViewResult)
    async RunmjBizAppsAccountingTaxRateDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Tax Rates';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingTaxRate_, { nullable: true })
    async mjBizAppsAccountingTaxRate(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingTaxRate_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Tax Rates', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwTaxRates')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Tax Rates', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Tax Rates', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingTaxRate_)
    async CreatemjBizAppsAccountingTaxRate(
        @Arg('input', () => CreatemjBizAppsAccountingTaxRateInput) input: CreatemjBizAppsAccountingTaxRateInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Tax Rates', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingTaxRate_)
    async UpdatemjBizAppsAccountingTaxRate(
        @Arg('input', () => UpdatemjBizAppsAccountingTaxRateInput) input: UpdatemjBizAppsAccountingTaxRateInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Tax Rates', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingTaxRate_)
    async DeletemjBizAppsAccountingTaxRate(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Tax Rates', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Tax Remittances
//****************************************************************************
@ObjectType({ description: `A payment made against a TaxLiability. Generates a JE of EntryType=TaxRemittance via PostedJournalEntryID.` })
export class mjBizAppsAccountingTaxRemittance_ {
    @Field({description: `Unique identifier.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Liability this payment is against.`}) 
    @MaxLength(36)
    TaxLiabilityID: string;
        
    @Field(() => Float, {description: `Amount remitted (functional currency).`}) 
    RemittedAmount: number;
        
    @Field({description: `Date the remittance was paid.`}) 
    RemittedDate: Date;
        
    @Field({nullable: true, description: `External payment reference (wire ID, check number, confirmation code).`}) 
    @MaxLength(100)
    PaymentReference?: string;
        
    @Field({nullable: true, description: `JE that records this remittance.`}) 
    @MaxLength(36)
    PostedJournalEntryID?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsAccountingJournalEntry_])
    mjBizAppsAccountingJournalEntries_TaxRemittanceIDArray: mjBizAppsAccountingJournalEntry_[]; // Link to mjBizAppsAccountingJournalEntries
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Tax Remittances
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingTaxRemittanceInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    TaxLiabilityID?: string;

    @Field(() => Float, { nullable: true })
    RemittedAmount?: number;

    @Field({ nullable: true })
    RemittedDate?: Date;

    @Field({ nullable: true })
    PaymentReference: string | null;

    @Field({ nullable: true })
    PostedJournalEntryID: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Tax Remittances
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingTaxRemittanceInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    TaxLiabilityID?: string;

    @Field(() => Float, { nullable: true })
    RemittedAmount?: number;

    @Field({ nullable: true })
    RemittedDate?: Date;

    @Field({ nullable: true })
    PaymentReference?: string | null;

    @Field({ nullable: true })
    PostedJournalEntryID?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Tax Remittances
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingTaxRemittanceViewResult {
    @Field(() => [mjBizAppsAccountingTaxRemittance_])
    Results: mjBizAppsAccountingTaxRemittance_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsAccountingTaxRemittance_)
export class mjBizAppsAccountingTaxRemittanceResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingTaxRemittanceViewResult)
    async RunmjBizAppsAccountingTaxRemittanceViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingTaxRemittanceViewResult)
    async RunmjBizAppsAccountingTaxRemittanceViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingTaxRemittanceViewResult)
    async RunmjBizAppsAccountingTaxRemittanceDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Tax Remittances';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingTaxRemittance_, { nullable: true })
    async mjBizAppsAccountingTaxRemittance(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingTaxRemittance_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Tax Remittances', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwTaxRemittances')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Tax Remittances', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Tax Remittances', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsAccountingJournalEntry_])
    async mjBizAppsAccountingJournalEntries_TaxRemittanceIDArray(@Root() mjbizappsaccountingtaxremittance_: mjBizAppsAccountingTaxRemittance_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entries', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntries')} WHERE ${provider.QuoteIdentifier('TaxRemittanceID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entries', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappsaccountingtaxremittance_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entries', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsAccountingTaxRemittance_)
    async CreatemjBizAppsAccountingTaxRemittance(
        @Arg('input', () => CreatemjBizAppsAccountingTaxRemittanceInput) input: CreatemjBizAppsAccountingTaxRemittanceInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Tax Remittances', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingTaxRemittance_)
    async UpdatemjBizAppsAccountingTaxRemittance(
        @Arg('input', () => UpdatemjBizAppsAccountingTaxRemittanceInput) input: UpdatemjBizAppsAccountingTaxRemittanceInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Tax Remittances', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingTaxRemittance_)
    async DeletemjBizAppsAccountingTaxRemittance(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Tax Remittances', key, options, provider, userPayload, pubSub);
    }
    
}