import { Component } from '@angular/core';
import { mjBizAppsAccountingGLAccountRoleEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: GL Account Roles') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingglaccountrole-form',
    templateUrl: './mjbizappsaccountingglaccountrole.form.component.html'
})
export class mjBizAppsAccountingGLAccountRoleFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingGLAccountRoleEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'roleConfiguration', sectionName: 'Role Configuration', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingGLAccountLinks', sectionName: 'GL Account Links', isExpanded: false }
        ]);
    }
}

