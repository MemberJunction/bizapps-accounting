import { describe, it, expect, beforeEach } from 'vitest';
import { Metadata, EntityInfo } from '@memberjunction/core';
import { JournalEntryEntityServer } from '../JournalEntryEntityServer.js';
import { JournalEntryLineEntityServer } from '../JournalEntryLineEntityServer.js';

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
      })) as any[];

      Object.defineProperty(info, 'Fields', {
        get: () => fields,
        configurable: true,
      });
      Object.defineProperty(info, 'PrimaryKeys', {
        get: () => fields.filter((f: any) => f.IsPrimaryKey),
        configurable: true,
      });
      return info;
    };

    jeEntityInfo = createMockEntity(JE_ENTITY, ['ID', 'CompanyID', 'EffectiveDate', 'EntryType', 'Status', 'EntryNumber', 'ReversesJournalEntryID', 'ReversedByJournalEntryID', 'FileID']);
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
    je.EntryType = 'OrderBooking';
    je.Status = 'Pending';
  });

  const getErrorText = (e: any): string => (typeof e === 'string' ? e : (e?.Message || e?.Error || e?.message || String(e)));

  describe('Line Collection & Visibility (PascalCase API)', () => {
    it('initializes with empty lines array', () => {
      expect(je.Lines).toEqual([]);
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

      expect(je.Lines).toHaveLength(2);
      expect(line1.LineNumber).toBe(1);
      expect(line2.LineNumber).toBe(2);
      expect(line1.ParentJournalEntry).toBe(je);

      je.RemoveLine(line1);
      expect(je.Lines).toHaveLength(1);
      expect(je.Lines[0]).toBe(line2);
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
      expect(result.Errors.some(e => getErrorText(e).includes('Cannot specify both DebitAmount'))).toBe(true);
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
      expect(result.Errors.some(e => getErrorText(e).includes('cannot be negative'))).toBe(true);
    });

    it('fails validation when EntryType is Reversal but ReversesJournalEntryID is missing', () => {
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
      je.EntryType = 'Reversal';

      const result = je.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes('must specify ReversesJournalEntryID'))).toBe(true);
    });

    it('passes validation for a valid, balanced 2-line Journal Entry', () => {
      const line1 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line1.NewRecord();
      line1.GLAccountID = 'GL_1';
      line1.DebitAmount = 150.50;

      const line2 = new JournalEntryLineEntityServer(jelEntityInfo as any);
      line2.NewRecord();
      line2.GLAccountID = 'GL_2';
      line2.CreditAmount = 150.50;

      je.AddLine(line1);
      je.AddLine(line2);

      const result = je.Validate();
      expect(result.Errors.map(getErrorText)).toEqual([]);
      expect(result.Success).toBe(true);
    });
  });
});
