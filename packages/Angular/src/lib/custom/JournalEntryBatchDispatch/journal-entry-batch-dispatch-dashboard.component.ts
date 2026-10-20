import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { PageRefreshService } from '../../transfer-pending/shell-refresh/page-refresh.service';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { RegisterClass } from '@memberjunction/global';
import { ResourceData } from '@memberjunction/core-entities';
import { RunView } from '@memberjunction/core';
import { UserCanOperateJournalEntryBatches } from '@mj-biz-apps/accounting-engine-base';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import {
  mjBizAppsAccountingJournalEntryBatchEntity,
} from '@mj-biz-apps/accounting-entities';
import { JournalEntryBatchDispatchClient, JournalEntryBatchDecision } from './journal-entry-batch-dispatch.client';
import { BatchAction, BatchActionDialogState } from './batch-action-dialog/batch-action-dialog.state';
import { CompanyApprovers, IsErpAcceptedFailedBatch, LoadCompanyApprovers, MayArchiveBatch, MayCancelApprovedBatch, MayCancelPendingBatch, MayDecideBatch } from './batch-action-permission';

/** The generated batch Status union (rule 2c: derived, never hand-copied). */
type BatchStatus = mjBizAppsAccountingJournalEntryBatchEntity['Status'];

/**
 * One batch row in the list, with its derived display + (lazily-loaded) CFO approval state.
 * Approval state is NOT a column on the batch — it lives in bizapps-tasks (a Task linked to the
 * batch + a terminal Task Decision), so we resolve it via the gate-backed `JournalEntryBatchApprovalState` query.
 */
/**
 * The batch's own fields are PICKED from the generated entity class, never re-declared, so the
 * compiler checks every field name and type against the schema. Only the genuinely non-entity
 * parts — the gate result and the per-row in-flight flag, neither of which is a column — are
 * declared here.
 */
type BatchRow = Pick<
  mjBizAppsAccountingJournalEntryBatchEntity,
  'ID' | 'JournalEntryBatchNumber' | 'Status' | 'TargetSystem' | 'TotalEntries' | 'TotalDebits' | 'TotalCredits' | 'ExternalJournalEntryBatchRef' | 'ErrorMessage' | 'ArchiveReason' | 'CancelReason'
  | 'CompanyID' | 'BatchedByUserID' | 'ApprovedByUserID'
> & {
  /** undefined = not yet checked; null = unknown/error; true/false = gate result. */
  Approved?: boolean | null;
  ApprovalReason?: string;
  /** Per-row in-flight flag so spinners/disables are scoped to the acting row. */
  Busy?: boolean;
};

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

/** What a reason action did: finished (the dialog closes) or needs the ERP check (it stays open). */
type ReasonActionOutcome = 'Done' | 'NeedsERPCheck';

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
  /** Each company's configured approver, read with the batches; decides who sees Approve, Reject and Cancel (#308, #339). */
  private companyApprovers: CompanyApprovers = new Map();

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
   *  the inline mj-refresh-button was removed (the header owns the ONE
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

  /**
   * Record an in-app CFO Approve / Reject decision on a batch, then refresh its approval state. A
   * rejection cancels the batch, so it opens the reason dialog first (golive #302); the reason is
   * recorded as the decision's notes and the batch's CancelReason.
   */
  public async OnRecordDecision(row: BatchRow, decision: JournalEntryBatchDecision): Promise<void> {
    if (row.Busy) return;
    if (decision === 'Rejected') {
      this.openDialog(row, 'Reject');
      return;
    }
    await this.runRowAction(row, () => this.recordDecision(row, decision));
  }

  private async recordDecision(row: BatchRow, decision: JournalEntryBatchDecision, notes?: string): Promise<ReasonActionOutcome> {
    const res = await this.client().RecordDecision(row.ID, decision, notes);
    if (res.Success) {
      // A rejection reverses the preliminary lock: the batch is Cancelled and its entries return to the pool.
      const msg = decision === 'Rejected'
        ? `Rejected batch ${row.JournalEntryBatchNumber} — cancelled; its journal entries returned to the candidate pool.`
        : `Recorded "${decision}" on batch ${row.JournalEntryBatchNumber}.`;
      this.setActionMessage(msg, false);
      await this.loadBatches(); // an approval flips Pending→Approved; a rejection flips Pending→Cancelled
    } else {
      this.setActionMessage(res.ErrorMessage ?? `Your decision on batch ${row.JournalEntryBatchNumber} was not recorded. Try again.`, true);
    }
    return 'Done';
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
        this.setActionMessage(res.ErrorMessage ?? `Batch ${row.JournalEntryBatchNumber} was not regenerated. Try again.`, true);
      }
    } finally {
      row.Busy = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Dispatch a Pending, approved batch to the ERP (gate blocks if not approved; mock poster v1).
   * `Success` means only that the call returned: an ERP rejection comes back as `Success` with the
   * batch at `Failed` (or `Failed` in memory while the database stays at `Sent`, if recording the
   * failure fails), so anything other than `Posted` is reported as an error. Every outcome reloads:
   * a server throw can land after the batch has already moved (e.g. the Sent→Posted save failing
   * after the ERP accepted the journal), and the card must not keep showing `Approved`.
   */
  public async OnDispatch(row: BatchRow): Promise<void> {
    if (row.Busy) return;
    row.Busy = true;
    this.clearActionMessage();
    this.cdr.markForCheck();
    try {
      const res = await this.client().DispatchJournalEntryBatch(row.ID);
      if (res.Success && res.Status === 'Posted') {
        this.setActionMessage(
          `Dispatched batch ${row.JournalEntryBatchNumber} → Posted${res.ExternalJournalEntryBatchRef ? ` (ref ${res.ExternalJournalEntryBatchRef})` : ''}.`,
          false,
        );
      } else if (res.Success) {
        this.setActionMessage(
          `Batch ${row.JournalEntryBatchNumber} did not post — the batch is ${res.Status ?? 'unknown'}. The reason is on the batch below; retry it from Dispatch status.`,
          true,
        );
      } else {
        this.setActionMessage(res.ErrorMessage ?? `Batch ${row.JournalEntryBatchNumber} was not sent to the ERP. Try again.`, true);
      }
      await this.loadBatches();
    } finally {
      row.Busy = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Archive a batch that must never post to the ERP (#214): terminal, no ERP call, and the batch's
   * journal entries STAY locked — the opposite of Reject, which returns them to the candidate pool.
   * Opens the reason dialog; the reason is required and is the only record of why.
   */
  public OnArchive(row: BatchRow): void {
    if (row.Busy) return;
    this.openDialog(row, 'Archive');
  }

  /**
   * Every answer reloads the list, an error included: a call that timed out on the way back may
   * still have archived the batch on the server, and the card must show that rather than invite a
   * second attempt.
   */
  private async archive(row: BatchRow, reason: string): Promise<ReasonActionOutcome> {
    const res = await this.client().ArchiveBatch(row.ID, reason);
    if (res.Success) {
      this.setActionMessage(`Archived batch ${row.JournalEntryBatchNumber} — no ERP call; its journal entries stay locked to it.`, false);
    } else {
      this.setActionMessage(res.ErrorMessage ?? `Batch ${row.JournalEntryBatchNumber} was not archived. Try again.`, true);
    }
    await this.loadBatches();
    return 'Done';
  }

  /**
   * Cancel a Pending (golive #302), Approved or Failed (#183) batch: the batch becomes Cancelled, its
   * summary journal entry is deleted and its journal entries return to the candidate pool for the next
   * build — the opposite of Archive, which keeps them locked. A Pending batch's approval request is
   * closed. Opens the reason dialog.
   */
  public OnCancel(row: BatchRow): void {
    if (row.Busy) return;
    this.openDialog(row, 'Cancel');
  }

  /**
   * A Failed batch may already be in the ERP, and its entries would post again under the next batch's
   * new number. The first attempt carries no confirmation: the server looks the number up (#207),
   * refuses outright if the ERP holds it, and cancels if nothing is there. Only when its lookup cannot
   * settle it does the dialog stay open and ask, and only that second attempt carries the operator's word.
   *
   * Every other answer reloads the list, a refusal included: when the ERP turns out to have posted the
   * batch during the cancel, the server records it Posted and refuses, and the card must not keep
   * showing `Failed`.
   */
  private async cancel(row: BatchRow, reason: string, confirmed: boolean): Promise<ReasonActionOutcome> {
    const res = await this.client().CancelBatch(row.ID, reason, confirmed);
    if (res.Success && res.ConfirmationRequired) {
      this.Dialog.AskForERPCheck(res.ConfirmationRequired, res.ConfirmationKind ?? null);
      return 'NeedsERPCheck';
    }
    if (res.Success) {
      this.setActionMessage(`Cancelled batch ${row.JournalEntryBatchNumber} — its journal entries return to the next build.`, false);
    } else {
      this.setActionMessage(res.ErrorMessage ?? `Batch ${row.JournalEntryBatchNumber} was not cancelled. Try again.`, true);
    }
    await this.loadBatches();
    return 'Done';
  }

  // ─── Reject / Archive / Cancel dialog (#405) ─────────────────────────────
  //
  // The shared batch-action dialog, as on Dispatch status and the Batches overview. Not
  // window.prompt: the desktop Explorer has no prompt(), so the buttons did nothing there.

  public Dialog = new BatchActionDialogState<BatchRow>();

  public async ConfirmDialog(): Promise<void> {
    const dialog = this.Dialog;
    const row = dialog.Batch;
    const action = dialog.Action;
    if (!row || !action || !dialog.CanConfirm) return;
    const reason = dialog.TrimmedReason;
    const confirmed = dialog.ConfirmsNotPostedInERP;
    dialog.Busy = true;
    let outcome: ReasonActionOutcome | null = null;
    try {
      outcome = await this.runRowAction(row, () => this.runDialogAction(row, action, reason, confirmed));
    } finally {
      dialog.Busy = false;
      if (outcome !== 'NeedsERPCheck') dialog.Close();
      this.cdr.markForCheck();
    }
  }

  public DismissDialog(): void {
    if (this.Dialog.Busy) return;
    this.Dialog.Close();
    this.cdr.markForCheck();
  }

  private openDialog(row: BatchRow, action: BatchAction): void {
    this.Dialog.Open(row, action, this.ProviderToUse);
    this.cdr.markForCheck();
  }

  private runDialogAction(row: BatchRow, action: BatchAction, reason: string, confirmed: boolean): Promise<ReasonActionOutcome> {
    switch (action) {
      case 'Reject': return this.recordDecision(row, 'Rejected', reason);
      case 'Archive': return this.archive(row, reason);
      default: return this.cancel(row, reason, confirmed);
    }
  }

  /** Run one row's server call with the row marked busy and the banner cleared. */
  private async runRowAction<T>(row: BatchRow, action: () => Promise<T>): Promise<T | null> {
    if (row.Busy) return null;
    row.Busy = true;
    this.clearActionMessage();
    this.cdr.markForCheck();
    try {
      return await action();
    } finally {
      row.Busy = false;
      this.cdr.markForCheck();
    }
  }

  // ─── view helpers (template-facing) ──────────────────────────────────────

  /** An Approved batch (status flip happens with the CFO decision) can dispatch. */
  public canDispatch(row: BatchRow): boolean {
    return row.Status === 'Approved' && row.Approved === true && !row.Busy && this.mayOperateBatches();
  }

  /**
   * Whether the signed-in user holds the batch-operator Authorization (the Finance role) that
   * Dispatch, Regenerate and Archive require on the server (#448). The server stays the authority.
   */
  private mayOperateBatches(): boolean {
    return UserCanOperateJournalEntryBatches(this.contextUser(), this.ProviderToUse.Authorizations);
  }

  /**
   * CFO decision controls show only while the batch is still Pending, and only to the users the server
   * would record a decision from: the company's approver, when they did not build the batch (#339).
   * The server check stays the authority.
   */
  public canDecide(row: BatchRow): boolean {
    if (!MayDecideBatch(row, this.contextUser()?.ID, this.companyApprovers)) return false;
    return row.Status === 'Pending' && row.Approved !== true && !row.Busy;
  }

  /** Regenerate is offered on an OPEN (Pending) batch — it re-gathers candidates in place. */
  public canRegenerate(row: BatchRow): boolean {
    return row.Status === 'Pending' && !row.Busy && this.mayOperateBatches();
  }

  /**
   * Archive is offered wherever LEGAL_TRANSITIONS allows `→ Archived` (server-side: Pending / Approved /
   * Failed), except on a Failed batch carrying the ERP's reference, which the server refuses (#413), and
   * only to the users the server would let archive it (#448): holders of the batch-operator Authorization
   * who are, on a Pending batch, the company's approver, and past approval the company's approver or the
   * user who approved it. The server check stays the authority.
   */
  public canArchive(row: BatchRow): boolean {
    if (IsErpAcceptedFailedBatch(row)) return false;
    if (!['Pending', 'Approved', 'Failed'].includes(row.Status) || row.Busy) return false;
    return this.mayOperateBatches() && MayArchiveBatch(row, this.contextUser()?.ID, this.companyApprovers);
  }

  /**
   * Cancel is offered on a Pending (golive #302), Approved or Failed (#183) batch, and only to the
   * users the server would let cancel it. On a Pending batch it is the builder's way to withdraw it,
   * beside the CFO's Reject: the company's approver or the batch's builder (#308). Past approval: the
   * company's approver or the user who approved the batch (#339). The server check stays the
   * authority. Not on a Failed batch carrying the ERP's reference: the ERP accepted it, and the server
   * refuses it.
   */
  public canCancel(row: BatchRow): boolean {
    if (IsErpAcceptedFailedBatch(row)) return false;
    if (!['Pending', 'Approved', 'Failed'].includes(row.Status) || row.Busy) return false;
    const userId = this.contextUser()?.ID;
    return row.Status === 'Pending'
      ? MayCancelPendingBatch(row, userId, this.companyApprovers)
      : MayCancelApprovedBatch(row, userId, this.companyApprovers);
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
    const [res, approvers] = await Promise.all([
      rv.RunView<mjBizAppsAccountingJournalEntryBatchEntity>(
        {
          EntityName: BATCH_ENTITY,
          OrderBy: 'BatchedAt DESC',
          ResultType: 'simple',
        },
        this.contextUser(),
      ),
      LoadCompanyApprovers(rv, this.contextUser()),
    ]);
    this.companyApprovers = approvers;
    if (!res.Success) {
      this.Batches = [];
      this.LoadError = res.ErrorMessage ?? 'Could not load journal entry batches. Refresh the page to try again.';
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
      ArchiveReason: b.ArchiveReason,
      CancelReason: b.CancelReason,
      CompanyID: b.CompanyID,
      BatchedByUserID: b.BatchedByUserID,
      ApprovedByUserID: b.ApprovedByUserID,
    };
  }

  private async refreshApprovalState(row: BatchRow): Promise<void> {
    const res = await this.client().GetApprovalState(row.ID);
    row.Approved = res.Success ? res.Approved : null;
    // Why the send gate refuses a batch matters past approval; on a Pending batch it only restates
    // that nobody has approved it yet, which the card shows as its stage instead.
    row.ApprovalReason = res.Approved || row.Status === 'Pending' ? undefined : res.Reason;
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
