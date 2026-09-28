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
 * FAILURE MODEL. Logical failures come back inside the output as `Success: false` with coded
 * `Errors`; the operations never throw for them.
 */
import {
  AuthorizationEvaluator,
  DatabaseProviderBase,
  EntityInfo,
  IMetadataProvider,
  IRunViewProvider,
  LogError,
  RunViewParams,
  UserInfo,
} from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import { UserCache } from '@memberjunction/generic-database-provider';
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

function existingLookup(chunk: ResolvedRaise[]): RunViewParams {
  const byType = new Map<string, string[]>();
  for (const r of chunk) {
    byType.set(r.Type.ID, [...(byType.get(r.Type.ID) ?? []), r.Input.DedupeKey]);
  }
  // Type IDs come from the database and DedupeKeys are quoted string literals, so neither can
  // change the shape of the predicate.
  const clauses = [...byType.entries()].map(
    ([typeID, keys]) => `(FinanceExceptionTypeID = '${typeID}' AND DedupeKey IN (${keys.map(sqlNString).join(', ')}))`,
  );
  return {
    EntityName: FINANCE_EXCEPTION_ENTITY,
    ExtraFilter: clauses.join(' OR '),
    Fields: ['ID', 'FinanceExceptionTypeID', 'DedupeKey'],
    ResultType: 'simple',
  };
}

/** Existing rows for the raises, keyed by dedupeIdentity. */
async function loadExisting(raises: ResolvedRaise[], provider: IMetadataProvider, ledger: UserInfo): Promise<Map<string, string>> {
  const existing = new Map<string, string>();
  if (raises.length === 0) return existing;
  const params: RunViewParams[] = [];
  for (let i = 0; i < raises.length; i += EXISTING_LOOKUP_CHUNK) {
    params.push(existingLookup(raises.slice(i, i + EXISTING_LOOKUP_CHUNK)));
  }
  const results = await runViewProvider(provider).RunViews<ExistingExceptionRow>(params, ledger);
  for (const result of results) {
    if (!result.Success) throw new Error(`Could not read existing finance exceptions: ${result.ErrorMessage}`);
    for (const row of result.Results ?? []) existing.set(dedupeIdentity(row.FinanceExceptionTypeID, row.DedupeKey), row.ID);
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

/**
 * Writes the raises that have no row yet, in order, and returns every result. A raise whose
 * (type, DedupeKey) repeats an earlier one in the same call returns that one's row.
 */
async function writeRaises(
  raises: ResolvedRaise[],
  existing: Map<string, string>,
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
      results.push({ Index: raise.Index, FinanceExceptionID: found, Created: false });
      continue;
    }
    const id = await writeException(raise, provider, ledger);
    existing.set(identity, id);
    results.push({ Index: raise.Index, FinanceExceptionID: id, Created: true });
  }
  return results;
}

/**
 * Runs `work` in the caller's transaction when there is one, otherwise in its own — the same
 * join rule as AccountingEngine.CreateJournalEntries. A joined transaction is the caller's to
 * commit or roll back: a failure here is reported, and the caller decides.
 */
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
        LogError(`RaiseFinanceExceptions rollback failed: ${rollbackError}`);
      }
    }
    throw e;
  }
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
    const existing = await loadExisting(resolved.filter(r => r.Type.IsActive), provider, ledger);
    const Results = await inTransaction(provider, () => writeRaises(resolved, existing, provider, ledger));
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
 * The creator has no linked login, so whether the reviewer is the creator cannot be checked.
 * Kept as its own rule because whether it should block is still an open question on golive #279.
 */
function creatorUnresolvedRefusal(record: FinanceExceptionEntityServer): ClearRefusal | null {
  if (!record.CreatorUnresolved) return null;
  return {
    Code: 'CREATOR_UNRESOLVED',
    Message: "The record's creator has no linked login, so separation of duties cannot be checked. Link the creator to a login before clearing this exception.",
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

  const record = await provider.GetEntityObject<FinanceExceptionEntityServer>(FINANCE_EXCEPTION_ENTITY, FinanceLedgerUser());
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
    const Message = record.LatestResult?.CompleteMessage ?? 'save failed';
    return { Success: false, Status: 'Open', Errors: [{ Code: 'SAVE_FAILED', Message: `Could not clear finance exception ${record.ID}: ${Message}` }] };
  }
  return { Success: true, Status: record.Status };
}
