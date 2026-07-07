/**
 * Server-side subclass of AccountingCompanyProfile.
 *
 * On first save (new record), runs the per-Company initialization that used
 * to live in `spInitializeAccountingCompanyProfile`:
 *   1. Seed the default chart of accounts (10 GLAccount rows; minimal AR-subledger set — see SeedData.ts)
 *   2. Wire the profile's default-account refs (AR, DefRev, SalesTax, FX)
 * (Period generation was RETIRED 2026-07-06 — AccountingPeriod removed; the ERP owns periods. CH-1.)
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
 *
 * CONNECTS TO:
 *   ENTITY:   'MJ_BizApps_Accounting: Accounting Company Profiles' (IS-A child of __mj.Company)
 *   SEEDS:    GL Accounts (SeedData.DEFAULT_CHART_OF_ACCOUNTS) · wires 5 default GL refs
 *   WRITES:   __mj.RecordChange (audit-by-construction — every seeded row via BaseEntity.Save)
 *   SIBLINGS: JournalEntryEntityServer (W2 numbering) · JournalEntryBatchEntityServer (W3) · SequenceService
 *   DOC:      docs/ARCHITECTURE.md#company-profile-init
 */

import { BaseEntity, EntitySaveOptions, LogError, Metadata, RunView } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingGLAccountEntity,
} from '@mj-biz-apps/accounting-entities';

import {
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_GL_ACCOUNT_REFS,
  SeededGLAccount,
} from './SeedData.js';

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Accounting Company Profiles')
export class AccountingCompanyProfileEntityServer extends mjBizAppsAccountingAccountingCompanyProfileEntity {

  override async Save(options?: EntitySaveOptions): Promise<boolean> {
    const isNewRecord = !this.IsSaved;

    // Block 0 / AD-16: default OperatingTimeZone to UTC for a new profile when the
    // caller didn't supply one. All storage is Zulu; period & rev-rec boundaries are
    // evaluated in this zone. Set before the first persist so __mj.RecordChange
    // captures it (audit-by-construction).
    if (isNewRecord && !this.OperatingTimeZone) {
      this.OperatingTimeZone = 'UTC';
    }

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
    try {
      await this.seedDefaultChartOfAccounts();
      await this.wireDefaultGLAccountRefs();
    } catch (error: unknown) {
      LogError(
        `AccountingCompanyProfileEntityServer.initializeProfile failed for CompanyID=${this.ID}: ${error}`,
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
    account.CompanyID = companyId;
    account.Code = seed.code;
    account.Name = seed.name;
    account.AccountType = seed.accountType;
    account.CurrencyCode = currencyCode;
    account.IsSystemSeeded = true;
    account.IsActive = true;

    const saved = await account.Save();
    if (!saved) {
      LogError(
        `AccountingCompanyProfileEntityServer: failed to seed GLAccount ${seed.code} for CompanyID=${companyId}`,
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

}
