import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for the Trial Balance & AR dashboard. The app nav targets this via
 * `DriverClass: "TrialBalanceARResource"`. Thin BaseResourceComponent hosting the dashboard
 * (which owns the page chrome) — mirrors stage-1 BatchDispatchResourceComponent.
 */
@RegisterClass(BaseResourceComponent, 'TrialBalanceARResource')
@Component({
  standalone: false,
  selector: 'mj-trial-balance-ar-resource',
  template: `<mj-trial-balance-ar-dashboard></mj-trial-balance-ar-dashboard>`,
})
export class TrialBalanceARResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Trial Balance & AR';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-scale-balanced';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadTrialBalanceARResource(): void {
  // No-op. Keeps the @RegisterClass(BaseResourceComponent, 'TrialBalanceARResource') from being shaken out.
}
