import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { RunView, RunViewParams } from '@memberjunction/core';
import { mjBizAppsAccountingJournalEntryBatchEntityType } from '@mj-biz-apps/accounting-entities';
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

/**
 * A batch status, from the generated union so a new CHECK value surfaces here at compile time.
 * `NonNullable` undoes the emitted .d.ts's optional widening (see BatchListRow); Status is NOT NULL.
 */
type BatchStatus = NonNullable<mjBizAppsAccountingJournalEntryBatchEntityType['Status']>;

/**
 * A zero for every `JournalEntryBatch.Status` value, in pipeline order (CK_JournalEntryBatch_Status).
 * Typed as a full Record, so a status CodeGen adds to the union fails to compile here until it is
 * counted.
 */
const NO_BATCHES: Readonly<Record<BatchStatus, number>> = {
  Pending: 0,
  Approved: 0,
  Sent: 0,
  Posted: 0,
  Failed: 0,
  Cancelled: 0,
  Archived: 0,
};
const BATCH_STATUSES = Object.keys(NO_BATCHES) as BatchStatus[];

/**
 * Every count the page reads, carried together so the cards can source their headers from them.
 *
 * The queues (`open`, `awaiting`, `failed`, `unbatched`, `unstamped`) count every date: a batch
 * waiting since last quarter is still waiting. `byStatusInPeriod` is bounded by the filter bar's
 * period on `PostingDate` and feeds the dispatch breakdown and the recent card.
 */
interface BatchCounts {
  open: number;
  awaiting: number;
  failed: number;
  unbatched: number;
  unstamped: number;
  byStatusInPeriod: Record<BatchStatus, number>;
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
 * Every card is company-scoped: a batch belongs to exactly one company (D7, `CompanyID`), like the
 * journal entries it gathers. Batches were briefly multi-company (CH-4), which is why this page used
 * to leave them unscoped; the 2026-07-22 baseline made them single-company again.
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
    this.reloadOnFilterChange(() => this.Refresh());
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
    const isCurrent = this.beginLoad();
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      // Counts and list rows are independent reads — run them together rather than stacking waits.
      // The cards are built AFTER both settle: a card's header count comes from the COUNT, not from
      // however many rows we chose to show (see DashboardList.Count).
      const [counts, rows] = await Promise.all([this.loadCounts(), this.loadListRows()]);
      if (!isCurrent()) return;
      this.Stats = this.buildStats(counts);
      this.Breakdowns = this.buildBreakdowns(counts);
      this.Lists = this.buildLists(rows, counts);
    } catch (e) {
      if (!isCurrent()) return;
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.Stats = [];
      this.Breakdowns = [];
      this.Lists = [];
    } finally {
      if (isCurrent()) {
        this.IsLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private async loadCounts(): Promise<BatchCounts> {
    const scoped = (own: string): string => this.Scope.ComposeFilter(own);
    const [open, awaiting, failed, unbatched, unstamped, byStatusInPeriod] = await Promise.all([
      this.count({ EntityName: BATCH_ENTITY, ExtraFilter: scoped(`Status IN ('Pending','Approved')`) }),
      this.count({ EntityName: BATCH_ENTITY, ExtraFilter: scoped(`Status='Pending'`) }),
      this.count({ EntityName: BATCH_ENTITY, ExtraFilter: scoped(`Status='Failed'`) }),
      this.count({ EntityName: JE_ENTITY, ExtraFilter: scoped(`Status='Pending'`) }),
      // MOD-14: a built batch with no approval task is the detectable, retryable state. Surfacing
      // it here is what makes it actionable rather than merely detectable.
      this.count({ EntityName: BATCH_ENTITY, ExtraFilter: scoped(`Status='Pending' AND ApprovalTaskID IS NULL`) }),
      this.countByStatusInPeriod(),
    ]);
    return { open, awaiting, failed, unbatched, unstamped, byStatusInPeriod };
  }

  /**
   * One `MaxRows: 1` + `TotalRowCount` read per status, bounded by the period on `PostingDate`.
   * Counting each status directly, rather than deriving one as a difference, keeps every segment
   * traceable to one filter.
   */
  private async countByStatusInPeriod(): Promise<Record<BatchStatus, number>> {
    const period = this.periodFilter('PostingDate');
    const values = await Promise.all(
      BATCH_STATUSES.map((status) =>
        this.count({ EntityName: BATCH_ENTITY, ExtraFilter: this.Scope.ComposeFilter(this.allOf(`Status='${status}'`, period)) }),
      ),
    );
    const counts: Record<BatchStatus, number> = { ...NO_BATCHES };
    BATCH_STATUSES.forEach((status, i) => (counts[status] = values[i]));
    return counts;
  }

  /** Every batch posting in the period: the statuses are the whole value list, so their sum is the total. */
  private inPeriodTotal(c: BatchCounts): number {
    return BATCH_STATUSES.reduce((sum, status) => sum + c.byStatusInPeriod[status], 0);
  }

  /**
   * The dispatch pipeline for the batches posting in the period, in one bar.
   *
   * The segments are the COMPLETE `JournalEntryBatch.Status` value list, which is what makes the
   * proportions honest: every batch in scope and period lands in exactly one segment, so these are
   * real shares of a real total. Unlike the stat cards, Pending here is bounded by the period too.
   *
   * Tones follow the journey, not severity: brand (waiting on us) → info (in flight) → success
   * (landed) → error (broken) → the muted brand tone for Cancelled and Archived (deliberately ended,
   * not failed).
   */
  private buildBreakdowns(c: BatchCounts): DashboardBreakdown[] {
    const n = c.byStatusInPeriod;
    return [
      {
        Id: 'dispatch-pipeline',
        Title: 'Dispatch pipeline',
        Icon: 'fa-solid fa-paper-plane',
        Caption: `Journal entry batches posting in ${this.periodPhrase}, by status`,
        EmptyMessage: `No journal entry batches post in ${this.periodPhrase} in this company scope.`,
        Segments: [
          { Id: 'pending', Label: 'Awaiting approval', Value: n.Pending, Tone: 'brand',
            Tooltip: 'Pending journal entry batches waiting on a CFO decision before they can be dispatched.' },
          { Id: 'approved', Label: 'Approved', Value: n.Approved, Tone: 'info',
            Tooltip: 'Cleared for dispatch — approved, not yet sent to the ERP.' },
          { Id: 'sent', Label: 'Sent', Value: n.Sent, Tone: 'info',
            Tooltip: 'Handed to the ERP; awaiting confirmation that it posted.' },
          { Id: 'posted', Label: 'Posted', Value: n.Posted, Tone: 'success',
            Tooltip: 'Confirmed posted in the ERP general ledger — the end of the line for a journal entry batch.' },
          { Id: 'failed', Label: 'Failed', Value: n.Failed, Tone: 'error',
            Tooltip: 'ERP dispatch failed — retry them from Dispatch status.' },
          { Id: 'cancelled', Label: 'Cancelled', Value: n.Cancelled, Tone: 'brand',
            Tooltip: 'Deliberately abandoned before dispatch. Not a failure — a decision.' },
          { Id: 'archived', Label: 'Archived', Value: n.Archived, Tone: 'brand',
            Tooltip: 'Set aside after the fact, with a recorded reason. Not a failure — a decision.' },
        ],
      },
    ];
  }

  /** The queues on the stat strip count every date; each tooltip says so. */
  private buildStats(c: BatchCounts): DashboardStat[] {
    const everyDate = 'Every posting date, not only the selected period.';
    return [
      { Id: 'open', Label: 'Open JE batches', Value: c.open, Icon: 'fa-solid fa-layer-group', GoTo: 'all-batches',
        Tooltip: `Journal entry batches that are Pending or Approved — not yet sent to the ERP. ${everyDate}` },
      { Id: 'awaiting', Label: 'Awaiting approval', Value: c.awaiting, Icon: 'fa-solid fa-user-check',
        GoTo: 'approvals', Warn: c.awaiting > 0,
        Tooltip: `Pending journal entry batches waiting on a CFO decision before they can be dispatched. ${everyDate}` },
      { Id: 'failed', Label: 'Dispatch failures', Value: c.failed, Icon: 'fa-solid fa-triangle-exclamation',
        GoTo: 'dispatch', Warn: c.failed > 0,
        Tooltip: `Journal entry batches whose ERP dispatch failed — retry them from Dispatch status. ${everyDate}` },
      { Id: 'unbatched', Label: 'Unbatched entries', Value: c.unbatched, Icon: 'fa-solid fa-inbox', GoTo: 'approvals',
        Tooltip: 'Pending journal entries waiting to be batched (in your company scope). Every effective date, not only the selected period.' },
      { Id: 'unstamped', Label: 'JE batches with no approval task', Value: c.unstamped, Icon: 'fa-solid fa-link-slash',
        GoTo: 'approvals', Warn: c.unstamped > 0,
        Tooltip: `Built journal entry batches with no approval request, so no one will be asked to approve them. Each batch is valid; retry its approval request from Batch approvals. ${everyDate}` },
    ];
  }

  /**
   * Every list card's rows, in ONE batched round-trip — never a read per card, let alone per row.
   * Three `MaxRows: 5` top-Ns over an indexed sort column, which is what keeps them §0-cheap.
   */
  private async loadListRows(): Promise<BatchListRows> {
    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const list = (filter: string | null): RunViewParams => ({
      EntityName: BATCH_ENTITY,
      ExtraFilter: this.Scope.ComposeFilter(filter),
      Fields: BATCH_LIST_FIELDS,
      OrderBy: '__mj_CreatedAt DESC',
      MaxRows: DASHBOARD_LIST_ROWS,
      ResultType: 'simple',
    });

    const [inbox, failed, recent] = await rv.RunViews<BatchListRow>(
      // The two queues count every date; the recent card is the period's batches.
      [list(`Status='Pending'`), list(`Status='Failed'`), list(this.periodFilter('PostingDate'))],
      this.ProviderToUse.CurrentUser,
    );

    // RunView reports failure in the result, it does not throw — so check, don't assume.
    if (!inbox.Success) throw new Error(inbox.ErrorMessage ?? 'Could not load the approval inbox. Refresh the page to try again.');
    if (!failed.Success) throw new Error(failed.ErrorMessage ?? 'Could not load the failed dispatches. Refresh the page to try again.');
    if (!recent.Success) throw new Error(recent.ErrorMessage ?? 'Could not load recent journal entry batches. Refresh the page to try again.');

    return { inbox: inbox.Results ?? [], failed: failed.Results ?? [], recent: recent.Results ?? [] };
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
        // The latest five built of the batches posting in the period; the header is the period's count.
        Count: this.inPeriodTotal(c),
        EmptyMessage: `No journal entry batches post in ${this.periodPhrase} in this company scope.`,
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
