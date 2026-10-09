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

import { BaseEntity, IRunViewProvider, LogError, Metadata, RunView, ValidationErrorInfo, ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingGLAccountEntity,
} from '@mj-biz-apps/accounting-entities';
import { UsesParentBooks } from '@mj-biz-apps/accounting-engine-base';
import { ParentBooksAccountOwnerError } from './GLAccountEntityServer.js';
import { sqlGuidLiteral } from './SqlGuards.js';

import {
  DEFAULT_CHART_OF_ACCOUNTS,
  SeededGLAccount,
} from './SeedData.js';

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Accounting Company Profiles')
export class AccountingCompanyProfileEntityServer extends mjBizAppsAccountingAccountingCompanyProfileEntity {

  // No Save override. Two first-save behaviors were retired:
  //  - COA auto-seed (2026-07-30, supersedes the W1 auto-hook): a new company starts with an
  //    EMPTY chart, because GL accounts identity-lock immediately (L8) and auto-seeding forced
  //    ten locked-identity accounts on every company. Seeding stays an EXPLICIT capability —
  //    call `SeedDefaultChartOfAccounts()` (idempotent, code-guarded).
  //  - OperatingTimeZone = 'UTC' default (#158): the field is a per-company display override,
  //    and blank means "inherit `BizApps.BusinessTimeZone`". Stamping 'UTC' made every new
  //    company override the business zone with UTC.

  /** BaseEntity SKIPS ValidateAsync by default — opt in, or the owner check below never runs on Save. */
  public override get DefaultSkipAsyncValidation(): boolean {
    return false;
  }

  /**
   * A company that owns active GL accounts cannot become a Division, Department or Branch
   * (bc-aidp-next-golive#313). Those types keep no books, so their entries resolve their legal
   * entity's accounts and an account the company owned would never be used, or would book entries
   * under a company with no ERP connection. `GLAccountEntityServer` refuses the same state on the
   * account side. Checked on create, because GL accounts reference __mj.Company and a company can
   * own accounts before its profile exists, and on update only when EntityType changes, so other
   * edits to such a profile still save.
   */
  public override async ValidateAsync(): Promise<ValidationResult> {
    const result = await super.ValidateAsync();
    if (UsesParentBooks(this.EntityType) && this.entityTypeNeedsOwnerCheck()) {
      const ownedCode = await this.firstActiveGLAccountCode();
      const error = ownedCode === null ? null : ParentBooksAccountOwnerError(ownedCode, this.ID, this.EntityType);
      if (error) {
        result.Success = false;
        result.Errors.push(new ValidationErrorInfo('EntityType', `${error} Deactivate its accounts first.`, this.EntityType));
      }
    }
    return result;
  }

  /** True for a new profile, or a saved one whose EntityType was edited. */
  private entityTypeNeedsOwnerCheck(): boolean {
    if (!this.IsSaved) return true;
    return this.GetFieldByName('EntityType')?.Dirty ?? false;
  }

  /**
   * The code of one active GL account this company owns, or null when it owns none. An inactive
   * account takes no new lines, so it does no harm on a company that keeps no books.
   */
  private async firstActiveGLAccountCode(): Promise<string | null> {
    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<Pick<mjBizAppsAccountingGLAccountEntity, 'Code'>>(
      {
        EntityName: 'MJ_BizApps_Accounting: GL Accounts',
        ExtraFilter: `CompanyID=${sqlGuidLiteral(this.ID, 'AccountingCompanyProfileEntityServer.firstActiveGLAccountCode')} AND IsActive=1`,
        Fields: ['Code'],
        MaxRows: 1,
        ResultType: 'simple',
        BypassCache: true,
      },
      this.ContextCurrentUser,
    );
    if (!res.Success) {
      throw new Error(`AccountingCompanyProfileEntityServer: failed to read company ${this.ID}'s GL accounts: ${res.ErrorMessage ?? 'unknown error'}`);
    }
    return res.Results?.[0]?.Code ?? null;
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
