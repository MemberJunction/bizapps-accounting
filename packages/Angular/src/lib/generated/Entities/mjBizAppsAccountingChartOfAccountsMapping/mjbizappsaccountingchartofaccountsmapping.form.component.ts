import { Component } from '@angular/core';
import { mjBizAppsAccountingChartOfAccountsMappingEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Chart Of Accounts Mappings') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingchartofaccountsmapping-form',
    templateUrl: './mjbizappsaccountingchartofaccountsmapping.form.component.html'
})
export class mjBizAppsAccountingChartOfAccountsMappingFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingChartOfAccountsMappingEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'mappingConfiguration', sectionName: 'Mapping Configuration', isExpanded: true },
            { sectionKey: 'accountDetails', sectionName: 'Account Details', isExpanded: true },
            { sectionKey: 'validityPeriod', sectionName: 'Validity Period', isExpanded: true },
            { sectionKey: 'approvalAudit', sectionName: 'Approval Audit', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

