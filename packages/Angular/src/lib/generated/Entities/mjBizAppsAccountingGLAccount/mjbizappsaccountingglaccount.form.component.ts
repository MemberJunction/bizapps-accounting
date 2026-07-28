import { Component } from '@angular/core';
import { mjBizAppsAccountingGLAccountEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: GL Accounts') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingglaccount-form',
    templateUrl: './mjbizappsaccountingglaccount.form.component.html'
})
export class mjBizAppsAccountingGLAccountFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingGLAccountEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'accountDetails', sectionName: 'Account Details', isExpanded: true },
            { sectionKey: 'hierarchyAndStructure', sectionName: 'Hierarchy and Structure', isExpanded: true },
            { sectionKey: 'integrationSettings', sectionName: 'Integration Settings', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntryLines', sectionName: 'Journal Entry Lines', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingIntercompanyAccountMatchesDueFromGLAccountID', sectionName: 'Intercompany Account Matches (Due From GL Account)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingIntercompanyAccountMatchesDueToGLAccountID', sectionName: 'Intercompany Account Matches (Due To GL Account)', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingGLAccounts', sectionName: 'GL Accounts', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingGLAccountLinks', sectionName: 'GL Account Links', isExpanded: false }
        ]);
    }
}

