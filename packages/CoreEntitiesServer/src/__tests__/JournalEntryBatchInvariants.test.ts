/**
 * Unit tests for JournalEntryBatchEntityServer's always-applies invariants (phase-2 sweep):
 * a batch is born Pending, and an Approved batch carries its audit pair. (The saved-record
 * transition graph — e.g. Pending→Sent rejected — needs a loaded entity with OldValue state;
 * that path is exercised by the live tier-2 harness, not mockable cheaply here.)
 * Same mock harness pattern as JournalEntryExtendedServer.test.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Metadata, EntityInfo } from '@memberjunction/core';
import { JournalEntryBatchEntityServer } from '../JournalEntryBatchEntityServer.js';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

describe('JournalEntryBatchEntityServer — lifecycle invariants', () => {
  let batch: JournalEntryBatchEntityServer;

  beforeEach(() => {
    const createMockEntity = (name: string, fieldNames: string[]) => {
      const info = Object.create(EntityInfo.prototype);
      info.ID = `id-${name}`;
      info.Name = name;
      info.Status = 'Active';
      info.AllowDirectSQL = true;
      const fields = fieldNames.map(fn => ({
        Name: fn,
        CodeName: fn,
        Type: fn === 'ID' || fn.endsWith('ID') ? 'uniqueidentifier' : 'nvarchar',
        TSType: 'string',
        IsPrimaryKey: fn === 'ID',
        AutoIncrement: false,
        ReadOnly: false,
        AllowsNull: true,
      })) as any[];
      Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
      Object.defineProperty(info, 'PrimaryKeys', { get: () => fields.filter((f: any) => f.IsPrimaryKey), configurable: true });
      Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
      return info;
    };

    const batchInfo = createMockEntity(BATCH_ENTITY, [
      'ID', 'BatchNumber', 'CompanyID', 'PostingDate', 'SummaryJournalEntryID', 'TargetSystem',
      'BatchedAt', 'BatchedByUserID', 'Status', 'TotalEntries', 'TotalDebits', 'TotalCredits',
      'ApprovedAt', 'ApprovedByUserID',
    ]);
    Metadata.Provider = {
      Entities: [batchInfo],
      FindEntityByName: (name: string) => (name.toLowerCase() === BATCH_ENTITY.toLowerCase() ? batchInfo : undefined),
      Config: { ActiveStatusAssertions: false },
    } as any;

    batch = new JournalEntryBatchEntityServer(batchInfo as any);
    batch.NewRecord();
    batch.CompanyID = 'CO_1';
    batch.TargetSystem = 'BusinessCentral';
  });

  const getErrorText = (e: any): string => (typeof e === 'string' ? e : (e?.Message || e?.Error || e?.message || String(e)));

  it('a NEW batch must start Pending — creating one mid-lifecycle fails', () => {
    batch.Status = 'Sent';
    const result = batch.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => getErrorText(e).includes("must start at Status='Pending'"))).toBe(true);
  });

  it('a NEW Pending batch passes the lifecycle rules', () => {
    batch.Status = 'Pending';
    const result = batch.Validate();
    const lifecycleErrors = result.Errors.filter(e => getErrorText(e).includes('status') || getErrorText(e).includes('Status'));
    expect(lifecycleErrors).toEqual([]);
  });

  it('an Approved batch without its audit pair (ApprovedAt + ApprovedByUserID) fails', () => {
    batch.Status = 'Approved';
    const result = batch.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => getErrorText(e).includes('ApprovedAt and ApprovedByUserID'))).toBe(true);
  });
});
