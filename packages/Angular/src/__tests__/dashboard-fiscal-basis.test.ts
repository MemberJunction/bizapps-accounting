// common-ng's entry point loads Angular libraries that link under the JIT compiler in a node run.
import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { ResolveScopeFiscalBasis, type FiscalProfile } from '../lib/custom/shared/dashboard-fiscal-basis';

/**
 * TIER 1 — which fiscal year the dashboards' quarters count from.
 *
 * The selected companies' profiles decide; with none selected (all companies) the active profiles
 * do. Disagreement falls back to the calendar year, because one window cannot be right for two
 * fiscal years at once.
 */
const JULY_CO: FiscalProfile = { ID: 'AAAAAAAA-0000-0000-0000-000000000001', FiscalYearStartMonth: 7, FiscalYearStartDay: 1, IsActive: true };
const APRIL_CO: FiscalProfile = { ID: 'AAAAAAAA-0000-0000-0000-000000000002', FiscalYearStartMonth: 4, FiscalYearStartDay: 6, IsActive: true };
const RETIRED_APRIL_CO: FiscalProfile = { ID: 'AAAAAAAA-0000-0000-0000-000000000003', FiscalYearStartMonth: 4, FiscalYearStartDay: 1, IsActive: false };

describe('ResolveScopeFiscalBasis', () => {
  it('uses the selected company, whatever the others say', () => {
    expect(ResolveScopeFiscalBasis([JULY_CO, APRIL_CO], [APRIL_CO.ID])).toEqual({ Start: { Month: 4, Day: 6 }, Basis: 'profile' });
  });

  it('matches selected IDs ignoring case', () => {
    expect(ResolveScopeFiscalBasis([JULY_CO], [JULY_CO.ID.toLowerCase()]).Basis).toBe('profile');
  });

  it('with no selection, reads only the active profiles', () => {
    expect(ResolveScopeFiscalBasis([JULY_CO, RETIRED_APRIL_CO], [])).toEqual({ Start: { Month: 7, Day: 1 }, Basis: 'profile' });
  });

  it('falls back to the calendar year when the companies in view disagree', () => {
    expect(ResolveScopeFiscalBasis([JULY_CO, APRIL_CO], [])).toEqual({ Start: { Month: 1, Day: 1 }, Basis: 'mixed' });
    expect(ResolveScopeFiscalBasis([JULY_CO, APRIL_CO], [JULY_CO.ID, APRIL_CO.ID]).Basis).toBe('mixed');
  });

  it('says no company sets a fiscal year when there is no profile in view', () => {
    expect(ResolveScopeFiscalBasis([], []).Basis).toBe('no-profiles');
    expect(ResolveScopeFiscalBasis([JULY_CO], ['BBBBBBBB-0000-0000-0000-000000000009']).Basis).toBe('no-profiles');
  });
});
