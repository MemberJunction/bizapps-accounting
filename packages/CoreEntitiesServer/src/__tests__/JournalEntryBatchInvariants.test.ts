/**
 * Unit tests for JournalEntryBatchEntityServer's always-applies invariants (phase-2 sweep):
 * a batch is born Pending, an Approved batch carries its audit pair, and the saved-record
 * transition graph holds. The transition tests fake "loaded" state with
 * `SetMany(..., replaceOldValues=true)`, which sets the primary key (so IsSaved flips) and the
 * field OldValues the graph check reads — no live database needed.
 * Same mock harness pattern as JournalEntryExtendedServer.test.ts.
 */
import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { BaseEntity, Metadata, EntityInfo } from '@memberjunction/core';
import { JournalEntryBatchEntityServer } from '../JournalEntryBatchEntityServer.js';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

describe('JournalEntryBatchEntityServer — lifecycle invariants', () => {
  let batch: JournalEntryBatchEntityServer;
  /** Kept in scope so a case can build a SECOND batch off the same EntityInfo. */
  let batchInfo: ReturnType<typeof Object.create>;

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

    batchInfo = createMockEntity(BATCH_ENTITY, [
      'ID', 'JournalEntryBatchNumber', 'CompanyID', 'PostingDate', 'SummaryJournalEntryID', 'TargetSystem',
      'BatchedAt', 'BatchedByUserID', 'Status', 'TotalEntries', 'TotalDebits', 'TotalCredits',
      'ApprovedAt', 'ApprovedByUserID', 'ArchiveReason', 'ArchivedAt', 'ArchivedByUserID',
      'CancelReason', 'CancelledAt', 'CancelledByUserID', 'ApprovedContentHash', 'SentAt',
      'ERPNotPostedConfirmedAt', 'ERPNotPostedConfirmedByUserID', 'ERPNotPostedBasis',
    ]);
    Metadata.Provider = {
      Entities: [batchInfo],
      FindEntityByName: (name: string) => (name.toLowerCase() === BATCH_ENTITY.toLowerCase() ? batchInfo : undefined),
      Config: { ActiveStatusAssertions: false },
    } as any;

    batch = new JournalEntryBatchEntityServer(batchInfo as any);
    batch.NewRecord();
    // These cases are about the lifecycle rules, so they stand in the batching process's shoes.
    // The create guard itself is covered separately below.
    batch.MarkBuiltByBatchingProcess();
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

  // ─── build is the create verb (golive #193) ──────────────────────────────

  it('a NEW batch that the batching process did not build is refused', () => {
    const handTyped = new JournalEntryBatchEntityServer(batchInfo as any);
    handTyped.NewRecord();
    handTyped.CompanyID = 'CO_1';
    handTyped.TargetSystem = 'BusinessCentral';
    handTyped.Status = 'Pending';
    handTyped.TotalEntries = 12;
    handTyped.TotalDebits = 1000;
    handTyped.TotalCredits = 1000;

    const result = handTyped.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => getErrorText(e).includes('cannot be created directly'))).toBe(true);
  });

  it('the same batch passes once the batching process claims it', () => {
    batch.Status = 'Pending';
    expect(batch.Validate().Errors.some(e => getErrorText(e).includes('cannot be created directly'))).toBe(false);
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

  it.each(['Approved', 'Failed'])('%s → Cancelled is legal (#183)', (from) => {
    asSaved(from);
    batch.Status = 'Cancelled';
    expect(transitionErrors(batch.Validate())).toEqual([]);
  });

  it.each(['Approved', 'Failed'])('a plain save of %s → Cancelled is refused — only Cancel() takes that edge', (from) => {
    asSaved(from, { ApprovedAt: new Date(), ApprovedByUserID: 'U1' });
    batch.SetMany({ CancelReason: 'typed on the form', CancelledAt: new Date(), CancelledByUserID: 'U1' }, true);
    batch.Status = 'Cancelled';
    const result = batch.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => getErrorText(e).includes('cancelled only through Cancel'))).toBe(true);
  });

  it('a batch cancelled after it was sent, without the ERP-check attestation, fails validation', () => {
    asSaved('Failed', { ApprovedAt: new Date(), ApprovedByUserID: 'U1', SentAt: new Date() });
    batch.SetMany({ CancelReason: 'Wrong period', CancelledAt: new Date(), CancelledByUserID: 'U1' }, true);
    batch.Status = 'Cancelled';
    expect(batch.Validate().Errors.some(e => getErrorText(e).includes('ERPNotPostedConfirmedAt'))).toBe(true);
  });

  it('Sent → Cancelled is rejected — a sent batch may still be posting in the ERP', () => {
    asSaved('Sent');
    batch.Status = 'Cancelled';
    expect(transitionErrors(batch.Validate()).length).toBe(1);
  });

  // ─── the cancel audit triple, once approved (#183) ────────────────────────

  const cancelAudit = { CancelReason: 'Posting date belongs in October', CancelledAt: new Date(), CancelledByUserID: 'U1' };

  it.each([
    ['a missing reason', { ...cancelAudit, CancelReason: null }],
    ['a blank reason', { ...cancelAudit, CancelReason: '   ' }],
    ['no CancelledAt', { ...cancelAudit, CancelledAt: null }],
    ['no CancelledByUserID', { ...cancelAudit, CancelledByUserID: null }],
  ])('a batch cancelled after approval with %s fails validation', (_label, audit) => {
    asSaved('Failed', { ApprovedAt: new Date(), ApprovedByUserID: 'U1' });
    batch.SetMany(audit, true);
    batch.Status = 'Cancelled';
    const result = batch.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => getErrorText(e).includes('CancelReason'))).toBe(true);
  });

  it('a Pending cancel needs no reason — only a batch past approval does', () => {
    asSaved('Pending');
    batch.Status = 'Cancelled';
    expect(batch.Validate().Errors.some(e => getErrorText(e).includes('CancelReason'))).toBe(false);
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
    let teardown: Mock<JournalEntryBatchEntityServer['ReleaseMembersAndDeleteSummary']>;
    let save: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      save = vi.spyOn(BaseEntity.prototype, 'Save').mockResolvedValue(true);
      teardown = vi.fn<JournalEntryBatchEntityServer['ReleaseMembersAndDeleteSummary']>().mockResolvedValue(undefined);
      batch.ReleaseMembersAndDeleteSummary = teardown;
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
      expect(teardown).toHaveBeenCalledWith('SUM1', null);
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

    // ─── cancel after approval (#183) ─────────────────────────────────────────

    it('Cancel() saves Cancelled with the pointer cleared BEFORE releasing — the triggers key on that', async () => {
      const seenAtRelease: Array<{ status: string; pointer: string | null }> = [];
      teardown.mockImplementation(async () => { seenAtRelease.push({ status: batch.Status, pointer: batch.SummaryJournalEntryID }); });
      asSaved('Approved', { SummaryJournalEntryID: 'SUM1', ApprovedAt: new Date(), ApprovedByUserID: 'U1' });

      await batch.Cancel({ ID: 'U-CANCELLER' } as never, { reason: 'Posting date belongs in October' });

      expect(save).toHaveBeenCalledTimes(1);
      expect(seenAtRelease).toEqual([{ status: 'Cancelled', pointer: null }]);
      expect(teardown).toHaveBeenCalledWith('SUM1', { ID: 'U-CANCELLER' });
      expect(batch.CancelReason).toBe('Posting date belongs in October');
      expect(batch.CancelledByUserID).toBe('U-CANCELLER');
      expect(batch.CancelledAt).toBeInstanceOf(Date);
    });

    it.each(['Approved', 'Failed'])('Cancel() refuses a %s batch without a reason', async (from) => {
      asSaved(from, { SummaryJournalEntryID: 'SUM1' });
      await expect(batch.Cancel(undefined, { reason: '  ', confirmNotAlreadyPostedInERP: true })).rejects.toThrow(/reason is required/);
      expect(save).not.toHaveBeenCalled();
      expect(teardown).not.toHaveBeenCalled();
    });

    it.each([undefined, false])('Cancel() refuses a Failed batch without the ERP confirmation (%s)', async (confirm) => {
      asSaved('Failed', { SummaryJournalEntryID: 'SUM1' });
      await expect(batch.Cancel(undefined, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: confirm }))
        .rejects.toThrow(/Confirm in the ERP that document JEB-000001 has not posted/);
      expect(save).not.toHaveBeenCalled();
      expect(teardown).not.toHaveBeenCalled();
    });

    it('Cancel() takes a Failed batch with a reason and the ERP confirmation, and persists the attestation', async () => {
      asSaved('Failed', { SummaryJournalEntryID: 'SUM1', SentAt: new Date('2026-09-30T12:00:00Z') });
      await batch.Cancel({ ID: 'U-CFO' } as never, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: true });
      expect(batch.Status).toBe('Cancelled');
      expect(teardown).toHaveBeenCalledWith('SUM1', { ID: 'U-CFO' });
      expect(batch.ERPNotPostedConfirmedByUserID).toBe('U-CFO');
      expect(batch.ERPNotPostedConfirmedAt).toBeInstanceOf(Date);
      expect(batch.ERPNotPostedBasis).toBe('UserAttested'); // the canceller's word, absent a lookup
    });

    it('Cancel() persists ERPLookup as the basis when the engine\'s lookup found nothing', async () => {
      asSaved('Failed', { SummaryJournalEntryID: 'SUM1', SentAt: new Date('2026-09-30T12:00:00Z') });
      await batch.Cancel({ ID: 'U-CFO' } as never, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: true, erpNotPostedBasis: 'ERPLookup' });
      expect(batch.ERPNotPostedBasis).toBe('ERPLookup');
    });

    it('Cancel() runs onCancelled inside the transaction, after the release', async () => {
      const order: string[] = [];
      teardown.mockImplementation(async () => { order.push('release'); });
      asSaved('Approved', { SummaryJournalEntryID: 'SUM1' });
      await batch.Cancel(undefined, { reason: 'Wrong period', onCancelled: async () => { order.push('onCancelled'); } });
      expect(order).toEqual(['release', 'onCancelled']);
    });

    it('a failed Cancel() rolls back and reloads the instance instead of claiming Cancelled', async () => {
      const load = vi.fn(async () => true);
      batch.Load = load as never;
      teardown.mockRejectedValue(new Error('member save failed'));
      asSaved('Approved', { SummaryJournalEntryID: 'SUM1' });

      await expect(batch.Cancel(undefined, { reason: 'Wrong period' })).rejects.toThrow('member save failed');
      expect(load).toHaveBeenCalledWith('B1');
    });

    it('Cancel() needs no ERP confirmation from Approved — an Approved batch was never sent', async () => {
      asSaved('Approved', { SummaryJournalEntryID: 'SUM1' });
      await batch.Cancel(undefined, { reason: 'Wrong period' });
      expect(batch.Status).toBe('Cancelled');
    });

    it.each(['Sent', 'Posted', 'Archived', 'Cancelled'])('Cancel() refuses a %s batch, naming the actual status', async (from) => {
      asSaved(from);
      await expect(batch.Cancel(undefined, { reason: 'x', confirmNotAlreadyPostedInERP: true })).rejects.toThrow(new RegExp(`is ${from}`));
      expect(teardown).not.toHaveBeenCalled();
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
