/**
 * JournalEntryTypeEntityServer — the IsSystem row lock (issue #24, BA-D29). No DB: mock
 * EntityInfo, saved-state via LoadFromData.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Metadata, EntityInfo } from '@memberjunction/core';
import { JournalEntryTypeEntityServer } from '../JournalEntryTypeEntityServer.js';

const JET_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Types';

function createMockEntity(name: string, fieldNames: string[], boolFields: string[]): EntityInfo {
  const info = Object.create(EntityInfo.prototype);
  info.ID = `id-${name}`;
  info.Name = name;
  info.Status = 'Active';
  info.AllowDirectSQL = true;
  const fields = fieldNames.map(fn => ({
    Name: fn,
    CodeName: fn,
    Type: fn === 'ID' ? 'uniqueidentifier' : boolFields.includes(fn) ? 'bit' : 'nvarchar',
    TSType: boolFields.includes(fn) ? 'boolean' : 'string',
    IsPrimaryKey: fn === 'ID',
    AutoIncrement: false,
    ReadOnly: false,
    AllowsNull: true,
  })) as any[];
  Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
  Object.defineProperty(info, 'PrimaryKeys', { get: () => fields.filter((f: any) => f.IsPrimaryKey), configurable: true });
  Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
  return info;
}

describe('JournalEntryTypeEntityServer (system-row lock)', () => {
  let info: EntityInfo;

  beforeEach(() => {
    info = createMockEntity(JET_ENTITY, ['ID', 'Code', 'Name', 'Description', 'IsSystem', 'IsBatchSummary', 'IsActive'], ['IsSystem', 'IsBatchSummary', 'IsActive']);
    Metadata.Provider = { Entities: [info] } as any;
  });

  const loadedSystemRow = async (): Promise<JournalEntryTypeEntityServer> => {
    const row = new JournalEntryTypeEntityServer(info as any);
    await row.LoadFromData({ ID: 'JET_REVERSAL', Code: 'Reversal', Name: 'Reversal', IsSystem: true, IsBatchSummary: false, IsActive: true });
    return row;
  };

  it('blocks changing Code on a saved IsSystem row', async () => {
    const row = await loadedSystemRow();
    row.Code = 'NotReversalAnymore';
    const result = row.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => /Code is immutable/.test(e.Message))).toBe(true);
  });

  it('blocks flipping IsBatchSummary on a saved IsSystem row', async () => {
    const row = await loadedSystemRow();
    row.IsBatchSummary = true;
    const result = row.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => /IsBatchSummary is immutable/.test(e.Message))).toBe(true);
  });

  it('allows editing Name / IsActive on a system row', async () => {
    const row = await loadedSystemRow();
    row.Name = 'Reversal (renamed)';
    row.IsActive = false;
    expect(row.Validate().Success).toBe(true);
  });

  it('blocks promoting a saved consumer row to IsSystem', async () => {
    const row = new JournalEntryTypeEntityServer(info as any);
    await row.LoadFromData({ ID: 'JET_OB', Code: 'OrderBooking', Name: 'Order Booking', IsSystem: false, IsBatchSummary: false, IsActive: true });
    row.IsSystem = true;
    const result = row.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => /cannot be promoted/.test(e.Message))).toBe(true);
  });

  it('Delete throws on an IsSystem row', async () => {
    const row = await loadedSystemRow();
    await expect(row.Delete()).rejects.toThrow(/cannot be deleted/);
  });

  it('a NEW consumer row validates clean (the table stays open to consuming apps)', () => {
    const row = new JournalEntryTypeEntityServer(info as any);
    row.NewRecord();
    row.Code = 'VendorBill';
    row.Name = 'Vendor Bill';
    row.IsSystem = false;
    row.IsBatchSummary = false;
    row.IsActive = true;
    expect(row.Validate().Success).toBe(true);
  });
});
