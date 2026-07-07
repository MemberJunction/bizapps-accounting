import { Component } from '@angular/core';
import { mjBizAppsAccountingGLAccountLinkDimensionEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: GL Account Link Dimensions') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingglaccountlinkdimension-form',
    templateUrl: './mjbizappsaccountingglaccountlinkdimension.form.component.html'
})
export class mjBizAppsAccountingGLAccountLinkDimensionFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingGLAccountLinkDimensionEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

