/**
 * RedatePendingJournalEntriesOperation — 'Accounting.RedatePendingJournalEntries' (golive #448).
 *
 * Corrects the date of entries that have not left the subledger yet: a payment received on 30 October
 * but entered on 2 November was booked dated 2 November, and a batch posted 30 October leaves it out.
 * Finance corrects the payment's date, and the app that booked it calls this to move its Pending
 * entries to the same day. No reversal and rebook: nothing has reached the ERP, so the entries are
 * re-dated in place (g448.1 A).
 *
 * The entries are named by the booking that created them (LinkedEntity + LinkedRecordIDs, the D25
 * origin pair) or by JournalEntryIDs. ALL OR NOTHING: every entry is checked before any is written,
 * and the writes share one transaction, joining the caller's when there is one (the same rule as
 * Accounting.CreateJournalEntries), so the source app's own date change commits or rolls back with them.
 *
 * REFUSED when the caller lacks the batch-operator Authorization (the Finance role); when any named
 * entry is Batched or GLPosted, or in a batch; when an entry has already been reversed; when the new
 * day is on or before its company's BooksClosedThroughDate, or before its PostingStartDate; or when
 * the move would cross a fiscal year, since the entry number belongs to the old year's series.
 *
 * CONNECTS TO:
 *   ENTITY:  ./JournalEntryEntityServer (SaveRedatedEffectiveDate — the one save that may move EffectiveDate)
 *   RULES:   IsInClosedBooks / FiscalYearOf / UserCanOperateJournalEntryBatches (@mj-biz-apps/accounting-engine-base)
 *   CLIENTS: bizapps-orders "Change payment date" (resolved by key, in-process)
 */
import { BaseRemotableOperation, DatabaseProviderBase, IMetadataProvider, IRunViewProvider, LogError, UserInfo } from '@memberjunction/core';
import { EscapeSQLString, RegisterClass, UUIDsEqual } from '@memberjunction/global';
import {
  DEFAULT_FISCAL_YEAR_START,
  FiscalYearOf,
  FirstOpenDay,
  IsInClosedBooks,
  JOURNAL_ENTRY_BATCH_OPERATE_AUTH,
  UserCanOperateJournalEntryBatches,
} from '@mj-biz-apps/accounting-engine-base';
import { IsCalendarDay, ToCalendarDay, type CalendarDay } from '@mj-biz-apps/common-entities';
import { JournalEntryEntityServer } from './JournalEntryEntityServer.js';
import { isSqlGuid } from './SqlGuards.js';

const OPERATION_KEY = 'Accounting.RedatePendingJournalEntries';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

export interface RedatePendingJournalEntriesInput {
  /** The new day, `YYYY-MM-DD`. */
  EffectiveDate: string;
  /** Name the entries by the booking that created them: the MJ entity name of the source record... */
  LinkedEntity?: string | null;
  /** ...and the source records' IDs. Records with no entries are not an error. */
  LinkedRecordIDs?: string[] | null;
  /** Or name the entries directly. Every ID must exist. */
  JournalEntryIDs?: string[] | null;
}

/** One entry the operation moved. */
export interface RedatedJournalEntry {
  JournalEntryID: string;
  EntryNumber: string;
  PreviousEffectiveDate: string;
  EffectiveDate: string;
}

export interface RedatePendingJournalEntriesOutput {
  EffectiveDate: string;
  /** The entries moved to `EffectiveDate`. */
  Changed: RedatedJournalEntry[];
  /** Entries named that were already on `EffectiveDate`; nothing was written for them. */
  UnchangedJournalEntryIDs: string[];
}

/** The profile columns the date rules read, as the provider returns them. */
export interface CompanyDateRules {
  ID: string;
  BooksClosedThroughDate: Date | string | null;
  PostingStartDate: Date | string | null;
  FiscalYearStartMonth: number | null;
  FiscalYearStartDay: number | null;
}

@RegisterClass(BaseRemotableOperation, OPERATION_KEY)
export class RedatePendingJournalEntriesOperation extends BaseRemotableOperation<RedatePendingJournalEntriesInput, RedatePendingJournalEntriesOutput> {
  public readonly OperationKey = OPERATION_KEY;
  public readonly RequiredScope = 'accounting:write';

  protected async InternalExecute(input: RedatePendingJournalEntriesInput, provider: IMetadataProvider, user: UserInfo): Promise<RedatePendingJournalEntriesOutput> {
    if (!UserCanOperateJournalEntryBatches(user, provider.Authorizations)) {
      throw new Error(`RedatePendingJournalEntries: requires the ${JOURNAL_ENTRY_BATCH_OPERATE_AUTH} authorization (the Finance role).`);
    }
    const day = input?.EffectiveDate;
    if (!IsCalendarDay(day)) throw new Error(`The entries were not re-dated: '${String(day)}' is not a YYYY-MM-DD date.`);

    const entries = await loadNamedEntries(input, provider, user);
    const moving = entries.filter(e => ToCalendarDay(e.EffectiveDate) !== day);
    const unchanged = entries.filter(e => ToCalendarDay(e.EffectiveDate) === day).map(e => e.ID);
    if (moving.length === 0) return { EffectiveDate: day, Changed: [], UnchangedJournalEntryIDs: unchanged };

    const problems = RedateProblems(moving, day, await loadCompanyDateRules(moving, provider, user));
    if (problems.length > 0) throw new Error(`The entries were not re-dated. ${problems.join(' ')}`);

    const changed = await inTransaction(provider, () => saveAll(moving, day));
    return { EffectiveDate: day, Changed: changed, UnchangedJournalEntryIDs: unchanged };
  }
}

/** The entry fields the refusal rules read. */
export interface RedateCandidate {
  ID: string;
  EntryNumber: string;
  CompanyID: string;
  EffectiveDate: Date;
  Status: string;
  JournalEntryBatchID: string | null;
  ReversedByJournalEntryID: string | null;
}

/**
 * Why `entries` cannot move to `day`, one sentence per problem; empty when they can — pure. Every
 * entry is checked, so one refusal names every entry that blocks the change.
 */
export function RedateProblems(entries: RedateCandidate[], day: CalendarDay, rules: CompanyDateRules[]): string[] {
  const problems: string[] = [];
  for (const e of entries) {
    if (e.Status !== 'Pending' || e.JournalEntryBatchID) {
      problems.push(`Journal entry ${e.EntryNumber} is ${e.Status === 'Pending' ? 'in a batch' : e.Status}: its date is fixed once it is batched. Cancel the batch first, or reverse the entry and book it again on the right day.`);
    } else if (e.ReversedByJournalEntryID) {
      problems.push(`Journal entry ${e.EntryNumber} has been reversed, so moving it would leave its reversal dated before it.`);
    }
  }
  for (const companyId of [...new Set(entries.map(e => e.CompanyID.toLowerCase()))]) {
    const rule = rules.find(r => UUIDsEqual(r.ID, companyId));
    problems.push(...companyDateProblems(day, rule));
    const current = entries.filter(e => e.CompanyID.toLowerCase() === companyId);
    problems.push(...fiscalYearProblems(current, day, rule));
  }
  return problems;
}

/** The closed-books and posting-start rules for one company. A company with no profile has neither. */
function companyDateProblems(day: CalendarDay, rule: CompanyDateRules | undefined): string[] {
  const problems: string[] = [];
  const closedThrough = ToCalendarDay(rule?.BooksClosedThroughDate ?? null);
  if (closedThrough && IsInClosedBooks(day, closedThrough)) {
    problems.push(`${day} is in a month finance has closed: the books are closed through ${closedThrough}. Choose ${FirstOpenDay(closedThrough)} or later, or ask finance to reopen the month.`);
  }
  const postingStart = ToCalendarDay(rule?.PostingStartDate ?? null);
  if (postingStart && day < postingStart) {
    problems.push(`${day} is before the company's posting start date ${postingStart}, so no batch would ever take the entries. Choose ${postingStart} or later.`);
  }
  return problems;
}

/** An entry keeps its number, and the number belongs to its fiscal year's series. */
function fiscalYearProblems(entries: RedateCandidate[], day: CalendarDay, rule: CompanyDateRules | undefined): string[] {
  const start = {
    Month: rule?.FiscalYearStartMonth ?? DEFAULT_FISCAL_YEAR_START.Month,
    Day: rule?.FiscalYearStartDay ?? DEFAULT_FISCAL_YEAR_START.Day,
  };
  const target = FiscalYearOf(day, start);
  return entries
    .filter(e => FiscalYearOf(ToCalendarDay(e.EffectiveDate) ?? day, start) !== target)
    .map(e => `Journal entry ${e.EntryNumber} would move into fiscal year ${target}, but its number belongs to fiscal year ${FiscalYearOf(ToCalendarDay(e.EffectiveDate) ?? day, start)}. Reverse it and book it again on the right day instead.`);
}

/** The ExtraFilter for the entries the input names; throws on an input that names none or both. */
export function NamedEntriesFilter(input: RedatePendingJournalEntriesInput, provider: IMetadataProvider): string {
  const byIds = (input.JournalEntryIDs?.length ?? 0) > 0;
  const byLink = !!input.LinkedEntity || (input.LinkedRecordIDs?.length ?? 0) > 0;
  if (byIds === byLink) {
    throw new Error('The entries were not re-dated: name them either by JournalEntryIDs or by LinkedEntity and LinkedRecordIDs, not both or neither.');
  }
  if (byIds) {
    const ids = input.JournalEntryIDs ?? [];
    const bad = ids.filter(id => !isSqlGuid(id));
    if (bad.length > 0) throw new Error(`The entries were not re-dated: ${bad.join(', ')} ${bad.length === 1 ? 'is not a valid ID' : 'are not valid IDs'}.`);
    return `ID IN (${ids.map(id => `'${id}'`).join(',')})`;
  }
  const entity = input.LinkedEntity ? provider.EntityByName(input.LinkedEntity) : undefined;
  if (!entity) throw new Error(`The entries were not re-dated: '${input.LinkedEntity ?? ''}' is not an entity.`);
  const recordIds = (input.LinkedRecordIDs ?? []).filter(id => id && id.trim().length > 0);
  if (recordIds.length === 0) throw new Error(`The entries were not re-dated: no ${entity.Name} records were named.`);
  return `LinkedEntityID='${entity.ID}' AND LinkedRecordID IN (${recordIds.map(id => `'${EscapeSQLString(id)}'`).join(',')})`;
}

/** The named entries as server entities (lines hydrated, which the save's validation reads). */
async function loadNamedEntries(input: RedatePendingJournalEntriesInput, provider: IMetadataProvider, user: UserInfo): Promise<JournalEntryEntityServer[]> {
  const res = await (provider as unknown as IRunViewProvider).RunView<JournalEntryEntityServer>(
    { EntityName: JE_ENTITY, ExtraFilter: NamedEntriesFilter(input, provider), OrderBy: 'EntryNumber ASC', ResultType: 'entity_object', BypassCache: true, IgnoreMaxRows: true },
    user,
  );
  if (!res.Success) throw new Error(`The entries were not re-dated: could not read them: ${res.ErrorMessage ?? 'unknown error'}`);
  const entries = res.Results ?? [];
  const missing = (input.JournalEntryIDs ?? []).filter(id => !entries.some(e => UUIDsEqual(e.ID, id)));
  if (missing.length > 0) throw new Error(`The entries were not re-dated: journal entr${missing.length === 1 ? 'y' : 'ies'} ${missing.join(', ')} ${missing.length === 1 ? 'was' : 'were'} not found.`);
  return entries;
}

/** The date rules of every company the entries belong to, in one read. Fails closed. */
async function loadCompanyDateRules(entries: RedateCandidate[], provider: IMetadataProvider, user: UserInfo): Promise<CompanyDateRules[]> {
  const companyIds = [...new Set(entries.map(e => e.CompanyID.toLowerCase()))].filter(id => isSqlGuid(id));
  const res = await (provider as unknown as IRunViewProvider).RunView<CompanyDateRules>(
    {
      EntityName: ACP_ENTITY,
      ExtraFilter: `ID IN (${companyIds.map(id => `'${id}'`).join(',')})`,
      Fields: ['ID', 'BooksClosedThroughDate', 'PostingStartDate', 'FiscalYearStartMonth', 'FiscalYearStartDay'],
      ResultType: 'simple',
      BypassCache: true,
    },
    user,
  );
  // Guessing "open" on a failed read would re-date entries into a month finance has closed.
  if (!res.Success) throw new Error(`The entries were not re-dated: could not read the companies' closed-books dates: ${res.ErrorMessage ?? 'unknown error'}`);
  return res.Results ?? [];
}

async function saveAll(entries: JournalEntryEntityServer[], day: CalendarDay): Promise<RedatedJournalEntry[]> {
  const changed: RedatedJournalEntry[] = [];
  for (const entry of entries) {
    const previous = ToCalendarDay(entry.EffectiveDate) ?? '';
    if (!(await entry.SaveRedatedEffectiveDate(day))) {
      throw new Error(`Journal entry ${entry.EntryNumber} could not be re-dated: ${entry.LatestResult?.CompleteMessage ?? 'unknown error'}`);
    }
    changed.push({ JournalEntryID: entry.ID, EntryNumber: entry.EntryNumber, PreviousEffectiveDate: previous, EffectiveDate: day });
  }
  return changed;
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
        LogError(`RedatePendingJournalEntries rollback failed: ${rollbackError}`);
      }
    }
    throw e;
  }
}

/** Tree-shaking anchor — called from the app's server bootstrap so the registration is retained. */
export function LoadRedatePendingJournalEntriesOperation(): void {
  // intentionally empty
}
