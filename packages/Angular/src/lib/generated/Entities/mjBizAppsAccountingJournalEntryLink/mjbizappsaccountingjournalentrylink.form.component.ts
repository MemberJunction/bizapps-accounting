import { Component } from '@angular/core';
import { mjBizAppsAccountingJournalEntryLinkEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Journal Entry Links') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingjournalentrylink-form',
    templateUrl: './mjbizappsaccountingjournalentrylink.form.component.html'
})
export class mjBizAppsAccountingJournalEntryLinkFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingJournalEntryLinkEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'journalAssociation', sectionName: 'Journal Association', isExpanded: true },
            { sectionKey: 'targetRecordReference', sectionName: 'Target Record Reference', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

