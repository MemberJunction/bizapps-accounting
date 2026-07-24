/**
 * TasksAppApprovalGate — the REAL CFO approval gate for JE-batch dispatch (Block 2 completion).
 *
 * Replaces the placeholder AutoApproveGate in production. It backs the BatchApprovalGate seam
 * (BatchingEngine.ts) with the bizapps-tasks app so a JE batch can only be sent once a CFO has
 * recorded a terminal Approved / ApprovedWithConditions decision against the linked approval Task.
 *
 *   onBatchBuilt(batchId): batches are SINGLE-COMPANY (D7) — resolve the batch's CompanyID →
 *     that company's AccountingCompanyProfile.ApprovalCFOUserID (a __mj.User). If null,
 *     HARD-FAIL (per the per-company-field decision — no role fallback). Then
 *     CreateApprovalRequest ONE "Approve JE Batch #<BatchNumber>" Task linked to the batch
 *     (polymorphic Task Link), assigned to that CFO User. (Interim shape pending the
 *     approval-flow review with Robert.)
 *   assertApproved(batchId): find the Task linked to the batch; require a terminal Approved /
 *     ApprovedWithConditions Task Decision; otherwise THROW (blocks the send).
 *   recordDecision(batchId, outcome, decidedByPersonId, notes): resolve the batch's Task and record
 *     the decision via TaskOrchestrationService. The shared entry point for BOTH the in-app approve
 *     control and the Tasks inbox.
 *
 * PROVIDER: the gate is a plain class (no BaseEntity ProviderToUse), so it takes an optional
 * IMetadataProvider at construction and falls back to the global Metadata.Provider — the MJ
 * multi-provider rule for code that doesn't own a provider.
 *
 * CONNECTS TO:
 *   READS:  Journal Entry Batches · Accounting Company Profiles · Task Links · Task Decisions
 *           · Task Decision Outcomes · Task Types
 *   WRITES (via TaskOrchestrationService): Tasks · Task Links · Task Assignments · Task Decisions
 *   ENTITY (gated): 'MJ_BizApps_Accounting: Journal Entry Batches'
 *   DOC:    BatchingEngine.ts (BatchApprovalGate seam) · plan §S1 (CFO-approval workflow gate)
 */
import { IMetadataProvider, IRunViewProvider, Metadata, UserInfo } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import { TaskOrchestrationService, type TaskDecisionOutcomeCode } from '@mj-biz-apps/tasks-core';
import type {
  mjBizAppsTasksTaskEntity,
  mjBizAppsTasksTaskTypeEntity,
  mjBizAppsTasksTaskLinkEntity,
  mjBizAppsTasksTaskDecisionEntity,
  mjBizAppsTasksTaskDecisionOutcomeEntity,
} from '@mj-biz-apps/tasks-entities';
import type {
  mjBizAppsAccountingJournalEntryBatchEntity,
  mjBizAppsAccountingAccountingCompanyProfileEntity,
} from '@mj-biz-apps/accounting-entities';
import type { BatchApprovalGate } from './BatchingEngine.js';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const TASK_TYPE_ENTITY = 'MJ_BizApps_Tasks: Task Types';
const TASK_LINK_ENTITY = 'MJ_BizApps_Tasks: Task Links';
const TASK_DECISION_ENTITY = 'MJ_BizApps_Tasks: Task Decisions';
const TASK_DECISION_OUTCOME_ENTITY = 'MJ_BizApps_Tasks: Task Decision Outcomes';

/** The seeded generic approval TaskType that CreateApprovalRequest expects. */
const APPROVAL_REQUEST_TASK_TYPE = 'Approval Request';

/** The approver assignments now reference __mj Users (ApprovalCFOUserID is a User FK). */
const USER_ENTITY = 'Users';

/** Terminal outcomes that count as "approved to send". */
const APPROVED_OUTCOME_CODES: ReadonlySet<TaskDecisionOutcomeCode> = new Set(['Approved', 'ApprovedWithConditions']);

/**
 * Real CFO-approval gate, backed by bizapps-tasks. Stateless — one instance can serve every batch.
 * Optionally bound to a specific IMetadataProvider (defaults to the global Metadata.Provider).
 */
export class TasksAppApprovalGate implements BatchApprovalGate {
  private readonly orchestration = new TaskOrchestrationService();

  constructor(private readonly _provider?: IMetadataProvider) {}

  /**
   * The provider this gate uses — the instance-bound provider when one was given at
   * construction, else the global default. Mirrors BaseEntity/BaseEngine.ProviderToUse.
   */
  public get ProviderToUse(): IMetadataProvider {
    const md = this._provider ?? Metadata.Provider;
    if (!md) throw new Error('TasksAppApprovalGate: no metadata provider available (Metadata.Provider not initialized)');
    return md;
  }

  /** The same provider viewed through its RunView interface (mirrors BaseEngine.RunViewProviderToUse). */
  public get RunViewProviderToUse(): IRunViewProvider {
    return this.ProviderToUse as unknown as IRunViewProvider;
  }

  /** Build the approval Task when a batch is built. Throws if the batch's company lacks a CFO. */
  async onBatchBuilt(batchId: string, contextUser: UserInfo): Promise<void> {
    const batch = await this.loadBatch(batchId, contextUser);
    const cfoUserId = await this.resolveCFOUserId(batch, contextUser);
    const typeId = await this.resolveApprovalTaskTypeId(contextUser);
    // Task Link's EntityID / assignee EntityID are UUID FKs to __mj.Entity.ID — resolve names → IDs.
    const batchEntityId = this.batchEntityId();
    const userEntityId = this.resolveUserEntityId();
    await this.orchestration.CreateApprovalRequest({
      Name: `Approve Journal Entry Batch #${batch.BatchNumber}`,
      TypeID: typeId,
      Description: `CFO approval required to dispatch Journal Entry Batch #${batch.BatchNumber} to ${batch.TargetSystem}.`,
      Priority: 'High',
      LinkEntityID: batchEntityId,
      LinkRecordID: batchId,
      ApproverPersonEntityID: userEntityId,
      ApproverPersonRecordIDs: [cfoUserId],
    }, contextUser);
    // CreateApprovalRequest logs (not throws) on a failed link — verify the link actually persisted,
    // else assertApproved would block the send forever with no recoverable signal.
    if (!(await this.resolveBatchTask(batchId, contextUser))) {
      throw new Error(`Approval Task for batch ${batchId} was created but its Task Link did not persist — check tasks-app schema/permissions.`);
    }
  }

  /** Block the send unless the batch's Task carries a terminal Approved/ApprovedWithConditions decision. */
  async assertApproved(batchId: string, contextUser: UserInfo): Promise<void> {
    const task = await this.resolveBatchTask(batchId, contextUser);
    if (!task) throw new Error(`Batch ${batchId} has no approval Task — it was not raised through TasksAppApprovalGate.onBatchBuilt.`);
    if (!(await this.hasApprovedDecision(task.ID, contextUser))) {
      throw new Error(`Batch ${batchId} is not approved — no terminal Approved/ApprovedWithConditions decision on its approval Task.`);
    }
  }

  /** Record an approve/reject decision on the batch's Task. Used by the in-app control AND the Tasks inbox. */
  async recordDecision(
    batchId: string, outcome: TaskDecisionOutcomeCode, decidedByPersonId: string, notes: string | undefined, contextUser: UserInfo,
  ): Promise<void> {
    const task = await this.resolveBatchTask(batchId, contextUser);
    if (!task) throw new Error(`Batch ${batchId} has no approval Task to record a decision against.`);
    await this.orchestration.RecordDecision({ TaskID: task.ID, OutcomeCode: outcome, DecidedByPersonID: decidedByPersonId, Notes: notes }, contextUser);
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  private async loadBatch(batchId: string, contextUser: UserInfo): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
    const batch = await this.ProviderToUse.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
    if (!(await batch.Load(batchId))) throw new Error(`TasksAppApprovalGate: batch ${batchId} not found`);
    return batch;
  }

  /**
   * The CFO User of the batch's company (batches are single-company, D7 — the header carries
   * CompanyID). Hard-fail when the company lacks a configured CFO.
   */
  private async resolveCFOUserId(batch: mjBizAppsAccountingJournalEntryBatchEntity, contextUser: UserInfo): Promise<string> {
    const acp = await this.ProviderToUse.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, contextUser);
    if (!(await acp.Load(batch.CompanyID))) throw new Error(`TasksAppApprovalGate: no AccountingCompanyProfile for company ${batch.CompanyID}`);
    const cfo = acp.ApprovalCFOUserID;
    if (!cfo) {
      throw new Error(`No CFO configured for company ${batch.CompanyID}; set AccountingCompanyProfile.ApprovalCFOUserID before batching for approval.`);
    }
    return cfo;
  }

  private async resolveApprovalTaskTypeId(contextUser: UserInfo): Promise<string> {
    const res = await this.RunViewProviderToUse.RunView<mjBizAppsTasksTaskTypeEntity>(
      { EntityName: TASK_TYPE_ENTITY, ExtraFilter: `Name='${APPROVAL_REQUEST_TASK_TYPE.replace(/'/g, "''")}'`, MaxRows: 1, ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    const type = res.Results?.[0];
    if (!res.Success || !type) throw new Error(`TasksAppApprovalGate: TaskType '${APPROVAL_REQUEST_TASK_TYPE}' not found (is bizapps-tasks metadata seeded?)`);
    return type.ID;
  }

  private resolveUserEntityId(): string {
    const entity = this.ProviderToUse.EntityByName(USER_ENTITY);
    if (!entity) throw new Error(`TasksAppApprovalGate: entity '${USER_ENTITY}' not found in metadata`);
    return entity.ID;
  }

  /** The (single) approval Task linked to this batch via a polymorphic Task Link. */
  private async resolveBatchTask(batchId: string, contextUser: UserInfo): Promise<mjBizAppsTasksTaskEntity | null> {
    const batchEntityId = this.batchEntityId();
    const linkRes = await this.RunViewProviderToUse.RunView<mjBizAppsTasksTaskLinkEntity>(
      { EntityName: TASK_LINK_ENTITY, ExtraFilter: `EntityID='${batchEntityId}' AND RecordID='${batchId}'`, OrderBy: '__mj_CreatedAt DESC', ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    const link = linkRes.Results?.[0];
    if (!link) return null;
    const task = await this.ProviderToUse.GetEntityObject<mjBizAppsTasksTaskEntity>('MJ_BizApps_Tasks: Tasks', contextUser);
    return (await task.Load(link.TaskID)) ? task : null;
  }

  /** Resolve the Journal Entry Batches EntityID for Task Link filtering. */
  private batchEntityId(): string {
    const entity = this.ProviderToUse.EntityByName(BATCH_ENTITY);
    if (!entity) throw new Error(`TasksAppApprovalGate: entity '${BATCH_ENTITY}' not found in metadata`);
    return entity.ID;
  }

  /** True when the Task has at least one terminal decision whose outcome code is Approved/ApprovedWithConditions. */
  private async hasApprovedDecision(taskId: string, contextUser: UserInfo): Promise<boolean> {
    const decRes = await this.RunViewProviderToUse.RunView<mjBizAppsTasksTaskDecisionEntity>(
      { EntityName: TASK_DECISION_ENTITY, ExtraFilter: `TaskID='${taskId}'`, ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    const decisions = decRes.Results ?? [];
    if (decisions.length === 0) return false;
    const outcomes = await this.loadApprovedTerminalOutcomeIds(contextUser);
    return decisions.some(d => outcomes.some(oid => UUIDsEqual(oid, d.OutcomeID)));
  }

  /** The TaskDecisionOutcome IDs that are BOTH terminal AND an approval (Approved / ApprovedWithConditions). */
  private async loadApprovedTerminalOutcomeIds(contextUser: UserInfo): Promise<string[]> {
    const res = await this.RunViewProviderToUse.RunView<mjBizAppsTasksTaskDecisionOutcomeEntity>(
      { EntityName: TASK_DECISION_OUTCOME_ENTITY, ExtraFilter: `IsTerminal=1`, ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    return (res.Results ?? [])
      .filter(o => APPROVED_OUTCOME_CODES.has(o.Code as TaskDecisionOutcomeCode))
      .map(o => o.ID);
  }
}
