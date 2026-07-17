import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { ResourceData } from '@memberjunction/core-entities';
import { RunView } from '@memberjunction/core';
import { MJLeftNavSection } from '@memberjunction/ng-ui-components';
import { CategoryShellBase, type ShellHeaderStat } from './category-shell.base';
import { PageRefreshService } from '../../transfer-pending/shell-refresh/page-refresh.service';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/** Page ids for this category's rail. Local to the shell — not routes. */
export type JournalEntriesPageId =
  | 'dashboard'
  | 'all-entries'
  | 'workspace'
  | 'scheduled'
  | 'approvals';

/**
 * Journal Entries category shell (UI plan §8.0 / §8.1).
 *
 * One of the five Explorer app nav items ("categories"). Hosts MJ's `<mj-left-nav>` + this
 * category's pages: Dashboard · All journal entries · JE workspace | VIEWS: Scheduled entries ·
 * Awaiting approval (badge).
 */
@Component({
  standalone: false,
  selector: 'mj-journal-entries-category',
  templateUrl: './journal-entries-category.component.html',
  styleUrls: ['./category-shell.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PageRefreshService], // per-shell: two open categories must not refresh each other
})
@RegisterClass(BaseDashboard, 'JournalEntriesCategoryDashboard')
export class JournalEntriesCategoryComponent extends CategoryShellBase {
  public CategoryTitle = 'Journal Entries';
  public override get CategoryIcon(): string {
    return 'fa-solid fa-book-open';
  }
  protected get DefaultPageId(): string {
    return 'all-entries';
  }

  /** Cheap counts — filtered COUNTs, never heavy aggregates (§0 ruling). */
  public AwaitingApprovalCount = 0;
  public UnbatchedCount = 0;

  /**
   * The category's through-line: the two numbers an accountant cares about on EVERY journal-entry
   * page — what is still unbatched, and what is sitting in review. Both are the same cheap counts
   * the rail badge already uses, so the header and the rail cannot disagree.
   */
  public override get HeaderStats(): ShellHeaderStat[] {
    const stats: ShellHeaderStat[] = [
      {
        Label: `${this.UnbatchedCount} unbatched`,
        Icon: 'fa-solid fa-inbox',
        Variant: this.UnbatchedCount > 0 ? 'info' : 'default',
        Tooltip: 'Pending entries not yet in a batch — the pool the next batch build draws from.',
      },
    ];
    if (this.AwaitingApprovalCount > 0) {
      stats.push({
        Label: `${this.AwaitingApprovalCount} awaiting review`,
        Icon: 'fa-solid fa-user-check',
        Variant: 'warning',
        Tooltip: 'Manual entries a CFO would review (C.8). The gate is not yet in force.',
      });
    }
    return stats;
  }

  public get RailSections(): MJLeftNavSection[] {
    return [
      {
        label: 'MAIN',
        items: [
          { id: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-gauge-high' },
          { id: 'all-entries', label: 'All journal entries', icon: 'fa-solid fa-table-list' },
          { id: 'workspace', label: 'JE workspace', icon: 'fa-solid fa-diagram-project' },
        ],
      },
      {
        label: 'VIEWS',
        items: [
          { id: 'scheduled', label: 'Scheduled entries', icon: 'fa-regular fa-calendar-days' },
          {
            id: 'approvals',
            label: 'Awaiting approval',
            icon: 'fa-solid fa-user-check',
            // Omit a zero badge entirely — a grey "0" is noise, not information.
            badge: this.AwaitingApprovalCount > 0 ? this.AwaitingApprovalCount : undefined,
          },
        ],
      },
    ];
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Journal Entries';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-book-open';
  }

  protected async loadCategoryData(): Promise<void> {
    await Promise.all([this.loadApprovalBadge(), this.loadUnbatchedCount()]);
  }

  /** Pending = unbatched: the ledger's Status goes Pending -> Batched (§4). One cheap count. */
  private async loadUnbatchedCount(): Promise<void> {
    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const res = await rv.RunView(
      {
        EntityName: JE_ENTITY,
        ExtraFilter: this.Scope.ComposeFilter(`Status='Pending'`),
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
      },
      this.ProviderToUse.CurrentUser,
    );
    this.UnbatchedCount = res.Success ? (res.TotalRowCount ?? 0) : 0;
  }

  /**
   * Manual JEs still Pending are the ones awaiting the C.8 approval gate. A count-only RunView
   * (MaxRows 1 + TotalRowCount) — deliberately cheap enough to run on every category open.
   */
  private async loadApprovalBadge(): Promise<void> {
    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const res = await rv.RunView(
      {
        EntityName: JE_ENTITY,
        ExtraFilter: `Status='Pending' AND EntryType='Manual'`,
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
export function LoadJournalEntriesCategory(): void {
  // No-op.
}
