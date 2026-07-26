import { Component } from '@angular/core';
import { mjBizAppsAccountingJournalEntrySequenceEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Journal Entry Sequences') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingjournalentrysequence-form',
    templateUrl: './mjbizappsaccountingjournalentrysequence.form.component.html'
})
export class mjBizAppsAccountingJournalEntrySequenceFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingJournalEntrySequenceEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'sequenceConfiguration', sectionName: 'Sequence Configuration', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

