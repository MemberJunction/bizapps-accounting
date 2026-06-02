import { Component } from '@angular/core';
import { mjBizAppsAccountingTaxAuthorityEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Tax Authorities') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingtaxauthority-form',
    templateUrl: './mjbizappsaccountingtaxauthority.form.component.html'
})
export class mjBizAppsAccountingTaxAuthorityFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingTaxAuthorityEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'authorityDetails', sectionName: 'Authority Details', isExpanded: true },
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingTaxJurisdictions', sectionName: 'Tax Jurisdictions', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingTaxLiabilities', sectionName: 'Tax Liabilities', isExpanded: false }
        ]);
    }
}

