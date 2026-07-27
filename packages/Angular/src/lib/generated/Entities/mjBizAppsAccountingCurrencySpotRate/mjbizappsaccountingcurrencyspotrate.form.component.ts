import { Component } from '@angular/core';
import { mjBizAppsAccountingCurrencySpotRateEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Currency Spot Rates') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingcurrencyspotrate-form',
    templateUrl: './mjbizappsaccountingcurrencyspotrate.form.component.html'
})
export class mjBizAppsAccountingCurrencySpotRateFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingCurrencySpotRateEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

