import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { ResourceData } from '@memberjunction/core-entities';
import { RunView } from '@memberjunction/core';
import { MJLeftNavSection } from '@memberjunction/ng-ui-components';
import { CategoryShellBase } from './category-shell.base';

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
})
@RegisterClass(BaseDashboard, 'JournalEntriesCategoryDashboard')
export class JournalEntriesCategoryComponent extends CategoryShellBase {
  public CategoryTitle = 'Journal Entries';
  protected get DefaultPageId(): string {
    return 'all-entries';
  }

  /** Cheap count for the rail badge — a filtered COUNT, never a heavy aggregate (§0 ruling). */
  public AwaitingApprovalCount = 0;

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
    await this.loadApprovalBadge();
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
