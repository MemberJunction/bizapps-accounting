import { Component } from '@angular/core';
import { mjBizAppsAccountingJournalEntryBatchSequenceEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Journal Entry Batch Sequences') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingjournalentrybatchsequence-form',
    templateUrl: './mjbizappsaccountingjournalentrybatchsequence.form.component.html'
})
export class mjBizAppsAccountingJournalEntryBatchSequenceFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingJournalEntryBatchSequenceEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'batchConfiguration', sectionName: 'Batch Configuration', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

