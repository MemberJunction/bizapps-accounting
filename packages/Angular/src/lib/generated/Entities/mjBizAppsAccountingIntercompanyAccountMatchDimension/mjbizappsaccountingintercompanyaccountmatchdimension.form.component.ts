import { Component } from '@angular/core';
import { mjBizAppsAccountingIntercompanyAccountMatchDimensionEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Intercompany Account Match Dimensions') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingintercompanyaccountmatchdimension-form',
    templateUrl: './mjbizappsaccountingintercompanyaccountmatchdimension.form.component.html'
})
export class mjBizAppsAccountingIntercompanyAccountMatchDimensionFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingIntercompanyAccountMatchDimensionEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'intercompanyConfiguration', sectionName: 'Intercompany Configuration', isExpanded: true },
            { sectionKey: 'dimensionMapping', sectionName: 'Dimension Mapping', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

