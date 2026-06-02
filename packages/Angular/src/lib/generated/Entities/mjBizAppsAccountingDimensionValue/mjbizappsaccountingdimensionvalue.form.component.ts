import { Component } from '@angular/core';
import { mjBizAppsAccountingDimensionValueEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Dimension Values') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingdimensionvalue-form',
    templateUrl: './mjbizappsaccountingdimensionvalue.form.component.html'
})
export class mjBizAppsAccountingDimensionValueFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingDimensionValueEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'dimensionConfiguration', sectionName: 'Dimension Configuration', isExpanded: true },
            { sectionKey: 'valueDetails', sectionName: 'Value Details', isExpanded: true },
            { sectionKey: 'hierarchy', sectionName: 'Hierarchy', isExpanded: true },
            { sectionKey: 'validityPeriod', sectionName: 'Validity Period', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntryLineDimensions', sectionName: 'Journal Entry Line Dimensions', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingDimensionValues', sectionName: 'Dimension Values', isExpanded: false }
        ]);
    }
}

