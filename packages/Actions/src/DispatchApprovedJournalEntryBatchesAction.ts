import { Metadata, type UserInfo } from '@memberjunction/core';
import { ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { BaseAction } from '@memberjunction/actions';
import { RegisterClass, UUIDsEqual } from '@memberjunction/global';
import { UserCache } from '@memberjunction/generic-database-provider';
import {
  dispatchApprovedJournalEntryBatches,
  type ApprovedBatchDispatchFilter,
  type ApprovedBatchDispatchOutcome,
  type JournalEntryBatchTargetSystem,
} from '@mj-biz-apps/accounting-core-entities-server';

/**
 * Action: Accounting.DispatchApprovedJournalEntryBatches
 *
 * Sends every `Approved` batch to its ERP, oldest approval first: the scheduled counterpart of the
 * Dispatch button. The selection and the sends are `dispatchApprovedJournalEntryBatches`, which the
 * Batches page's Send approved batches operation shares (bc-aidp-next-golive#451); each send is
 * `sendJournalEntryBatch`, the same call the button makes, so each one passes the CFO approval gate,
 * the approved-content check and the ERP lookup before anything is posted. This action approves
 * nothing: a batch reaches `Approved` only through a CFO decision.
 *
 * `Failed` batches are left alone. A Failed batch may already be in the ERP, and retrying one is an
 * operator's call after checking the ERP (#182), so a run never retries.
 *
 * Only the MJ system user, which the scheduler runs jobs as, may run it. A person dispatches with a
 * batch's Dispatch button or the Batches page's Send approved batches button, both of which check
 * the Finance role; a person running this action would skip that check.
 */
@RegisterClass(BaseAction, 'Accounting.DispatchApprovedJournalEntryBatches')
export class DispatchApprovedJournalEntryBatchesAction extends BaseAction {
  protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
    const provider = Metadata.Provider;
    if (!provider) {
      throw new Error('Approved batches were not dispatched: the server has no metadata provider loaded.');
    }
    const user = params.ContextUser;
    assertSystemUser(user);

    const outcomes = await dispatchApprovedJournalEntryBatches(readFilter(params), user, provider);
    return summarize(params, outcomes);
  }
}

// ─── Inputs ──────────────────────────────────────────────────────────────────────────────

function readParam<T>(params: RunActionParams, name: string): T | undefined {
  const value = params.Params.find(p => p.Name === name)?.Value;
  return (value ?? undefined) as T | undefined;
}

function readFilter(params: RunActionParams): ApprovedBatchDispatchFilter {
  const companyIds = readParam<string[]>(params, 'CompanyIDs');
  return {
    targetSystem: readParam<JournalEntryBatchTargetSystem>(params, 'TargetSystem') ?? null,
    companyIds: companyIds?.length ? companyIds : null,
  };
}

/** Fails closed when the user cache does not hold the system user. */
function assertSystemUser(contextUser: UserInfo): void {
  const systemUser = UserCache.Instance.GetSystemUser();
  if (!systemUser || !contextUser?.ID || !UUIDsEqual(contextUser.ID, systemUser.ID)) {
    throw new Error(
      'Approved batches were not dispatched: this action runs only as the MJ system user, which the scheduled dispatch job runs as. ' +
      'Dispatch a batch from its Dispatch button instead.',
    );
  }
}

// ─── Result ──────────────────────────────────────────────────────────────────────────────

function summarize(params: RunActionParams, outcomes: ApprovedBatchDispatchOutcome[]): ActionResultSimple {
  const batchesParam = params.Params.find(p => p.Name === 'Batches');
  if (batchesParam) batchesParam.Value = JSON.stringify(outcomes);
  const posted = outcomes.filter(o => o.status === 'Posted').length;
  const countParam = params.Params.find(p => p.Name === 'PostedCount');
  if (countParam) countParam.Value = posted;

  if (outcomes.length === 0) {
    return { Success: true, Message: 'No approved batches to dispatch.', ResultCode: 'NO_BATCHES' };
  }
  const problems = outcomes.filter(o => o.needsAttention);
  const summary = `Dispatched ${outcomes.length} approved batch(es); ${posted} posted.`;
  if (problems.length === 0) {
    return { Success: true, Message: summary, ResultCode: 'SUCCESS' };
  }
  const detail = problems.map(o => `${o.batchNumber} (${o.status}: ${o.error ?? 'no detail'})`).join('; ');
  return {
    Success: false,
    Message: `${summary} ${problems.length} did not post: ${detail}`,
    ResultCode: 'POST_INCOMPLETE',
  };
}
