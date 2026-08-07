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
            { sectionKey: 'jurisdictionConfiguration', sectionName: 'Jurisdiction Configuration', isExpanded: true },
            { sectionKey: 'geographicScope', sectionName: 'Geographic Scope', isExpanded: true },
            { sectionKey: 'relationships', sectionName: 'Relationships', isExpanded: true },
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingTaxLiabilities', sectionName: 'Tax Liabilities', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingCompanyTaxNexus', sectionName: 'Company Tax Nexus', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingTaxJurisdictions', sectionName: 'Tax Jurisdictions', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingTaxRates', sectionName: 'Tax Rates', isExpanded: false }
        ]);
    }
}

