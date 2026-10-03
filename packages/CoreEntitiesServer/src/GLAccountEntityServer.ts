/**
 * Server-side subclass of GLAccount — always-applies invariants for the chart of accounts.
 *
 * The rule that MUST hold on every save regardless of caller:
 *   **Identity fields are immutable from the moment the record is created** (Amith 2026-07-29 —
 *   immediate + unconditional; supersedes the earlier referenced-by-JE-lines gate). Why the
 *   stronger form: gating on references left a window where an unreferenced-by-JE-lines account
 *   could change CompanyID while GLAccountLink / IntercompanyAccountMatch rows pointed at it,
 *   silently re-aiming them (the probe-C hole). Freezing identity at creation kills the whole
 *   drift class at the root, and lets downstream tables derive company through the FK instead
 *   of denormalizing it.
 *   - CompanyID  — moving the account re-aims every reference to another company's books.
 *   - Code       — the account NUMBER is the ERP wire identity (dispatch resolution falls back
 *                  to it); editing it redefines what history meant and what dispatches send.
 *                  Remaps go through the mutable ExternalSystem/ExternalAccountID pair instead.
 *   - AccountType — flipping Asset→Expense etc. rewrites the semantics of every historical
 *                  trial balance built on this account.
 *   - CurrencyCode — same retroactive meaning-change class.
 *
 * Deliberately MUTABLE at any time: Name/Description (cosmetic), IsActive (normal lifecycle —
 * new-line gating is enforced by the JE/line servers), ExternalSystem/ExternalAccountID (the
 * sanctioned remap mechanism). Code format/uniqueness are DB CHECK/UQ constraints.
 *
 * For Business Central, ExternalAccountID is the BC account NUMBER the account posts under (the
 * remap), never BC's account id: BC's journal line takes the number, 20 characters at most
 * (bc-aidp-next-golive#282). Blank posts under the Code.
 * A mis-created account is corrected by deactivating it and creating a new one.
 */
import { BaseEntity, ValidationResult, ValidationErrorInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingGLAccountEntity } from '@mj-biz-apps/accounting-entities';

const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

/** BC's G/L account `No.` is Code[20]: the longest account number a BC journal line takes. */
export const BUSINESS_CENTRAL_ACCOUNT_NUMBER_MAX_LENGTH = 20;

/**
 * Why `externalAccountID` cannot be the Business Central account number `code` posts under, or null
 * when it can. The usual cause is BC's account id, a 36-character GUID, entered in its place.
 */
export function BusinessCentralAccountNumberError(code: string | null | undefined, externalAccountID: string | null | undefined): string | null {
  if (!externalAccountID || externalAccountID.length <= BUSINESS_CENTRAL_ACCOUNT_NUMBER_MAX_LENGTH) return null;
  return `GL account ${code ?? '(no code)'}: External Account ID '${externalAccountID}' is ${externalAccountID.length} characters; ` +
    `Business Central account numbers allow ${BUSINESS_CENTRAL_ACCOUNT_NUMBER_MAX_LENGTH}. For Business Central it is the BC account number ` +
    `the account posts under, not BC's account id. Enter the BC account number, or clear it to post under the Code.`;
}

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
  private static readonly LOCKED_IDENTITY_FIELDS: ReadonlyArray<string> = ['CompanyID', 'Code', 'AccountType', 'CurrencyCode'];

  /**
   * Identity lock — IMMEDIATE and UNCONDITIONAL (Amith 2026-07-29, supersedes the
   * referenced-by-JE-lines gate): the identity fields are frozen the moment the record is
   * created, NOT gated on JE-line references. This closes the whole drift class at the root —
   * an account that can never change company/code/type cannot silently re-aim its GLAccountLink
   * or IntercompanyAccountMatch references (the probe-C hole), so downstream tables need no
   * denormalized CompanyID. Pure in-memory OldValue check — no DB probe needed anymore.
   * Cosmetic fields (Name, Description, IsActive, ExternalSystem/ExternalAccountID) stay editable.
   */
  /** A Business Central account's External Account ID must be a BC account number (bc-aidp-next-golive#282). */
  public override Validate(): ValidationResult {
    const result = super.Validate();
    if (this.ExternalSystem === 'BusinessCentral') {
      const error = BusinessCentralAccountNumberError(this.Code, this.ExternalAccountID);
      if (error) {
        result.Success = false;
        result.Errors.push(new ValidationErrorInfo('ExternalAccountID', error, this.ExternalAccountID));
      }
    }
    return result;
  }

  public override async ValidateAsync(): Promise<ValidationResult> {
    const result = await super.ValidateAsync();

    if (this.IsSaved) {
      const changedLocked = GLAccountEntityServer.LOCKED_IDENTITY_FIELDS.filter(fieldName => {
        const field = this.GetFieldByName(fieldName);
        if (!field) return false;
        const oldValue = field.OldValue;
        const newValue = field.Value;
        if (oldValue === null || oldValue === undefined) return false;
        return String(oldValue).toLowerCase() !== String(newValue ?? '').toLowerCase();
      });

      if (changedLocked.length > 0) {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'GLAccountEntityServer.ValidateAsync',
            `GLAccount ${this.Code ?? this.ID}: ${changedLocked.join(', ')} cannot change — identity fields are immutable from creation (Amith 2026-07-29). Remap via ExternalSystem/ExternalAccountID; deactivate via IsActive; corrections are a new account.`,
            null,
          ),
        );
      }
    }

    return result;
  }
}
