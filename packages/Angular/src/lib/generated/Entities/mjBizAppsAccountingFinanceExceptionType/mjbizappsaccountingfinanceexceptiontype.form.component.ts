import { Component } from '@angular/core';
import { mjBizAppsAccountingFinanceExceptionTypeEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Finance Exception Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingfinanceexceptiontype-form',
    templateUrl: './mjbizappsaccountingfinanceexceptiontype.form.component.html'
})
export class mjBizAppsAccountingFinanceExceptionTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingFinanceExceptionTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsAccountingFinanceExceptions', sectionName: 'Finance Exceptions', isExpanded: false }
        ]);
    }
}

