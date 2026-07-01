import { Component } from '@angular/core';
import { mjBizAppsAccountingAccountingPeriodEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Accounting Periods') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingaccountingperiod-form',
    templateUrl: './mjbizappsaccountingaccountingperiod.form.component.html'
})
export class mjBizAppsAccountingAccountingPeriodFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingAccountingPeriodEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsAccountingJournalEntryBatches', sectionName: 'Journal Entry Batches', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingTaxLiabilities', sectionName: 'Tax Liabilities', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountBalances', sectionName: 'Account Balances', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountBalanceByDimensions', sectionName: 'Account Balance By Dimensions', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingScheduledJournalEntries', sectionName: 'Scheduled Journal Entries', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntriesOriginalAccountingPeriodID', sectionName: 'Journal Entries (Original Accounting Period ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntriesAccountingPeriodID', sectionName: 'Journal Entries (Accounting Period ID)', isExpanded: false }
        ]);
    }
}

