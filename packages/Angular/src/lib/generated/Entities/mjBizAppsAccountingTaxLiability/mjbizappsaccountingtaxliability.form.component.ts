import { Component } from '@angular/core';
import { mjBizAppsAccountingTaxLiabilityEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Tax Liabilities') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingtaxliability-form',
    templateUrl: './mjbizappsaccountingtaxliability.form.component.html'
})
export class mjBizAppsAccountingTaxLiabilityFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingTaxLiabilityEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsAccountingTaxRemittances', sectionName: 'Tax Remittances', isExpanded: false }
        ]);
    }
}

