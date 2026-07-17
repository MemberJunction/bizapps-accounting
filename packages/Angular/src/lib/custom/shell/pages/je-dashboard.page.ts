import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { RunView } from '@memberjunction/core';
import { mjBizAppsAccountingJournalEntryEntityType } from '@mj-biz-apps/accounting-entities';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { AccountingDashboardBase, DashboardListItem, DASHBOARD_LIST_ROWS } from './accounting-dashboard.base';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const SJE_ENTITY = 'MJ_BizApps_Accounting: Scheduled Journal Entries';

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
    const monthStart = this.monthStartUTC();

    const [thisMonth, unbatched, awaiting, scheduledDue] = await Promise.all([
      this.count({ EntityName: JE_ENTITY, ExtraFilter: this.Scope.ComposeFilter(`EffectiveDate >= '${monthStart}'`) }),
      this.count({ EntityName: JE_ENTITY, ExtraFilter: this.Scope.ComposeFilter(`Status='Pending'`) }),
      // C.8: a Pending MANUAL entry is sitting behind the CFO gate — it will not be batched.
      this.count({ EntityName: JE_ENTITY, ExtraFilter: this.Scope.ComposeFilter(`Status='Pending' AND EntryType='Manual'`) }),
      this.count({ EntityName: SJE_ENTITY, ExtraFilter: `Status='Scheduled' AND ScheduledEffectiveDate <= '${this.todayUTC()}'` }),
    ]);

    this.Stats = [
      { Id: 'month', Label: 'Entries this month', Value: thisMonth, Icon: 'fa-solid fa-book-open',
        Tooltip: 'Journal entries with an effective date in the current calendar month (UTC).' },
      { Id: 'unbatched', Label: 'Unbatched', Value: unbatched, Icon: 'fa-solid fa-layer-group', GoTo: 'all-entries',
        Tooltip: 'Pending entries — the candidate pool a batch build would sweep.' },
      { Id: 'awaiting', Label: 'Awaiting CFO approval', Value: awaiting, Icon: 'fa-solid fa-user-check',
        GoTo: 'approvals', Warn: awaiting > 0,
        Tooltip: 'Pending MANUAL entries. They are excluded from batching until approved (C.8) — this is why an entry can look "stuck".' },
      { Id: 'due', Label: 'Scheduled entries due', Value: scheduledDue, Icon: 'fa-regular fa-calendar-days', GoTo: 'scheduled',
        Tooltip: 'Scheduled entries whose date has arrived and which have not materialised yet.' },
    ];
  }

  /** The two list cards. One batched round-trip — never a read per card, let alone per row. */
  private async loadLists(): Promise<void> {
    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const [recent, awaiting] = await rv.RunViews<JournalEntryListRow>(
      [
        {
          EntityName: JE_ENTITY,
          ExtraFilter: this.Scope.ComposeFilter(null),
          Fields: JE_LIST_FIELDS,
          OrderBy: 'EffectiveDate DESC',
          MaxRows: DASHBOARD_LIST_ROWS,
          ResultType: 'simple',
        },
        {
          // C.8 again — the same population the "Awaiting CFO approval" stat counts, now named.
          EntityName: JE_ENTITY,
          ExtraFilter: this.Scope.ComposeFilter(`EntryType='Manual' AND Status='Pending'`),
          Fields: JE_LIST_FIELDS,
          OrderBy: 'EffectiveDate DESC',
          MaxRows: DASHBOARD_LIST_ROWS,
          ResultType: 'simple',
        },
      ],
      this.ProviderToUse.CurrentUser,
    );

    // RunView reports failure in the result, it does not throw — so check, don't assume.
    if (!recent.Success) throw new Error(recent.ErrorMessage ?? 'Could not load recent journal entries');
    if (!awaiting.Success) throw new Error(awaiting.ErrorMessage ?? 'Could not load entries awaiting approval');

    this.Lists = [
      {
        Id: 'recent',
        Title: 'Recent journal entries',
        Icon: 'fa-solid fa-clock-rotate-left',
        EmptyMessage: 'No journal entries in this company scope yet.',
        Items: (recent.Results ?? []).map((r) => this.toItem(r, false)),
      },
      {
        Id: 'awaiting',
        Title: 'Awaiting approval',
        Icon: 'fa-solid fa-user-check',
        EmptyMessage: 'Nothing is waiting on the CFO — every manual entry is approved.',
        Items: (awaiting.Results ?? []).map((r) => this.toItem(r, true)),
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

  private todayUTC(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
