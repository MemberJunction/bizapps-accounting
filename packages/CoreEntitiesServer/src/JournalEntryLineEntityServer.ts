/**
 * Server-side subclass of JournalEntryLine — represents individual debit/credit lines
 * of a Journal Entry with dirty state, validation, and parent pointer support.
 */
import { BaseEntity, ValidationErrorInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingJournalEntryLineEntity } from '@mj-biz-apps/accounting-entities';

const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';

@RegisterClass(BaseEntity, JEL_ENTITY)
export class JournalEntryLineEntityServer extends mjBizAppsAccountingJournalEntryLineEntity {
  /** Optional reference to the parent JournalEntryEntityServer object in memory. */
  public ParentJournalEntry?: any;

  /** Convenience getter for line net amount (Debit minus Credit). */
  get NetAmount(): number {
    const dr = this.DebitAmount ?? 0;
    const cr = this.CreditAmount ?? 0;
    return dr - cr;
  }

  /** Validate line-level fields (either Debit XOR Credit set, non-negative values). */
  public override Validate() {
    const result = super.Validate();
    const dr = this.DebitAmount;
    const cr = this.CreditAmount;

    const hasDr = dr !== null && dr !== undefined && dr > 0;
    const hasCr = cr !== null && cr !== undefined && cr > 0;

    if (hasDr && hasCr) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryLineEntityServer.Validate',
          `Line ${this.LineNumber || ''}: Cannot specify both DebitAmount (${dr}) and CreditAmount (${cr}) on a single line.`,
          null,
        ),
      );
    }

    if (!hasDr && !hasCr && (dr === null || dr === undefined || dr === 0) && (cr === null || cr === undefined || cr === 0)) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryLineEntityServer.Validate',
          `Line ${this.LineNumber || ''}: Must specify either a DebitAmount or CreditAmount.`,
          null,
        ),
      );
    }

    if (dr !== null && dr !== undefined && dr < 0) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryLineEntityServer.Validate',
          `Line ${this.LineNumber || ''}: DebitAmount cannot be negative (${dr}).`,
          null,
        ),
      );
    }

    if (cr !== null && cr !== undefined && cr < 0) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryLineEntityServer.Validate',
          `Line ${this.LineNumber || ''}: CreditAmount cannot be negative (${cr}).`,
          null,
        ),
      );
    }

    if (!this.GLAccountID) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryLineEntityServer.Validate',
          `Line ${this.LineNumber || ''}: GLAccountID is required.`,
          null,
        ),
      );
    }

    return result;
  }
}
