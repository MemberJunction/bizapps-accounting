import { Component } from '@angular/core';
import { mjBizAppsAccountingJournalEntryBatchLineItemEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Journal Entry Batch Line Items') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingjournalentrybatchlineitem-form',
    templateUrl: './mjbizappsaccountingjournalentrybatchlineitem.form.component.html'
})
export class mjBizAppsAccountingJournalEntryBatchLineItemFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingJournalEntryBatchLineItemEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsAccountingJournalEntryBatchLineDimensions', sectionName: 'Journal Entry Batch Line Dimensions', isExpanded: false }
        ]);
    }
}

