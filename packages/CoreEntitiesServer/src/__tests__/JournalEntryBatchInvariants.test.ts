/**
 * Unit tests for JournalEntryBatchEntityServer's always-applies invariants (phase-2 sweep):
 * a batch is born Pending, an Approved batch carries its audit pair, and the saved-record
 * transition graph holds. The transition tests fake "loaded" state with
 * `SetMany(..., replaceOldValues=true)`, which sets the primary key (so IsSaved flips) and the
 * field OldValues the graph check reads — no live database needed.
 * Same mock harness pattern as JournalEntryExtendedServer.test.ts.
 */
import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { BaseEntity, Metadata, EntityInfo, UserInfo } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import { JournalEntryBatchEntityServer } from '../JournalEntryBatchEntityServer.js';
import { JournalEntryBatchDispatchServices } from '../JournalEntryBatchDispatchServices.js';
import type { ErpJournalLookup, JournalEntryBatchCancelGate } from '../JournalEntryBatchEngine.js';

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
      'CancelReason', 'CancelledAt', 'CancelledByUserID', 'ApprovedContentHash',
      'ERPNotPostedConfirmedAt', 'ERPNotPostedConfirmedByUserID', 'ERPNotPostedBasis',
      'SentAt', 'SentByUserID', 'SendAttemptCount', 'ErrorMessage',
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

  it('a plain save of Pending → Cancelled is refused — only Cancel() takes that edge (#213)', () => {
    asSaved('Pending', { SummaryJournalEntryID: 'SUM1' });
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

  // A plain save that set Sent and then Posted would record a posting the ERP never received.
  it.each([['Approved', 'Sent'], ['Failed', 'Sent'], ['Sent', 'Posted']])('a plain save of %s → %s is refused — only the dispatch engine takes that edge', (from, to) => {
    asSaved(from);
    batch.Status = to as typeof batch.Status;
    const result = batch.Validate();
    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => getErrorText(e).includes(`moves to ${to} only through the dispatch engine`))).toBe(true);
  });

  it.each([['Approved', 'Sent'], ['Failed', 'Sent'], ['Sent', 'Posted']])('SaveDispatchTransition lets %s → %s through', async (from, to) => {
    const save = vi.spyOn(BaseEntity.prototype, 'Save').mockImplementation(function (this: BaseEntity) {
      return Promise.resolve(this.Validate().Success);
    });
    try {
      asSaved(from);
      batch.Status = to as typeof batch.Status;
      expect(await batch.SaveDispatchTransition()).toBe(true);
      // The flag is down again once the save returns.
      expect(batch.Validate().Success).toBe(false);
    } finally {
      save.mockRestore();
    }
  });

  it('Sent → Failed stays a plain save: recording a failure calls no ERP', () => {
    asSaved('Sent');
    batch.Status = 'Failed';
    expect(batch.Validate().Errors.some(e => getErrorText(e).includes('only through the dispatch engine'))).toBe(false);
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
    const USER = { ID: 'U-CANCELLER' } as UserInfo;

    // Cancel() authorizes itself through JournalEntryBatchDispatchServices (#214). These cases are
    // about the mechanics, so the gate allows everything and the ERP offers no lookup; the rules
    // themselves are covered in CancelJournalEntryBatch.test.ts. A Pending batch reads as rejected,
    // so its cancel needs no reason.
    const cancelGate = {
      isRejected: vi.fn(async () => true),
      assertMayCancelPending: vi.fn(async () => undefined),
      assertMayCancelApproved: vi.fn(async () => undefined),
      recordCancellation: vi.fn(async () => undefined),
    } satisfies JournalEntryBatchCancelGate;
    class PermissiveDispatchServices extends JournalEntryBatchDispatchServices {
      public override CreateCancelGate(): JournalEntryBatchCancelGate { return cancelGate; }
      public override CreateLookup(): ErpJournalLookup { return async () => ({ status: 'Unavailable' }); }
    }
    MJGlobal.Instance.ClassFactory.Register(JournalEntryBatchDispatchServices, PermissiveDispatchServices, null, 1000, true);

    beforeEach(() => {
      cancelGate.recordCancellation.mockReset().mockResolvedValue(undefined);
      save = vi.spyOn(BaseEntity.prototype, 'Save').mockResolvedValue(true);
      teardown = vi.fn<JournalEntryBatchEntityServer['ReleaseMembersAndDeleteSummary']>().mockResolvedValue(undefined);
      batch.ReleaseMembersAndDeleteSummary = teardown;
      // Cancel() opens a provider transaction; the mock harness has no data provider, so give the
      // instance one that only knows the transaction verbs Cancel calls, and the summary-line read
      // a Failed batch's ERP lookup makes.
      Object.defineProperty(batch, 'ProviderToUse', {
        configurable: true,
        get: () => ({
          BeginTransaction: vi.fn().mockResolvedValue(undefined),
          CommitTransaction: vi.fn().mockResolvedValue(undefined),
          RollbackTransaction: vi.fn().mockResolvedValue(undefined),
          RunView: vi.fn().mockResolvedValue({ Success: true, Results: [] }),
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
      await batch.Cancel(USER);

      expect(teardown).toHaveBeenCalledTimes(1);
      expect(teardown).toHaveBeenCalledWith('SUM1', USER);
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

      await batch.Cancel(USER, { reason: 'Posting date belongs in October' });

      expect(save).toHaveBeenCalledTimes(1);
      expect(seenAtRelease).toEqual([{ status: 'Cancelled', pointer: null }]);
      expect(teardown).toHaveBeenCalledWith('SUM1', { ID: 'U-CANCELLER' });
      expect(batch.CancelReason).toBe('Posting date belongs in October');
      expect(batch.CancelledByUserID).toBe('U-CANCELLER');
      expect(batch.CancelledAt).toBeInstanceOf(Date);
    });

    it.each(['Approved', 'Failed'])('Cancel() refuses a %s batch without a reason', async (from) => {
      asSaved(from, { SummaryJournalEntryID: 'SUM1' });
      await expect(batch.Cancel(USER, { reason: '  ', confirmNotAlreadyPostedInERP: true })).rejects.toThrow(/reason is required/);
      expect(save).not.toHaveBeenCalled();
      expect(teardown).not.toHaveBeenCalled();
    });

    it.each([undefined, false])('Cancel() refuses a Failed batch the ERP cannot vouch for without the confirmation (%s)', async (confirm) => {
      asSaved('Failed', { SummaryJournalEntryID: 'SUM1' });
      await expect(batch.Cancel(USER, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: confirm }))
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

    it('Cancel() records the cancel on the approval Task inside the transaction, after the release', async () => {
      const order: string[] = [];
      teardown.mockImplementation(async () => { order.push('release'); });
      cancelGate.recordCancellation.mockImplementation(async () => { order.push('record'); });
      asSaved('Approved', { SummaryJournalEntryID: 'SUM1' });
      await batch.Cancel(USER, { reason: 'Wrong period' });
      expect(order).toEqual(['release', 'record']);
    });

    it('Cancel() refuses without a context user — the cancel is authorized as someone', async () => {
      asSaved('Pending', { SummaryJournalEntryID: 'SUM1' });
      await expect(batch.Cancel()).rejects.toThrow(/context user is required/);
      expect(save).not.toHaveBeenCalled();
      expect(teardown).not.toHaveBeenCalled();
    });

    it('a failed Cancel() rolls back and reloads the instance instead of claiming Cancelled', async () => {
      const load = vi.fn(async () => true);
      batch.Load = load as never;
      teardown.mockRejectedValue(new Error('member save failed'));
      asSaved('Approved', { SummaryJournalEntryID: 'SUM1' });

      await expect(batch.Cancel(USER, { reason: 'Wrong period' })).rejects.toThrow('member save failed');
      expect(load).toHaveBeenCalledWith('B1');
    });

    it('Cancel() needs no ERP confirmation from Approved — an Approved batch was never sent', async () => {
      asSaved('Approved', { SummaryJournalEntryID: 'SUM1' });
      await batch.Cancel(USER, { reason: 'Wrong period' });
      expect(batch.Status).toBe('Cancelled');
    });

    // ─── regenerate's empty cancel (#213) ─────────────────────────────────────

    it('CancelAfterTeardown() marks a torn-down Pending batch Cancelled, and Validate lets the edge through', async () => {
      const validationAtSave: boolean[] = [];
      save.mockImplementation(async () => { validationAtSave.push(batch.Validate().Success); return true; });
      asSaved('Pending', { SummaryJournalEntryID: null });

      await batch.CancelAfterTeardown();

      expect(batch.Status).toBe('Cancelled');
      expect(validationAtSave).toEqual([true]);
      expect(teardown).not.toHaveBeenCalled();
    });

    it('CancelAfterTeardown() refuses a batch that still points at its summary — the teardown did not run', async () => {
      asSaved('Pending', { SummaryJournalEntryID: 'SUM1' });
      await expect(batch.CancelAfterTeardown()).rejects.toThrow(/still points at its summary/);
      expect(save).not.toHaveBeenCalled();
      expect(batch.Status).toBe('Pending');
    });

    it.each(['Approved', 'Failed'])('CancelAfterTeardown() refuses %s — past approval, only Cancel() cancels', async (from) => {
      asSaved(from, { SummaryJournalEntryID: null });
      await expect(batch.CancelAfterTeardown()).rejects.toThrow(new RegExp(`is ${from}`));
      expect(save).not.toHaveBeenCalled();
    });

    it('a save after CancelAfterTeardown() does not inherit its permission', async () => {
      asSaved('Pending', { SummaryJournalEntryID: null });
      await batch.CancelAfterTeardown();
      asSaved('Pending', { SummaryJournalEntryID: null });
      batch.Status = 'Cancelled';
      expect(batch.Validate().Errors.some(e => getErrorText(e).includes('cancelled only through Cancel'))).toBe(true);
    });

    it.each(['Sent', 'Posted', 'Archived', 'Cancelled'])('Cancel() refuses a %s batch, naming the actual status', async (from) => {
      asSaved(from);
      await expect(batch.Cancel(USER, { reason: 'x', confirmNotAlreadyPostedInERP: true })).rejects.toThrow(new RegExp(`is ${from}`));
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

  // ─── the send audit (#184) ────────────────────────────────────────────────
  describe('every transition into Sent stamps who sent it and which attempt it is', () => {
    let save: ReturnType<typeof vi.spyOn>;
    const earlier = new Date('2026-09-01T12:00:00Z');
    /** A real UserInfo, built from its own init data: the stamp reads only its ID. */
    const userWithID = (id: string): UserInfo => new UserInfo(undefined, { ID: id });

    beforeEach(() => {
      save = vi.spyOn(BaseEntity.prototype, 'Save').mockResolvedValue(true);
    });

    afterEach(() => save.mockRestore());

    it('a first dispatch (Approved → Sent) is attempt 1, sent by the context user', async () => {
      batch.ContextCurrentUser = userWithID('U-DISPATCHER');
      asSaved('Approved', { SendAttemptCount: 0 });
      batch.Status = 'Sent';
      await batch.Save();

      expect(batch.SendAttemptCount).toBe(1);
      expect(batch.SentByUserID).toBe('U-DISPATCHER');
      expect(batch.SentAt).toBeInstanceOf(Date);
    });

    it('a retry (Failed → Sent) counts on from the loaded attempt and overwrites the earlier stamp', async () => {
      batch.ContextCurrentUser = userWithID('U-RETRIER');
      asSaved('Failed', { SendAttemptCount: 2, SentAt: earlier, SentByUserID: 'U-FIRST' });
      batch.Status = 'Sent';
      await batch.Save();

      expect(batch.SendAttemptCount).toBe(3);
      expect(batch.SentByUserID).toBe('U-RETRIER');
      expect(batch.SentAt).not.toEqual(earlier);
    });

    it('the count builds on the LOADED value, not one a caller set', async () => {
      batch.ContextCurrentUser = userWithID('U-RETRIER');
      asSaved('Failed', { SendAttemptCount: 1 });
      batch.SendAttemptCount = 40;
      batch.Status = 'Sent';
      await batch.Save();

      expect(batch.SendAttemptCount).toBe(2);
    });

    it('with no context user the sender is cleared, never left as the previous attempt\'s', async () => {
      asSaved('Failed', { SendAttemptCount: 1, SentByUserID: 'U-FIRST' });
      batch.Status = 'Sent';
      await batch.Save();

      expect(batch.SentByUserID).toBeNull();
    });

    it.each(['Posted', 'Failed'] as const)('leaving Sent (Sent → %s) does not restamp the send', async (to) => {
      batch.ContextCurrentUser = userWithID('U-OTHER');
      asSaved('Sent', { SendAttemptCount: 1, SentAt: earlier, SentByUserID: 'U-FIRST' });
      batch.Status = to;
      await batch.Save();

      expect(batch.SendAttemptCount).toBe(1);
      expect(batch.SentByUserID).toBe('U-FIRST');
      expect(batch.SentAt).toEqual(earlier);
    });

    it('a save that keeps a batch Sent does not restamp the send', async () => {
      batch.ContextCurrentUser = userWithID('U-OTHER');
      asSaved('Sent', { SendAttemptCount: 1, SentAt: earlier, SentByUserID: 'U-FIRST' });
      batch.ErrorMessage = 'annotated while Sent';
      await batch.Save();

      expect(batch.SendAttemptCount).toBe(1);
      expect(batch.SentByUserID).toBe('U-FIRST');
      expect(batch.SentAt).toEqual(earlier);
    });
  });
});
