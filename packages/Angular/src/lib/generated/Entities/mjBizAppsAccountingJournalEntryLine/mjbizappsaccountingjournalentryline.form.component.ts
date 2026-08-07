import { Component } from '@angular/core';
import { mjBizAppsAccountingJournalEntryLineEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Journal Entry Lines') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingjournalentryline-form',
    templateUrl: './mjbizappsaccountingjournalentryline.form.component.html'
})
export class mjBizAppsAccountingJournalEntryLineFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingJournalEntryLineEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'journalEntryDetails', sectionName: 'Journal Entry Details', isExpanded: true },
            { sectionKey: 'financialAmounts', sectionName: 'Financial Amounts', isExpanded: true },
            { sectionKey: 'multiCurrencyDetails', sectionName: 'Multi-Currency Details', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntryLineDimensions', sectionName: 'Journal Entry Line Dimensions', isExpanded: false }
        ]);
    }
}

