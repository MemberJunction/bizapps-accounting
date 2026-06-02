import { Component } from '@angular/core';
import { mjBizAppsAccountingCustomerTaxProfileEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Customer Tax Profiles') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingcustomertaxprofile-form',
    templateUrl: './mjbizappsaccountingcustomertaxprofile.form.component.html'
})
export class mjBizAppsAccountingCustomerTaxProfileFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingCustomerTaxProfileEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'customerInformation', sectionName: 'Customer Information', isExpanded: true },
            { sectionKey: 'taxationDetails', sectionName: 'Taxation Details', isExpanded: true },
            { sectionKey: 'exemptionDetails', sectionName: 'Exemption Details', isExpanded: true },
            { sectionKey: 'profileTimeline', sectionName: 'Profile Timeline', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

