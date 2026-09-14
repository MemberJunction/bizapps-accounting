import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Metadata, EntityInfo } from '@memberjunction/core';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { JournalEntryEntityServer } from '../JournalEntryEntityServer.js';
import { JournalEntryLineEntityServer } from '../JournalEntryLineEntityServer.js';

// Mock type IDs for the reversal-consistency rules (issue #24: the 'Reversal' discriminator is
// the JournalEntryType row's Code, resolved by EntryTypeID — mocked here, no DB in unit tests).
const JET_ORDERBOOKING = 'JET_ORDERBOOKING';
const JET_REVERSAL = 'JET_REVERSAL';

vi.mock('../JournalEntryTypes.js', () => ({
  LookupJournalEntryTypeByID: vi.fn(async (id: string) => {
    if (id === JET_REVERSAL) return { ID: JET_REVERSAL, Code: 'Reversal', Name: 'Reversal', IsSystem: true, IsJournalEntryBatchSummary: false, IsActive: true };
    if (id === JET_ORDERBOOKING) return { ID: JET_ORDERBOOKING, Code: 'OrderBooking', Name: 'Order Booking', IsSystem: false, IsJournalEntryBatchSummary: false, IsActive: true };
    return null;
  }),
  RequireJournalEntryTypeID: vi.fn(async () => JET_REVERSAL),
}));

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

describe('JournalEntryEntityServer & JournalEntryLineEntityServer (Extended Validation)', () => {
  let je: JournalEntryEntityServer;
  let jeEntityInfo: EntityInfo;
  let jelEntityInfo: EntityInfo;

  beforeEach(() => {
    // Stub Metadata.Provider with EntityInfo instances so BaseEntity constructor succeeds
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

      Object.defineProperty(info, 'Fields', {
        get: () => fields,
        configurable: true,
      });
      Object.defineProperty(info, 'PrimaryKeys', {
        get: () => fields.filter((f: any) => f.IsPrimaryKey),
        configurable: true,
      });
      Object.defineProperty(info, 'HasInactiveFields', {
        get: () => false,
        configurable: true,
      });
      return info;
    };

    jeEntityInfo = createMockEntity(JE_ENTITY, ['ID', 'CompanyID', 'EffectiveDate', 'EntryTypeID', 'Status', 'EntryNumber', 'ReversesJournalEntryID', 'ReversedByJournalEntryID', 'FileID']);
    jelEntityInfo = createMockEntity(JEL_ENTITY, ['ID', 'JournalEntryID', 'LineNumber', 'GLAccountID', 'DebitAmount', 'CreditAmount', 'Description']);
    const glEntityInfo = createMockEntity(GL_ENTITY, ['ID', 'CompanyID', 'Code', 'IsActive']);

    const entities = [jeEntityInfo, jelEntityInfo, glEntityInfo];

    Metadata.Provider = {
      Entities: entities,
      FindEntityByName: (name: string) => entities.find(e => e.Name.toLowerCase() === name.toLowerCase()),
      Config: { ActiveStatusAssertions: false },
      BeginTransaction: async () => {},
      CommitTransaction: async () => {},
      RollbackTransaction: async () => {},
    } as any;

    je = new JournalEntryEntityServer(jeEntityInfo as any);
    je.NewRecord();
    je.CompanyID = 'CO_100';
    je.EffectiveDate = new Date('2026-07-01');
    je.EntryTypeID = JET_ORDERBOOKING;
    je.Status = 'Pending';
  });

  const getErrorText = (e: any): string => (typeof e === 'string' ? e : (e?.Message || e?.Error || e?.message || String(e)));

  describe('Line Collection & Visibility (PascalCase API)', () => {
    // `Lines` is a RelatedRecordCollection now, not a bare array — it tracks removals, stamps the
    // foreign key and maintains the LineNumber sequence, none of which an array can do. Read
    // through `.Items` / `.Count`.
    it('initializes empty', () => {
      expect(je.Lines.Count).toBe(0);
      expect(je.Lines.Items).toEqual([]);
    });

    it('allows adding and removing lines via PascalCase AddLine and RemoveLine', () => {
      const line1 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line1.NewRecord();
      line1.GLAccountID = 'GL_1';
      line1.DebitAmount = 100;

      const line2 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line2.NewRecord();
      line2.GLAccountID = 'GL_2';
      line2.CreditAmount = 100;

      je.AddLine(line1);
      je.AddLine(line2);

      expect(je.Lines.Count).toBe(2);
      expect(line1.LineNumber).toBe(1);
      expect(line2.LineNumber).toBe(2);
      // The back-reference AddLine still sets by hand: the collection does not know about it, and
      // JournalEntryLineEntityServer.ValidateAsync reads it for the single-company rule (D3).
      expect(line1.ParentJournalEntry).toBe(je);

      je.RemoveLine(line1);
      expect(je.Lines.Count).toBe(1);
      expect(je.Lines.Items[0]).toBe(line2);
      // Removal re-applies the sequence, so the survivor is renumbered — which is what
      // UQ_JournalEntryLine_JE_LineNumber requires.
      expect(line2.LineNumber).toBe(1);
    });
  });

  describe('Synchronous Validation Rules (Validate)', () => {
    it('fails validation when Journal Entry has fewer than 2 lines', () => {
      const line1 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line1.NewRecord();
      line1.GLAccountID = 'GL_1';
      line1.DebitAmount = 100;
      je.AddLine(line1);

      const result = je.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes('at least 2 line items'))).toBe(true);
    });

    it('does not let TWO UNTOUCHED ROWS satisfy the double-entry rule', () => {
      // The editor opens with blank rows and keeps one at the bottom, so `Lines.Count` is never the
      // number of lines an entry HAS. Counting them all would let an empty draft pass — and the
      // balance check would agree with it, because zero equals zero.
      const blank1 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      blank1.NewRecord();
      const blank2 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      blank2.NewRecord();
      je.AddLine(blank1);
      je.AddLine(blank2);

      const result = je.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes('Found 0 line(s)'))).toBe(true);
    });

    it('refuses a BLANK line among real ones, by number', () => {
      // A blank row is quiet in the editor by design. Reaching a save it is a defect: GLAccountID is
      // NOT NULL, so without this it fails at the insert with a constraint message instead of a
      // sentence anyone can act on.
      const line1 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line1.NewRecord();
      line1.GLAccountID = 'GL_1';
      line1.DebitAmount = 100;

      const line2 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line2.NewRecord();
      line2.GLAccountID = 'GL_2';
      line2.CreditAmount = 100;

      const blank = new JournalEntryLineEntityServer(jelEntityInfo as any);
      blank.NewRecord();

      je.AddLine(line1);
      je.AddLine(line2);
      je.AddLine(blank);

      const result = je.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes('Line 3 is blank'))).toBe(true);
    });

    it('fails validation when debits and credits are unbalanced', () => {
      const line1 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line1.NewRecord();
      line1.GLAccountID = 'GL_1';
      line1.DebitAmount = 100;

      const line2 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line2.NewRecord();
      line2.GLAccountID = 'GL_2';
      line2.CreditAmount = 80;

      je.AddLine(line1);
      je.AddLine(line2);

      const result = je.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes('Unbalanced Journal Entry'))).toBe(true);
    });

    it('accepts a four-line entry whose credits accumulate past the penny in binary floating point', () => {
      // Dr AR 302.59 / Cr 233.51 + 25.30 + 43.78 — the real shape from bizapps-orders, where one
      // order line carries goods, tax and shipping. The credit side sums to 302.59000000000003 in
      // IEEE-754, and exact equality rejected it while printing BOTH sides as "302.59".
      expect(233.51 + 25.30 + 43.78).not.toBe(302.59); // the premise, stated rather than assumed

      const mk = (debit: number, credit: number, gl: string) => {
        const l = new JournalEntryLineEntityServer(jelEntityInfo as any);
        l.NewRecord();
        l.GLAccountID = gl;
        if (debit) l.DebitAmount = debit;
        if (credit) l.CreditAmount = credit;
        return l;
      };
      je.AddLine(mk(302.59, 0, 'GL_AR'));
      je.AddLine(mk(0, 233.51, 'GL_SALES'));
      je.AddLine(mk(0, 25.30, 'GL_TAX'));
      je.AddLine(mk(0, 43.78, 'GL_SHIP'));

      const result = je.Validate();
      expect(
        result.Errors.some(e => getErrorText(e).includes('Unbalanced Journal Entry')),
      ).toBe(false);
    });

    it('still rejects an entry that is out by a whole penny', () => {
      // The tolerance must not become a licence. A penny is the smallest storable discrepancy —
      // DebitAmount is DECIMAL(18,2) — and is two hundred times the epsilon, so a real imbalance
      // can never be mistaken for summation noise.
      const line1 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line1.NewRecord();
      line1.GLAccountID = 'GL_1';
      line1.DebitAmount = 100.0;

      const line2 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line2.NewRecord();
      line2.GLAccountID = 'GL_2';
      line2.CreditAmount = 99.99;

      je.AddLine(line1);
      je.AddLine(line2);

      const result = je.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes('Unbalanced Journal Entry'))).toBe(true);
    });

    it('fails validation when a line specifies both Debit and Credit amounts', () => {
      const line1 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line1.NewRecord();
      line1.GLAccountID = 'GL_1';
      line1.DebitAmount = 100;
      line1.CreditAmount = 50;

      const line2 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line2.NewRecord();
      line2.GLAccountID = 'GL_2';
      line2.CreditAmount = 50;

      je.AddLine(line1);
      je.AddLine(line2);

      const result = je.Validate();
      expect(result.Success).toBe(false);
      // The wording moved with the rule: it lives on `JournalEntryLineEntity`, the SHARED subclass, so
      // the browser refuses this before a round trip and says the same thing when the server does.
      expect(result.Errors.some(e => getErrorText(e).includes('is either a debit or a credit, not both'))).toBe(true);
    });


    it('fails validation when a line specifies negative amounts', () => {
      const line1 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line1.NewRecord();
      line1.GLAccountID = 'GL_1';
      line1.DebitAmount = -100;

      const line2 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line2.NewRecord();
      line2.GLAccountID = 'GL_2';
      line2.CreditAmount = -100;

      je.AddLine(line1);
      je.AddLine(line2);

      const result = je.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes('cannot have a negative'))).toBe(true);
    });

    it('fails async validation when the type is Reversal but ReversesJournalEntryID is missing (issue #24: rule moved to ValidateAsync)', async () => {
      je.EntryTypeID = JET_REVERSAL;
      const result = await je.ValidateAsync();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes('must specify ReversesJournalEntryID'))).toBe(true);
    });

    it('fails async validation when ReversesJournalEntryID is set but the type is not Reversal', async () => {
      je.EntryTypeID = JET_ORDERBOOKING;
      je.ReversesJournalEntryID = 'JE_SOME_ORIGINAL';
      const result = await je.ValidateAsync();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes("Code='Reversal'"))).toBe(true);
    });

    it('fails validation when a reversal-shaped entry is unbalanced (sync rules still run)', () => {
      const line1 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line1.NewRecord();
      line1.GLAccountID = 'GL_1';
      line1.DebitAmount = 100;

      const line2 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line2.NewRecord();
      line2.GLAccountID = 'GL_2';
      line2.CreditAmount = 60;

      je.AddLine(line1);
      je.AddLine(line2);
      je.EntryTypeID = JET_REVERSAL;
      je.ReversesJournalEntryID = 'JE_SOME_ORIGINAL';

      const result = je.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => /balanced|Debits/i.test(getErrorText(e)))).toBe(true);
    });

    it('fails validation when a line GL account belongs to a different company than parent JE', () => {
      const line1 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line1.NewRecord();
      line1.GLAccountID = 'GL_OTHER_COMPANY';
      line1.DebitAmount = 100;

      const line2 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line2.NewRecord();
      line2.GLAccountID = 'GL_100';
      line2.CreditAmount = 100;

      je.AddLine(line1);
      je.AddLine(line2);

      // Inject mock GL accounts into AccountingEngineBase instance cache
      (AccountingEngineBase.Instance as any)._glAccounts = [
        { ID: 'GL_OTHER_COMPANY', CompanyID: 'CO_999', Code: '1001', IsActive: true },
        { ID: 'GL_100', CompanyID: 'CO_100', Code: '2001', IsActive: true },
      ];

      const result = je.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes('belongs to company CO_999, but parent Journal Entry belongs to company CO_100'))).toBe(true);
    });

    it('a NEW journal entry must start Pending — creating one directly as GLPosted fails (status-graph hardening)', () => {
      // Without this rule a direct client save could INSERT a GLPosted JE with forged
      // GLPostedAt/GLReferenceID — the DB immutability trigger only polices UPDATE/DELETE.
      // (The saved-record transition graph — e.g. Batched→GLPosted needing a dispatched batch —
      // requires OldValue state and lives with the live tier-2 harness, like the batch's graph.)
      je.Status = 'GLPosted';
      const result = je.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes("must start at Status='Pending'"))).toBe(true);
    });

    it('a NEW journal entry created directly as Batched also fails', () => {
      je.Status = 'Batched';
      const result = je.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes("must start at Status='Pending'"))).toBe(true);
    });

    it('passes validation for a valid, balanced 2-line Journal Entry with matching company GL accounts', () => {
      const line1 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line1.NewRecord();
      line1.GLAccountID = 'GL_100_A';
      line1.DebitAmount = 150.50;

      const line2 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line2.NewRecord();
      line2.GLAccountID = 'GL_100_B';
      line2.CreditAmount = 150.50;

      je.AddLine(line1);
      je.AddLine(line2);

      (AccountingEngineBase.Instance as any)._glAccounts = [
        { ID: 'GL_100_A', CompanyID: 'CO_100', Code: '1001', IsActive: true },
        { ID: 'GL_100_B', CompanyID: 'CO_100', Code: '2001', IsActive: true },
      ];

      const result = je.Validate();
      expect(result.Errors.map(getErrorText)).toEqual([]);
      expect(result.Success).toBe(true);
    });
  });
});
