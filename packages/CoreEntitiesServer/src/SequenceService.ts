/**
 * SequenceService — calls the DB-level atomic numbering stored procs from
 * TypeScript so EntityServer hooks can assign EntryNumber / BatchNumber
 * before super.Save() commits the row.
 *
 * The sprocs (spAssignNextJournalEntryNumber, spAssignNextBatchNumber) are
 * intentionally kept at DB level because they require atomic
 * HOLDLOCK+UPDLOCK read-modify-write semantics that don't translate to
 * app-level code under concurrency. Everything else moves to TypeScript.
 */

import { LogError, Metadata, UserInfo } from '@memberjunction/core';
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
): Promise<string> {
  const provider = getSqlServerProvider();
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
  const rows = await provider.ExecuteSQL(
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
 * formatted BatchNumber 'BATCH-{seq:000000}'. (D-SEQ: batches are multi-company.)
 */
export async function getNextBatchNumber(
  contextUser: UserInfo,
): Promise<string> {
  const provider = getSqlServerProvider();
  const sql = `
    DECLARE @batchNumber NVARCHAR(40);
    EXEC ${ACCOUNTING_SCHEMA}.spAssignNextBatchNumber
        @BatchNumber  = @batchNumber OUTPUT;
    SELECT @batchNumber AS BatchNumber;
  `;
  const rows = await provider.ExecuteSQL(
    sql,
    {},
    { isMutation: true, description: 'spAssignNextBatchNumber' },
    contextUser,
  );
  const value = rows?.[0]?.BatchNumber;
  if (!value || typeof value !== 'string') {
    throw new Error(
      'SequenceService.getNextBatchNumber: sproc returned no value',
    );
  }
  return value;
}

function getSqlServerProvider(): SQLServerDataProvider {
  const provider = Metadata.Provider;
  if (!provider) {
    LogError('SequenceService: Metadata.Provider is not initialized');
    throw new Error('Metadata.Provider not initialized');
  }
  return provider as SQLServerDataProvider;
}
