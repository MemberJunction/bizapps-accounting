/**
 * Server-side subclass of AccountingCompanyProfile.
 *
 * On first save (new record), runs the per-Company initialization that used
 * to live in `spInitializeAccountingCompanyProfile`:
 *   1. Seed the default chart of accounts (23 GLAccount rows)
 *   2. Generate current-FY periods (12 months + 4 quarters + 1 year = 17 rows)
 *   3. Wire the profile's default-account refs (AR, DefRev, SalesTax, FX)
 *
 * Every row creation goes through `Metadata.GetEntityObject` + `.Save()`, so
 * `__mj.RecordChange` captures the audit trail for every seeded record.
 * This is the whole point of the refactor — the bulk INSERT approach in the
 * dropped sproc had no audit history.
 *
 * The method is idempotent: subsequent saves of the same profile do not
 * re-seed. Deployments can override the seed sets by registering a subclass
 * with higher priority that overrides `getChartOfAccountsToSeed()` or
 * `getPeriodsToGenerate()`.
 */

import { BaseEntity, EntitySaveOptions, LogError, Metadata, RunView } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingGLAccountEntity,
  mjBizAppsAccountingAccountingPeriodEntity,
} from '@mj-biz-apps/accounting-entities';

import {
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_GL_ACCOUNT_REFS,
  SeededGLAccount,
} from './SeedData.js';

interface PeriodToGenerate {
  periodType: 'Month' | 'Quarter' | 'Year';
  periodStart: Date;
  periodEnd: Date;
  fiscalYear: number;
  fiscalQuarter?: number;
  fiscalMonth?: number;
}

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Accounting Company Profiles')
export class AccountingCompanyProfileEntityServer extends mjBizAppsAccountingAccountingCompanyProfileEntity {

  override async Save(options?: EntitySaveOptions): Promise<boolean> {
    const isNewRecord = !this.IsSaved;

    const saved = await super.Save(options);
    if (!saved) {
      return false;
    }

    if (isNewRecord) {
      await this.initializeProfile();
    }

    return true;
  }

  /**
   * One-call initialization that used to be `spInitializeAccountingCompanyProfile`.
   * Each step is idempotent so a failed init can be re-run.
   */
  private async initializeProfile(): Promise<void> {
    const fiscalYear = this.getCurrentFiscalYear();

    try {
      await this.seedDefaultChartOfAccounts();
      await this.generateAccountingPeriods(fiscalYear);
      await this.wireDefaultGLAccountRefs();
    } catch (error: unknown) {
      LogError(
        `AccountingCompanyProfileEntityServer.initializeProfile failed for CompanyID=${this.Get('ID')}: ${error}`,
      );
      throw error;
    }
  }

  // ─── Seed COA ─────────────────────────────────────────────────────────

  /** Override point: deployments can replace with a custom COA. */
  protected getChartOfAccountsToSeed(): ReadonlyArray<SeededGLAccount> {
    return DEFAULT_CHART_OF_ACCOUNTS;
  }

  private async seedDefaultChartOfAccounts(): Promise<void> {
    const companyId = this.ID;
    const currencyCode = this.FunctionalCurrencyCode;
    const seeds = this.getChartOfAccountsToSeed();

    const existingCodes = await this.loadExistingGLAccountCodes(companyId);

    for (const seed of seeds) {
      if (existingCodes.has(seed.code)) continue;
      await this.createSeedGLAccount(companyId, currencyCode, seed);
    }
  }

  private async loadExistingGLAccountCodes(companyId: string): Promise<Set<string>> {
    const rv = new RunView();
    const result = await rv.RunView<mjBizAppsAccountingGLAccountEntity>(
      {
        EntityName: 'MJ_BizApps_Accounting: GL Accounts',
        ExtraFilter: `CompanyID = '${companyId}'`,
        ResultType: 'simple',
        Fields: ['Code'],
      },
      this.ContextCurrentUser,
    );
    if (!result.Success) {
      LogError(`Failed to load existing GLAccounts: ${result.ErrorMessage}`);
      return new Set();
    }
    return new Set((result.Results ?? []).map(r => (r as { Code: string }).Code));
  }

  private async createSeedGLAccount(
    companyId: string,
    currencyCode: string,
    seed: SeededGLAccount,
  ): Promise<void> {
    const md = new Metadata();
    const account = await md.GetEntityObject<mjBizAppsAccountingGLAccountEntity>(
      'MJ_BizApps_Accounting: GL Accounts',
      this.ContextCurrentUser,
    );
    account.NewRecord();
    account.Set('CompanyID', companyId);
    account.Set('Code', seed.code);
    account.Set('Name', seed.name);
    account.Set('AccountType', seed.accountType);
    account.Set('CurrencyCode', currencyCode);
    account.Set('IsSystemSeeded', true);
    account.Set('IsActive', true);

    const saved = await account.Save();
    if (!saved) {
      LogError(
        `AccountingCompanyProfileEntityServer: failed to seed GLAccount ${seed.code} for CompanyID=${companyId}`,
      );
    }
  }

  // ─── Generate periods ─────────────────────────────────────────────────

  /** Override point: deployments can replace with custom fiscal calendars (4-4-5, etc.). */
  protected getPeriodsToGenerate(fiscalYear: number): PeriodToGenerate[] {
    const startMonth = this.FiscalYearStartMonth ?? 1;
    const fyStartCalYear = startMonth === 1 ? fiscalYear : fiscalYear - 1;
    const fyStart = new Date(Date.UTC(fyStartCalYear, startMonth - 1, 1));

    const periods: PeriodToGenerate[] = [];

    // 12 monthly periods
    for (let i = 0; i < 12; i++) {
      const monthStart = addMonthsUtc(fyStart, i);
      const monthEnd = endOfMonthUtc(monthStart);
      periods.push({
        periodType: 'Month',
        periodStart: monthStart,
        periodEnd: monthEnd,
        fiscalYear,
        fiscalQuarter: Math.floor(i / 3) + 1,
        fiscalMonth: i + 1,
      });
    }

    // 4 quarterly periods
    for (let q = 0; q < 4; q++) {
      const qStart = addMonthsUtc(fyStart, q * 3);
      const qEnd = endOfMonthUtc(addMonthsUtc(qStart, 2));
      periods.push({
        periodType: 'Quarter',
        periodStart: qStart,
        periodEnd: qEnd,
        fiscalYear,
        fiscalQuarter: q + 1,
      });
    }

    // 1 yearly period
    periods.push({
      periodType: 'Year',
      periodStart: fyStart,
      periodEnd: endOfMonthUtc(addMonthsUtc(fyStart, 11)),
      fiscalYear,
    });

    return periods;
  }

  private async generateAccountingPeriods(fiscalYear: number): Promise<void> {
    const companyId = this.ID;
    const wanted = this.getPeriodsToGenerate(fiscalYear);
    const existing = await this.loadExistingPeriodKeys(companyId);

    for (const period of wanted) {
      const key = makePeriodKey(period.periodType, period.periodStart);
      if (existing.has(key)) continue;
      await this.createSeedAccountingPeriod(companyId, period);
    }
  }

  private async loadExistingPeriodKeys(companyId: string): Promise<Set<string>> {
    const rv = new RunView();
    const result = await rv.RunView<mjBizAppsAccountingAccountingPeriodEntity>(
      {
        EntityName: 'MJ_BizApps_Accounting: Accounting Periods',
        ExtraFilter: `CompanyID = '${companyId}'`,
        ResultType: 'simple',
        Fields: ['PeriodType', 'PeriodStart'],
      },
      this.ContextCurrentUser,
    );
    if (!result.Success) {
      LogError(`Failed to load existing AccountingPeriods: ${result.ErrorMessage}`);
      return new Set();
    }
    return new Set(
      (result.Results ?? []).map(r => {
        const row = r as { PeriodType: string; PeriodStart: string | Date };
        return makePeriodKey(row.PeriodType, new Date(row.PeriodStart));
      }),
    );
  }

  private async createSeedAccountingPeriod(
    companyId: string,
    period: PeriodToGenerate,
  ): Promise<void> {
    const md = new Metadata();
    const row = await md.GetEntityObject<mjBizAppsAccountingAccountingPeriodEntity>(
      'MJ_BizApps_Accounting: Accounting Periods',
      this.ContextCurrentUser,
    );
    row.NewRecord();
    row.Set('CompanyID', companyId);
    row.Set('PeriodType', period.periodType);
    row.Set('PeriodStart', period.periodStart);
    row.Set('PeriodEnd', period.periodEnd);
    row.Set('FiscalYear', period.fiscalYear);
    if (period.fiscalQuarter !== undefined) row.Set('FiscalQuarter', period.fiscalQuarter);
    if (period.fiscalMonth !== undefined) row.Set('FiscalMonth', period.fiscalMonth);
    row.Set('Status', 'Open');

    const saved = await row.Save();
    if (!saved) {
      LogError(
        `AccountingCompanyProfileEntityServer: failed to seed AccountingPeriod ${period.periodType} ${period.periodStart.toISOString()} for CompanyID=${companyId}`,
      );
    }
  }

  // ─── Wire default GL account refs ─────────────────────────────────────

  private async wireDefaultGLAccountRefs(): Promise<void> {
    const companyId = this.ID;
    const codeToId = await this.loadGLAccountIdsByCode(companyId);

    const refs: Array<{ field: string; code: string }> = [
      { field: 'AROpenGLAccountID',              code: DEFAULT_GL_ACCOUNT_REFS.AROpen },
      { field: 'DeferredRevenueGLAccountID',     code: DEFAULT_GL_ACCOUNT_REFS.DeferredRevenue },
      { field: 'SalesTaxPayableGLAccountID',     code: DEFAULT_GL_ACCOUNT_REFS.SalesTaxPayable },
      { field: 'RealizedFXGainLossGLAccountID',  code: DEFAULT_GL_ACCOUNT_REFS.RealizedFXGainLoss },
      { field: 'UnrealizedFXGainLossGLAccountID', code: DEFAULT_GL_ACCOUNT_REFS.UnrealizedFXGainLoss },
    ];

    let touched = false;
    for (const ref of refs) {
      if (this.Get(ref.field)) continue; // already set; respect deployment override
      const accountId = codeToId.get(ref.code);
      if (!accountId) continue;
      this.Set(ref.field, accountId);
      touched = true;
    }

    if (touched) {
      // Second Save() to persist the ref wiring. Record Changes will capture
      // exactly which ref fields moved from NULL → seeded UUIDs.
      const saved = await super.Save();
      if (!saved) {
        LogError(
          `AccountingCompanyProfileEntityServer: failed to persist default GL-account refs for CompanyID=${companyId}`,
        );
      }
    }
  }

  private async loadGLAccountIdsByCode(companyId: string): Promise<Map<string, string>> {
    const rv = new RunView();
    const result = await rv.RunView<mjBizAppsAccountingGLAccountEntity>(
      {
        EntityName: 'MJ_BizApps_Accounting: GL Accounts',
        ExtraFilter: `CompanyID = '${companyId}'`,
        ResultType: 'simple',
        Fields: ['ID', 'Code'],
      },
      this.ContextCurrentUser,
    );
    if (!result.Success) {
      LogError(`Failed to load GLAccount IDs by code: ${result.ErrorMessage}`);
      return new Map();
    }
    const map = new Map<string, string>();
    for (const row of result.Results ?? []) {
      const r = row as { ID: string; Code: string };
      map.set(r.Code, r.ID);
    }
    return map;
  }

  // ─── Utilities ────────────────────────────────────────────────────────

  private getCurrentFiscalYear(): number {
    // Naive: calendar year of "now". If the FY starts in another month,
    // deployments that need calendar-year-shifted FY numbers can override
    // this method.
    return new Date().getUTCFullYear();
  }
}

// ─── Date helpers (UTC; pure functions; not exported) ───────────────────────

function addMonthsUtc(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

function endOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function makePeriodKey(periodType: string, periodStart: Date): string {
  return `${periodType}|${periodStart.toISOString().slice(0, 10)}`;
}
