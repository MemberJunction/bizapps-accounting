import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit, OnDestroy } from '@angular/core';
import { Metadata, RunView, RunViewParams } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { GridColumnConfig } from '@memberjunction/ng-entity-viewer';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { BatchDispatchClient } from '../../BatchDispatch/batch-dispatch.client';
import { TIME_WINDOWS, TimeWindowId, timeWindowRange, toSqlDate, andFilters } from '../../../transfer-pending/list-scaffold/time-window';
import { sqlLiteral, likeContains } from '../../../transfer-pending/list-scaffold/sql-filter';
import { rowKeyToId } from '../../../transfer-pending/list-scaffold/grid-row-key';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

/** Value-list unions derived from the generated entity (MJ CLAUDE.md rule 2c — never hand-copied). */
type BatchStatus = mjBizAppsAccountingJournalEntryBatchEntity['Status'];

/**
 * The batch lifecycle in lifecycle order — the semantic spine of the status toggles (no metadata
 * ordering gives us this), but typed `BatchStatus[]`, so widening the CHECK constraint fails the
 * build here rather than silently dropping a status from the filter.
 */
const STATUSES: readonly BatchStatus[] = ['Pending', 'Approved', 'Sent', 'Posted', 'Failed', 'Cancelled'] as const;

/**
 * **What "in flight" means on this page** — the whole reason the screen exists separately from All
 * batches. A batch that is `Sent` is awaiting the ERP's confirmation; a `Failed` one needs a retry.
 * Everything else is either settled (`Posted`, `Cancelled`) or has not left yet (`Pending`,
 * `Approved` — those belong to Batch approvals). So this list DEFAULTS to exactly these two.
 */
const IN_FLIGHT: readonly BatchStatus[] = ['Sent', 'Failed'] as const;

/** The window picker's value: a shared preset, or `custom` once the calendar boxes are edited. */
type WindowChoice = TimeWindowId | 'custom';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dispatch status (UI plan §8.2) — the ERP-facing view of a batch: **did it land, and if not, why.**
 *
 * **How this earns its existence next to All batches** (Marcelo's core note — "if dispatch status is
 * gonna look the same as all batches, make sure this is adding some value"):
 *
 * 1. **It defaults to what is actually in flight** — Sent + Failed (see IN_FLIGHT), not the whole
 *    batch history. All batches is the archive; this is the wire.
 * 2. **What is waiting or broken sorts to the TOP** — the grid's default order is a lifecycle CASE
 *    (Failed → Sent → Approved → Pending → settled), newest dispatch first inside each band.
 * 3. **It leads with the dispatch columns All batches does not** — TargetSystem, SentAt, PostedAt,
 *    ExternalBatchRef (the ERP's own reference) and ErrorMessage. All batches leads with debits,
 *    credits and coverage; this leads with the send.
 * 4. **A Failed batch's error is surfaced, never buried** — failed batches get a dedicated attention
 *    strip above the grid carrying the full ErrorMessage + the Retry verb, and the strip deliberately
 *    IGNORES the status toggles (turning Failed off must not hide the alarm).
 *
 * **Filters mirror All batches verbatim in idiom** (status toggles → Target ERP select → From/To
 * calendar → window presets), so the two screens read the same. There is deliberately NO company
 * select: `JournalEntryBatch` carries no CompanyID — a batch is multi-company (CH-4) — so a company
 * narrowing here would be a lie in the same control position. All batches can offer one only because
 * its read model derives the CompanyIDs per batch client-side.
 *
 * Refetches on a mutating action + the ONE shell header refresh; no polling (§8 refresh policy).
 */
@Component({
  standalone: false,
  selector: 'mj-dispatch-status-page',
  templateUrl: './dispatch-status.page.html',
  styleUrls: ['./dispatch-status.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DispatchStatusPageComponent extends BaseAngularComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  /** The shell header's Refresh reaches this page while it is the mounted one. */
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;

  public readonly Statuses = STATUSES;
  public readonly TimeWindows = TIME_WINDOWS;

  /**
   * `string`, not the TargetSystem union: the options come from runtime entity metadata (see
   * loadTargetValues), so claiming the compile-time union would be a cast we cannot honour. The
   * value is only ever composed into a filter predicate.
   */
  public Targets: string[] = [];
  public TargetFilter = 'All';

  /** Status toggles — a SET, mirroring All batches (empty = every status). Defaults to in flight. */
  public SelectedStatuses = new Set<BatchStatus>(IN_FLIGHT);

  /** Calendar range over BatchedAt (inclusive, `YYYY-MM-DD`). Filled by the presets; editable. */
  public TimeWindow: WindowChoice = 'last30';
  public FromDate: string | null = null;
  public ToDate: string | null = null;
  public Search = '';

  public GridParams: RunViewParams = { EntityName: BATCH_ENTITY };

  /** Filtered count (`null` = not loaded / the read failed — rendered "—", never a fabricated 0). */
  public TotalCount: number | null = null;
  /** Failed batches in the current NON-status filter — the attention strip's rows. */
  public FailedBatches: mjBizAppsAccountingJournalEntryBatchEntity[] = [];
  /** The row whose full dispatch facts are pinned above the grid (grid Error column truncates). */
  public SelectedBatch: mjBizAppsAccountingJournalEntryBatchEntity | null = null;

  public IsLoading = false;
  public LoadError: string | null = null;
  public RetryingBatchID: string | null = null;
  public ActionMessage: string | null = null;
  public ActionIsError = false;

  /** Guards a slower earlier load from repainting over a newer one. */
  private loadToken = 0;

  /**
   * Dispatch-first column set. Ordered as the question is asked: which batch, what state, to which
   * ERP, when did it leave, when did it land, what did the ERP call it, and what went wrong.
   */
  public Columns: GridColumnConfig[] = [
    { field: 'BatchNumber', title: 'Batch №', width: 170, sortable: true },
    { field: 'Status', title: 'Status', width: 110, sortable: true },
    { field: 'TargetSystem', title: 'Target ERP', width: 140, sortable: true },
    { field: 'SentAt', title: 'Sent', width: 160, sortable: true },
    { field: 'PostedAt', title: 'Posted', width: 160, sortable: true },
    { field: 'ExternalBatchRef', title: 'ERP reference', width: 180, sortable: true },
    { field: 'ErrorMessage', title: 'Error', width: 'auto', sortable: false },
    { field: 'TotalEntries', title: 'JEs', width: 80, sortable: true },
    { field: 'BatchedAt', title: 'Batched', width: 160, visible: false, sortable: true },
  ];

  ngOnInit(): void {
    this.refreshSub = this.pageRefresh.OnRefresh(() => this.Refresh());
    this.Targets = this.loadTargetValues();
    this.applyWindowRange('last30');
    this.applyFilters();
  }

  ngOnDestroy(): void {
    // Unsubscribing is what keeps the header's Refresh page-aware: a destroyed page stops counting.
    this.refreshSub?.unsubscribe();
  }

  /** The ONE refresh control lives in the shell header — this page adds no second one (§8). */
  public Refresh(): void {
    this.applyFilters();
  }

  /**
   * Read TargetSystem's allowed values from entity metadata — the same source CodeGen generated the
   * union from, so the select tracks the CHECK constraint forever without a hand-listed array.
   */
  private loadTargetValues(): string[] {
    const entity = new Metadata().EntityByName(BATCH_ENTITY);
    const field = entity?.Fields.find((f) => f.Name === 'TargetSystem');
    return (field?.EntityFieldValues ?? []).map((v) => v.Value).sort((a, b) => a.localeCompare(b));
  }

  // ─── filter → grid ───────────────────────────────────────────────────────────

  /** Recompute the grid's RunViewParams, then the count + the failed strip, from one filter source. */
  public applyFilters(): void {
    this.GridParams = {
      EntityName: BATCH_ENTITY,
      ExtraFilter: this.buildFilter() || undefined,
      OrderBy: this.dispatchOrderBy(),
    };
    this.cdr.markForCheck();
    void this.load();
  }

  /**
   * **The value-add sort** (Marcelo: "maybe it's automatically sorting the ones that are waiting on
   * the top"). A lifecycle CASE puts the broken first, then the waiting, then everything settled;
   * inside each band the most recent dispatch leads. SQL Server sorts NULL `SentAt` last under DESC,
   * so a never-sent batch can't jump the queue.
   */
  private dispatchOrderBy(): string {
    return (
      `CASE Status WHEN 'Failed' THEN 0 WHEN 'Sent' THEN 1 WHEN 'Approved' THEN 2 ` +
      `WHEN 'Pending' THEN 3 ELSE 4 END, SentAt DESC, BatchedAt DESC`
    );
  }

  /** The full predicate the grid + the count read share — so the chip can never disagree with rows. */
  private buildFilter(): string {
    return andFilters(this.baseFilter(), this.statusFilter());
  }

  /**
   * Everything EXCEPT the status toggles. The failed-attention strip is built from this, which is
   * what lets it keep showing a broken dispatch even when Failed is toggled off.
   */
  private baseFilter(): string {
    return andFilters(this.dateFilter(), this.targetFilter(), this.searchFilter());
  }

  /** Empty set = all statuses (the All-batches rule), so no predicate at all. */
  private statusFilter(): string | null {
    if (this.SelectedStatuses.size === 0) return null;
    return `Status IN (${[...this.SelectedStatuses].map((s) => `'${s}'`).join(',')})`;
  }

  private targetFilter(): string | null {
    return this.TargetFilter === 'All' ? null : `TargetSystem='${sqlLiteral(this.TargetFilter)}'`;
  }

  /**
   * The calendar range's predicate over **BatchedAt** — the one instant every batch has (SentAt is
   * NULL until dispatch, so ranging on it would silently drop never-sent batches the moment the user
   * widens the status toggles).
   *
   * BatchedAt is `datetimeoffset`, so the To box (which states an INCLUSIVE last day) becomes an
   * EXCLUSIVE `< To+1day` bound — a `<= '2026-07-16'` would compare against midnight and drop that
   * whole day's dispatches.
   */
  private dateFilter(): string | null {
    return (
      andFilters(
        this.FromDate ? `BatchedAt >= '${sqlLiteral(this.FromDate)}'` : null,
        this.ToDate ? `BatchedAt < '${sqlLiteral(nextDay(this.ToDate))}'` : null,
      ) || null
    );
  }

  /**
   * Server-side search over the batch number + the ERP's own reference — the two identifiers someone
   * chasing a dispatch actually has in hand. Escaped via the shared seam (ExtraFilter is a SQL
   * string with no parameter binding).
   */
  private searchFilter(): string | null {
    return likeContains(['BatchNumber', 'ExternalBatchRef', 'ID'], this.Search);
  }

  // ─── loads ───────────────────────────────────────────────────────────────────

  /**
   * ONE batched round-trip (RunViews, never one query per row): the filtered count for the header
   * chip + the failed batches for the attention strip.
   */
  private async load(): Promise<void> {
    const token = ++this.loadToken;
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      const rv = new RunView();
      const [count, failed] = await rv.RunViews([this.countParams(), this.failedParams()]);
      if (token !== this.loadToken) return;

      this.TotalCount = count?.Success ? (count.TotalRowCount ?? 0) : null;
      this.FailedBatches = failed?.Success ? ((failed.Results ?? []) as mjBizAppsAccountingJournalEntryBatchEntity[]) : [];
      if (!failed?.Success) this.LoadError = failed?.ErrorMessage ?? 'Could not load failed dispatches.';
    } catch (e) {
      if (token !== this.loadToken) return;
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.TotalCount = null;
      this.FailedBatches = [];
    } finally {
      if (token === this.loadToken) {
        this.IsLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  /** Count-only read: one row on the wire, the answer in TotalRowCount. */
  private countParams(): RunViewParams {
    return {
      EntityName: BATCH_ENTITY,
      ExtraFilter: this.buildFilter() || undefined,
      Fields: ['ID'],
      MaxRows: 1,
      ResultType: 'simple',
    };
  }

  /** Failed dispatches — entity objects, so every field is typed (never `.Get()`). */
  private failedParams(): RunViewParams {
    return {
      EntityName: BATCH_ENTITY,
      ExtraFilter: andFilters(this.baseFilter(), `Status='Failed'`) || undefined,
      OrderBy: 'SentAt DESC, BatchedAt DESC',
      ResultType: 'entity_object',
    };
  }

  // ─── header state ────────────────────────────────────────────────────────────

  public get FailedCount(): number {
    return this.FailedBatches.length;
  }

  /** True once the filters have resolved to nothing — the honest empty state, not a bug. */
  public get IsEmpty(): boolean {
    return !this.IsLoading && this.TotalCount === 0;
  }

  public get EmptyMessage(): string {
    return this.ShowingInFlight
      ? 'Nothing is in flight. No batch is awaiting an ERP confirmation and none has failed in this window — that is the healthy state, not a missing read.'
      : 'No batches match these filters. Widen the date window, or clear the status toggles to see every batch.';
  }

  // ─── filter controls ─────────────────────────────────────────────────────────

  public OnFilterChanged(): void {
    this.applyFilters();
  }

  public ToggleStatus(status: BatchStatus): void {
    if (this.SelectedStatuses.has(status)) this.SelectedStatuses.delete(status);
    else this.SelectedStatuses.add(status);
    this.applyFilters();
  }
  public IsStatusOn(status: BatchStatus): boolean {
    return this.SelectedStatuses.has(status);
  }
  public ShowAllStatuses(): void {
    this.SelectedStatuses.clear();
    this.applyFilters();
  }
  public get AllStatusesShown(): boolean {
    return this.SelectedStatuses.size === 0;
  }

  /** Back to the page's reason for being: only what is awaiting the ERP or needs a retry. */
  public ShowInFlight(): void {
    this.SelectedStatuses = new Set<BatchStatus>(IN_FLIGHT);
    this.applyFilters();
  }
  public get ShowingInFlight(): boolean {
    return this.SelectedStatuses.size === IN_FLIGHT.length && IN_FLIGHT.every((s) => this.SelectedStatuses.has(s));
  }

  /** Button variant for an on/off toggle — the All-batches convention. */
  public ToggleVariant(active: boolean): 'primary' | 'flat' {
    return active ? 'primary' : 'flat';
  }

  /** A window preset FILLS the calendar range (the All-batches idiom); 'custom' leaves it alone. */
  public OnWindowChanged(): void {
    if (this.TimeWindow !== 'custom') this.applyWindowRange(this.TimeWindow);
    this.applyFilters();
  }

  private applyWindowRange(window: TimeWindowId): void {
    const { From, To } = timeWindowRange(window);
    this.FromDate = From ? toSqlDate(From) : null;
    // timeWindowRange's To is EXCLUSIVE (tomorrow 00:00 UTC); the calendar box states an INCLUSIVE
    // last day, so step back one — dateFilter() re-opens it to an exclusive bound for the compare.
    this.ToDate = To ? toSqlDate(new Date(To.getTime() - DAY_MS)) : null;
  }

  /** Editing either calendar box means the range is no longer a named preset. */
  public OnDateChanged(): void {
    this.TimeWindow = 'custom';
    this.applyFilters();
  }

  // ─── row selection + retry ───────────────────────────────────────────────────

  /**
   * Row click → pin the batch's full dispatch facts above the grid (the Error column truncates a
   * multi-line ERP failure; this shows all of it, with the Retry verb attached).
   *
   * `rowKey` is NOT the ID — it is CompositeKey's concatenated `"ID|<guid>"`. Interpolating it raw
   * into a filter compiles, runs, and silently matches nothing; parse it through the shared seam.
   */
  public async OnRowClicked(rowKey: string | null | undefined): Promise<void> {
    const id = rowKeyToId(rowKey);
    if (!id) return;

    // SQL Server returns UUIDs uppercase — `===` would silently miss (MJ UUID guide). One click may
    // cost one read; the already-loaded failed rows usually spare even that.
    const known = this.FailedBatches.find((b) => UUIDsEqual(b.ID, id));
    if (known) {
      this.SelectedBatch = known;
      this.cdr.markForCheck();
      return;
    }
    await this.loadSelected(id);
  }

  private async loadSelected(id: string): Promise<void> {
    const result = await new RunView().RunView<mjBizAppsAccountingJournalEntryBatchEntity>({
      EntityName: BATCH_ENTITY,
      ExtraFilter: `ID='${sqlLiteral(id)}'`,
      ResultType: 'entity_object',
    });
    this.SelectedBatch = result.Success ? (result.Results?.[0] ?? null) : null;
    this.cdr.markForCheck();
  }

  public ClearSelection(): void {
    this.SelectedBatch = null;
    this.cdr.markForCheck();
  }

  /** Only a Failed dispatch is retryable — Posted is settled, Sent is still in flight. */
  public CanRetry(batch: mjBizAppsAccountingJournalEntryBatchEntity): boolean {
    return batch.Status === 'Failed' && this.RetryingBatchID === null;
  }

  public RetryBlockedReason(batch: mjBizAppsAccountingJournalEntryBatchEntity): string | null {
    switch (batch.Status) {
      case 'Failed':
        return null;
      case 'Posted':
        return 'This batch already posted to the ERP.';
      case 'Sent':
        return 'This batch is in flight — awaiting the ERP’s confirmation.';
      case 'Cancelled':
        return 'This batch was cancelled.';
      default:
        return `A ${batch.Status} batch has not been dispatched — approve and dispatch it from Batch approvals.`;
    }
  }

  /** Re-attempt the ERP send. Same verb (and the same approval gate) as Batch approvals. */
  public async Retry(batch: mjBizAppsAccountingJournalEntryBatchEntity): Promise<void> {
    if (!this.CanRetry(batch)) return;
    this.RetryingBatchID = batch.ID;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      const client = new BatchDispatchClient(this.ProviderToUse as GraphQLDataProvider);
      const res = await client.DispatchBatch(batch.ID);
      if (res.Success) {
        this.ActionMessage = `Re-dispatched ${batch.BatchNumber}${res.ExternalBatchRef ? ` — ERP ref ${res.ExternalBatchRef}` : ''}.`;
        this.ActionIsError = false;
        this.SelectedBatch = null;
        this.Refresh(); // refetch-on-mutating-action (§8)
      } else {
        this.setError(res.ErrorMessage ?? 'Dispatch failed.');
      }
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.RetryingBatchID = null;
      this.cdr.markForCheck();
    }
  }

  private setError(message: string): void {
    this.ActionMessage = message;
    this.ActionIsError = true;
    this.cdr.markForCheck();
  }
}

/** `YYYY-MM-DD` one day on, in UTC — the exclusive upper bound for an inclusive To box. */
function nextDay(sqlDate: string): string {
  return toSqlDate(new Date(Date.parse(`${sqlDate}T00:00:00.000Z`) + DAY_MS));
}
