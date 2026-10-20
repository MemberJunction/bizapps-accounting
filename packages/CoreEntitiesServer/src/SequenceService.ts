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

import { DatabasePlatform, DatabaseProviderBase, IMetadataProvider, UserInfo } from '@memberjunction/core';

const ACCOUNTING_SCHEMA = '__mj_BizAppsAccounting';

/**
 * PostgreSQL folds the migrations' unquoted schema to lowercase, while the function names are
 * created quoted. The provider auto-quotes mixed-case identifiers, so the schema is written in
 * lowercase and the function name quoted, or the call names a schema or function that does not exist.
 */
const ACCOUNTING_SCHEMA_PG = '__mj_bizappsaccounting';

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

/**
 * Atomically increments the GLOBAL singleton batch counter and returns the
 * formatted JournalEntryBatchNumber 'BATCH-{seq:000000}'. (D-SEQ: batches are multi-company.)
 */
export async function getNextJournalEntryBatchNumber(
  contextUser: UserInfo,
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

/**
 * The injected provider as the database provider it is on the server. Its PlatformKey
 * picks the SQL; an unknown platform fails here rather than sending another dialect's SQL.
 */
function getDatabaseProvider(provider: IMetadataProvider): DatabaseProviderBase {
  if (!provider) {
    throw new Error('The number sequence service was called without a database provider; the calling code must pass one.');
  }
  const database = provider as unknown as DatabaseProviderBase;
  if (!(database.PlatformKey in JOURNAL_ENTRY_NUMBER_SQL)) {
    throw new Error(`Journal entry numbering does not support the '${database.PlatformKey}' database platform.`);
  }
  return database;
}
