import { Component } from '@angular/core';
import { mjBizAppsAccountingJournalEntryLineDimensionEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Journal Entry Line Dimensions') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingjournalentrylinedimension-form',
    templateUrl: './mjbizappsaccountingjournalentrylinedimension.form.component.html'
})
export class mjBizAppsAccountingJournalEntryLineDimensionFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingJournalEntryLineDimensionEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'journalEntryMapping', sectionName: 'Journal Entry Mapping', isExpanded: true },
            { sectionKey: 'dimensionDetails', sectionName: 'Dimension Details', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

