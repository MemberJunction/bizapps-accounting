/**
 * Original-currency amounts on journal-entry lines, server side (bizapps-accounting#450):
 * `AccountingEngine.CreateJournalEntry` writes a draft line's original currency, amount and rate to
 * the JournalEntryLine it creates, and `JournalEntryLineEntityServer.Validate` refuses a line whose
 * original amount × rate differs from its debit or credit by more than one cent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EntityInfo, Metadata, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { BusinessTimeZoneEngine, type InstanceConfigurationRow } from '@mj-biz-apps/common-entities';
import { AccountingEngineBase, type JournalEntryDraft, type PipelineLookups } from '@mj-biz-apps/accounting-engine-base';
import type { mjBizAppsAccountingJournalEntryTypeEntity } from '@mj-biz-apps/accounting-entities';
import { AccountingEngine } from '../AccountingEngine.js';
import { JournalEntryLineEntityServer } from '../JournalEntryLineEntityServer.js';

const USER = { ID: 'USER-1' } as UserInfo;
const COMPANY_ID = '11111111-0000-4000-8000-000000000001';
const GL_AR = 'aaaaaaaa-0000-4000-8000-000000000001';
const GL_REV = 'aaaaaaaa-0000-4000-8000-000000000002';
const GL_CASH = 'aaaaaaaa-0000-4000-8000-000000000003';
const MANUAL_TYPE_ID = 'e1000000-0000-4000-8000-000000000001';

/** The fields the engine writes to each line it creates. */
interface WrittenLine {
  GLAccountID?: string;
  DebitAmount?: number | null;
  CreditAmount?: number | null;
  Description?: string | null;
  OriginalCurrencyCode?: string | null;
  OriginalDebitAmount?: number | null;
  OriginalCreditAmount?: number | null;
  ExchangeRateUsed?: number | null;
  CreateDimension: () => Promise<object>;
}

describe('CreateJournalEntry writes original-currency fields to the lines', () => {
  const zoneEngine = BusinessTimeZoneEngine.Instance as unknown as { _configurations: InstanceConfigurationRow[]; _loaded: boolean };
  const saved = { rows: zoneEngine._configurations, loaded: zoneEngine._loaded };
  const lookups: PipelineLookups = {
    accountByID: (id) => ({ ID: id, CompanyID: COMPANY_ID, IsActive: true }),
    entryTypeByCode: () => ({ ID: MANUAL_TYPE_ID, Code: 'Manual', IsActive: true, IsJournalEntryBatchSummary: false }),
    dimensionExists: () => false,
    dimensionValueBelongs: () => false,
  };

  beforeEach(() => {
    zoneEngine._configurations = [
      { FeatureKey: 'BizApps.BusinessTimeZone', Value: '{"iana":"UTC","sql":"UTC"}', DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
    ];
    zoneEngine._loaded = true;
    const base = AccountingEngineBase.Instance;
    vi.spyOn(base, 'Config').mockResolvedValue(undefined);
    vi.spyOn(base, 'CreatePipelineLookups').mockReturnValue(lookups);
    vi.spyOn(base, 'JournalEntryTypeByCode').mockReturnValue({ ID: MANUAL_TYPE_ID } as mjBizAppsAccountingJournalEntryTypeEntity);
  });

  afterEach(() => {
    zoneEngine._configurations = saved.rows;
    zoneEngine._loaded = saved.loaded;
    vi.restoreAllMocks();
  });

  function capturingProvider(lines: WrittenLine[]): IMetadataProvider {
    const entry = {
      ID: 'je-1',
      EntryNumber: 'JE-0001',
      CompanyID: '',
      NewRecord: () => undefined,
      CreateLine: async () => {
        const line: WrittenLine = { CreateDimension: async () => ({}) };
        lines.push(line);
        return line;
      },
      Save: async () => true,
    };
    return { GetEntityObject: async () => entry } as unknown as IMetadataProvider;
  }

  it('maps each draft line, with or without an original currency, to the columns', async () => {
    const draft: JournalEntryDraft = {
      EffectiveDate: '2026-11-17',
      EntryType: 'Manual',
      Lines: [
        { GLAccountID: GL_AR, DebitAmount: 8751.65, OriginalCurrencyCode: 'AUD', OriginalDebitAmount: 13230, ExchangeRateUsed: 0.6615 },
        { GLAccountID: GL_REV, CreditAmount: 8751.65, OriginalCurrencyCode: 'AUD', OriginalCreditAmount: 13230, ExchangeRateUsed: 0.6615 },
        { GLAccountID: GL_CASH, DebitAmount: 5 },
        { GLAccountID: GL_REV, CreditAmount: 5 },
      ],
    };
    const lines: WrittenLine[] = [];
    const result = await AccountingEngine.Instance.CreateJournalEntry(draft, USER, capturingProvider(lines));
    expect(result.Errors ?? []).toEqual([]);
    const columns = lines.map(({ CreateDimension: _c, Description: _d, ...rest }) => rest);
    expect(columns).toEqual([
      { GLAccountID: GL_AR, DebitAmount: 8751.65, CreditAmount: null, OriginalCurrencyCode: 'AUD', OriginalDebitAmount: 13230, OriginalCreditAmount: null, ExchangeRateUsed: 0.6615 },
      { GLAccountID: GL_CASH, DebitAmount: 5, CreditAmount: null, OriginalCurrencyCode: null, OriginalDebitAmount: null, OriginalCreditAmount: null, ExchangeRateUsed: null },
      { GLAccountID: GL_REV, DebitAmount: null, CreditAmount: 8751.65, OriginalCurrencyCode: 'AUD', OriginalDebitAmount: null, OriginalCreditAmount: 13230, ExchangeRateUsed: 0.6615 },
      { GLAccountID: GL_REV, DebitAmount: null, CreditAmount: 5, OriginalCurrencyCode: null, OriginalDebitAmount: null, OriginalCreditAmount: null, ExchangeRateUsed: null },
    ]);
  });

  it('refuses a draft whose original amount × rate disagrees, and writes nothing', async () => {
    const draft: JournalEntryDraft = {
      EffectiveDate: '2026-11-17',
      EntryType: 'Manual',
      Lines: [
        { GLAccountID: GL_AR, DebitAmount: 100, OriginalCurrencyCode: 'EUR', OriginalDebitAmount: 5000, ExchangeRateUsed: 0.5 },
        { GLAccountID: GL_REV, CreditAmount: 100 },
      ],
    };
    const lines: WrittenLine[] = [];
    const result = await AccountingEngine.Instance.CreateJournalEntry(draft, USER, capturingProvider(lines));
    expect(result.Success).toBe(false);
    expect(result.Errors?.[0]).toMatchObject({ Code: 'ORIGINAL_AMOUNT_MISMATCH', LineIndex: 0 });
    expect(lines).toEqual([]);
  });
});

describe('JournalEntryLineEntityServer.Validate — original currency', () => {
  const FIELDS: Array<[string, string, string]> = [
    ['ID', 'uniqueidentifier', 'string'],
    ['JournalEntryID', 'uniqueidentifier', 'string'],
    ['LineNumber', 'int', 'number'],
    ['GLAccountID', 'uniqueidentifier', 'string'],
    ['DebitAmount', 'decimal', 'number'],
    ['CreditAmount', 'decimal', 'number'],
    ['OriginalCurrencyCode', 'nchar', 'string'],
    ['OriginalDebitAmount', 'decimal', 'number'],
    ['OriginalCreditAmount', 'decimal', 'number'],
    ['ExchangeRateUsed', 'decimal', 'number'],
    ['Description', 'nvarchar', 'string'],
  ];

  function lineEntityInfo(): EntityInfo {
    const info = Object.create(EntityInfo.prototype) as EntityInfo;
    Object.assign(info, { ID: 'id-jel', Name: 'MJ_BizApps_Accounting: Journal Entry Lines', Status: 'Active', AllowDirectSQL: true });
    const fields = FIELDS.map(([name, type, tsType]) => ({
      Name: name, CodeName: name, Type: type, TSType: tsType, IsPrimaryKey: name === 'ID',
      AutoIncrement: false, ReadOnly: false, AllowsNull: true, ValueIsPermittedByValueList: () => true,
    }));
    Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
    Object.defineProperty(info, 'PrimaryKeys', { get: () => fields.filter(f => f.IsPrimaryKey), configurable: true });
    Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
    return info;
  }

  let line: JournalEntryLineEntityServer;

  beforeEach(() => {
    const info = lineEntityInfo();
    Metadata.Provider = {
      Entities: [info],
      FindEntityByName: () => info,
      Config: { ActiveStatusAssertions: false },
    } as unknown as typeof Metadata.Provider;
    line = new JournalEntryLineEntityServer(info);
    line.NewRecord();
    line.GLAccountID = GL_AR;
    line.LineNumber = 1;
    line.DebitAmount = 66.15;
    line.OriginalCurrencyCode = 'AUD';
    line.OriginalDebitAmount = 100;
    line.ExchangeRateUsed = 0.6615;
  });

  const fxErrors = () => line.Validate().Errors.filter(e => e.Source === 'ExchangeRateUsed');

  it('accepts a line whose original amount × rate is its debit', () => {
    expect(fxErrors()).toEqual([]);
  });

  it('accepts a line one cent off', () => {
    line.DebitAmount = 66.16;
    expect(fxErrors()).toEqual([]);
  });

  it('refuses a line more than one cent off', () => {
    line.DebitAmount = 66.17;
    const errors = fxErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].Message).toMatch(/^Line 1: 100\.00 AUD at a rate of 0\.6615 is 66\.15/);
  });

  it('refuses the example from the issue: 5000 EUR at 0.5 against a debit of 100', () => {
    line.DebitAmount = 100;
    line.OriginalCurrencyCode = 'EUR';
    line.OriginalDebitAmount = 5000;
    line.ExchangeRateUsed = 0.5;
    expect(fxErrors()).toHaveLength(1);
  });

  it('leaves a functional-currency line alone', () => {
    line.OriginalCurrencyCode = null;
    line.OriginalDebitAmount = null;
    line.ExchangeRateUsed = null;
    expect(fxErrors()).toEqual([]);
  });
});
