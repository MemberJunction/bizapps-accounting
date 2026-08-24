import { Component } from '@angular/core';
import { mjBizAppsAccountingTaxLiabilityEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

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
            { sectionKey: 'taxLiabilityContext', sectionName: 'Tax Liability Context', isExpanded: true },
            { sectionKey: 'financialDetails', sectionName: 'Financial Details', isExpanded: true },
            { sectionKey: 'filingAndStatus', sectionName: 'Filing and Status', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

