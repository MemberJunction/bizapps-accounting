/**
 * Batch criteria date bounds — Cutoff and StartDate — as a remote caller sends them (golive #168).
 *
 * EffectiveDate is a DATE column, so every bound is a calendar day. The SHAPE of what the caller sent
 * decides which day: `YYYY-MM-DD` is that day; a date-time with an offset is the BUSINESS day it falls
 * on. These run the real `toOptions` → `pendingCandidateFilter` path through the preview operation's
 * server entry point and read the ExtraFilter it emits, so nothing between the wire and the SQL is
 * stubbed except the provider's reads.
 *
 * The instants are chosen where the shapes disagree. `2026-09-30T19:00:00-05:00` is 7 PM Central on
 * 30 September and EXACTLY `2026-10-01T00:00:00Z` — a `Date` built from it looks like a date input's
 * UTC midnight and was read as 1 October, a day late.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IMetadataProvider, RemoteOpServerContext, UserInfo } from '@memberjunction/core';
import { BusinessTimeZoneEngine, type InstanceConfigurationRow } from '@mj-biz-apps/common-entities';
import { PreviewJournalEntryBatchOperation, type PreviewJournalEntryBatchInput } from '../JournalEntryBatchOperations.js';
import { buildJournalEntryBatch } from '../JournalEntryBatchEngine.js';
import { requireDateBound } from '../BusinessDay.js';

const SUMMARY_TYPE_ID = 'e9521aa3-f4ef-4ec5-a899-d9dd59f320b7';
const COMPANY_ID = '11111111-0000-4000-8000-000000000001';
const USER = { ID: 'USER-1' } as UserInfo;

const engine = BusinessTimeZoneEngine.Instance as unknown as { _configurations: InstanceConfigurationRow[]; _loaded: boolean };
const saved = { rows: engine._configurations, loaded: engine._loaded };

beforeEach(() => {
  engine._configurations = [
    { FeatureKey: 'BizApps.BusinessTimeZone', Value: '{"iana":"America/Chicago","sql":"Central Standard Time"}', DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
  ];
  engine._loaded = true;
});

afterEach(() => {
  engine._configurations = saved.rows;
  engine._loaded = saved.loaded;
  vi.restoreAllMocks();
});

interface ViewRequest { EntityName: string; ExtraFilter?: string }

/**
 * Runs the preview operation and returns the candidate filter it built, or the error it returned.
 * The provider answers the summary-type lookup and records the Journal Entries filter; it returns
 * no candidates, so the preview has nothing further to read.
 */
async function preview(
  input: PreviewJournalEntryBatchInput,
  postingStartDates: Array<{ ID: string; PostingStartDate: string }> = [],
): Promise<{ filter: string | null; error: string | null }> {
  let filter: string | null = null;
  const RunView = async (req: ViewRequest) => {
    if (req.ExtraFilter?.includes('IsJournalEntryBatchSummary=1')) {
      return { Success: true, Results: [{ ID: SUMMARY_TYPE_ID, Code: 'JournalEntryBatchSummary' }] };
    }
    if (req.ExtraFilter === 'PostingStartDate IS NOT NULL') return { Success: true, Results: postingStartDates };
    if (req.EntityName === 'MJ_BizApps_Accounting: Journal Entries' && filter === null) filter = req.ExtraFilter ?? '';
    return { Success: true, Results: [] };
  };
  const provider = { RunView, RunViews: async (reqs: ViewRequest[]) => Promise.all(reqs.map(RunView)) } as unknown as IMetadataProvider;
  const context = { provider, user: USER } as unknown as RemoteOpServerContext;
  const result = await new PreviewJournalEntryBatchOperation().ExecuteServer(input, context);
  return { filter, error: result.Success ? null : (result.ErrorMessage ?? 'unknown') };
}

const dateClauses = (filter: string | null): string[] => (filter ?? '').split(' AND ').filter(c => c.startsWith('EffectiveDate'));

describe('Cutoff — the input shape decides day vs instant', () => {
  it('reads 7:00 PM Central on 30 September (exactly UTC midnight) as 30 September, not 1 October', async () => {
    const { filter } = await preview({ Cutoff: '2026-09-30T19:00:00-05:00' });
    expect(dateClauses(filter)).toEqual(["EffectiveDate < '2026-10-01'"]);
  });

  it('reads the same instant written in UTC the same way', async () => {
    const { filter } = await preview({ Cutoff: '2026-10-01T00:00:00Z' });
    expect(dateClauses(filter)).toEqual(["EffectiveDate < '2026-10-01'"]);
  });

  it('reads a plain day as that day, inclusive — no zone involved', async () => {
    const { filter } = await preview({ Cutoff: '2026-10-01' });
    expect(dateClauses(filter)).toEqual(["EffectiveDate < '2026-10-02'"]);
  });
});

describe('StartDate — resolved by the same rule as Cutoff', () => {
  it('a start and cutoff at the same evening instant select that business day, not an empty window', async () => {
    // 2026-10-01T02:30Z is 9:30 PM Central on 30 September. StartDate used to take the UTC day
    // (1 October) while Cutoff took the business day (30 September): `>= 10-01 AND < 10-01`.
    const { filter } = await preview({ StartDate: '2026-10-01T02:30:00Z', Cutoff: '2026-10-01T02:30:00Z' });
    expect(dateClauses(filter)).toEqual(["EffectiveDate >= '2026-09-30'", "EffectiveDate < '2026-10-01'"]);
  });

  it('reads a plain day as that day', async () => {
    const { filter } = await preview({ StartDate: '2026-09-01' });
    expect(dateClauses(filter)).toEqual(["EffectiveDate >= '2026-09-01'"]);
  });

  it('compares a company PostingStartDate with the business day of a date-time StartDate, not its UTC day', async () => {
    // 2026-10-01T02:30Z is 30 September in Chicago. The company's floor (1 October) is later, so its
    // clause must stay; read as its UTC day (1 October) the start would hide the floor, and that
    // company's 30 September entries would enter the batch.
    const { filter } = await preview({ StartDate: '2026-10-01T02:30:00Z' }, [{ ID: COMPANY_ID, PostingStartDate: '2026-10-01' }]);
    expect(dateClauses(filter)).toEqual(["EffectiveDate >= '2026-09-30'"]);
    expect(filter).toContain(`(CompanyID<>'${COMPANY_ID}' OR EffectiveDate >= '2026-10-01')`);
  });
});

describe('a malformed bound is refused at the boundary, with the field named', () => {
  it.each([
    ['Cutoff', 'garbage', /Batch criteria Cutoff: 'garbage' is not a calendar day \(YYYY-MM-DD\) or an ISO date-time with an offset/],
    ['Cutoff', '2026-02-30', /Batch criteria Cutoff: '2026-02-30' is not a real calendar day/],
    ['Cutoff', '2026-02-30T12:00:00Z', /Batch criteria Cutoff: '2026-02-30T12:00:00Z' is not a real calendar day/],
    ['Cutoff', '2026-09-30T19:00:00', /Batch criteria Cutoff: '2026-09-30T19:00:00' is not a calendar day .* with an offset/],
    ['StartDate', 'garbage', /Batch criteria StartDate: 'garbage' is not a calendar day/],
    ['StartDate', '2026-02-30', /Batch criteria StartDate: '2026-02-30' is not a real calendar day/],
  ])('%s = %s', async (field, value, message) => {
    const { filter, error } = await preview({ [field]: value });
    expect(error).toMatch(message);
    expect(filter, 'no query runs with a bound that was refused').toBeNull();
  });
});

describe('requireDateBound', () => {
  it('returns a valid value unchanged', () => {
    expect(requireDateBound('2026-09-30', 'X')).toBe('2026-09-30');
    expect(requireDateBound('2026-09-30T19:00:00.123-05:00', 'X')).toBe('2026-09-30T19:00:00.123-05:00');
    const d = new Date('2026-09-30T00:00:00Z');
    expect(requireDateBound(d, 'X')).toBe(d);
  });

  it('refuses an Invalid Date and a value that is neither a string nor a Date', () => {
    expect(() => requireDateBound(new Date('garbage'), 'X')).toThrow(/X: not a valid date/);
    expect(() => requireDateBound(20260930 as unknown as string, 'X')).toThrow(/X: '20260930' is not a calendar day/);
  });
});

describe('the batch PostingDate is today in the batch company\'s zone (parity with the cutoff)', () => {
  it('passes the company to the business-day lookup', async () => {
    const todayAsDate = vi.spyOn(BusinessTimeZoneEngine.Instance, 'TodayAsDate');
    const RunView = async (req: ViewRequest) => {
      if (req.ExtraFilter?.includes('IsJournalEntryBatchSummary=1')) return { Success: true, Results: [{ ID: SUMMARY_TYPE_ID }] };
      if (req.EntityName === 'MJ_BizApps_Accounting: Journal Entries') return { Success: true, Results: [{ ID: 'je-1' }] };
      if (req.EntityName === 'MJ_BizApps_Accounting: Journal Entry Lines') {
        return {
          Success: true,
          Results: [
            { ID: 'l-1', GLAccountID: 'aaaaaaaa-0000-4000-8000-000000000001', DebitAmount: 100, CreditAmount: null },
            { ID: 'l-2', GLAccountID: 'aaaaaaaa-0000-4000-8000-000000000002', DebitAmount: null, CreditAmount: 100 },
          ],
        };
      }
      return { Success: true, Results: [] };
    };
    // The header is the first write; stop there — the posting date is chosen just before it.
    const provider = {
      RunView,
      BeginTransaction: async () => undefined,
      RollbackTransaction: async () => undefined,
      GetEntityObject: async () => { throw new Error('stop: header write reached'); },
    } as unknown as IMetadataProvider;

    await expect(buildJournalEntryBatch(COMPANY_ID, 'BusinessCentral', USER.ID, USER, provider)).rejects.toThrow(/stop: header write reached/);
    expect(todayAsDate).toHaveBeenCalledWith(COMPANY_ID);
  });
});
