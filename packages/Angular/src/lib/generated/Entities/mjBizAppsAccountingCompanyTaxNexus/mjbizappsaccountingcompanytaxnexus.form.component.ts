import { Component } from '@angular/core';
import { mjBizAppsAccountingCompanyTaxNexusEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Company Tax Nexus') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingcompanytaxnexus-form',
    templateUrl: './mjbizappsaccountingcompanytaxnexus.form.component.html'
})
export class mjBizAppsAccountingCompanyTaxNexusFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingCompanyTaxNexusEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

