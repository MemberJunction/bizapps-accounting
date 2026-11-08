import { Component } from '@angular/core';
import { mjBizAppsAccountingFinanceExceptionEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Finance Exceptions') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingfinanceexception-form',
    templateUrl: './mjbizappsaccountingfinanceexception.form.component.html'
})
export class mjBizAppsAccountingFinanceExceptionFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingFinanceExceptionEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'exceptionDetails', sectionName: 'Exception Details', isExpanded: true },
            { sectionKey: 'source', sectionName: 'Source', isExpanded: true },
            { sectionKey: 'review', sectionName: 'Review', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

