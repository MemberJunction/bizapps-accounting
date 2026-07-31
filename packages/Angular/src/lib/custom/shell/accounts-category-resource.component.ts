import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for the Accounts CATEGORY (`DriverClass: "AccountsCategoryResource"`).
 * Thin: the shell it hosts is a BaseDashboard and calls NotifyLoadComplete itself.
 */
@RegisterClass(BaseResourceComponent, 'AccountsCategoryResource')
@Component({
  standalone: false,
  selector: 'mj-accounts-category-resource',
  template: `<mj-accounts-category></mj-accounts-category>`,
})
export class AccountsCategoryResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
  }
  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Accounts';
  }
  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-sitemap';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadAccountsCategoryResource(): void {
  // No-op.
}
