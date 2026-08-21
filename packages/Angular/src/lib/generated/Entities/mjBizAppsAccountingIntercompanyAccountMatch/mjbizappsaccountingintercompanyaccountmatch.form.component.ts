import { Component } from '@angular/core';
import { mjBizAppsAccountingIntercompanyAccountMatchEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Intercompany Account Matches') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingintercompanyaccountmatch-form',
    templateUrl: './mjbizappsaccountingintercompanyaccountmatch.form.component.html'
})
export class mjBizAppsAccountingIntercompanyAccountMatchFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingIntercompanyAccountMatchEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'intercompanyMapping', sectionName: 'Intercompany Mapping', isExpanded: true },
            { sectionKey: 'accountingConfiguration', sectionName: 'Accounting Configuration', isExpanded: true },
            { sectionKey: 'operationalStatus', sectionName: 'Operational Status', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingIntercompanyAccountMatchDimensions', sectionName: 'Intercompany Account Match Dimensions', isExpanded: false }
        ]);
    }
}

