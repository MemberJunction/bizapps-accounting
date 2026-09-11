/**
 * Unit tests for JournalEntryBatchEntityServer's always-applies invariants (phase-2 sweep):
 * a batch is born Pending, an Approved batch carries its audit pair, and the saved-record
 * transition graph holds. The transition tests fake "loaded" state with
 * `SetMany(..., replaceOldValues=true)`, which sets the primary key (so IsSaved flips) and the
 * field OldValues the graph check reads — no live database needed.
 * Same mock harness pattern as JournalEntryExtendedServer.test.ts.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BaseEntity, Metadata, EntityInfo } from '@memberjunction/core';
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
        ValueIsPermittedByValueList: () => true,
      })) as any[];
      Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
      Object.defineProperty(info, 'PrimaryKeys', { get: () => fields.filter((f: any) => f.IsPrimaryKey), configurable: true });
      Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
      return info;
    };

    const batchInfo = createMockEntity(BATCH_ENTITY, [
      'ID', 'JournalEntryBatchNumber', 'CompanyID', 'PostingDate', 'SummaryJournalEntryID', 'TargetSystem',
      'BatchedAt', 'BatchedByUserID', 'Status', 'TotalEntries', 'TotalDebits', 'TotalCredits',
      'ApprovedAt', 'ApprovedByUserID', 'ArchiveReason', 'ArchivedAt', 'ArchivedByUserID',
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

  // ─── the saved-record transition graph (golive #214 added Archived) ───────

  /**
   * Fake a loaded batch sitting at `status`: SetMany with replaceOldValues writes the field
   * OldValues the graph check reads, and setting the primary key flips IsSaved.
   */
  const asSaved = (status: string, extra: Record<string, unknown> = {}) =>
    batch.SetMany({ ID: 'B1', JournalEntryBatchNumber: 'JEB-000001', Status: status, ...extra }, true, true);

  const archiveAudit = { ArchiveReason: 'Superseded by the conversion opening balances', ArchivedAt: new Date(), ArchivedByUserID: 'U1' };
  const transitionErrors = (r: { Errors: unknown[] }) => r.Errors.filter(e => getErrorText(e).includes('Illegal batch status transition'));

  it.each(['Pending', 'Approved', 'Failed'])('%s → Archived is legal', (from) => {
    asSaved(from);
    batch.SetMany(archiveAudit, true);
    batch.Status = 'Archived';
    expect(transitionErrors(batch.Validate())).toEqual([]);
  });

  it.each(['Pending', 'Sent', 'Posted', 'Cancelled'])('Archived → %s is rejected — Archived is terminal', (to) => {
    asSaved('Archived', archiveAudit);
    batch.Status = to as typeof batch.Status;
    const result = batch.Validate();
    expect(result.Success).toBe(false);
    expect(transitionErrors(result).length).toBe(1);
  });

  it('Sent → Archived is rejected — a sent batch may still be posting in the ERP', () => {
    asSaved('Sent');
    batch.SetMany(archiveAudit, true);
    batch.Status = 'Archived';
    const result = batch.Validate();
    expect(result.Success).toBe(false);
    expect(transitionErrors(result).length).toBe(1);
  });

  // ─── the archive audit triple ─────────────────────────────────────────────

  it.each([
    ['a missing reason', { ...archiveAudit, ArchiveReason: null }],
    ['a blank reason', { ...archiveAudit, ArchiveReason: '   ' }],
    ['no ArchivedAt', { ...archiveAudit, ArchivedAt: null }],
    ['no ArchivedByUserID', { ...archiveAudit, ArchivedByUserID: null }],
  ])('an Archived batch with %s fails validation', (_label, audit) => {
    asSaved('Pending');
    batch.SetMany(audit, true);
    batch.Status = 'Archived';
    const result = batch.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => getErrorText(e).includes('ArchiveReason'))).toBe(true);
  });

  // ─── Archive() vs Cancel(): the load-bearing distinction of golive #214 ────

  describe('Archive() keeps the member entries locked; Cancel() releases them', () => {
    let teardown: ReturnType<typeof vi.fn>;
    let save: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      save = vi.spyOn(BaseEntity.prototype, 'Save').mockResolvedValue(true);
      teardown = vi.fn().mockResolvedValue(undefined);
      batch.TearDownSummaryAndUnlock = teardown;
      // Cancel() opens a provider transaction; the mock harness has no data provider, so give the
      // instance one that only knows the three transaction verbs Cancel actually calls.
      Object.defineProperty(batch, 'ProviderToUse', {
        configurable: true,
        get: () => ({
          BeginTransaction: vi.fn().mockResolvedValue(undefined),
          CommitTransaction: vi.fn().mockResolvedValue(undefined),
          RollbackTransaction: vi.fn().mockResolvedValue(undefined),
        }),
      });
    });

    afterEach(() => save.mockRestore());

    it('Archive() never runs the teardown, and leaves the summary pointer intact', async () => {
      asSaved('Pending', { SummaryJournalEntryID: 'SUM1' });
      await batch.Archive('Conversion cutover — these were posted in the legacy system');

      expect(teardown).not.toHaveBeenCalled();
      expect(batch.SummaryJournalEntryID).toBe('SUM1');
      expect(batch.Status).toBe('Archived');
      expect(batch.ArchiveReason).toBe('Conversion cutover — these were posted in the legacy system');
    });

    it('Cancel() still runs the teardown — archiving did not change cancelling', async () => {
      asSaved('Pending', { SummaryJournalEntryID: 'SUM1' });
      await batch.Cancel();

      expect(teardown).toHaveBeenCalledTimes(1);
      expect(batch.Status).toBe('Cancelled');
    });

    it('Archive() refuses a Sent batch, naming the actual status', async () => {
      asSaved('Sent');
      await expect(batch.Archive('too late')).rejects.toThrow(/is Sent/);
      expect(teardown).not.toHaveBeenCalled();
    });

    it('Archive() refuses a blank reason', async () => {
      asSaved('Pending');
      await expect(batch.Archive('   ')).rejects.toThrow(/reason/i);
    });

    it('the → Archived transition auto-stamps ArchivedAt / ArchivedByUserID from the context user', async () => {
      batch.ContextCurrentUser = { ID: 'U-ARCHIVER' } as never;
      asSaved('Pending');
      batch.SetMany({ ArchiveReason: 'Duplicate of JEB-000004' }, true);
      batch.Status = 'Archived';
      await batch.Save();

      expect(batch.ArchivedByUserID).toBe('U-ARCHIVER');
      expect(batch.ArchivedAt).toBeInstanceOf(Date);
    });
  });
});
