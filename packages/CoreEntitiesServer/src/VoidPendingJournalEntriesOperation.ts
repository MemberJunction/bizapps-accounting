/**
 * VoidPendingJournalEntriesOperation — 'Accounting.VoidPendingJournalEntries' (golive #378).
 *
 * Voids entries that have not left the subledger. A return or cancellation used to offset every
 * staged recognition entry still to come with a mirror entry, which left pairs that net to zero and
 * are right only if both halves land in the same batch. An entry that is still Pending and in no batch
 * has reached nothing outside this ledger, so it is voided in place instead: it stays on record, with
 * who voided it, when and why, and it never reaches a batch, the ERP or a balance. A Batched or
 * GL-posted entry is still corrected only with a reversing entry.
 *
 * The entries are named by ID. ALL OR NOTHING: every entry is checked before any is written, and the
 * writes share one transaction, joining the caller's when there is one (the same rule as
 * Accounting.CreateJournalEntries), so a return's mirrors and its voids commit or roll back together.
 *
 * REFUSED when any named entry is missing, is not Pending, is in a batch, has been reversed or is
 * itself a reversal (either would leave a reversal pointing at a voided entry), is a batch summary, or
 * has a manual-entry approval still open; or when the reason is blank.
 *
 * WHO MAY CALL IT: the scope is accounting:write, as for Accounting.CreateJournalEntries and
 * Accounting.GenerateJournalEntryReversal. No finance authorization on top: a Pending entry can
 * already be edited or deleted by anyone with update rights on journal entries, and voiding it keeps
 * more than a delete does. The entity save still checks the caller's permissions.
 *
 * CONNECTS TO:
 *   ENTITY:  ./JournalEntryEntityServer (SaveVoided — the one save that may move an entry to Voided)
 *   DB:      CK_JournalEntry_VoidAudit, CK_JournalEntry_VoidedHasNoBatch, trg_JournalEntry_VoidRules
 *   CLIENTS: bizapps-orders returns and cancellations (resolved by key, in-process)
 */
import { BaseRemotableOperation, DatabaseProviderBase, IMetadataProvider, IRunViewProvider, LogError, UserInfo } from '@memberjunction/core';
import { RegisterClass, UUIDsEqual } from '@memberjunction/global';
import { GetJournalEntryBatchSummaryEntryType } from './JournalEntryTypes.js';
import { JournalEntryEntityServer } from './JournalEntryEntityServer.js';
import { isSqlGuid } from './SqlGuards.js';

const OPERATION_KEY = 'Accounting.VoidPendingJournalEntries';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

export interface VoidPendingJournalEntriesInput {
  /** The entries to void. Every ID must exist. */
  JournalEntryIDs: string[];
  /** Why they are voided; stored on each entry as VoidReason. */
  Reason: string;
}

/** One entry the operation voided. */
export interface VoidedJournalEntry {
  JournalEntryID: string;
  EntryNumber: string;
}

export interface VoidPendingJournalEntriesOutput {
  Voided: VoidedJournalEntry[];
}

/** The entry fields the refusal rules read. */
export interface VoidCandidate {
  ID: string;
  EntryNumber: string;
  Status: string;
  EntryTypeID: string;
  JournalEntryBatchID: string | null;
  ReversesJournalEntryID: string | null;
  ReversedByJournalEntryID: string | null;
  ApprovalTaskID: string | null;
  ApprovedAt: Date | string | null;
}

@RegisterClass(BaseRemotableOperation, OPERATION_KEY)
export class VoidPendingJournalEntriesOperation extends BaseRemotableOperation<VoidPendingJournalEntriesInput, VoidPendingJournalEntriesOutput> {
  public readonly OperationKey = OPERATION_KEY;
  public readonly RequiredScope = 'accounting:write';

  protected async InternalExecute(input: VoidPendingJournalEntriesInput, provider: IMetadataProvider, user: UserInfo): Promise<VoidPendingJournalEntriesOutput> {
    const reason = (input?.Reason ?? '').trim();
    if (reason.length === 0) throw new Error('The entries were not voided: a void needs a reason.');
    const ids = [...new Set((input?.JournalEntryIDs ?? []).map(id => id.trim()))].filter(id => id.length > 0);
    if (ids.length === 0) return { Voided: [] };
    const bad = ids.filter(id => !isSqlGuid(id));
    if (bad.length > 0) throw new Error(`The entries were not voided: ${bad.join(', ')} ${bad.length === 1 ? 'is not a valid ID' : 'are not valid IDs'}.`);

    const entries = await loadEntries(ids, provider, user);
    const summaryType = await GetJournalEntryBatchSummaryEntryType(user, provider);
    const problems = VoidProblems(entries, summaryType.ID);
    if (problems.length > 0) throw new Error(`The entries were not voided. ${problems.join(' ')}`);

    const voided = await inTransaction(provider, () => voidAll(entries, reason, user));
    return { Voided: voided };
  }
}

/**
 * Why `entries` cannot be voided, one sentence per problem; empty when they can — pure. Every entry is
 * checked, so one refusal names every entry that blocks the void.
 */
export function VoidProblems(entries: VoidCandidate[], summaryEntryTypeID: string): string[] {
  const problems: string[] = [];
  for (const e of entries) {
    const problem = voidProblem(e, summaryEntryTypeID);
    if (problem) problems.push(problem);
  }
  return problems;
}

function voidProblem(e: VoidCandidate, summaryEntryTypeID: string): string | null {
  if (e.Status === 'Voided') return `Journal entry ${e.EntryNumber} is already voided.`;
  if (e.Status !== 'Pending' || e.JournalEntryBatchID) {
    return `Journal entry ${e.EntryNumber} is ${e.Status === 'Pending' ? 'in a batch' : e.Status}: only a Pending entry in no batch can be voided. Reverse it instead.`;
  }
  if (UUIDsEqual(e.EntryTypeID, summaryEntryTypeID)) return `Journal entry ${e.EntryNumber} is a batch summary, which belongs to its batch and is never voided.`;
  if (e.ReversedByJournalEntryID) return `Journal entry ${e.EntryNumber} has been reversed, so voiding it would leave its reversal standing alone.`;
  if (e.ReversesJournalEntryID) return `Journal entry ${e.EntryNumber} reverses another entry, so voiding it would leave that entry marked reversed.`;
  if (e.ApprovalTaskID && !e.ApprovedAt) return `Journal entry ${e.EntryNumber} is waiting for its manual-entry approval; record that decision first.`;
  return null;
}

/** The named entries as server entities. Throws naming any ID with no entry. */
async function loadEntries(ids: string[], provider: IMetadataProvider, user: UserInfo): Promise<JournalEntryEntityServer[]> {
  const res = await (provider as unknown as IRunViewProvider).RunView<JournalEntryEntityServer>(
    { EntityName: JE_ENTITY, ExtraFilter: `ID IN (${ids.map(id => `'${id}'`).join(',')})`, OrderBy: 'EntryNumber ASC', ResultType: 'entity_object', BypassCache: true, IgnoreMaxRows: true },
    user,
  );
  if (!res.Success) throw new Error(`The entries were not voided: could not read them: ${res.ErrorMessage ?? 'unknown error'}`);
  const entries = res.Results ?? [];
  const missing = ids.filter(id => !entries.some(e => UUIDsEqual(e.ID, id)));
  if (missing.length > 0) throw new Error(`The entries were not voided: journal entr${missing.length === 1 ? 'y' : 'ies'} ${missing.join(', ')} ${missing.length === 1 ? 'was' : 'were'} not found.`);
  return entries;
}

async function voidAll(entries: JournalEntryEntityServer[], reason: string, user: UserInfo): Promise<VoidedJournalEntry[]> {
  const voided: VoidedJournalEntry[] = [];
  for (const entry of entries) {
    if (!(await entry.SaveVoided(reason, user.ID))) {
      throw new Error(`Journal entry ${entry.EntryNumber} could not be voided: ${entry.LatestResult?.CompleteMessage ?? 'unknown error'}`);
    }
    voided.push({ JournalEntryID: entry.ID, EntryNumber: entry.EntryNumber });
  }
  return voided;
}

/** Runs `work` in the caller's transaction when there is one, otherwise in its own. */
async function inTransaction<T>(provider: IMetadataProvider, work: () => Promise<T>): Promise<T> {
  const db = provider as unknown as DatabaseProviderBase;
  const joined = db.TransactionDepth > 0;
  if (!joined) await db.BeginTransaction();
  try {
    const result = await work();
    if (!joined) await db.CommitTransaction();
    return result;
  } catch (e) {
    if (!joined) {
      try {
        await db.RollbackTransaction();
      } catch (rollbackError) {
        LogError(`VoidPendingJournalEntries rollback failed: ${rollbackError}`);
      }
    }
    throw e;
  }
}

/** Tree-shaking anchor — called from the app's server bootstrap so the registration is retained. */
export function LoadVoidPendingJournalEntriesOperation(): void {
  // intentionally empty
}
