/**
 * Unit tests for the approved-content seal and the summary-header check (#183).
 *
 * CheckControlTotalCoherence used to compare the batch with itself, so fields it never read —
 * PostingDate above all, the journal date the ERP receives — could change between approval and a
 * retry without it noticing. These cases pin the two additions: the summary entry must carry the
 * batch's date and company, and once approved the content must still hash to ApprovedContentHash.
 *
 * Same mock harness pattern as JournalEntryBatchInvariants.test.ts; the database reads are stubbed
 * at the batch's own seams (LoadSummaryJournalEntry, LoadMembers, the provider's RunView).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseEntity, Metadata, EntityInfo } from '@memberjunction/core';
import { JournalEntryBatchEntityServer } from '../JournalEntryBatchEntityServer.js';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';

const DATE_FIELDS = new Set(['PostingDate', 'BatchedAt', 'ApprovedAt', 'ArchivedAt', 'CancelledAt']);
const NUMBER_FIELDS = new Set(['TotalEntries', 'TotalDebits', 'TotalCredits']);

interface Line { ID: string; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }
interface Tag { JournalEntryLineID: string; DimensionID: string; DimensionValueID: string }

describe('JournalEntryBatchEntityServer — approved-content seal (#183)', () => {
  let batch: JournalEntryBatchEntityServer;
  let summary: { ID: string; CompanyID: string; EffectiveDate: Date };
  let lines: Line[];
  let tags: Tag[];
  let memberIds: string[];

  beforeEach(() => {
    const info = Object.create(EntityInfo.prototype);
    info.ID = 'id-batch';
    info.Name = BATCH_ENTITY;
    info.Status = 'Active';
    info.AllowDirectSQL = true;
    const fields = [
      'ID', 'JournalEntryBatchNumber', 'CompanyID', 'PostingDate', 'SummaryJournalEntryID', 'TargetSystem',
      'BatchedAt', 'BatchedByUserID', 'Status', 'TotalEntries', 'TotalDebits', 'TotalCredits',
      'ApprovedAt', 'ApprovedByUserID', 'ArchiveReason', 'ArchivedAt', 'ArchivedByUserID',
      'CancelReason', 'CancelledAt', 'CancelledByUserID', 'ApprovedContentHash',
    ].map(fn => ({
      Name: fn,
      CodeName: fn,
      Type: DATE_FIELDS.has(fn) ? 'date' : NUMBER_FIELDS.has(fn) ? 'decimal' : fn.endsWith('ID') ? 'uniqueidentifier' : 'nvarchar',
      TSType: DATE_FIELDS.has(fn) ? 'Date' : NUMBER_FIELDS.has(fn) ? 'number' : 'string',
      IsPrimaryKey: fn === 'ID',
      AutoIncrement: false,
      ReadOnly: false,
      AllowsNull: true,
      ValueIsPermittedByValueList: () => true,
    }));
    Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
    Object.defineProperty(info, 'PrimaryKeys', { get: () => fields.filter(f => f.IsPrimaryKey), configurable: true });
    Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
    Metadata.Provider = {
      Entities: [info],
      FindEntityByName: (name: string) => (name.toLowerCase() === BATCH_ENTITY.toLowerCase() ? info : undefined),
      Config: { ActiveStatusAssertions: false },
    } as never;

    batch = new JournalEntryBatchEntityServer(info);
    summary = { ID: 'SUM-1', CompanyID: 'CO-1', EffectiveDate: new Date('2026-09-30T00:00:00.000Z') };
    lines = [
      { ID: 'L-1', GLAccountID: 'GL-AR', DebitAmount: 100, CreditAmount: null },
      { ID: 'L-2', GLAccountID: 'GL-REV', DebitAmount: null, CreditAmount: 100 },
    ];
    tags = [{ JournalEntryLineID: 'L-2', DimensionID: 'DIM-DEPT', DimensionValueID: 'DV-EDU' }];
    memberIds = ['JE-1', 'JE-2'];

    batch.LoadSummaryJournalEntry = vi.fn(async () => summary as never);
    batch.LoadMembers = vi.fn(async () => [{ ID: 'SUM-1' }, ...memberIds.map(ID => ({ ID }))] as never);
    Object.defineProperty(batch, 'ProviderToUse', {
      configurable: true,
      get: () => ({
        RunView: vi.fn(async (params: { EntityName: string }) => ({ Success: true, Results: params.EntityName === JEL_ENTITY ? lines : tags })),
      }),
    });
  });

  /** A loaded batch at `status`, matching the summary above. */
  const asSaved = (status: string, extra: Record<string, unknown> = {}) =>
    batch.SetMany({
      ID: 'B-1', JournalEntryBatchNumber: 'JEB-000001', Status: status, CompanyID: 'CO-1',
      PostingDate: new Date('2026-09-30T00:00:00.000Z'), SummaryJournalEntryID: 'SUM-1', TargetSystem: 'BusinessCentral',
      TotalEntries: 2, TotalDebits: 100, TotalCredits: 100, ApprovedAt: new Date(), ApprovedByUserID: 'U-1',
      ...extra,
    }, true, true);

  /** Seal the batch as it stands now, the way the approval does. */
  const seal = async (status: string, extra: Record<string, unknown> = {}) => {
    asSaved(status, extra);
    const hash = await batch.ComputeApprovedContentHash();
    asSaved(status, { ...extra, ApprovedContentHash: hash });
    return hash;
  };

  it('an approved batch whose content is unchanged passes', async () => {
    await seal('Failed');
    expect(await batch.CheckControlTotalCoherence()).toEqual([]);
  });

  it('the hash is a 64-character hex SHA-256', async () => {
    asSaved('Approved');
    expect(await batch.ComputeApprovedContentHash()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('re-dating a Failed batch is caught twice: the summary header and the seal', async () => {
    const hash = await seal('Failed');
    asSaved('Failed', { ApprovedContentHash: hash, PostingDate: new Date('2026-10-31T00:00:00.000Z') });

    const problems = await batch.CheckControlTotalCoherence();
    expect(problems.some(p => p.includes('posts on 2026-10-31 but its summary journal entry is dated 2026-09-30'))).toBe(true);
    expect(problems.some(p => p.includes('no longer matches the content that was approved'))).toBe(true);
  });

  it('a changed dimension tag — invisible to footing and member count — breaks the seal', async () => {
    await seal('Approved');
    tags = [{ JournalEntryLineID: 'L-2', DimensionID: 'DIM-DEPT', DimensionValueID: 'DV-EVENTS' }];

    const problems = await batch.CheckControlTotalCoherence();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/no longer matches the content that was approved/);
  });

  it('a changed member set breaks the seal even when TotalEntries still matches', async () => {
    await seal('Approved');
    memberIds = ['JE-1', 'JE-3'];

    expect((await batch.CheckControlTotalCoherence()).some(p => p.includes('no longer matches'))).toBe(true);
  });

  it('the hash ignores the order rows come back in and the case of their IDs', async () => {
    asSaved('Approved');
    const before = await batch.ComputeApprovedContentHash();
    lines = [...lines].reverse().map(l => ({ ...l, ID: l.ID.toLowerCase(), GLAccountID: l.GLAccountID.toLowerCase() }));
    memberIds = [...memberIds].reverse();
    expect(await batch.ComputeApprovedContentHash()).toBe(before);
  });

  it('a batch approved before the seal existed gets the other checks, not a seal failure', async () => {
    asSaved('Failed', { ApprovedContentHash: null });
    expect(await batch.CheckControlTotalCoherence()).toEqual([]);

    asSaved('Failed', { ApprovedContentHash: null, PostingDate: new Date('2026-10-31T00:00:00.000Z') });
    const problems = await batch.CheckControlTotalCoherence();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/posts on 2026-10-31/);
  });

  it('a summary entry from another company is reported', async () => {
    await seal('Approved');
    summary = { ...summary, CompanyID: 'CO-2' };
    expect((await batch.CheckControlTotalCoherence()).some(p => p.includes("company does not match"))).toBe(true);
  });

  describe('the approval writes the seal', () => {
    let save: ReturnType<typeof vi.spyOn>;
    beforeEach(() => { save = vi.spyOn(BaseEntity.prototype, 'Save').mockResolvedValue(true); });
    afterEach(() => save.mockRestore());

    it('Pending → Approved stores the hash of the content being approved, over anything a caller put there', async () => {
      asSaved('Pending', { ApprovedAt: null, ApprovedByUserID: null, ApprovedContentHash: 'typed-by-a-caller' });
      const expected = await batch.ComputeApprovedContentHash();
      batch.Status = 'Approved';
      batch.ContextCurrentUser = { ID: 'U-CFO' } as never;

      await batch.Save();

      expect(batch.ApprovedContentHash).toBe(expected);
      expect(batch.ApprovedContentHash).not.toBe('typed-by-a-caller');
    });

    it('a save that is not the approval leaves the seal alone', async () => {
      asSaved('Failed', { ApprovedContentHash: 'sealed-at-approval' });
      batch.ErrorMessage = 'ERP timeout';
      await batch.Save();
      expect(batch.ApprovedContentHash).toBe('sealed-at-approval');
    });
  });
});
