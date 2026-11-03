import { Component } from '@angular/core';
import { mjBizAppsAccountingExternalAccountingSystemEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: External Accounting Systems')
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingexternalaccountingsystem-form',
    templateUrl: './mjbizappsaccountingexternalaccountingsystem.form.component.html'
})
export class mjBizAppsAccountingExternalAccountingSystemFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingExternalAccountingSystemEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'systemDetails', sectionName: 'System Details', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}
