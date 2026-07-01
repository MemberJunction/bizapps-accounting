import { Component } from '@angular/core';
import { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Journal Entries') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingjournalentry-form',
    templateUrl: './mjbizappsaccountingjournalentry.form.component.html'
})
export class mjBizAppsAccountingJournalEntryFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingJournalEntryEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsAccountingJournalEntriesReversedByJournalEntryID', sectionName: 'Journal Entries (Reversed By Journal Entry ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntriesReversesJournalEntryID', sectionName: 'Journal Entries (Reverses Journal Entry ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntryLinks', sectionName: 'Journal Entry Links', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingScheduledJournalEntries', sectionName: 'Scheduled Journal Entries', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingTaxRemittances', sectionName: 'Tax Remittances', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntryLines', sectionName: 'Journal Entry Lines', isExpanded: false }
        ]);
    }
}

