import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for the Revenue & Tax dashboard. App nav targets this via
 * `DriverClass: "RevenueTaxResource"`. Thin BaseResourceComponent hosting the dashboard.
 */
@RegisterClass(BaseResourceComponent, 'RevenueTaxResource')
@Component({
  standalone: false,
  selector: 'mj-revenue-tax-resource',
  template: `<mj-revenue-tax-dashboard></mj-revenue-tax-dashboard>`,
})
export class RevenueTaxResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Revenue & Tax';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-receipt';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadRevenueTaxResource(): void {
  // No-op.
}
