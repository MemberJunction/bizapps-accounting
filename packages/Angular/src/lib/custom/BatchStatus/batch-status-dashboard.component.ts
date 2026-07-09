import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { ResourceData } from '@memberjunction/core-entities';
import { RunView } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { MjButtonVariant } from '@memberjunction/ng-ui-components';
import {
  mjBizAppsAccountingJournalEntryBatchEntity,
} from '@mj-biz-apps/accounting-entities';
import { BatchDispatchClient } from '../BatchDispatch/batch-dispatch.client';

/** Generated value-list unions (rule 2c: derived from the entity, never hand-copied). */
type BatchStatus = mjBizAppsAccountingJournalEntryBatchEntity['Status'];
type TargetSystem = mjBizAppsAccountingJournalEntryBatchEntity['TargetSystem'];

/** The batch statuses the toggle bar exposes, in lifecycle order. */
const STATUS_ORDER: readonly BatchStatus[] = ['Pending', 'Approved', 'Sent', 'Posted', 'Failed', 'Cancelled'];
/** The ERP targets a batch can be built for (matches CK_JournalEntryBatch_TargetSystem). */
const TARGET_SYSTEMS: readonly TargetSystem[] = ['BusinessCentral', 'QuickBooks', 'NetSuite', 'Sage', 'Xero', 'Other'];

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JEBLI_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batch Line Items';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const COMPANY_ENTITY = 'MJ: Companies';

/** One netted Dr/Cr line inside an expanded batch's journal entry. */
export interface JELineDetail { AccountName: string; AccountCode: string; CompanyName: string; Debit: number; Credit: number }
/** One journal entry inside an expanded batch (its lines + header context). */
export interface JEDetail { ID: string; EntryNumber: string; EffectiveDate: Date | null; Description: string | null; Lines: JELineDetail[] }

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
  Details: JEDetail[];
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

  public Batches: BatchRow[] = [];
  public Companies: { ID: string; Name: string }[] = [];

  public readonly StatusOptions = STATUS_ORDER;
  public readonly TargetOptions = TARGET_SYSTEMS;

  /** Filters. Empty status set = show all; null company/target = "All". */
  public SelectedStatuses = new Set<BatchStatus>();
  public SelectedCompanyID: string | null = null;
  public SelectedTarget: TargetSystem | null = null;
  /** Target used by the in-page Build action (defaults to the filtered target, else Business Central). */
  public BuildTarget: TargetSystem = 'BusinessCentral';
  /** Time-span filter (inclusive) over each batch's inferred Start→End date range. `''`/null = unbounded. */
  public FromDate: string | null = null;
  public ToDate: string | null = null;

  public SortField: SortField = 'BatchedAt';
  public SortDir: 'asc' | 'desc' = 'desc';

  private companyNames = new Map<string, string>();
  private glById = new Map<string, { Name: string; Code: string; CompanyID: string }>();
  private jesByBatch = new Map<string, JEDetail[]>();
  private cdr = inject(ChangeDetectorRef);

  async GetResourceDisplayName(_data: ResourceData): Promise<string> { return 'Batch Status'; }

  protected initDashboard(): void { /* no persisted UI state for v1 */ }

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
  public OnFromDateChange(v: string): void { this.FromDate = v || null; this.cdr.markForCheck(); }
  public OnToDateChange(v: string): void { this.ToDate = v || null; this.cdr.markForCheck(); }

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

  // ─── actions ────────────────────────────────────────────────────────────────

  public async OnBuildBatch(): Promise<void> {
    if (this.Building) return;
    this.Building = true;
    this.clearActionMessage();
    this.cdr.markForCheck();
    try {
      const res = await new BatchDispatchClient(this.ProviderToUse as GraphQLDataProvider).BuildBatch(this.BuildTarget);
      if (res.Success && res.NothingToBatch) {
        this.setActionMessage('No pending journal entries to batch.', false);
      } else if (res.Success) {
        this.setActionMessage(`Built a ${this.BuildTarget} batch with ${res.JECount} journal entr${res.JECount === 1 ? 'y' : 'ies'} across ${res.CompanyCount} company(ies). Awaiting CFO approval.`, false);
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
    const [batches, jeHeaders, batchCompanies] = await Promise.all([
      this.loadBatches(),
      this.loadJEHeaders(),
      this.loadBatchCompanies(),
    ]);
    this.jesByBatch = jeHeaders;
    this.Batches = batches.map(b => this.toRow(b, jeHeaders.get(b.ID) ?? [], batchCompanies.get(b.ID) ?? []));
    this.cdr.markForCheck();
  }

  private toRow(
    b: { ID: string; BatchNumber: string; Status: BatchStatus; TargetSystem: TargetSystem; TotalEntries: number; TotalDebits: number; TotalCredits: number; ExternalBatchRef: string | null; BatchedAt: Date | null },
    jes: JEDetail[], companyIDs: string[],
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
      Expanded: false, DetailLoaded: false, DetailLoading: false, Details: [],
    };
  }

  private async loadCompanies(): Promise<void> {
    const rv = this.runView();
    const acp = await rv.RunView<{ ID: string }>({ EntityName: 'MJ_BizApps_Accounting: Accounting Company Profiles', Fields: ['ID'], ResultType: 'simple' }, this.contextUser());
    const co = await rv.RunView<{ ID: string; Name: string }>({ EntityName: COMPANY_ENTITY, Fields: ['ID', 'Name'], OrderBy: 'Name ASC', ResultType: 'simple' }, this.contextUser());
    this.companyNames = new Map((co.Results ?? []).map(c => [c.ID, c.Name]));
    const acpIds = new Set((acp.Results ?? []).map(r => r.ID));
    this.Companies = (co.Results ?? []).filter(c => acpIds.has(c.ID)).map(c => ({ ID: c.ID, Name: c.Name }));
  }

  private async loadBatches(): Promise<Array<{ ID: string; BatchNumber: string; Status: BatchStatus; TargetSystem: TargetSystem; TotalEntries: number; TotalDebits: number; TotalCredits: number; ExternalBatchRef: string | null; BatchedAt: Date | null }>> {
    const res = await this.runView().RunView<mjBizAppsAccountingJournalEntryBatchEntity>(
      { EntityName: BATCH_ENTITY, OrderBy: 'BatchedAt DESC', ResultType: 'simple' }, this.contextUser());
    return (res.Results ?? []).map(b => ({
      ID: b.ID, BatchNumber: b.BatchNumber, Status: b.Status, TargetSystem: b.TargetSystem,
      TotalEntries: b.TotalEntries, TotalDebits: b.TotalDebits, TotalCredits: b.TotalCredits,
      ExternalBatchRef: b.ExternalBatchRef, BatchedAt: b.BatchedAt ? new Date(b.BatchedAt) : null,
    }));
  }

  /** JE headers per batch (for the date range + the expand list). Lines load lazily on expand. */
  private async loadJEHeaders(): Promise<Map<string, JEDetail[]>> {
    const res = await this.runView().RunView<{ ID: string; BatchID: string | null; EntryNumber: string; EffectiveDate: string | null; Description: string | null }>(
      { EntityName: JE_ENTITY, ExtraFilter: 'BatchID IS NOT NULL', Fields: ['ID', 'BatchID', 'EntryNumber', 'EffectiveDate', 'Description'], OrderBy: 'EffectiveDate ASC', ResultType: 'simple' }, this.contextUser());
    const byBatch = new Map<string, JEDetail[]>();
    for (const je of res.Results ?? []) {
      if (!je.BatchID) continue;
      const arr = byBatch.get(je.BatchID) ?? [];
      arr.push({ ID: je.ID, EntryNumber: je.EntryNumber, EffectiveDate: je.EffectiveDate ? new Date(je.EffectiveDate) : null, Description: je.Description, Lines: [] });
      byBatch.set(je.BatchID, arr);
    }
    return byBatch;
  }

  /** batch → distinct company IDs (from its summary line items) — drives the company filter. */
  private async loadBatchCompanies(): Promise<Map<string, string[]>> {
    const res = await this.runView().RunView<{ BatchID: string; CompanyID: string }>(
      { EntityName: JEBLI_ENTITY, Fields: ['BatchID', 'CompanyID'], ResultType: 'simple' }, this.contextUser());
    const byBatch = new Map<string, Set<string>>();
    for (const li of res.Results ?? []) {
      const set = byBatch.get(li.BatchID) ?? new Set<string>();
      set.add(li.CompanyID);
      byBatch.set(li.BatchID, set);
    }
    return new Map([...byBatch].map(([k, v]) => [k, [...v]]));
  }

  /** Lazy per-batch detail: load each JE's Dr/Cr lines + resolve GL-account/company names. */
  private async loadDetail(row: BatchRow): Promise<void> {
    row.DetailLoading = true;
    this.cdr.markForCheck();
    try {
      const jes = this.jesByBatch.get(row.ID) ?? [];
      if (jes.length === 0) { row.Details = []; row.DetailLoaded = true; return; }
      const lines = await this.loadLines(jes.map(j => j.ID));
      await this.ensureGLNames(lines.map(l => l.GLAccountID));
      row.Details = jes.map(je => ({
        ...je,
        Lines: lines.filter(l => l.JournalEntryID === je.ID).map(l => this.toLineDetail(l)),
      }));
      row.DetailLoaded = true;
    } finally {
      row.DetailLoading = false;
      this.cdr.markForCheck();
    }
  }

  private toLineDetail(l: { GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }): JELineDetail {
    const gl = this.glById.get(l.GLAccountID);
    return {
      AccountName: gl?.Name ?? l.GLAccountID,
      AccountCode: gl?.Code ?? '',
      CompanyName: gl ? (this.companyNames.get(gl.CompanyID) ?? '') : '',
      Debit: l.DebitAmount ?? 0,
      Credit: l.CreditAmount ?? 0,
    };
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
