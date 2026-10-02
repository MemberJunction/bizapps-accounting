/**
 * Issue #266: GenerateReversal dates the reversal on the LATER of today's business day and the
 * original entry's EffectiveDate, compared as business dates, so a reversal never lands in a
 * period before the entry it reverses.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { UserInfo } from '@memberjunction/core';
import { BusinessTimeZoneEngine, type InstanceConfigurationRow } from '@mj-biz-apps/common-entities';
import { JournalEntryEntityServer } from '../JournalEntryEntityServer.js';

vi.mock('../JournalEntryTypes.js', () => ({
  LookupJournalEntryTypeByID: vi.fn(async () => null),
  RequireJournalEntryTypeID: vi.fn(async () => 'JET_REVERSAL'),
}));

interface CapturedReversal {
  ID: string;
  EffectiveDate?: Date;
  NewRecord: () => void;
  Save: () => Promise<boolean>;
}

/**
 * A saved, un-reversed source entry dated `effectiveDate`, with no lines to copy and a provider that
 * hands back a capturing reversal. GenerateReversal runs on the real prototype; the stubs stand in
 * only for the database.
 */
function arrange(effectiveDate: Date | string): { source: JournalEntryEntityServer; reversal: CapturedReversal } {
  const reversal: CapturedReversal = { ID: 'JE_REVERSAL', NewRecord: () => {}, Save: async () => true };
  const source = {
    IsSaved: true,
    ID: 'JE_SOURCE',
    CompanyID: 'CO_100',
    EntryNumber: 'JE-0001',
    EffectiveDate: effectiveDate,
    EntryTypeID: 'JET_ORDERBOOKING',
    ReversesJournalEntryID: null,
    ReversedByJournalEntryID: null,
    ContextCurrentUser: { ID: 'USER_1' },
    ProviderToUse: { GetEntityObject: async () => reversal },
    Lines: { Count: 1, Items: [] },
    BackReferenceReversal: async () => {},
  };
  return { source: source as unknown as JournalEntryEntityServer, reversal };
}

async function reverseAt(now: string, iana: string, sql: string, effectiveDate: Date | string): Promise<string | undefined> {
  engine._configurations = [
    { FeatureKey: 'BizApps.BusinessTimeZone', Value: JSON.stringify({ iana, sql }), DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
  ];
  engine._loaded = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  const { source, reversal } = arrange(effectiveDate);
  await JournalEntryEntityServer.prototype.GenerateReversal.call(source, 'test', { ID: 'USER_1' } as UserInfo);
  return reversal.EffectiveDate?.toISOString();
}

const engine = BusinessTimeZoneEngine.Instance as unknown as { _configurations: InstanceConfigurationRow[]; _loaded: boolean };

describe('GenerateReversal — EffectiveDate is never before the original entry (issue #266)', () => {
  const original = { rows: engine._configurations, loaded: engine._loaded };

  afterEach(() => {
    engine._configurations = original.rows;
    engine._loaded = original.loaded;
    vi.useRealTimers();
  });

  it('dates the reversal of a future-dated entry on the original entry\'s date', async () => {
    const date = await reverseAt('2026-09-15T15:00:00.000Z', 'America/Chicago', 'Central Standard Time', new Date('2026-10-01T00:00:00.000Z'));
    expect(date).toBe('2026-10-01T00:00:00.000Z');
  });

  it('dates the reversal of a past-dated entry today', async () => {
    const date = await reverseAt('2026-09-15T15:00:00.000Z', 'America/Chicago', 'Central Standard Time', new Date('2026-08-20T00:00:00.000Z'));
    expect(date).toBe('2026-09-15T00:00:00.000Z');
  });

  it('dates the reversal of a same-day entry today', async () => {
    const date = await reverseAt('2026-09-15T15:00:00.000Z', 'America/Chicago', 'Central Standard Time', new Date('2026-09-15T00:00:00.000Z'));
    expect(date).toBe('2026-09-15T00:00:00.000Z');
  });

  it('compares in the business zone: an entry dated 1 September is future-dated at 9 PM on 31 August in Chicago', async () => {
    // 2026-09-01T02:00:00Z is already 1 September in UTC but 31 August, 9 PM, in Chicago (CDT, UTC-5).
    const date = await reverseAt('2026-09-01T02:00:00.000Z', 'America/Chicago', 'Central Standard Time', new Date('2026-09-01T00:00:00.000Z'));
    expect(date).toBe('2026-09-01T00:00:00.000Z');
  });

  it('compares in the business zone: an entry dated 30 September is past at 01:30 on 1 October in Berlin', async () => {
    // 2026-09-30T23:30:00Z is still 30 September in UTC but 1 October, 01:30, in Berlin (CEST, UTC+2).
    const date = await reverseAt('2026-09-30T23:30:00.000Z', 'Europe/Berlin', 'W. Europe Standard Time', new Date('2026-09-30T00:00:00.000Z'));
    expect(date).toBe('2026-10-01T00:00:00.000Z');
  });

  it('reduces an original dated as an ISO string to its calendar day', async () => {
    const date = await reverseAt('2026-09-15T15:00:00.000Z', 'America/Chicago', 'Central Standard Time', '2026-10-01T00:00:00');
    expect(date).toBe('2026-10-01T00:00:00.000Z');
  });
});
