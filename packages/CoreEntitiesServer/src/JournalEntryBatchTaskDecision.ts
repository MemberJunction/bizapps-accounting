/**
 * Carrying a CFO decision on a batch's approval Task through to the batch (#468).
 *
 * A decision reaches the approval Task two ways:
 *   - the Accounting app (Accounting.RecordJournalEntryBatchDecision), which checks the decider, writes
 *     the decision and then approves or cancels the batch: {@link recordJournalEntryBatchDecision};
 *   - the Tasks app, which writes the decision and closes the Task. The batch approval task type's
 *     OnComplete and OnReject hooks then run Accounting.ApplyJournalEntryBatchTaskDecision as the user
 *     who decided: {@link applyApprovalTaskDecision}.
 *
 * Both end in the same step, {@link applyDecision}. The Tasks app writes the decision before anything
 * here runs, so the decider is checked afterwards; a refused decision leaves the batch Pending and puts
 * the Task back to Open with a comment saying why (TasksAppApprovalGate.reopenAfterRefusedDecision).
 *
 * The Accounting path also closes the Task, so the hook fires for its decisions too. Both paths run
 * under {@link withBatchDecisionLock}, and the hook acts only on a Pending batch: whichever runs second
 * finds the batch already decided and does nothing. The hook runs in the MJAPI process that saved the
 * Task, which is the process running the Accounting decision, so an in-process lock is enough.
 *
 * CONNECTS TO:
 *   GATE:   ./TasksAppApprovalGate (assertMayDecide · latestTerminalDecision · recordDecision · reopenAfterRefusedDecision)
 *   ENGINE: ./JournalEntryBatchEngine (approveJournalEntryBatch · cancelJournalEntryBatch)
 *   CALLED BY: ./JournalEntryBatchOperations (Accounting.RecordJournalEntryBatchDecision)
 *              · @mj-biz-apps/accounting-actions (Accounting.ApplyJournalEntryBatchTaskDecision)
 */
import { IMetadataProvider, IRunViewProvider, UserInfo } from '@memberjunction/core';
import { IsApprovalOutcome, type TaskDecisionOutcomeCode } from '@mj-biz-apps/tasks-core';
import type { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import { approveJournalEntryBatch, cancelJournalEntryBatch } from './JournalEntryBatchEngine.js';
import { TasksAppApprovalGate, type RecordedTaskDecision } from './TasksAppApprovalGate.js';
import { requireSqlGuid } from './SqlGuards.js';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

/** What applying an approval Task's decision did to its batch. */
export type ApprovalTaskDecisionResult =
  /** The batch was approved or cancelled on the decision. */
  | { Kind: 'Approved' | 'Cancelled'; JournalEntryBatchID: string }
  /** The decision was refused: the batch stays Pending and the Task is open again. */
  | { Kind: 'Refused'; JournalEntryBatchID: string; Reason: string }
  /** Nothing to do: the batch was already decided, or the Task has no terminal decision. */
  | { Kind: 'NotPending' | 'NoDecision'; JournalEntryBatchID: string }
  /** The Task is no batch's stamped approval Task. */
  | { Kind: 'NotABatchTask'; JournalEntryBatchID: null };

// ─── Per-batch lock ──────────────────────────────────────────────────────────────────────

/** The tail of each batch's queue of decision work, keyed by lower-cased batch ID. */
const decisionQueues = new Map<string, Promise<void>>();

/**
 * Run `work` once every earlier decision on the same batch has finished, so the Accounting decision
 * and the hook it sets off never approve or cancel one batch at the same time.
 */
export async function withBatchDecisionLock<T>(batchId: string, work: () => Promise<T>): Promise<T> {
  const key = batchId.toLowerCase();
  const previous = decisionQueues.get(key) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  decisionQueues.set(key, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (decisionQueues.get(key) === tail) decisionQueues.delete(key);
  }
}

// ─── The two entry points ────────────────────────────────────────────────────────────────

/**
 * The Accounting app's decision: check the decider and record the decision on the batch's approval
 * Task (TasksAppApprovalGate.recordDecision), then approve or cancel the batch.
 */
export async function recordJournalEntryBatchDecision(
  batchId: string, outcome: TaskDecisionOutcomeCode, decidedByPersonId: string | undefined, notes: string | undefined,
  contextUser: UserInfo, provider: IMetadataProvider,
): Promise<void> {
  await withBatchDecisionLock(batchId, async () => {
    await new TasksAppApprovalGate(provider).recordDecision(batchId, outcome, decidedByPersonId, notes, contextUser);
    await applyDecision(batchId, { outcome, notes: notes ?? null }, contextUser, provider);
  });
}

/**
 * A decision recorded on an approval Task, applied to the batch whose stamped ApprovalTaskID names the
 * Task, as `contextUser` (the user who decided). Acts only on a Pending batch with a terminal decision.
 * A decision `contextUser` may not make is refused: the batch is left Pending and the Task reopened.
 */
export async function applyApprovalTaskDecision(
  taskId: string, contextUser: UserInfo, provider: IMetadataProvider,
): Promise<ApprovalTaskDecisionResult> {
  const batchId = await findBatchForApprovalTask(taskId, contextUser, provider);
  if (!batchId) return { Kind: 'NotABatchTask', JournalEntryBatchID: null };
  return withBatchDecisionLock(batchId, () => applyTaskDecisionToBatch(taskId, batchId, contextUser, provider));
}

// ─── Steps ───────────────────────────────────────────────────────────────────────────────

async function applyTaskDecisionToBatch(
  taskId: string, batchId: string, contextUser: UserInfo, provider: IMetadataProvider,
): Promise<ApprovalTaskDecisionResult> {
  const gate = new TasksAppApprovalGate(provider);
  const batch = await loadBatch(batchId, contextUser, provider);
  if (batch.Status !== 'Pending') return { Kind: 'NotPending', JournalEntryBatchID: batchId };
  const decision = await gate.latestTerminalDecision(taskId, contextUser);
  if (!decision) return { Kind: 'NoDecision', JournalEntryBatchID: batchId };
  const refusal = await decisionRefusal(gate, batch, decision, contextUser);
  if (refusal) {
    await gate.reopenAfterRefusedDecision(batch, refusal, contextUser);
    return { Kind: 'Refused', JournalEntryBatchID: batchId, Reason: refusal };
  }
  await applyDecision(batchId, decision, contextUser, provider);
  return { Kind: IsApprovalOutcome(decision.outcome) ? 'Approved' : 'Cancelled', JournalEntryBatchID: batchId };
}

/** Why `contextUser` may not make this decision on the batch, or null when they may. */
async function decisionRefusal(
  gate: TasksAppApprovalGate, batch: mjBizAppsAccountingJournalEntryBatchEntity, decision: RecordedTaskDecision, contextUser: UserInfo,
): Promise<string | null> {
  try {
    await gate.assertMayDecide(batch, decision.outcome, decision.notes ?? undefined, contextUser);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Approve the batch on an approving decision; otherwise cancel it with the decision's notes as the reason. */
async function applyDecision(
  batchId: string, decision: RecordedTaskDecision, contextUser: UserInfo, provider: IMetadataProvider,
): Promise<void> {
  if (IsApprovalOutcome(decision.outcome)) {
    await approveJournalEntryBatch(batchId, contextUser.ID, contextUser, provider);
  } else {
    await cancelJournalEntryBatch(batchId, contextUser, provider, { reason: decision.notes });
  }
}

/**
 * The batch whose stamped ApprovalTaskID is this Task, or null. SECURITY (#313): the stamped column,
 * never a Task Link, which the tasks app lets users write.
 */
async function findBatchForApprovalTask(taskId: string, contextUser: UserInfo, provider: IMetadataProvider): Promise<string | null> {
  requireSqlGuid(taskId, 'applyApprovalTaskDecision');
  const res = await (provider as unknown as IRunViewProvider).RunView<{ ID: string }>(
    { EntityName: BATCH_ENTITY, ExtraFilter: `ApprovalTaskID='${taskId}'`, Fields: ['ID'], MaxRows: 1, ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  if (!res.Success) throw new Error(`Could not look up the batch for approval task ${taskId}: ${res.ErrorMessage ?? 'unknown error'}`);
  return res.Results?.[0]?.ID ?? null;
}

async function loadBatch(batchId: string, contextUser: UserInfo, provider: IMetadataProvider): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const batch = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`Batch ${batchId} was not found.`);
  return batch;
}
