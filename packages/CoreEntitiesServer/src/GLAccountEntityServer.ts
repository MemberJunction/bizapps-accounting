/**
 * Server-side subclass of GLAccount — always-applies invariants for the chart of accounts.
 *
 * The rule that MUST hold on every save regardless of caller:
 *   **Identity fields are immutable once the account is referenced by journal-entry lines.**
 *   - CompanyID  — moving the account would retroactively break the single-company invariant
 *                  (plan D3) on posted entries; trigger 50019 only checks lines at INSERT.
 *   - Code       — the account NUMBER is the ERP wire identity (AM-4 dispatch resolution
 *                  falls back to it); editing it under posted entries redefines what history
 *                  meant and what future dispatches send. Remaps go through the mutable
 *                  ExternalSystem/ExternalAccountID pair instead.
 *   - AccountType — flipping Asset→Expense etc. rewrites the semantics of every historical
 *                  trial balance built on this account.
 *   - CurrencyCode — same retroactive meaning-change class.
 *
 * Deliberately MUTABLE at any time: Name/Description (cosmetic), IsActive (normal lifecycle —
 * new-line gating is enforced by the JE/line servers), ExternalSystem/ExternalAccountID (the
 * sanctioned remap mechanism). Code format/uniqueness are DB CHECK/UQ constraints.
 */
import { BaseEntity, IRunViewProvider, ValidationResult, ValidationErrorInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingGLAccountEntity } from '@mj-biz-apps/accounting-entities';

const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';

@RegisterClass(BaseEntity, GL_ENTITY)
export class GLAccountEntityServer extends mjBizAppsAccountingGLAccountEntity {

  /**
   * BaseEntity SKIPS ValidateAsync by default (DefaultSkipAsyncValidation = true) — opt in,
   * or the identity-lock below silently never runs on Save. (Proven by the live harness:
   * without this, a referenced account's Code change saved straight through.)
   */
  public override get DefaultSkipAsyncValidation(): boolean {
    return false;
  }

  /** The identity fields locked once JE lines reference this account. */
  private static readonly LOCKED_ONCE_REFERENCED: ReadonlyArray<string> = ['CompanyID', 'Code', 'AccountType', 'CurrencyCode'];

  /**
   * Cross-record invariant (needs a DB lookup): block identity-field changes once JE lines
   * reference this account. The probe is gated cheapest-first — it only runs when one of the
   * locked fields ACTUALLY changed (in-memory OldValue check; zero queries on normal edits),
   * and then it's a single TOP-1 index seek on the JEL.GLAccountID FK index.
   */
  public override async ValidateAsync(): Promise<ValidationResult> {
    const result = await super.ValidateAsync();

    if (this.IsSaved) {
      const changedLocked = GLAccountEntityServer.LOCKED_ONCE_REFERENCED.filter(fieldName => {
        const field = this.GetFieldByName(fieldName);
        if (!field) return false;
        const oldValue = field.OldValue;
        const newValue = field.Value;
        if (oldValue === null || oldValue === undefined) return false;
        return String(oldValue).toLowerCase() !== String(newValue ?? '').toLowerCase();
      });

      if (changedLocked.length > 0 && (await this.hasJournalEntryLineReferences())) {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'GLAccountEntityServer.ValidateAsync',
            `GLAccount ${this.Code ?? this.ID}: ${changedLocked.join(', ')} cannot change while journal-entry lines reference this account — identity fields are immutable once posted against (retroactive meaning-change). Remap via ExternalSystem/ExternalAccountID; deactivate via IsActive.`,
            null,
          ),
        );
      }
    }

    return result;
  }

  private async hasJournalEntryLineReferences(): Promise<boolean> {
    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<{ ID: string }>(
      { EntityName: JEL_ENTITY, ExtraFilter: `GLAccountID='${this.ID}'`, Fields: ['ID'], MaxRows: 1, ResultType: 'simple', BypassCache: true },
      this.ContextCurrentUser,
    );
    // Loud on failure (loads throw): silently answering "no references" would let the change through.
    if (!res.Success) {
      throw new Error(`GLAccountEntityServer: failed to check JE-line references for account ${this.ID}: ${res.ErrorMessage ?? 'unknown error'}`);
    }
    return (res.Results?.length ?? 0) > 0;
  }
}
