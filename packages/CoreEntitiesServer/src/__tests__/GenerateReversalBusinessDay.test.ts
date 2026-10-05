/**
 * Issue #230: GenerateReversal dates the reversal with today's BUSINESS day, not the server
 * clock. `EffectiveDate` is a DATE column; `new Date()` is an instant whose stored calendar day
 * follows the server process's zone, so near midnight a reversal landed on the wrong day.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { UserInfo } from '@memberjunction/core';
import { BusinessTimeZoneEngine, type InstanceConfigurationRow } from '@mj-biz-apps/common-entities';
import { JournalEntryEntityServer } from '../JournalEntryEntityServer.js';

vi.mock('../JournalEntryTypes.js', () => ({
  LookupJournalEntryTypeByID: vi.fn(async () => null),
  RequireJournalEntryTypeID: vi.fn(async () => 'JET_REVERSAL'),
}));

/** The fields GenerateReversal writes on the new entry, captured by the stub provider. */
interface CapturedReversal {
  ID: string;
  CompanyID?: string;
  EffectiveDate?: Date;
  EntryTypeID?: string;
  Status?: string;
  Description?: string;
  ReversesJournalEntryID?: string;
  NewRecord: () => void;
  Save: () => Promise<boolean>;
}

/**
 * A saved, un-reversed source entry with no lines to copy and a provider that hands back a capturing
 * reversal. GenerateReversal is invoked on the real prototype so the code under test is the
 * shipped method; the stubs stand in only for the database.
 */
function arrange(): { source: JournalEntryEntityServer; reversal: CapturedReversal } {
  const reversal: CapturedReversal = {
    ID: 'JE_REVERSAL',
    NewRecord: () => {},
    Save: async () => true,
  };
  const provider = { GetEntityObject: async () => reversal };
  const source = {
    IsSaved: true,
    ID: 'JE_SOURCE',
    CompanyID: 'CO_100',
    EntryNumber: 'JE-0001',
    // Earlier than any "today" below, so the business day alone decides the date (issue #266).
    EffectiveDate: new Date('2026-08-01T00:00:00.000Z'),
    EntryTypeID: 'JET_ORDERBOOKING',
    ReversesJournalEntryID: null,
    ReversedByJournalEntryID: null,
    ContextCurrentUser: { ID: 'USER_1' },
    ProviderToUse: provider,
    // Non-zero Count skips LoadLines; no Items means no lines to copy — the date is what is under test.
    Lines: { Count: 1, Items: [] },
    BackReferenceReversal: async () => {},
  };
  return { source: source as unknown as JournalEntryEntityServer, reversal };
}

describe('GenerateReversal — EffectiveDate is today in the BUSINESS zone (issue #230)', () => {
  // Same singleton stub as JournalEntryBatchEngine.test.ts: set the engine's loaded state so it
  // answers a chosen zone with no database, and restore it afterwards.
  const engine = BusinessTimeZoneEngine.Instance as unknown as { _configurations: InstanceConfigurationRow[]; _loaded: boolean };
  const original = { rows: engine._configurations, loaded: engine._loaded };

  afterEach(() => {
    engine._configurations = original.rows;
    engine._loaded = original.loaded;
    vi.useRealTimers();
  });

  /** Points the engine at `iana`/`sql` as the business zone, with no database. */
  function setZone(iana: string, sql: string): void {
    engine._configurations = [
      { FeatureKey: 'BizApps.BusinessTimeZone', Value: JSON.stringify({ iana, sql }), DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
    ];
    engine._loaded = true;
  }

  it('dates the reversal 31 August when UTC is already 1 September but Chicago is not', async () => {
    // 2026-09-01T02:00:00Z is 31 August, 9 PM, in Chicago (CDT, UTC-5).
    setZone('America/Chicago', 'Central Standard Time');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T02:00:00.000Z'));

    const { source, reversal } = arrange();
    const user = { ID: 'USER_1' } as UserInfo;
    await JournalEntryEntityServer.prototype.GenerateReversal.call(source, 'test', user);

    expect(reversal.EffectiveDate?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
    expect(reversal.ReversesJournalEntryID).toBe('JE_SOURCE');
    expect(reversal.Status).toBe('Pending');
  });

  it('dates the reversal 1 October when UTC is still 30 September but Berlin is not', async () => {
    // 2026-09-30T23:30:00Z is 1 October, 01:30, in Berlin (CEST, UTC+2).
    setZone('Europe/Berlin', 'W. Europe Standard Time');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T23:30:00.000Z'));

    const { source, reversal } = arrange();
    const user = { ID: 'USER_1' } as UserInfo;
    await JournalEntryEntityServer.prototype.GenerateReversal.call(source, 'test', user);

    expect(reversal.EffectiveDate?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});
