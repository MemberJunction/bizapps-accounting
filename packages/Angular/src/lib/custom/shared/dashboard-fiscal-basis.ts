import { NormalizeUUID } from '@memberjunction/global';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import { ResolveFiscalYearStart, type FiscalYearStart, type FiscalYearStartResolution } from '@mj-biz-apps/common-ng';

/** The profile fields the fiscal basis reads. */
export type FiscalProfile = Pick<
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  'ID' | 'FiscalYearStartMonth' | 'FiscalYearStartDay' | 'IsActive'
>;

/**
 * The fiscal year start the dashboards count quarters and years from, for the companies in view.
 *
 * With companies selected, their profiles decide; with none selected (all companies), every ACTIVE
 * profile does. The shared resolver then refuses to pick when they disagree and falls back to the
 * calendar year, saying so in the period tooltip, because one window cannot be right for two fiscal
 * years at once.
 *
 * Pure: the caller reads the profiles from `AccountingEngineBase`, so this is tested without one.
 */
export function ResolveScopeFiscalBasis(
  profiles: readonly FiscalProfile[],
  selectedCompanyIDs: readonly string[],
): FiscalYearStartResolution {
  const selected = new Set(selectedCompanyIDs.map((id) => NormalizeUUID(id)));
  const inView = selected.size
    ? profiles.filter((p) => selected.has(NormalizeUUID(p.ID)))
    : profiles.filter((p) => p.IsActive);
  const starts: FiscalYearStart[] = inView.map((p) => ({ Month: p.FiscalYearStartMonth, Day: p.FiscalYearStartDay }));
  return ResolveFiscalYearStart(starts);
}
