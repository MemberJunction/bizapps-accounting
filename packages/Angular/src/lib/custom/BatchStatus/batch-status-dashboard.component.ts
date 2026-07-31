import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { NormalizeUUID, RegisterClass } from '@memberjunction/global';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { ResourceData } from '@memberjunction/core-entities';
import { Metadata, RunView } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { MjButtonVariant } from '@memberjunction/ng-ui-components';
import {
  mjBizAppsAccountingJournalEntryBatchEntity,
} from '@mj-biz-apps/accounting-entities';
import { BatchDispatchClient } from '../BatchDispatch/batch-dispatch.client';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';

/** Generated value-list unions (rule 2c: derived from the entity, never hand-copied). */
type BatchStatus = mjBizAppsAccountingJournalEntryBatchEntity['Status'];
type TargetSystem = mjBizAppsAccountingJournalEntryBatchEntity['TargetSystem'];

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

/** A journal-entry header inside a batch — drives the inferred date range and points at the lines to fetch. */
interface JEHeader { ID: string; EffectiveDate: Date | null }
/** One consolidated Dr/Cr movement, netted per (company, GL account) across the whole batch. */
export interface ConsolidatedLine { CompanyName: string; AccountName: string; AccountCode: string; Debit: number; Credit: number }
/** A batch's consolidated posting: netted lines (all debits first, then credits) + the column totals. */
export interface BatchDetail { Lines: ConsolidatedLine[]; TotalDebits: number; TotalCredits: number }

/** One candidate journal entry shown in the Build-Batch preview (what a build would include). */
export interface PreviewEntry { ID: string; EntryNumber: string; EffectiveDate: Date | null; EntryType: string; Description: string | null; Amount: number }

/** One batch row in the table, with its inferred date range + lazily-loaded JE detail. */
export interface BatchRow {
  ID: string;
  BatchNumber: string;
  Status: BatchStatus;
  TargetSystem: TargetSystem;
  TotalEntries: number;
  TotalDebits: number;
  TotalCredits: number;
  ExternalBatchRef: string | null;
  BatchedAt: Date | null;
  /** Inferred from the batch's journal entries' EffectiveDates (min/max) — a temporary stand-in for a real cutoff. */
  StartDate: Date | null;
  EndDate: Date | null;
  CompanyIDs: string[];
  /** Expand/detail state. */
  Expanded: boolean;
  DetailLoaded: boolean;
  DetailLoading: boolean;
  Detail: BatchDetail | null;
}

type SortField = 'Status' | 'TargetSystem' | 'TotalEntries' | 'TotalDebits' | 'TotalCredits' | 'StartDate' | 'EndDate' | 'BatchedAt';

/**
 * Batch Status — the filterable roll-up over every JE batch. Enhances the read-only view (Marcelo, 2026-07-08):
 * status toggles + company (incl. All) + target-system filters, an inferred Start→End date range per batch (from
 * its journal entries), summary stats, an in-page Build Batch action, and an expandable per-batch row whose indented
 * table shows that batch's journal entries and their Dr/Cr lines (account, company, amounts). It loads batches +
 * JE headers directly (so "All companies" works and multi-company batches show every company), and lazy-loads the
 * Dr/Cr line detail on expand.
 */
@Component({
  standalone: false,
  selector: 'mj-batch-status-dashboard',
  templateUrl: './batch-status-dashboard.component.html',
  styleUrls: ['./batch-status-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'BatchStatusDashboard')
export class BatchStatusDashboardComponent extends BaseDashboard {
  public IsLoading = false;
  public LoadError: string | null = null;
  public ActionMessage: string | null = null;
  public ActionMessageIsError = false;
  public Building = false;

  // ─── Build-Batch preview dialog ──────────────────────────────────────────────
  public BuildPreviewVisible = false;
  public PreviewLoading = false;
  public PreviewEntries: PreviewEntry[] = [];
  public PreviewStart: Date | null = null;
  public PreviewEnd: Date | null = null;

  public Batches: BatchRow[] = [];
  public Companies: { ID: string; Name: string }[] = [];

  /** Value-lists sourced from entity metadata (the CHECK-constraint values) — never hardcoded. */
  public StatusOptions: BatchStatus[] = [];
  public TargetOptions: TargetSystem[] = [];

  /** Filters. Empty status set = show all; null company/target = "All". */
  public SelectedStatuses = new Set<BatchStatus>();
  public SelectedCompanyID: string | null = null;
  public SelectedTarget: TargetSystem | null = null;
  /** Target used by the in-page Build action (defaults to the filtered target, else Business Central). */
  public BuildTarget: TargetSystem = 'BusinessCentral';
  /** Time-span filter (inclusive) over each batch's inferred Start→End date range. `''`/null = unbounded. */
  public FromDate: string | null = null;
  public ToDate: string | null = null;
  /** Which moving-window preset is active (drives button highlighting); null when the range is custom/unbounded. */
  public ActiveWindow: 'today' | '7d' | '30d' | null = null;

  public SortField: SortField = 'BatchedAt';
  public SortDir: 'asc' | 'desc' = 'desc';

  private companyNames = new Map<string, string>();
  private glById = new Map<string, { Name: string; Code: string; CompanyID: string }>();
  private jesByBatch = new Map<string, JEHeader[]>();
  private cdr = inject(ChangeDetectorRef);
  private md = new Metadata();

  async GetResourceDisplayName(_data: ResourceData): Promise<string> { return 'Batch Status'; }

  protected initDashboard(): void {
    // Value-lists come from entity metadata (CHECK-constraint values), never hardcoded.
    this.StatusOptions = this.fieldValues<BatchStatus>(BATCH_ENTITY, 'Status');
    this.TargetOptions = this.fieldValues<TargetSystem>(BATCH_ENTITY, 'TargetSystem');
  }

  /** The metadata-defined values for a value-list field — the source of truth for the field's CHECK-constraint union. */
  private fieldValues<T extends string>(entityName: string, fieldName: string): T[] {
    const f = this.md.EntityByName(entityName)?.Fields?.find(x => x.Name === fieldName);
    return (f?.EntityFieldValues ?? []).map(v => v.Value as T);
  }

  protected async loadData(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    try {
      await this.loadAll();
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
    // BaseDashboard.ngOnInit() calls NotifyLoadComplete() after loadData() resolves.
  }

  // ─── filters + sort (template-facing) ────────────────────────────────────────

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
  public OnBuildTargetChange(target: string): void { this.BuildTarget = target as TargetSystem; this.cdr.markForCheck(); }
  public OnFromDateChange(v: string): void { this.FromDate = v || null; this.ActiveWindow = null; this.cdr.markForCheck(); }
  public OnToDateChange(v: string): void { this.ToDate = v || null; this.ActiveWindow = null; this.cdr.markForCheck(); }

  /** Moving-window presets (Robert 2026-07-09: "last day/week/month" windows). Sets the From/To range. */
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

  /** Stat-badge variant for a batch status (small header indicators). */
  public BadgeVariant(status: BatchStatus): 'success' | 'warning' | 'error' | 'info' | 'default' {
    switch (status) {
      case 'Posted': return 'success';
      case 'Failed': return 'error';
      case 'Pending': return 'warning';
      case 'Sent': case 'Approved': return 'info';
      default: return 'default';
    }
  }

  public SortBy(field: SortField): void {
    if (this.SortField === field) this.SortDir = this.SortDir === 'asc' ? 'desc' : 'asc';
    else { this.SortField = field; this.SortDir = field === 'BatchedAt' || field === 'EndDate' || field === 'StartDate' ? 'desc' : 'asc'; }
    this.cdr.markForCheck();
  }
  public SortIcon(field: SortField): string {
    if (this.SortField !== field) return 'fa-solid fa-sort';
    return this.SortDir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
  }

  /** The filtered + sorted rows the table renders. */
  public get FilteredBatches(): BatchRow[] {
    const rows = this.Batches.filter(b =>
      (this.SelectedStatuses.size === 0 || this.SelectedStatuses.has(b.Status)) &&
      (!this.SelectedCompanyID || b.CompanyIDs.includes(this.SelectedCompanyID)) &&
      (!this.SelectedTarget || b.TargetSystem === this.SelectedTarget) &&
      this.inSpan(b));
    return this.sortRows(rows);
  }

  /** Time-span filter: the batch's inferred [Start,End] range must overlap the [From,To] input (inclusive). */
  private inSpan(b: BatchRow): boolean {
    if (!this.FromDate && !this.ToDate) return true;
    if (!b.StartDate || !b.EndDate) return false; // a dateless batch can't satisfy a span
    const fromT = this.FromDate ? new Date(this.FromDate).getTime() : -Infinity;
    const toT = this.ToDate ? new Date(`${this.ToDate}T23:59:59`).getTime() : Infinity;
    return b.EndDate.getTime() >= fromT && b.StartDate.getTime() <= toT;
  }

  public get FilteredCount(): number { return this.FilteredBatches.length; }
  public statusCount(status: BatchStatus): number { return this.FilteredBatches.filter(b => b.Status === status).length; }

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

  // ─── expand / detail ────────────────────────────────────────────────────────

  public async ToggleExpand(row: BatchRow): Promise<void> {
    row.Expanded = !row.Expanded;
    if (row.Expanded && !row.DetailLoaded && !row.DetailLoading) {
      await this.loadDetail(row);
    }
    this.cdr.markForCheck();
  }

  // ─── build-batch preview → build ─────────────────────────────────────────────

  /** Open the preview: gather the journal entries a build would include + the span they cover. */
  public async OpenBuildPreview(): Promise<void> {
    this.BuildPreviewVisible = true;
    this.PreviewLoading = true;
    this.clearActionMessage();
    this.cdr.markForCheck();
    try {
      await this.loadBuildCandidates();
    } catch (e) {
      this.setActionMessage(e instanceof Error ? e.message : String(e), true);
    } finally {
      this.PreviewLoading = false;
      this.cdr.markForCheck();
    }
  }

  public CloseBuildPreview(): void { this.BuildPreviewVisible = false; this.cdr.markForCheck(); }

  public get PreviewCount(): number { return this.PreviewEntries.length; }
  public get PreviewTotal(): number { return Math.round(this.PreviewEntries.reduce((s, e) => s + e.Amount, 0) * 100) / 100; }

  /** Candidate = every unbatched (Pending) journal entry — exactly what buildBatch nets. */
  private async loadBuildCandidates(): Promise<void> {
    const res = await this.runView().RunView<{ ID: string; EntryNumber: string; EffectiveDate: string | null; EntryType: string; Description: string | null }>(
      { EntityName: JE_ENTITY, ExtraFilter: `Status='Pending'`, Fields: ['ID', 'EntryNumber', 'EffectiveDate', 'EntryType', 'Description'], OrderBy: 'EffectiveDate ASC', ResultType: 'simple' }, this.contextUser());
    const jes = res.Results ?? [];
    const lines = jes.length ? await this.loadLines(jes.map(j => j.ID)) : [];
    const totalByJe = new Map<string, number>();
    for (const l of lines) totalByJe.set(l.JournalEntryID, (totalByJe.get(l.JournalEntryID) ?? 0) + (l.DebitAmount ?? 0));
    this.PreviewEntries = jes.map(j => ({
      ID: j.ID, EntryNumber: j.EntryNumber,
      EffectiveDate: j.EffectiveDate ? new Date(j.EffectiveDate) : null,
      EntryType: j.EntryType, Description: j.Description,
      Amount: Math.round((totalByJe.get(j.ID) ?? 0) * 100) / 100,
    }));
    const times = this.PreviewEntries.map(e => e.EffectiveDate).filter((d): d is Date => d instanceof Date).map(d => d.getTime());
    this.PreviewStart = times.length ? new Date(Math.min(...times)) : null;
    this.PreviewEnd = times.length ? new Date(Math.max(...times)) : null;
  }

  public async OnBuildBatch(): Promise<void> {
    if (this.Building) return;
    this.Building = true;
    this.clearActionMessage();
    this.cdr.markForCheck();
    try {
      const res = await new BatchDispatchClient(this.ProviderToUse as GraphQLDataProvider).BuildBatch(this.BuildTarget);
      if (res.Success && res.NothingToBatch) {
        this.setActionMessage('No pending journal entries to batch.', false);
        this.BuildPreviewVisible = false;
      } else if (res.Success) {
        this.setActionMessage(`Built a ${this.BuildTarget} batch with ${res.JECount} journal entr${res.JECount === 1 ? 'y' : 'ies'} across ${res.CompanyCount} company(ies). Awaiting CFO approval.`, false);
        this.BuildPreviewVisible = false;
        await this.loadAll();
      } else {
        this.setActionMessage(res.ErrorMessage ?? 'Build failed.', true);
      }
    } finally {
      this.Building = false;
      this.cdr.markForCheck();
    }
  }

  public async Reload(): Promise<void> {
    this.IsLoading = true; this.LoadError = null; this.cdr.markForCheck();
    try { await this.loadAll(); }
    catch (e) { this.LoadError = e instanceof Error ? e.message : String(e); }
    finally { this.IsLoading = false; this.cdr.markForCheck(); }
  }

  // ─── data loading ────────────────────────────────────────────────────────────

  private async loadAll(): Promise<void> {
    await this.loadCompanies();
    const [batches, jeHeaders] = await Promise.all([
      this.loadBatches(),
      this.loadJEHeaders(),
    ]);
    this.jesByBatch = jeHeaders;
    // Batches are single-company (D7): the company comes straight off the batch header.
    this.Batches = batches.map(b => this.toRow(b, jeHeaders.get(b.ID) ?? [], b.CompanyID ? [b.CompanyID] : []));
    this.cdr.markForCheck();
  }

  private toRow(
    b: { ID: string; BatchNumber: string; Status: BatchStatus; TargetSystem: TargetSystem; TotalEntries: number; TotalDebits: number; TotalCredits: number; ExternalBatchRef: string | null; BatchedAt: Date | null },
    jes: JEHeader[], companyIDs: string[],
  ): BatchRow {
    const dates = jes.map(j => j.EffectiveDate).filter((d): d is Date => d instanceof Date);
    const times = dates.map(d => d.getTime());
    return {
      ID: b.ID, BatchNumber: b.BatchNumber, Status: b.Status, TargetSystem: b.TargetSystem,
      TotalEntries: b.TotalEntries, TotalDebits: b.TotalDebits, TotalCredits: b.TotalCredits,
      ExternalBatchRef: b.ExternalBatchRef, BatchedAt: b.BatchedAt,
      StartDate: times.length ? new Date(Math.min(...times)) : null,
      EndDate: times.length ? new Date(Math.max(...times)) : null,
      CompanyIDs: companyIDs,
      Expanded: false, DetailLoaded: false, DetailLoading: false, Detail: null,
    };
  }

  /** Companies come from the shared reference engine (AccountingEngineBase.CompanyProfiles) — no per-page RunView. */
  private async loadCompanies(): Promise<void> {
    await AccountingEngineBase.Instance.ConfigEx({ contextUser: this.contextUser(), provider: this.ProviderToUse });
    const profiles = AccountingEngineBase.Instance.CompanyProfiles;
    this.companyNames = new Map(profiles.map(c => [c.ID, c.Name]));
    this.Companies = profiles
      .map(c => ({ ID: c.ID, Name: c.Name }))
      .sort((a, b) => a.Name.localeCompare(b.Name));
  }

  private async loadBatches(): Promise<Array<{ ID: string; BatchNumber: string; Status: BatchStatus; TargetSystem: TargetSystem; CompanyID: string | null; TotalEntries: number; TotalDebits: number; TotalCredits: number; ExternalBatchRef: string | null; BatchedAt: Date | null }>> {
    const res = await this.runView().RunView<mjBizAppsAccountingJournalEntryBatchEntity>(
      { EntityName: BATCH_ENTITY, OrderBy: 'BatchedAt DESC', ResultType: 'simple' }, this.contextUser());
    return (res.Results ?? []).map(b => ({
      ID: b.ID, BatchNumber: b.BatchNumber, Status: b.Status, TargetSystem: b.TargetSystem,
      CompanyID: b.CompanyID ?? null,
      TotalEntries: b.TotalEntries, TotalDebits: b.TotalDebits, TotalCredits: b.TotalCredits,
      ExternalBatchRef: b.ExternalBatchRef, BatchedAt: b.BatchedAt ? new Date(b.BatchedAt) : null,
    }));
  }

  /** JE headers per batch (for the inferred date range + to fetch each batch's lines on expand). */
  private async loadJEHeaders(): Promise<Map<string, JEHeader[]>> {
    // The batch's own SUMMARY JE also carries BatchID — it is the consolidation OF the sources,
    // so counting it alongside them doubles every amount (Marcelo 2026-07-30: a 350/350 batch
    // drilled down as 700/700). Exclude summaries here so the map holds SOURCE JEs only; the
    // detail then re-derives the same netted posting the summary persists.
    const [res, batches] = await Promise.all([
      this.runView().RunView<{ ID: string; BatchID: string | null; EffectiveDate: string | null }>(
        { EntityName: JE_ENTITY, ExtraFilter: 'BatchID IS NOT NULL', Fields: ['ID', 'BatchID', 'EffectiveDate'], OrderBy: 'EffectiveDate ASC', ResultType: 'simple' }, this.contextUser()),
      this.runView().RunView<{ ID: string; SummaryJournalEntryID: string | null }>(
        { EntityName: BATCH_ENTITY, Fields: ['ID', 'SummaryJournalEntryID'], ResultType: 'simple' }, this.contextUser()),
    ]);
    const summaryIds = new Set(
      (batches.Results ?? []).map((b) => b.SummaryJournalEntryID).filter((id): id is string => !!id).map((id) => NormalizeUUID(id)),
    );
    const byBatch = new Map<string, JEHeader[]>();
    for (const je of res.Results ?? []) {
      if (!je.BatchID) continue;
      if (summaryIds.has(NormalizeUUID(je.ID))) continue; // the consolidation itself, not a source
      const arr = byBatch.get(je.BatchID) ?? [];
      arr.push({ ID: je.ID, EffectiveDate: je.EffectiveDate ? new Date(je.EffectiveDate) : null });
      byBatch.set(je.BatchID, arr);
    }
    return byBatch;
  }

  /** Lazy per-batch detail: load the batch's JE lines and consolidate them into the netted posting. */
  private async loadDetail(row: BatchRow): Promise<void> {
    row.DetailLoading = true;
    this.cdr.markForCheck();
    try {
      const jes = this.jesByBatch.get(row.ID) ?? [];
      if (jes.length === 0) { row.Detail = { Lines: [], TotalDebits: 0, TotalCredits: 0 }; row.DetailLoaded = true; return; }
      const lines = await this.loadLines(jes.map(j => j.ID));
      await this.ensureGLNames(lines.map(l => l.GLAccountID));
      row.Detail = this.consolidate(lines);
      row.DetailLoaded = true;
    } finally {
      row.DetailLoading = false;
      this.cdr.markForCheck();
    }
  }

  /** One accumulator per (company, GL account) while consolidating a batch's lines. */
  private groupLines(lines: Array<{ GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>):
    Map<string, { CompanyName: string; AccountName: string; AccountCode: string; debit: number; credit: number }> {
    const groups = new Map<string, { CompanyName: string; AccountName: string; AccountCode: string; debit: number; credit: number }>();
    for (const l of lines) {
      const gl = this.glById.get(l.GLAccountID);
      const key = `${gl?.CompanyID ?? ''}|${l.GLAccountID}`;
      const g = groups.get(key) ?? {
        CompanyName: gl ? (this.companyNames.get(gl.CompanyID) ?? '') : '',
        AccountName: gl?.Name ?? l.GLAccountID,
        AccountCode: gl?.Code ?? '',
        debit: 0, credit: 0,
      };
      g.debit += l.DebitAmount ?? 0;
      g.credit += l.CreditAmount ?? 0;
      groups.set(key, g);
    }
    return groups;
  }

  /** Net each (company, account) group to a single side, drop fully-offsetting lines, order debits before credits. */
  private consolidate(lines: Array<{ GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>): BatchDetail {
    const consolidated: ConsolidatedLine[] = [];
    for (const g of this.groupLines(lines).values()) {
      const net = Math.round((g.debit - g.credit) * 100) / 100;
      if (net === 0) continue; // fully offsetting — nothing to post for this account
      consolidated.push({
        CompanyName: g.CompanyName, AccountName: g.AccountName, AccountCode: g.AccountCode,
        Debit: net > 0 ? net : 0, Credit: net < 0 ? -net : 0,
      });
    }
    consolidated.sort((a, b) => this.compareConsolidated(a, b));
    const TotalDebits = Math.round(consolidated.reduce((s, l) => s + l.Debit, 0) * 100) / 100;
    const TotalCredits = Math.round(consolidated.reduce((s, l) => s + l.Credit, 0) * 100) / 100;
    return { Lines: consolidated, TotalDebits, TotalCredits };
  }

  /** Debits first, then credits; within each side, by company then account code. */
  private compareConsolidated(a: ConsolidatedLine, b: ConsolidatedLine): number {
    const aIsDebit = a.Debit > 0, bIsDebit = b.Debit > 0;
    if (aIsDebit !== bIsDebit) return aIsDebit ? -1 : 1;
    return (a.CompanyName || '').localeCompare(b.CompanyName || '') || (a.AccountCode || '').localeCompare(b.AccountCode || '');
  }

  private async loadLines(jeIds: string[]): Promise<Array<{ JournalEntryID: string; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>> {
    const inList = jeIds.map(id => `'${id}'`).join(',');
    const res = await this.runView().RunView<{ JournalEntryID: string; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>(
      { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID IN (${inList})`, Fields: ['JournalEntryID', 'GLAccountID', 'DebitAmount', 'CreditAmount'], OrderBy: 'LineNumber ASC', ResultType: 'simple' }, this.contextUser());
    return res.Results ?? [];
  }

  /** Populate the GL-account name/code/company cache for any ids not already known. */
  private async ensureGLNames(glIds: string[]): Promise<void> {
    const missing = [...new Set(glIds)].filter(id => !this.glById.has(id));
    if (missing.length === 0) return;
    const inList = missing.map(id => `'${id}'`).join(',');
    const res = await this.runView().RunView<{ ID: string; Name: string; Code: string; CompanyID: string }>(
      { EntityName: GL_ENTITY, ExtraFilter: `ID IN (${inList})`, Fields: ['ID', 'Name', 'Code', 'CompanyID'], ResultType: 'simple' }, this.contextUser());
    for (const gl of res.Results ?? []) this.glById.set(gl.ID, { Name: gl.Name, Code: gl.Code, CompanyID: gl.CompanyID });
  }

  // ─── plumbing ────────────────────────────────────────────────────────────────

  private runView(): RunView { return RunView.FromMetadataProvider(this.ProviderToUse); }
  private contextUser() { return this.ProviderToUse.CurrentUser; }
  private setActionMessage(message: string, isError: boolean): void { this.ActionMessage = message; this.ActionMessageIsError = isError; }
  private clearActionMessage(): void { this.ActionMessage = null; this.ActionMessageIsError = false; }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadBatchStatusDashboard(): void {
  // No-op.
}
