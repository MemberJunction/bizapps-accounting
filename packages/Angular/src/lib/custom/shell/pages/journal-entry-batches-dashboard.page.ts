import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { RunView, RunViewParams } from '@memberjunction/core';
import { mjBizAppsAccountingJournalEntryBatchEntityType } from '@mj-biz-apps/accounting-entities';
import { CompanyScopeService } from '../../shared/company-scope.service';
import {
  AccountingDashboardBase,
  DashboardList,
  DashboardListItem,
  DashboardStat,
  DASHBOARD_LIST_ROWS,
} from './accounting-dashboard.base';
import {
  BreakdownPercent,
  BreakdownTotal,
  type DashboardBreakdown,
  type DashboardBreakdownSegment,
} from './dashboard-breakdown';

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
  Pick<mjBizAppsAccountingJournalEntryBatchEntityType, 'ID' | 'JournalEntryBatchNumber' | 'Status' | 'TargetSystem' | '__mj_CreatedAt'>
>;

const BATCH_LIST_FIELDS: (keyof BatchListRow)[] = ['ID', 'JournalEntryBatchNumber', 'Status', 'TargetSystem', '__mj_CreatedAt'];

/** Every count the page reads, carried together so the cards can source their headers from them. */
interface BatchCounts {
  open: number;
  awaiting: number;
  /** The four below exist so the dispatch breakdown can cover the WHOLE Status value list. */
  approved: number;
  sent: number;
  posted: number;
  failed: number;
  cancelled: number;
  unbatched: number;
  unstamped: number;
}

/** The rows behind the three list cards — fetched in one batched RunViews call. */
interface BatchListRows {
  inbox: BatchListRow[];
  failed: BatchListRow[];
  recent: BatchListRow[];
}

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
export class JournalEntryBatchesDashboardPageComponent extends AccountingDashboardBase implements OnInit, OnDestroy {
  /** The shell header's Refresh reaches this page only while it is the mounted one. */
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;
  public Scope = inject(CompanyScopeService);
  public Title = 'Journal Entry Batches';
  public Subtitle = 'What is open, waiting, or stuck on its way to the ERP';

  /**
   * The composition cards. Derived ENTIRELY from `BatchCounts` — every segment is a number
   * `loadCounts` already fetched — so rendering this band costs no additional read.
   */
  public Breakdowns: DashboardBreakdown[] = [];

  /** Template hooks for the composition bar. Pure functions; see dashboard-breakdown.ts. */
  public BreakdownTotal(b: DashboardBreakdown): number {
    return BreakdownTotal(b);
  }
  public BreakdownPercent(b: DashboardBreakdown, s: DashboardBreakdownSegment): number {
    return BreakdownPercent(b, s);
  }

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
      // Every count and every list card in ONE batched RunViews round-trip (9 counts + 3 lists).
      const { counts, rows } = await this.loadDashboardBatch();
      this.Stats = this.buildStats(counts);
      this.Breakdowns = this.buildBreakdowns(counts);
      this.Lists = this.buildLists(rows, counts);
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.Stats = [];
      this.Breakdowns = [];
      this.Lists = [];
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  private async loadDashboardBatch(): Promise<{ counts: BatchCounts; rows: BatchListRows }> {
    const list = (filter: string): RunViewParams => ({
      EntityName: BATCH_ENTITY,
      ExtraFilter: filter,
      Fields: BATCH_LIST_FIELDS,
      OrderBy: '__mj_CreatedAt DESC',
      MaxRows: DASHBOARD_LIST_ROWS,
      ResultType: 'simple',
    });

    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const [
      openRes,
      awaitingRes,
      approvedRes,
      sentRes,
      postedRes,
      failedRes,
      cancelledRes,
      unbatchedRes,
      unstampedRes,
      inbox,
      failed,
      recent,
    ] = await rv.RunViews(
      [
        this.countParams({ EntityName: BATCH_ENTITY, ExtraFilter: `Status IN ('Pending','Approved')` }),
        this.countParams({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Pending'` }),
        this.countParams({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Approved'` }),
        this.countParams({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Sent'` }),
        this.countParams({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Posted'` }),
        this.countParams({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Failed'` }),
        this.countParams({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Cancelled'` }),
        this.countParams({ EntityName: JE_ENTITY, ExtraFilter: this.Scope.ComposeFilter(`Status='Pending'`) }),
        // MOD-14: a built batch with no approval task is the detectable, retryable state.
        this.countParams({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Pending' AND ApprovalTaskID IS NULL` }),
        list(`Status='Pending'`),
        list(`Status='Failed'`),
        list(''),
      ],
      this.ProviderToUse.CurrentUser,
    );

    const readCount = (res: { Success: boolean; ErrorMessage?: string; TotalRowCount?: number } | undefined): number => {
      if (!res?.Success) throw new Error(res?.ErrorMessage ?? 'Could not load the dashboard totals. Refresh the page to try again.');
      return res.TotalRowCount ?? 0;
    };

    const counts: BatchCounts = {
      open: readCount(openRes),
      awaiting: readCount(awaitingRes),
      approved: readCount(approvedRes),
      sent: readCount(sentRes),
      posted: readCount(postedRes),
      failed: readCount(failedRes),
      cancelled: readCount(cancelledRes),
      unbatched: readCount(unbatchedRes),
      unstamped: readCount(unstampedRes),
    };

    if (!inbox?.Success) throw new Error(inbox?.ErrorMessage ?? 'Could not load the approval inbox. Refresh the page to try again.');
    if (!failed?.Success) throw new Error(failed?.ErrorMessage ?? 'Could not load the failed dispatches. Refresh the page to try again.');
    if (!recent?.Success) throw new Error(recent?.ErrorMessage ?? 'Could not load recent journal entry batches. Refresh the page to try again.');

    const rows: BatchListRows = {
      inbox: (inbox.Results ?? []) as BatchListRow[],
      failed: (failed.Results ?? []) as BatchListRow[],
      recent: (recent.Results ?? []) as BatchListRow[],
    };
    return { counts, rows };
  }

  /**
   * The dispatch pipeline, end to end — a batch's whole journey to the ERP in one bar.
   *
   * The segments are the COMPLETE `JournalEntryBatch.Status` value list, which is what makes the
   * proportions honest: every batch in the system lands in exactly one segment, so these are real
   * shares of a real total. If a migration widens CK_JournalEntryBatch_Status, a segment belongs
   * here — the value list is the contract this card depends on.
   *
   * Tones follow the journey, not severity: brand (waiting on us) → info (in flight) → success
   * (landed) → error (broken) → the muted brand tone for Cancelled (deliberately ended, not failed).
   */
  private buildBreakdowns(c: BatchCounts): DashboardBreakdown[] {
    return [
      {
        Id: 'dispatch-pipeline',
        Title: 'Dispatch pipeline',
        Icon: 'fa-solid fa-paper-plane',
        Caption: 'Every journal entry batch, by status',
        EmptyMessage: 'No journal entry batches have been built yet.',
        Segments: [
          { Id: 'pending', Label: 'Awaiting approval', Value: c.awaiting, Tone: 'brand',
            Tooltip: 'Pending journal entry batches waiting on a CFO decision before they can be dispatched.' },
          { Id: 'approved', Label: 'Approved', Value: c.approved, Tone: 'info',
            Tooltip: 'Cleared for dispatch — approved, not yet sent to the ERP.' },
          { Id: 'sent', Label: 'Sent', Value: c.sent, Tone: 'info',
            Tooltip: 'Handed to the ERP; awaiting confirmation that it posted.' },
          { Id: 'posted', Label: 'Posted', Value: c.posted, Tone: 'success',
            Tooltip: 'Confirmed posted in the ERP general ledger — the end of the line for a journal entry batch.' },
          { Id: 'failed', Label: 'Failed', Value: c.failed, Tone: 'error',
            Tooltip: 'ERP dispatch failed — retry them from Dispatch status.' },
          { Id: 'cancelled', Label: 'Cancelled', Value: c.cancelled, Tone: 'brand',
            Tooltip: 'Deliberately abandoned before dispatch. Not a failure — a decision.' },
        ],
      },
    ];
  }

  private buildStats(c: BatchCounts): DashboardStat[] {
    return [
      { Id: 'open', Label: 'Open JE batches', Value: c.open, Icon: 'fa-solid fa-layer-group', GoTo: 'all-batches',
        Tooltip: 'Journal entry batches that are Pending or Approved — not yet sent to the ERP.' },
      { Id: 'awaiting', Label: 'Awaiting approval', Value: c.awaiting, Icon: 'fa-solid fa-user-check',
        GoTo: 'approvals', Warn: c.awaiting > 0,
        Tooltip: 'Pending journal entry batches waiting on a CFO decision before they can be dispatched.' },
      { Id: 'failed', Label: 'Dispatch failures', Value: c.failed, Icon: 'fa-solid fa-triangle-exclamation',
        GoTo: 'dispatch', Warn: c.failed > 0,
        Tooltip: 'Journal entry batches whose ERP dispatch failed — retry them from Dispatch status.' },
      { Id: 'unbatched', Label: 'Unbatched entries', Value: c.unbatched, Icon: 'fa-solid fa-inbox', GoTo: 'approvals',
        Tooltip: 'Pending journal entries waiting to be batched (in your company scope).' },
      { Id: 'unstamped', Label: 'JE batches with no approval task', Value: c.unstamped, Icon: 'fa-solid fa-link-slash',
        GoTo: 'approvals', Warn: c.unstamped > 0,
        Tooltip: 'Built journal entry batches with no approval request, so no one will be asked to approve them. Each batch is valid; retry its approval request from Batch approvals.' },
    ];
  }

  /** @param c supplies each card's header count — the TRUE total, not the five rows we fetched. */
  private buildLists(rows: BatchListRows, c: BatchCounts): DashboardList[] {
    return [
      {
        Id: 'inbox',
        Title: 'Awaiting approval',
        Icon: 'fa-solid fa-user-check',
        Count: c.awaiting,
        EmptyMessage: 'The inbox is clear — no journal entry batch is waiting on a decision.',
        Items: rows.inbox.map((r) => this.toItem(r, true)),
      },
      {
        // The most actionable card on the page: a failed dispatch is money that did not reach the
        // ERP, and nothing else will retry it. Named, not just counted, so it can be acted on.
        Id: 'failed',
        Title: 'Failed dispatches',
        Icon: 'fa-solid fa-triangle-exclamation',
        Count: c.failed,
        EmptyMessage: 'Every dispatch has landed — nothing failed on the way to the ERP.',
        Items: rows.failed.map((r) => this.toItem(r, true)),
      },
      {
        Id: 'recent',
        Title: 'Recent journal entry batches',
        Icon: 'fa-solid fa-clock-rotate-left',
        // A top-5 of everything, so its own row count IS its honest header.
        Count: rows.recent.length,
        EmptyMessage: 'No journal entry batches have been built yet.',
        Items: rows.recent.map((r) => this.toItem(r, false)),
      },
    ];
  }

  private toItem(row: BatchListRow, warn: boolean): DashboardListItem {
    return {
      Id: row.ID,
      Title: row.JournalEntryBatchNumber,
      Detail: row.TargetSystem,
      Status: row.Status,
      // __mj_CreatedAt is an instant (DATETIMEOFFSET) — the browser's local zone is the right
      // rendering, so this is NOT date-only. Flagging it would wrongly pin it to UTC.
      When: row.__mj_CreatedAt,
      WhenIsDateOnly: false,
      // The CALLER decides what needs attention (a Pending approval, a Failed dispatch) — this used
      // to re-check `Status === 'Pending'` here, which silently un-warned every failed row.
      Warn: warn,
    };
  }
}
