import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { RegisterClass } from '@memberjunction/global';
import { ResourceData } from '@memberjunction/core-entities';
import { RunView } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import {
  mjBizAppsAccountingJournalEntryBatchEntity,
  mjBizAppsAccountingAccountingPeriodEntity,
} from '@mj-biz-apps/accounting-entities';
import { BatchDispatchClient, BatchDecision } from './batch-dispatch.client';

/** One selectable company (accounting-enabled). */
interface CompanyOption {
  ID: string;
  Name: string;
}

/** One accounting period available for batching. */
interface PeriodOption {
  ID: string;
  Label: string;
}

/**
 * One batch row in the list, with its derived display + (lazily-loaded) CFO approval state.
 * Approval state is NOT a column on the batch — it lives in bizapps-tasks (a Task linked to the
 * batch + a terminal Task Decision), so we resolve it via the gate-backed `JEBatchApprovalState` query.
 */
interface BatchRow {
  ID: string;
  BatchNumber: string;
  CompanyName: string;
  Status: 'Acknowledged' | 'Failed' | 'Pending' | 'Sent';
  TargetSystem: string;
  TotalEntries: number;
  TotalDebits: number;
  TotalCredits: number;
  ExternalBatchRef: string | null;
  ErrorMessage: string | null;
  /** undefined = not yet checked; null = unknown/error; true/false = gate result. */
  Approved?: boolean | null;
  ApprovalReason?: string;
  /** Per-row in-flight flag so spinners/disables are scoped to the acting row. */
  Busy?: boolean;
}

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const COMPANY_ENTITY = 'MJ: Companies';

/**
 * Batch Dispatch — the Block 2 JE-batch review/dispatch + CFO-approve dashboard.
 *
 * Lists JE Batches for a selected accounting-enabled company (status / control totals /
 * summary-line count + CFO approval state), and drives the engine via the thin
 * BatchDispatchClient (→ BatchDispatchResolver → CoreEntitiesServer buildBatch/sendBatch/gate):
 *   - Build batch  (pending JEs → a Pending batch + approval task)
 *   - In-app CFO Approve / Reject  (recordDecision against the batch's approval Task)
 *   - Dispatch to ERP  (enabled only when the gate reports the batch Approved; mock poster for v1)
 */
@Component({
  standalone: false,
  selector: 'mj-batch-dispatch-dashboard',
  templateUrl: './batch-dispatch-dashboard.component.html',
  styleUrls: ['./batch-dispatch-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'BatchDispatchDashboard')
export class BatchDispatchDashboardComponent extends BaseDashboard {
  public IsLoading = false;
  public LoadError: string | null = null;

  public Companies: CompanyOption[] = [];
  public Periods: PeriodOption[] = [];
  public Batches: BatchRow[] = [];

  public SelectedCompanyID: string | null = null;
  public SelectedPeriodID: string | null = null;
  /** Target ERP for newly-built batches. BC is the headline target; mock poster dispatches it. */
  public TargetSystem = 'BusinessCentral';

  /** In-flight flag for the Build action (separate from per-row Busy). */
  public Building = false;
  /** Transient status banner shown after an action (success or error). */
  public ActionMessage: string | null = null;
  public ActionMessageIsError = false;

  private cdr = inject(ChangeDetectorRef);

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Batch Dispatch';
  }

  protected initDashboard(): void {
    // One-time setup; data loads in loadData(). No persisted UI state for v1.
  }

  protected async loadData(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    try {
      await this.loadCompanies();
      if (!this.SelectedCompanyID && this.Companies.length > 0) {
        this.SelectedCompanyID = this.Companies[0].ID;
      }
      if (this.SelectedCompanyID) {
        await Promise.all([this.loadPeriods(this.SelectedCompanyID), this.loadBatches(this.SelectedCompanyID)]);
      }
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
    // BaseDashboard.ngOnInit() calls NotifyLoadComplete() after loadData() resolves.
  }

  // ─── selection handlers ──────────────────────────────────────────────────

  public async OnCompanyChange(companyID: string): Promise<void> {
    this.SelectedCompanyID = companyID;
    this.SelectedPeriodID = null;
    this.ActionMessage = null;
    this.IsLoading = true;
    this.cdr.markForCheck();
    try {
      await Promise.all([this.loadPeriods(companyID), this.loadBatches(companyID)]);
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  public OnPeriodChange(periodID: string): void {
    this.SelectedPeriodID = periodID;
    this.cdr.markForCheck();
  }

  public OnTargetSystemChange(target: string): void {
    this.TargetSystem = target;
    this.cdr.markForCheck();
  }

  // ─── actions ───────────────────────────────────────────────────────────────

  /** Build a batch from the selected company×period's pending JEs. */
  public async OnBuildBatch(): Promise<void> {
    if (!this.SelectedCompanyID || !this.SelectedPeriodID || this.Building) return;
    this.Building = true;
    this.clearActionMessage();
    this.cdr.markForCheck();
    try {
      const res = await this.client().BuildBatch(this.SelectedCompanyID, this.SelectedPeriodID, this.TargetSystem);
      if (res.Success && res.NothingToBatch) {
        this.setActionMessage('No pending journal entries to batch for this company and period.', false);
      } else if (res.Success) {
        this.setActionMessage(
          `Built batch with ${res.JECount} JE(s) → ${res.SummaryLineCount} summary line(s); Dr ${res.TotalDebits} / Cr ${res.TotalCredits}. Awaiting CFO approval.`,
          false,
        );
        await this.loadBatches(this.SelectedCompanyID);
      } else {
        this.setActionMessage(res.ErrorMessage ?? 'Build failed.', true);
      }
    } finally {
      this.Building = false;
      this.cdr.markForCheck();
    }
  }

  /** Record an in-app CFO Approve / Reject decision on a batch, then refresh its approval state. */
  public async OnRecordDecision(row: BatchRow, decision: BatchDecision): Promise<void> {
    if (row.Busy) return;
    row.Busy = true;
    this.clearActionMessage();
    this.cdr.markForCheck();
    try {
      const res = await this.client().RecordDecision(row.ID, decision);
      if (res.Success) {
        this.setActionMessage(`Recorded "${decision}" on batch ${row.BatchNumber}.`, false);
        await this.refreshApprovalState(row);
      } else {
        this.setActionMessage(res.ErrorMessage ?? 'Failed to record decision.', true);
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
        if (this.SelectedCompanyID) await this.loadBatches(this.SelectedCompanyID);
      } else {
        this.setActionMessage(res.ErrorMessage ?? 'Dispatch failed.', true);
      }
    } finally {
      row.Busy = false;
      this.cdr.markForCheck();
    }
  }

  // ─── view helpers (template-facing) ──────────────────────────────────────

  /** Build enabled only when a company AND a period are selected. */
  public get CanBuild(): boolean {
    return !!this.SelectedCompanyID && !!this.SelectedPeriodID && !this.Building;
  }

  /** A Pending batch with a positive gate result can dispatch. */
  public canDispatch(row: BatchRow): boolean {
    return row.Status === 'Pending' && row.Approved === true && !row.Busy;
  }

  /** CFO decision controls show only while the batch is still Pending and not yet approved. */
  public canDecide(row: BatchRow): boolean {
    return row.Status === 'Pending' && row.Approved !== true && !row.Busy;
  }

  /** Map a batch status to a stat-badge variant for the status pill. */
  public statusVariant(status: BatchRow['Status']): 'success' | 'warning' | 'error' | 'info' | 'default' {
    switch (status) {
      case 'Acknowledged': return 'success';
      case 'Sent': return 'info';
      case 'Failed': return 'error';
      case 'Pending': return 'warning';
      default: return 'default';
    }
  }

  // ─── data loading ──────────────────────────────────────────────────────────

  private async loadCompanies(): Promise<void> {
    // Accounting-enabled companies = those with an AccountingCompanyProfile (IsA child; same PK as Company).
    const rv = this.runView();
    const acpRes = await rv.RunView<{ ID: string }>(
      { EntityName: ACP_ENTITY, Fields: ['ID'], OrderBy: 'ID ASC', ResultType: 'simple' },
      this.contextUser(),
    );
    const ids = acpRes.Success ? (acpRes.Results ?? []).map(r => r.ID) : [];
    if (ids.length === 0) { this.Companies = []; return; }

    const inList = ids.map(id => `'${id}'`).join(',');
    const coRes = await rv.RunView<{ ID: string; Name: string }>(
      { EntityName: COMPANY_ENTITY, ExtraFilter: `ID IN (${inList})`, Fields: ['ID', 'Name'], OrderBy: 'Name ASC', ResultType: 'simple' },
      this.contextUser(),
    );
    this.Companies = coRes.Success ? (coRes.Results ?? []).map(c => ({ ID: c.ID, Name: c.Name })) : [];
  }

  private async loadPeriods(companyID: string): Promise<void> {
    const rv = this.runView();
    const res = await rv.RunView<mjBizAppsAccountingAccountingPeriodEntity>(
      {
        EntityName: PERIOD_ENTITY,
        ExtraFilter: `CompanyID='${companyID}' AND Status='Open'`,
        OrderBy: 'FiscalYear ASC, PeriodType ASC',
        ResultType: 'simple',
      },
      this.contextUser(),
    );
    this.Periods = res.Success
      ? (res.Results ?? []).map(p => ({ ID: p.ID, Label: `${p.PeriodType} · FY${p.FiscalYear}` }))
      : [];
  }

  private async loadBatches(companyID: string): Promise<void> {
    const rv = this.runView();
    const res = await rv.RunView<mjBizAppsAccountingJournalEntryBatchEntity>(
      {
        EntityName: BATCH_ENTITY,
        ExtraFilter: `CompanyID='${companyID}'`,
        OrderBy: 'BatchedAt DESC',
        ResultType: 'simple',
      },
      this.contextUser(),
    );
    if (!res.Success) {
      this.Batches = [];
      this.LoadError = res.ErrorMessage ?? 'Failed to load batches.';
      return;
    }
    this.Batches = (res.Results ?? []).map(b => this.toRow(b));
    // Resolve CFO approval state for the Pending batches (the only ones whose dispatch it gates).
    await Promise.all(this.Batches.filter(r => r.Status === 'Pending').map(r => this.refreshApprovalState(r)));
  }

  private toRow(b: mjBizAppsAccountingJournalEntryBatchEntity): BatchRow {
    return {
      ID: b.ID,
      BatchNumber: b.BatchNumber,
      CompanyName: b.Company,
      Status: b.Status,
      TargetSystem: b.TargetSystem,
      TotalEntries: b.TotalEntries,
      TotalDebits: b.TotalDebits,
      TotalCredits: b.TotalCredits,
      ExternalBatchRef: b.ExternalBatchRef,
      ErrorMessage: b.ErrorMessage,
    };
  }

  private async refreshApprovalState(row: BatchRow): Promise<void> {
    const res = await this.client().GetApprovalState(row.ID);
    row.Approved = res.Success ? res.Approved : null;
    row.ApprovalReason = res.Approved ? undefined : res.Reason;
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
