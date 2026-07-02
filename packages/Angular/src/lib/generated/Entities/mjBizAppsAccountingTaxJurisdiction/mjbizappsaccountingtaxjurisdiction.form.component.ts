import { Component } from '@angular/core';
import { mjBizAppsAccountingTaxJurisdictionEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Tax Jurisdictions') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingtaxjurisdiction-form',
    templateUrl: './mjbizappsaccountingtaxjurisdiction.form.component.html'
})
export class mjBizAppsAccountingTaxJurisdictionFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingTaxJurisdictionEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsAccountingTaxLiabilities', sectionName: 'Tax Liabilities', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingTaxRates', sectionName: 'Tax Rates', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingCustomerTaxProfiles', sectionName: 'Customer Tax Profiles', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingTaxJurisdictions', sectionName: 'Tax Jurisdictions', isExpanded: false }
        ]);
    }
}

