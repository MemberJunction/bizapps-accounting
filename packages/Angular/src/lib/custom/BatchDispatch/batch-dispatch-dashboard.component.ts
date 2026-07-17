import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnDestroy } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { RegisterClass, UUIDsEqual, NormalizeUUID } from '@memberjunction/global';
import { ResourceData } from '@memberjunction/core-entities';
import { Metadata, RunView } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { MjButtonVariant } from '@memberjunction/ng-ui-components';
import {
  mjBizAppsAccountingJournalEntryBatchEntity,
} from '@mj-biz-apps/accounting-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { BatchDispatchClient, BatchDecision } from './batch-dispatch.client';
import { PageRefreshService } from '../../transfer-pending/shell-refresh/page-refresh.service';

/** The generated value-list unions (rule 2c: derived, never hand-copied). */
type BatchStatus = mjBizAppsAccountingJournalEntryBatchEntity['Status'];
type TargetSystem = mjBizAppsAccountingJournalEntryBatchEntity['TargetSystem'];

/**
 * The ONLY statuses this inbox ever fetches. This is an APPROVALS queue, so a Cancelled (rejected),
 * Sent, Posted, or Failed batch is deliberately never loaded — those are settled and live on
 * "All batches" / "Dispatch status". `Approved` stays because Dispatch-to-ERP is a verb that exists
 * only on this page; the status filter defaults to `Pending` so the page reads as a pure approvals inbox.
 * Typed as BatchStatus[], so a value CodeGen removes from the CHECK constraint fails to compile here.
 */
const INBOX_STATUSES: BatchStatus[] = ['Pending', 'Approved'];

/**
 * The rest of the lifecycle — reachable by filter, never loaded by default.
 *
 * Marcelo (2026-07-16), correcting his own earlier "shouldn't have batches that are canceled":
 * *"I don't wanna strict only pending on that page. I wanna have approved and pending... I guess maybe
 * having the ability to see batches that are sent and that are canceled might be good, and that are posted
 * so you can kinda see a history... we should definitely just have the ability to filter at least on those,
 * and then by default, it should just be pending and approved so that it's just the ones that explicitly
 * need an action to move forward."*
 *
 * So the default is the WORKLIST (things needing an action); history is one click away, not gone.
 */
const HISTORY_STATUSES: BatchStatus[] = ['Sent', 'Posted', 'Failed', 'Cancelled'];

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEBLI_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batch Line Items';

/** A journal-entry header in a batch — the only reason we read JEs is the covered date range. */
interface JEHeaderRow { ID: string; BatchID: string | null; EffectiveDate: string | null }
/** A batch summary line item — the per-(company, GL account) movement the ERP will receive. */
interface SummaryLineRow {
  BatchID: string; CompanyID: string; GLAccountID: string;
  DebitAmount: number | null; CreditAmount: number | null;
  Company: string; GLAccount: string;
}
/** RunViews takes ONE generic across all its queries, so the two child reads share a union + guards. */
type BatchChildRow = JEHeaderRow | SummaryLineRow;

/** One account's NET effect within a batch (debits and credits on the same account cancel first). */
export interface AccountEffect {
  CompanyName: string;
  AccountCode: string;
  AccountName: string;
  /** Net debit (0 when the account nets to a credit). */
  Debit: number;
  /** Net credit (0 when the account nets to a debit). */
  Credit: number;
  /** How many source movements collapsed into this net figure. */
  SourceCount: number;
}

/** One batch in the inbox: the summary the card shows + the netted account detail the drop-down shows. */
export interface BatchRow {
  ID: string;
  BatchNumber: string;
  Status: BatchStatus;
  TargetSystem: TargetSystem;
  TotalEntries: number;
  TotalDebits: number;
  TotalCredits: number;
  ExternalBatchRef: string | null;
  ErrorMessage: string | null;
  /** Instant — render in LOCAL time. */
  BatchedAt: Date | null;
  /** Who built the batch (denormalized view field). NOT an approver — see the class docblock. */
  BatchedByUser: string;
  /** Who approved it, once approved. Null while Pending — there is no "required approver" column. */
  ApprovedByUser: string | null;
  ApprovedAt: Date | null;
  /** Companies the batch touches (batches are MULTI-company, CH-4). */
  CompanyNames: string[];
  /** NormalizeUUID'd company ids — Set keys, never compared with ===. */
  CompanyKeys: Set<string>;
  /** DATE columns — inferred min/max EffectiveDate of the batch's JEs. Render as UTC. */
  StartDate: Date | null;
  EndDate: Date | null;
  /** Netted per-account effect + its footing. */
  Accounts: AccountEffect[];
  NetDebits: number;
  NetCredits: number;
  Expanded: boolean;
  /** undefined = not yet checked; null = unknown/error; true/false = gate result. */
  Approved?: boolean | null;
  ApprovalReason?: string;
  Busy?: boolean;
}

type SortField = 'BatchedAt' | 'EndDate' | 'TotalEntries' | 'TotalDebits';

/**
 * Batch Approvals — the CFO's approve / reject / dispatch inbox for journal-entry batches.
 *
 * REBUILT 2026-07-16 against Marcelo's feedback: it now adopts the sub-page chrome contract
 * (`mj-page-header-interior` + `mj-page-body-interior`, which own the gutters), mirrors the
 * "All batches" filter set instead of inventing a bespoke one (status toggles + company +
 * target ERP + From/To + moving-window presets), scrolls its own list under a sticky header,
 * sorts by date, and shows the batch information an approver actually needs: the companies,
 * the target ERP, the covered date range, the entry/Dr/Cr control totals, and — in an
 * expandable drop-down — every account the batch touches with its NET effect.
 *
 * SCHEMA REALITY (do not invent these): the batch has NO "required approver" column. Approval is
 * a bizapps-tasks Task (`ApprovalTaskID` + the gate-backed approval state), so the card shows who
 * BUILT the batch (`BatchedByUser`), the gate's blocking reason, and — once approved —
 * `ApprovedByUser`/`ApprovedAt`. There is also no accounting-period entity (removed, MOD-1), so the
 * "period covered" is INFERRED from the min/max EffectiveDate of the batch's journal entries.
 */
@Component({
  standalone: false,
  selector: 'mj-batch-dispatch-dashboard',
  templateUrl: './batch-dispatch-dashboard.component.html',
  styleUrls: ['./batch-dispatch-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'BatchDispatchDashboard')
export class BatchDispatchDashboardComponent extends BaseDashboard implements OnDestroy {
  public IsLoading = false;
  public LoadError: string | null = null;

  public Batches: BatchRow[] = [];
  public Companies: { ID: string; Name: string }[] = [];

  /** Fallback target ERP for a Regenerate when a batch has no TargetSystem of its own. */
  public TargetSystem: TargetSystem = 'BusinessCentral';

  /** Transient status banner shown after an action (success or error). */
  public ActionMessage: string | null = null;
  public ActionMessageIsError = false;

  // ─── filters (mirrored from All batches — same shape, same labels, same idiom) ───
  /** Every status is offered: the worklist first, then history. */
  public StatusOptions: BatchStatus[] = [...INBOX_STATUSES, ...HISTORY_STATUSES];
  public TargetOptions: TargetSystem[] = [];
  /**
   * The DEFAULT is the worklist — "just the ones that explicitly need an action to move forward"
   * (Marcelo 2026-07-16). Pending needs an approval; Approved needs a dispatch. History
   * (Sent/Posted/Failed/Cancelled) is one toggle away, never loaded by default.
   */
  public SelectedStatuses = new Set<BatchStatus>(INBOX_STATUSES);
  public SelectedCompanyID: string | null = null;
  public SelectedTarget: TargetSystem | null = null;
  public FromDate: string | null = null;
  public ToDate: string | null = null;
  public ActiveWindow: 'today' | '7d' | '30d' | null = null;

  public SortField: SortField = 'BatchedAt';
  public SortDir: 'asc' | 'desc' = 'desc';

  private cdr = inject(ChangeDetectorRef);
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;
  private md = new Metadata();

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Batch Approvals';
  }

  protected initDashboard(): void {
    // Value-lists come from entity metadata (the CHECK-constraint values), never hardcoded.
    this.TargetOptions = this.fieldValues<TargetSystem>(BATCH_ENTITY, 'TargetSystem');
    // The shell header owns the ONE refresh control; this page subscribes rather than adding a button.
    this.refreshSub = this.pageRefresh.OnRefresh(() => this.Refresh());
  }

  ngOnDestroy(): void {
    // Unsubscribing is what keeps the shell header's Refresh page-aware: a destroyed page stops counting.
    this.refreshSub?.unsubscribe();
    super.ngOnDestroy();
  }

  /** The metadata-defined values for a value-list field — the source of truth for its CHECK constraint. */
  private fieldValues<T extends string>(entityName: string, fieldName: string): T[] {
    const f = this.md.EntityByName(entityName)?.Fields?.find(x => x.Name === fieldName);
    return (f?.EntityFieldValues ?? []).map(v => v.Value as T);
  }

  protected async loadData(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    try {
      await this.loadBatches();
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
    // BaseDashboard.ngOnInit() calls NotifyLoadComplete() after loadData() resolves.
  }

  // Must match BaseDashboard's `async Refresh(): Promise<void>` — a `void` override is a type error
  // (TS2416) and, worse, would hand the caller a completed promise while the load was still running,
  // so anything awaiting Refresh() would resume too early.
  public override async Refresh(): Promise<void> {
    await this.loadData();
  }

  // ─── filters + sort (template-facing) ──────────────────────────────────────

  public ToggleStatus(status: BatchStatus): void {
    if (this.SelectedStatuses.has(status)) this.SelectedStatuses.delete(status);
    else this.SelectedStatuses.add(status);
    this.cdr.markForCheck();
  }
  public IsStatusOn(status: BatchStatus): boolean { return this.SelectedStatuses.has(status); }
  public ShowAllStatuses(): void { this.SelectedStatuses.clear(); this.cdr.markForCheck(); }
  public get AllStatusesShown(): boolean { return this.SelectedStatuses.size === 0; }

  public OnCompanyChange(companyID: string): void { this.SelectedCompanyID = companyID || null; this.cdr.markForCheck(); }
  public OnTargetChange(target: string): void { this.SelectedTarget = (target as TargetSystem) || null; this.cdr.markForCheck(); }
  public OnFromDateChange(v: string): void { this.FromDate = v || null; this.ActiveWindow = null; this.cdr.markForCheck(); }
  public OnToDateChange(v: string): void { this.ToDate = v || null; this.ActiveWindow = null; this.cdr.markForCheck(); }

  /** Moving-window presets — identical shape/labels to All batches. */
  public ApplyWindow(win: 'today' | '7d' | '30d'): void {
    const to = new Date();
    const from = new Date();
    if (win === '7d') from.setDate(from.getDate() - 6);
    else if (win === '30d') from.setDate(from.getDate() - 29);
    this.FromDate = this.toDateInput(from);
    this.ToDate = this.toDateInput(to);
    this.ActiveWindow = win;
    this.cdr.markForCheck();
  }
  public ClearWindow(): void { this.FromDate = null; this.ToDate = null; this.ActiveWindow = null; this.cdr.markForCheck(); }
  public IsWindowOn(win: 'today' | '7d' | '30d'): boolean { return this.ActiveWindow === win; }

  /** Local-time yyyy-MM-dd for a native <input type="date"> (matches inSpan's day-granularity parsing). */
  private toDateInput(d: Date): string {
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  public StatusVariant(active: boolean): MjButtonVariant { return active ? 'primary' : 'flat'; }

  public SortBy(field: SortField): void {
    if (this.SortField === field) this.SortDir = this.SortDir === 'asc' ? 'desc' : 'asc';
    else { this.SortField = field; this.SortDir = 'desc'; }
    this.cdr.markForCheck();
  }
  public SortIcon(field: SortField): string {
    if (this.SortField !== field) return 'fa-solid fa-sort';
    return this.SortDir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
  }

  /** The filtered + sorted rows the list renders. */
  public get FilteredBatches(): BatchRow[] {
    const companyKey = this.SelectedCompanyID ? NormalizeUUID(this.SelectedCompanyID) : null;
    const rows = this.Batches.filter(b =>
      (this.SelectedStatuses.size === 0 || this.SelectedStatuses.has(b.Status)) &&
      (!companyKey || b.CompanyKeys.has(companyKey)) &&
      (!this.SelectedTarget || b.TargetSystem === this.SelectedTarget) &&
      this.inSpan(b));
    return this.sortRows(rows);
  }

  public get FilteredCount(): number { return this.FilteredBatches.length; }
  public statusCount(status: BatchStatus): number { return this.FilteredBatches.filter(b => b.Status === status).length; }

  /** Span filter: the batch's inferred [Start,End] must overlap [From,To] (inclusive) — as on All batches. */
  private inSpan(b: BatchRow): boolean {
    if (!this.FromDate && !this.ToDate) return true;
    if (!b.StartDate || !b.EndDate) return false; // a dateless batch can't satisfy a span
    const fromT = this.FromDate ? new Date(this.FromDate).getTime() : -Infinity;
    const toT = this.ToDate ? new Date(`${this.ToDate}T23:59:59`).getTime() : Infinity;
    return b.EndDate.getTime() >= fromT && b.StartDate.getTime() <= toT;
  }

  private sortRows(rows: BatchRow[]): BatchRow[] {
    const dir = this.SortDir === 'asc' ? 1 : -1;
    const field = this.SortField;
    return [...rows].sort((a, b) => this.compare(a, b, field) * dir);
  }
  private compare(a: BatchRow, b: BatchRow, field: SortField): number {
    const av = a[field], bv = b[field];
    if (av instanceof Date || bv instanceof Date) {
      return (av instanceof Date ? av.getTime() : 0) - (bv instanceof Date ? bv.getTime() : 0);
    }
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av ?? '').localeCompare(String(bv ?? ''));
  }

  /** Expand the per-account drop-down. No query — the netted detail is already in memory. */
  public ToggleExpand(row: BatchRow): void {
    row.Expanded = !row.Expanded;
    this.cdr.markForCheck();
  }

  // ─── actions ───────────────────────────────────────────────────────────────

  /** Record an in-app CFO Approve / Reject decision on a batch, then refresh its approval state. */
  public async OnRecordDecision(row: BatchRow, decision: BatchDecision): Promise<void> {
    if (row.Busy) return;
    row.Busy = true;
    this.clearActionMessage();
    this.cdr.markForCheck();
    try {
      const res = await this.client().RecordDecision(row.ID, decision);
      if (res.Success) {
        // A rejection reverses the preliminary lock: the batch is Cancelled and its entries return to the pool.
        const msg = decision === 'Rejected'
          ? `Rejected batch ${row.BatchNumber} — cancelled; its journal entries returned to the candidate pool.`
          : `Recorded "${decision}" on batch ${row.BatchNumber}.`;
        this.setActionMessage(msg, false);
        await this.loadBatches(); // approval flips Pending→Approved; rejection flips Pending→Cancelled (leaves the inbox)
      } else {
        this.setActionMessage(res.ErrorMessage ?? 'Failed to record decision.', true);
      }
    } finally {
      row.Busy = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Regenerate an OPEN (Pending) batch: unlock its current entries and re-gather ALL current candidates
   * (everything unbatched, incl. any added since it was built) into the same batch.
   */
  public async OnRegenerate(row: BatchRow): Promise<void> {
    if (row.Busy) return;
    row.Busy = true;
    this.clearActionMessage();
    this.cdr.markForCheck();
    try {
      const res = await this.client().RegenerateBatch(row.ID, row.TargetSystem || this.TargetSystem);
      if (res.Success && res.NothingToBatch) {
        this.setActionMessage(`Regenerated batch ${row.BatchNumber}: no candidate journal entries remain.`, false);
        await this.loadBatches();
      } else if (res.Success) {
        this.setActionMessage(
          `Regenerated batch ${row.BatchNumber}: ${res.JECount} JE(s) across ${res.CompanyCount} company(ies) → ${res.SummaryLineCount} summary line(s); Dr ${res.TotalDebits} / Cr ${res.TotalCredits}.`,
          false,
        );
        await this.loadBatches();
      } else {
        this.setActionMessage(res.ErrorMessage ?? 'Regenerate failed.', true);
      }
    } finally {
      row.Busy = false;
      this.cdr.markForCheck();
    }
  }

  /** Dispatch a Pending, approved batch to the ERP (gate blocks if not approved; mock poster v1). */
  public async OnDispatch(row: BatchRow): Promise<void> {
    if (row.Busy) return;
    row.Busy = true;
    this.clearActionMessage();
    this.cdr.markForCheck();
    try {
      const res = await this.client().DispatchBatch(row.ID);
      if (res.Success) {
        this.setActionMessage(
          `Dispatched batch ${row.BatchNumber} → ${res.Status}${res.ExternalBatchRef ? ` (ref ${res.ExternalBatchRef})` : ''}.`,
          false,
        );
        await this.loadBatches();
      } else {
        this.setActionMessage(res.ErrorMessage ?? 'Dispatch failed.', true);
      }
    } finally {
      row.Busy = false;
      this.cdr.markForCheck();
    }
  }

  // ─── view helpers (template-facing) ──────────────────────────────────────

  /** An Approved batch (status flip happens with the CFO decision) can dispatch. */
  public canDispatch(row: BatchRow): boolean {
    return row.Status === 'Approved' && row.Approved === true && !row.Busy;
  }

  /** CFO decision controls show only while the batch is still Pending. */
  public canDecide(row: BatchRow): boolean {
    return row.Status === 'Pending' && row.Approved !== true && !row.Busy;
  }

  /** Regenerate is offered on an OPEN (Pending) batch — it re-gathers candidates in place. */
  public canRegenerate(row: BatchRow): boolean {
    return row.Status === 'Pending' && !row.Busy;
  }

  /** Map a batch status to a stat-badge variant for the status pill. */
  public statusVariant(status: BatchRow['Status']): 'success' | 'warning' | 'error' | 'info' | 'default' {
    switch (status) {
      case 'Posted': return 'success';
      case 'Sent': return 'info';
      case 'Approved': return 'info';
      case 'Failed': return 'error';
      case 'Pending': return 'warning';
      case 'Cancelled': return 'default';
      default: return 'default';
    }
  }

  // ─── data loading ──────────────────────────────────────────────────────────

  /**
   * Three queries TOTAL, regardless of batch count: the batches, then (batched via RunViews) their
   * JE headers + their summary line items. Never one query per batch.
   */
  private async loadBatches(): Promise<void> {
    await AccountingEngineBase.Instance.Config(false, this.contextUser(), this.ProviderToUse);
    this.loadCompanies();

    const batches = await this.readInboxBatches();
    if (batches === null) return; // LoadError already set

    const ids = batches.map(b => b.ID);
    const { jes, lines } = await this.readBatchChildren(ids);
    const jesByBatch = this.groupJEs(jes);
    const linesByBatch = this.groupLines(lines);

    this.Batches = batches.map(b => this.toRow(b, jesByBatch.get(NormalizeUUID(b.ID)) ?? [], linesByBatch.get(NormalizeUUID(b.ID)) ?? []));
    this.cdr.markForCheck();

    // The approval gate has no bulk variant — one gate call per shown row, run concurrently.
    await Promise.all(this.Batches.map(r => this.refreshApprovalState(r)));
  }

  /** Companies come from the shared reference engine — no per-page RunView. */
  private loadCompanies(): void {
    this.Companies = AccountingEngineBase.Instance.CompanyProfiles
      .map(c => ({ ID: c.ID, Name: c.Name }))
      .sort((a, b) => a.Name.localeCompare(b.Name));
  }

  /** Query 1 — only the inbox statuses ever leave the DB (Cancelled/Sent/Posted/Failed are never fetched). */
  private async readInboxBatches(): Promise<mjBizAppsAccountingJournalEntryBatchEntity[] | null> {
    const inList = INBOX_STATUSES.map(s => `'${s}'`).join(',');
    const res = await this.runView().RunView<mjBizAppsAccountingJournalEntryBatchEntity>(
      {
        EntityName: BATCH_ENTITY,
        ExtraFilter: `Status IN (${inList})`,
        OrderBy: 'BatchedAt DESC',
        ResultType: 'simple',
        // Batch status transitions happen through server-side resolvers (buildBatch/approveBatch/
        // sendBatch/recordDecision) — NOT a client-side BaseEntity.Save() — so MJ's read cache isn't
        // invalidated on the client's behalf. BypassCache forces true DB state on every reload.
        BypassCache: true,
      },
      this.contextUser(),
    );
    if (!res.Success) {
      this.Batches = [];
      this.LoadError = res.ErrorMessage ?? 'Failed to load batches.';
      return null;
    }
    return res.Results ?? [];
  }

  /** Queries 2+3 — ONE RunViews call for every shown batch's JE headers and summary lines. */
  private async readBatchChildren(batchIds: string[]): Promise<{ jes: JEHeaderRow[]; lines: SummaryLineRow[] }> {
    if (batchIds.length === 0) return { jes: [], lines: [] };
    const inList = batchIds.map(id => `'${id}'`).join(',');
    const [jeRes, liRes] = await this.runView().RunViews<BatchChildRow>(
      [
        {
          EntityName: JE_ENTITY,
          ExtraFilter: `BatchID IN (${inList})`,
          Fields: ['ID', 'BatchID', 'EffectiveDate'],
          ResultType: 'simple',
          BypassCache: true,
        },
        {
          EntityName: JEBLI_ENTITY,
          ExtraFilter: `BatchID IN (${inList})`,
          Fields: ['BatchID', 'CompanyID', 'GLAccountID', 'DebitAmount', 'CreditAmount', 'Company', 'GLAccount'],
          OrderBy: 'LineNumber ASC',
          ResultType: 'simple',
          BypassCache: true,
        },
      ],
      this.contextUser(),
    );
    return {
      jes: (jeRes?.Results ?? []).filter((r): r is JEHeaderRow => 'EffectiveDate' in r),
      lines: (liRes?.Results ?? []).filter((r): r is SummaryLineRow => 'GLAccountID' in r),
    };
  }

  private groupJEs(jes: JEHeaderRow[]): Map<string, JEHeaderRow[]> {
    const byBatch = new Map<string, JEHeaderRow[]>();
    for (const je of jes) {
      if (!je.BatchID) continue;
      const key = NormalizeUUID(je.BatchID);
      const arr = byBatch.get(key) ?? [];
      arr.push(je);
      byBatch.set(key, arr);
    }
    return byBatch;
  }

  private groupLines(lines: SummaryLineRow[]): Map<string, SummaryLineRow[]> {
    const byBatch = new Map<string, SummaryLineRow[]>();
    for (const li of lines) {
      const key = NormalizeUUID(li.BatchID);
      const arr = byBatch.get(key) ?? [];
      arr.push(li);
      byBatch.set(key, arr);
    }
    return byBatch;
  }

  private toRow(b: mjBizAppsAccountingJournalEntryBatchEntity, jes: JEHeaderRow[], lines: SummaryLineRow[]): BatchRow {
    const times = jes
      .map(j => (j.EffectiveDate ? new Date(j.EffectiveDate) : null))
      .filter((d): d is Date => d instanceof Date)
      .map(d => d.getTime());
    const accounts = this.netByAccount(lines);
    return {
      ID: b.ID,
      BatchNumber: b.BatchNumber,
      Status: b.Status,
      TargetSystem: b.TargetSystem,
      TotalEntries: b.TotalEntries,
      TotalDebits: b.TotalDebits,
      TotalCredits: b.TotalCredits,
      ExternalBatchRef: b.ExternalBatchRef,
      ErrorMessage: b.ErrorMessage,
      BatchedAt: b.BatchedAt ? new Date(b.BatchedAt) : null,
      BatchedByUser: b.BatchedByUser,
      ApprovedByUser: b.ApprovedByUser,
      ApprovedAt: b.ApprovedAt ? new Date(b.ApprovedAt) : null,
      CompanyNames: [...new Set(lines.map(l => l.Company).filter(n => !!n))].sort((x, y) => x.localeCompare(y)),
      CompanyKeys: new Set(lines.map(l => NormalizeUUID(l.CompanyID))),
      StartDate: times.length ? new Date(Math.min(...times)) : null,
      EndDate: times.length ? new Date(Math.max(...times)) : null,
      Accounts: accounts,
      NetDebits: this.round2(accounts.reduce((s, a) => s + a.Debit, 0)),
      NetCredits: this.round2(accounts.reduce((s, a) => s + a.Credit, 0)),
      Expanded: false,
    };
  }

  /**
   * NET effect per (company, GL account) — the point of this table. Debits and credits landing on the
   * SAME account cancel first (Dr 500 + Cr 200 on one account → a single Dr 300 row, not two gross
   * rows); an account that fully offsets is dropped entirely because nothing posts for it.
   * Keys are NormalizeUUID'd — SQL Server hands UUIDs back uppercase, so raw string keys mis-group.
   */
  private netByAccount(lines: SummaryLineRow[]): AccountEffect[] {
    const groups = new Map<string, { CompanyName: string; AccountID: string; AccountName: string; debit: number; credit: number; count: number }>();
    for (const l of lines) {
      const key = `${NormalizeUUID(l.CompanyID)}|${NormalizeUUID(l.GLAccountID)}`;
      const g = groups.get(key) ?? {
        CompanyName: l.Company ?? '',
        AccountID: l.GLAccountID,
        AccountName: l.GLAccount ?? '',
        debit: 0, credit: 0, count: 0,
      };
      g.debit += l.DebitAmount ?? 0;
      g.credit += l.CreditAmount ?? 0;
      g.count += 1;
      groups.set(key, g);
    }

    const effects: AccountEffect[] = [];
    for (const g of groups.values()) {
      const net = this.round2(g.debit - g.credit);
      if (net === 0) continue; // fully offsetting — nothing posts for this account
      const gl = AccountingEngineBase.Instance.GLAccountByID(g.AccountID);
      effects.push({
        CompanyName: g.CompanyName,
        AccountCode: gl?.Code ?? '',
        AccountName: g.AccountName || gl?.Name || g.AccountID,
        Debit: net > 0 ? net : 0,
        Credit: net < 0 ? -net : 0,
        SourceCount: g.count,
      });
    }
    effects.sort((a, b) => this.compareEffects(a, b));
    return effects;
  }

  /** Debits first, then credits; within each side, by company then account code. */
  private compareEffects(a: AccountEffect, b: AccountEffect): number {
    const aIsDebit = a.Debit > 0, bIsDebit = b.Debit > 0;
    if (aIsDebit !== bIsDebit) return aIsDebit ? -1 : 1;
    return (a.CompanyName || '').localeCompare(b.CompanyName || '') || (a.AccountCode || '').localeCompare(b.AccountCode || '');
  }

  private round2(n: number): number { return Math.round(n * 100) / 100; }

  private async refreshApprovalState(row: BatchRow): Promise<void> {
    const res = await this.client().GetApprovalState(row.ID);
    // Guard against a stale in-flight response landing on a row from a previous load.
    const current = this.Batches.find(r => UUIDsEqual(r.ID, row.ID));
    if (!current) return;
    current.Approved = res.Success ? res.Approved : null;
    current.ApprovalReason = res.Approved ? undefined : res.Reason;
    this.cdr.markForCheck();
  }

  // ─── plumbing ────────────────────────────────────────────────────────────

  /** A new client bound to the active GraphQL provider (multi-provider aware via ProviderToUse). */
  private client(): BatchDispatchClient {
    return new BatchDispatchClient(this.ProviderToUse as GraphQLDataProvider);
  }

  /** A RunView scoped to the active provider (multi-provider aware). */
  private runView(): RunView {
    return RunView.FromMetadataProvider(this.ProviderToUse);
  }

  /** The active provider's current user (server-side audit/security use the right session). */
  private contextUser() {
    return this.ProviderToUse.CurrentUser;
  }

  private setActionMessage(message: string, isError: boolean): void {
    this.ActionMessage = message;
    this.ActionMessageIsError = isError;
  }

  private clearActionMessage(): void {
    this.ActionMessage = null;
    this.ActionMessageIsError = false;
  }
}

/** Tree-shaking prevention — referencing the class is enough; called from public-api.ts. */
export function LoadBatchDispatchDashboard(): void {
  // No-op. Static import + this call keep the @RegisterClass decorator from being shaken out.
}
