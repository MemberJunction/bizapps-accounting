import { Component } from '@angular/core';
import { mjBizAppsAccountingScheduledJournalEntryLineDimensionEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingscheduledjournalentrylinedimension-form',
    templateUrl: './mjbizappsaccountingscheduledjournalentrylinedimension.form.component.html'
})
export class mjBizAppsAccountingScheduledJournalEntryLineDimensionFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingScheduledJournalEntryLineDimensionEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

