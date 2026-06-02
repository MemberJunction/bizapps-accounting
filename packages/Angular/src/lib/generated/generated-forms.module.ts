/**********************************************************************************
* GENERATED FILE - This file is automatically managed by the MJ CodeGen tool, 
* 
* DO NOT MODIFY THIS FILE - any changes you make will be wiped out the next time the file is
* generated
* 
**********************************************************************************/
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// MemberJunction Imports
import { BaseFormsModule } from '@memberjunction/ng-base-forms';
import { EntityViewerModule } from '@memberjunction/ng-entity-viewer';
import { LinkDirectivesModule } from '@memberjunction/ng-link-directives';

// Import Generated Components
import { mjBizAppsAccountingAccountBalanceByDimensionFormComponent } from "./Entities/mjBizAppsAccountingAccountBalanceByDimension/mjbizappsaccountingaccountbalancebydimension.form.component";
import { mjBizAppsAccountingAccountBalanceFormComponent } from "./Entities/mjBizAppsAccountingAccountBalance/mjbizappsaccountingaccountbalance.form.component";
import { mjBizAppsAccountingAccountingCompanyProfileFormComponent } from "./Entities/mjBizAppsAccountingAccountingCompanyProfile/mjbizappsaccountingaccountingcompanyprofile.form.component";
import { mjBizAppsAccountingAccountingPeriodFormComponent } from "./Entities/mjBizAppsAccountingAccountingPeriod/mjbizappsaccountingaccountingperiod.form.component";
import { mjBizAppsAccountingChartOfAccountsMappingFormComponent } from "./Entities/mjBizAppsAccountingChartOfAccountsMapping/mjbizappsaccountingchartofaccountsmapping.form.component";
import { mjBizAppsAccountingCurrencyFormComponent } from "./Entities/mjBizAppsAccountingCurrency/mjbizappsaccountingcurrency.form.component";
import { mjBizAppsAccountingCurrencySpotRateFormComponent } from "./Entities/mjBizAppsAccountingCurrencySpotRate/mjbizappsaccountingcurrencyspotrate.form.component";
import { mjBizAppsAccountingCustomerTaxProfileFormComponent } from "./Entities/mjBizAppsAccountingCustomerTaxProfile/mjbizappsaccountingcustomertaxprofile.form.component";
import { mjBizAppsAccountingDimensionValueFormComponent } from "./Entities/mjBizAppsAccountingDimensionValue/mjbizappsaccountingdimensionvalue.form.component";
import { mjBizAppsAccountingDimensionFormComponent } from "./Entities/mjBizAppsAccountingDimension/mjbizappsaccountingdimension.form.component";
import { mjBizAppsAccountingGLAccountFormComponent } from "./Entities/mjBizAppsAccountingGLAccount/mjbizappsaccountingglaccount.form.component";
import { mjBizAppsAccountingJournalEntryFormComponent } from "./Entities/mjBizAppsAccountingJournalEntry/mjbizappsaccountingjournalentry.form.component";
import { mjBizAppsAccountingJournalEntryBatchSequenceFormComponent } from "./Entities/mjBizAppsAccountingJournalEntryBatchSequence/mjbizappsaccountingjournalentrybatchsequence.form.component";
import { mjBizAppsAccountingJournalEntryBatchFormComponent } from "./Entities/mjBizAppsAccountingJournalEntryBatch/mjbizappsaccountingjournalentrybatch.form.component";
import { mjBizAppsAccountingJournalEntryLineDimensionFormComponent } from "./Entities/mjBizAppsAccountingJournalEntryLineDimension/mjbizappsaccountingjournalentrylinedimension.form.component";
import { mjBizAppsAccountingJournalEntryLineFormComponent } from "./Entities/mjBizAppsAccountingJournalEntryLine/mjbizappsaccountingjournalentryline.form.component";
import { mjBizAppsAccountingJournalEntryLinkFormComponent } from "./Entities/mjBizAppsAccountingJournalEntryLink/mjbizappsaccountingjournalentrylink.form.component";
import { mjBizAppsAccountingJournalEntrySequenceFormComponent } from "./Entities/mjBizAppsAccountingJournalEntrySequence/mjbizappsaccountingjournalentrysequence.form.component";
import { mjBizAppsAccountingRecurringJournalEntryFormComponent } from "./Entities/mjBizAppsAccountingRecurringJournalEntry/mjbizappsaccountingrecurringjournalentry.form.component";
import { mjBizAppsAccountingRecurringJournalEntryTemplateLineFormComponent } from "./Entities/mjBizAppsAccountingRecurringJournalEntryTemplateLine/mjbizappsaccountingrecurringjournalentrytemplateline.form.component";
import { mjBizAppsAccountingRecurringJournalEntryTemplateFormComponent } from "./Entities/mjBizAppsAccountingRecurringJournalEntryTemplate/mjbizappsaccountingrecurringjournalentrytemplate.form.component";
import { mjBizAppsAccountingTaxAuthorityFormComponent } from "./Entities/mjBizAppsAccountingTaxAuthority/mjbizappsaccountingtaxauthority.form.component";
import { mjBizAppsAccountingTaxJurisdictionFormComponent } from "./Entities/mjBizAppsAccountingTaxJurisdiction/mjbizappsaccountingtaxjurisdiction.form.component";
import { mjBizAppsAccountingTaxLiabilityFormComponent } from "./Entities/mjBizAppsAccountingTaxLiability/mjbizappsaccountingtaxliability.form.component";
import { mjBizAppsAccountingTaxRateFormComponent } from "./Entities/mjBizAppsAccountingTaxRate/mjbizappsaccountingtaxrate.form.component";
import { mjBizAppsAccountingTaxRemittanceFormComponent } from "./Entities/mjBizAppsAccountingTaxRemittance/mjbizappsaccountingtaxremittance.form.component";
   

@NgModule({
declarations: [
    mjBizAppsAccountingAccountBalanceByDimensionFormComponent,
    mjBizAppsAccountingAccountBalanceFormComponent,
    mjBizAppsAccountingAccountingCompanyProfileFormComponent,
    mjBizAppsAccountingAccountingPeriodFormComponent,
    mjBizAppsAccountingChartOfAccountsMappingFormComponent,
    mjBizAppsAccountingCurrencyFormComponent,
    mjBizAppsAccountingCurrencySpotRateFormComponent,
    mjBizAppsAccountingCustomerTaxProfileFormComponent,
    mjBizAppsAccountingDimensionValueFormComponent,
    mjBizAppsAccountingDimensionFormComponent,
    mjBizAppsAccountingGLAccountFormComponent,
    mjBizAppsAccountingJournalEntryFormComponent,
    mjBizAppsAccountingJournalEntryBatchSequenceFormComponent,
    mjBizAppsAccountingJournalEntryBatchFormComponent,
    mjBizAppsAccountingJournalEntryLineDimensionFormComponent,
    mjBizAppsAccountingJournalEntryLineFormComponent,
    mjBizAppsAccountingJournalEntryLinkFormComponent,
    mjBizAppsAccountingJournalEntrySequenceFormComponent,
    mjBizAppsAccountingRecurringJournalEntryFormComponent,
    mjBizAppsAccountingRecurringJournalEntryTemplateLineFormComponent],
imports: [
    CommonModule,
    FormsModule,
    BaseFormsModule,
    EntityViewerModule,
    LinkDirectivesModule
],
exports: [
]
})
export class GeneratedForms_SubModule_0 { }
    


@NgModule({
declarations: [
    mjBizAppsAccountingRecurringJournalEntryTemplateFormComponent,
    mjBizAppsAccountingTaxAuthorityFormComponent,
    mjBizAppsAccountingTaxJurisdictionFormComponent,
    mjBizAppsAccountingTaxLiabilityFormComponent,
    mjBizAppsAccountingTaxRateFormComponent,
    mjBizAppsAccountingTaxRemittanceFormComponent],
imports: [
    CommonModule,
    FormsModule,
    BaseFormsModule,
    EntityViewerModule,
    LinkDirectivesModule
],
exports: [
]
})
export class GeneratedForms_SubModule_1 { }
    


@NgModule({
declarations: [
],
imports: [
    GeneratedForms_SubModule_0,
    GeneratedForms_SubModule_1
]
})
export class GeneratedFormsModule { }
    
// Note: LoadXXXGeneratedForms() functions have been removed. Tree-shaking prevention
// is now handled by the pre-built class registration manifest system.
// See packages/CodeGenLib/CLASS_MANIFEST_GUIDE.md for details.
    