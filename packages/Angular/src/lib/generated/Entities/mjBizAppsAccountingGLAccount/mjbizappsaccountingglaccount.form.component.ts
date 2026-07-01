import { Component } from '@angular/core';
import { mjBizAppsAccountingGLAccountEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: GL Accounts') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingglaccount-form',
    templateUrl: './mjbizappsaccountingglaccount.form.component.html'
})
export class mjBizAppsAccountingGLAccountFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingGLAccountEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsAccountingAccountBalanceByDimensions', sectionName: 'Account Balance By Dimensions', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingScheduledJournalEntryLineItems', sectionName: 'Scheduled Journal Entry Line Items', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntryLines', sectionName: 'Journal Entry Lines', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingChartOfAccountsMappings', sectionName: 'Chart Of Accounts Mappings', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingGLAccounts', sectionName: 'GL Accounts', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountingCompanyProfilesDeferredRevenueGLAccountID', sectionName: 'Accounting Company Profiles (Deferred Revenue GL Account ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountingCompanyProfilesSalesTaxPayableGLAccountID', sectionName: 'Accounting Company Profiles (Sales Tax Payable GL Account ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountingCompanyProfilesUnrealizedFXGainLossGLAccountID', sectionName: 'Accounting Company Profiles (Unrealized FX Gain Loss GL Account ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountingCompanyProfilesRealizedFXGainLossGLAccountID', sectionName: 'Accounting Company Profiles (Realized FX Gain Loss GL Account ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountingCompanyProfilesAROpenGLAccountID', sectionName: 'Accounting Company Profiles (AR Open GL Account ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntryBatchLineItems', sectionName: 'Journal Entry Batch Line Items', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountBalances', sectionName: 'Account Balances', isExpanded: false }
        ]);
    }
}

