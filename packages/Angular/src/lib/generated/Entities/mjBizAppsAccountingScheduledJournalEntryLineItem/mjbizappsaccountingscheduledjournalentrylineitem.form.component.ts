import { Component } from '@angular/core';
import { mjBizAppsAccountingScheduledJournalEntryLineItemEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Items') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingscheduledjournalentrylineitem-form',
    templateUrl: './mjbizappsaccountingscheduledjournalentrylineitem.form.component.html'
})
export class mjBizAppsAccountingScheduledJournalEntryLineItemFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingScheduledJournalEntryLineItemEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsAccountingScheduledJournalEntryLineDimensions', sectionName: 'Scheduled Journal Entry Line Dimensions', isExpanded: false }
        ]);
    }
}

