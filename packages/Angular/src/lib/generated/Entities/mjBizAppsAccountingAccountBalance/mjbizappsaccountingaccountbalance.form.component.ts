import { Component } from '@angular/core';
import { mjBizAppsAccountingAccountBalanceEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Account Balances') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingaccountbalance-form',
    templateUrl: './mjbizappsaccountingaccountbalance.form.component.html'
})
export class mjBizAppsAccountingAccountBalanceFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingAccountBalanceEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'accountContext', sectionName: 'Account Context', isExpanded: true },
            { sectionKey: 'financialMetrics', sectionName: 'Financial Metrics', isExpanded: true },
            { sectionKey: 'processingInformation', sectionName: 'Processing Information', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

