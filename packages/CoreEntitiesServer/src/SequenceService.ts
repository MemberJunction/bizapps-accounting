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
 * Atomically increments the per-(Company × FY) JE counter and returns the
 * formatted EntryNumber 'JE-{CompanyCode}-{FY}-{seq:000000}'.
 *
 * The Company's AccountingCompanyProfile must exist (the sproc fails loudly
 * otherwise); call this only from a JournalEntry pre-save hook where we
 * know the parent ACP is in place.
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
        @CompanyID  = @CompanyID,
        @FiscalYear = @FiscalYear,
        @EntryNumber = @entryNumber OUTPUT;
    SELECT @entryNumber AS EntryNumber;
  `;
  const rows = await provider.ExecuteSQL(
    sql,
    [
      { name: 'CompanyID', value: companyId },
      { name: 'FiscalYear', value: fiscalYear },
    ],
    contextUser,
  );
  const value = rows?.[0]?.EntryNumber;
  if (!value || typeof value !== 'string') {
    throw new Error(
      `SequenceService.getNextJournalEntryNumber: sproc returned no value for CompanyID=${companyId} FiscalYear=${fiscalYear}`,
    );
  }
  return value;
}

/**
 * Atomically increments the per-Company batch counter and returns the
 * formatted BatchNumber 'BATCH-{CompanyCode}-{seq:000000}'.
 */
export async function getNextBatchNumber(
  companyId: string,
  contextUser: UserInfo,
): Promise<string> {
  const provider = getSqlServerProvider();
  const sql = `
    DECLARE @batchNumber NVARCHAR(40);
    EXEC ${ACCOUNTING_SCHEMA}.spAssignNextBatchNumber
        @CompanyID    = @CompanyID,
        @BatchNumber  = @batchNumber OUTPUT;
    SELECT @batchNumber AS BatchNumber;
  `;
  const rows = await provider.ExecuteSQL(
    sql,
    [{ name: 'CompanyID', value: companyId }],
    contextUser,
  );
  const value = rows?.[0]?.BatchNumber;
  if (!value || typeof value !== 'string') {
    throw new Error(
      `SequenceService.getNextBatchNumber: sproc returned no value for CompanyID=${companyId}`,
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
