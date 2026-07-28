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
            { sectionKey: 'jurisdictionDetails', sectionName: 'Jurisdiction Details', isExpanded: true },
            { sectionKey: 'taxRateConfiguration', sectionName: 'Tax Rate Configuration', isExpanded: true },
            { sectionKey: 'validityPeriod', sectionName: 'Validity Period', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

