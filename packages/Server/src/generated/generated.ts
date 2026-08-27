/********************************************************************************
* ALL ENTITIES - TypeGraphQL Type Class Definition - AUTO GENERATED FILE
* Generated Entities and Resolvers for Server
*
*   >>> DO NOT MODIFY THIS FILE!!!!!!!!!!!!
*   >>> YOUR CHANGES WILL BE OVERWRITTEN
*   >>> THE NEXT TIME THIS FILE IS GENERATED
*
**********************************************************************************/
import { Arg, Ctx, Int, Query, Resolver, Field, Float, ObjectType, InputType, Mutation,
            PubSub, PubSubEngine, ResolverBase, RunViewByIDInput, RunViewByNameInput, RunDynamicViewInput,
            AppContext, KeyValuePairInput, DeleteOptionsInput, GraphQLTimestamp as Timestamp,
            GetReadOnlyProvider, GetReadWriteProvider, RestoreContextInput } from '@memberjunction/server';
import { Metadata, EntityPermissionType, CompositeKey, UserInfo } from '@memberjunction/core'

import { MaxLength } from 'class-validator';
import * as mj_core_schema_server_object_types from '@memberjunction/server'


import { mjBizAppsAccountingAccountingCompanyProfileEntity, mjBizAppsAccountingCompanyTaxNexusEntity, mjBizAppsAccountingCurrencyEntity, mjBizAppsAccountingCurrencySpotRateEntity, mjBizAppsAccountingDimensionValueEntity, mjBizAppsAccountingDimensionEntity, mjBizAppsAccountingExternalAccountingSystemEntity, mjBizAppsAccountingGLAccountLinkDimensionEntity, mjBizAppsAccountingGLAccountLinkEntity, mjBizAppsAccountingGLAccountRoleEntity, mjBizAppsAccountingGLAccountEntity, mjBizAppsAccountingIntercompanyAccountMatchDimensionEntity, mjBizAppsAccountingIntercompanyAccountMatchEntity, mjBizAppsAccountingJournalEntryEntity, mjBizAppsAccountingJournalEntryBatchSequenceEntity, mjBizAppsAccountingJournalEntryBatchEntity, mjBizAppsAccountingJournalEntryLineDimensionEntity, mjBizAppsAccountingJournalEntryLineEntity, mjBizAppsAccountingJournalEntrySequenceEntity, mjBizAppsAccountingJournalEntryTypeEntity, mjBizAppsAccountingTaxAuthorityEntity, mjBizAppsAccountingTaxJurisdictionEntity, mjBizAppsAccountingTaxLiabilityEntity, mjBizAppsAccountingTaxRateEntity } from '@mj-biz-apps/accounting-entities';
    

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
        
    @Field({nullable: true, description: `The CFO (an __mj.User — a security identity) who must approve a Journal Entry Batch for this company before it dispatches to the ERP. Resolved by the bizapps-tasks approval gate. Nullable: companies without a configured CFO fall back to the role-based resolver.`}) 
    @MaxLength(36)
    ApprovalCFOUserID?: string;
        
    @Field(() => Boolean, {description: `Whether this profile is currently active. Inactive companies cannot have new JEs.`}) 
    IsActive: boolean;
        
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
    @MaxLength(100)
    ApprovalCFOUser?: string;
        
    @Field(() => Float, {nullable: true}) 
    _mj__Latitude?: number;
        
    @Field(() => Float, {nullable: true}) 
    _mj__Longitude?: number;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    RootParentAccountingCompanyID?: string;
        
    @Field(() => Int, {nullable: true}) 
    ParentAccountingCompanyIDDepth?: number;
        
    @Field({nullable: true}) 
    ParentAccountingCompanyIDPath?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    ParentAccountingCompanyIDIsLeaf?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    ParentAccountingCompanyIDChildCount?: number;
        
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
    ApprovalCFOUserID: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

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
    ApprovalCFOUserID?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

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
// ENTITY CLASS for MJ_BizApps_Accounting: Company Tax Nexus
//****************************************************************************
@ObjectType({ description: `Where THIS company must collect tax. Nexus is a property of our own legal entity\'s registrations, which is why it lives with Company rather than with the order. The mirror question - whether a BUYER is exempt - is CustomerTaxExemption in bizapps-orders. Both must hold to charge: the seller has nexus AND the buyer is not exempt AND the product is taxable there.` })
export class mjBizAppsAccountingCompanyTaxNexus_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `The legal entity with the obligation.`}) 
    @MaxLength(36)
    CompanyID: string;
        
    @Field({description: `The jurisdiction it must collect for.`}) 
    @MaxLength(36)
    TaxJurisdictionID: string;
        
    @Field({description: `WHY the obligation exists: Economic (crossed a revenue or transaction threshold), Physical (people, property or inventory in the state), Marketplace (a facilitator law attributes it) or Voluntary (registered without being required).`}) 
    @MaxLength(20)
    NexusType: string;
        
    @Field({nullable: true, description: `The permit or registration number issued by the jurisdiction.`}) 
    @MaxLength(100)
    RegistrationNumber?: string;
        
    @Field({description: `When the registration took effect.`}) 
    RegisteredFrom: Date;
        
    @Field({nullable: true, description: `When the REGISTRATION ended - not when the activity stopped. Registration is a one-way door: you must keep filing, including zero returns, until the account is formally closed, and a state will not close one with open periods.`}) 
    RegisteredTo?: Date;
        
    @Field({nullable: true, description: `When the duty to COLLECT ends, which routinely outlasts the activity that created it. California holds a seller through the nexus year plus the whole following calendar year; Colorado, Washington, Wisconsin, Iowa and Michigan through the following calendar year; Texas until twelve consecutive months below the threshold. Separate from RegisteredTo because collapsing the two would end the obligation early.`}) 
    ObligationEndsAt?: Date;
        
    @Field({description: `Active | Inactive. A closed registration is retained rather than deleted - it is the evidence of what was true during an audited period.`}) 
    @MaxLength(10)
    Status: string;
        
    @Field({nullable: true, description: `Free-text note, typically the nexus study or ruling that established the obligation.`}) 
    Comments?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(50)
    Company: string;
        
    @Field() 
    @MaxLength(200)
    TaxJurisdiction: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Company Tax Nexus
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingCompanyTaxNexusInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    TaxJurisdictionID?: string;

    @Field({ nullable: true })
    NexusType?: string;

    @Field({ nullable: true })
    RegistrationNumber: string | null;

    @Field({ nullable: true })
    RegisteredFrom?: Date;

    @Field({ nullable: true })
    RegisteredTo: Date | null;

    @Field({ nullable: true })
    ObligationEndsAt: Date | null;

    @Field({ nullable: true })
    Status?: string;

    @Field({ nullable: true })
    Comments: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Company Tax Nexus
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingCompanyTaxNexusInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    TaxJurisdictionID?: string;

    @Field({ nullable: true })
    NexusType?: string;

    @Field({ nullable: true })
    RegistrationNumber?: string | null;

    @Field({ nullable: true })
    RegisteredFrom?: Date;

    @Field({ nullable: true })
    RegisteredTo?: Date | null;

    @Field({ nullable: true })
    ObligationEndsAt?: Date | null;

    @Field({ nullable: true })
    Status?: string;

    @Field({ nullable: true })
    Comments?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Company Tax Nexus
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingCompanyTaxNexusViewResult {
    @Field(() => [mjBizAppsAccountingCompanyTaxNexus_])
    Results: mjBizAppsAccountingCompanyTaxNexus_[];

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

@Resolver(mjBizAppsAccountingCompanyTaxNexus_)
export class mjBizAppsAccountingCompanyTaxNexusResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingCompanyTaxNexusViewResult)
    async RunmjBizAppsAccountingCompanyTaxNexusViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingCompanyTaxNexusViewResult)
    async RunmjBizAppsAccountingCompanyTaxNexusViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingCompanyTaxNexusViewResult)
    async RunmjBizAppsAccountingCompanyTaxNexusDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Company Tax Nexus';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingCompanyTaxNexus_, { nullable: true })
    async mjBizAppsAccountingCompanyTaxNexus(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingCompanyTaxNexus_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Company Tax Nexus', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwCompanyTaxNexus')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Company Tax Nexus', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Company Tax Nexus', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingCompanyTaxNexus_)
    async CreatemjBizAppsAccountingCompanyTaxNexus(
        @Arg('input', () => CreatemjBizAppsAccountingCompanyTaxNexusInput) input: CreatemjBizAppsAccountingCompanyTaxNexusInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Company Tax Nexus', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingCompanyTaxNexus_)
    async UpdatemjBizAppsAccountingCompanyTaxNexus(
        @Arg('input', () => UpdatemjBizAppsAccountingCompanyTaxNexusInput) input: UpdatemjBizAppsAccountingCompanyTaxNexusInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Company Tax Nexus', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingCompanyTaxNexus_)
    async DeletemjBizAppsAccountingCompanyTaxNexus(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Company Tax Nexus', key, options, provider, userPayload, pubSub);
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
        
    @Field(() => Int, {nullable: true}) 
    ParentDimensionValueIDDepth?: number;
        
    @Field({nullable: true}) 
    ParentDimensionValueIDPath?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    ParentDimensionValueIDIsLeaf?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    ParentDimensionValueIDChildCount?: number;
        
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
// ENTITY CLASS for MJ_BizApps_Accounting: External Accounting Systems
//****************************************************************************
@ObjectType({ description: `Catalog of external ERP/GL destinations journal entries dispatch to. Maps each system to its adapter DriverClass (resolved via ClassFactory) and, when connector-backed, to the __mj.Integration record by name. Seeded with BusinessCentral and Mock; add a row + a registered adapter class to support a new ERP — no engine changes.` })
export class mjBizAppsAccountingExternalAccountingSystem_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(50)
    Name: string;
        
    @Field() 
    @MaxLength(100)
    DisplayName: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({description: `Class name of the BaseExternalAccountingSystemAdapter subclass that handles this system (ClassFactory key — the class's own name, e.g. BusinessCentralAccountingSystemAdapter).`}) 
    @MaxLength(255)
    DriverClass: string;
        
    @Field({nullable: true, description: `Name of the __mj.Integration record backing this system (e.g. business-central), resolved at runtime — NULL for systems with no connector (Mock). By name, not ID: the Integration row is minted by the connector app's own migration.`}) 
    @MaxLength(100)
    IntegrationName?: string;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: External Accounting Systems
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingExternalAccountingSystemInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    DisplayName?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field({ nullable: true })
    DriverClass?: string;

    @Field({ nullable: true })
    IntegrationName: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: External Accounting Systems
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingExternalAccountingSystemInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    DisplayName?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field({ nullable: true })
    DriverClass?: string;

    @Field({ nullable: true })
    IntegrationName?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: External Accounting Systems
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingExternalAccountingSystemViewResult {
    @Field(() => [mjBizAppsAccountingExternalAccountingSystem_])
    Results: mjBizAppsAccountingExternalAccountingSystem_[];

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

@Resolver(mjBizAppsAccountingExternalAccountingSystem_)
export class mjBizAppsAccountingExternalAccountingSystemResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingExternalAccountingSystemViewResult)
    async RunmjBizAppsAccountingExternalAccountingSystemViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingExternalAccountingSystemViewResult)
    async RunmjBizAppsAccountingExternalAccountingSystemViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingExternalAccountingSystemViewResult)
    async RunmjBizAppsAccountingExternalAccountingSystemDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: External Accounting Systems';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingExternalAccountingSystem_, { nullable: true })
    async mjBizAppsAccountingExternalAccountingSystem(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingExternalAccountingSystem_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: External Accounting Systems', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwExternalAccountingSystems')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: External Accounting Systems', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: External Accounting Systems', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingExternalAccountingSystem_)
    async CreatemjBizAppsAccountingExternalAccountingSystem(
        @Arg('input', () => CreatemjBizAppsAccountingExternalAccountingSystemInput) input: CreatemjBizAppsAccountingExternalAccountingSystemInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: External Accounting Systems', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingExternalAccountingSystem_)
    async UpdatemjBizAppsAccountingExternalAccountingSystem(
        @Arg('input', () => UpdatemjBizAppsAccountingExternalAccountingSystemInput) input: UpdatemjBizAppsAccountingExternalAccountingSystemInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: External Accounting Systems', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingExternalAccountingSystem_)
    async DeletemjBizAppsAccountingExternalAccountingSystem(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: External Accounting Systems', key, options, provider, userPayload, pubSub);
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
        
    @Field({description: `Polymorphic reference part 1: the MJ Entity of the target record (references __mj.Entity). Same TaggedItem-style pattern as JournalEntry.LinkedEntityID/LinkedRecordID (plan D25).`}) 
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
        
    @Field(() => Int, {nullable: true}) 
    ParentGLAccountIDDepth?: number;
        
    @Field({nullable: true}) 
    ParentGLAccountIDPath?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    ParentGLAccountIDIsLeaf?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    ParentGLAccountIDChildCount?: number;
        
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
// ENTITY CLASS for MJ_BizApps_Accounting: Intercompany Account Match Dimensions
//****************************************************************************
@ObjectType({ description: `The analytical Dimensions, and optionally their fixed VALUES, to stamp on each leg of an intercompany pair. Unlike GLAccountLinkDimension this can pin a value, because an intercompany leg is raised to balance another company\'s revenue and has no originating record to read a value from.` })
export class mjBizAppsAccountingIntercompanyAccountMatchDimension_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `The account pair this dimension requirement belongs to.`}) 
    @MaxLength(36)
    IntercompanyAccountMatchID: string;
        
    @Field({description: `Which leg the requirement applies to: DueTo (source company's liability) or DueFrom (target company's receivable). The two legs sit on different companies' books and routinely carry different values for the same Dimension.`}) 
    @MaxLength(10)
    Side: string;
        
    @Field({description: `The Dimension that applies (validate-only vocabulary — never invented here).`}) 
    @MaxLength(36)
    DimensionID: string;
        
    @Field({nullable: true, description: `Optional fixed value to stamp. NULL keeps the GLAccountLink behaviour of taking the value from the calling context. Must belong to DimensionID (enforced by trigger).`}) 
    @MaxLength(36)
    DimensionValueID?: string;
        
    @Field(() => Int, {description: `Ordering of the dimensions for this side (ascending).`}) 
    Sequence: number;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(100)
    Dimension: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DimensionValue?: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Intercompany Account Match Dimensions
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingIntercompanyAccountMatchDimensionInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    IntercompanyAccountMatchID?: string;

    @Field({ nullable: true })
    Side?: string;

    @Field({ nullable: true })
    DimensionID?: string;

    @Field({ nullable: true })
    DimensionValueID: string | null;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Intercompany Account Match Dimensions
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingIntercompanyAccountMatchDimensionInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    IntercompanyAccountMatchID?: string;

    @Field({ nullable: true })
    Side?: string;

    @Field({ nullable: true })
    DimensionID?: string;

    @Field({ nullable: true })
    DimensionValueID?: string | null;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Intercompany Account Match Dimensions
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingIntercompanyAccountMatchDimensionViewResult {
    @Field(() => [mjBizAppsAccountingIntercompanyAccountMatchDimension_])
    Results: mjBizAppsAccountingIntercompanyAccountMatchDimension_[];

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

@Resolver(mjBizAppsAccountingIntercompanyAccountMatchDimension_)
export class mjBizAppsAccountingIntercompanyAccountMatchDimensionResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingIntercompanyAccountMatchDimensionViewResult)
    async RunmjBizAppsAccountingIntercompanyAccountMatchDimensionViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingIntercompanyAccountMatchDimensionViewResult)
    async RunmjBizAppsAccountingIntercompanyAccountMatchDimensionViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingIntercompanyAccountMatchDimensionViewResult)
    async RunmjBizAppsAccountingIntercompanyAccountMatchDimensionDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Intercompany Account Match Dimensions';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingIntercompanyAccountMatchDimension_, { nullable: true })
    async mjBizAppsAccountingIntercompanyAccountMatchDimension(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingIntercompanyAccountMatchDimension_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Intercompany Account Match Dimensions', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwIntercompanyAccountMatchDimensions')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Intercompany Account Match Dimensions', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Intercompany Account Match Dimensions', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingIntercompanyAccountMatchDimension_)
    async CreatemjBizAppsAccountingIntercompanyAccountMatchDimension(
        @Arg('input', () => CreatemjBizAppsAccountingIntercompanyAccountMatchDimensionInput) input: CreatemjBizAppsAccountingIntercompanyAccountMatchDimensionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Intercompany Account Match Dimensions', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingIntercompanyAccountMatchDimension_)
    async UpdatemjBizAppsAccountingIntercompanyAccountMatchDimension(
        @Arg('input', () => UpdatemjBizAppsAccountingIntercompanyAccountMatchDimensionInput) input: UpdatemjBizAppsAccountingIntercompanyAccountMatchDimensionInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Intercompany Account Match Dimensions', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingIntercompanyAccountMatchDimension_)
    async DeletemjBizAppsAccountingIntercompanyAccountMatchDimension(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Intercompany Account Match Dimensions', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Intercompany Account Matches
//****************************************************************************
@ObjectType({ description: `The Due To / Due From GL account pair for an ORDERED company pair. Read a row as: Source collected cash on Target\'s behalf, so Source owes Target. Money flowing the other way is a separate row with the companies swapped, because the two directions routinely use different accounts. Date-effective: resolution picks the Active row whose window covers the as-of date, latest StartedAt winning.` })
export class mjBizAppsAccountingIntercompanyAccountMatch_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `The company that COLLECTED the cash and therefore owes — the Due To liability sits on its books.`}) 
    @MaxLength(36)
    SourceCompanyID: string;
        
    @Field({description: `The company that is OWED because it owns the line the cash settled — the Due From receivable sits on its books.`}) 
    @MaxLength(36)
    TargetCompanyID: string;
        
    @Field({description: `The intercompany PAYABLE on the source company's books. Must be a Liability account belonging to SourceCompanyID (enforced by trigger, not merely by convention: a backwards pair still balances).`}) 
    @MaxLength(36)
    DueToGLAccountID: string;
        
    @Field({description: `The intercompany RECEIVABLE on the target company's books. Must be an Asset account belonging to TargetCompanyID.`}) 
    @MaxLength(36)
    DueFromGLAccountID: string;
        
    @Field({description: `Pending | Active | Disabled. Only Active rows resolve; a pair is never deleted once it has been used.`}) 
    @MaxLength(10)
    Status: string;
        
    @Field({nullable: true, description: `Start of the effective window (inclusive). NULL means open-ended in the past.`}) 
    StartedAt?: Date;
        
    @Field({nullable: true, description: `End of the effective window (inclusive). NULL means open-ended. Supersede a mapping by closing this and adding a new row, never by editing history.`}) 
    EndedAt?: Date;
        
    @Field({nullable: true, description: `Free-text note on why this mapping exists — typically the intercompany agreement it implements.`}) 
    Comments?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(50)
    SourceCompany: string;
        
    @Field() 
    @MaxLength(50)
    TargetCompany: string;
        
    @Field() 
    @MaxLength(200)
    DueToGLAccount: string;
        
    @Field() 
    @MaxLength(200)
    DueFromGLAccount: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Intercompany Account Matches
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingIntercompanyAccountMatchInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    SourceCompanyID?: string;

    @Field({ nullable: true })
    TargetCompanyID?: string;

    @Field({ nullable: true })
    DueToGLAccountID?: string;

    @Field({ nullable: true })
    DueFromGLAccountID?: string;

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
// INPUT TYPE for MJ_BizApps_Accounting: Intercompany Account Matches
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingIntercompanyAccountMatchInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    SourceCompanyID?: string;

    @Field({ nullable: true })
    TargetCompanyID?: string;

    @Field({ nullable: true })
    DueToGLAccountID?: string;

    @Field({ nullable: true })
    DueFromGLAccountID?: string;

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
// RESOLVER for MJ_BizApps_Accounting: Intercompany Account Matches
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingIntercompanyAccountMatchViewResult {
    @Field(() => [mjBizAppsAccountingIntercompanyAccountMatch_])
    Results: mjBizAppsAccountingIntercompanyAccountMatch_[];

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

@Resolver(mjBizAppsAccountingIntercompanyAccountMatch_)
export class mjBizAppsAccountingIntercompanyAccountMatchResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingIntercompanyAccountMatchViewResult)
    async RunmjBizAppsAccountingIntercompanyAccountMatchViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingIntercompanyAccountMatchViewResult)
    async RunmjBizAppsAccountingIntercompanyAccountMatchViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingIntercompanyAccountMatchViewResult)
    async RunmjBizAppsAccountingIntercompanyAccountMatchDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Intercompany Account Matches';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingIntercompanyAccountMatch_, { nullable: true })
    async mjBizAppsAccountingIntercompanyAccountMatch(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingIntercompanyAccountMatch_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Intercompany Account Matches', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwIntercompanyAccountMatches')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Intercompany Account Matches', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Intercompany Account Matches', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingIntercompanyAccountMatch_)
    async CreatemjBizAppsAccountingIntercompanyAccountMatch(
        @Arg('input', () => CreatemjBizAppsAccountingIntercompanyAccountMatchInput) input: CreatemjBizAppsAccountingIntercompanyAccountMatchInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Intercompany Account Matches', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingIntercompanyAccountMatch_)
    async UpdatemjBizAppsAccountingIntercompanyAccountMatch(
        @Arg('input', () => UpdatemjBizAppsAccountingIntercompanyAccountMatchInput) input: UpdatemjBizAppsAccountingIntercompanyAccountMatchInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Intercompany Account Matches', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingIntercompanyAccountMatch_)
    async DeletemjBizAppsAccountingIntercompanyAccountMatch(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Intercompany Account Matches', key, options, provider, userPayload, pubSub);
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
        
    @Field({description: `The single company this journal entry belongs to (plan D3). Every line's GLAccount must belong to this company (trigger-enforced).`}) 
    @MaxLength(36)
    CompanyID: string;
        
    @Field({description: `Accounting date for the entry (the ERP assigns its own period at posting).`}) 
    EffectiveDate: Date;
        
    @Field({description: `The JournalEntryType classifying this entry (issue #24, BA-D29). Accounting seeds its own ledger-mechanics types; consuming apps seed their domain types as rows.`}) 
    @MaxLength(36)
    EntryTypeID: string;
        
    @Field({description: `Lifecycle state: Pending | Batched | GLPosted (BA-D6). Locked after Batched; only GLPosted transition and GL-roundtrip fields may change.`}) 
    @MaxLength(20)
    Status: string;
        
    @Field({nullable: true, description: `Free-form human description of the entry.`}) 
    Description?: string;
        
    @Field({nullable: true, description: `Polymorphic origin part 1 (plan D25): the MJ Entity of the single causal source record for this JE (OrderLine for booking/rev-rec entries, Payment for receipts/refunds, ...). FK to __mj.Entity. NULL (with LinkedRecordID) = manual JE.`}) 
    @MaxLength(36)
    LinkedEntityID?: string;
        
    @Field({nullable: true, description: `Polymorphic origin part 2: the source record's primary key (NVARCHAR(400) supports stringified composite keys). Soft by nature — the record lives in a downstream app's schema. Set and NULL together with LinkedEntityID (CK_JournalEntry_LinkedPair).`}) 
    @MaxLength(400)
    LinkedRecordID?: string;
        
    @Field({nullable: true, description: `When set, this JE is a reversal of the referenced original JE. Its JournalEntryType Code MUST be 'Reversal' (trg_JE_ReversalConsistency).`}) 
    @MaxLength(36)
    ReversesJournalEntryID?: string;
        
    @Field({nullable: true, description: `Back-pointer set on the original JE when a reversal is emitted against it.`}) 
    @MaxLength(36)
    ReversedByJournalEntryID?: string;
        
    @Field({nullable: true, description: `Batch that locked this JE (set when Status transitions to Batched).`}) 
    @MaxLength(36)
    JournalEntryBatchID?: string;
        
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
        
    @Field() 
    @MaxLength(50)
    Company: string;
        
    @Field() 
    @MaxLength(100)
    EntryType: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    LinkedEntity?: string;
        
    @Field({nullable: true}) 
    @MaxLength(40)
    ReversesJournalEntry?: string;
        
    @Field({nullable: true}) 
    @MaxLength(40)
    ReversedByJournalEntry?: string;
        
    @Field({nullable: true}) 
    @MaxLength(40)
    JournalEntryBatch?: string;
        
    @Field({nullable: true}) 
    @MaxLength(500)
    File?: string;
        
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
    CompanyID?: string;

    @Field({ nullable: true })
    EffectiveDate?: Date;

    @Field({ nullable: true })
    EntryTypeID?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field({ nullable: true })
    LinkedEntityID: string | null;

    @Field({ nullable: true })
    LinkedRecordID: string | null;

    @Field({ nullable: true })
    ReversesJournalEntryID: string | null;

    @Field({ nullable: true })
    ReversedByJournalEntryID: string | null;

    @Field({ nullable: true })
    JournalEntryBatchID: string | null;

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
    CompanyID?: string;

    @Field({ nullable: true })
    EffectiveDate?: Date;

    @Field({ nullable: true })
    EntryTypeID?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field({ nullable: true })
    LinkedEntityID?: string | null;

    @Field({ nullable: true })
    LinkedRecordID?: string | null;

    @Field({ nullable: true })
    ReversesJournalEntryID?: string | null;

    @Field({ nullable: true })
    ReversedByJournalEntryID?: string | null;

    @Field({ nullable: true })
    JournalEntryBatchID?: string | null;

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
// ENTITY CLASS for MJ_BizApps_Accounting: Journal Entry Batch Sequences
//****************************************************************************
@ObjectType({ description: `GLOBAL singleton counter backing gap-free JournalEntryBatch numbering (plan D19: batch numbering stays global). One row, ID = 1. Consumed only by spAssignNextJournalEntryBatchNumber.` })
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
        
    @Field({description: `Gap-free batch number assigned by spAssignNextJournalEntryBatchNumber. Format 'BATCH-{CompanyCode}-{seq:000000}'.`}) 
    @MaxLength(40)
    JournalEntryBatchNumber: string;
        
    @Field({description: `The single company this batch belongs to (plan D7). One batch per company per run; the batch gathers ONLY this company's Pending JEs.`}) 
    @MaxLength(36)
    CompanyID: string;
        
    @Field({description: `Singular, accountant-set posting date chosen at batch build (plan D8). Carried to the GL's posting date and must match between systems; drives the ERP period. Document dates stay informational.`}) 
    PostingDate: Date;
        
    @Field({nullable: true, description: `The aggregated summary JournalEntry (its JournalEntryType flagged IsJournalEntryBatchSummary, EffectiveDate=PostingDate) that posts to the GL for this batch (plan D9). Its lines net debits/credits per GLAccount x dimension-combo. The summary carries this batch's JournalEntryBatchID (same derived lock machinery as members) but is excluded from member/netting/sweep queries via its type's IsJournalEntryBatchSummary flag.`}) 
    @MaxLength(36)
    SummaryJournalEntryID?: string;
        
    @Field({description: `Target ERP for this batch: BusinessCentral | QuickBooks | NetSuite | Sage | Xero | Other.`}) 
    @MaxLength(50)
    TargetSystem: string;
        
    @Field({description: `When the batch was created (Pending JEs flipped to Batched).`}) 
    BatchedAt: Date;
        
    @Field({description: `User (or system identity for scheduled runs) that performed the batch.`}) 
    @MaxLength(36)
    BatchedByUserID: string;
        
    @Field({description: `Lifecycle: Pending | Approved | Sent | Posted | Failed | Cancelled. Pending is mutable/deletable; Approved locks content (human sign-off); Posted = the ERP confirmed posting; Failed triggers retry + escalation; Cancelled is terminal from Pending or unsent Approved (trg_JournalEntryBatch_Immutability).`}) 
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
    ExternalJournalEntryBatchRef?: string;
        
    @Field({nullable: true, description: `When a human approved the batch for dispatch (locks its content; the new Approved status).`}) 
    ApprovedAt?: Date;
        
    @Field({nullable: true, description: `The user who approved the batch (see AccountingCompanyProfile.ApprovalCFOUserID / the bizapps-tasks approval gate).`}) 
    @MaxLength(36)
    ApprovedByUserID?: string;
        
    @Field({nullable: true, description: `When the batch was sent to the ERP.`}) 
    SentAt?: Date;
        
    @Field({nullable: true, description: `When the ERP confirmed it posted the batch (Status=Posted; renames the old AcknowledgedAt).`}) 
    PostedAt?: Date;
        
    @Field({nullable: true, description: `Error message from a Failed send. JEs revert to Pending for retry.`}) 
    ErrorMessage?: string;
        
    @Field({nullable: true, description: `The bizapps-tasks approval Task raised for this batch (plan D10). Real FK to __mj_BizAppsTasks.Task (#22) — cross-app references point UP the dependency graph, and tasks installs before this app. Stamped together with ApprovalTaskRaisedAt in the task-raise transaction (both-or-neither CHECK). NULL = task not yet raised (retryable state).`}) 
    @MaxLength(36)
    ApprovalTaskID?: string;
        
    @Field({nullable: true, description: `When the approval task was raised; set together with ApprovalTaskID (both-or-neither CHECK).`}) 
    ApprovalTaskRaisedAt?: Date;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(50)
    Company: string;
        
    @Field({nullable: true}) 
    @MaxLength(40)
    SummaryJournalEntry?: string;
        
    @Field() 
    @MaxLength(100)
    BatchedByUser: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    ApprovedByUser?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    ApprovalTask?: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Batches
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingJournalEntryBatchInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    JournalEntryBatchNumber?: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    PostingDate?: Date;

    @Field({ nullable: true })
    SummaryJournalEntryID: string | null;

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
    ExternalJournalEntryBatchRef: string | null;

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

    @Field({ nullable: true })
    ApprovalTaskID: string | null;

    @Field({ nullable: true })
    ApprovalTaskRaisedAt: Date | null;

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
    JournalEntryBatchNumber?: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    PostingDate?: Date;

    @Field({ nullable: true })
    SummaryJournalEntryID?: string | null;

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
    ExternalJournalEntryBatchRef?: string | null;

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

    @Field({ nullable: true })
    ApprovalTaskID?: string | null;

    @Field({ nullable: true })
    ApprovalTaskRaisedAt?: Date | null;

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
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(40)
    JournalEntry: string;
        
    @Field() 
    @MaxLength(200)
    GLAccount: string;
        
    @Field({nullable: true}) 
    @MaxLength(80)
    OriginalCurrencyCode_Virtual?: string;
        
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
// ENTITY CLASS for MJ_BizApps_Accounting: Journal Entry Sequences
//****************************************************************************
@ObjectType({ description: `PER-COMPANY per-fiscal-year counter backing gap-free JournalEntry numbering JE-{CompanyCode}-{FY}-{seq} (plan D19). Consumed only by spAssignNextJournalEntryNumber.` })
export class mjBizAppsAccountingJournalEntrySequence_ {
    @Field() 
    @MaxLength(36)
    CompanyID: string;
        
    @Field(() => Int) 
    FiscalYear: number;
        
    @Field(() => Int) 
    NextSequenceNumber: number;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(50)
    Company: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Sequences
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingJournalEntrySequenceInput {
    @Field({ nullable: true })
    CompanyID?: string;

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
    @Field()
    CompanyID: string;

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
    async mjBizAppsAccountingJournalEntrySequence(@Arg('CompanyID', () => String) CompanyID: string, @Arg('FiscalYear', () => Int) FiscalYear: number, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingJournalEntrySequence_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Sequences', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntrySequences')} WHERE ${provider.QuoteIdentifier('CompanyID')}=${provider.BuildParameterPlaceholder(0)} AND ${provider.QuoteIdentifier('FiscalYear')}=${provider.BuildParameterPlaceholder(1)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Sequences', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [CompanyID, FiscalYear], undefined, this.GetUserFromPayload(userPayload));
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
    async DeletemjBizAppsAccountingJournalEntrySequence(@Arg('CompanyID', () => String) CompanyID: string, @Arg('FiscalYear', () => Int) FiscalYear: number, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'CompanyID', Value: CompanyID}, {FieldName: 'FiscalYear', Value: FiscalYear}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Journal Entry Sequences', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Accounting: Journal Entry Types
//****************************************************************************
@ObjectType({ description: `Extensible classification of journal entries (issue #24, BA-D29). Replaces the former closed EntryType CHECK enum. Accounting seeds only the ledger-mechanics types it owns (IsSystem=1, via metadata/journal-entry-types); consuming apps (orders, AP, payroll, ...) seed their own domain types via mj sync push without touching this repo.` })
export class mjBizAppsAccountingJournalEntryType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Stable machine code for the type (e.g. Manual, Reversal, JournalEntryBatchSummary, OrderBooking). Unique. Referenced by code; display uses Name.`}) 
    @MaxLength(40)
    Code: string;
        
    @Field({description: `Human-readable display name for the type.`}) 
    @MaxLength(100)
    Name: string;
        
    @Field({nullable: true, description: `What this entry type classifies and which app owns it.`}) 
    Description?: string;
        
    @Field(() => Boolean, {description: `1 = accounting's own ledger-mechanics type (Manual, Reversal, JournalEntryBatchSummary, ...). Consumers must not repurpose or delete IsSystem rows.`}) 
    IsSystem: boolean;
        
    @Field(() => Boolean, {description: `1 = this type marks a batch's aggregated summary JE. Batch member/netting/sweep queries exclude JEs of this type via a join on this flag (replaces the former 'JournalEntryBatchSummary' magic-string match). A filtered unique index allows exactly one flagged row.`}) 
    IsJournalEntryBatchSummary: boolean;
        
    @Field(() => Boolean, {description: `Whether this type may be used on NEW journal entries. Inactive types remain for historical rows.`}) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Types
//****************************************************************************
@InputType()
export class CreatemjBizAppsAccountingJournalEntryTypeInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Boolean, { nullable: true })
    IsSystem?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsJournalEntryBatchSummary?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Accounting: Journal Entry Types
//****************************************************************************
@InputType()
export class UpdatemjBizAppsAccountingJournalEntryTypeInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsSystem?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsJournalEntryBatchSummary?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Accounting: Journal Entry Types
//****************************************************************************
@ObjectType()
export class RunmjBizAppsAccountingJournalEntryTypeViewResult {
    @Field(() => [mjBizAppsAccountingJournalEntryType_])
    Results: mjBizAppsAccountingJournalEntryType_[];

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

@Resolver(mjBizAppsAccountingJournalEntryType_)
export class mjBizAppsAccountingJournalEntryTypeResolver extends ResolverBase {
    @Query(() => RunmjBizAppsAccountingJournalEntryTypeViewResult)
    async RunmjBizAppsAccountingJournalEntryTypeViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryTypeViewResult)
    async RunmjBizAppsAccountingJournalEntryTypeViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsAccountingJournalEntryTypeViewResult)
    async RunmjBizAppsAccountingJournalEntryTypeDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Accounting: Journal Entry Types';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsAccountingJournalEntryType_, { nullable: true })
    async mjBizAppsAccountingJournalEntryType(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsAccountingJournalEntryType_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Accounting: Journal Entry Types', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsAccounting', 'vwJournalEntryTypes')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Accounting: Journal Entry Types', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Accounting: Journal Entry Types', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryType_)
    async CreatemjBizAppsAccountingJournalEntryType(
        @Arg('input', () => CreatemjBizAppsAccountingJournalEntryTypeInput) input: CreatemjBizAppsAccountingJournalEntryTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Accounting: Journal Entry Types', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsAccountingJournalEntryType_)
    async UpdatemjBizAppsAccountingJournalEntryType(
        @Arg('input', () => UpdatemjBizAppsAccountingJournalEntryTypeInput) input: UpdatemjBizAppsAccountingJournalEntryTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Accounting: Journal Entry Types', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsAccountingJournalEntryType_)
    async DeletemjBizAppsAccountingJournalEntryType(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Accounting: Journal Entry Types', key, options, provider, userPayload, pubSub);
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
        
    @Field(() => Float, {nullable: true}) 
    _mj__Latitude?: number;
        
    @Field(() => Float, {nullable: true}) 
    _mj__Longitude?: number;
        
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
        
    @Field(() => Float, {nullable: true}) 
    _mj__Latitude?: number;
        
    @Field(() => Float, {nullable: true}) 
    _mj__Longitude?: number;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    RootParentTaxJurisdictionID?: string;
        
    @Field(() => Int, {nullable: true}) 
    ParentTaxJurisdictionIDDepth?: number;
        
    @Field({nullable: true}) 
    ParentTaxJurisdictionIDPath?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    ParentTaxJurisdictionIDIsLeaf?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    ParentTaxJurisdictionIDChildCount?: number;
        
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
@ObjectType({ description: `Open tax liability balance per (Company × Authority × Jurisdiction × Period). Accrued from JE postings; remitted to the authority in the ERP (no remittance table here — ERP/GL concern).` })
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