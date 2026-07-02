import { Component } from '@angular/core';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Journal Entry Batches') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingjournalentrybatch-form',
    templateUrl: './mjbizappsaccountingjournalentrybatch.form.component.html'
})
export class mjBizAppsAccountingJournalEntryBatchFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingJournalEntryBatchEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsAccountingJournalEntryBatchLineItems', sectionName: 'Journal Entry Batch Line Items', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntries', sectionName: 'Journal Entries', isExpanded: false }
        ]);
    }
}

