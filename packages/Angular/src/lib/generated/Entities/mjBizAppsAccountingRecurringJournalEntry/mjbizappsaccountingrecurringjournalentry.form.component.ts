import { Component } from '@angular/core';
import { mjBizAppsAccountingRecurringJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Recurring Journal Entries') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingrecurringjournalentry-form',
    templateUrl: './mjbizappsaccountingrecurringjournalentry.form.component.html'
})
export class mjBizAppsAccountingRecurringJournalEntryFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingRecurringJournalEntryEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'scheduleConfiguration', sectionName: 'Schedule Configuration', isExpanded: true },
            { sectionKey: 'scheduleTimeline', sectionName: 'Schedule Timeline', isExpanded: true },
            { sectionKey: 'processingSettings', sectionName: 'Processing Settings', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntries', sectionName: 'Journal Entries', isExpanded: false }
        ]);
    }
}

