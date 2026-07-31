import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for Company Setup — the class the application nav metadata targets via
 * DriverClass "CompanySetupResource". Thin BaseResourceComponent hosting the dashboard, which owns
 * the page chrome. Mirrors JournalEntryConsoleResource.
 */
@RegisterClass(BaseResourceComponent, 'CompanySetupResource')
@Component({
  standalone: false,
  selector: 'mj-company-setup-resource',
  template: `<mj-company-setup-dashboard></mj-company-setup-dashboard>`,
})
export class CompanySetupResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Company Setup';
  }
  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-building';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadCompanySetupResource(): void {
  // No-op. Keeps @RegisterClass(BaseResourceComponent, 'CompanySetupResource') alive.
}
