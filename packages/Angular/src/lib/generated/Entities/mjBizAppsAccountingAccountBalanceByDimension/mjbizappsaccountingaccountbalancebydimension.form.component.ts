import { Component } from '@angular/core';
import { mjBizAppsAccountingAccountBalanceByDimensionEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Account Balance By Dimensions') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingaccountbalancebydimension-form',
    templateUrl: './mjbizappsaccountingaccountbalancebydimension.form.component.html'
})
export class mjBizAppsAccountingAccountBalanceByDimensionFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingAccountBalanceByDimensionEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

