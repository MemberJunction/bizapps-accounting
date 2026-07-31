/**
 * Server-side subclass of AccountingCompanyProfile.
 *
 * On first save (new record), runs the per-Company initialization that used
 * to live in `spInitializeAccountingCompanyProfile`:
 *   1. Seed the default chart of accounts (10 GLAccount rows; minimal AR-subledger set — see SeedData.ts)
 * (Period generation was RETIRED 2026-07-06 — AccountingPeriod removed; the ERP owns periods. CH-1.
 *  Default-account ref wiring RETIRED 2026-07-23 — the ACP default-account columns were dropped;
 *  the role-based GLAccountRole/GLAccountLink model replaces them, seeded with the port work.)
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

    // NO auto-seed on create (Marcelo ruling 2026-07-30, supersedes the W1 auto-hook): a new
    // company starts with an EMPTY chart. Rationale: GL accounts identity-lock immediately (L8),
    // so auto-seeding forced ten locked-identity accounts on every company. The seed remains an
    // EXPLICIT capability — call `SeedDefaultChartOfAccounts()` (idempotent, code-guarded) from
    // fixtures, demo seeds, or a future "seed standard chart" affordance. `isNewRecord` is kept
    // for the TZ default above.
    void isNewRecord;

    return true;
  }

  // ─── Seed COA (explicit capability — no longer an auto-hook) ───────────

  /** Override point: deployments can replace with a custom COA. */
  protected getChartOfAccountsToSeed(): ReadonlyArray<SeededGLAccount> {
    return DEFAULT_CHART_OF_ACCOUNTS;
  }

  /**
   * Seed the standard chart into THIS company — explicit, idempotent (existing codes are
   * skipped), audit-by-construction (every row via BaseEntity.Save). Was the W1 auto-hook until
   * 2026-07-30; now invoked deliberately by whoever wants the starter chart.
   */
  public async SeedDefaultChartOfAccounts(): Promise<void> {
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

}
