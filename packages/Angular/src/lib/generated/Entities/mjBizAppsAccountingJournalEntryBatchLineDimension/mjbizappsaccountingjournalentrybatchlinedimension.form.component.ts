import { Component } from '@angular/core';
import { mjBizAppsAccountingJournalEntryBatchLineDimensionEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingjournalentrybatchlinedimension-form',
    templateUrl: './mjbizappsaccountingjournalentrybatchlinedimension.form.component.html'
})
export class mjBizAppsAccountingJournalEntryBatchLineDimensionFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingJournalEntryBatchLineDimensionEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

