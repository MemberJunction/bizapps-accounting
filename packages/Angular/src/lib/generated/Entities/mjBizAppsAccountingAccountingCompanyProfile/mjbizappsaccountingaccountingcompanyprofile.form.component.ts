import { Component } from '@angular/core';
import { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Accounting Company Profiles') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingaccountingcompanyprofile-form',
    templateUrl: './mjbizappsaccountingaccountingcompanyprofile.form.component.html'
})
export class mjBizAppsAccountingAccountingCompanyProfileFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingAccountingCompanyProfileEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'accountingProfile', sectionName: 'Accounting Profile', isExpanded: true },
            { sectionKey: 'financialSettings', sectionName: 'Financial Settings', isExpanded: true },
            { sectionKey: 'gLAndDefaultSettings', sectionName: 'GL and Default Settings', isExpanded: true },
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'companyDetails', sectionName: 'Company Details', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingAccountingCompanyProfiles', sectionName: 'Accounting Company Profiles', isExpanded: false }
        ]);
    }
}

