/**
 * Shared setup for DOM specs of pages that carry the dashboard filter bar.
 *
 * The real `CompanyScopeService` and `DashboardPeriodService` run; only what they read is stubbed:
 * the company profiles `AccountingEngineBase` would load, and the user settings `UserInfoEngine`
 * would hold. So a spec exercises the same scope and period rules the app does.
 */
import { vi } from 'vitest';
import { of } from 'rxjs';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';

/** The profile fields the scope and the fiscal basis read. */
export type TestCompany = Pick<
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  'ID' | 'Name' | 'CompanyCode' | 'FiscalYearStartMonth' | 'FiscalYearStartDay' | 'IsActive'
>;

export const ACME: TestCompany = {
  ID: 'C0000000-0000-0000-0000-00000000000A',
  Name: 'Acme Test Co',
  CompanyCode: 'ACME',
  FiscalYearStartMonth: 1,
  FiscalYearStartDay: 1,
  IsActive: true,
};

export const BIRCH: TestCompany = {
  ID: 'C0000000-0000-0000-0000-00000000000B',
  Name: 'Birch Test Co',
  CompanyCode: 'BIRCH',
  FiscalYearStartMonth: 1,
  FiscalYearStartDay: 1,
  IsActive: true,
};

/**
 * Stubs the engine and the settings store for one spec. Call in `beforeEach`; `restoreMocks` in the
 * DOM config undoes it. `settings` are the saved user settings by key.
 */
export function stubDashboardFilterSources(companies: readonly TestCompany[], settings: Record<string, string> = {}): void {
  const engine = AccountingEngineBase.Instance;
  type Profile = mjBizAppsAccountingAccountingCompanyProfileEntity;
  // Plain rows stand in for the entity objects: the scope and the fiscal basis read only these fields.
  const profiles = companies as unknown as Profile[];
  vi.spyOn(engine, 'Config').mockResolvedValue(undefined);
  vi.spyOn(engine, 'ObserveProperty').mockReturnValue(of(profiles));
  vi.spyOn(engine, 'Loaded', 'get').mockReturnValue(true);
  vi.spyOn(engine, 'IsPropertyPermissionConstrained').mockReturnValue(false);
  vi.spyOn(engine, 'CompanyProfiles', 'get').mockReturnValue(profiles);

  const users = UserInfoEngine.Instance;
  vi.spyOn(users, 'Config').mockResolvedValue(undefined);
  vi.spyOn(users, 'GetSetting').mockImplementation((key: string) => settings[key]);
  vi.spyOn(users, 'SetSettingDebounced').mockImplementation(() => undefined);
}
