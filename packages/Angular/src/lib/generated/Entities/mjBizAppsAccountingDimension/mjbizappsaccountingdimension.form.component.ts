import { Component } from '@angular/core';
import { mjBizAppsAccountingDimensionEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Dimensions') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingdimension-form',
    templateUrl: './mjbizappsaccountingdimension.form.component.html'
})
export class mjBizAppsAccountingDimensionFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingDimensionEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'dimensionDefinition', sectionName: 'Dimension Definition', isExpanded: true },
            { sectionKey: 'configuration', sectionName: 'Configuration', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntryLineDimensions', sectionName: 'Journal Entry Line Dimensions', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingDimensionValues', sectionName: 'Dimension Values', isExpanded: false }
        ]);
    }
}

