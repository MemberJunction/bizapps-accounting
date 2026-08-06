import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { PageRefreshService } from '../../transfer-pending/shell-refresh/page-refresh.service';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { RegisterClass } from '@memberjunction/global';
import { ResourceData } from '@memberjunction/core-entities';
import { RunView } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import {
  mjBizAppsAccountingJournalEntryBatchEntity,
} from '@mj-biz-apps/accounting-entities';
import { JournalEntryBatchDispatchClient, JournalEntryBatchDecision } from './journal-entry-batch-dispatch.client';

/** The generated batch Status union (rule 2c: derived, never hand-copied). */
type BatchStatus = mjBizAppsAccountingJournalEntryBatchEntity['Status'];

/**
 * One batch row in the list, with its derived display + (lazily-loaded) CFO approval state.
 * Approval state is NOT a column on the batch — it lives in bizapps-tasks (a Task linked to the
 * batch + a terminal Task Decision), so we resolve it via the gate-backed `JournalEntryBatchApprovalState` query.
 */
interface BatchRow {
  ID: string;
  JournalEntryBatchNumber: string;
  Status: BatchStatus;
  TargetSystem: string;
  TotalEntries: number;
  TotalDebits: number;
  TotalCredits: number;
  ExternalJournalEntryBatchRef: string | null;
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
 * thin JournalEntryBatchDispatchClient (→ BatchDispatchResolver → CoreEntitiesServer buildJournalEntryBatch/approveJournalEntryBatch/sendJournalEntryBatch/gate):
 *   - Build batch  (ALL pending JEs → ONE Pending multi-company batch + approval task)
 *   - In-app CFO Approve / Reject  (recordDecision; an approval also flips the batch Pending→Approved)
 *   - Dispatch to ERP  (enabled only for an Approved batch; mock poster for v1)
 */
@Component({
  standalone: false,
  selector: 'mj-batch-dispatch-dashboard',
  templateUrl: './journal-entry-batch-dispatch-dashboard.component.html',
  styleUrls: ['./journal-entry-batch-dispatch-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'BatchDispatchDashboard')
export class JournalEntryBatchDispatchDashboardComponent extends BaseDashboard {
  public IsLoading = false;
  public LoadError: string | null = null;

  public Batches: BatchRow[] = [];

  /** Fallback target ERP for a Regenerate when a batch has no TargetSystem of its own. */
  public TargetSystem = 'BusinessCentral';

  /** Transient status banner shown after an action (success or error). */
  public ActionMessage: string | null = null;
  public ActionMessageIsError = false;

  private cdr = inject(ChangeDetectorRef);

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Batch Approvals';
  }

  /** The category header's Refresh reaches this dashboard through the shared channel —
   *  the inline mj-refresh-button was removed (Marcelo 2026-08-05: the header owns the ONE
   *  refresh control, orders-style). Subscribing is also what makes the header button SHOW
   *  while this page is mounted (CanRefreshActivePage = HasSubscriber). */
  /** OPTIONAL: provided per category shell; a directly-mounted resource (or a bare TestBed) has none. */
  private pageRefresh = inject(PageRefreshService, { optional: true });
  private refreshSub: { unsubscribe: () => void } | null = null;

  protected initDashboard(): void {
    this.refreshSub = this.pageRefresh?.OnRefresh(() => void this.loadData()) ?? null;
    // One-time setup; data loads in loadData(). No persisted UI state for v1.
  }

  public override ngOnDestroy(): void {
    // Unsubscribing keeps the header's Refresh page-aware: a destroyed page stops counting.
    this.refreshSub?.unsubscribe();
    super.ngOnDestroy();
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

  // ─── actions ───────────────────────────────────────────────────────────────

  /** Record an in-app CFO Approve / Reject decision on a batch, then refresh its approval state. */
  public async OnRecordDecision(row: BatchRow, decision: JournalEntryBatchDecision): Promise<void> {
    if (row.Busy) return;
    row.Busy = true;
    this.clearActionMessage();
    this.cdr.markForCheck();
    try {
      const res = await this.client().RecordDecision(row.ID, decision);
      if (res.Success) {
        // A rejection reverses the preliminary lock: the batch is Cancelled and its entries return to the pool.
        const msg = decision === 'Rejected'
          ? `Rejected batch ${row.JournalEntryBatchNumber} — cancelled; its journal entries returned to the candidate pool.`
          : `Recorded "${decision}" on batch ${row.JournalEntryBatchNumber}.`;
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
      const res = await this.client().RegenerateJournalEntryBatch(row.ID, row.TargetSystem || this.TargetSystem);
      if (res.Success && res.NothingToBatch) {
        this.setActionMessage(`Regenerated batch ${row.JournalEntryBatchNumber}: no candidate journal entries remain.`, false);
        await this.loadBatches();
      } else if (res.Success) {
        this.setActionMessage(
          `Regenerated batch ${row.JournalEntryBatchNumber}: ${res.JECount} JE(s) across ${res.CompanyCount} company(ies) → ${res.SummaryLineCount} summary line(s); Dr ${res.TotalDebits} / Cr ${res.TotalCredits}.`,
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
      const res = await this.client().DispatchJournalEntryBatch(row.ID);
      if (res.Success) {
        this.setActionMessage(
          `Dispatched batch ${row.JournalEntryBatchNumber} → ${res.Status}${res.ExternalJournalEntryBatchRef ? ` (ref ${res.ExternalJournalEntryBatchRef})` : ''}.`,
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
      JournalEntryBatchNumber: b.JournalEntryBatchNumber,
      Status: b.Status,
      TargetSystem: b.TargetSystem,
      TotalEntries: b.TotalEntries,
      TotalDebits: b.TotalDebits,
      TotalCredits: b.TotalCredits,
      ExternalJournalEntryBatchRef: b.ExternalJournalEntryBatchRef,
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
  private client(): JournalEntryBatchDispatchClient {
    return new JournalEntryBatchDispatchClient(this.ProviderToUse as GraphQLDataProvider);
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
export function LoadJournalEntryBatchDispatchDashboard(): void {
  // No-op. Static import + this call keep the @RegisterClass decorator from being shaken out.
}
