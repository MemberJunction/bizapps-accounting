import { Metadata } from '@memberjunction/core';
import { ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { BaseAction } from '@memberjunction/actions';
import { RegisterClass } from '@memberjunction/global';
import { applyApprovalTaskDecision, type ApprovalTaskDecisionResult } from '@mj-biz-apps/accounting-core-entities-server';

/**
 * Action: Accounting.ApplyJournalEntryBatchTaskDecision
 *
 * The OnComplete and OnReject hook of the 'Journal Entry Batch Approval' task type (#468). When a
 * decision recorded in the Tasks app closes a batch's approval Task, the tasks app runs this action as
 * the user who decided, with the Task's ID. It approves or cancels the batch on that decision through
 * `applyApprovalTaskDecision`, the step the Accounting app's own decision shares, so the same approver
 * and separation-of-duties checks apply.
 *
 * It acts only on a Pending batch whose stamped approval Task is this Task, and only on a terminal
 * decision. A decision the user may not make leaves the batch Pending and reopens the Task with a
 * comment; the action then reports failure so the hook logs it.
 */
@RegisterClass(BaseAction, 'Accounting.ApplyJournalEntryBatchTaskDecision')
export class ApplyJournalEntryBatchTaskDecisionAction extends BaseAction {
  protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
    const provider = Metadata.Provider;
    if (!provider) {
      throw new Error('The task decision was not applied: the server has no metadata provider loaded.');
    }
    const taskId = params.Params.find(p => p.Name === 'TaskID')?.Value;
    if (typeof taskId !== 'string' || !taskId) {
      return { Success: false, Message: 'The task decision was not applied: no TaskID was given.', ResultCode: 'MISSING_TASK' };
    }
    const result = await applyApprovalTaskDecision(taskId, params.ContextUser, provider);
    return summarize(params, result);
  }
}

function summarize(params: RunActionParams, result: ApprovalTaskDecisionResult): ActionResultSimple {
  const outcomeParam = params.Params.find(p => p.Name === 'Outcome');
  if (outcomeParam) outcomeParam.Value = result.Kind;
  switch (result.Kind) {
    case 'Approved':
    case 'Cancelled':
      return { Success: true, Message: `Batch ${result.JournalEntryBatchID} was ${result.Kind.toLowerCase()} on the task's decision.`, ResultCode: result.Kind.toUpperCase() };
    case 'Refused':
      return { Success: false, Message: `Batch ${result.JournalEntryBatchID} stays Pending and its task was reopened: ${result.Reason}`, ResultCode: 'REFUSED' };
    case 'NotPending':
      return { Success: true, Message: `Batch ${result.JournalEntryBatchID} is no longer Pending; nothing to do.`, ResultCode: 'NOT_PENDING' };
    case 'NoDecision':
      return { Success: true, Message: `The task has no approve or reject decision; batch ${result.JournalEntryBatchID} is unchanged.`, ResultCode: 'NO_DECISION' };
    case 'NotABatchTask':
      return { Success: true, Message: 'The task is not a journal entry batch approval task; nothing to do.', ResultCode: 'NOT_A_BATCH_TASK' };
  }
}
