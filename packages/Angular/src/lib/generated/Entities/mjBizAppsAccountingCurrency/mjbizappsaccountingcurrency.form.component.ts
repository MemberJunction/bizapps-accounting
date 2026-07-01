import { Component } from '@angular/core';
import { mjBizAppsAccountingCurrencyEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Currencies') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingcurrency-form',
    templateUrl: './mjbizappsaccountingcurrency.form.component.html'
})
export class mjBizAppsAccountingCurrencyFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingCurrencyEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsAccountingJournalEntryLines', sectionName: 'Journal Entry Lines', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountBalanceByDimensions', sectionName: 'Account Balance By Dimensions', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingCurrencySpotRatesFromCurrencyCode', sectionName: 'Currency Spot Rates (From Currency Code)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingCurrencySpotRatesToCurrencyCode', sectionName: 'Currency Spot Rates (To Currency Code)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingGLAccounts', sectionName: 'GL Accounts', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountingCompanyProfilesFunctionalCurrencyCode', sectionName: 'Accounting Company Profiles (Functional Currency Code)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountingCompanyProfilesReportingCurrencyCode', sectionName: 'Accounting Company Profiles (Reporting Currency Code)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingScheduledJournalEntries', sectionName: 'Scheduled Journal Entries', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountBalances', sectionName: 'Account Balances', isExpanded: false }
        ]);
    }
}

