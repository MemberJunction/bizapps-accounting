import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Metadata, RunView, RunViewParams } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { GridColumnConfig, EntityDataGridComponent } from '@memberjunction/ng-entity-viewer';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import { AddDays, BusinessTimeZoneEngine, DayStartUtc, IsCalendarDay } from '@mj-biz-apps/common-entities';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { DispatchConfirmationKind, JournalEntryBatchDispatchClient, StrandedJournalEntryBatchWire } from '../../JournalEntryBatchDispatch/journal-entry-batch-dispatch.client';
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
 *    ExternalJournalEntryBatchRef (the ERP's own reference) and ErrorMessage. All batches leads with debits,
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

  /** The grid — its Params setter deep-compares and skips equal params, so refresh-with-unchanged-
   *  filters must call the grid directly. */
  @ViewChild(EntityDataGridComponent) private grid?: EntityDataGridComponent;

  /** Filtered count (`null` = not loaded / the read failed — rendered "—", never a fabricated 0). */
  public TotalCount: number | null = null;
  /** Failed batches in the current NON-status filter — the attention strip's rows. */
  public FailedBatches: mjBizAppsAccountingJournalEntryBatchEntity[] = [];
  /** The row whose full dispatch facts are pinned above the grid (grid Error column truncates). */
  public SelectedBatch: mjBizAppsAccountingJournalEntryBatchEntity | null = null;

  public IsLoading = false;
  public LoadError: string | null = null;
  public RetryingJournalEntryBatchID: string | null = null;
  /**
   * The Failed batch whose retry waits on the operator's ERP check: the server's lookup could not
   * settle whether it already posted (#182), and `RetryConfirmReason` says why.
   */
  public RetryConfirmBatch: mjBizAppsAccountingJournalEntryBatchEntity | null = null;
  public RetryConfirmReason: string | null = null;
  public RetryConfirmKind: DispatchConfirmationKind | null = null;
  /**
   * What the operator typed to override a `Mismatch`. The ERP holds something under this number, and it
   * may be this very batch, so posting again is gated on retyping the batch number, not a single click.
   */
  public MismatchConfirmText = '';
  public ResumingJournalEntryBatchID: string | null = null;

  /**
   * Batches holding entries at `Batched` that no run will pick up (#145) — Failed ones, and Posted
   * ones whose GL-posting flip did not finish. Deliberately NOT narrowed by this page's filters: like
   * the failed strip, it is an alarm, and a date window must not hide entries stranded before it.
   */
  public StrandedBatches: StrandedJournalEntryBatchWire[] = [];
  public ActionMessage: string | null = null;
  public ActionIsError = false;

  /** Guards a slower earlier load from repainting over a newer one. */
  private loadToken = 0;

  /**
   * Dispatch-first column set. Ordered as the question is asked: which batch, what state, to which
   * ERP, when did it leave and who sent it, how many sends it took, when did it land, what did the
   * ERP call it, and what went wrong.
   */
  public Columns: GridColumnConfig[] = [
    { field: 'JournalEntryBatchNumber', title: 'JE batch №', width: 170, sortable: true },
    { field: 'Status', title: 'Status', width: 110, sortable: true },
    { field: 'TargetSystem', title: 'Target ERP', width: 140, sortable: true },
    { field: 'SentAt', title: 'Sent', width: 160, sortable: true },
    { field: 'SentByUser', title: 'Sent by', width: 150, sortable: true },
    { field: 'SendAttemptCount', title: 'Attempts', width: 100, sortable: true },
    { field: 'PostedAt', title: 'Posted', width: 160, sortable: true },
    { field: 'ExternalJournalEntryBatchRef', title: 'ERP reference', width: 180, sortable: true },
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
    void this.grid?.Refresh(); // unchanged params deep-equal → the setter skips; refetch explicitly
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
   * EXCLUSIVE bound at the START OF THE NEXT BUSINESS DAY — resolved through `DayStartUtc`, not by
   * pasting the calendar day into the SQL, which would compare an instant against midnight UTC.
   */
  private dateFilter(): string | null {
    // BatchedAt is an INSTANT; the boxes hold CALENDAR DAYS. Comparing the two directly comes out
    // an offset short: a bare 'YYYY-MM-DD' literal is midnight UTC, which is 19:00 the previous
    // evening in Chicago. Between 00:00 and 05:00 UTC that made the upper bound land BEFORE the
    // 01:00 UTC nightly run, hiding the very batches (and failures) this page exists to triage.
    // DayStartUtc turns a business calendar day into the instant it actually begins, DST included.
    const zone = BusinessTimeZoneEngine.Instance.Zone;
    const startOf = (day: string): string | null =>
      IsCalendarDay(day) ? DayStartUtc(day, zone).toISOString() : null;
    const from = this.FromDate ? startOf(this.FromDate) : null;
    // The To box states an INCLUSIVE last day, so the exclusive bound is the start of the day after.
    const toExclusive = this.ToDate && IsCalendarDay(this.ToDate) ? startOf(AddDays(this.ToDate, 1)) : null;
    return (
      andFilters(
        from ? `BatchedAt >= '${sqlLiteral(from)}'` : null,
        toExclusive ? `BatchedAt < '${sqlLiteral(toExclusive)}'` : null,
      ) || null
    );
  }

  /**
   * Server-side search over the batch number + the ERP's own reference — the two identifiers someone
   * chasing a dispatch actually has in hand. Escaped via the shared seam (ExtraFilter is a SQL
   * string with no parameter binding).
   */
  private searchFilter(): string | null {
    return likeContains(['JournalEntryBatchNumber', 'ExternalJournalEntryBatchRef', 'ID'], this.Search);
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
      const [[count, failed], stranded] = await Promise.all([
        rv.RunViews([this.countParams(), this.failedParams()]),
        this.client().GetStrandedJournalEntries(),
      ]);
      if (token !== this.loadToken) return;

      this.StrandedBatches = stranded.Batches;
      this.TotalCount = count?.Success ? (count.TotalRowCount ?? 0) : null;
      this.FailedBatches = failed?.Success ? ((failed.Results ?? []) as mjBizAppsAccountingJournalEntryBatchEntity[]) : [];

      // Both failures are reported; neither overwrites the other.
      const errors: string[] = [];
      if (!failed?.Success) errors.push(failed?.ErrorMessage ?? 'Could not load failed dispatches.');
      if (!stranded.Success) errors.push(`Could not count stranded journal entries: ${stranded.ErrorMessage ?? 'unknown error'}`);
      this.LoadError = errors.length > 0 ? errors.join(' ') : null;
    } catch (e) {
      if (token !== this.loadToken) return;
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.TotalCount = null;
      this.FailedBatches = [];
      this.StrandedBatches = [];
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

  /** Entries every run skips until someone retries or resumes their batch. */
  public get StrandedEntryCount(): number {
    return this.StrandedBatches.reduce((n, b) => n + b.journalEntryCount, 0);
  }

  /** Posted batches whose member Batched→GLPosted flip did not finish — the resume strip's rows. */
  public get IncompletePostings(): StrandedJournalEntryBatchWire[] {
    return this.StrandedBatches.filter((b) => b.recovery === 'ResumePosting');
  }

  /** True once the filters have resolved to nothing — the honest empty state, not a bug. */
  public get IsEmpty(): boolean {
    return !this.IsLoading && this.TotalCount === 0;
  }

  public get EmptyMessage(): string {
    return this.ShowingInFlight
      ? 'Nothing is in flight. No journal entry batch is awaiting an ERP confirmation and none has failed in this window — that is the healthy state, not a missing read.'
      : 'No journal entry batches match these filters. Widen the date window, or clear the status toggles to see every one.';
  }

  // ─── filter controls ─────────────────────────────────────────────────────────

  /** Choice rows (were inline <option>s). */
  public get TargetChoices(): ReadonlyArray<{ Label: string; Value: string }> {
    return [{ Label: 'All systems', Value: 'All' }, ...this.Targets.map((t) => ({ Label: t, Value: t }))];
  }
  public get WindowChoices(): ReadonlyArray<{ Id: string; Label: string }> {
    return [...this.TimeWindows, { Id: 'custom', Label: 'Custom range' }];
  }

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
    const { From, To } = timeWindowRange(window, new Date(), BusinessTimeZoneEngine.Instance.Zone);
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
    return batch.Status === 'Failed' && this.RetryingJournalEntryBatchID === null;
  }

  public RetryBlockedReason(batch: mjBizAppsAccountingJournalEntryBatchEntity): string | null {
    switch (batch.Status) {
      case 'Failed':
        return null;
      case 'Posted':
        return 'This journal entry batch already posted to the ERP.';
      case 'Sent':
        return 'This journal entry batch is in flight — awaiting the ERP’s confirmation.';
      case 'Cancelled':
        return 'This journal entry batch was cancelled.';
      default:
        return `A ${batch.Status} batch has not been dispatched — approve and dispatch it from Batch approvals.`;
    }
  }

  /**
   * Re-attempt the ERP send. The server checks the ERP for the batch's number first: a posting that
   * matches is recorded Posted without a second send. Only when that check cannot settle it does the
   * operator get asked, with the server's reason — see {@link ConfirmRetry}.
   */
  public async Retry(batch: mjBizAppsAccountingJournalEntryBatchEntity): Promise<void> {
    if (!this.CanRetry(batch)) return;
    await this.dispatchRetry(batch, false);
  }

  public CancelRetry(): void {
    this.clearRetryConfirm();
    this.cdr.markForCheck();
  }

  /** A `Mismatch` override is enabled only once the batch number has been retyped exactly. */
  public get CanConfirmRetry(): boolean {
    if (!this.RetryConfirmBatch) return false;
    if (this.RetryConfirmKind !== 'Mismatch') return true;
    return this.MismatchConfirmText.trim() === (this.RetryConfirmBatch.JournalEntryBatchNumber ?? '');
  }

  /**
   * Retry with the operator's word that the batch number has not posted in the ERP. Offered only
   * after the server refused a plain retry: `Failed` does not prove the ERP rejected the journal, and
   * a retry of a journal the ERP already holds posts it twice.
   */
  public async ConfirmRetry(): Promise<void> {
    const batch = this.RetryConfirmBatch;
    if (!batch || !this.CanConfirmRetry) return;
    this.clearRetryConfirm();
    if (!this.CanRetry(batch)) return;
    await this.dispatchRetry(batch, true);
  }

  private clearRetryConfirm(): void {
    this.RetryConfirmBatch = null;
    this.RetryConfirmReason = null;
    this.RetryConfirmKind = null;
    this.MismatchConfirmText = '';
  }

  /**
   * Same verb as Batch approvals: the server takes a Failed batch back through Sent, re-checking the
   * approval it already has. A send the ERP rejects returns `Success` with `Status: 'Failed'`, so
   * only `Posted` is reported as a successful retry.
   */
  private async dispatchRetry(batch: mjBizAppsAccountingJournalEntryBatchEntity, confirmNotAlreadyPostedInERP: boolean): Promise<void> {
    this.RetryingJournalEntryBatchID = batch.ID;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      const res = await this.client().DispatchJournalEntryBatch(batch.ID, confirmNotAlreadyPostedInERP);
      if (res.Success && res.ConfirmationRequired) {
        this.RetryConfirmBatch = batch;
        this.RetryConfirmReason = res.ConfirmationRequired;
        this.RetryConfirmKind = res.ConfirmationKind ?? null;
        this.MismatchConfirmText = '';
      } else if (res.Success && res.Status === 'Posted') {
        this.ActionMessage = `Re-dispatched ${batch.JournalEntryBatchNumber}${res.ExternalJournalEntryBatchRef ? ` — ERP ref ${res.ExternalJournalEntryBatchRef}` : ''}.`;
        this.ActionIsError = false;
        this.SelectedBatch = null;
        this.Refresh(); // refetch-on-mutating-action (§8)
      } else if (res.Success) {
        this.setError(`Retry of ${batch.JournalEntryBatchNumber} did not post — the batch is ${res.Status ?? 'unknown'}. The ERP's error is on the batch below.`);
        this.SelectedBatch = null;
        this.Refresh();
      } else {
        this.setError(res.ErrorMessage ?? 'Dispatch failed.');
      }
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.RetryingJournalEntryBatchID = null;
      this.cdr.markForCheck();
    }
  }

  /** True when this Posted batch still holds entries at `Batched` — whether or not a resume is running. */
  public IsIncompletePosting(batchId: string): boolean {
    return this.IncompletePostings.some((b) => UUIDsEqual(b.batchId, batchId));
  }

  /** A Posted batch still holding Batched entries, with no resume running — the only state Resume applies to. */
  public CanResume(batchId: string): boolean {
    return this.ResumingJournalEntryBatchID === null && this.IsIncompletePosting(batchId);
  }

  /**
   * Finish a Posted batch's GL-posting flip. NO ERP call: the ERP already holds this journal, which
   * is why this is its own verb and a Posted batch never offers Retry.
   */
  public async Resume(batchId: string, batchNumber: string | null): Promise<void> {
    if (!this.CanResume(batchId)) return;
    this.ResumingJournalEntryBatchID = batchId;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      const res = await this.client().ResumeJournalEntryBatchPosting(batchId);
      if (res.Success) {
        this.ActionMessage = `Finished GL posting for ${batchNumber ?? batchId} — ${res.JournalEntriesPosted} journal entr${res.JournalEntriesPosted === 1 ? 'y' : 'ies'} marked GL-posted.`;
        this.ActionIsError = false;
        this.SelectedBatch = null;
        this.Refresh();
      } else {
        this.setError(res.ErrorMessage ?? 'Resume failed.');
      }
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.ResumingJournalEntryBatchID = null;
      this.cdr.markForCheck();
    }
  }

  private client(): JournalEntryBatchDispatchClient {
    return new JournalEntryBatchDispatchClient(this.ProviderToUse as GraphQLDataProvider);
  }

  private setError(message: string): void {
    this.ActionMessage = message;
    this.ActionIsError = true;
    this.cdr.markForCheck();
  }
}

