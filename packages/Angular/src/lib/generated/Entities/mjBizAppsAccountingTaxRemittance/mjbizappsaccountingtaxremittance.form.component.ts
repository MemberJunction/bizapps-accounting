import { Component } from '@angular/core';
import { mjBizAppsAccountingTaxRemittanceEntity } from '@mj-biz-apps/accounting-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Tax Remittances') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappsaccountingtaxremittance-form',
    templateUrl: './mjbizappsaccountingtaxremittance.form.component.html'
})
export class mjBizAppsAccountingTaxRemittanceFormComponent extends BaseFormComponent {
    public record!: mjBizAppsAccountingTaxRemittanceEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'remittanceDetails', sectionName: 'Remittance Details', isExpanded: true },
            { sectionKey: 'accountingRecords', sectionName: 'Accounting Records', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsAccountingJournalEntries', sectionName: 'Journal Entries', isExpanded: false }
        ]);
    }
}

