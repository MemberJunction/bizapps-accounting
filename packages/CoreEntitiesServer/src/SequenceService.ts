/**
 * SequenceService — calls the DB-level atomic numbering routines from
 * TypeScript so EntityServer hooks can assign EntryNumber / JournalEntryBatchNumber
 * before super.Save() commits the row.
 *
 * The routines (spAssignNextJournalEntryNumber, spAssignNextJournalEntryBatchNumber) are
 * intentionally kept at DB level because they require an atomic, row-locked
 * read-modify-write that doesn't translate to app-level code under concurrency.
 * Everything else moves to TypeScript.
 *
 * PLATFORMS: SQL Server has them as stored procedures that return the number through
 * an OUTPUT parameter (baseline migration); PostgreSQL has them as functions of the same
 * name that return it (migrations-pg pg-only migration). The SQL text differs per
 * platform; the parameters are positional on both (`?` binds as @p0.. on SQL Server,
 * `$1..` on PostgreSQL).
 *
 * PROVIDER: injected, required — no global fallback. Callers are the entity
 * servers, which pass their own ProviderToUse (so the call rides the
 * same connection context as the save it numbers).
 */

import {
  DatabasePlatform,
  DatabaseProviderBase,
  DocumentNumberingEngine,
  type DocumentScopeResolutionContext,
  type DocumentSequenceAllocationRequest,
  type IDocumentNumberPolicy,
  type IDocumentSequenceStore,
  IMetadataProvider,
  UserInfo,
} from '@memberjunction/core';
import { AccountingEngineBase, FiscalYearOf } from '@mj-biz-apps/accounting-engine-base';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';

const ACCOUNTING_SCHEMA = '__mj_BizAppsAccounting';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

/**
 * The migrations-pg files create the schema and the functions quoted, so both keep their case
 * (migrations-pg/README.md). Unquoted, PostgreSQL would fold the schema to a different, empty one.
 */
const ACCOUNTING_SCHEMA_PG = `"${ACCOUNTING_SCHEMA}"`;

/** The SQL that returns the next number in one column, per platform. */
type NumberingSQL = Record<DatabasePlatform, string>;

const JOURNAL_ENTRY_NUMBER_SQL: NumberingSQL = {
  sqlserver: `
    DECLARE @entryNumber NVARCHAR(40);
    EXEC ${ACCOUNTING_SCHEMA}.spAssignNextJournalEntryNumber
        @CompanyID = ?,
        @FiscalYear = ?,
        @EntryNumber = @entryNumber OUTPUT;
    SELECT @entryNumber AS EntryNumber;
  `,
  postgresql: `SELECT ${ACCOUNTING_SCHEMA_PG}."spAssignNextJournalEntryNumber"($1::uuid, $2::integer) AS EntryNumber`,
};

const JOURNAL_ENTRY_BATCH_NUMBER_SQL: NumberingSQL = {
  sqlserver: `
    DECLARE @batchNumber NVARCHAR(40);
    EXEC ${ACCOUNTING_SCHEMA}.spAssignNextJournalEntryBatchNumber
        @JournalEntryBatchNumber = @batchNumber OUTPUT;
    SELECT @batchNumber AS JournalEntryBatchNumber;
  `,
  postgresql: `SELECT ${ACCOUNTING_SCHEMA_PG}."spAssignNextJournalEntryBatchNumber"() AS JournalEntryBatchNumber`,
};

export const JOURNAL_ENTRY_NUMBER_POLICY: IDocumentNumberPolicy = {
  targetField: 'EntryNumber',
  sequenceKey: `${JE_ENTITY}.EntryNumber`,
  pattern: 'JE-{Scope:CompanyCode}-{FY}-{SEQ:6}',
  prefix: 'JE',
  scopeFields: ['CompanyID'],
  resetPeriod: 'FiscalYear',
  dateSourceField: 'EffectiveDate',
  manualValueMode: 'AllowAny',
  immutableAfterCreate: true,
};

export const JOURNAL_ENTRY_BATCH_NUMBER_POLICY: IDocumentNumberPolicy = {
  targetField: 'JournalEntryBatchNumber',
  sequenceKey: `${BATCH_ENTITY}.JournalEntryBatchNumber`,
  pattern: 'BATCH-{SEQ:6}',
  prefix: 'BATCH',
  resetPeriod: 'Never',
  manualValueMode: 'AllowAny',
  immutableAfterCreate: true,
};

export const JOURNAL_ENTRY_BATCH_NUMBER_ALIAS_POLICY: IDocumentNumberPolicy = {
  ...JOURNAL_ENTRY_BATCH_NUMBER_POLICY,
  targetField: 'BatchNumber',
  sequenceKey: `${BATCH_ENTITY}.BatchNumber`,
};

/**
 * Sequence store adapter that delegates counter allocation to the accounting schema's
 * atomic database routines (`spAssignNextJournalEntryNumber` / `spAssignNextJournalEntryBatchNumber`).
 */
export class CustomRoutineDocumentSequenceStore implements IDocumentSequenceStore {
  public async AllocateJournalEntryNumber(
    companyId: string,
    fiscalYear: number,
    contextUser: UserInfo | undefined,
    provider: IMetadataProvider,
  ): Promise<string> {
    const database = getDatabaseProvider(provider);
    const rows = await database.ExecuteSQL<{ EntryNumber: string | null }>(
      JOURNAL_ENTRY_NUMBER_SQL[database.PlatformKey],
      [companyId, fiscalYear],
      { isMutation: true, description: 'spAssignNextJournalEntryNumber' },
      contextUser,
    );
    const value = rows?.[0]?.EntryNumber;
    if (!value || typeof value !== 'string') {
      throw new Error(
        `Could not get the next journal entry number for company ${companyId}, fiscal year ${fiscalYear}: the number sequence returned nothing.`,
      );
    }
    return value;
  }

  public async AllocateJournalEntryBatchNumber(
    contextUser: UserInfo | undefined,
    provider: IMetadataProvider,
  ): Promise<string> {
    const database = getDatabaseProvider(provider);
    const rows = await database.ExecuteSQL<{ JournalEntryBatchNumber: string | null }>(
      JOURNAL_ENTRY_BATCH_NUMBER_SQL[database.PlatformKey],
      [],
      { isMutation: true, description: 'spAssignNextJournalEntryBatchNumber' },
      contextUser,
    );
    const value = rows?.[0]?.JournalEntryBatchNumber;
    if (!value || typeof value !== 'string') {
      throw new Error(
        'Could not get the next batch number: the number sequence returned nothing.',
      );
    }
    return value;
  }

  public async AllocateNext(request: DocumentSequenceAllocationRequest): Promise<number> {
    const keyLower = request.sequenceKey.trim().toLowerCase();
    if (keyLower.includes('journal entry batches')) {
      const formatted = await this.AllocateJournalEntryBatchNumber(request.contextUser, request.provider);
      return parseTrailingSequenceNumber(formatted, request.sequenceKey);
    }

    const companyMatch = /Field:CompanyID=([^|]+)/i.exec(request.scopeKey);
    const fyMatch = /(?:FY|Scope:FY)=(\d{4})/i.exec(request.scopeKey);
    const companyId = companyMatch?.[1]?.trim() ?? '';
    const fiscalYear = fyMatch ? Number.parseInt(fyMatch[1], 10) : new Date().getUTCFullYear();
    const formatted = await this.AllocateJournalEntryNumber(companyId, fiscalYear, request.contextUser, request.provider);
    return parseTrailingSequenceNumber(formatted, request.sequenceKey);
  }
}

const accountingRoutineSequenceStore = new CustomRoutineDocumentSequenceStore();

function parseTrailingSequenceNumber(formatted: string, sequenceKey: string): number {
  const match = /(\d+)$/.exec(formatted.trim());
  const parsed = match ? Number.parseInt(match[1], 10) : NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `CustomRoutineDocumentSequenceStore could not parse trailing sequence integer from '${formatted}' for '${sequenceKey}'.`,
    );
  }
  return parsed;
}

async function resolveJournalEntryNumberScope(
  ctx: DocumentScopeResolutionContext,
): Promise<Record<string, string>> {
  const companyIdRaw = ctx.entity.GetFieldByName('CompanyID')?.Value;
  const companyId = companyIdRaw !== null && companyIdRaw !== undefined ? String(companyIdRaw).trim() : '';
  const effectiveRaw = ctx.entity.GetFieldByName('EffectiveDate')?.Value;
  const refDate =
    effectiveRaw instanceof Date
      ? effectiveRaw
      : typeof effectiveRaw === 'string' && effectiveRaw.trim().length > 0
        ? new Date(effectiveRaw)
        : ctx.now;
  const day = ToCalendarDay(refDate);
  const fyStart = companyId ? AccountingEngineBase.Instance.FiscalYearStartFor(companyId) : { Month: 1, Day: 1 };
  const fy = day ? FiscalYearOf(day, fyStart) : refDate.getUTCFullYear();
  const profile = companyId
    ? AccountingEngineBase.Instance.CompanyProfiles.find(
        (p) => p.ID?.toLowerCase() === companyId.toLowerCase(),
      )
    : undefined;
  const companyCode = profile?.CompanyCode?.trim() || companyId || 'CO';
  return {
    CompanyCode: companyCode,
    FY: String(fy),
  };
}

/**
 * Registers the accounting document numbering policies (`JournalEntry.EntryNumber` and
 * `JournalEntryBatch.JournalEntryBatchNumber` / `BatchNumber`) on {@link DocumentNumberingEngine.Instance}.
 */
export function registerAccountingNumberingPolicies(): void {
  DocumentNumberingEngine.Instance.RegisterPolicy(JE_ENTITY, JOURNAL_ENTRY_NUMBER_POLICY);
  DocumentNumberingEngine.Instance.RegisterScopeResolver(
    `${JE_ENTITY}.EntryNumber`,
    resolveJournalEntryNumberScope,
  );
  DocumentNumberingEngine.Instance.RegisterScopeResolver(JE_ENTITY, resolveJournalEntryNumberScope);
  DocumentNumberingEngine.Instance.RegisterPolicy(BATCH_ENTITY, [
    JOURNAL_ENTRY_BATCH_NUMBER_POLICY,
    JOURNAL_ENTRY_BATCH_NUMBER_ALIAS_POLICY,
  ]);
}

registerAccountingNumberingPolicies();

/**
 * Atomically increments the PER-COMPANY per-FiscalYear JE counter and returns
 * the formatted EntryNumber 'JE-{CompanyCode}-{FY}-{seq:000000}' (plan D19:
 * gap-free, per company, per fiscal year).
 */
export async function getNextJournalEntryNumber(
  companyId: string,
  fiscalYear: number,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<string> {
  return accountingRoutineSequenceStore.AllocateJournalEntryNumber(companyId, fiscalYear, contextUser, provider);
}

/**
 * Atomically increments the GLOBAL singleton batch counter and returns the
 * formatted JournalEntryBatchNumber 'BATCH-{seq:000000}'. (D-SEQ: batches are multi-company.)
 */
export async function getNextJournalEntryBatchNumber(
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<string> {
  return accountingRoutineSequenceStore.AllocateJournalEntryBatchNumber(contextUser, provider);
}

/**
 * The injected provider as the database provider it is on the server. Its PlatformKey
 * picks the SQL; an unknown platform fails here rather than sending another dialect's SQL.
 */
function getDatabaseProvider(provider: IMetadataProvider): DatabaseProviderBase {
  if (!provider) {
    throw new Error('The number sequence service was called without a database provider; the calling code must pass one.');
  }
  const database = provider as DatabaseProviderBase;
  if (!(database.PlatformKey in JOURNAL_ENTRY_NUMBER_SQL)) {
    throw new Error(`Journal entry numbering does not support the '${database.PlatformKey}' database platform.`);
  }
  return database;
}
