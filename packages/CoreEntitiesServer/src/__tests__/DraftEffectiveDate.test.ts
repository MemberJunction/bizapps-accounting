/**
 * A journal entry draft's EffectiveDate is the business day the caller meant (#427).
 *
 * The engine used to store `new Date(draft.EffectiveDate)` in the DATE column, which keeps the
 * instant's UTC day: a draft dated 7:30 PM Central on 30 September was saved on 1 October. These run
 * `AccountingEngine.CreateJournalEntry` with the engine caches and the provider faked, and read the
 * EffectiveDate the entity is given.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { BusinessTimeZoneEngine, type InstanceConfigurationRow } from '@mj-biz-apps/common-entities';
import { AccountingEngineBase, type JournalEntryDraft, type PipelineLookups } from '@mj-biz-apps/accounting-engine-base';
import type { mjBizAppsAccountingJournalEntryTypeEntity } from '@mj-biz-apps/accounting-entities';
import { AccountingEngine } from '../AccountingEngine.js';
import { loadEffectiveDay } from '../BusinessDay.js';

const USER = { ID: 'USER-1' } as UserInfo;
const COMPANY_ID = '11111111-0000-4000-8000-000000000001';
const GL_AR = 'aaaaaaaa-0000-4000-8000-000000000001';
const GL_REV = 'aaaaaaaa-0000-4000-8000-000000000002';
const MANUAL_TYPE_ID = 'e1000000-0000-4000-8000-000000000001';

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
    { FeatureKey: 'BizApps.BusinessTimeZone', Value: '{"iana":"America/Chicago","sql":"Central Standard Time"}', DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
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

function draft(effectiveDate: string): JournalEntryDraft {
  return {
    EffectiveDate: effectiveDate,
    EntryType: 'Manual',
    Lines: [
      { GLAccountID: GL_AR, DebitAmount: 100 },
      { GLAccountID: GL_REV, CreditAmount: 100 },
    ],
  };
}

/** A provider whose one journal entry records the EffectiveDate it is given and saves. */
function capturingProvider(captured: { EffectiveDate?: Date }): IMetadataProvider {
  const line = { CreateDimension: async () => ({}) };
  const entry = {
    ID: 'je-1',
    EntryNumber: 'JE-0001',
    CompanyID: '',
    NewRecord: () => undefined,
    CreateLine: async () => line,
    Save: async () => true,
    set EffectiveDate(value: Date) { captured.EffectiveDate = value; },
  };
  return { GetEntityObject: async () => entry } as unknown as IMetadataProvider;
}

async function savedDay(effectiveDate: string): Promise<string | undefined> {
  const captured: { EffectiveDate?: Date } = {};
  const result = await AccountingEngine.Instance.CreateJournalEntry(draft(effectiveDate), USER, capturingProvider(captured));
  expect(result.Errors ?? []).toEqual([]);
  return captured.EffectiveDate?.toISOString();
}

describe('CreateJournalEntry stores the business day the draft names', () => {
  it('stores a YYYY-MM-DD day as that day', async () => {
    expect(await savedDay('2026-09-30')).toBe('2026-09-30T00:00:00.000Z');
  });

  it('stores 7:30 PM Central on 30 September as 30 September, not its UTC day', async () => {
    expect(await savedDay('2026-09-30T19:30:00-05:00')).toBe('2026-09-30T00:00:00.000Z');
  });

  it('stores 7:00 PM Central, which is exactly UTC midnight of 1 October, as 30 September', async () => {
    expect(await savedDay('2026-09-30T19:00:00-05:00')).toBe('2026-09-30T00:00:00.000Z');
  });

  it('stores a UTC-midnight Z string, how a calendar-day Date crosses JSON, as that day', async () => {
    expect(await savedDay('2026-09-30T00:00:00.000Z')).toBe('2026-09-30T00:00:00.000Z');
  });

  it('stores any other UTC instant on the business day it falls on', async () => {
    // 02:00 UTC on 1 October is 9 PM Central on 30 September.
    expect(await savedDay('2026-10-01T02:00:00Z')).toBe('2026-09-30T00:00:00.000Z');
  });
});

describe('CreateJournalEntry refuses an EffectiveDate that names no day', () => {
  async function errorsFor(effectiveDate: string) {
    const result = await AccountingEngine.Instance.CreateJournalEntry(draft(effectiveDate), USER, capturingProvider({}));
    expect(result.Success).toBe(false);
    return result.Errors ?? [];
  }

  it('refuses a date-time with no offset, which would parse in the server zone', async () => {
    const errors = await errorsFor('2026-09-30T19:30:00');
    expect(errors).toHaveLength(1);
    expect(errors[0].Code).toBe('MALFORMED_DRAFT');
    expect(errors[0].Message).toMatch(/^EffectiveDate: '2026-09-30T19:30:00' is not a calendar day/);
  });

  it('refuses a day that does not exist rather than rolling it over', async () => {
    const errors = await errorsFor('2026-02-30');
    expect(errors[0].Code).toBe('MALFORMED_DRAFT');
    expect(errors[0].Message).toMatch(/not a real calendar day/);
  });

  it('keeps the pipeline\'s own message for a value that does not parse', async () => {
    const errors = await errorsFor('not-a-date');
    expect(errors[0].Code).toBe('MALFORMED_DRAFT');
    expect(errors[0].Message).toMatch(/is not a valid date/);
  });
});

describe('loadEffectiveDay', () => {
  const provider = {} as IMetadataProvider;

  it('reads +00:00 midnight like Z midnight', async () => {
    expect(await loadEffectiveDay('2026-09-30T00:00:00+00:00', 'X', USER, provider)).toBe('2026-09-30');
  });

  it('reads a non-UTC midnight as an instant', async () => {
    // Midnight in UTC+02:00 is 22:00 UTC on 29 September, 5 PM Central.
    expect(await loadEffectiveDay('2026-09-30T00:00:00+02:00', 'X', USER, provider)).toBe('2026-09-29');
  });
});
