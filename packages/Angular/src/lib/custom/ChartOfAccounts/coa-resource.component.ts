import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for Chart of Accounts — the class the application nav metadata targets via
 * DriverClass "ChartOfAccountsResource". Thin BaseResourceComponent hosting the dashboard, which owns
 * the page chrome. Mirrors JournalEntryConsoleResource.
 */
@RegisterClass(BaseResourceComponent, 'ChartOfAccountsResource')
@Component({
  standalone: false,
  selector: 'mj-chart-of-accounts-resource',
  template: `<mj-chart-of-accounts-dashboard></mj-chart-of-accounts-dashboard>`,
})
export class ChartOfAccountsResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Chart of Accounts';
  }
  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-sitemap';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadChartOfAccountsResource(): void {
  // No-op. Keeps @RegisterClass(BaseResourceComponent, 'ChartOfAccountsResource') alive.
}
