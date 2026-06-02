import { Component } from '@angular/core';
import { mjBizAppsAccountingTaxRateEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Tax Rates') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingtaxrate-form',
    templateUrl: './mjbizappsaccountingtaxrate.form.component.html'
})
export class mjBizAppsAccountingTaxRateFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingTaxRateEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'jurisdictionAndCategory', sectionName: 'Jurisdiction and Category', isExpanded: true },
            { sectionKey: 'rateAndValidity', sectionName: 'Rate and Validity', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

