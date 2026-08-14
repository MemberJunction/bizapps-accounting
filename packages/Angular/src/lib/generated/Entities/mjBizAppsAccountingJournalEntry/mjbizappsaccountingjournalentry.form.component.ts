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
            { sectionKey: 'journalEntryDetails', sectionName: 'Journal Entry Details', isExpanded: true },
            { sectionKey: 'classification', sectionName: 'Classification', isExpanded: true },
            { sectionKey: 'lifecycleAndStatus', sectionName: 'Lifecycle and Status', isExpanded: true },
            { sectionKey: 'sourceIntegration', sectionName: 'Source Integration', isExpanded: true },
            { sectionKey: 'reversalTracking', sectionName: 'Reversal Tracking', isExpanded: true },
            { sectionKey: 'supportingDocumentation', sectionName: 'Supporting Documentation', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntriesReversedByJournalEntryID', sectionName: 'Journal Entries (Reversed By Journal Entry)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntriesReversesJournalEntryID', sectionName: 'Journal Entries (Reverses Journal Entry)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntryBatches', sectionName: 'Journal Entry Batches', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntryLines', sectionName: 'Journal Entry Lines', isExpanded: false }
        ]);
    }
}

