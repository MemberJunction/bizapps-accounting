import { Component } from '@angular/core';
import { mjBizAppsAccountingGLAccountLinkEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: GL Account Links') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingglaccountlink-form',
    templateUrl: './mjbizappsaccountingglaccountlink.form.component.html'
})
export class mjBizAppsAccountingGLAccountLinkFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingGLAccountLinkEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'accountingMapping', sectionName: 'Accounting Mapping', isExpanded: true },
            { sectionKey: 'targetRecord', sectionName: 'Target Record', isExpanded: true },
            { sectionKey: 'configuration', sectionName: 'Configuration', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingGLAccountLinkDimensions', sectionName: 'GL Account Link Dimensions', isExpanded: false }
        ]);
    }
}

