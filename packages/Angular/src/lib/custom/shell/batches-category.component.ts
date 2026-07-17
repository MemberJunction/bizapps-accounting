import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { ResourceData } from '@memberjunction/core-entities';
import { RunView } from '@memberjunction/core';
import { MJLeftNavSection } from '@memberjunction/ng-ui-components';
import { CategoryShellBase, type ShellHeaderStat } from './category-shell.base';
import { PageRefreshService } from '../../transfer-pending/shell-refresh/page-refresh.service';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

/**
 * Batches category shell (UI plan §8.0 / §8.2) — the highest-pain flow (§1/§2).
 *
 * Rail: Dashboard · All batches · Batch workspace | WORK: Batch approvals (badge) · Dispatch status.
 *
 * All batches + Batch approvals host the EXISTING BatchStatus / BatchDispatch dashboards, migrated
 * to interior chrome so they nest without a doubled header (the §6 consistency sweep for those two
 * screens). Their engines/tests are untouched — this is a chrome + hosting change.
 */
@Component({
  standalone: false,
  selector: 'mj-batches-category',
  templateUrl: './batches-category.component.html',
  styleUrls: ['./category-shell.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PageRefreshService], // per-shell: two open categories must not refresh each other
})
@RegisterClass(BaseDashboard, 'BatchesCategoryDashboard')
export class BatchesCategoryComponent extends CategoryShellBase {
  public CategoryTitle = 'Batches';
  public override get CategoryIcon(): string {
    return 'fa-solid fa-boxes-stacked';
  }
  protected get DefaultPageId(): string {
    return 'all-batches';
  }

  /** Cheap filtered count for the rail badge — never an on-demand heavy aggregate (§0). */
  public AwaitingApprovalCount = 0;
  public FailedCount = 0;

  /**
   * The category's through-line: what is waiting on a human, and what the ERP rejected. Batches are
   * multi-company (CH-4) so these are deliberately UNSCOPED — scoping them by the chip would hide a
   * batch that merely touches another company.
   */
  public override get HeaderStats(): ShellHeaderStat[] {
    const stats: ShellHeaderStat[] = [];
    if (this.AwaitingApprovalCount > 0) {
      stats.push({
        Label: `${this.AwaitingApprovalCount} awaiting approval`,
        Icon: 'fa-solid fa-user-check',
        Variant: 'warning',
        Tooltip: 'Built batches that cannot dispatch until a CFO approves them.',
      });
    }
    if (this.FailedCount > 0) {
      stats.push({
        Label: `${this.FailedCount} dispatch failed`,
        Icon: 'fa-solid fa-circle-exclamation',
        Variant: 'error',
        Tooltip: 'The ERP rejected these. They are retryable from Dispatch status.',
      });
    }
    if (stats.length === 0) {
      stats.push({ Label: 'Nothing waiting', Icon: 'fa-solid fa-check', Variant: 'success', Tooltip: 'No batch is awaiting approval or has a failed dispatch.' });
    }
    return stats;
  }

  public get RailSections(): MJLeftNavSection[] {
    return [
      {
        label: 'MAIN',
        items: [
          { id: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-gauge-high' },
          { id: 'all-batches', label: 'All batches', icon: 'fa-solid fa-layer-group' },
          { id: 'workspace', label: 'Batch workspace', icon: 'fa-solid fa-diagram-project' },
        ],
      },
      {
        label: 'WORK',
        items: [
          {
            id: 'approvals',
            label: 'Batch approvals',
            icon: 'fa-solid fa-paper-plane',
            // Omit a zero badge — a grey "0" is noise, not information.
            badge: this.AwaitingApprovalCount > 0 ? this.AwaitingApprovalCount : undefined,
          },
          { id: 'dispatch', label: 'Dispatch status', icon: 'fa-solid fa-truck-fast' },
        ],
      },
    ];
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Batches';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-layer-group';
  }

  protected async loadCategoryData(): Promise<void> {
    await this.loadApprovalBadge();
  }

  /** Pending batches are the ones sitting in the approval inbox. Count-only read. */
  private async loadApprovalBadge(): Promise<void> {
    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const res = await rv.RunView(
      {
        EntityName: BATCH_ENTITY,
        ExtraFilter: `Status='Pending'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
      },
      this.ProviderToUse.CurrentUser,
    );
    this.AwaitingApprovalCount = res.Success ? (res.TotalRowCount ?? 0) : 0;
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadBatchesCategory(): void {
  // No-op.
}
