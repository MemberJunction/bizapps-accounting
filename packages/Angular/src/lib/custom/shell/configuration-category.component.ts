import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { ResourceData } from '@memberjunction/core-entities';
import { MJLeftNavSection } from '@memberjunction/ng-ui-components';
import { CategoryShellBase } from './category-shell.base';
import { PageRefreshService } from '../../transfer-pending/shell-refresh/page-refresh.service';

/**
 * Configuration category shell (UI plan §8.0). One of the five Explorer app nav items; hosts MJ's
 * <mj-left-nav> + this category's pages.
 */
@Component({
  standalone: false,
  selector: 'mj-configuration-category',
  templateUrl: './configuration-category.component.html',
  styleUrls: ['./category-shell.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PageRefreshService], // per-shell: two open categories must not refresh each other
})
@RegisterClass(BaseDashboard, 'ConfigurationCategoryDashboard')
export class ConfigurationCategoryComponent extends CategoryShellBase {
  // Header create verb = the ACTIVE page's create (Marcelo 2026-08-05, orders-style header rule).
  public CreateSignalCompanies = 0;

  public get CreateVerb(): string | null {
    return this.ActivePageId === 'companies' ? 'New company' : null;
  }

  public OnHeaderCreate(): void {
    if (this.ActivePageId === 'companies') this.CreateSignalCompanies++;
  }

  public CategoryTitle = 'Configuration';
  public override get CategoryIcon(): string {
    return 'fa-solid fa-gear';
  }
  protected get DefaultPageId(): string {
    return 'companies';
  }

  public get RailSections(): MJLeftNavSection[] {
    return [
      {
        // No section header — a single flat group (mj-left-nav renders unlabelled sections as-is).
        items: [
          { id: 'companies', label: 'Companies', icon: 'fa-solid fa-building' },
          { id: 'users', label: 'Users & roles', icon: 'fa-solid fa-user-shield' },
          { id: 'approvals', label: 'Approvals', icon: 'fa-solid fa-user-check' },
        ],
      },
    ];
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Configuration';
  }
  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-gear';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadConfigurationCategory(): void {
  // No-op.
}
