import { Component, ChangeDetectionStrategy, ChangeDetectorRef, EventEmitter, inject, OnInit, OnDestroy, Output, ViewChild } from '@angular/core';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { RunView, RunViewParams } from '@memberjunction/core';
import { GridColumnConfig, EntityDataGridComponent } from '@memberjunction/ng-entity-viewer';
import { mjBizAppsAccountingJournalEntryBatchEntityType } from '@mj-biz-apps/accounting-entities';
import { CompanyScopeService, ScopeCompany } from '../../shared/company-scope.service';
import { TIME_WINDOWS, TimeWindowId, timeWindowRange, toSqlDate, andFilters } from '../../../transfer-pending/list-scaffold/time-window';
import { sqlLiteral, likeContains } from '../../../transfer-pending/list-scaffold/sql-filter';
import { rowKeyToId } from '../../../transfer-pending/list-scaffold/grid-row-key';
import { MJAPresetChip } from '../../shared/list-toolbar.component';
import { MJASummaryFigure } from '../../shared/summary-strip.component';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

/**
 * Status union derived from the generated entity (MJ CLAUDE.md rule 2c — never hand-copied).
 * `NonNullable` strips the `| undefined` the entities package's declaration emit adds to every
 * zod-inferred field — an emit artifact, not a statement about the (NOT NULL) column.
 */
type BatchStatus = NonNullable<mjBizAppsAccountingJournalEntryBatchEntityType['Status']>;

/**
 * The dispatch lifecycle, in journey order — chips read left-to-right as a batch's life. Typed as
 * `BatchStatus[]` so a widened CHECK constraint fails compilation instead of silently missing here.
 */
const STATUSES: readonly BatchStatus[] = ['Pending', 'Approved', 'Sent', 'Posted', 'Failed', 'Cancelled'] as const;

type WindowChoice = TimeWindowId | 'custom';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * All batches — the batches list on the standard list idiom (the All-JEs clone): summary strip +
 * list toolbar (search · status chips · Filters disclosure) + the house grid, row slide-in detail.
 *
 * Replaces the old BatchStatus dashboard as this rail item (Marcelo 2026-08-04): a list page and a
 * dashboard are different idioms, and "All batches" is a list.
 *
 * The date filters run on **PostingDate** — the batch's business date (what the GL cares about) —
 * not `__mj_CreatedAt`. The grid still offers Created as a sortable (hidden-by-default) column.
 */
@Component({
  standalone: false,
  selector: 'mj-all-batches-page',
  templateUrl: './all-batches.page.html',
  styleUrls: ['./all-batches.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllBatchesPageComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  /** The shell header's Refresh reaches this page only while it is the mounted one. */
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;
  public Scope = inject(CompanyScopeService);

  /** Kept for host parity with the other list pages; the category's header owns the verb today. */
  @Output() CreateRequested = new EventEmitter<void>();

  /** The detail panel's "Open in workspace" — routed by the category via GoToPage('workspace', id). */
  @Output() WorkspaceRequested = new EventEmitter<string>();

  public readonly TimeWindows = TIME_WINDOWS;
  public readonly Statuses = STATUSES;

  /** Posting-date window default — §0 requires one on every list; 90 days matches All JEs. */
  public TimeWindow: WindowChoice = 'last90';
  public FromDate: string | null = null;
  public ToDate: string | null = null;

  /** Status filter — a SET (empty = all), the same idiom as All JEs. */
  public SelectedStatuses = new Set<BatchStatus>();

  /** Per-page company narrowing — ANDs inside the app-wide scope, never widens it. */
  /** MULTI-select company narrowing (Marcelo 2026-08-05): empty = no narrowing ("All companies"). */
  public CompanyIDs: string[] = [];

  public Search = '';

  public TotalCount: number | null = null;
  private statusCounts = new Map<BatchStatus, number>();
  /** Guards against an older stat batch landing after a newer one. */
  private statsToken = 0;

  public GridParams: RunViewParams = { EntityName: BATCH_ENTITY };

  /** The row whose detail slide-in is open, if any. */
  public SelectedID: string | null = null;

  /** The grid — its Params setter deep-compares and skips equal params, so refresh-with-unchanged-
   *  filters must call the grid directly. (Replaces the vestigial RefreshToken counter.) */
  @ViewChild(EntityDataGridComponent) private grid?: EntityDataGridComponent;

  public Columns: GridColumnConfig[] = [
    { field: 'JournalEntryBatchNumber', title: 'Batch №', width: 150, sortable: true },
    { field: 'PostingDate', title: 'Posting date', width: 130, sortable: true },
    { field: 'Status', title: 'Status', width: 110, sortable: true },
    { field: 'TargetSystem', title: 'Target', width: 130, sortable: true },
    // TotalEntries is a COUNT — but it still renders as currency ("$1.00" entries) because of an
    // MJ-CORE gap (MJ-UPSTREAM.md 2026-08-06): mapColumnConfigToColDef drops the host column's
    // type/format/formatter, then applyFieldFormatter's NAME-PATTERN heuristic (includes('total'))
    // dresses the field as currency. This config is CORRECT per the GridColumnConfig contract and
    // takes effect the moment MJ wires customFormat through — do not remove it.
    { field: 'TotalEntries', title: 'Entries', width: 100, sortable: true, type: 'number', format: '#,##0' },
    { field: 'TotalDebits', title: 'Debits', width: 130, sortable: true },
    { field: 'TotalCredits', title: 'Credits', width: 130, sortable: true },
    { field: 'Company', title: 'Company', width: 160, visible: false, sortable: true },
    { field: '__mj_CreatedAt', title: 'Created', width: 150, visible: false, sortable: true },
  ];

  ngOnInit(): void {
    this.refreshSub = this.pageRefresh.OnRefresh(() => this.Refresh());
    this.applyWindowRange('last90');
    void this.Scope.Load().then(() => this.cdr.markForCheck());
    this.applyFilters();
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  public get Companies(): ScopeCompany[] {
    return this.Scope.Companies;
  }

  /** Recompute the grid's RunViewParams from the current filter set + the app-wide company scope. */
  public applyFilters(): void {
    const filter = this.buildFilter();
    this.GridParams = {
      EntityName: BATCH_ENTITY,
      ExtraFilter: filter || undefined,
      OrderBy: 'PostingDate DESC, JournalEntryBatchNumber DESC',
    };
    this.cdr.markForCheck();
    void this.refreshStats(filter);
  }

  /** The ONE filter expression both the grid and the strip figures are built from. */
  private buildFilter(): string {
    return andFilters(
      this.dateFilter(),
      this.statusFilter(),
      this.searchFilter(),
      this.CompanyIDs.length ? `CompanyID IN (${this.CompanyIDs.map((id) => `'${sqlLiteral(id)}'`).join(',')})` : null,
      this.Scope.FilterFor('CompanyID'),
    );
  }

  /** Inclusive on both ends — PostingDate is a DATE column, same reasoning as All JEs. */
  private dateFilter(): string | null {
    return andFilters(
      this.FromDate ? `PostingDate >= '${sqlLiteral(this.FromDate)}'` : null,
      this.ToDate ? `PostingDate <= '${sqlLiteral(this.ToDate)}'` : null,
    ) || null;
  }

  private statusFilter(): string | null {
    if (this.SelectedStatuses.size === 0) return null;
    const list = [...this.SelectedStatuses].map((s) => `'${s}'`).join(',');
    return `Status IN (${list})`;
  }

  /** Batch № + ERP reference + the full id — the strings a person actually pastes. */
  private searchFilter(): string | null {
    return likeContains(['JournalEntryBatchNumber', 'ExternalJournalEntryBatchRef', 'ID'], this.Search);
  }

  // ─── overview stats (summary strip) ──────────────────────────────────────────

  private async refreshStats(filter: string): Promise<void> {
    const token = ++this.statsToken;
    try {
      const rv = new RunView();
      const results = await rv.RunViews([
        this.countParams(filter),
        ...STATUSES.map((s) => this.countParams(andFilters(filter, `Status='${s}'`))),
      ]);
      if (token !== this.statsToken) return;

      this.TotalCount = results[0]?.Success ? (results[0].TotalRowCount ?? 0) : null;
      const counts = new Map<BatchStatus, number>();
      STATUSES.forEach((s, i) => {
        const r = results[i + 1];
        if (r?.Success) counts.set(s, r.TotalRowCount ?? 0);
      });
      this.statusCounts = counts;
    } catch {
      if (token !== this.statsToken) return;
      this.TotalCount = null;
      this.statusCounts = new Map<BatchStatus, number>();
    }
    this.cdr.markForCheck();
  }

  private countParams(filter: string): RunViewParams {
    return {
      EntityName: BATCH_ENTITY,
      ExtraFilter: filter || undefined,
      Fields: ['ID'],
      MaxRows: 1,
      ResultType: 'simple',
    };
  }

  public StatusCount(status: BatchStatus): number {
    return this.statusCounts.get(status) ?? 0;
  }

  /** Journey tones, matching the batches dashboard's pipeline colouring. */
  private statusTone(status: BatchStatus): MJASummaryFigure['Tone'] {
    switch (status) {
      case 'Posted':
        return 'success';
      case 'Failed':
        return 'danger';
      case 'Pending':
        return 'warning';
      case 'Approved':
      case 'Sent':
        return 'info';
      default:
        return 'muted';
    }
  }

  // ─── list-page standard chrome ───────────────────────────────────────────────

  public get SummaryFigures(): MJASummaryFigure[] {
    const figures: MJASummaryFigure[] = [
      { Label: 'Scope', Value: this.Scope.Label, Tone: 'info' },
      { Label: 'Batches', Value: this.TotalCount === null ? '—' : String(this.TotalCount) },
    ];
    for (const s of STATUSES) {
      const n = this.StatusCount(s);
      if (n > 0) figures.push({ Label: s, Value: String(n), Tone: this.statusTone(s) });
    }
    return figures;
  }

  public get StatusChips(): MJAPresetChip[] {
    return [
      { Key: 'all', Label: 'All' },
      ...STATUSES.map((s) => ({ Key: s, Label: s, Count: this.StatusCount(s) })),
    ];
  }

  public get ActiveStatusKeys(): string[] {
    return this.SelectedStatuses.size === 0 ? ['all'] : [...this.SelectedStatuses];
  }

  public OnPresetToggled(key: string): void {
    if (key === 'all') {
      this.SelectedStatuses.clear();
    } else {
      const status = key as BatchStatus;
      if (this.SelectedStatuses.has(status)) this.SelectedStatuses.delete(status);
      else this.SelectedStatuses.add(status);
    }
    this.applyFilters();
  }

  public AdvancedOpen = false;

  /** The date window counts as ONE deviation — the preset and the calendar are one filter. */
  /** The checkbox-dropdown hands back the whole selection; store + refetch like any filter edit. */
  public OnCompanyIDsChanged(ids: string[]): void {
    this.CompanyIDs = ids;
    this.OnFilterChanged();
  }

  /** Dropdown rows for the window filter — the shared windows plus the custom-range sentinel. */
  public get WindowChoices(): ReadonlyArray<{ Id: string; Label: string }> {
    return [...this.TimeWindows, { Id: 'custom', Label: 'Custom range' }];
  }

  public get AdvancedCount(): number {
    let n = 0;
    if (this.CompanyIDs.length) n++;
    if (this.TimeWindow !== 'last90') n++;
    return n;
  }

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  public OnSearchChanged(text: string): void {
    this.Search = text;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applyFilters(), 300);
  }

  // ─── filter controls ─────────────────────────────────────────────────────────

  public OnFilterChanged(): void {
    this.applyFilters();
  }

  public OnWindowChanged(): void {
    if (this.TimeWindow !== 'custom') this.applyWindowRange(this.TimeWindow);
    this.applyFilters();
  }

  private applyWindowRange(window: TimeWindowId): void {
    const { From, To } = timeWindowRange(window);
    this.FromDate = From ? toSqlDate(From) : null;
    this.ToDate = To ? toSqlDate(new Date(To.getTime() - DAY_MS)) : null;
  }

  public OnDateChanged(): void {
    this.TimeWindow = 'custom';
    this.applyFilters();
  }

  public Refresh(): void {
    this.applyFilters();
    void this.grid?.Refresh(); // unchanged params deep-equal → the setter skips; refetch explicitly
  }

  /** Row click → the batch detail slide-in. `rowKey` is CompositeKey form — parse it (grid-row-key). */
  public OnRowClicked(rowKey: string | null | undefined): void {
    const id = rowKeyToId(rowKey);
    if (!id) return;
    this.SelectedID = id;
    this.cdr.markForCheck();
  }

  public OnDetailClosed(): void {
    this.SelectedID = null;
    this.cdr.markForCheck();
  }

  public OnOpenInWorkspace(id: string): void {
    this.SelectedID = null;
    this.WorkspaceRequested.emit(id);
  }
}
