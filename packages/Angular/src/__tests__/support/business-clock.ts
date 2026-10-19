/**
 * Shared clock for specs that assert a business-day default: pins the BUSINESS zone, the MACHINE
 * zone and the instant together, and restores all three after each test.
 *
 * The machine zone matters as much as the business zone. A regression to browser-local getters
 * (`getFullYear()/getMonth()/getDate()`) answers the business day correctly on a laptop that
 * happens to sit in the business zone, so a spec that leaves `TZ` alone passes there and fails
 * only on CI. Pin a machine zone that disagrees with the business zone at `Instant`.
 */
import { beforeEach, afterEach, expect, vi } from 'vitest';
import { UserInfo, type IMetadataProvider, type RunViewResult } from '@memberjunction/core';
import { BusinessTimeZoneEngine, type InstanceConfigurationRow } from '@mj-biz-apps/common-entities';

export interface BusinessClock {
  /** IANA zone the business runs on, as `BizApps.BusinessTimeZone` would name it. */
  BusinessZone: string;
  /** The same zone's SQL Server name (`AT TIME ZONE`), e.g. 'Central Standard Time'. */
  BusinessSqlZone: string;
  /** IANA zone the test process runs in, standing in for the operator's browser. */
  MachineZone: string;
  Instant: Date;
}

/**
 * The engine's loaded state, set directly so it answers `BusinessZone` with no IMetadataProvider.
 * These are private BaseEngine / BusinessTimeZoneEngine fields; this is the only place that names
 * them, and `useBusinessClock` asserts the public `Zone` afterwards so a rename fails here, with a
 * message that says so, rather than as a wrong date in the spec.
 */
interface EngineLoadedState {
  _configurations: InstanceConfigurationRow[];
  _loaded: boolean;
}

/** Registers beforeEach/afterEach hooks that hold `clock` for every test in the calling suite. */
export function useBusinessClock(clock: BusinessClock): void {
  const engine = BusinessTimeZoneEngine.Instance as unknown as EngineLoadedState;
  let saved: { rows: InstanceConfigurationRow[]; loaded: boolean; tz: string | undefined };

  beforeEach(() => {
    saved = { rows: engine._configurations, loaded: engine._loaded, tz: process.env.TZ };
    process.env.TZ = clock.MachineZone;
    engine._configurations = [
      {
        FeatureKey: 'BizApps.BusinessTimeZone',
        Value: JSON.stringify({ iana: clock.BusinessZone, sql: clock.BusinessSqlZone }),
        DefaultValue: '{"iana":"UTC","sql":"UTC"}',
      },
    ];
    engine._loaded = true;
    expect(
      BusinessTimeZoneEngine.Instance.Zone,
      'business-clock could not load BusinessTimeZoneEngine — have its private field names changed?',
    ).toBe(clock.BusinessZone);
    // Only Date is faked: Angular's zoneless scheduler and whenStable() still need real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(clock.Instant);
  });

  afterEach(() => {
    vi.useRealTimers();
    engine._configurations = saved.rows;
    engine._loaded = saved.loaded;
    // Restoring an UNSET TZ must delete it: assigning undefined stores the string "undefined",
    // which ICU reads as UTC.
    if (saved.tz === undefined) delete process.env.TZ;
    else process.env.TZ = saved.tz;
  });
}

/** A successful RunView result, for stubbing `RunView.prototype.RunView` / `RunViews`. */
export function viewResult<T>(results: T[], totalRowCount = results.length): RunViewResult<T> {
  return {
    Success: true,
    Results: results,
    RowCount: results.length,
    TotalRowCount: totalRowCount,
    ExecutionTime: 0,
    ErrorMessage: '',
  };
}

/**
 * 2026-09-01T03:30:00Z: 22:30 CDT on 31 August in Chicago, 1 September in UTC, and 12:30 on
 * 1 September in Tokyo. The business day is 31 August; a UTC reading (`toISOString()`) and a
 * browser-local reading in Tokyo both answer 1 September, so either regression fails.
 */
export const AUGUST_CLOSE_IN_CHICAGO: BusinessClock = {
  BusinessZone: 'America/Chicago',
  BusinessSqlZone: 'Central Standard Time',
  MachineZone: 'Asia/Tokyo',
  Instant: new Date('2026-09-01T03:30:00.000Z'),
};

/**
 * A provider for a component's `[Provider]` input when every read it makes is stubbed at
 * `RunView.prototype`. The component only dereferences `CurrentUser` to pass along to those stubs,
 * so that is all this carries; the cast is confined here rather than repeated in each spec.
 */
export function stubbedReadsProvider(): IMetadataProvider {
  const provider: Pick<IMetadataProvider, 'CurrentUser'> = { CurrentUser: new UserInfo() };
  return provider as IMetadataProvider;
}
