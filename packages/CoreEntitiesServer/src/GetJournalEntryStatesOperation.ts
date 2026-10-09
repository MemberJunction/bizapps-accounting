/**
 * GetJournalEntryStatesOperation — 'Accounting.GetJournalEntryStates' as a code-only, read-only
 * Remote Operation (#193).
 *
 * A caller that must decide what it may do to existing entries — e.g. an Orders correcting order
 * netting against staged forward-dated recognition entries (D15) — needs each entry's own state and
 * the state of the batch holding it. This answers both in one call: two reads (the entries, then
 * their batches), never one read per id.
 *
 * Every id is validated as a UUID before anything reaches a filter; one malformed id fails the whole
 * call. An id with no row is reported `Found: false`, not an error.
 *
 * CONNECTS TO:
 *   GUARDS: ./SqlGuards (sqlGuidLiteral — validate, never escape)
 */
import { BaseRemotableOperation, IMetadataProvider, IRunViewProvider, RunView, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import type { mjBizAppsAccountingJournalEntryBatchEntityType, mjBizAppsAccountingJournalEntryEntityType } from '@mj-biz-apps/accounting-entities';
import { ToCalendarDay, type CalendarDay } from '@mj-biz-apps/common-entities';
import { requireSqlGuid, sqlGuidLiteral } from './SqlGuards.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const CONTEXT = 'GetJournalEntryStates';

/** Most ids one call accepts. Keeps each `ID IN (...)` filter bounded; callers with more page the call. */
export const MAX_JOURNAL_ENTRY_STATE_IDS = 500;

type JournalEntryStatus = mjBizAppsAccountingJournalEntryEntityType['Status'];
type JournalEntryBatchStatus = mjBizAppsAccountingJournalEntryBatchEntityType['Status'];

export interface GetJournalEntryStatesInput {
  /** Up to {@link MAX_JOURNAL_ENTRY_STATE_IDS} journal entry ids. An empty list returns no states. */
  JournalEntryIDs: string[];
}

export interface JournalEntryState {
  /** The id as the caller sent it. */
  JournalEntryID: string;
  /** False when no entry has this id; every other field is then null. */
  Found: boolean;
  Status: JournalEntryStatus | null;
  /** Calendar day, `YYYY-MM-DD`. */
  EffectiveDate: CalendarDay | null;
  JournalEntryBatchID: string | null;
  /** The owning batch's status; null when the entry is not in a batch. */
  JournalEntryBatchStatus: JournalEntryBatchStatus | null;
}

export interface GetJournalEntryStatesOutput {
  /** One state per requested id, in request order. */
  States: JournalEntryState[];
}

interface JournalEntryRow { ID: string; Status: JournalEntryStatus; EffectiveDate: Date | string; JournalEntryBatchID: string | null }
interface JournalEntryBatchRow { ID: string; Status: JournalEntryBatchStatus }

@RegisterClass(BaseRemotableOperation, 'Accounting.GetJournalEntryStates')
export class GetJournalEntryStatesOperation extends BaseRemotableOperation<GetJournalEntryStatesInput, GetJournalEntryStatesOutput> {
  public readonly OperationKey = 'Accounting.GetJournalEntryStates';
  public readonly RequiredScope = 'accounting:read';

  protected async InternalExecute(input: GetJournalEntryStatesInput, provider: IMetadataProvider, user: UserInfo): Promise<GetJournalEntryStatesOutput> {
    const ids = validateIds(input?.JournalEntryIDs);
    if (ids.length === 0) return { States: [] };

    const rv = new RunView(provider as unknown as IRunViewProvider);
    const entries = await readRows<JournalEntryRow>(rv, JE_ENTITY, ids, ['ID', 'Status', 'EffectiveDate', 'JournalEntryBatchID'], user);
    const batchIds = [...new Set(entries.map(e => e.JournalEntryBatchID).filter((id): id is string => !!id))];
    const batches = await readRows<JournalEntryBatchRow>(rv, BATCH_ENTITY, batchIds, ['ID', 'Status'], user);

    const entryById = new Map(entries.map(e => [e.ID.toLowerCase(), e]));
    const batchStatusById = new Map(batches.map(b => [b.ID.toLowerCase(), b.Status]));
    return { States: ids.map(id => toState(id, entryById.get(id.toLowerCase()), batchStatusById)) };
  }
}

/** Refuse anything but an array of at most the cap, every element a UUID. */
function validateIds(ids: string[] | undefined): string[] {
  if (!Array.isArray(ids)) throw new Error(`${CONTEXT}: JournalEntryIDs is required and must be an array.`);
  if (ids.length > MAX_JOURNAL_ENTRY_STATE_IDS) {
    throw new Error(`${CONTEXT}: ${ids.length} ids requested; at most ${MAX_JOURNAL_ENTRY_STATE_IDS} per call.`);
  }
  for (const id of ids) requireSqlGuid(id, `${CONTEXT}: JournalEntryIDs`);
  return ids;
}

/** One `ID IN (...)` read. The ids are validated before they are embedded; a failed read throws. */
async function readRows<T>(rv: RunView, entityName: string, ids: string[], fields: string[], user: UserInfo): Promise<T[]> {
  if (ids.length === 0) return [];
  const inList = [...new Set(ids.map(id => id.toLowerCase()))].map(id => sqlGuidLiteral(id, CONTEXT)).join(',');
  const res = await rv.RunView<T>({ EntityName: entityName, ExtraFilter: `ID IN (${inList})`, Fields: fields, ResultType: 'simple', BypassCache: true }, user);
  if (!res.Success) throw new Error(`${CONTEXT}: reading ${entityName} failed: ${res.ErrorMessage ?? 'unknown error'}`);
  return res.Results ?? [];
}

function toState(id: string, entry: JournalEntryRow | undefined, batchStatusById: Map<string, JournalEntryBatchStatus>): JournalEntryState {
  if (!entry) {
    return { JournalEntryID: id, Found: false, Status: null, EffectiveDate: null, JournalEntryBatchID: null, JournalEntryBatchStatus: null };
  }
  const batchId = entry.JournalEntryBatchID ?? null;
  return {
    JournalEntryID: id,
    Found: true,
    Status: entry.Status,
    EffectiveDate: ToCalendarDay(entry.EffectiveDate),
    JournalEntryBatchID: batchId,
    JournalEntryBatchStatus: batchId ? batchStatusById.get(batchId.toLowerCase()) ?? null : null,
  };
}

/** Tree-shaking anchor — called from the app's server bootstrap so the registration is retained. */
export function LoadGetJournalEntryStatesOperation(): void {
  // intentionally empty
}
