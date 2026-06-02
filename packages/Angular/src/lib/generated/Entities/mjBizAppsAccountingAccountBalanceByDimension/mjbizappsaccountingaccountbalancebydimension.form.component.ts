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
            { sectionKey: 'accountingContext', sectionName: 'Accounting Context', isExpanded: true },
            { sectionKey: 'dimensionAnalysis', sectionName: 'Dimension Analysis', isExpanded: true },
            { sectionKey: 'financialMetrics', sectionName: 'Financial Metrics', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

