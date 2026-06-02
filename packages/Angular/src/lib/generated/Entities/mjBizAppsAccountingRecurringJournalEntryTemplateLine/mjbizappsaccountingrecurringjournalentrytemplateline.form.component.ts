import { Component } from '@angular/core';
import { mjBizAppsAccountingRecurringJournalEntryTemplateLineEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Recurring Journal Entry Template Lines') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingrecurringjournalentrytemplateline-form',
    templateUrl: './mjbizappsaccountingrecurringjournalentrytemplateline.form.component.html'
})
export class mjBizAppsAccountingRecurringJournalEntryTemplateLineFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingRecurringJournalEntryTemplateLineEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'templateConfiguration', sectionName: 'Template Configuration', isExpanded: true },
            { sectionKey: 'accountingDetails', sectionName: 'Accounting Details', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

