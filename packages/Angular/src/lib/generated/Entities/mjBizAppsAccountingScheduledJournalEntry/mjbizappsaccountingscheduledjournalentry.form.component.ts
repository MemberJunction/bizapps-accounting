import { Component } from '@angular/core';
import { mjBizAppsAccountingScheduledJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Scheduled Journal Entries') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingscheduledjournalentry-form',
    templateUrl: './mjbizappsaccountingscheduledjournalentry.form.component.html'
})
export class mjBizAppsAccountingScheduledJournalEntryFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingScheduledJournalEntryEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsAccountingJournalEntries', sectionName: 'Journal Entries', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingScheduledJournalEntries', sectionName: 'Scheduled Journal Entries', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingScheduledJournalEntryLineItems', sectionName: 'Scheduled Journal Entry Line Items', isExpanded: false }
        ]);
    }
}

