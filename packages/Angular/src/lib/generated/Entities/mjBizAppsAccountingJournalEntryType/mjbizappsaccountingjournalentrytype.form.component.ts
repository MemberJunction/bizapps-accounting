import { Component } from '@angular/core';
import { mjBizAppsAccountingJournalEntryTypeEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Journal Entry Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingjournalentrytype-form',
    templateUrl: './mjbizappsaccountingjournalentrytype.form.component.html'
})
export class mjBizAppsAccountingJournalEntryTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingJournalEntryTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsAccountingJournalEntries', sectionName: 'Journal Entries', isExpanded: false }
        ]);
    }
}

