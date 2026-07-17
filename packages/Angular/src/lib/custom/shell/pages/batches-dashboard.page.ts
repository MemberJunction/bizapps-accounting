import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { RunView } from '@memberjunction/core';
import { mjBizAppsAccountingJournalEntryBatchEntityType } from '@mj-biz-apps/accounting-entities';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { AccountingDashboardBase, DashboardListItem, DASHBOARD_LIST_ROWS } from './accounting-dashboard.base';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/**
 * The read shape of a batch list row. Picked off the ENTITY type so the Status / TargetSystem unions
 * track CodeGen instead of drifting from a hand-copied copy (MJ CLAUDE.md rule 2c).
 *
 * `Required` is doing one narrow job: the entities package's emitted .d.ts widens EVERY zod field to
 * optional (a declaration-emit artifact of `z.infer`, not a statement about the data). These columns
 * are all NOT NULL and all named in the Fields list below. See the same note on je-dashboard.page.
 */
type BatchListRow = Required<
  Pick<mjBizAppsAccountingJournalEntryBatchEntityType, 'ID' | 'BatchNumber' | 'Status' | 'TargetSystem' | '__mj_CreatedAt'>
>;

const BATCH_LIST_FIELDS: (keyof BatchListRow)[] = ['ID', 'BatchNumber', 'Status', 'TargetSystem', '__mj_CreatedAt'];

/**
 * Batches dashboard (UI plan §8.2) — cheap stats + short lists only (§0).
 *
 * Note the batch stats and lists are deliberately NOT company-scoped: batches are MULTI-company
 * (CH-4), so a batch merely TOUCHING another company would vanish under a company filter. The
 * unbatched-entries card IS scoped, because a journal entry belongs to exactly one company (MOD-12).
 */
@Component({
  standalone: false,
  selector: 'mj-batches-dashboard-page',
  templateUrl: './accounting-dashboard.html',
  styleUrls: ['./accounting-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BatchesDashboardPageComponent extends AccountingDashboardBase implements OnInit, OnDestroy {
  /** The shell header's Refresh reaches this page only while it is the mounted one. */
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;
  public Scope = inject(CompanyScopeService);
  public Title = 'Batches';
  public Subtitle = 'What is open, waiting, or stuck on its way to the ERP';

  ngOnInit(): void {
    this.refreshSub = this.pageRefresh.OnRefresh(() => this.Refresh());
    void this.load();
  }

  ngOnDestroy(): void {
    // Unsubscribing is what keeps the header's Refresh page-aware: a destroyed page stops counting.
    this.refreshSub?.unsubscribe();
  }
  public Refresh(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      // Stats and lists are independent — run them together rather than stacking two waits.
      await Promise.all([this.loadStats(), this.loadLists()]);
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.Stats = [];
      this.Lists = [];
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  private async loadStats(): Promise<void> {
    const [open, awaiting, failed, unbatched, unstamped] = await Promise.all([
      this.count({ EntityName: BATCH_ENTITY, ExtraFilter: `Status IN ('Pending','Approved')` }),
      this.count({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Pending'` }),
      this.count({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Failed'` }),
      this.count({ EntityName: JE_ENTITY, ExtraFilter: this.Scope.ComposeFilter(`Status='Pending'`) }),
      // MOD-14: a built batch with no approval task is the detectable, retryable state. Surfacing
      // it here is what makes it actionable rather than merely detectable.
      this.count({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Pending' AND ApprovalTaskID IS NULL` }),
    ]);

    this.Stats = [
      { Id: 'open', Label: 'Open batches', Value: open, Icon: 'fa-solid fa-layer-group', GoTo: 'all-batches',
        Tooltip: 'Batches that are Pending or Approved — not yet sent to the ERP.' },
      { Id: 'awaiting', Label: 'Awaiting approval', Value: awaiting, Icon: 'fa-solid fa-user-check',
        GoTo: 'approvals', Warn: awaiting > 0,
        Tooltip: 'Pending batches waiting on a CFO decision before they can be dispatched.' },
      { Id: 'failed', Label: 'Dispatch failures', Value: failed, Icon: 'fa-solid fa-triangle-exclamation',
        GoTo: 'dispatch', Warn: failed > 0,
        Tooltip: 'Batches whose ERP dispatch failed — retry them from Dispatch status.' },
      { Id: 'unbatched', Label: 'Unbatched entries', Value: unbatched, Icon: 'fa-solid fa-inbox', GoTo: 'workspace',
        Tooltip: 'Pending journal entries waiting to be batched (in your company scope).' },
      { Id: 'unstamped', Label: 'Batches with no approval task', Value: unstamped, Icon: 'fa-solid fa-link-slash',
        GoTo: 'approvals', Warn: unstamped > 0,
        Tooltip: 'Built batches whose approval task could not be raised (MOD-14). The batch is valid — the task needs retrying, or nobody will be asked to approve it.' },
    ];
  }

  /** The inbox + recent-batches cards. One batched round-trip — never a read per card or per row. */
  private async loadLists(): Promise<void> {
    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const [inbox, recent] = await rv.RunViews<BatchListRow>(
      [
        {
          EntityName: BATCH_ENTITY,
          ExtraFilter: `Status='Pending'`,
          Fields: BATCH_LIST_FIELDS,
          OrderBy: '__mj_CreatedAt DESC',
          MaxRows: DASHBOARD_LIST_ROWS,
          ResultType: 'simple',
        },
        {
          EntityName: BATCH_ENTITY,
          ExtraFilter: '',
          Fields: BATCH_LIST_FIELDS,
          OrderBy: '__mj_CreatedAt DESC',
          MaxRows: DASHBOARD_LIST_ROWS,
          ResultType: 'simple',
        },
      ],
      this.ProviderToUse.CurrentUser,
    );

    // RunView reports failure in the result, it does not throw — so check, don't assume.
    if (!inbox.Success) throw new Error(inbox.ErrorMessage ?? 'Could not load the approval inbox');
    if (!recent.Success) throw new Error(recent.ErrorMessage ?? 'Could not load recent batches');

    this.Lists = [
      {
        Id: 'inbox',
        Title: 'Awaiting approval',
        Icon: 'fa-solid fa-user-check',
        EmptyMessage: 'The inbox is clear — no batch is waiting on a decision.',
        Items: (inbox.Results ?? []).map((r) => this.toItem(r, true)),
      },
      {
        Id: 'recent',
        Title: 'Recent batches',
        Icon: 'fa-solid fa-clock-rotate-left',
        EmptyMessage: 'No batches have been built yet.',
        Items: (recent.Results ?? []).map((r) => this.toItem(r, false)),
      },
    ];
  }

  private toItem(row: BatchListRow, warn: boolean): DashboardListItem {
    return {
      Id: row.ID,
      Title: row.BatchNumber,
      Detail: row.TargetSystem,
      Status: row.Status,
      // __mj_CreatedAt is an instant (DATETIMEOFFSET) — the browser's local zone is the right
      // rendering, so this is NOT date-only. Flagging it would wrongly pin it to UTC.
      When: row.__mj_CreatedAt,
      WhenIsDateOnly: false,
      Warn: warn && row.Status === 'Pending',
    };
  }
}
