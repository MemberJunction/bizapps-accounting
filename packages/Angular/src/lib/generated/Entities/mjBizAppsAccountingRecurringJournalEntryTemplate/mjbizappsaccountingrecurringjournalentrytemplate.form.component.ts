import { Component } from '@angular/core';
import { mjBizAppsAccountingRecurringJournalEntryTemplateEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Recurring Journal Entry Templates') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingrecurringjournalentrytemplate-form',
    templateUrl: './mjbizappsaccountingrecurringjournalentrytemplate.form.component.html'
})
export class mjBizAppsAccountingRecurringJournalEntryTemplateFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingRecurringJournalEntryTemplateEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'templateConfiguration', sectionName: 'Template Configuration', isExpanded: true },
            { sectionKey: 'accountingRules', sectionName: 'Accounting Rules', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingRecurringJournalEntryTemplateLines', sectionName: 'Recurring Journal Entry Template Lines', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingRecurringJournalEntries', sectionName: 'Recurring Journal Entries', isExpanded: false }
        ]);
    }
}

