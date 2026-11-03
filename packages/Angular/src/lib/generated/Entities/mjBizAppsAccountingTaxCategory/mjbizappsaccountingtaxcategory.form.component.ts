import { Component } from '@angular/core';
import { mjBizAppsAccountingTaxCategoryEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Tax Categories')
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingtaxcategory-form',
    templateUrl: './mjbizappsaccountingtaxcategory.form.component.html'
})
export class mjBizAppsAccountingTaxCategoryFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingTaxCategoryEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'categoryDetails', sectionName: 'Category Details', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingTaxRates', sectionName: 'Tax Rates', isExpanded: false }
        ]);
    }
}
