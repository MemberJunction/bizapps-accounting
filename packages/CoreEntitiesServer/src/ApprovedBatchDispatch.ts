/**
 * ApprovedBatchDispatch — send every `Approved` batch to its ERP, oldest approval first, one batch at a
 * time through `sendJournalEntryBatch`, the same call the per-batch Dispatch button makes. Each send
 * passes the CFO approval gate, the approved-content check and the ERP lookup before anything posts.
 *
 * Two callers share it: the `Accounting.DispatchApprovedJournalEntryBatches` action (the hourly job,
 * system user only) and the `Accounting.DispatchApprovedJournalEntryBatches` Remote Operation (the
 * Batches page's "Send approved batches" button, Finance role only, bc-aidp-next-golive#451). Who may
 * run it is each caller's check; this module only selects and sends.
 *
 * `Failed` batches are left alone. A Failed batch may already be in the ERP, and retrying one is an
 * operator's call after checking the ERP (#182), so a run never retries. One batch failing never stops
 * the rest: each outcome is reported on its own.
 */
import { IMetadataProvider, IRunViewProvider, LogError, UserInfo } from '@memberjunction/core';
import { sendJournalEntryBatch, JournalEntryBatchSendRefusedError, type JournalEntryBatchTargetSystem } from './JournalEntryBatchEngine.js';
import { sqlGuidLiteral } from './SqlGuards.js';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

/** Which Approved batches a run sends. `null` means no narrowing on that field. */
export interface ApprovedBatchDispatchFilter {
  targetSystem: JournalEntryBatchTargetSystem | null;
  companyIds: string[] | null;
}

/** One batch's result. `status` is what the batch reads after the send, or what it was left at. */
export interface ApprovedBatchDispatchOutcome {
  batchId: string;
  batchNumber: string;
  companyId: string;
  /** The company's name, from the batch view. */
  company: string | null;
  status: string;
  /** Why the batch did not post: the ERP's rejection, or why the send was refused. */
  error: string | null;
  /** True when the batch did not post and nobody else's send owns it, so someone has to act. */
  needsAttention: boolean;
  /** True when another send (the Dispatch button, the job) took the batch first; its result is that send's. */
  takenByAnotherSend: boolean;
}

interface ApprovedBatchRow {
  ID: string;
  JournalEntryBatchNumber: string;
  CompanyID: string;
  Company: string | null;
}

const TARGET_SYSTEMS: ReadonlyArray<JournalEntryBatchTargetSystem> = ['BusinessCentral', 'NetSuite', 'Other', 'QuickBooks', 'Sage', 'Xero'];

/** The SQL filter for the run. Every value that reaches it is checked against a closed shape first. */
export function approvedBatchFilter(filter: ApprovedBatchDispatchFilter): string {
  const clauses = [`Status='Approved'`];
  if (filter.targetSystem) {
    if (!TARGET_SYSTEMS.includes(filter.targetSystem)) {
      throw new Error(`Approved batches were not dispatched: '${filter.targetSystem}' is not a target ERP. Use one of: ${TARGET_SYSTEMS.join(', ')}.`);
    }
    clauses.push(`TargetSystem='${filter.targetSystem}'`);
  }
  if (filter.companyIds?.length) {
    const ids = filter.companyIds.map(id => sqlGuidLiteral(id, 'Accounting.DispatchApprovedJournalEntryBatches: CompanyIDs'));
    clauses.push(`CompanyID IN (${ids.join(',')})`);
  }
  return clauses.join(' AND ');
}

/** The Approved batches the filter selects, oldest approval first. Throws when they cannot be read. */
export async function readApprovedJournalEntryBatches(
  filter: ApprovedBatchDispatchFilter, contextUser: UserInfo, provider: IMetadataProvider,
): Promise<ApprovedBatchRow[]> {
  const rv = provider as unknown as IRunViewProvider;
  const result = await rv.RunView<ApprovedBatchRow>({
    EntityName: BATCH_ENTITY,
    ExtraFilter: approvedBatchFilter(filter),
    OrderBy: 'ApprovedAt ASC',
    Fields: ['ID', 'JournalEntryBatchNumber', 'CompanyID', 'Company'],
    ResultType: 'simple',
    BypassCache: true,
    IgnoreMaxRows: true,
  }, contextUser);
  if (!result.Success) {
    throw new Error(`Approved batches were not dispatched: they could not be read: ${result.ErrorMessage ?? 'unknown error'}`);
  }
  return result.Results ?? [];
}

/**
 * Send one batch. A send the ERP rejects returns `Failed` with its reason. A send refused before
 * `Sent` (the approval gate, a content change since approval, an ERP lookup that cannot settle it, a
 * number the ERP already holds) throws and leaves the batch `Approved`, so the next run reports it
 * again until someone acts on it.
 */
export async function dispatchApprovedJournalEntryBatch(
  batch: ApprovedBatchRow, contextUser: UserInfo, provider: IMetadataProvider,
): Promise<ApprovedBatchDispatchOutcome> {
  const base = { batchId: batch.ID, batchNumber: batch.JournalEntryBatchNumber, companyId: batch.CompanyID, company: batch.Company ?? null };
  try {
    const sent = await sendJournalEntryBatch(batch.ID, contextUser, { provider });
    const posted = sent.Status === 'Posted';
    return { ...base, status: sent.Status, error: posted ? null : sent.ErrorMessage ?? null, needsAttention: !posted, takenByAnotherSend: false };
  } catch (e) {
    // Another send took this batch between the read and this send. It owns the batch, and its
    // result is its own.
    if (e instanceof JournalEntryBatchSendRefusedError) {
      return { ...base, status: e.Status, error: null, needsAttention: false, takenByAnotherSend: true };
    }
    const message = e instanceof Error ? e.message : String(e);
    LogError(`Accounting.DispatchApprovedJournalEntryBatches: batch ${batch.JournalEntryBatchNumber} was not sent: ${message}`);
    return { ...base, status: 'Approved', error: message, needsAttention: true, takenByAnotherSend: false };
  }
}

/** Send every Approved batch the filter selects, one at a time, and report each one's outcome. */
export async function dispatchApprovedJournalEntryBatches(
  filter: ApprovedBatchDispatchFilter, contextUser: UserInfo, provider: IMetadataProvider,
): Promise<ApprovedBatchDispatchOutcome[]> {
  const batches = await readApprovedJournalEntryBatches(filter, contextUser, provider);
  const outcomes: ApprovedBatchDispatchOutcome[] = [];
  for (const batch of batches) {
    outcomes.push(await dispatchApprovedJournalEntryBatch(batch, contextUser, provider));
  }
  return outcomes;
}
