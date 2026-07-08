import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { RegisterClass } from '@memberjunction/global';
import { RunView } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { ResourceData } from '@memberjunction/core-entities';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import { BatchApprovalsClient, BatchApprovalDecision } from './batch-approvals.client';

/** Batch Status union, derived from the generated accounting entity (rule 2c — never hand-copied). */
type BatchStatus = mjBizAppsAccountingJournalEntryBatchEntity['Status'];

const TASK_ENTITY = 'MJ_BizApps_Tasks: Tasks';
const TASK_LINK_ENTITY = 'MJ_BizApps_Tasks: Task Links';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

/** The seeded TaskType that batch-dispatch raises its CFO approval Task under (TasksAppApprovalGate). */
const APPROVAL_REQUEST_TYPE = 'Approval Request';

/** A Task's non-terminal states — an "open" (still-pending) approval. Terminal = Completed | Cancelled. */
const TERMINAL_TASK_STATUSES = ['Completed', 'Cancelled'];

/** An open approval Task, as read from the Tasks entity (Task Status/Type typed as raw scalars —
 *  the tasks-entities package is not a dependency here, so the union can't be derived; see report). */
interface OpenApprovalTask {
  ID: string;
  Name: string;
  CreatedAt: Date | null;
}

/** One row in the inbox: an open approval Task joined to the JournalEntryBatch it gates. */
interface ApprovalRow {
  TaskID: string;
  TaskName: string;
  CreatedAt: Date | null;
  BatchID: string;
  BatchNumber: string;
  BatchStatus: BatchStatus;
  TargetSystem: string;
  TotalEntries: number;
  TotalDebits: number;
  TotalCredits: number;
  /** Per-row in-flight flag so spinners/disables scope to the acting row. */
  Busy?: boolean;
}

/**
 * Batch Approvals inbox — the CFO/approver surface listing OPEN JE-batch approval Tasks and letting the
 * approver Approve or Reject each one in place. Batch dispatch (BatchingEngine → TasksAppApprovalGate)
 * raises ONE "Approve JE Batch #<n>" Task (Task Type "Approval Request"), linked to the batch via a
 * polymorphic Task Link and assigned to the companies' CFO People. Recording a terminal decision here
 * calls the SAME RecordJEBatchDecision mutation the in-app control uses, so an approval flips the gate.
 *
 * Reads are client-side, batched RunViews (Tasks → Task Links → Batches, no query-in-loop). The
 * decision goes through BatchApprovalsClient → RecordJEBatchDecision.
 *
 * NOTE (flagged in the build report): this shows ALL open batch-approval Tasks, NOT only those assigned
 * to the current user. A reliable current-User → assignee-Person mapping isn't available client-side
 * (assignments target People; CurrentUser is a User), so the page is scoped "Open batch approvals".
 */
@Component({
  standalone: false,
  selector: 'mj-batch-approvals-dashboard',
  templateUrl: './batch-approvals-dashboard.component.html',
  styleUrls: ['./batch-approvals-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'BatchApprovalsDashboard')
export class BatchApprovalsDashboardComponent extends BaseDashboard {
  private cdr = inject(ChangeDetectorRef);

  public IsBusy = false;
  public LoadError: string | null = null;

  public Rows: ApprovalRow[] = [];

  public ActionMessage: string | null = null;
  public ActionIsError = false;

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Approvals';
  }

  /** The signed-in approver's display name — shown as context (the page is not filtered to them; see note). */
  public get CurrentUserName(): string {
    return this.ProviderToUse?.CurrentUser?.Name ?? 'you';
  }

  public get PendingCount(): number {
    return this.Rows.length;
  }

  protected initDashboard(): void {
    // One-time setup; data loads in loadData().
  }

  protected async loadData(): Promise<void> {
    this.IsBusy = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      await this.loadApprovals();
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsBusy = false;
      this.cdr.markForCheck();
    }
  }

  /** Orchestrates the three batched reads: open approval Tasks → their batch links → the batches. */
  private async loadApprovals(): Promise<void> {
    const tasks = await this.loadOpenApprovalTasks();
    if (tasks.length === 0) {
      this.Rows = [];
      return;
    }
    const taskToBatch = await this.resolveBatchIdsForTasks(tasks.map(t => t.ID));
    const batchIds = [...new Set([...taskToBatch.values()])];
    const batches = await this.loadBatches(batchIds);
    this.Rows = this.buildRows(tasks, taskToBatch, batches);
  }

  /** Open (non-terminal) approval-request Tasks, newest first. */
  private async loadOpenApprovalTasks(): Promise<OpenApprovalTask[]> {
    const terminalList = TERMINAL_TASK_STATUSES.map(s => `'${s}'`).join(',');
    const rv = new RunView();
    const res = await rv.RunView<{ ID: string; Name: string; __mj_CreatedAt: Date | null }>({
      EntityName: TASK_ENTITY,
      ExtraFilter: `Type='${APPROVAL_REQUEST_TYPE}' AND Status NOT IN (${terminalList})`,
      Fields: ['ID', 'Name', '__mj_CreatedAt'],
      OrderBy: '__mj_CreatedAt DESC',
      ResultType: 'simple',
    });
    if (!res.Success) throw new Error(res.ErrorMessage ?? 'Failed to load approval tasks.');
    return (res.Results ?? []).map(r => ({ ID: r.ID, Name: r.Name, CreatedAt: r.__mj_CreatedAt ?? null }));
  }

  /** One batched read of the batch-scoped Task Links for the given tasks → Map(taskID → batchID). */
  private async resolveBatchIdsForTasks(taskIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (taskIds.length === 0) return map;
    const batchEntityId = this.ProviderToUse?.EntityByName?.(BATCH_ENTITY)?.ID;
    if (!batchEntityId) throw new Error(`Entity '${BATCH_ENTITY}' not found in metadata.`);
    const inList = taskIds.map(id => `'${id}'`).join(',');
    const rv = new RunView();
    const res = await rv.RunView<{ TaskID: string; RecordID: string }>({
      EntityName: TASK_LINK_ENTITY,
      ExtraFilter: `EntityID='${batchEntityId}' AND TaskID IN (${inList})`,
      Fields: ['TaskID', 'RecordID'],
      ResultType: 'simple',
    });
    if (!res.Success) throw new Error(res.ErrorMessage ?? 'Failed to load task links.');
    for (const link of res.Results ?? []) {
      // A batch raises one approval Task; keep the first link per task.
      if (!map.has(link.TaskID)) map.set(link.TaskID, link.RecordID);
    }
    return map;
  }

  /** One batched read of the linked batches → Map(batchID → its display fields). */
  private async loadBatches(batchIds: string[]): Promise<Map<string, ApprovalRow>> {
    const map = new Map<string, ApprovalRow>();
    if (batchIds.length === 0) return map;
    const inList = batchIds.map(id => `'${id}'`).join(',');
    const rv = new RunView();
    const res = await rv.RunView<{
      ID: string; BatchNumber: string; Status: BatchStatus; TargetSystem: string;
      TotalEntries: number; TotalDebits: number; TotalCredits: number;
    }>({
      EntityName: BATCH_ENTITY,
      ExtraFilter: `ID IN (${inList})`,
      Fields: ['ID', 'BatchNumber', 'Status', 'TargetSystem', 'TotalEntries', 'TotalDebits', 'TotalCredits'],
      ResultType: 'simple',
    });
    if (!res.Success) throw new Error(res.ErrorMessage ?? 'Failed to load batches.');
    for (const b of res.Results ?? []) {
      map.set(b.ID.toUpperCase(), {
        TaskID: '', TaskName: '', CreatedAt: null,
        BatchID: b.ID, BatchNumber: b.BatchNumber, BatchStatus: b.Status, TargetSystem: b.TargetSystem,
        TotalEntries: Number(b.TotalEntries ?? 0), TotalDebits: Number(b.TotalDebits ?? 0), TotalCredits: Number(b.TotalCredits ?? 0),
      });
    }
    return map;
  }

  /** Join open tasks to their resolved batch; skip tasks whose batch link/record didn't resolve. */
  private buildRows(tasks: OpenApprovalTask[], taskToBatch: Map<string, string>, batches: Map<string, ApprovalRow>): ApprovalRow[] {
    const rows: ApprovalRow[] = [];
    for (const task of tasks) {
      const batchId = taskToBatch.get(task.ID);
      if (!batchId) continue;
      const batch = batches.get(batchId.toUpperCase());
      if (!batch) continue;
      rows.push({ ...batch, TaskID: task.ID, TaskName: task.Name, CreatedAt: task.CreatedAt });
    }
    return rows;
  }

  // ─── decisions ──────────────────────────────────────────────────────────────

  public async Approve(row: ApprovalRow): Promise<void> {
    await this.recordDecision(row, 'Approved');
  }

  public async Reject(row: ApprovalRow): Promise<void> {
    await this.recordDecision(row, 'Rejected');
  }

  private async recordDecision(row: ApprovalRow, decision: BatchApprovalDecision): Promise<void> {
    if (row.Busy) return;
    row.Busy = true;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      const client = new BatchApprovalsClient(this.ProviderToUse as GraphQLDataProvider);
      const res = await client.RecordDecision(row.BatchID, decision, `${decision} from Batch Approvals inbox by ${this.CurrentUserName}`);
      if (res.Success) {
        this.setMessage(`${decision === 'Approved' ? 'Approved' : 'Rejected'} batch ${row.BatchNumber}.`, false);
        await this.loadApprovals();
      } else {
        this.setMessage(res.ErrorMessage ?? 'Decision failed.', true);
      }
    } catch (e) {
      this.setMessage(e instanceof Error ? e.message : String(e), true);
    } finally {
      row.Busy = false;
      this.cdr.markForCheck();
    }
  }

  private setMessage(message: string, isError: boolean): void {
    this.ActionMessage = message;
    this.ActionIsError = isError;
    this.cdr.markForCheck();
  }

  // ─── presentation ─────────────────────────────────────────────────────────────

  public StatusVariant(status: BatchStatus): string {
    switch (status) {
      case 'Posted':
      case 'Approved':
        return 'success';
      case 'Sent':
        return 'info';
      case 'Failed':
        return 'error';
      case 'Cancelled':
        return 'muted';
      default:
        return 'warning';
    }
  }
}
