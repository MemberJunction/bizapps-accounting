import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';
import { AccountingOverviewPageComponent } from '../overview/accounting-overview.component';

/**
 * Top-level Explorer Resource for Accounting Overview Dashboard.
 * Mounts the Executive & Operational Accounting overview dashboard.
 */
@RegisterClass(BaseResourceComponent, 'AccountingOverviewResource')
@Component({
  standalone: true,
  imports: [AccountingOverviewPageComponent],
  selector: 'mj-accounting-overview-resource',
  template: `
    <mj-accounting-overview-page></mj-accounting-overview-page>
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`]
})
export class AccountingOverviewResourceComponent extends BaseResourceComponent implements OnInit {
  override ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Overview';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-chart-pie';
  }
}

/** Tree-shaking prevention */
export function LoadAccountingOverviewResource(): void {
  // No-op. Anchors @RegisterClass(BaseResourceComponent, 'AccountingOverviewResource')
  void AccountingOverviewResourceComponent;
}
