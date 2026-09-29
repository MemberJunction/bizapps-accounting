/**
 * Finance exceptions (golive #279) — the logic behind the three remote operations.
 *
 *   GetFinanceExceptionTypes   the detectors' thresholds (read-only)
 *   RaiseFinanceExceptions     idempotent raise from a consuming app, joining its transaction
 *   ClearFinanceException      a reviewer who did not create the source record clears one
 *
 * WHO READS AND WRITES. The callers are detectors running as whoever triggered them — the user
 * booking an order, the user attesting progress, a nightly job — and none of them holds rights on
 * the exception tables, nor should they. Past each operation's own checks the operation is the
 * authority, so every read and write here is made as the MJ system user. The person still shows:
 * the raiser names the source record's creator, and a clearance records its reviewer in
 * ReviewedByUserID.
 *
 * WHO MAY RAISE. The raise names the source record's creator, and that decides who may clear the
 * row, so a raise is trusted input. `Accounting.RaiseFinanceExceptions` is marked RequiresSystemUser:
 * the API refuses it to anyone but the system user. The consuming apps' detectors call it in-process
 * (server code, through the provider), which that gate does not apply to.
 *
 * CONCURRENCY. Both writes read under an update lock inside their transaction, so two callers on
 * the same row run one after the other: a second raise of an item finds the first one's row instead
 * of failing on UQ_FinanceException_Type_DedupeKey, and a second clear of a row finds it no longer
 * Open instead of overwriting the first reviewer.
 *
 * FAILURE MODEL. Logical failures come back inside the output as `Success: false` with coded
 * `Errors`; the operations never throw for them.
 */
import {
  AuthorizationEvaluator,
  EntityInfo,
  IMetadataProvider,
  IRunViewProvider,
  LogError,
  UserInfo,
} from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import { UserCache } from '@memberjunction/generic-database-provider';
import type { SQLServerDataProvider } from '@memberjunction/sqlserver-dataprovider';
import { FromCalendarDay, IsCalendarDay } from '@mj-biz-apps/common-entities';
import type {
  AccountingClearFinanceExceptionInput,
  AccountingClearFinanceExceptionOutput,
  AccountingFinanceExceptionToRaise,
  AccountingFinanceExceptionTypeSetting,
  AccountingGetFinanceExceptionTypesError,
  AccountingGetFinanceExceptionTypesInput,
  AccountingGetFinanceExceptionTypesOutput,
  AccountingRaiseFinanceExceptionResult,
  AccountingRaiseFinanceExceptionsError,
  AccountingRaiseFinanceExceptionsInput,
  AccountingRaiseFinanceExceptionsOutput,
} from '@mj-biz-apps/accounting-entities';
import {
  FINANCE_EXCEPTION_ENTITY,
  FinanceExceptionEntityServer,
  SaveFinanceExceptionClearance,
} from './FinanceExceptionEntityServer.js';
import { isSqlGuid } from './SqlGuards.js';

const FINANCE_EXCEPTION_TABLE = '__mj_BizAppsAccounting.FinanceException';
export const FINANCE_EXCEPTION_TYPE_ENTITY = 'MJ_BizApps_Accounting: Finance Exception Types';
/** Held by the Finance role. Fails closed: an authorization missing from the catalog is held by nobody. */
export const FINANCE_EXCEPTIONS_CLEAR_AUTH = 'MJ.BizApps.Accounting.FinanceExceptions.Clear';

/** Keys per existence lookup, so one filter stays a reasonable size however many are raised. */
const EXISTING_LOOKUP_CHUNK = 100;

interface FinanceExceptionTypeRow {
  ID: string;
  Code: string;
  IsActive: boolean;
  Configuration: string | null;
}

interface ExistingExceptionRow {
  ID: string;
  FinanceExceptionTypeID: string;
  DedupeKey: string;
  Status: string;
  SourceCreatedByUserID: string | null;
  CreatorUnresolved: boolean;
}

/** A validated raise, with its type and source entity resolved. */
interface ResolvedRaise {
  Index: number;
  Input: AccountingFinanceExceptionToRaise;
  Type: FinanceExceptionTypeRow;
  SourceEntityID: string;
}

// ─── shared ──────────────────────────────────────────────────────────────────

/** The MJ system user every read and write here is made as (see the header). */
export function FinanceLedgerUser(): UserInfo {
  const user = UserCache.Instance.GetSystemUser();
  if (!user) {
    throw new Error('Finance exceptions need the MJ system user, and the user cache does not hold it.');
  }
  return user;
}

function runViewProvider(provider: IMetadataProvider): IRunViewProvider {
  return provider as unknown as IRunViewProvider;
}

/** The server provider: transactions, and ExecuteSQL with named parameters (see SequenceService). */
function database(provider: IMetadataProvider): SQLServerDataProvider {
  return provider as unknown as SQLServerDataProvider;
}

/**
 * Runs `work` in the caller's transaction when there is one, otherwise in its own — the same
 * join rule as AccountingEngine.CreateJournalEntries. A joined transaction is the caller's to
 * commit or roll back: a failure here is reported, and the caller decides.
 */
async function inTransaction<T>(provider: IMetadataProvider, operation: string, work: () => Promise<T>): Promise<T> {
  const db = database(provider);
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
        LogError(`${operation} rollback failed: ${rollbackError}`);
      }
    }
    throw e;
  }
}

async function loadFinanceExceptionTypes(provider: IMetadataProvider, ledger: UserInfo): Promise<FinanceExceptionTypeRow[]> {
  const result = await runViewProvider(provider).RunView<FinanceExceptionTypeRow>(
    {
      EntityName: FINANCE_EXCEPTION_TYPE_ENTITY,
      Fields: ['ID', 'Code', 'IsActive', 'Configuration'],
      ResultType: 'simple',
    },
    ledger,
  );
  if (!result.Success) {
    throw new Error(`Could not read finance exception types: ${result.ErrorMessage}`);
  }
  return result.Results ?? [];
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// ─── Accounting.GetFinanceExceptionTypes ─────────────────────────────────────

/** Parses a type's Configuration; null when it is not a JSON object. */
export function ParseFinanceExceptionConfiguration(raw: string | null | undefined): Record<string, unknown> | null {
  if (!hasText(raw)) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function GetFinanceExceptionTypes(
  input: AccountingGetFinanceExceptionTypesInput | null | undefined,
  provider: IMetadataProvider,
): Promise<AccountingGetFinanceExceptionTypesOutput> {
  const wanted = new Set((input?.Codes ?? []).filter(hasText).map(c => c.trim()));
  const rows = (await loadFinanceExceptionTypes(provider, FinanceLedgerUser())).filter(r => wanted.size === 0 || wanted.has(r.Code));
  const Types: AccountingFinanceExceptionTypeSetting[] = [];
  const Errors: AccountingGetFinanceExceptionTypesError[] = [];
  for (const row of rows) {
    const Configuration = ParseFinanceExceptionConfiguration(row.Configuration);
    if (Configuration) {
      Types.push({ Code: row.Code, IsActive: !!row.IsActive, Configuration });
    } else {
      Errors.push({ Code: 'CONFIGURATION_INVALID', Message: `Finance exception type ${row.Code} has a Configuration that is not a JSON object; its detector should skip until it is fixed.` });
    }
  }
  return Errors.length > 0 ? { Success: false, Types, Errors } : { Success: true, Types };
}

// ─── Accounting.RaiseFinanceExceptions ───────────────────────────────────────

/** Every reason one raise is malformed, before its type and entity are looked at. */
function shapeErrors(raise: AccountingFinanceExceptionToRaise, index: number): AccountingRaiseFinanceExceptionsError[] {
  const errors: AccountingRaiseFinanceExceptionsError[] = [];
  const fail = (Code: string, Message: string) => errors.push({ Index: index, Code, Message });
  if (!hasText(raise?.TypeCode)) fail('TYPE_CODE_REQUIRED', 'TypeCode is required.');
  if (!hasText(raise?.SourceEntityName)) fail('SOURCE_ENTITY_REQUIRED', 'SourceEntityName is required.');
  if (!hasText(raise?.SourceRecordID)) fail('SOURCE_RECORD_REQUIRED', 'SourceRecordID is required.');
  if (!isSqlGuid(raise?.CompanyID)) fail('COMPANY_INVALID', `CompanyID '${String(raise?.CompanyID)}' is not a valid UUID.`);
  if (!IsCalendarDay(raise?.ExceptionDate)) fail('EXCEPTION_DATE_INVALID', `ExceptionDate '${String(raise?.ExceptionDate)}' is not a YYYY-MM-DD day.`);
  if (!hasText(raise?.Summary)) fail('SUMMARY_REQUIRED', 'Summary is required.');
  if (!hasText(raise?.DedupeKey)) fail('DEDUPE_KEY_REQUIRED', 'DedupeKey is required.');
  if (raise?.SourceCreatedByUserID != null && !isSqlGuid(raise.SourceCreatedByUserID)) {
    fail('SOURCE_CREATOR_INVALID', `SourceCreatedByUserID '${raise.SourceCreatedByUserID}' is not a valid UUID.`);
  }
  if (raise?.Amount != null && !Number.isFinite(raise.Amount)) fail('AMOUNT_INVALID', 'Amount must be a finite number or null.');
  return errors;
}

function findEntity(provider: IMetadataProvider, name: string): EntityInfo | undefined {
  const wanted = name.trim().toLowerCase();
  return provider.Entities.find(e => e.Name.trim().toLowerCase() === wanted);
}

/** Validates every raise and resolves its type and source entity. Any error means nothing is written. */
function resolveRaises(
  exceptions: AccountingFinanceExceptionToRaise[],
  types: FinanceExceptionTypeRow[],
  provider: IMetadataProvider,
): { resolved: ResolvedRaise[]; errors: AccountingRaiseFinanceExceptionsError[] } {
  const typeByCode = new Map(types.map(t => [t.Code, t]));
  const resolved: ResolvedRaise[] = [];
  const errors: AccountingRaiseFinanceExceptionsError[] = [];
  exceptions.forEach((raise, index) => {
    const shape = shapeErrors(raise, index);
    if (shape.length > 0) {
      errors.push(...shape);
      return;
    }
    const type = typeByCode.get(raise.TypeCode.trim());
    const entity = findEntity(provider, raise.SourceEntityName);
    if (!type) errors.push({ Index: index, Code: 'TYPE_UNKNOWN', Message: `No finance exception type has the code '${raise.TypeCode}'.` });
    if (!entity) errors.push({ Index: index, Code: 'SOURCE_ENTITY_UNKNOWN', Message: `No entity is named '${raise.SourceEntityName}'.` });
    if (type && entity) resolved.push({ Index: index, Input: raise, Type: type, SourceEntityID: entity.ID });
  });
  return { resolved, errors };
}

/** Case-insensitive identity of a (type, DedupeKey) pair. */
function dedupeIdentity(typeID: string, dedupeKey: string): string {
  return `${typeID.toLowerCase()}|${dedupeKey.toLowerCase()}`;
}

function sqlNString(value: string): string {
  return `N'${value.replace(/'/g, "''")}'`;
}

/**
 * The locking existence read for one chunk. UPDLOCK + HOLDLOCK take key-range locks on
 * UQ_FinanceException_Type_DedupeKey, found or not, until the transaction ends, so a concurrent
 * raise of the same item waits and then reads this one's row.
 */
function existingLookupSql(chunk: ResolvedRaise[]): string {
  const byType = new Map<string, string[]>();
  for (const r of chunk) {
    byType.set(r.Type.ID, [...(byType.get(r.Type.ID) ?? []), r.Input.DedupeKey]);
  }
  // Type IDs come from the database and DedupeKeys are quoted string literals, so neither can
  // change the shape of the predicate.
  const clauses = [...byType.entries()].map(
    ([typeID, keys]) => `(FinanceExceptionTypeID = '${typeID}' AND DedupeKey IN (${keys.map(sqlNString).join(', ')}))`,
  );
  return `SELECT ID, FinanceExceptionTypeID, DedupeKey, Status, SourceCreatedByUserID, CreatorUnresolved
    FROM ${FINANCE_EXCEPTION_TABLE} WITH (UPDLOCK, HOLDLOCK)
    WHERE ${clauses.join(' OR ')}`;
}

/** Existing rows for the raises, keyed by dedupeIdentity. Call inside the raise's transaction. */
async function loadExisting(raises: ResolvedRaise[], provider: IMetadataProvider, ledger: UserInfo): Promise<Map<string, ExistingExceptionRow>> {
  const existing = new Map<string, ExistingExceptionRow>();
  for (let i = 0; i < raises.length; i += EXISTING_LOOKUP_CHUNK) {
    const rows: ExistingExceptionRow[] = await database(provider).ExecuteSQL(
      existingLookupSql(raises.slice(i, i + EXISTING_LOOKUP_CHUNK)),
      null,
      { description: 'Accounting.RaiseFinanceExceptions: existing rows (locking read)' },
      ledger,
    );
    for (const row of rows ?? []) existing.set(dedupeIdentity(row.FinanceExceptionTypeID, row.DedupeKey), row);
  }
  return existing;
}

async function writeException(raise: ResolvedRaise, provider: IMetadataProvider, ledger: UserInfo): Promise<string> {
  const entity = await provider.GetEntityObject<FinanceExceptionEntityServer>(FINANCE_EXCEPTION_ENTITY, ledger);
  entity.NewRecord();
  const input = raise.Input;
  entity.FinanceExceptionTypeID = raise.Type.ID;
  entity.SourceEntityID = raise.SourceEntityID;
  entity.SourceRecordID = input.SourceRecordID.trim();
  entity.CompanyID = input.CompanyID;
  entity.Amount = input.Amount ?? null;
  entity.ExceptionDate = FromCalendarDay(input.ExceptionDate);
  entity.DetectedAt = new Date();
  entity.Summary = input.Summary.trim();
  entity.DedupeKey = input.DedupeKey;
  entity.SourceCreatedByUserID = input.SourceCreatedByUserID ?? null;
  entity.CreatorUnresolved = !!input.CreatorUnresolved;
  entity.Status = 'Open';
  if (!(await entity.Save())) {
    throw new Error(`Could not raise finance exception ${input.TypeCode} / ${input.DedupeKey}: ${entity.LatestResult?.CompleteMessage ?? 'save failed'}`);
  }
  return entity.ID;
}

/** Whether a repeat raise carries a different answer to "who created the source record". */
function creatorChanged(row: ExistingExceptionRow, input: AccountingFinanceExceptionToRaise): boolean {
  const wanted = input.SourceCreatedByUserID ?? null;
  const sameUser = wanted === null ? row.SourceCreatedByUserID === null : UUIDsEqual(row.SourceCreatedByUserID ?? '', wanted);
  return !sameUser || !!row.CreatorUnresolved !== !!input.CreatorUnresolved;
}

/**
 * Brings an Open row's creator up to date with the latest raise. A creator can become known after
 * the row was raised (a deal owner's login is linked later), and nothing else can edit the row, so
 * without this an unresolved row could never be cleared. Reviewed and Corrected rows are final and
 * never touched. The summary moves with the creator because it describes who that is.
 */
async function refreshCreator(row: ExistingExceptionRow, raise: ResolvedRaise, provider: IMetadataProvider, ledger: UserInfo): Promise<boolean> {
  if (row.Status !== 'Open' || !creatorChanged(row, raise.Input)) return false;
  const entity = await provider.GetEntityObject<FinanceExceptionEntityServer>(FINANCE_EXCEPTION_ENTITY, ledger);
  if (!(await entity.Load(row.ID))) throw new Error(`Could not load finance exception ${row.ID} to refresh its creator.`);
  entity.SourceCreatedByUserID = raise.Input.SourceCreatedByUserID ?? null;
  entity.CreatorUnresolved = !!raise.Input.CreatorUnresolved;
  entity.Summary = raise.Input.Summary.trim();
  if (!(await entity.Save())) {
    throw new Error(`Could not refresh the creator on finance exception ${row.ID}: ${entity.LatestResult?.CompleteMessage ?? 'save failed'}`);
  }
  row.SourceCreatedByUserID = entity.SourceCreatedByUserID;
  row.CreatorUnresolved = entity.CreatorUnresolved;
  return true;
}

/**
 * Writes the raises that have no row yet, in order, and returns every result. A raise whose
 * (type, DedupeKey) repeats an earlier one in the same call returns that one's row. A repeat of an
 * Open row refreshes its creator (see refreshCreator); nothing else about an existing row changes.
 */
async function writeRaises(
  raises: ResolvedRaise[],
  existing: Map<string, ExistingExceptionRow>,
  provider: IMetadataProvider,
  ledger: UserInfo,
): Promise<AccountingRaiseFinanceExceptionResult[]> {
  const results: AccountingRaiseFinanceExceptionResult[] = [];
  for (const raise of raises) {
    if (!raise.Type.IsActive) {
      results.push({ Index: raise.Index, Created: false, Skipped: true });
      continue;
    }
    const identity = dedupeIdentity(raise.Type.ID, raise.Input.DedupeKey);
    const found = existing.get(identity);
    if (found) {
      await refreshCreator(found, raise, provider, ledger);
      results.push({ Index: raise.Index, FinanceExceptionID: found.ID, Created: false });
      continue;
    }
    const id = await writeException(raise, provider, ledger);
    existing.set(identity, {
      ID: id,
      FinanceExceptionTypeID: raise.Type.ID,
      DedupeKey: raise.Input.DedupeKey,
      Status: 'Open',
      SourceCreatedByUserID: raise.Input.SourceCreatedByUserID ?? null,
      CreatorUnresolved: !!raise.Input.CreatorUnresolved,
    });
    results.push({ Index: raise.Index, FinanceExceptionID: id, Created: true });
  }
  return results;
}

export async function RaiseFinanceExceptions(
  input: AccountingRaiseFinanceExceptionsInput | null | undefined,
  provider: IMetadataProvider,
): Promise<AccountingRaiseFinanceExceptionsOutput> {
  if (!Array.isArray(input?.Exceptions)) {
    return { Success: false, Results: [], Errors: [{ Code: 'MALFORMED_INPUT', Message: 'Exceptions must be an array.' }] };
  }
  if (input.Exceptions.length === 0) return { Success: true, Results: [] };

  const ledger = FinanceLedgerUser();
  const types = await loadFinanceExceptionTypes(provider, ledger);
  const { resolved, errors } = resolveRaises(input.Exceptions, types, provider);
  if (errors.length > 0) return { Success: false, Results: [], Errors: errors };

  try {
    const Results = await inTransaction(provider, 'Accounting.RaiseFinanceExceptions', async () => {
      const existing = await loadExisting(resolved.filter(r => r.Type.IsActive), provider, ledger);
      return writeRaises(resolved, existing, provider, ledger);
    });
    return { Success: true, Results };
  } catch (e) {
    const Message = e instanceof Error ? e.message : String(e);
    LogError(`Accounting.RaiseFinanceExceptions failed: ${Message}`);
    return { Success: false, Results: [], Errors: [{ Code: 'WRITE_FAILED', Message }] };
  }
}

// ─── Accounting.ClearFinanceException ────────────────────────────────────────

type ClearRefusal = { Code: string; Message: string };

export function UserCanClearFinanceExceptions(user: UserInfo | null | undefined, provider: IMetadataProvider): boolean {
  if (!user) return false;
  const catalog = provider.Authorizations ?? [];
  const auth = catalog.find(a => a.Name === FINANCE_EXCEPTIONS_CLEAR_AUTH);
  return !!auth && new AuthorizationEvaluator().UserCanExecuteWithAncestors(auth, user, catalog);
}

function inputRefusal(input: AccountingClearFinanceExceptionInput | null | undefined): ClearRefusal | null {
  if (!isSqlGuid(input?.FinanceExceptionID)) {
    return { Code: 'FINANCE_EXCEPTION_ID_INVALID', Message: `FinanceExceptionID '${String(input?.FinanceExceptionID)}' is not a valid UUID.` };
  }
  if (input.Outcome !== 'Reviewed' && input.Outcome !== 'Corrected') {
    return { Code: 'OUTCOME_INVALID', Message: `Outcome must be Reviewed or Corrected, not '${String(input.Outcome)}'.` };
  }
  if (!hasText(input.Note)) {
    return { Code: 'NOTE_REQUIRED', Message: 'A note saying what was checked or changed is required to clear a finance exception.' };
  }
  return null;
}

/**
 * The creator has no linked login, so whether the reviewer is the creator cannot be checked, and
 * clearing is refused (golive #279). The row's summary is appended because the raising app names
 * the creator there, so the message says whose login to link. Once it is linked, the next raise
 * refreshes the row (refreshCreator) and it can be cleared.
 */
function creatorUnresolvedRefusal(record: FinanceExceptionEntityServer): ClearRefusal | null {
  if (!record.CreatorUnresolved) return null;
  return {
    Code: 'CREATOR_UNRESOLVED',
    Message:
      "The record's creator has no linked login, so separation of duties cannot be checked. Link the creator " +
      `to a login; the exception can be cleared after the next check refreshes it. ${record.Summary}`,
  };
}

function recordRefusal(record: FinanceExceptionEntityServer, reviewer: UserInfo): ClearRefusal | null {
  if (record.Status !== 'Open') {
    return { Code: 'NOT_OPEN', Message: `Finance exception ${record.ID} is already ${record.Status}.` };
  }
  if (record.SourceCreatedByUserID && UUIDsEqual(record.SourceCreatedByUserID, reviewer.ID)) {
    return { Code: 'CREATOR_CANNOT_CLEAR', Message: 'You created the record this exception is about, so someone else must review it.' };
  }
  return creatorUnresolvedRefusal(record);
}

export async function ClearFinanceException(
  input: AccountingClearFinanceExceptionInput | null | undefined,
  provider: IMetadataProvider,
  reviewer: UserInfo,
): Promise<AccountingClearFinanceExceptionOutput> {
  // FIRST, BEFORE ANY READ: who may clear is the control.
  if (!UserCanClearFinanceExceptions(reviewer, provider)) {
    return { Success: false, Errors: [{ Code: 'NOT_AUTHORIZED', Message: `Clearing a finance exception requires the ${FINANCE_EXCEPTIONS_CLEAR_AUTH} authorization (the Finance role).` }] };
  }
  const invalid = inputRefusal(input);
  if (invalid || !input) return { Success: false, Errors: [invalid ?? { Code: 'MALFORMED_INPUT', Message: 'Input is required.' }] };

  try {
    return await inTransaction(provider, 'Accounting.ClearFinanceException', () => clearLocked(input, provider, reviewer));
  } catch (e) {
    const Message = e instanceof Error ? e.message : String(e);
    LogError(`Accounting.ClearFinanceException failed: ${Message}`);
    return { Success: false, Status: 'Open', Errors: [{ Code: 'SAVE_FAILED', Message }] };
  }
}

/**
 * Locks the row, then reads, checks and saves it. The lock makes a concurrent clear of the same
 * row wait and then see it no longer Open (NOT_OPEN), rather than both saves succeeding and the
 * second overwriting the first reviewer and note. A failed save throws, so the transaction rolls back.
 */
async function clearLocked(
  input: AccountingClearFinanceExceptionInput,
  provider: IMetadataProvider,
  reviewer: UserInfo,
): Promise<AccountingClearFinanceExceptionOutput> {
  const ledger = FinanceLedgerUser();
  await database(provider).ExecuteSQL(
    `SELECT ID FROM ${FINANCE_EXCEPTION_TABLE} WITH (UPDLOCK, ROWLOCK) WHERE ID = @ID`,
    { ID: input.FinanceExceptionID },
    { description: 'Accounting.ClearFinanceException: lock the row' },
    ledger,
  );
  const record = await provider.GetEntityObject<FinanceExceptionEntityServer>(FINANCE_EXCEPTION_ENTITY, ledger);
  if (!(await record.Load(input.FinanceExceptionID))) {
    return { Success: false, Errors: [{ Code: 'NOT_FOUND', Message: `No finance exception has the ID ${input.FinanceExceptionID}.` }] };
  }
  const refusal = recordRefusal(record, reviewer);
  if (refusal) return { Success: false, Status: record.Status, Errors: [refusal] };

  record.Status = input.Outcome;
  record.ReviewedByUserID = reviewer.ID;
  record.ReviewedAt = new Date();
  record.ReviewNote = input.Note.trim();
  if (!(await SaveFinanceExceptionClearance(record))) {
    throw new Error(`Could not clear finance exception ${record.ID}: ${record.LatestResult?.CompleteMessage ?? 'save failed'}`);
  }
  return { Success: true, Status: record.Status };
}
