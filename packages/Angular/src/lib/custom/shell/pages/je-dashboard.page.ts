import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { RunView, RunViewParams } from '@memberjunction/core';
import { mjBizAppsAccountingJournalEntryEntityType } from '@mj-biz-apps/accounting-entities';
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

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/**
 * The read shape of a journal-entry list row. Picked off the ENTITY type so the value-list unions
 * (Status, EntryType) track CodeGen — a hand-copied union silently drifts the next time a migration
 * widens the CHECK constraint (MJ CLAUDE.md rule 2c).
 *
 * `Required` is doing one narrow job: the entities package's emitted .d.ts widens EVERY zod field to
 * optional (a declaration-emit artifact of `z.infer`, not a statement about the data). These columns
 * are all NOT NULL and all named in the Fields list below, so the artifact would only force fake
 * `?? ''` fallbacks that hide, rather than surface, a genuinely missing field. The unions still track
 * CodeGen, which is the point of deriving from the entity.
 */
type JournalEntryListRow = Required<
  Pick<
    mjBizAppsAccountingJournalEntryEntityType,
    'ID' | 'EntryNumber' | 'EffectiveDate' | 'Status' | 'EntryType' | 'Description' | 'Company'
  >
>;

/** `Company` is denormalized onto the view — never look the company up per row. */
const JE_LIST_FIELDS: (keyof JournalEntryListRow)[] = [
  'ID',
  'EntryNumber',
  'EffectiveDate',
  'Status',
  'EntryType',
  'Description',
  'Company',
];

/** Every count the page reads, carried together so the cards can source their headers from them. */
interface JeCounts {
  thisMonth: number;
  pending: number;
  batched: number;
  glPosted: number;
  awaiting: number;
}

/** The rows behind the three list cards — fetched in one batched RunViews call. */
interface JeListRows {
  recent: JournalEntryListRow[];
  awaiting: JournalEntryListRow[];
  oldest: JournalEntryListRow[];
}

/**
 * Journal Entries dashboard (UI plan §8.1) — cheap stats + short lists only.
 *
 * Every card is a filtered COUNT or a `MaxRows: 5` top-N (see AccountingDashboardBase). The mockup
 * also drew an entries-per-day trend; that is exactly the "expensive stat" §0 rules out unless
 * precomputed on a schedule, so it is deliberately NOT here rather than being computed on demand.
 */
@Component({
  standalone: false,
  selector: 'mj-je-dashboard-page',
  templateUrl: './accounting-dashboard.html',
  styleUrls: ['./accounting-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JeDashboardPageComponent extends AccountingDashboardBase implements OnInit, OnDestroy {
  /** The shell header's Refresh reaches this page only while it is the mounted one. */
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;
  public Scope = inject(CompanyScopeService);
  public Title = 'Journal Entries';
  public Subtitle = 'What needs attention in the ledger';

  /**
   * The composition cards. Derived ENTIRELY from `JeCounts` — every segment is a number `loadCounts`
   * already fetched for the stat strip — so this band adds no reads at all. See dashboard-breakdown.ts.
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
      // Counts and list rows are independent reads — run them together rather than stacking waits.
      // The cards are built AFTER both settle because a card's header count comes from the COUNT,
      // not from however many rows we chose to show (see DashboardList.Count).
      const [counts, rows] = await Promise.all([this.loadCounts(), this.loadListRows()]);
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

  /**
   * Every count this page shows, in one place. All are `MaxRows: 1` + `TotalRowCount` — SQL counts,
   * one row transfers — which is the only kind of number §0 allows on demand.
   *
   * **No "out of balance" count.** It looks like the most useful card on the page and it is not
   * buildable: the balanced-JE invariant is enforced by a DEFERRABLE constraint trigger, so an
   * unbalanced entry cannot be committed in the first place. Counting them would need a
   * `SUM(Debit)<>SUM(Credit)` GROUP BY over every line in the ledger — the exact heavy aggregate §0
   * forbids — to always return 0. A card that costs a ledger scan to prove a DB constraint works is
   * not worth its price.
   */
  private async loadCounts(): Promise<JeCounts> {
    const monthStart = this.monthStartUTC();
    const scoped = (own: string | null): string => this.Scope.ComposeFilter(own);

    // NO scheduled-entries count: the ScheduledJournalEntry system was retired (D15) — its count
    // here made the WHOLE dashboard load reject with "entity not found" (red LoadError card).
    const [thisMonth, pending, batched, glPosted, awaiting] = await Promise.all([
      this.count({ EntityName: JE_ENTITY, ExtraFilter: scoped(`EffectiveDate >= '${monthStart}'`) }),
      this.count({ EntityName: JE_ENTITY, ExtraFilter: scoped(`Status='Pending'`) }),
      this.count({ EntityName: JE_ENTITY, ExtraFilter: scoped(`Status='Batched'`) }),
      this.count({ EntityName: JE_ENTITY, ExtraFilter: scoped(`Status='GLPosted'`) }),
      // C.8: a Pending MANUAL entry is sitting behind the CFO gate — it will not be batched.
      this.count({ EntityName: JE_ENTITY, ExtraFilter: scoped(`Status='Pending' AND EntryType='Manual'`) }),
    ]);

    return { thisMonth, pending, batched, glPosted, awaiting };
  }

  /**
   * The status breakdown + the two time-shaped counts. Pending / Batched / GLPosted are the WHOLE
   * `JournalEntry.Status` value list, so the three together account for every entry in scope.
   */
  private buildStats(c: JeCounts): DashboardStat[] {
    return [
      { Id: 'month', Label: 'Entries this month', Value: c.thisMonth, Icon: 'fa-solid fa-book-open', GoTo: 'all-entries',
        Tooltip: 'Journal entries with an effective date in the current calendar month (UTC).' },
      { Id: 'pending', Label: 'Pending', Value: c.pending, Icon: 'fa-solid fa-layer-group', GoTo: 'all-entries',
        Tooltip: 'Not yet batched — the candidate pool a JE batch build would sweep.' },
      { Id: 'batched', Label: 'Batched', Value: c.batched, Icon: 'fa-solid fa-box-archive', GoTo: 'all-batches',
        Tooltip: 'Locked into a journal entry batch and on their way to the ERP. Immutable from here (BA trigger).' },
      { Id: 'glposted', Label: 'GL posted', Value: c.glPosted, Icon: 'fa-solid fa-circle-check', GoTo: 'all-entries',
        Tooltip: 'Confirmed landed in the ERP general ledger — the end of the line for an entry.' },
      { Id: 'awaiting', Label: 'Awaiting CFO approval', Value: c.awaiting, Icon: 'fa-solid fa-user-check',
        GoTo: 'approvals', Warn: c.awaiting > 0,
        Tooltip: 'Pending MANUAL entries. They are excluded from batching until approved (C.8) — this is why an entry can look "stuck".' },
    ];
  }

  /**
   * The pipeline shape, at zero read cost — every segment is a count `loadCounts` already ran.
   *
   * Pending / Batched / GLPosted is the WHOLE `JournalEntry.Status` value list, which is what makes
   * this bar honest: the three segments account for every entry in scope, so the proportions are
   * real shares of a real total rather than three unrelated numbers sharing an axis. If a migration
   * widens the Status CHECK constraint, a fourth segment belongs here — the value list is the
   * contract this card depends on.
   *
   * Tones encode the pipeline, not severity: brand (work to do) → info (in flight) → success (done).
   */
  private buildBreakdowns(c: JeCounts): DashboardBreakdown[] {
    return [
      {
        Id: 'pipeline',
        Title: 'Ledger pipeline',
        Icon: 'fa-solid fa-diagram-project',
        Caption: 'Every entry in scope, by status',
        EmptyMessage: 'No journal entries in this company scope yet.',
        Segments: [
          { Id: 'pending', Label: 'Pending', Value: c.pending, Tone: 'brand',
            Tooltip: 'Not yet batched — the candidate pool a JE batch build would sweep.' },
          { Id: 'batched', Label: 'Batched', Value: c.batched, Tone: 'info',
            Tooltip: 'Locked into a journal entry batch and on their way to the ERP. Immutable from here (BA trigger).' },
          { Id: 'glposted', Label: 'GL posted', Value: c.glPosted, Tone: 'success',
            Tooltip: 'Confirmed landed in the ERP general ledger — the end of the line for an entry.' },
        ],
      },
    ];
  }

  /**
   * Every list card's rows, in ONE batched round-trip. Three `MaxRows: 5` top-Ns over an indexed
   * sort column — never a read per card, let alone per row.
   */
  private async loadListRows(): Promise<JeListRows> {
    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const list = (own: string | null, orderBy: string): RunViewParams => ({
      EntityName: JE_ENTITY,
      ExtraFilter: this.Scope.ComposeFilter(own),
      Fields: JE_LIST_FIELDS,
      OrderBy: orderBy,
      MaxRows: DASHBOARD_LIST_ROWS,
      ResultType: 'simple',
    });

    const [recent, awaiting, oldest] = await rv.RunViews<JournalEntryListRow>(
      [
        list(null, 'EffectiveDate DESC'),
        // C.8 again — the same population the "Awaiting CFO approval" stat counts, now named.
        list(`EntryType='Manual' AND Status='Pending'`, 'EffectiveDate DESC'),
        // ASC, not DESC: the point of this card is the entry that has been sitting UNPOSTED longest.
        list(`Status='Pending'`, 'EffectiveDate ASC'),
      ],
      this.ProviderToUse.CurrentUser,
    );

    // RunView reports failure in the result, it does not throw — so check, don't assume.
    if (!recent.Success) throw new Error(recent.ErrorMessage ?? 'Could not load recent journal entries');
    if (!awaiting.Success) throw new Error(awaiting.ErrorMessage ?? 'Could not load entries awaiting approval');
    if (!oldest.Success) throw new Error(oldest.ErrorMessage ?? 'Could not load the oldest unposted entries');

    return { recent: recent.Results ?? [], awaiting: awaiting.Results ?? [], oldest: oldest.Results ?? [] };
  }

  /** @param c supplies each card's header count — the TRUE total, not the five rows we fetched. */
  private buildLists(rows: JeListRows, c: JeCounts): DashboardList[] {
    return [
      {
        Id: 'recent',
        Title: 'Recent journal entries',
        Icon: 'fa-solid fa-clock-rotate-left',
        // The "recent" card is a top-5 of everything, so its own row count IS its honest header.
        Count: rows.recent.length,
        EmptyMessage: 'No journal entries in this company scope yet.',
        Items: rows.recent.map((r) => this.toItem(r, false)),
      },
      {
        Id: 'awaiting',
        Title: 'Awaiting approval',
        Icon: 'fa-solid fa-user-check',
        Count: c.awaiting,
        EmptyMessage: 'Nothing is waiting on the CFO — every manual entry is approved.',
        Items: rows.awaiting.map((r) => this.toItem(r, true)),
      },
      {
        Id: 'oldest',
        Title: 'Oldest unposted',
        Icon: 'fa-solid fa-hourglass-end',
        Count: c.pending,
        EmptyMessage: 'Nothing is unposted — every entry has been batched.',
        // Warn: an entry that has sat Pending the longest is the one most likely to be stuck.
        Items: rows.oldest.map((r) => this.toItem(r, true)),
      },
    ];
  }

  /** JournalEntry has NO total-amount column, so the detail line is the description + company. */
  private toItem(row: JournalEntryListRow, warn: boolean): DashboardListItem {
    const detail = [row.Description, row.Company].filter((p): p is string => !!p).join(' · ');
    return {
      Id: row.ID,
      Title: row.EntryNumber,
      Detail: detail || row.EntryType,
      Status: warn ? row.EntryType : row.Status,
      // EffectiveDate is a DATE (no zone) — flagged so the template renders it in UTC.
      When: row.EffectiveDate,
      WhenIsDateOnly: true,
      Warn: warn,
    };
  }

}
