/**
 * JournalEntryTypeEntityServer — the IsSystem row lock (issue #24, BA-D29). No DB: mock
 * EntityInfo, saved-state via LoadFromData.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Metadata, EntityInfo, BaseEntity } from '@memberjunction/core';
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
    ValueIsPermittedByValueList: () => true,
  })) as any[];
  Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
  Object.defineProperty(info, 'PrimaryKeys', { get: () => fields.filter((f: any) => f.IsPrimaryKey), configurable: true });
  Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
  return info;
}

describe('JournalEntryTypeEntityServer (system-row lock)', () => {
  let info: EntityInfo;

  beforeEach(() => {
    info = createMockEntity(JET_ENTITY, ['ID', 'Code', 'Name', 'Description', 'IsSystem', 'IsJournalEntryBatchSummary', 'IsActive'], ['IsSystem', 'IsJournalEntryBatchSummary', 'IsActive']);
    Metadata.Provider = { Entities: [info] } as any;
  });

  const loadedSystemRow = async (): Promise<JournalEntryTypeEntityServer> => {
    const row = new JournalEntryTypeEntityServer(info as any);
    await row.LoadFromData({ ID: 'JET_REVERSAL', Code: 'Reversal', Name: 'Reversal', IsSystem: true, IsJournalEntryBatchSummary: false, IsActive: true });
    return row;
  };

  it('blocks changing Code on a saved IsSystem row', async () => {
    const row = await loadedSystemRow();
    row.Code = 'NotReversalAnymore';
    const result = row.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => /its Code cannot change/.test(e.Message))).toBe(true);
  });

  it('blocks flipping IsJournalEntryBatchSummary on a saved IsSystem row', async () => {
    const row = await loadedSystemRow();
    row.IsJournalEntryBatchSummary = true;
    const result = row.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => /its IsJournalEntryBatchSummary cannot change/.test(e.Message))).toBe(true);
  });

  it('allows editing Name / IsActive on a system row', async () => {
    const row = await loadedSystemRow();
    row.Name = 'Reversal (renamed)';
    row.IsActive = false;
    expect(row.Validate().Success).toBe(true);
  });

  it('blocks promoting a saved consumer row to IsSystem', async () => {
    const row = new JournalEntryTypeEntityServer(info as any);
    await row.LoadFromData({ ID: 'JET_OB', Code: 'OrderBooking', Name: 'Order Booking', IsSystem: false, IsJournalEntryBatchSummary: false, IsActive: true });
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
    row.IsJournalEntryBatchSummary = false;
    row.IsActive = true;
    expect(row.Validate().Success).toBe(true);
  });

  describe('consumer row referenced by journal entries (#392)', () => {
    const loadedConsumerRow = async (runViewCount: number, runViewSuccess = true): Promise<JournalEntryTypeEntityServer> => {
      const provider = {
        Entities: [info],
        RunView: vi.fn(async () => ({
          Success: runViewSuccess,
          TotalRowCount: runViewCount,
          Results: [],
          ErrorMessage: runViewSuccess ? undefined : 'timeout',
        })),
      };
      Metadata.Provider = provider as any;
      const row = new JournalEntryTypeEntityServer(info as any);
      Object.defineProperty(row, 'ProviderToUse', { configurable: true, get: () => provider });
      await row.LoadFromData({
        ID: '11111111-1111-4111-8111-111111111111',
        Code: 'OrderBooking',
        Name: 'Order Booking',
        IsSystem: false,
        IsJournalEntryBatchSummary: false,
        IsActive: true,
      });
      return row;
    };

    it('opts into ValidateAsync so the reference check runs on Save', () => {
      const row = new JournalEntryTypeEntityServer(info as any);
      expect(row.DefaultSkipAsyncValidation).toBe(false);
    });

    it('refuses changing Code on a consumer row when journal entries reference it', async () => {
      const row = await loadedConsumerRow(3);
      row.Code = 'OrderBookingRenamed';
      const result = await row.ValidateAsync();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => /used by 3 journal entries, so its Code cannot change/.test(e.Message))).toBe(true);
    });

    it('allows changing Code on a consumer row when no journal entries reference it', async () => {
      const row = await loadedConsumerRow(0);
      row.Code = 'OrderBookingRenamed';
      const result = await row.ValidateAsync();
      expect(result.Success).toBe(true);
    });

    it('refuses Delete on a consumer row when journal entries reference it', async () => {
      const row = await loadedConsumerRow(2);
      await expect(row.Delete()).rejects.toThrow(/used by 2 journal entries and cannot be deleted/);
    });

    it('allows Delete on a consumer row when no journal entries reference it', async () => {
      const superDelete = vi.spyOn(BaseEntity.prototype, 'Delete').mockResolvedValue(true);
      try {
        const row = await loadedConsumerRow(0);
        await expect(row.Delete()).resolves.toBe(true);
      } finally {
        superDelete.mockRestore();
      }
    });

    it('fails closed when the reference query fails', async () => {
      const row = await loadedConsumerRow(0, false);
      row.Code = 'OrderBookingRenamed';
      await expect(row.ValidateAsync()).rejects.toThrow(/Could not check whether journal entries use type 'OrderBooking'/);
    });
  });
});
