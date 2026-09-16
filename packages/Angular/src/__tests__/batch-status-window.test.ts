import { describe, it, expect, vi, afterEach } from 'vitest';
import { BusinessTimeZoneEngine, type InstanceConfigurationRow } from '@mj-biz-apps/common-entities';
import { resolveBatchStatusWindow } from '../lib/custom/JournalEntryBatchStatus/batch-status-window';

/**
 * Run `fn` with the machine's zone pinned. Restoring an UNSET `TZ` must `delete` it: assigning
 * `undefined` back stores the string "undefined", which ICU reads as UTC, so every later test in
 * this worker would quietly run in a zone nobody chose. Same technique as
 * `journal-entry-panel.helpers.test.ts`'s `AT`.
 */
const AT = (tz: string, fn: () => void) => {
  const original = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
};

describe('resolveBatchStatusWindow — Batch Status dashboard "Today/7 days/30 days" filter', () => {
  // The engine is a singleton; set its loaded state directly (as
  // `JournalEntryBatchEngine.test.ts`'s `todayBusiness` tests do) so it answers a chosen zone with
  // no IMetadataProvider at all, then restore it so the stub cannot leak into other tests sharing
  // this worker.
  const engine = BusinessTimeZoneEngine.Instance as unknown as { _configurations: InstanceConfigurationRow[]; _loaded: boolean };
  const original = { rows: engine._configurations, loaded: engine._loaded };

  afterEach(() => {
    engine._configurations = original.rows;
    engine._loaded = original.loaded;
    vi.useRealTimers();
  });

  it('anchors "today" on the BUSINESS zone (Chicago), not the browser zone (New York), at an instant they disagree on', () => {
    // 2026-09-01T04:30:00.000Z is 00:30 EDT on 1 September in New York (the pinned `TZ` below,
    // standing in for the browser) but still 23:30 CDT on 31 August in Chicago (the business
    // zone). `ApplyWindow`'s old body read `new Date().getDate()/.getMonth()/.getFullYear()` —
    // pure browser-local getters — so it would have answered '2026-09-01' here. Anchoring on
    // `BusinessTimeZoneEngine.Instance.Today()` must answer '2026-08-31' instead.
    engine._configurations = [
      { FeatureKey: 'BizApps.BusinessTimeZone', Value: '{"iana":"America/Chicago","sql":"Central Standard Time"}', DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
    ];
    engine._loaded = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T04:30:00.000Z'));

    AT('America/New_York', () => {
      expect(resolveBatchStatusWindow('today')).toEqual({ FromDate: '2026-08-31', ToDate: '2026-08-31' });
    });
  });

  it('"7 days" spans the business day back 6 days (inclusive), across a month boundary', () => {
    // Business day 2026-09-03 (Chicago) minus 6 days is 2026-08-28 — crosses the Aug/Sep
    // boundary, so this also proves the arithmetic is real calendar-day math (AddDays), not a
    // fixed-width 7*86400000ms subtraction that would agree here but not near a DST transition.
    engine._configurations = [
      { FeatureKey: 'BizApps.BusinessTimeZone', Value: '{"iana":"America/Chicago","sql":"Central Standard Time"}', DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
    ];
    engine._loaded = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-03T15:00:00.000Z')); // 10:00 CDT on 3 September — unambiguous

    expect(resolveBatchStatusWindow('7d')).toEqual({ FromDate: '2026-08-28', ToDate: '2026-09-03' });
  });

  it('"30 days" spans the business day back 29 days (inclusive)', () => {
    engine._configurations = [
      { FeatureKey: 'BizApps.BusinessTimeZone', Value: '{"iana":"America/Chicago","sql":"Central Standard Time"}', DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
    ];
    engine._loaded = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-03T15:00:00.000Z'));

    expect(resolveBatchStatusWindow('30d')).toEqual({ FromDate: '2026-08-05', ToDate: '2026-09-03' });
  });
});
