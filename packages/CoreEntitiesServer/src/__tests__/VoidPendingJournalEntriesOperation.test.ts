/**
 * Accounting.VoidPendingJournalEntries (golive #378): Pending, unbatched entries are voided in place,
 * all or nothing, with the caller as the voider and the reason recorded; anything that has left the
 * subledger, or whose void would strand a reversal or an approval, is refused before any write. The
 * entities are stand-ins: what is under test is which entries the operation writes and what it
 * refuses, not the entity's own save.
 */
import { describe, it, expect, vi } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import {
  VoidPendingJournalEntriesOperation,
  VoidProblems,
  type VoidCandidate,
  type VoidPendingJournalEntriesInput,
  type VoidPendingJournalEntriesOutput,
} from '../VoidPendingJournalEntriesOperation.js';

const JE_1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const JE_2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const SUMMARY_TYPE = 'eeeeeeee-0000-4000-8000-00000000000f';
const RECOGNITION_TYPE = 'eeeeeeee-0000-4000-8000-000000000001';
const USER = { ID: 'U-1' } as UserInfo;

vi.mock('../JournalEntryTypes.js', () => ({
  GetJournalEntryBatchSummaryEntryType: vi.fn(async () => ({ ID: SUMMARY_TYPE, Code: 'JournalEntryBatchSummary' })),
}));

interface FakeEntry extends VoidCandidate {
  SaveVoided: ReturnType<typeof vi.fn>;
  LatestResult?: { CompleteMessage: string };
}

function entry(id: string, overrides: Partial<FakeEntry> = {}): FakeEntry {
  return {
    ID: id, EntryNumber: `JE-${id.slice(-1)}`, Status: 'Pending', EntryTypeID: RECOGNITION_TYPE, JournalEntryBatchID: null,
    ReversesJournalEntryID: null, ReversedByJournalEntryID: null, ApprovalTaskID: null, ApprovedAt: null,
    SaveVoided: vi.fn(async () => true), ...overrides,
  };
}

function world(entries: FakeEntry[], depth = 0) {
  const filters: string[] = [];
  const tx = { begin: vi.fn(), commit: vi.fn(), rollback: vi.fn() };
  const provider = {
    TransactionDepth: depth,
    BeginTransaction: tx.begin,
    CommitTransaction: tx.commit,
    RollbackTransaction: tx.rollback,
    RunView: async (params: { ExtraFilter: string }) => {
      filters.push(params.ExtraFilter);
      return { Success: true, Results: entries };
    },
  } as unknown as IMetadataProvider;
  return { provider, filters, tx };
}

class TestOperation extends VoidPendingJournalEntriesOperation {
  public Run(input: VoidPendingJournalEntriesInput, provider: IMetadataProvider, user: UserInfo): Promise<VoidPendingJournalEntriesOutput> {
    return this.InternalExecute(input, provider, user);
  }
}

const voiding = (...ids: string[]): VoidPendingJournalEntriesInput => ({ JournalEntryIDs: ids, Reason: 'Order ORD-1 line 1 fully returned' });

describe('Accounting.VoidPendingJournalEntries — success', () => {
  it('voids every named entry as the caller, with the reason, in one transaction', async () => {
    const entries = [entry(JE_1), entry(JE_2)];
    const { provider, filters, tx } = world(entries);
    const out = await new TestOperation().Run(voiding(JE_1, JE_2), provider, USER);
    expect(out.Voided).toEqual([
      { JournalEntryID: JE_1, EntryNumber: 'JE-1' },
      { JournalEntryID: JE_2, EntryNumber: 'JE-2' },
    ]);
    for (const e of entries) expect(e.SaveVoided).toHaveBeenCalledWith('Order ORD-1 line 1 fully returned', 'U-1');
    expect(filters[0]).toBe(`ID IN ('${JE_1}','${JE_2}')`);
    expect(tx.begin).toHaveBeenCalledTimes(1);
    expect(tx.commit).toHaveBeenCalledTimes(1);
  });

  it('naming no entries is not an error and reads nothing', async () => {
    const { provider, filters } = world([]);
    expect(await new TestOperation().Run(voiding(), provider, USER)).toEqual({ Voided: [] });
    expect(filters).toHaveLength(0);
  });

  it("joins the caller's transaction instead of opening one", async () => {
    const { provider, tx } = world([entry(JE_1)], 1);
    await new TestOperation().Run(voiding(JE_1), provider, USER);
    expect(tx.begin).not.toHaveBeenCalled();
    expect(tx.commit).not.toHaveBeenCalled();
  });

  it('rolls back every void when one save fails', async () => {
    const entries = [entry(JE_1), entry(JE_2, { SaveVoided: vi.fn(async () => false), LatestResult: { CompleteMessage: 'trigger said no' } })];
    const { provider, tx } = world(entries);
    await expect(new TestOperation().Run(voiding(JE_1, JE_2), provider, USER)).rejects.toThrow('JE-2 could not be voided: trigger said no');
    expect(tx.rollback).toHaveBeenCalledTimes(1);
    expect(tx.commit).not.toHaveBeenCalled();
  });
});

describe('Accounting.VoidPendingJournalEntries — refusals', () => {
  it.each([
    ['Batched', { Status: 'Batched', JournalEntryBatchID: 'bbbbbbbb-0000-4000-8000-000000000001' }, /JE-2 is Batched: only a Pending entry in no batch can be voided. Reverse it instead/],
    ['GLPosted', { Status: 'GLPosted' }, /JE-2 is GLPosted/],
    ['Pending in a batch', { JournalEntryBatchID: 'bbbbbbbb-0000-4000-8000-000000000001' }, /JE-2 is in a batch/],
    ['already voided', { Status: 'Voided' }, /JE-2 is already voided/],
    ['reversed', { ReversedByJournalEntryID: 'aaaaaaaa-0000-4000-8000-000000000009' }, /JE-2 has been reversed/],
    ['a reversal', { ReversesJournalEntryID: 'aaaaaaaa-0000-4000-8000-000000000009' }, /JE-2 reverses another entry/],
    ['a batch summary', { EntryTypeID: SUMMARY_TYPE }, /JE-2 is a batch summary/],
    ['awaiting approval', { ApprovalTaskID: 'tttttttt-0000-4000-8000-000000000001' }, /JE-2 is waiting for its manual-entry approval/],
  ])('refuses when any entry is %s, and voids none of them', async (_label, overrides, message) => {
    const entries = [entry(JE_1), entry(JE_2, overrides as Partial<FakeEntry>)];
    const { provider, tx } = world(entries);
    await expect(new TestOperation().Run(voiding(JE_1, JE_2), provider, USER)).rejects.toThrow(message);
    for (const e of entries) expect(e.SaveVoided).not.toHaveBeenCalled();
    expect(tx.begin).not.toHaveBeenCalled();
  });

  it('voids a manual entry whose approval is already recorded', async () => {
    const approved = entry(JE_1, { ApprovalTaskID: 'tttttttt-0000-4000-8000-000000000001', ApprovedAt: new Date() });
    const { provider } = world([approved]);
    await new TestOperation().Run(voiding(JE_1), provider, USER);
    expect(approved.SaveVoided).toHaveBeenCalled();
  });

  it('refuses a blank reason before reading anything', async () => {
    const { provider, filters } = world([entry(JE_1)]);
    await expect(new TestOperation().Run({ JournalEntryIDs: [JE_1], Reason: '  ' }, provider, USER)).rejects.toThrow('a void needs a reason');
    expect(filters).toHaveLength(0);
  });

  it('refuses an ID that is not a GUID before reading anything', async () => {
    const { provider, filters } = world([entry(JE_1)]);
    await expect(new TestOperation().Run(voiding("x' OR 1=1 --"), provider, USER)).rejects.toThrow(/is not a valid ID/);
    expect(filters).toHaveLength(0);
  });

  it('refuses an entry that does not exist', async () => {
    const { provider } = world([entry(JE_1)]);
    await expect(new TestOperation().Run(voiding(JE_1, JE_2), provider, USER)).rejects.toThrow(`journal entry ${JE_2} was not found`);
  });
});

describe('VoidProblems — pure', () => {
  it('names every blocking entry in one refusal', () => {
    const problems = VoidProblems([entry(JE_1, { Status: 'Batched' }), entry(JE_2, { Status: 'GLPosted' })], SUMMARY_TYPE);
    expect(problems).toHaveLength(2);
  });

  it('has nothing to say about Pending, unbatched entries', () => {
    expect(VoidProblems([entry(JE_1), entry(JE_2)], SUMMARY_TYPE)).toEqual([]);
  });
});
