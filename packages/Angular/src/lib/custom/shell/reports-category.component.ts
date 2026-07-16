import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { ResourceData } from '@memberjunction/core-entities';
import { MJLeftNavSection } from '@memberjunction/ng-ui-components';
import { CategoryShellBase } from './category-shell.base';

/**
 * Reports category shell (UI plan §8.0). One of the five Explorer app nav items; hosts MJ's
 * <mj-left-nav> + this category's pages.
 */
@Component({
  standalone: false,
  selector: 'mj-reports-category',
  templateUrl: './reports-category.component.html',
  styleUrls: ['./category-shell.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'ReportsCategoryDashboard')
export class ReportsCategoryComponent extends CategoryShellBase {
  public CategoryTitle = 'Reports';
  protected get DefaultPageId(): string {
    return 'trial-balance';
  }

  public get RailSections(): MJLeftNavSection[] {
    return [
      {
        // No section header — a single flat group (mj-left-nav renders unlabelled sections as-is).
        items: [
          { id: 'ar-aging', label: 'AR Aging', icon: 'fa-solid fa-hourglass-half' },
          { id: 'defrev', label: 'DefRev Rollforward', icon: 'fa-solid fa-chart-line' },
          { id: 'trial-balance', label: 'Trial balance (AR)', icon: 'fa-solid fa-scale-balanced' },
          { id: 'recon', label: 'AR↔GL recon', icon: 'fa-solid fa-code-compare' },
          { id: 'gl-detail', label: 'GL detail (subledger)', icon: 'fa-solid fa-table-list' },
          { id: 'dimension-pl', label: 'Dimension P&L', icon: 'fa-solid fa-chart-pie' },
          { id: 'sales-tax', label: 'Sales tax liability', icon: 'fa-solid fa-receipt' },
        ],
      },
    ];
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Reports';
  }
  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-chart-column';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadReportsCategory(): void {
  // No-op.
}
