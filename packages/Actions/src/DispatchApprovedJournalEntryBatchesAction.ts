import { LogError, Metadata, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { BaseAction } from '@memberjunction/actions';
import { RegisterClass, UUIDsEqual } from '@memberjunction/global';
import { UserCache } from '@memberjunction/generic-database-provider';
import {
  sqlGuidLiteral,
  sendJournalEntryBatch,
  JournalEntryBatchSendRefusedError,
  type JournalEntryBatchTargetSystem,
} from '@mj-biz-apps/accounting-core-entities-server';

/**
 * Action: Accounting.DispatchApprovedJournalEntryBatches
 *
 * Sends every `Approved` batch to its ERP, oldest approval first: the scheduled counterpart of the
 * Dispatch button. Each send is `sendJournalEntryBatch`, the same call the button makes, so each one
 * passes the CFO approval gate, the approved-content check and the ERP lookup before anything is
 * posted. This action approves nothing: a batch reaches `Approved` only through a CFO decision.
 *
 * `Failed` batches are left alone. A Failed batch may already be in the ERP, and retrying one is an
 * operator's call after checking the ERP (#182), so a run never retries.
 *
 * Only the MJ system user, which the scheduler runs jobs as, may run it. A person dispatches a
 * batch with the Dispatch button, which checks the Finance role; this action sends every company's
 * batches at once, so a person running it would skip that check.
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

    const batches = await approvedBatches(user, readFilter(params));
    const outcomes: DispatchOutcome[] = [];
    for (const batch of batches) {
      outcomes.push(await dispatchOne(batch, user, provider));
    }
    return summarize(params, outcomes);
  }
}

// ─── Inputs ──────────────────────────────────────────────────────────────────────────────

interface DispatchFilter {
  targetSystem: JournalEntryBatchTargetSystem | null;
  companyIds: string[] | null;
}

function readParam<T>(params: RunActionParams, name: string): T | undefined {
  const value = params.Params.find(p => p.Name === name)?.Value;
  return (value ?? undefined) as T | undefined;
}

function readFilter(params: RunActionParams): DispatchFilter {
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

// ─── Selection ───────────────────────────────────────────────────────────────────────────

interface ApprovedBatchRow {
  ID: string;
  JournalEntryBatchNumber: string;
  CompanyID: string;
}

const TARGET_SYSTEMS: ReadonlyArray<JournalEntryBatchTargetSystem> = ['BusinessCentral', 'NetSuite', 'Other', 'QuickBooks', 'Sage', 'Xero'];

/** The SQL filter for the run. Every value that reaches it is checked against a closed shape first. */
export function approvedBatchFilter(filter: DispatchFilter): string {
  const clauses = [`Status='Approved'`];
  if (filter.targetSystem) {
    if (!TARGET_SYSTEMS.includes(filter.targetSystem)) {
      throw new Error(`Approved batches were not dispatched: '${filter.targetSystem}' is not a target ERP. Use one of: ${TARGET_SYSTEMS.join(', ')}.`);
    }
    clauses.push(`TargetSystem='${filter.targetSystem}'`);
  }
  if (filter.companyIds) {
    const ids = filter.companyIds.map(id => sqlGuidLiteral(id, 'Accounting.DispatchApprovedJournalEntryBatches: CompanyIDs'));
    clauses.push(`CompanyID IN (${ids.join(',')})`);
  }
  return clauses.join(' AND ');
}

async function approvedBatches(user: UserInfo, filter: DispatchFilter): Promise<ApprovedBatchRow[]> {
  const result = await new RunView().RunView<ApprovedBatchRow>({
    EntityName: 'MJ_BizApps_Accounting: Journal Entry Batches',
    ExtraFilter: approvedBatchFilter(filter),
    OrderBy: 'ApprovedAt ASC',
    Fields: ['ID', 'JournalEntryBatchNumber', 'CompanyID'],
    ResultType: 'simple',
    BypassCache: true,
  }, user);
  if (!result.Success) {
    throw new Error(`Approved batches were not dispatched: they could not be read: ${result.ErrorMessage ?? 'unknown error'}`);
  }
  return result.Results ?? [];
}

// ─── Dispatch ────────────────────────────────────────────────────────────────────────────

/** One batch's result. `status` is what the batch reads after the send, or what it was left at. */
interface DispatchOutcome {
  batchId: string;
  batchNumber: string;
  companyId: string;
  status: string;
  error: string | null;
  needsAttention: boolean;
}

/**
 * Send one batch. A send the ERP rejects returns `Failed` with its reason. A send refused before
 * `Sent` (the approval gate, a content change since approval, a number the ERP already holds) throws
 * and leaves the batch `Approved`, so the next run reports it again until someone acts on it.
 */
async function dispatchOne(batch: ApprovedBatchRow, user: UserInfo, provider: IMetadataProvider): Promise<DispatchOutcome> {
  const base = { batchId: batch.ID, batchNumber: batch.JournalEntryBatchNumber, companyId: batch.CompanyID };
  try {
    const sent = await sendJournalEntryBatch(batch.ID, user, { provider });
    return { ...base, status: sent.Status, error: sent.ErrorMessage ?? null, needsAttention: sent.Status !== 'Posted' };
  } catch (e) {
    // Another send (the Dispatch button) took this batch between the read and this send. It owns
    // the batch, and its result is its own.
    if (e instanceof JournalEntryBatchSendRefusedError) {
      return { ...base, status: e.Status, error: null, needsAttention: false };
    }
    const message = e instanceof Error ? e.message : String(e);
    LogError(`Accounting.DispatchApprovedJournalEntryBatches: batch ${batch.JournalEntryBatchNumber} was not sent: ${message}`);
    return { ...base, status: 'Approved', error: message, needsAttention: true };
  }
}

// ─── Result ──────────────────────────────────────────────────────────────────────────────

function summarize(params: RunActionParams, outcomes: DispatchOutcome[]): ActionResultSimple {
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
