/**
 * golive #279 — FinanceExceptionEntityServer: status and review change only through the clear
 * operation's sanctioned save. No DB: mock EntityInfo, saved state via LoadFromData, and Save
 * stubbed to run Validate so the sanctioned path is exercised without a provider.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntityInfo, Metadata, type IMetadataProvider } from '@memberjunction/core';
import { FinanceExceptionEntityServer, SaveFinanceExceptionClearance } from '../FinanceExceptionEntityServer.js';

const FIELDS = ['ID', 'FinanceExceptionTypeID', 'Summary', 'DedupeKey', 'CreatorUnresolved', 'Status', 'ReviewedByUserID', 'ReviewedAt', 'ReviewNote'];

interface MockField {
  Name: string;
  CodeName: string;
  Type: string;
  TSType: string;
  IsPrimaryKey: boolean;
  AutoIncrement: boolean;
  ReadOnly: boolean;
  AllowsNull: boolean;
  ValueIsPermittedByValueList: () => boolean;
}

function mockEntityInfo(): EntityInfo {
  const info: EntityInfo = Object.create(EntityInfo.prototype);
  const fields: MockField[] = FIELDS.map(name => ({
    Name: name,
    CodeName: name,
    Type: name === 'ID' ? 'uniqueidentifier' : name === 'CreatorUnresolved' ? 'bit' : 'nvarchar',
    TSType: name === 'CreatorUnresolved' ? 'boolean' : 'string',
    IsPrimaryKey: name === 'ID',
    AutoIncrement: false,
    ReadOnly: false,
    AllowsNull: true,
    ValueIsPermittedByValueList: () => true,
  }));
  Object.assign(info, {
    ID: 'entity-finance-exceptions',
    Name: 'MJ_BizApps_Accounting: Finance Exceptions',
    Status: 'Active',
    AllowDirectSQL: true,
    // EntityInfo.FieldByName reads this lazily-built map; Object.create skips its initializer.
    _fieldByNameMap: new Map(fields.map(f => [f.Name.toLowerCase(), f])),
  });
  Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
  Object.defineProperty(info, 'PrimaryKeys', { get: () => fields.filter(f => f.IsPrimaryKey), configurable: true });
  Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
  return info;
}

describe('FinanceExceptionEntityServer (status guard)', () => {
  let info: EntityInfo;

  beforeEach(() => {
    info = mockEntityInfo();
    Metadata.Provider = { Entities: [info] } as unknown as IMetadataProvider;
  });

  const loaded = async (status: 'Open' | 'Reviewed' | 'Corrected'): Promise<FinanceExceptionEntityServer> => {
    const row = new FinanceExceptionEntityServer(info);
    const review = status === 'Open' ? {} : { ReviewedByUserID: 'U-2', ReviewedAt: new Date('2026-09-01T00:00:00Z'), ReviewNote: 'ok' };
    await row.LoadFromData({ ID: 'FE-1', FinanceExceptionTypeID: 'T-1', Summary: 'x', DedupeKey: 'k', CreatorUnresolved: false, Status: status, ...review });
    vi.spyOn(row, 'Save').mockImplementation(async () => row.Validate().Success);
    return row;
  };

  it('refuses a status change made by an ordinary save', async () => {
    const row = await loaded('Open');
    row.Status = 'Reviewed';
    row.ReviewedByUserID = 'U-2';
    row.ReviewedAt = new Date();
    const result = row.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => /change only through Accounting\.ClearFinanceException/.test(e.Message))).toBe(true);
  });

  it('allows Open to Reviewed through the sanctioned clearance save', async () => {
    const row = await loaded('Open');
    row.Status = 'Reviewed';
    row.ReviewedByUserID = 'U-2';
    row.ReviewedAt = new Date();
    row.ReviewNote = 'Checked.';
    expect(await SaveFinanceExceptionClearance(row)).toBe(true);
    // The sanction lasts for that save only.
    expect(row.Validate().Success).toBe(false);
  });

  it('keeps a terminal row terminal, even through the clearance save', async () => {
    const row = await loaded('Corrected');
    row.ReviewNote = 'rewritten';
    expect(row.Validate().Errors.some(e => /terminal/.test(e.Message))).toBe(true);
    expect(await SaveFinanceExceptionClearance(row)).toBe(false);
  });

  it('allows non-review edits on an Open row', async () => {
    const row = await loaded('Open');
    row.Summary = 'clearer summary';
    expect(row.Validate().Success).toBe(true);
  });

  it('refuses a new row that is not Open', async () => {
    const row = new FinanceExceptionEntityServer(info);
    row.NewRecord();
    row.Status = 'Reviewed';
    expect(row.Validate().Errors.some(e => /raised Open/.test(e.Message))).toBe(true);
  });

  it('refuses to delete', async () => {
    const row = await loaded('Open');
    await expect(row.Delete()).rejects.toThrow(/cannot be deleted/);
  });
});
