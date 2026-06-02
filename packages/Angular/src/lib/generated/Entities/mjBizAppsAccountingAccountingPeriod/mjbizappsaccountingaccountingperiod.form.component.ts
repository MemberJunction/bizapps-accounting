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
            { sectionKey: 'periodConfiguration', sectionName: 'Period Configuration', isExpanded: true },
            { sectionKey: 'periodTimeline', sectionName: 'Period Timeline', isExpanded: true },
            { sectionKey: 'lifecycleAndAudit', sectionName: 'Lifecycle and Audit', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntryBatches', sectionName: 'Journal Entry Batches', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntriesAccountingPeriodID', sectionName: 'Journal Entries (Accounting Period)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntriesOriginalAccountingPeriodID', sectionName: 'Journal Entries (Original Accounting Period)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountBalanceByDimensions', sectionName: 'Account Balance By Dimensions', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountBalances', sectionName: 'Account Balances', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingTaxLiabilities', sectionName: 'Tax Liabilities', isExpanded: false }
        ]);
    }
}

