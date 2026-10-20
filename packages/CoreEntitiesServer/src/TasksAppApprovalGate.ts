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
 *     ApprovedWithConditions Task Decision made by an allowed decider — the company's CFO, who did not
 *     build the batch (golive #320 §3; a decision saved straight into the tasks app by anyone else does
 *     not count); otherwise THROW (blocks the send). Fails closed when ApprovalTaskID is empty.
 *     The Task records the batch's builder as its creator (CreatedByPersonID).
 *     It also requires the batch's recorded approver (written only by the approval, #447), not its
 *     builder, and an approval on the Task not attributed to anyone else (#446).
 *   recordDecision(batchId, outcome, decidedByPersonId, notes): record the decision on the batch's
 *     stamped approval Task via TaskOrchestrationService (#313). The shared entry point for BOTH the in-app approve
 *     control and the Tasks inbox. It refuses first, writing nothing, when the batch is no longer
 *     Pending (#306) or a rejection's notes would not fit the batch's CancelReason (#307).
 *   isRejected(batchId) (#233): whether the batch's Task carries a terminal rejection, which
 *     recordDecision writes before a rejected Pending batch is cancelled.
 *   assertMayCancelPending(batchId) (golive #302): a Pending batch nobody rejected may be cancelled by
 *     the company's CFO or by the user who built it; recordCancellation then closes its approval
 *     Task, with a comment when the canceller has a linked Person (golive #325).
 *   assertMayCancelApproved(batchId) / recordCancellation(batchId, cancellation) (#183): only the company's
 *     CFO or the batch's recorded approver may cancel a batch past approval, and the cancel is
 *     written to the approval Task as a comment, so the approver's record shows what became of it.
 *     The comment needs the canceller's linked Person, so the authorization refuses a cancel
 *     without one before any work starts (#212).
 *   assertMayArchive(batchId) (#448): who may archive: before approval only the company's CFO; past
 *     approval the CFO or the batch's approver, as for a cancel.
 *   recordArchive(batchId, archive) (golive #325): an archive is recorded on the approval Task the
 *     same way as a cancel, so archiving no longer leaves the Task open.
 *
 * PROVIDER: the gate is a plain helper with no provider of its own, so the correct
 * IMetadataProvider is INJECTED at construction — required, no global fallback (the system
 * uses the right provider through correct retrieval or injection only). Resolvers construct
 * it with the per-request provider (GetReadWriteProvider).
 *
 * CONNECTS TO:
 *   READS:  Journal Entry Batches · Accounting Company Profiles · Task Links · Task Decisions
 *           · Task Decision Outcomes · Task Types · People · Users (the CFO's, builder's and deciders'
 *           People links, through person-user-link.ts)
 *   WRITES (via TaskOrchestrationService): Tasks · Task Links · Task Assignments · Task Decisions
 *   WRITES (directly): Task Comments (a cancelled or archived batch) · Tasks (Status, closing a Pending batch's Task)
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
import type { JournalEntryBatchApprovalGate, JournalEntryBatchCancelGate, RecordedArchive, RecordedCancellation } from './JournalEntryBatchEngine.js';
import { ResolveAllPersonIDsForUser, ResolvePersonIDForUser, ResolvePersonIDsForUsers, ResolveUserIDsForPeople } from './person-user-link.js';
import { requireSqlGuid } from './SqlGuards.js';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const TASK_TYPE_ENTITY = 'MJ_BizApps_Tasks: Task Types';
const TASK_LINK_ENTITY = 'MJ_BizApps_Tasks: Task Links';
const TASK_DECISION_ENTITY = 'MJ_BizApps_Tasks: Task Decisions';
const TASK_DECISION_OUTCOME_ENTITY = 'MJ_BizApps_Tasks: Task Decision Outcomes';
const TASK_COMMENT_ENTITY = 'MJ_BizApps_Tasks: Task Comments';
const PERSON_ENTITY = 'MJ_BizApps_Common: People';

/** What closed a batch, for the approval Task's comment and errors. */
type BatchCloseAction = 'cancel' | 'archive';

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
    // The builder is the requester (golive #320 §3): recorded as the Task's creator, so the tasks app's
    // PreventSelfApproval setting (bizapps-tasks#136, not yet released, ships off) can refuse them a
    // decision on it once it is released and enabled. ResolvePersonIDsForUsers gives the one Person the
    // tasks app resolves for the builder (own People link, else LinkedUserID), the same rule as the
    // CFO's assignee above. A builder with no Person leaves it blank.
    const builderPersonId = batch.BatchedByUserID ? await this.builderPersonId(batch.BatchedByUserID, contextUser) : undefined;
    await this.orchestration.CreateApprovalRequest({
      Name: `Approve Journal Entry Batch #${batch.JournalEntryBatchNumber} (posting date ${postingDay})`,
      TypeID: typeId,
      Description: `CFO approval required to dispatch Journal Entry Batch #${batch.JournalEntryBatchNumber} to ${batch.TargetSystem}, ` +
        `posting date ${postingDay} — the journal date ${batch.TargetSystem} receives.`,
      Priority: 'High',
      CreatedByPersonID: builderPersonId,
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

  /**
   * Block the send unless the batch was approved through the approval decision (#446).
   *
   * Three things must hold. The batch's stamped approval Task carries a terminal approval. The batch
   * records an approver, which only the approval writes (JournalEntryBatchEntityServer.Approve, after
   * recordDecision checked the approver; #447, #451), and that approver did not build the batch.
   * And the approval is not attributed to anyone else: Task Decisions are writable through the tasks
   * app, so a decision row made there, outside recordDecision, does not count unless its Person is the
   * recorded approver's. A decision with no Person still counts, because an approver with no linked
   * Person records one; the batch's own approver record is what binds it to the approval.
   * approvalRefusal then requires the decider to be the company's Approval CFO as configured now.
   */
  async assertApproved(batchId: string, contextUser: UserInfo): Promise<void> {
    // SECURITY: resolve the approval Task from the batch's STAMPED ApprovalTaskID column, not
    // from the newest Task Link. Task Links are writable through the ordinary tasks-app surface,
    // so a user who can create a Task + Task Link could otherwise point a newer link at this
    // batch, self-approve their own Task, and have the newest-link lookup resolve to it —
    // forging approval and dispatching real journal lines to the ERP. The engine stamps
    // ApprovalTaskID inside the build transaction, so a legitimately-built batch always has it;
    // a missing value fails closed.
    const stamped = await this.resolveStampedApprovalTask(batchId, contextUser);
    if (!stamped) throw new Error(`Batch ${batchId} cannot be sent: it has no approval task, so it was not built through the approval process.`);
    const { task, batch } = stamped;
    const approverUserId = this.recordedApprover(batch);
    const approvals = await this.terminalDecisions(task.ID, 'Approval', contextUser);
    if (approvals.length === 0) {
      throw new Error(`Batch ${batchId} is not approved yet: its approval task has no Approved decision.`);
    }
    if (!(await this.hasApprovalBy(approvals, approverUserId, contextUser))) {
      throw new Error(`Batch ${batch.JournalEntryBatchNumber ?? batchId} cannot be sent: its approval task has no Approved decision by the user recorded as its approver.`);
    }
    const refusal = await this.approvalRefusal(batch, approvals, contextUser);
    if (refusal) throw new Error(`Batch ${batch.JournalEntryBatchNumber ?? batchId} cannot be sent: ${refusal}`);
  }

  /**
   * SECURITY (golive #320 §3): why none of the approval Task's Approved decisions came from an
   * allowed decider — the company's configured CFO, who did not build the batch — or null when one
   * did. recordDecision enforces that at the write, but a decision can also be saved straight into
   * the tasks app (the Tasks inbox, or any user allowed to create a Task Decision), so the read
   * checks it too:
   *   - a decision with no Person (an approver User with no linked Person, which recordDecision
   *     permits) counts only when the batch's own approval audit names the CFO, because that is what
   *     the sanctioned approval writes (RecordJournalEntryBatchDecision → approveJournalEntryBatch,
   *     whose ApprovedByUserID JournalEntryBatchEntityServer requires to be the approving user);
   *   - a decision attributed to a Person counts only when that Person is bound to the CFO user and
   *     not to the builder. One Person can be bound to two users (the builder through
   *     People.LinkedUserID, the CFO through User.LinkedEntityRecordID), which the user-level check
   *     cannot see.
   * Each refusal names its own cause: no approver configured, the approver built the batch, the
   * approver's Person is also the builder's, or nobody allowed decided. The CFO and builder Person
   * lookups run only when a decision needs them.
   * The CFO is read as configured NOW: a batch approved by a former CFO is cancelled and rebuilt.
   */
  private async approvalRefusal(
    batch: mjBizAppsAccountingJournalEntryBatchEntity, approvals: mjBizAppsTasksTaskDecisionEntity[], contextUser: UserInfo,
  ): Promise<string | null> {
    const cfoUserId = await this.readCFOUserIdForCompany(batch.CompanyID, contextUser);
    if (!cfoUserId) {
      return `company ${batch.CompanyID} has no approver configured, so no decision on its approval task can count. ` +
        `Set the Approval CFO on the company's Accounting Company Profile.`;
    }
    if (UUIDsEqual(cfoUserId, batch.BatchedByUserID)) {
      return `the company's Approval CFO (user ${cfoUserId}) built this batch, and the user who built a batch may not approve it, ` +
        `so no decision on its approval task can count. Cancel it and have someone other than the Approval CFO build it again.`;
    }
    if (approvals.some(d => !d.DecidedByPersonID) && UUIDsEqual(batch.ApprovedByUserID, cfoUserId)) return null;
    const deciderPersonIds = approvals.map(d => d.DecidedByPersonID).filter((id): id is string => !!id);
    const among = (ids: string[], id: string): boolean => ids.some(p => UUIDsEqual(p, id));
    const cfoPersonIds = deciderPersonIds.length > 0 ? await this.personIdsForUserId(cfoUserId, contextUser) : [];
    const byCfo = deciderPersonIds.filter(id => among(cfoPersonIds, id));
    if (byCfo.length > 0) {
      const builderPersonIds = batch.BatchedByUserID ? await this.personIdsForUserId(batch.BatchedByUserID, contextUser) : [];
      if (byCfo.some(id => !among(builderPersonIds, id))) return null;
      return `its approval came from a Person linked to the company's Approval CFO (user ${cfoUserId}) who is also linked to ` +
        `the user who built the batch, and the builder may not approve their own batch. Someone other than the builder must approve it.`;
    }
    return `its approval task has an Approved decision, but not one made by the company's configured approver ` +
      `(the Approval CFO on its Accounting Company Profile, user ${cfoUserId}). A decision recorded by anyone else does not count.`;
  }

  /** The batch's recorded approver; throws when there is none, or when it is the batch's builder. */
  private recordedApprover(batch: mjBizAppsAccountingJournalEntryBatchEntity): string {
    const label = batch.JournalEntryBatchNumber ?? batch.ID;
    if (!batch.ApprovedByUserID) {
      throw new Error(`Batch ${label} cannot be sent: it records no approver, so it was never approved through the approval decision.`);
    }
    if (UUIDsEqual(batch.ApprovedByUserID, batch.BatchedByUserID)) {
      throw new Error(
        `Batch ${label} cannot be sent: its recorded approver is the user who built it, and the user who built a batch may not approve it.`,
      );
    }
    return batch.ApprovedByUserID;
  }

  /**
   * Load the approval Task named by the batch's own ApprovalTaskID column (fails closed on null),
   * with the batch it was read from, so a caller needs no second batch load.
   */
  private async resolveStampedApprovalTask(
    batchId: string, contextUser: UserInfo,
  ): Promise<{ task: mjBizAppsTasksTaskEntity; batch: mjBizAppsAccountingJournalEntryBatchEntity } | null> {
    requireSqlGuid(batchId, 'TasksAppApprovalGate.resolveStampedApprovalTask');
    const batch = await this.provider.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
    if (!(await batch.Load(batchId))) return null;
    const task = await this.loadStampedApprovalTask(batch, contextUser);
    return task ? { task, batch } : null;
  }

  /** Load the Task an already-loaded batch's ApprovalTaskID names; null when it has none or it does not load. */
  private async loadStampedApprovalTask(
    batch: mjBizAppsAccountingJournalEntryBatchEntity, contextUser: UserInfo,
  ): Promise<mjBizAppsTasksTaskEntity | null> {
    if (!batch.ApprovalTaskID) return null;
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
    const stamped = await this.resolveStampedApprovalTask(batchId, contextUser);
    return !!stamped && (await this.terminalDecisions(stamped.task.ID, 'Rejection', contextUser)).length > 0;
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
    this.assertDecidable(batch, outcome, notes);
    // SECURITY (#313): the decision lands on the batch's stamped ApprovalTaskID, as assertApproved reads
    // it — never the newest Task Link, which a forged newer link could point at another Task. A batch
    // with no stamp is refused: assertApproved could never send it, whatever was decided.
    const task = await this.loadStampedApprovalTask(batch, contextUser);
    if (!task) throw new Error(`Batch ${batch.JournalEntryBatchNumber ?? batchId} has no approval task to record the decision on, so it was not built through the approval process.`);
    await this.orchestration.RecordDecision({ TaskID: task.ID, OutcomeCode: outcome, DecidedByPersonID: decidedByPersonId, Notes: notes }, contextUser);
  }

  /**
   * Refuse a decision the batch cannot carry out, before it is written to the Task, so the Task and
   * the batch cannot disagree. The decision commits before the batch is approved or cancelled, so if
   * the batch then refused, the Task would keep an outcome the batch never took.
   *
   * - The batch must still be Pending (#306): its builder may have cancelled it while the approver had it open.
   * - A rejection's notes become the batch's CancelReason (#307), so they must fit that column. The Task's
   *   notes have no limit, so a longer note would be recorded there and then refused by the cancel.
   */
  private assertDecidable(batch: mjBizAppsAccountingJournalEntryBatchEntity, outcome: TaskDecisionOutcomeCode, notes: string | undefined): void {
    const label = batch.JournalEntryBatchNumber ?? batch.ID;
    if (batch.Status !== 'Pending') {
      throw new Error(`Batch ${label} is ${batch.Status}; a decision can be recorded only on a Pending batch.`);
    }
    if (IsApprovalOutcome(outcome)) return;
    const max = this.cancelReasonMaxLength();
    const length = notes?.trim().length ?? 0;
    if (length > max) {
      throw new Error(`Batch ${label}: a rejection's notes become the batch's cancel reason, which holds at most ${max} characters; these notes are ${length}.`);
    }
  }

  /** JournalEntryBatch.CancelReason's length, read from the entity's field metadata so it follows the column. */
  private cancelReasonMaxLength(): number {
    const max = this.provider.EntityByName(BATCH_ENTITY)?.Fields.find((f) => f.Name === 'CancelReason')?.MaxLength;
    if (!max) throw new Error(`The '${BATCH_ENTITY}' entity's CancelReason field has no length in the metadata, so a rejection's notes cannot be checked against it.`);
    return max;
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
    await this.assertMayCloseApproved(await this.loadBatch(batchId, contextUser), 'cancel', contextUser);
  }

  /**
   * Who may cancel a Pending batch nobody rejected (golive #302): the company's configured CFO, or
   * the user who built it (`BatchedByUserID`). Nothing has been approved or sent, so the builder may
   * undo a wrong batch; the cancel returns its entries to the next build. Like
   * assertMayCancelApproved it does not hard-fail when no CFO is configured. Unlike it, a user with
   * no linked Person may cancel (golive #325): nobody approved the batch, so closing its approval
   * Task is record enough, and recordCancellation skips the comment it cannot sign.
   */
  async assertMayCancelPending(batchId: string, contextUser: UserInfo): Promise<void> {
    await this.assertMayClosePending(await this.loadBatch(batchId, contextUser), 'cancel', contextUser);
  }

  /**
   * Who may archive a batch (#448). Before approval only the company's configured CFO: an archive
   * keeps the batch's entries out of every future batch for good, so the builder, who may cancel a
   * Pending batch, may not archive one. Past approval the cancel's rule: the CFO or the batch's
   * approver, who must then have a linked Person for recordArchive's comment.
   */
  async assertMayArchive(batchId: string, contextUser: UserInfo): Promise<void> {
    const batch = await this.loadBatch(batchId, contextUser);
    if (batch.Status !== 'Pending') {
      await this.assertMayCloseApproved(batch, 'archive', contextUser);
      return;
    }
    const cfoUserId = await this.readCFOUserIdForCompany(batch.CompanyID, contextUser);
    if (!cfoUserId || !UUIDsEqual(cfoUserId, contextUser.ID)) {
      throw new Error(
        `Batch ${batch.JournalEntryBatchNumber ?? batchId}: only the company's configured approver ` +
        `(the Approval CFO on its Accounting Company Profile) may archive it before approval; its builder may cancel it instead.`,
      );
    }
  }

  /** The past-approval rule behind assertMayCancelApproved and assertMayArchive. */
  private async assertMayCloseApproved(
    batch: mjBizAppsAccountingJournalEntryBatchEntity, action: BatchCloseAction, contextUser: UserInfo,
  ): Promise<void> {
    const cfoUserId = await this.readCFOUserIdForCompany(batch.CompanyID, contextUser);
    const allowed = [cfoUserId, batch.ApprovedByUserID].filter((id): id is string => !!id);
    if (!allowed.some(id => UUIDsEqual(id, contextUser.ID))) {
      throw new Error(
        `Batch ${batch.JournalEntryBatchNumber ?? batch.ID}: only the company's configured approver ` +
        `(the Approval CFO on its Accounting Company Profile) or the user who approved this batch may ${action} it after approval.`,
      );
    }
    // Same condition recordCancellation uses (#223): the stamped ApprovalTaskID, not a Task Link.
    if (!batch.ApprovalTaskID) return;
    if (!(await this.resolvePersonIdForUser(contextUser))) throw this.noLinkedPersonError(batch, contextUser, action);
  }

  /** The before-approval cancel rule behind assertMayCancelPending. */
  private async assertMayClosePending(
    batch: mjBizAppsAccountingJournalEntryBatchEntity, action: BatchCloseAction, contextUser: UserInfo,
  ): Promise<void> {
    const cfoUserId = await this.readCFOUserIdForCompany(batch.CompanyID, contextUser);
    const allowed = [cfoUserId, batch.BatchedByUserID].filter((id): id is string => !!id);
    if (!allowed.some(id => UUIDsEqual(id, contextUser.ID))) {
      throw new Error(
        `Batch ${batch.JournalEntryBatchNumber ?? batch.ID}: only the company's configured approver ` +
        `(the Approval CFO on its Accounting Company Profile) or the user who built this batch may ${action} it before approval.`,
      );
    }
  }

  /**
   * Record a cancel on the batch's approval Task, as a comment by the cancelling user's Person.
   * Past approval the Task keeps its approved decision — the comment is what tells the approver the
   * batch they signed was cancelled, and why — so a user with no linked Person is refused. The
   * authorizing assert has already refused one; this refuses again in case the link was removed
   * since, and the caller runs this inside the cancel's transaction, so the cancel rolls back rather
   * than going unrecorded. Before approval (golive #302) the Task is closed as Cancelled, so the
   * approver's inbox no longer asks for a decision on a batch that is gone; no decision is recorded,
   * because the approver made none, and the comment is skipped when the user has no linked Person
   * (golive #325). A batch with no stamped approval Task has nothing to annotate. Refuses when the
   * stamped Task does not load.
   */
  async recordCancellation(batchId: string, cancellation: RecordedCancellation, contextUser: UserInfo): Promise<void> {
    const beforeApproval = cancellation.fromStatus === 'Pending';
    await this.recordOnApprovalTask(batchId, 'cancel', beforeApproval, (batch) =>
      (beforeApproval
        ? `Journal entry batch ${batch.JournalEntryBatchNumber} was cancelled before approval, so this approval request is closed. `
        : `Journal entry batch ${batch.JournalEntryBatchNumber} was cancelled after approval (it was ${cancellation.fromStatus}). `) +
      `Its journal entries return to the next build. Reason: ${cancellation.reason.trim()}` +
      (cancellation.erpCheck ? ` ERP check: ${cancellation.erpCheck}` : ''),
    contextUser);
  }

  /**
   * Record an archive on the batch's approval Task (golive #325), by the same rules as
   * recordCancellation: before approval the Task is closed as Cancelled, with a comment when the
   * user has a linked Person; past approval the Task keeps its decision and gets a comment, which
   * needs the user's Person. The caller runs this inside the archive's transaction, so a refusal
   * rolls the archive back.
   */
  async recordArchive(batchId: string, archive: RecordedArchive, contextUser: UserInfo): Promise<void> {
    const beforeApproval = archive.fromStatus === 'Pending';
    await this.recordOnApprovalTask(batchId, 'archive', beforeApproval, (batch) =>
      (beforeApproval
        ? `Journal entry batch ${batch.JournalEntryBatchNumber} was archived before approval, so this approval request is closed. `
        : `Journal entry batch ${batch.JournalEntryBatchNumber} was archived after approval (it was ${archive.fromStatus}). `) +
      `It will never post to the ERP, and its journal entries stay locked to it. Reason: ${archive.reason.trim()}`,
    contextUser);
  }

  /**
   * The shared write behind recordCancellation and recordArchive: comment on the batch's stamped
   * approval Task as the user's Person, and close the Task when the batch never reached approval.
   * Without a linked Person the comment is skipped before approval and refused after it.
   *
   * SECURITY (#223): the Task comes from the batch's stamped ApprovalTaskID, never the newest Task
   * Link — Task Links are writable through the tasks-app surface, so a forged newer link would
   * otherwise redirect the comment (or the close) to another Task, or suppress it.
   */
  private async recordOnApprovalTask(
    batchId: string, action: BatchCloseAction, beforeApproval: boolean,
    content: (batch: mjBizAppsAccountingJournalEntryBatchEntity) => string, contextUser: UserInfo,
  ): Promise<void> {
    const batch = await this.loadBatch(batchId, contextUser);
    if (!batch.ApprovalTaskID) return;
    const label = batch.JournalEntryBatchNumber ?? batchId;
    const task = await this.provider.GetEntityObject<mjBizAppsTasksTaskEntity>('MJ_BizApps_Tasks: Tasks', contextUser);
    if (!(await task.Load(batch.ApprovalTaskID))) {
      throw new Error(`Batch ${label}: the ${action} cannot be recorded because its approval Task ${batch.ApprovalTaskID} did not load.`);
    }
    const personId = await this.resolvePersonIdForUser(contextUser);
    if (!personId && !beforeApproval) throw this.noLinkedPersonError(batch, contextUser, action);
    if (personId) {
      const comment = await this.provider.GetEntityObject<mjBizAppsTasksTaskCommentEntity>(TASK_COMMENT_ENTITY, contextUser);
      comment.NewRecord();
      comment.TaskID = task.ID;
      comment.PersonID = personId;
      // The batch loaded above already reads its new status: this runs after it was saved, so the
      // prior status comes from the caller.
      comment.Content = content(batch);
      if (!(await comment.Save())) {
        throw new Error(`Batch ${label}: recording the ${action} on its approval Task failed: ${comment.LatestResult?.CompleteMessage ?? 'unknown'}`);
      }
    }
    if (beforeApproval && task.Status !== 'Cancelled') {
      task.Status = 'Cancelled';
      if (!(await task.Save())) {
        throw new Error(`Batch ${label}: closing its approval Task failed: ${task.LatestResult?.CompleteMessage ?? 'unknown'}`);
      }
    }
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  /** Why a cancel or archive past approval is refused for a user with no linked Person (#212, golive #325). */
  private noLinkedPersonError(batch: mjBizAppsAccountingJournalEntryBatchEntity, contextUser: UserInfo, action: BatchCloseAction = 'cancel'): Error {
    return new Error(
      `Batch ${batch.JournalEntryBatchNumber ?? batch.ID}: the ${action} cannot be recorded on its approval Task because user ` +
      `${contextUser.Email ?? contextUser.ID} has no linked Person record. ` +
      `An administrator must link this user to a Person before the batch can be ${action === 'cancel' ? 'cancelled' : 'archived'} after approval.`,
    );
  }

  /** The company's CFO User, or null when none is configured (no hard-fail — see assertMayCancelApproved). */
  private async readCFOUserIdForCompany(companyId: string, contextUser: UserInfo): Promise<string | null> {
    const acp = await this.provider.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, contextUser);
    if (!(await acp.Load(companyId))) return null;
    return acp.ApprovalCFOUserID ?? null;
  }

  /** The bizapps-common Person linked to this MJ user (the user's People link, else Person.LinkedUserID), or null. */
  private async resolvePersonIdForUser(contextUser: UserInfo): Promise<string | null> {
    requireSqlGuid(contextUser.ID, 'TasksAppApprovalGate.resolvePersonIdForUser');
    try {
      return await ResolvePersonIDForUser(contextUser, this.provider, contextUser);
    } catch (error) {
      throw new Error(`Could not look up the person linked to the current user: ${error instanceof Error ? error.message : String(error)}`);
    }
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

  /**
   * The approval Task linked to this batch via a polymorphic Task Link. Used only by onBatchBuilt, to
   * confirm the link the build just created; every later read goes through the stamped
   * ApprovalTaskID instead (resolveStampedApprovalTask), because Task Links are writable through the
   * tasks app.
   */
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
   * True when one of the Task's approvals is not attributed to anyone but `approverUserId` (#446): its
   * DecidedByPersonID is empty, or names the approver's Person. A Person bound to no user, or to
   * another user, does not count.
   */
  private async hasApprovalBy(
    approvals: mjBizAppsTasksTaskDecisionEntity[], approverUserId: string, contextUser: UserInfo,
  ): Promise<boolean> {
    if (approvals.some(d => !d.DecidedByPersonID)) return true;
    const personIds = approvals.map(d => d.DecidedByPersonID).filter((id): id is string => !!id);
    if (personIds.length === 0) return false;
    const usersByPerson = await ResolveUserIDsForPeople(personIds, this.provider, contextUser);
    return personIds.some(id => UUIDsEqual(usersByPerson.get(id.toLowerCase()) ?? null, approverUserId));
  }

  /**
   * The Task's terminal decisions of the given kind: approvals (Approved/ApprovedWithConditions) or
   * rejections (any other terminal outcome). WHO made an approval is checked by the caller
   * (approvalRefusal for a send); a rejection counts from anyone who could record it, because
   * recordDecision only accepts one from the CFO and a forged rejection can only stop a send.
   */
  private async terminalDecisions(taskId: string, kind: 'Approval' | 'Rejection', contextUser: UserInfo): Promise<mjBizAppsTasksTaskDecisionEntity[]> {
    requireSqlGuid(taskId, 'TasksAppApprovalGate.terminalDecisions');
    const decRes = await this.viewProvider.RunView<mjBizAppsTasksTaskDecisionEntity>(
      { EntityName: TASK_DECISION_ENTITY, ExtraFilter: `TaskID='${taskId}'`, ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    if (!decRes.Success) throw new Error(`Could not read the decisions on approval task ${taskId}: ${decRes.ErrorMessage ?? 'unknown error'}`);
    const decisions = decRes.Results ?? [];
    if (decisions.length === 0) return [];
    const outcomes = await this.loadTerminalOutcomeIds(kind, contextUser);
    return decisions.filter(d => outcomes.some(oid => UUIDsEqual(oid, d.OutcomeID)));
  }

  /**
   * Every bizapps-common Person bound to an MJ user (own People link first, then LinkedUserID Persons
   * oldest first). The separation-of-duties checks need ALL of them, not the one Person
   * ResolvePersonIDsForUsers picks: a Person shared by the CFO and the builder must be caught
   * whichever link binds it to each.
   */
  private async personIdsForUserId(userId: string, contextUser: UserInfo): Promise<string[]> {
    try {
      return await ResolveAllPersonIDsForUser(userId, this.provider, contextUser);
    } catch (error) {
      throw new Error(`Could not look up the Persons linked to user ${userId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** The builder's Person for the Task's CreatedByPersonID, or undefined when they have none. */
  private async builderPersonId(userId: string, contextUser: UserInfo): Promise<string | undefined> {
    let found: Map<string, string>;
    try {
      found = await ResolvePersonIDsForUsers([userId], this.provider, contextUser);
    } catch (error) {
      throw new Error(`Could not look up the Person linked to the batch's builder (user ${userId}): ${error instanceof Error ? error.message : String(error)}`);
    }
    return found.get(userId.toLowerCase());
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
