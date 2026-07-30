import { Component, ChangeDetectionStrategy, ChangeDetectorRef, EventEmitter, inject, OnInit, OnDestroy, Output } from '@angular/core';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { RunViewParams, CompositeKey, Metadata, RunView } from '@memberjunction/core';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { GridColumnConfig } from '@memberjunction/ng-entity-viewer';
import { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { CompanyScopeService, ScopeCompany } from '../../shared/company-scope.service';
import { openBizDetail } from '../../shared/biz-detail-form';
import { TIME_WINDOWS, TimeWindowId, timeWindowRange, toSqlDate, andFilters } from '../../../transfer-pending/list-scaffold/time-window';
import { sqlLiteral, likeContains } from '../../../transfer-pending/list-scaffold/sql-filter';
import { rowKeyToId } from '../../../transfer-pending/list-scaffold/grid-row-key';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/** Value-list union derived from the generated entity (MJ CLAUDE.md rule 2c — never hand-copied). */
type JEStatus = mjBizAppsAccountingJournalEntryEntity['Status'];

/**
 * The ledger status lifecycle. Only three values and they ARE the screen's semantic spine (the
 * filter chips read Pending → Batched → GLPosted in lifecycle order, which no metadata ordering
 * gives us), so the list is stated here — but typed as `JEStatus[]`, so if CodeGen ever widens the
 * CHECK constraint this line fails to compile rather than silently omitting a status.
 */
const STATUSES: readonly JEStatus[] = ['Pending', 'Batched', 'GLPosted'] as const;

/**
 * The window picker's value: one of the shared presets, or `custom` once the user edits the calendar
 * boxes directly. A preset FILLS the calendar range (the All-batches idiom) rather than living beside
 * it, so there is exactly one date source of truth and no "preset says 90 days, calendar says 2020"
 * contradiction.
 */
type WindowChoice = TimeWindowId | 'custom';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * All journal entries (UI plan §8.1) — the **list-scaffold pilot**: the grid/filter/slide-in idiom
 * every other list clones.
 *
 * **Built on MJ's `<mj-entity-data-grid>`** (§8 MJ-wins rule), which already ships the whole list
 * substrate this screen needs: AG Grid rendering, RunView-driven loading, **infinite (server-side)
 * pagination** — the plan's keyset "Load more" in MJ's own idiom — server-side sorting, column
 * reorder/resize/visibility, export, and per-user grid-state persistence. We contribute only the
 * domain: the filter set, the column config, and the row slide-in.
 *
 * Filters live in the page header's `[toolbar]` and state in `[meta]`, per the Explorer chrome
 * conventions; the refresh control is the single header seam from the §8 dispatch refresh policy
 * (refetch-on-mutating-action + ONE refresh control, no polling).
 */
@Component({
  standalone: false,
  selector: 'mj-all-journal-entries-page',
  templateUrl: './all-journal-entries.page.html',
  styleUrls: ['./all-journal-entries.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllJournalEntriesPageComponent implements OnInit, OnDestroy {
  /**
   * The section's create verb (Marcelo 2026-07-30) — same contract as the dashboards'
   * AccountingDashboardBase: the page cannot navigate itself (Explorer resources are not routed),
   * so the header button emits the intent and the hosting shell decides what "create" does
   * (today: GoToPage('workspace')).
   */
  @Output() CreateRequested = new EventEmitter<void>();
  public RequestCreate(): void {
    this.CreateRequested.emit();
  }

  private cdr = inject(ChangeDetectorRef);
  /** The shell header's Refresh reaches this page only while it is the mounted one. */
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;
  private forms = inject(MJFormPresenterService);
  public Scope = inject(CompanyScopeService);

  public readonly TimeWindows = TIME_WINDOWS;
  public readonly Statuses = STATUSES;

  /**
   * EntryType's value list, read from MJ entity metadata at runtime rather than hand-listed.
   *
   * This field's union is CodeGen-generated from the column's CHECK constraint and is genuinely a
   * moving target (16 values today: OrderBooking, Reversal, Refund, RevenueRecognition, …). A
   * hard-coded array here would silently stop offering any value a later migration adds — the exact
   * drift MJ CLAUDE.md rule 2c warns about. Metadata is the same source CodeGen used, so the filter
   * tracks the constraint forever, for free.
   */
  public EntryTypes: string[] = [];

  /** Time-window default — §0 requires one on every list; 90 days suits a ledger review. */
  public TimeWindow: WindowChoice = 'last90';
  /** Calendar range (inclusive, `YYYY-MM-DD`). Filled by the window presets; editable directly. */
  public FromDate: string | null = null;
  public ToDate: string | null = null;

  /**
   * Status filter — a SET, mirroring All batches (empty = all statuses), not a single-select. Same
   * control idiom, same "All" affordance, so the two screens read identically.
   */
  public SelectedStatuses = new Set<JEStatus>();

  /**
   * Per-page company narrowing, mirroring All batches' Company select. This ANDs *inside* the
   * app-wide company scope (the rail chip) — it narrows the scope, it never widens it.
   */
  public CompanyID: string | null = null;

  /**
   * `string`, not `JEType | 'All'`, on purpose: the options come from runtime metadata (see
   * EntryTypes), so claiming the compile-time union here would be a cast we cannot honour. The
   * value is only ever composed into a filter predicate.
   */
  public TypeFilter: string = 'All';
  public Search = '';

  /**
   * Overview stats for the header's `[meta]` slot.
   *
   * **They honour the filters** — every number is a COUNT of exactly what the grid below is showing
   * (the header subtitle says so on screen, because a chip that silently ignored the filters above it
   * would be a lie). Each is a §0-legal cheap read: `MaxRows: 1` + `TotalRowCount`, i.e. SQL counts
   * and ships one row. Nothing here sums the ledger.
   *
   * `null` = not yet loaded / the count read failed — rendered as "—" rather than a wrong 0.
   */
  public TotalCount: number | null = null;
  private statusCounts = new Map<JEStatus, number>();
  /** Guards against an older stat batch landing after a newer one and repainting stale numbers. */
  private statsToken = 0;

  public GridParams: RunViewParams = { EntityName: JE_ENTITY };

  /** The row whose detail slide-in is open, if any. */
  public SelectedID: string | null = null;

  /** Bumped to force the grid to refetch (the header refresh control + post-mutation refetch). */
  public RefreshToken = 0;

  public Columns: GridColumnConfig[] = [
    { field: 'EntryNumber', title: 'Entry №', width: 140, sortable: true },
    { field: 'EffectiveDate', title: 'Effective', width: 120, sortable: true },
    { field: 'Status', title: 'Status', width: 110, sortable: true },
    { field: 'EntryType', title: 'Type', width: 100, sortable: true },
    // The JE's free-text meaning. The field is `Description` (there is no `Memo` column on the
    // Journal Entry entity), but the ratified naming model (Marcelo 2026-07-17) calls it the MEMO —
    // the human label people scan by — so the column is TITLED "Memo". `width: 'auto'` gives it the
    // most room; the grid ellipsises overflow so a long memo stays on one readable line.
    { field: 'Description', title: 'Memo', width: 'auto', sortable: false },
    { field: 'CompanyID', title: 'Company', width: 160, visible: false, sortable: true },
    { field: 'BatchID', title: 'Batch', width: 140, visible: false, sortable: true },
  ];

  ngOnInit(): void {
    this.refreshSub = this.pageRefresh.OnRefresh(() => this.Refresh());
    this.EntryTypes = this.loadEntryTypeValues();
    // Seed the calendar boxes from the default window, so the preset and the range agree from the
    // first paint (the range is what actually filters — see WindowChoice).
    this.applyWindowRange('last90');
    // Idempotent (the rail chip loads it too) — this only populates the Company select's options.
    void this.Scope.Load().then(() => this.cdr.markForCheck());
    this.applyFilters();
  }

  /** The Company select's options — the app-wide roster, so no per-page RunView. */
  public get Companies(): ScopeCompany[] {
    return this.Scope.Companies;
  }

  /** Read EntryType's allowed values from entity metadata (see the EntryTypes doc comment). */
  private loadEntryTypeValues(): string[] {
    const entity = new Metadata().EntityByName(JE_ENTITY);
    const field = entity?.Fields.find((f) => f.Name === 'EntryType');
    return (field?.EntityFieldValues ?? []).map((v) => v.Value).sort((a, b) => a.localeCompare(b));
  }

  /** Recompute the grid's RunViewParams from the current filter set + the app-wide company scope. */
  public applyFilters(): void {
    const filter = this.buildFilter();

    this.GridParams = {
      EntityName: JE_ENTITY,
      ExtraFilter: filter || undefined,
      OrderBy: 'EffectiveDate DESC, EntryNumber DESC',
    };
    this.cdr.markForCheck();
    void this.refreshStats(filter);
  }

  /**
   * The single filter expression BOTH the grid and the stat chips are built from — which is precisely
   * what makes the chips honest: there is no second, chip-only predicate that could drift.
   */
  private buildFilter(): string {
    return andFilters(
      this.dateFilter(),
      this.statusFilter(),
      this.TypeFilter === 'All' ? null : `EntryType='${sqlLiteral(this.TypeFilter)}'`,
      this.searchFilter(),
      this.CompanyID ? `CompanyID='${sqlLiteral(this.CompanyID)}'` : null,
      // Company scope is app-wide: an empty selection means ALL, resolved inside the service so the
      // rule lives in exactly one place. ANDed with the per-page select above, which only narrows it.
      this.Scope.FilterFor('CompanyID'),
    );
  }

  /**
   * The calendar range's predicate. Inclusive on BOTH ends: EffectiveDate is a DATE column (no time
   * component), so `<= ToDate` is exactly equivalent to the shared helper's half-open upper bound
   * while matching what the To box literally says.
   */
  private dateFilter(): string | null {
    return andFilters(
      this.FromDate ? `EffectiveDate >= '${sqlLiteral(this.FromDate)}'` : null,
      this.ToDate ? `EffectiveDate <= '${sqlLiteral(this.ToDate)}'` : null,
    ) || null;
  }

  /** Empty set = all statuses (the All-batches rule), so no predicate at all. */
  private statusFilter(): string | null {
    if (this.SelectedStatuses.size === 0) return null;
    const list = [...this.SelectedStatuses].map((s) => `'${s}'`).join(',');
    return `Status IN (${list})`;
  }

  /**
   * Server-side search over the HUMAN fields first — the MEMO (`Description`) and the entry NUMBER —
   * plus the full record ID. Marcelo 2026-07-17: the database IDs are meaningless to users, so the
   * memo and number lead; but the id stays searchable in full so a support/paste lookup still works.
   * `likeContains` matches `ID` fine — SQL Server implicitly converts the uniqueidentifier for LIKE.
   * Escaped via the shared seam — this text is composed into a SQL predicate string (RunView's
   * ExtraFilter has no parameter binding).
   */
  private searchFilter(): string | null {
    return likeContains(['Description', 'EntryNumber', 'ID'], this.Search);
  }

  // ─── overview stats (header [meta]) ──────────────────────────────────────────

  /**
   * Refresh the header chips: one batched round-trip of count-only reads over the SAME filter the
   * grid uses. §0-legal — `MaxRows: 1` + `TotalRowCount` counts in SQL and ships a single row; there
   * is no aggregate over the ledger here and there must never be one.
   */
  private async refreshStats(filter: string): Promise<void> {
    const token = ++this.statsToken;
    try {
      const rv = new RunView();
      const results = await rv.RunViews([
        this.countParams(filter),
        ...STATUSES.map((s) => this.countParams(andFilters(filter, `Status='${s}'`))),
      ]);
      // A slower earlier batch must never repaint over a newer one's numbers.
      if (token !== this.statsToken) return;

      this.TotalCount = results[0]?.Success ? (results[0].TotalRowCount ?? 0) : null;
      const counts = new Map<JEStatus, number>();
      STATUSES.forEach((s, i) => {
        const r = results[i + 1];
        if (r?.Success) counts.set(s, r.TotalRowCount ?? 0);
      });
      this.statusCounts = counts;
    } catch {
      if (token !== this.statsToken) return;
      // A failed count shows "—", never a fabricated 0.
      this.TotalCount = null;
      this.statusCounts = new Map<JEStatus, number>();
    }
    this.cdr.markForCheck();
  }

  /** Count-only read shape: one row on the wire, the answer in TotalRowCount. */
  private countParams(filter: string): RunViewParams {
    return {
      EntityName: JE_ENTITY,
      ExtraFilter: filter || undefined,
      Fields: ['ID'],
      MaxRows: 1,
      ResultType: 'simple',
    };
  }

  public StatusCount(status: JEStatus): number {
    return this.statusCounts.get(status) ?? 0;
  }

  /** Stat-badge variant per status — the same lifecycle colouring the batches header uses. */
  public BadgeVariant(status: JEStatus): 'success' | 'warning' | 'info' | 'default' {
    switch (status) {
      case 'GLPosted':
        return 'success';
      case 'Batched':
        return 'info';
      case 'Pending':
        return 'warning';
      default:
        return 'default';
    }
  }

  // ─── filter controls ─────────────────────────────────────────────────────────

  public OnFilterChanged(): void {
    this.applyFilters();
  }

  /** Status toggles (multi-select, mirroring All batches). */
  public ToggleStatus(status: JEStatus): void {
    if (this.SelectedStatuses.has(status)) this.SelectedStatuses.delete(status);
    else this.SelectedStatuses.add(status);
    this.applyFilters();
  }
  public IsStatusOn(status: JEStatus): boolean {
    return this.SelectedStatuses.has(status);
  }
  public ShowAllStatuses(): void {
    this.SelectedStatuses.clear();
    this.applyFilters();
  }
  public get AllStatusesShown(): boolean {
    return this.SelectedStatuses.size === 0;
  }
  /** Button variant for an on/off toggle — the All-batches convention. */
  public ToggleVariant(active: boolean): 'primary' | 'flat' {
    return active ? 'primary' : 'flat';
  }

  /** A window preset FILLS the calendar range (see WindowChoice); 'custom' leaves the dates alone. */
  public OnWindowChanged(): void {
    if (this.TimeWindow !== 'custom') this.applyWindowRange(this.TimeWindow);
    this.applyFilters();
  }

  private applyWindowRange(window: TimeWindowId): void {
    const { From, To } = timeWindowRange(window);
    this.FromDate = From ? toSqlDate(From) : null;
    // timeWindowRange's `To` is EXCLUSIVE (tomorrow 00:00 UTC). The calendar box states an INCLUSIVE
    // last day, so step back one day — and since EffectiveDate is a DATE column the resulting
    // `<= today` predicate selects exactly the same rows as the helper's `< tomorrow`.
    this.ToDate = To ? toSqlDate(new Date(To.getTime() - DAY_MS)) : null;
  }

  /** Editing either calendar box means the range is no longer a named preset. */
  public OnDateChanged(): void {
    this.TimeWindow = 'custom';
    this.applyFilters();
  }

  /** The ONE refresh control (§8 dispatch ruling) — the seam live push replaces later. */
  ngOnDestroy(): void {
    // Unsubscribing is what keeps the header's Refresh page-aware: a destroyed page stops counting.
    this.refreshSub?.unsubscribe();
  }
  public Refresh(): void {
    this.RefreshToken++;
    this.applyFilters();
  }

  /**
   * Row click → the JE detail slide-in (element doctrine: slide-in = quick VIEW).
   *
   * `rowKey` is NOT the JE's ID — it is CompositeKey's concatenated form ("ID|<guid>"), so it must
   * be parsed (see rowKeyToId). Passing it through unparsed is what made this panel silently fail
   * to load for every row.
   *
   * The purpose-built panel, not the generic form host: this screen's detail must carry the lines,
   * origin lineage, reversal chain, batch membership and the C.8 chip — none of which the generic
   * host knows about.
   */
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

  /** A mutating action inside the panel (reversal) must refetch the list — §8 refresh policy. */
  public OnDetailChanged(): void {
    this.Refresh();
  }

  public get ScopeLabel(): string {
    return this.Scope.Label;
  }
}
