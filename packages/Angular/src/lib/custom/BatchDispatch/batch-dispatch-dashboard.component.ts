import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { RegisterClass } from '@memberjunction/global';
import { ResourceData } from '@memberjunction/core-entities';
import { RunView } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import {
  mjBizAppsAccountingJournalEntryBatchEntity,
} from '@mj-biz-apps/accounting-entities';
import { BatchDispatchClient, BatchDecision } from './batch-dispatch.client';

/** The generated batch Status union (rule 2c: derived, never hand-copied). */
type BatchStatus = mjBizAppsAccountingJournalEntryBatchEntity['Status'];

/**
 * One batch row in the list, with its derived display + (lazily-loaded) CFO approval state.
 * Approval state is NOT a column on the batch — it lives in bizapps-tasks (a Task linked to the
 * batch + a terminal Task Decision), so we resolve it via the gate-backed `JEBatchApprovalState` query.
 */
interface BatchRow {
  ID: string;
  BatchNumber: string;
  Status: BatchStatus;
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

/**
 * Batch Dispatch — the Block 2 JE-batch review/dispatch + CFO-approve dashboard.
 * REWORKED 2026-07-06: batches are MULTI-COMPANY (CH-4) — no company/period selection; ONE build
 * gathers ALL pending JEs; the send splits by company at the ERP boundary.
 *
 * Lists ALL JE Batches (status / control totals + CFO approval state), and drives the engine via the
 * thin BatchDispatchClient (→ BatchDispatchResolver → CoreEntitiesServer buildBatch/approveBatch/sendBatch/gate):
 *   - Build batch  (ALL pending JEs → ONE Pending multi-company batch + approval task)
 *   - In-app CFO Approve / Reject  (recordDecision; an approval also flips the batch Pending→Approved)
 *   - Dispatch to ERP  (enabled only for an Approved batch; mock poster for v1)
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

  public Batches: BatchRow[] = [];

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
      await this.loadBatches();
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
    // BaseDashboard.ngOnInit() calls NotifyLoadComplete() after loadData() resolves.
  }

  // ─── selection handlers ──────────────────────────────────────────────────

  public OnTargetSystemChange(target: string): void {
    this.TargetSystem = target;
    this.cdr.markForCheck();
  }

  // ─── actions ───────────────────────────────────────────────────────────────

  /** Build ONE multi-company batch from ALL pending JEs. */
  public async OnBuildBatch(): Promise<void> {
    if (this.Building) return;
    this.Building = true;
    this.clearActionMessage();
    this.cdr.markForCheck();
    try {
      const res = await this.client().BuildBatch(this.TargetSystem);
      if (res.Success && res.NothingToBatch) {
        this.setActionMessage('No pending journal entries to batch.', false);
      } else if (res.Success) {
        this.setActionMessage(
          `Built batch with ${res.JECount} JE(s) across ${res.CompanyCount} company(ies) → ${res.SummaryLineCount} summary line(s); Dr ${res.TotalDebits} / Cr ${res.TotalCredits}. Awaiting CFO approval.`,
          false,
        );
        await this.loadBatches();
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
        // A rejection reverses the preliminary lock: the batch is Cancelled and its entries return to the pool.
        const msg = decision === 'Rejected'
          ? `Rejected batch ${row.BatchNumber} — cancelled; its journal entries returned to the candidate pool.`
          : `Recorded "${decision}" on batch ${row.BatchNumber}.`;
        this.setActionMessage(msg, false);
        await this.loadBatches(); // an approval flips Pending→Approved; a rejection flips Pending→Cancelled
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
   * (everything unbatched, incl. any added since it was built) into the same batch. Only a Pending batch.
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

  public get CanBuild(): boolean {
    return !this.Building;
  }

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

  private async loadBatches(): Promise<void> {
    const rv = this.runView();
    const res = await rv.RunView<mjBizAppsAccountingJournalEntryBatchEntity>(
      {
        EntityName: BATCH_ENTITY,
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
    // Resolve CFO approval state for Pending batches (their decide/dispatch controls gate on it)
    // AND Approved batches (canDispatch requires the gate state, not just the status flip — a
    // Pending-only filter left row.Approved undefined after approval, hiding the Dispatch button).
    await Promise.all(this.Batches.filter(r => r.Status === 'Pending' || r.Status === 'Approved').map(r => this.refreshApprovalState(r)));
  }

  private toRow(b: mjBizAppsAccountingJournalEntryBatchEntity): BatchRow {
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
