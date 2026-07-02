/**
 * TasksAppApprovalGate — the REAL CFO approval gate for JE-batch dispatch (Block 2 completion).
 *
 * Replaces the placeholder AutoApproveGate in production. It backs the BatchApprovalGate seam
 * (BatchingEngine.ts) with the bizapps-tasks app so a JE batch can only be sent once a CFO has
 * recorded a terminal Approved / ApprovedWithConditions decision against the linked approval Task.
 *
 *   onBatchBuilt(batchId): resolve the batch → its Company → the company's AccountingCompanyProfile
 *     → ApprovalCFOPersonID. If null, HARD-FAIL (per the per-company-field decision — no role fallback).
 *     Then CreateApprovalRequest an "Approve JE Batch #<BatchNumber>" Task linked to the batch
 *     (polymorphic Task Link on 'MJ_BizApps_Accounting: Journal Entry Batches' / batchId), assigned
 *     to that CFO Person.
 *   assertApproved(batchId): find the Task linked to the batch; require a terminal Approved /
 *     ApprovedWithConditions Task Decision; otherwise THROW (blocks the send).
 *   recordDecision(batchId, outcome, decidedByPersonId, notes): resolve the batch's Task and record
 *     the decision via TaskOrchestrationService. The shared entry point for BOTH the in-app approve
 *     control and the Tasks inbox.
 *
 * CONNECTS TO:
 *   READS:  Journal Entry Batches · Accounting Company Profiles · Task Links · Task Decisions
 *           · Task Decision Outcomes · Task Types
 *   WRITES (via TaskOrchestrationService): Tasks · Task Links · Task Assignments · Task Decisions
 *   ENTITY (gated): 'MJ_BizApps_Accounting: Journal Entry Batches'
 *   DOC:    BatchingEngine.ts (BatchApprovalGate seam) · plan §S1 (CFO-approval workflow gate)
 */
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
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

/** The Person entity that approver assignments reference (the polymorphic assignee entity). */
const PERSON_ENTITY = 'MJ_BizApps_Common: People';

/** Terminal outcomes that count as "approved to send". */
const APPROVED_OUTCOME_CODES: ReadonlySet<TaskDecisionOutcomeCode> = new Set(['Approved', 'ApprovedWithConditions']);

/**
 * Real CFO-approval gate, backed by bizapps-tasks. Stateless — one instance can serve every batch.
 * Resolve the Person EntityID once (lazily) so assignments name the right polymorphic assignee entity.
 */
export class TasksAppApprovalGate implements BatchApprovalGate {
  private readonly orchestration = new TaskOrchestrationService();

  /** Build the approval Task when a batch is built. Throws if no CFO is configured for the company. */
  async onBatchBuilt(batchId: string, contextUser: UserInfo): Promise<void> {
    const batch = await this.loadBatch(batchId, contextUser);
    const cfoPersonId = await this.resolveCFOPersonId(batch.CompanyID, contextUser);
    const typeId = await this.resolveApprovalTaskTypeId(contextUser);
    // Task Link's EntityID / assignee EntityID are UUID FKs to __mj.Entity.ID — resolve names → IDs.
    const batchEntityId = this.batchEntityId();
    const personEntityId = this.resolvePersonEntityId();
    await this.orchestration.CreateApprovalRequest({
      Name: `Approve JE Batch #${batch.BatchNumber}`,
      TypeID: typeId,
      Description: `CFO approval required to dispatch JE Batch #${batch.BatchNumber} to ${batch.TargetSystem}.`,
      Priority: 'High',
      LinkEntityID: batchEntityId,
      LinkRecordID: batchId,
      ApproverPersonEntityID: personEntityId,
      ApproverPersonRecordIDs: [cfoPersonId],
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
    const md = new Metadata();
    const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
    if (!(await batch.Load(batchId))) throw new Error(`TasksAppApprovalGate: batch ${batchId} not found`);
    return batch;
  }

  /** The company's CFO, per AccountingCompanyProfile.ApprovalCFOPersonID. Hard-fail when unset (no role fallback). */
  private async resolveCFOPersonId(companyId: string, contextUser: UserInfo): Promise<string> {
    const md = new Metadata();
    const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, contextUser);
    if (!(await acp.Load(companyId))) throw new Error(`TasksAppApprovalGate: no AccountingCompanyProfile for company ${companyId}`);
    const cfo = acp.ApprovalCFOPersonID;
    if (!cfo) {
      throw new Error(`No CFO configured for company ${companyId}; set AccountingCompanyProfile.ApprovalCFOPersonID before batching for approval.`);
    }
    return cfo;
  }

  private async resolveApprovalTaskTypeId(contextUser: UserInfo): Promise<string> {
    const rv = new RunView();
    const res = await rv.RunView<mjBizAppsTasksTaskTypeEntity>(
      { EntityName: TASK_TYPE_ENTITY, ExtraFilter: `Name='${APPROVAL_REQUEST_TASK_TYPE.replace(/'/g, "''")}'`, MaxRows: 1, ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    const type = res.Results?.[0];
    if (!res.Success || !type) throw new Error(`TasksAppApprovalGate: TaskType '${APPROVAL_REQUEST_TASK_TYPE}' not found (is bizapps-tasks metadata seeded?)`);
    return type.ID;
  }

  private resolvePersonEntityId(): string {
    const md = new Metadata();
    const entity = md.EntityByName(PERSON_ENTITY);
    if (!entity) throw new Error(`TasksAppApprovalGate: entity '${PERSON_ENTITY}' not found in metadata`);
    return entity.ID;
  }

  /** The (single) approval Task linked to this batch via a polymorphic Task Link. */
  private async resolveBatchTask(batchId: string, contextUser: UserInfo): Promise<mjBizAppsTasksTaskEntity | null> {
    const batchEntityId = this.batchEntityId();
    const rv = new RunView();
    const linkRes = await rv.RunView<mjBizAppsTasksTaskLinkEntity>(
      { EntityName: TASK_LINK_ENTITY, ExtraFilter: `EntityID='${batchEntityId}' AND RecordID='${batchId}'`, OrderBy: '__mj_CreatedAt DESC', ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    const link = linkRes.Results?.[0];
    if (!link) return null;
    const md = new Metadata();
    const task = await md.GetEntityObject<mjBizAppsTasksTaskEntity>('MJ_BizApps_Tasks: Tasks', contextUser);
    return (await task.Load(link.TaskID)) ? task : null;
  }

  /** Resolve the Journal Entry Batches EntityID for Task Link filtering. */
  private batchEntityId(): string {
    const md = new Metadata();
    const entity = md.EntityByName(BATCH_ENTITY);
    if (!entity) throw new Error(`TasksAppApprovalGate: entity '${BATCH_ENTITY}' not found in metadata`);
    return entity.ID;
  }

  /** True when the Task has at least one terminal decision whose outcome code is Approved/ApprovedWithConditions. */
  private async hasApprovedDecision(taskId: string, contextUser: UserInfo): Promise<boolean> {
    const rv = new RunView();
    const decRes = await rv.RunView<mjBizAppsTasksTaskDecisionEntity>(
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
    const rv = new RunView();
    const res = await rv.RunView<mjBizAppsTasksTaskDecisionOutcomeEntity>(
      { EntityName: TASK_DECISION_OUTCOME_ENTITY, ExtraFilter: `IsTerminal=1`, ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    return (res.Results ?? [])
      .filter(o => APPROVED_OUTCOME_CODES.has(o.Code as TaskDecisionOutcomeCode))
      .map(o => o.ID);
  }
}
