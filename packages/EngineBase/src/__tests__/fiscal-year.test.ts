/**
 * The shared fiscal-year rule (journal-entry numbering and the waterfall's year-to-date figure).
 *
 * CONNECTS TO:
 *   TESTS: ../fiscal-year.ts, AccountingEngineBase.FiscalYearStartFor
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import { AccountingEngineBase } from '../AccountingEngineBase.js';
import { DEFAULT_FISCAL_YEAR_START, FiscalYearOf, IsInFiscalYearToDate } from '../fiscal-year.js';

const JULY_1 = { Month: 7, Day: 1 };
const APRIL_6 = { Month: 4, Day: 6 };

describe('FiscalYearOf', () => {
  it('is the calendar year for a 1 January start', () => {
    expect(FiscalYearOf('2026-01-01', DEFAULT_FISCAL_YEAR_START)).toBe(2026);
    expect(FiscalYearOf('2026-12-31', DEFAULT_FISCAL_YEAR_START)).toBe(2026);
  });

  it('labels a fiscal year by the calendar year it starts in', () => {
    expect(FiscalYearOf('2026-06-30', JULY_1)).toBe(2025);
    expect(FiscalYearOf('2026-07-01', JULY_1)).toBe(2026);
  });

  it('splits on the start day inside the start month', () => {
    expect(FiscalYearOf('2026-04-05', APRIL_6)).toBe(2025);
    expect(FiscalYearOf('2026-04-06', APRIL_6)).toBe(2026);
  });

  it('refuses a value that is not a calendar day', () => {
    expect(() => FiscalYearOf('not-a-day', JULY_1)).toThrow(/YYYY-MM-DD/);
  });
});

describe('IsInFiscalYearToDate', () => {
  it('includes the fiscal-year start and today, and excludes the day before the start', () => {
    expect(IsInFiscalYearToDate('2025-07-01', '2026-01-31', JULY_1)).toBe(true);
    expect(IsInFiscalYearToDate('2026-01-31', '2026-01-31', JULY_1)).toBe(true);
    expect(IsInFiscalYearToDate('2025-06-30', '2026-01-31', JULY_1)).toBe(false);
  });

  it('excludes a day after today in the same fiscal year', () => {
    expect(IsInFiscalYearToDate('2026-02-01', '2026-01-31', JULY_1)).toBe(false);
  });
});

describe('AccountingEngineBase.FiscalYearStartFor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function useProfiles(profiles: Array<{ ID: string; FiscalYearStartMonth: number; FiscalYearStartDay: number }>): void {
    vi.spyOn(AccountingEngineBase.Instance, 'CompanyProfiles', 'get').mockReturnValue(
      profiles as unknown as mjBizAppsAccountingAccountingCompanyProfileEntity[],
    );
  }

  it("returns the profile's start, matching the company ID case-insensitively", () => {
    useProfiles([{ ID: 'ABC-123', FiscalYearStartMonth: 7, FiscalYearStartDay: 1 }]);
    expect(AccountingEngineBase.Instance.FiscalYearStartFor('abc-123')).toEqual(JULY_1);
  });

  it('falls back to 1 January for a company with no profile, or no company', () => {
    useProfiles([{ ID: 'abc-123', FiscalYearStartMonth: 7, FiscalYearStartDay: 1 }]);
    expect(AccountingEngineBase.Instance.FiscalYearStartFor('other')).toEqual(DEFAULT_FISCAL_YEAR_START);
    expect(AccountingEngineBase.Instance.FiscalYearStartFor(null)).toEqual(DEFAULT_FISCAL_YEAR_START);
  });
});
