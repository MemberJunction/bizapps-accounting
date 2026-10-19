/**
 * TasksAppApprovalGate — the REAL CFO approval gate for JE-batch dispatch (Block 2 completion).
 *
 * Replaces the placeholder AutoApproveGate in production. It backs the JournalEntryBatchApprovalGate seam
 * (JournalEntryBatchEngine.ts) with the bizapps-tasks app so a JE batch can only be sent once a CFO has
 * recorded a terminal Approved / ApprovedWithConditions decision against the linked approval Task.
 *
 *   onBatchBuilt(batchId): batches are SINGLE-COMPANY (D7) — resolve the batch's CompanyID →
 *     that company's AccountingCompanyProfile.ApprovalCFOUserID (a __mj.User), then that user's
 *     active linked Person. If either is missing, HARD-FAIL (per the per-company-field decision —
 *     no role fallback). Then CreateApprovalRequest ONE "Approve JE Batch #<JournalEntryBatchNumber>
 *     (posting date <day>)" Task linked to the batch (polymorphic Task Link), assigned to the CFO's
 *     Person (#387). The Tasks app lists a viewer's tasks by their Person, so a task assigned to
 *     the User record reached no one's inbox.
 *   assertApproved(batchId): load the Task named by the batch's stamped ApprovalTaskID (not a Task
 *     Link, which anyone with tasks-app write access can create); require a terminal Approved /
 *     ApprovedWithConditions Task Decision; otherwise THROW (blocks the send). Fails closed when
 *     ApprovalTaskID is empty.
 *   recordDecision(batchId, outcome, decidedByPersonId, notes): resolve the batch's Task and record
 *     the decision via TaskOrchestrationService. The shared entry point for BOTH the in-app approve
 *     control and the Tasks inbox.
 *   isRejected(batchId) (#233): whether the batch's Task carries a terminal rejection, which
 *     recordDecision writes before a rejected Pending batch is cancelled.
 *   assertMayCancelPending(batchId) (golive #302): a Pending batch nobody rejected may be cancelled by
 *     the company's CFO or by the user who built it; recordCancellation then comments on its
 *     approval Task and closes it.
 *   assertMayCancelApproved(batchId) / recordCancellation(batchId, cancellation) (#183): only the company's
 *     CFO or the batch's recorded approver may cancel a batch past approval, and the cancel is
 *     written to the approval Task as a comment, so the approver's record shows what became of it.
 *     The comment needs the canceller's linked Person, so the authorization refuses a cancel
 *     without one before any work starts (#212).
 *
 * PROVIDER: the gate is a plain helper with no provider of its own, so the correct
 * IMetadataProvider is INJECTED at construction — required, no global fallback (the system
 * uses the right provider through correct retrieval or injection only). Resolvers construct
 * it with the per-request provider (GetReadWriteProvider).
 *
 * CONNECTS TO:
 *   READS:  Journal Entry Batches · Accounting Company Profiles · Task Links · Task Decisions
 *           · Task Decision Outcomes · Task Types · People · Users (the CFO's People link)
 *   WRITES (via TaskOrchestrationService): Tasks · Task Links · Task Assignments · Task Decisions
 *   WRITES (directly): Task Comments (a cancelled batch) · Tasks (Status, closing a Pending batch's Task)
 *   ENTITY (gated): 'MJ_BizApps_Accounting: Journal Entry Batches'
 *   DOC:    JournalEntryBatchEngine.ts (JournalEntryBatchApprovalGate seam) · plan §S1 (CFO-approval workflow gate)
 */
import { IMetadataProvider, IRunViewProvider, UserInfo } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';
import {
  IsApprovalOutcome,
  IsTaskDecisionOutcomeCode,
  TaskOrchestrationService,
  type TaskDecisionOutcomeCode,
} from '@mj-biz-apps/tasks-core';
import type {
  mjBizAppsTasksTaskCommentEntity,
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
import type { JournalEntryBatchApprovalGate, JournalEntryBatchCancelGate, RecordedCancellation } from './JournalEntryBatchEngine.js';
import { ResolvePersonIDsForUsers } from './person-user-link.js';
import { requireSqlGuid, sqlGuidLiteral } from './SqlGuards.js';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const TASK_TYPE_ENTITY = 'MJ_BizApps_Tasks: Task Types';
const TASK_LINK_ENTITY = 'MJ_BizApps_Tasks: Task Links';
const TASK_DECISION_ENTITY = 'MJ_BizApps_Tasks: Task Decisions';
const TASK_DECISION_OUTCOME_ENTITY = 'MJ_BizApps_Tasks: Task Decision Outcomes';
const TASK_COMMENT_ENTITY = 'MJ_BizApps_Tasks: Task Comments';
const PERSON_ENTITY = 'MJ_BizApps_Common: People';

/** The seeded generic approval TaskType that CreateApprovalRequest expects. */
const APPROVAL_REQUEST_TASK_TYPE = 'Approval Request';

// Which terminal outcomes count as "approved to send" is tasks-core's answer, asked per row via
// IsApprovalOutcome. It used to be a Set literal here. A Set of a subset of the union is a
// perfectly legal value, so widening the union upstream produced no error and no warning — a new
// approving outcome would simply have stopped counting as approved, and the batch would never send.

/**
 * Real CFO-approval gate, backed by bizapps-tasks. Stateless — one instance can serve every batch.
 * The correct IMetadataProvider is injected at construction (required; no global fallback).
 */
export class TasksAppApprovalGate implements JournalEntryBatchApprovalGate, JournalEntryBatchCancelGate {
  private readonly orchestration = new TaskOrchestrationService();

  constructor(private readonly provider: IMetadataProvider) {
    if (!provider) throw new Error('The batch approval gate was created without a database provider; the calling code must pass one.');
  }

  /** The injected provider viewed through its RunView interface. */
  private get viewProvider(): IRunViewProvider {
    return this.provider as unknown as IRunViewProvider;
  }

  /**
   * PRECONDITION (D10 rev. 2026-07-29): run by the engine BEFORE any batch write. A company with
   * no configured CFO, or whose CFO has no linked Person, could never have its batch approved from
   * the Tasks app, so the build fails fast, before a row exists.
   */
  async assertCanRaise(companyId: string, contextUser: UserInfo): Promise<void> {
    await this.resolveCFOPersonIdForCompany(companyId, contextUser);
  }

  /**
   * Build the approval Task when a batch is built and return its ID (stamped onto
   * `JournalEntryBatch.ApprovalTaskID` by the engine, inside the same build transaction —
   * D10 rev. 2026-07-29). Throws if the batch's company lacks a CFO.
   */
  async onBatchBuilt(batchId: string, contextUser: UserInfo): Promise<string | null> {
    const batch = await this.loadBatch(batchId, contextUser);
    const cfoPersonId = await this.resolveCFOPersonIdForCompany(batch.CompanyID, contextUser);
    const typeId = await this.resolveApprovalTaskTypeId(contextUser);
    // Task Link's EntityID / assignee EntityID are UUID FKs to __mj.Entity.ID — resolve names → IDs.
    const batchEntityId = this.batchEntityId();
    const personEntityId = this.personEntityId();
    // The posting date is the journal date the ERP receives, so the approver approves it too (golive #315).
    const postingDay = ToCalendarDay(batch.PostingDate);
    await this.orchestration.CreateApprovalRequest({
      Name: `Approve Journal Entry Batch #${batch.JournalEntryBatchNumber} (posting date ${postingDay})`,
      TypeID: typeId,
      Description: `CFO approval required to dispatch Journal Entry Batch #${batch.JournalEntryBatchNumber} to ${batch.TargetSystem}, ` +
        `posting date ${postingDay} — the journal date ${batch.TargetSystem} receives.`,
      Priority: 'High',
      LinkEntityID: batchEntityId,
      LinkRecordID: batchId,
      ApproverPersonEntityID: personEntityId,
      ApproverPersonRecordIDs: [cfoPersonId],
    }, contextUser);
    // CreateApprovalRequest logs (not throws) on a failed link — verify the link actually persisted,
    // else assertApproved would block the send forever with no recoverable signal. (This read runs
    // on the same provider as the open build transaction, so it sees the uncommitted Task.)
    const task = await this.resolveBatchTask(batchId, contextUser);
    if (!task) {
      throw new Error(`The approval task for batch ${batchId} was created, but its link to the batch was not saved. Check the Tasks app setup and permissions.`);
    }
    // Hand the ID back so the engine stamps JournalEntryBatch.ApprovalTaskID in the build
    // transaction — "does this batch have a task?" becomes a column read, not a Task-Link walk.
    return task.ID;
  }

  /** Block the send unless the batch's Task carries a terminal Approved/ApprovedWithConditions decision. */
  async assertApproved(batchId: string, contextUser: UserInfo): Promise<void> {
    // SECURITY: resolve the approval Task from the batch's STAMPED ApprovalTaskID column, not
    // from the newest Task Link. Task Links are writable through the ordinary tasks-app surface,
    // so a user who can create a Task + Task Link could otherwise point a newer link at this
    // batch, self-approve their own Task, and have the newest-link lookup resolve to it —
    // forging approval and dispatching real journal lines to the ERP. The engine stamps
    // ApprovalTaskID inside the build transaction, so a legitimately-built batch always has it;
    // a missing value fails closed.
    const task = await this.resolveStampedApprovalTask(batchId, contextUser);
    if (!task) throw new Error(`Batch ${batchId} cannot be sent: it has no approval task, so it was not built through the approval process.`);
    if (!(await this.hasTerminalDecision(task.ID, 'Approval', contextUser))) {
      throw new Error(`Batch ${batchId} is not approved yet: its approval task has no Approved decision.`);
    }
  }

  /** Load the approval Task named by the batch's own ApprovalTaskID column (fails closed on null). */
  private async resolveStampedApprovalTask(batchId: string, contextUser: UserInfo): Promise<mjBizAppsTasksTaskEntity | null> {
    requireSqlGuid(batchId, 'TasksAppApprovalGate.resolveStampedApprovalTask');
    const batch = await this.provider.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
    if (!(await batch.Load(batchId)) || !batch.ApprovalTaskID) return null;
    const task = await this.provider.GetEntityObject<mjBizAppsTasksTaskEntity>('MJ_BizApps_Tasks: Tasks', contextUser);
    return (await task.Load(batch.ApprovalTaskID)) ? task : null;
  }

  /**
   * True when the batch's Task carries a terminal rejection (#233). A rejected Pending batch is
   * cancelled on the CFO's recorded decision; one nobody rejected goes through assertMayCancelPending.
   *
   * SECURITY (#223): the Task comes from the batch's stamped ApprovalTaskID, as in assertApproved — never
   * the newest Task Link, which a newer link to a self-rejected Task could redirect.
   */
  async isRejected(batchId: string, contextUser: UserInfo): Promise<boolean> {
    const task = await this.resolveStampedApprovalTask(batchId, contextUser);
    return !!task && (await this.hasTerminalDecision(task.ID, 'Rejection', contextUser));
  }

  /**
   * Record an approve/reject decision on the batch's Task. Used by the in-app control AND the Tasks inbox.
   *
   * AUTHORIZATION (2026-09-05 security sweep): a decision is only accepted from the company's
   * configured approver — `contextUser` must BE the batch company's
   * `AccountingCompanyProfile.ApprovalCFOUserID`. Without this, any authenticated user (including
   * whoever built the batch) could approve their own batch. The gate is the shared entry point for
   * every decision path, so the check lives here rather than in each caller. A company with no
   * configured CFO rejects loudly (resolveCFOUserIdForCompany hard-fails) — never "anyone may approve".
   *
   * SEPARATION OF DUTIES: being the configured CFO is necessary but not sufficient — the caller must
   * also not be the person who built the batch (`JournalEntryBatch.BatchedByUserID`, NOT NULL, stamped
   * by JournalEntryBatchEngine at build time). A CFO who batches entries themselves would otherwise
   * satisfy the identity gate above and self-approve a dispatch of real journal lines to the ERP.
   */
  async recordDecision(
    batchId: string, outcome: TaskDecisionOutcomeCode, decidedByPersonId: string | undefined, notes: string | undefined, contextUser: UserInfo,
  ): Promise<void> {
    const batch = await this.loadBatch(batchId, contextUser);
    const cfoUserId = await this.resolveCFOUserIdForCompany(batch.CompanyID, contextUser);
    if (!UUIDsEqual(cfoUserId, contextUser.ID)) {
      throw new Error(
        `Batch ${batch.JournalEntryBatchNumber ?? batchId}: only the configured approver for company ${batch.CompanyID} ` +
        `(the Approval CFO on its Accounting Company Profile) can approve or reject it, and you are not that approver.`,
      );
    }
    if (UUIDsEqual(contextUser.ID, batch.BatchedByUserID)) {
      throw new Error(
        `Batch ${batch.JournalEntryBatchNumber ?? batchId}: the user who built a batch may not approve it. ` +
        `Someone other than the builder must approve it.`,
      );
    }
    const task = await this.resolveBatchTask(batchId, contextUser);
    if (!task) throw new Error(`Batch ${batchId} has no approval Task to record a decision against.`);
    await this.orchestration.RecordDecision({ TaskID: task.ID, OutcomeCode: outcome, DecidedByPersonID: decidedByPersonId, Notes: notes }, contextUser);
  }

  /**
   * Who may cancel a batch past approval (#183): the company's configured CFO, or the user recorded
   * as the batch's approver. Cancelling discards a summary that one of them signed and returns its
   * entries to the next build, so it is theirs to decide — before this, the only cancel path was a
   * CFO rejection through recordDecision. Unlike recordDecision this does not hard-fail when no CFO
   * is configured, because the recorded approver is enough.
   *
   * It also refuses an authorized user who has no linked Person when the batch has a stamped approval Task
   * (#212): recordCancellation writes the cancel there as a TaskComment, which requires a Person.
   * Checked here, the refusal comes before the ERP lookup and the member release instead of rolling
   * them back. Authorization is checked first, so a user who may not cancel learns only that.
   */
  async assertMayCancelApproved(batchId: string, contextUser: UserInfo): Promise<void> {
    const batch = await this.loadBatch(batchId, contextUser);
    const cfoUserId = await this.readCFOUserIdForCompany(batch.CompanyID, contextUser);
    const allowed = [cfoUserId, batch.ApprovedByUserID].filter((id): id is string => !!id);
    if (!allowed.some(id => UUIDsEqual(id, contextUser.ID))) {
      throw new Error(
        `Batch ${batch.JournalEntryBatchNumber ?? batchId}: only the company's configured approver ` +
        `(the Approval CFO on its Accounting Company Profile) or the user who approved this batch may cancel it after approval.`,
      );
    }
    // Same condition recordCancellation uses (#223): the stamped ApprovalTaskID, not a Task Link.
    if (!batch.ApprovalTaskID) return;
    if (!(await this.resolvePersonIdForUser(contextUser))) throw this.noLinkedPersonError(batch, contextUser);
  }

  /**
   * Who may cancel a Pending batch nobody rejected (golive #302): the company's configured CFO, or
   * the user who built it (`BatchedByUserID`). Nothing has been approved or sent, so the builder may
   * undo a wrong batch; the cancel returns its entries to the next build. Like
   * assertMayCancelApproved it does not hard-fail when no CFO is configured, and it refuses a user
   * with no linked Person when the batch has a stamped approval Task, because recordCancellation
   * comments on that Task as the user's Person.
   */
  async assertMayCancelPending(batchId: string, contextUser: UserInfo): Promise<void> {
    const batch = await this.loadBatch(batchId, contextUser);
    const cfoUserId = await this.readCFOUserIdForCompany(batch.CompanyID, contextUser);
    const allowed = [cfoUserId, batch.BatchedByUserID].filter((id): id is string => !!id);
    if (!allowed.some(id => UUIDsEqual(id, contextUser.ID))) {
      throw new Error(
        `Batch ${batch.JournalEntryBatchNumber ?? batchId}: only the company's configured approver ` +
        `(the Approval CFO on its Accounting Company Profile) or the user who built this batch may cancel it before approval.`,
      );
    }
    // Same condition recordCancellation uses (#223): the stamped ApprovalTaskID, not a Task Link.
    if (!batch.ApprovalTaskID) return;
    if (!(await this.resolvePersonIdForUser(contextUser))) throw this.noLinkedPersonError(batch, contextUser);
  }

  /**
   * Record a cancel on the batch's approval Task, as a comment by the cancelling user's Person.
   * Past approval the Task keeps its approved decision — the comment is what tells the approver the
   * batch they signed was cancelled, and why. Before approval (golive #302) the Task is also closed
   * as Cancelled, so the approver's inbox no longer asks for a decision on a batch that is gone; no
   * decision is recorded, because the approver made none. A batch with no stamped approval Task has
   * nothing to annotate. Refuses when the stamped Task does not load. The authorizing assert has
   * already refused a user with no linked Person; this refuses again in case the link was removed
   * since, and the caller runs this inside the cancel's transaction, so the cancel rolls back rather
   * than going unrecorded.
   *
   * SECURITY (#223): the Task comes from the batch's stamped ApprovalTaskID, never the newest Task
   * Link — Task Links are writable through the tasks-app surface, so a forged newer link would
   * otherwise redirect the comment (or the close) to another Task, or suppress it.
   */
  async recordCancellation(batchId: string, cancellation: RecordedCancellation, contextUser: UserInfo): Promise<void> {
    const batch = await this.loadBatch(batchId, contextUser);
    if (!batch.ApprovalTaskID) return;
    const task = await this.provider.GetEntityObject<mjBizAppsTasksTaskEntity>('MJ_BizApps_Tasks: Tasks', contextUser);
    if (!(await task.Load(batch.ApprovalTaskID))) {
      throw new Error(`Batch ${batch.JournalEntryBatchNumber ?? batchId}: the cancel cannot be recorded because its approval Task ${batch.ApprovalTaskID} did not load.`);
    }
    const personId = await this.resolvePersonIdForUser(contextUser);
    if (!personId) throw this.noLinkedPersonError(batch, contextUser);
    const beforeApproval = cancellation.fromStatus === 'Pending';
    const comment = await this.provider.GetEntityObject<mjBizAppsTasksTaskCommentEntity>(TASK_COMMENT_ENTITY, contextUser);
    comment.NewRecord();
    comment.TaskID = task.ID;
    comment.PersonID = personId;
    // The prior status comes from the caller: this runs after the cancel was saved, so the batch
    // loaded above already reads Cancelled.
    comment.Content = (beforeApproval
      ? `Journal entry batch ${batch.JournalEntryBatchNumber} was cancelled before approval, so this approval request is closed. `
      : `Journal entry batch ${batch.JournalEntryBatchNumber} was cancelled after approval (it was ${cancellation.fromStatus}). `) +
      `Its journal entries return to the next build. Reason: ${cancellation.reason.trim()}` +
      (cancellation.erpCheck ? ` ERP check: ${cancellation.erpCheck}` : '');
    if (!(await comment.Save())) {
      throw new Error(`Batch ${batch.JournalEntryBatchNumber ?? batchId}: recording the cancel on its approval Task failed: ${comment.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
    if (beforeApproval && task.Status !== 'Cancelled') {
      task.Status = 'Cancelled';
      if (!(await task.Save())) {
        throw new Error(`Batch ${batch.JournalEntryBatchNumber ?? batchId}: closing its approval Task failed: ${task.LatestResult?.CompleteMessage ?? 'unknown'}`);
      }
    }
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  /** Why a cancel past approval is refused for a user with no linked Person (#212). */
  private noLinkedPersonError(batch: mjBizAppsAccountingJournalEntryBatchEntity, contextUser: UserInfo): Error {
    return new Error(
      `Batch ${batch.JournalEntryBatchNumber ?? batch.ID}: the cancel cannot be recorded on its approval Task because user ` +
      `${contextUser.Email ?? contextUser.ID} has no linked Person record. ` +
      'An administrator must link this user to a Person before the batch can be cancelled.',
    );
  }

  /** The company's CFO User, or null when none is configured (no hard-fail — see assertMayCancelApproved). */
  private async readCFOUserIdForCompany(companyId: string, contextUser: UserInfo): Promise<string | null> {
    const acp = await this.provider.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, contextUser);
    if (!(await acp.Load(companyId))) return null;
    return acp.ApprovalCFOUserID ?? null;
  }

  /** The bizapps-common Person linked to this MJ user (Person.LinkedUserID), or null. */
  private async resolvePersonIdForUser(contextUser: UserInfo): Promise<string | null> {
    const res = await this.viewProvider.RunView<{ ID: string }>(
      { EntityName: PERSON_ENTITY, ExtraFilter: `LinkedUserID=${sqlGuidLiteral(contextUser.ID, 'TasksAppApprovalGate.resolvePersonIdForUser')}`, Fields: ['ID'], MaxRows: 1, ResultType: 'simple', BypassCache: true },
      contextUser,
    );
    if (!res.Success) throw new Error(`Could not look up the person linked to the current user: ${res.ErrorMessage ?? 'unknown error'}`);
    return res.Results?.[0]?.ID ?? null;
  }

  private async loadBatch(batchId: string, contextUser: UserInfo): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
    const batch = await this.provider.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
    if (!(await batch.Load(batchId))) throw new Error(`Batch ${batchId} was not found.`);
    return batch;
  }

  /**
   * The CFO User of a company (batches are single-company, D7 — the header carries CompanyID).
   * Hard-fail when the company lacks a configured CFO. Shared by `recordDecision` and, through
   * `resolveCFOPersonIdForCompany`, by the pre-write `assertCanRaise` precondition and the
   * in-transaction `onBatchBuilt`.
   */
  private async resolveCFOUserIdForCompany(companyId: string, contextUser: UserInfo): Promise<string> {
    const acp = await this.provider.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, contextUser);
    if (!(await acp.Load(companyId))) throw new Error(`Company ${companyId} has no Accounting Company Profile, so its batch approver cannot be found.`);
    const cfo = acp.ApprovalCFOUserID;
    if (!cfo) {
      throw new Error(`No CFO configured for company ${companyId}. Set the Approval CFO on the company's Accounting Company Profile before building batches for approval.`);
    }
    return cfo;
  }

  /**
   * The CFO's active linked Person: the user's own People link first, else People.LinkedUserID, the
   * same rule the Tasks app uses to find the signed-in user's tasks. The approval Task is assigned to
   * this Person, so a CFO without one would never see it; refuse instead.
   */
  private async resolveCFOPersonIdForCompany(companyId: string, contextUser: UserInfo): Promise<string> {
    const cfoUserId = await this.resolveCFOUserIdForCompany(companyId, contextUser);
    let found: Map<string, string>;
    try {
      found = await ResolvePersonIDsForUsers([cfoUserId], this.provider, contextUser, { ActiveOnly: true });
    } catch (error) {
      throw new Error(`Could not look up the Person linked to the Approval CFO of company ${companyId}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const personId = found.get(cfoUserId.toLowerCase());
    if (!personId) {
      throw new Error(
        `The Approval CFO on company ${companyId}'s Accounting Company Profile (user ${cfoUserId}) is not linked to an active Person, ` +
        `so the batch's approval task would not appear in anyone's Tasks inbox. An administrator must link that user to a Person before batches are built for approval.`,
      );
    }
    return personId;
  }

  private async resolveApprovalTaskTypeId(contextUser: UserInfo): Promise<string> {
    const res = await this.viewProvider.RunView<mjBizAppsTasksTaskTypeEntity>(
      { EntityName: TASK_TYPE_ENTITY, ExtraFilter: `Name='${APPROVAL_REQUEST_TASK_TYPE.replace(/'/g, "''")}'`, MaxRows: 1, ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    const type = res.Results?.[0];
    if (!res.Success || !type) throw new Error(`The '${APPROVAL_REQUEST_TASK_TYPE}' task type is not set up, so no approval task can be raised. Make sure the Tasks app metadata is installed.`);
    return type.ID;
  }

  /** The People EntityID, the assignee entity of the approval Task (#387). */
  private personEntityId(): string {
    const entity = this.provider.EntityByName(PERSON_ENTITY);
    if (!entity) throw new Error(`The '${PERSON_ENTITY}' entity is missing from the metadata, so the approval task cannot be assigned.`);
    return entity.ID;
  }

  /** The (single) approval Task linked to this batch via a polymorphic Task Link. */
  private async resolveBatchTask(batchId: string, contextUser: UserInfo): Promise<mjBizAppsTasksTaskEntity | null> {
    // batchId can arrive raw from a remote caller and is interpolated into the filter below —
    // validate, don't escape (a batch id is always a UUID; anything else is refused).
    requireSqlGuid(batchId, 'TasksAppApprovalGate.resolveBatchTask');
    const batchEntityId = this.batchEntityId();
    const linkRes = await this.viewProvider.RunView<mjBizAppsTasksTaskLinkEntity>(
      { EntityName: TASK_LINK_ENTITY, ExtraFilter: `EntityID='${batchEntityId}' AND RecordID='${batchId}'`, OrderBy: '__mj_CreatedAt DESC', ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    const link = linkRes.Results?.[0];
    if (!link) return null;
    const task = await this.provider.GetEntityObject<mjBizAppsTasksTaskEntity>('MJ_BizApps_Tasks: Tasks', contextUser);
    return (await task.Load(link.TaskID)) ? task : null;
  }

  /** Resolve the Journal Entry Batches EntityID for Task Link filtering. */
  private batchEntityId(): string {
    const entity = this.provider.EntityByName(BATCH_ENTITY);
    if (!entity) throw new Error(`The '${BATCH_ENTITY}' entity is missing from the metadata, so the approval task cannot be linked.`);
    return entity.ID;
  }

  /**
   * True when the Task has at least one terminal decision of the given kind: an approval
   * (Approved/ApprovedWithConditions) or a rejection (any other terminal outcome).
   * WHO decided is enforced at the WRITE (recordDecision requires contextUser to be the company's
   * ApprovalCFOUserID); this read deliberately stays "any terminal decision of that kind on the task"
   * because decisions can legitimately carry no DecidedByPersonID (an approver User with no linked Person).
   */
  private async hasTerminalDecision(taskId: string, kind: 'Approval' | 'Rejection', contextUser: UserInfo): Promise<boolean> {
    requireSqlGuid(taskId, 'TasksAppApprovalGate.hasTerminalDecision');
    const decRes = await this.viewProvider.RunView<mjBizAppsTasksTaskDecisionEntity>(
      { EntityName: TASK_DECISION_ENTITY, ExtraFilter: `TaskID='${taskId}'`, ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    const decisions = decRes.Results ?? [];
    if (decisions.length === 0) return false;
    const outcomes = await this.loadTerminalOutcomeIds(kind, contextUser);
    return decisions.some(d => outcomes.some(oid => UUIDsEqual(oid, d.OutcomeID)));
  }

  /** The terminal TaskDecisionOutcome IDs that are an approval, or that are not (a rejection). */
  private async loadTerminalOutcomeIds(kind: 'Approval' | 'Rejection', contextUser: UserInfo): Promise<string[]> {
    const res = await this.viewProvider.RunView<mjBizAppsTasksTaskDecisionOutcomeEntity>(
      { EntityName: TASK_DECISION_OUTCOME_ENTITY, ExtraFilter: `IsTerminal=1`, ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    return (res.Results ?? [])
      .filter(o => IsTaskDecisionOutcomeCode(o.Code) && IsApprovalOutcome(o.Code) === (kind === 'Approval'))
      .map(o => o.ID);
  }
}
