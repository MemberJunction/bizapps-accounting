/**
 * SequenceService — calls the DB-level atomic numbering stored procs from
 * TypeScript so EntityServer hooks can assign EntryNumber / JournalEntryBatchNumber
 * before super.Save() commits the row.
 *
 * The sprocs (spAssignNextJournalEntryNumber, spAssignNextJournalEntryBatchNumber) are
 * intentionally kept at DB level because they require atomic
 * HOLDLOCK+UPDLOCK read-modify-write semantics that don't translate to
 * app-level code under concurrency. Everything else moves to TypeScript.
 *
 * PROVIDER: injected, required — no global fallback. Callers are the entity
 * servers, which pass their own ProviderToUse (so the sproc call rides the
 * same connection context as the save it numbers).
 */

import { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { SQLServerDataProvider } from '@memberjunction/sqlserver-dataprovider';

const ACCOUNTING_SCHEMA = '__mj_BizAppsAccounting';

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
  const sqlProvider = getSqlServerProvider(provider);
  const sql = `
    DECLARE @entryNumber NVARCHAR(40);
    EXEC ${ACCOUNTING_SCHEMA}.spAssignNextJournalEntryNumber
        @CompanyID = @CompanyID,
        @FiscalYear = @FiscalYear,
        @EntryNumber = @entryNumber OUTPUT;
    SELECT @entryNumber AS EntryNumber;
  `;
  // ExecuteSQL binds an OBJECT of parameters BY NAME (@CompanyID / @FiscalYear). An array
  // is treated as positional (p0) — which would neither match the named @-params in the SQL
  // above nor bind correctly (it would try to bind the element object itself). Pass an object.
  const rows = await sqlProvider.ExecuteSQL(
    sql,
    { CompanyID: companyId, FiscalYear: fiscalYear },
    { isMutation: true, description: 'spAssignNextJournalEntryNumber' },
    contextUser,
  );
  const value = rows?.[0]?.EntryNumber;
  if (!value || typeof value !== 'string') {
    throw new Error(
      `SequenceService.getNextJournalEntryNumber: sproc returned no value for CompanyID=${companyId}, FiscalYear=${fiscalYear}`,
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
  const sqlProvider = getSqlServerProvider(provider);
  const sql = `
    DECLARE @batchNumber NVARCHAR(40);
    EXEC ${ACCOUNTING_SCHEMA}.spAssignNextJournalEntryBatchNumber
        @JournalEntryBatchNumber  = @batchNumber OUTPUT;
    SELECT @batchNumber AS JournalEntryBatchNumber;
  `;
  const rows = await sqlProvider.ExecuteSQL(
    sql,
    {},
    { isMutation: true, description: 'spAssignNextJournalEntryBatchNumber' },
    contextUser,
  );
  const value = rows?.[0]?.JournalEntryBatchNumber;
  if (!value || typeof value !== 'string') {
    throw new Error(
      'SequenceService.getNextJournalEntryBatchNumber: sproc returned no value',
    );
  }
  return value;
}

function getSqlServerProvider(provider: IMetadataProvider): SQLServerDataProvider {
  if (!provider) {
    throw new Error('SequenceService: an IMetadataProvider must be injected — there is no global fallback');
  }
  return provider as SQLServerDataProvider;
}
