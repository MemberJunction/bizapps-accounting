/**
 * Accounting.RedatePendingJournalEntries (golive #448): a payment's Pending, unbatched entries move to
 * the corrected day in place, all or nothing, and the operation refuses a caller without the
 * batch-operator Authorization, a batched or posted entry, a closed month, a day before the posting
 * start date, and a move across fiscal years. The entities are stand-ins: what is under test is which
 * entries the operation writes and what it refuses, not the entity's own save.
 */
import { describe, it, expect, vi } from 'vitest';
import type { AuthorizationInfo, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { JOURNAL_ENTRY_BATCH_OPERATE_AUTH } from '@mj-biz-apps/accounting-engine-base';
import {
  NamedEntriesFilter,
  RedatePendingJournalEntriesOperation,
  RedateProblems,
  type CompanyDateRules,
  type RedatePendingJournalEntriesInput,
  type RedatePendingJournalEntriesOutput,
} from '../RedatePendingJournalEntriesOperation.js';

const CO = 'cccccccc-0000-4000-8000-000000000001';
const PAYMENT_ENTITY_ID = 'eeeeeeee-0000-4000-8000-000000000001';
const PAYMENT_ID = 'dddddddd-0000-4000-8000-000000000001';
const JE_1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const JE_2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const FINANCE = { ID: 'U-FINANCE' } as UserInfo;
const OTHER = { ID: 'U-OTHER' } as UserInfo;

interface FakeEntry {
  ID: string;
  EntryNumber: string;
  CompanyID: string;
  EffectiveDate: Date;
  Status: string;
  JournalEntryBatchID: string | null;
  ReversedByJournalEntryID: string | null;
  SaveRedatedEffectiveDate: ReturnType<typeof vi.fn>;
}

function entry(id: string, day: string, overrides: Partial<FakeEntry> = {}): FakeEntry {
  return {
    ID: id, EntryNumber: `JE-${id.slice(-1)}`, CompanyID: CO, EffectiveDate: new Date(`${day}T00:00:00Z`), Status: 'Pending',
    JournalEntryBatchID: null, ReversedByJournalEntryID: null, SaveRedatedEffectiveDate: vi.fn(async () => true), ...overrides,
  };
}

function rules(overrides: Partial<CompanyDateRules> = {}): CompanyDateRules {
  return { ID: CO, BooksClosedThroughDate: null, PostingStartDate: null, FiscalYearStartMonth: null, FiscalYearStartDay: null, ...overrides };
}

function world(entries: FakeEntry[], profile: CompanyDateRules = rules(), withAuth = true) {
  const filters: string[] = [];
  const tx = { begin: vi.fn(), commit: vi.fn(), rollback: vi.fn() };
  const auth = { ID: 'AUTH', Name: JOURNAL_ENTRY_BATCH_OPERATE_AUTH, ParentID: null, UserCanExecute: (u: UserInfo) => u.ID === FINANCE.ID };
  const provider = {
    Authorizations: (withAuth ? [auth] : []) as unknown as AuthorizationInfo[],
    EntityByName: (name: string) => (name === 'MJ_BizApps_Orders: Payment Headers' ? { ID: PAYMENT_ENTITY_ID, Name: name } : undefined),
    TransactionDepth: 0,
    BeginTransaction: tx.begin,
    CommitTransaction: tx.commit,
    RollbackTransaction: tx.rollback,
    RunView: async (params: { EntityName: string; ExtraFilter: string }) => {
      filters.push(params.ExtraFilter);
      if (params.EntityName.endsWith('Journal Entries')) return { Success: true, Results: entries };
      return { Success: true, Results: [profile] };
    },
  } as unknown as IMetadataProvider;
  return { provider, filters, tx };
}

class TestOperation extends RedatePendingJournalEntriesOperation {
  public Run(input: RedatePendingJournalEntriesInput, provider: IMetadataProvider, user: UserInfo): Promise<RedatePendingJournalEntriesOutput> {
    return this.InternalExecute(input, provider, user);
  }
}

const byPayment = (day: string): RedatePendingJournalEntriesInput => ({
  EffectiveDate: day, LinkedEntity: 'MJ_BizApps_Orders: Payment Headers', LinkedRecordIDs: [PAYMENT_ID],
});

describe('Accounting.RedatePendingJournalEntries — success', () => {
  it("moves the payment's Pending entries to the day, in one transaction, and reports them", async () => {
    const entries = [entry(JE_1, '2026-11-02'), entry(JE_2, '2026-11-02')];
    const { provider, filters, tx } = world(entries);
    const out = await new TestOperation().Run(byPayment('2026-10-30'), provider, FINANCE);
    expect(out.Changed.map(c => [c.JournalEntryID, c.PreviousEffectiveDate, c.EffectiveDate])).toEqual([
      [JE_1, '2026-11-02', '2026-10-30'],
      [JE_2, '2026-11-02', '2026-10-30'],
    ]);
    for (const e of entries) expect(e.SaveRedatedEffectiveDate).toHaveBeenCalledWith('2026-10-30');
    expect(filters[0]).toBe(`LinkedEntityID='${PAYMENT_ENTITY_ID}' AND LinkedRecordID IN ('${PAYMENT_ID}')`);
    expect(tx.begin).toHaveBeenCalledTimes(1);
    expect(tx.commit).toHaveBeenCalledTimes(1);
  });

  it('writes nothing for an entry already on the day, and nothing at all when every entry is', async () => {
    const entries = [entry(JE_1, '2026-10-30')];
    const { provider, tx } = world(entries);
    const out = await new TestOperation().Run(byPayment('2026-10-30'), provider, FINANCE);
    expect(out).toEqual({ EffectiveDate: '2026-10-30', Changed: [], UnchangedJournalEntryIDs: [JE_1] });
    expect(entries[0].SaveRedatedEffectiveDate).not.toHaveBeenCalled();
    expect(tx.begin).not.toHaveBeenCalled();
  });

  it('a payment with no entries yet is not an error', async () => {
    const { provider } = world([]);
    const out = await new TestOperation().Run(byPayment('2026-10-30'), provider, FINANCE);
    expect(out.Changed).toEqual([]);
  });

  it("joins the caller's transaction instead of opening one", async () => {
    const { provider, tx } = world([entry(JE_1, '2026-11-02')]);
    (provider as unknown as { TransactionDepth: number }).TransactionDepth = 1;
    await new TestOperation().Run(byPayment('2026-10-30'), provider, FINANCE);
    expect(tx.begin).not.toHaveBeenCalled();
    expect(tx.commit).not.toHaveBeenCalled();
  });

  it('rolls back every entry when one save fails', async () => {
    const entries = [entry(JE_1, '2026-11-02'), entry(JE_2, '2026-11-02', { SaveRedatedEffectiveDate: vi.fn(async () => false) })];
    const { provider, tx } = world(entries);
    await expect(new TestOperation().Run(byPayment('2026-10-30'), provider, FINANCE)).rejects.toThrow(/JE-2 could not be re-dated/);
    expect(tx.rollback).toHaveBeenCalledTimes(1);
    expect(tx.commit).not.toHaveBeenCalled();
  });
});

describe('Accounting.RedatePendingJournalEntries — refusals', () => {
  it('refuses a caller without the batch-operator Authorization, before any read', async () => {
    const { provider, filters } = world([entry(JE_1, '2026-11-02')]);
    await expect(new TestOperation().Run(byPayment('2026-10-30'), provider, OTHER)).rejects.toThrow(`requires the ${JOURNAL_ENTRY_BATCH_OPERATE_AUTH} authorization`);
    expect(filters).toHaveLength(0);
  });

  it('refuses everyone when the Authorization is missing from the catalog', async () => {
    const { provider } = world([entry(JE_1, '2026-11-02')], rules(), false);
    await expect(new TestOperation().Run(byPayment('2026-10-30'), provider, FINANCE)).rejects.toThrow(/the Finance role/);
  });

  it.each([
    ['Batched', { Status: 'Batched', JournalEntryBatchID: 'bbbbbbbb-0000-4000-8000-000000000001' }, /JE-2 is Batched: its date is fixed once it is batched/],
    ['GLPosted', { Status: 'GLPosted' }, /JE-2 is GLPosted/],
    ['Pending in a batch', { JournalEntryBatchID: 'bbbbbbbb-0000-4000-8000-000000000001' }, /JE-2 is in a batch/],
    ['reversed', { ReversedByJournalEntryID: 'aaaaaaaa-0000-4000-8000-000000000009' }, /JE-2 has been reversed/],
  ])('refuses when any entry is %s, and writes none of them', async (_label, overrides, message) => {
    const entries = [entry(JE_1, '2026-11-02'), entry(JE_2, '2026-11-02', overrides)];
    const { provider } = world(entries);
    await expect(new TestOperation().Run(byPayment('2026-10-30'), provider, FINANCE)).rejects.toThrow(message);
    for (const e of entries) expect(e.SaveRedatedEffectiveDate).not.toHaveBeenCalled();
  });

  it('refuses a day on or before the books-closed-through date', async () => {
    const entries = [entry(JE_1, '2026-11-02')];
    const { provider } = world(entries, rules({ BooksClosedThroughDate: new Date('2026-10-31T00:00:00Z') }));
    await expect(new TestOperation().Run(byPayment('2026-10-31'), provider, FINANCE))
      .rejects.toThrow('2026-10-31 is in a month finance has closed: the books are closed through 2026-10-31. Choose 2026-11-01 or later');
    expect(entries[0].SaveRedatedEffectiveDate).not.toHaveBeenCalled();
  });

  it("refuses a day before the company's posting start date, and allows the start date itself", async () => {
    const profile = rules({ PostingStartDate: new Date('2026-11-01T00:00:00Z') });
    await expect(new TestOperation().Run(byPayment('2026-10-31'), world([entry(JE_1, '2026-11-02')], profile).provider, FINANCE))
      .rejects.toThrow(/before the company's posting start date 2026-11-01/);
    const out = await new TestOperation().Run(byPayment('2026-11-01'), world([entry(JE_1, '2026-11-02')], profile).provider, FINANCE);
    expect(out.Changed).toHaveLength(1);
  });

  it('refuses a move across fiscal years', async () => {
    const { provider } = world([entry(JE_1, '2027-01-02')]);
    await expect(new TestOperation().Run(byPayment('2026-12-31'), provider, FINANCE)).rejects.toThrow(/into fiscal year 2026, but its number belongs to fiscal year 2027/);
  });

  it('refuses a malformed day', async () => {
    const { provider } = world([entry(JE_1, '2026-11-02')]);
    await expect(new TestOperation().Run(byPayment('10/30/2026'), provider, FINANCE)).rejects.toThrow(/is not a YYYY-MM-DD date/);
  });

  it('refuses a JournalEntryIDs selection naming an entry that does not exist', async () => {
    const { provider } = world([entry(JE_1, '2026-11-02')]);
    await expect(new TestOperation().Run({ EffectiveDate: '2026-10-30', JournalEntryIDs: [JE_1, JE_2] }, provider, FINANCE))
      .rejects.toThrow(`journal entry ${JE_2} was not found`);
  });
});

describe('RedateProblems and NamedEntriesFilter — pure', () => {
  it('names every blocking entry in one refusal', () => {
    const problems = RedateProblems([entry(JE_1, '2026-11-02', { Status: 'Batched' }), entry(JE_2, '2026-11-02', { Status: 'GLPosted' })], '2026-10-30', [rules()]);
    expect(problems).toHaveLength(2);
  });

  it('honours a fiscal year that starts mid-year', () => {
    const july = rules({ FiscalYearStartMonth: 7, FiscalYearStartDay: 1 });
    expect(RedateProblems([entry(JE_1, '2027-01-02')], '2026-12-31', [july])).toEqual([]);
    expect(RedateProblems([entry(JE_1, '2026-07-01')], '2026-06-30', [july])).toHaveLength(1);
  });

  it('asks for exactly one way of naming the entries, and refuses ids that are not GUIDs', () => {
    const { provider } = world([]);
    expect(() => NamedEntriesFilter({ EffectiveDate: '2026-10-30' }, provider)).toThrow(/either by JournalEntryIDs or by LinkedEntity/);
    expect(() => NamedEntriesFilter({ ...byPayment('2026-10-30'), JournalEntryIDs: [JE_1] }, provider)).toThrow(/not both or neither/);
    expect(() => NamedEntriesFilter({ EffectiveDate: '2026-10-30', JournalEntryIDs: ["x' OR 1=1 --"] }, provider)).toThrow(/is not a valid ID/);
    expect(() => NamedEntriesFilter({ EffectiveDate: '2026-10-30', LinkedEntity: 'Nope', LinkedRecordIDs: [PAYMENT_ID] }, provider)).toThrow(/'Nope' is not an entity/);
    expect(NamedEntriesFilter({ EffectiveDate: '2026-10-30', JournalEntryIDs: [JE_1] }, provider)).toBe(`ID IN ('${JE_1}')`);
  });

  it('escapes a linked record id rather than concatenating it raw', () => {
    const { provider } = world([]);
    expect(NamedEntriesFilter({ EffectiveDate: '2026-10-30', LinkedEntity: 'MJ_BizApps_Orders: Payment Headers', LinkedRecordIDs: ["a'b"] }, provider))
      .toContain(`LinkedRecordID IN ('a''b')`);
  });
});
