/**
 * SequenceService sends each database platform its own numbering SQL, with positional
 * parameters, and refuses a platform it has no SQL for (#343). The routines themselves
 * (the SQL Server procedures and the PostgreSQL functions) run only against a database.
 */
import { describe, it, expect, vi } from 'vitest';
import type { DatabasePlatform, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { getNextJournalEntryBatchNumber, getNextJournalEntryNumber } from '../SequenceService.js';

const COMPANY_ID = '48d60bcc-044b-4cc2-9675-0d3b57bcdcba';
const USER = { ID: 'user-1' } as UserInfo;

function fakeProvider(platform: string, row: Record<string, string | null>) {
  const executeSQL = vi.fn().mockResolvedValue([row]);
  const provider = { PlatformKey: platform, ExecuteSQL: executeSQL } as unknown as IMetadataProvider;
  return { provider, executeSQL };
}

function sentSQL(executeSQL: ReturnType<typeof vi.fn>): string {
  return executeSQL.mock.calls[0][0] as string;
}

describe('getNextJournalEntryNumber', () => {
  it('runs the SQL Server procedure with ? placeholders and returns its OUTPUT value', async () => {
    const { provider, executeSQL } = fakeProvider('sqlserver', { EntryNumber: 'JE-ACME-2026-000001' });
    await expect(getNextJournalEntryNumber(COMPANY_ID, 2026, USER, provider)).resolves.toBe('JE-ACME-2026-000001');
    const sql = sentSQL(executeSQL);
    expect(sql).toMatch(/EXEC __mj_BizAppsAccounting\.spAssignNextJournalEntryNumber/);
    expect(sql).toMatch(/@CompanyID = \?,\s+@FiscalYear = \?/);
    expect(sql).toMatch(/@EntryNumber = @entryNumber OUTPUT/);
    expect(executeSQL.mock.calls[0][1]).toEqual([COMPANY_ID, 2026]);
    expect(executeSQL.mock.calls[0][3]).toBe(USER);
  });

  it('selects the PostgreSQL function with $1/$2 and no T-SQL', async () => {
    const { provider, executeSQL } = fakeProvider('postgresql', { EntryNumber: 'JE-ACME-2026-000002' });
    await expect(getNextJournalEntryNumber(COMPANY_ID, 2026, USER, provider)).resolves.toBe('JE-ACME-2026-000002');
    const sql = sentSQL(executeSQL);
    expect(sql).toBe('SELECT __mj_BizAppsAccounting.spAssignNextJournalEntryNumber($1::uuid, $2::integer) AS EntryNumber');
    expect(sql).not.toMatch(/DECLARE|EXEC|OUTPUT|@/);
    expect(executeSQL.mock.calls[0][1]).toEqual([COMPANY_ID, 2026]);
  });

  it('throws when the routine returns no number', async () => {
    const { provider } = fakeProvider('postgresql', { EntryNumber: null });
    await expect(getNextJournalEntryNumber(COMPANY_ID, 2026, USER, provider)).rejects.toThrow(/returned no value/);
  });
});

describe('getNextJournalEntryBatchNumber', () => {
  it.each<[DatabasePlatform, RegExp]>([
    ['sqlserver', /EXEC __mj_BizAppsAccounting\.spAssignNextJournalEntryBatchNumber\s+@JournalEntryBatchNumber = @batchNumber OUTPUT/],
    ['postgresql', /^SELECT __mj_BizAppsAccounting\.spAssignNextJournalEntryBatchNumber\(\) AS JournalEntryBatchNumber$/],
  ])('on %s sends that platform\'s SQL with no parameters', async (platform, expected) => {
    const { provider, executeSQL } = fakeProvider(platform, { JournalEntryBatchNumber: 'BATCH-000001' });
    await expect(getNextJournalEntryBatchNumber(USER, provider)).resolves.toBe('BATCH-000001');
    expect(sentSQL(executeSQL)).toMatch(expected);
    expect(executeSQL.mock.calls[0][1]).toEqual([]);
  });
});

describe('provider guard', () => {
  it('refuses a platform it has no SQL for, before running anything', async () => {
    const { provider, executeSQL } = fakeProvider('mysql', { JournalEntryBatchNumber: 'BATCH-000001' });
    await expect(getNextJournalEntryBatchNumber(USER, provider)).rejects.toThrow(/no SQL for database platform 'mysql'/);
    expect(executeSQL).not.toHaveBeenCalled();
  });

  it('refuses a missing provider', async () => {
    await expect(getNextJournalEntryBatchNumber(USER, undefined as unknown as IMetadataProvider)).rejects.toThrow(/must be injected/);
  });
});
