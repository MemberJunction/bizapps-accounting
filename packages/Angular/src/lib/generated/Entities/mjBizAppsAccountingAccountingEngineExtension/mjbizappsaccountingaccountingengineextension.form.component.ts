import { Component } from '@angular/core';
import { mjBizAppsAccountingAccountingEngineExtensionEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Accounting Engine Extensions') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingaccountingengineextension-form',
    templateUrl: './mjbizappsaccountingaccountingengineextension.form.component.html'
})
export class mjBizAppsAccountingAccountingEngineExtensionFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingAccountingEngineExtensionEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'extensionDefinition', sectionName: 'Extension Definition', isExpanded: true },
            { sectionKey: 'operationalSettings', sectionName: 'Operational Settings', isExpanded: true },
            { sectionKey: 'configuration', sectionName: 'Configuration', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

