import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { ResourceData } from '@memberjunction/core-entities';
import { MJLeftNavSection } from '@memberjunction/ng-ui-components';
import { CategoryShellBase } from './category-shell.base';
import { PageRefreshService } from '../../transfer-pending/shell-refresh/page-refresh.service';

/**
 * Accounts category shell (UI plan §8.0). One of the five Explorer app nav items; hosts MJ's
 * <mj-left-nav> + this category's pages.
 */
@Component({
  standalone: false,
  selector: 'mj-accounts-category',
  templateUrl: './accounts-category.component.html',
  styleUrls: ['./category-shell.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PageRefreshService], // per-shell: two open categories must not refresh each other
})
@RegisterClass(BaseDashboard, 'AccountsCategoryDashboard')
export class AccountsCategoryComponent extends CategoryShellBase {
  // ── Header create verb (Marcelo 2026-08-05: every New-<x> lives in the CATEGORY header,
  // orders-style). The verb is the ACTIVE PAGE's create — label and action swap with the page,
  // and pages with no create show none. Signals are monotonic counters the pages watch via input.
  public CreateSignalAccounts = 0;
  public CreateSignalCoa = 0;
  public CreateSignalDimensions = 0;

  public get CreateVerb(): string | null {
    switch (this.ActivePageId) {
      case 'accounts': return 'New account';
      case 'coa': return 'New account';
      case 'dimensions': return 'New dimension';
      default: return null;
    }
  }

  public OnHeaderCreate(): void {
    switch (this.ActivePageId) {
      case 'accounts': this.CreateSignalAccounts++; break;
      case 'coa': this.CreateSignalCoa++; break;
      case 'dimensions': this.CreateSignalDimensions++; break;
    }
  }

  public CategoryTitle = 'Accounts';
  public override get CategoryIcon(): string {
    return 'fa-solid fa-sitemap';
  }
  protected get DefaultPageId(): string {
    return 'coa';
  }

  public get RailSections(): MJLeftNavSection[] {
    return [
      {
        // No section header — a single flat group (mj-left-nav renders unlabelled sections as-is).
        items: [
          // The roster Marcelo asked for: "a page for account viewing that shows all the accounts".
          { id: 'accounts', label: 'All accounts', icon: 'fa-solid fa-list-ul' },
          { id: 'coa', label: 'Chart of accounts', icon: 'fa-solid fa-sitemap' },
          { id: 'links', label: 'Account links', icon: 'fa-solid fa-link' },
          { id: 'erp', label: 'ERP mapping', icon: 'fa-solid fa-plug' },
          { id: 'dimensions', label: 'Dimensions', icon: 'fa-solid fa-tags' },
        ],
      },
    ];
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Accounts';
  }
  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-sitemap';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadAccountsCategory(): void {
  // No-op.
}
