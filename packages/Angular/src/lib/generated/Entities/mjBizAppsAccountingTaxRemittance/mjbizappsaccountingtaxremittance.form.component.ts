import { Component } from '@angular/core';
import { mjBizAppsAccountingTaxRemittanceEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Tax Remittances') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingtaxremittance-form',
    templateUrl: './mjbizappsaccountingtaxremittance.form.component.html'
})
export class mjBizAppsAccountingTaxRemittanceFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingTaxRemittanceEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

