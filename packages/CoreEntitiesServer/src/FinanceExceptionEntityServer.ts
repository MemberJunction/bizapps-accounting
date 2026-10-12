/**
 * Server-side subclass of FinanceException — the STATUS GUARD (golive #279).
 *
 * A finance exception is cleared by a reviewer who did not create the source record, holding
 * MJ.BizApps.Accounting.FinanceExceptions.Clear. Those checks live in
 * `Accounting.ClearFinanceException`; this class makes that operation the only way through:
 *
 *   - A new row is Open, with no review fields.
 *   - On a saved row, Status and the review fields (ReviewedByUserID / ReviewedAt / ReviewNote)
 *     change only inside a save made by `SaveFinanceExceptionClearance`, which the operation calls
 *     after its checks. Any other save that touches them is refused.
 *   - A sanctioned save moves Open to Reviewed or Corrected, nothing else.
 *   - A Reviewed or Corrected row is terminal: nothing on it changes.
 *   - No row is deleted: deleting an Open exception would unblock its month without a review.
 *
 * CK_FinanceException_Review is the database floor under the review-field rules.
 */
import { BaseEntity, EntityDeleteOptions, ValidationErrorInfo, ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingFinanceExceptionEntity } from '@mj-biz-apps/accounting-entities';

export const FINANCE_EXCEPTION_ENTITY = 'MJ_BizApps_Accounting: Finance Exceptions';

type FinanceExceptionStatus = mjBizAppsAccountingFinanceExceptionEntity['Status'];

const REVIEW_FIELDS = ['Status', 'ReviewedByUserID', 'ReviewedAt', 'ReviewNote'] as const;
const TERMINAL: ReadonlySet<FinanceExceptionStatus> = new Set<FinanceExceptionStatus>(['Reviewed', 'Corrected']);
const SOURCE = 'FinanceExceptionEntityServer.Validate';

/** Rows whose current save was made by the clear operation. Module-private on purpose. */
const sanctionedSaves = new WeakSet<FinanceExceptionEntityServer>();

@RegisterClass(BaseEntity, FINANCE_EXCEPTION_ENTITY)
export class FinanceExceptionEntityServer extends mjBizAppsAccountingFinanceExceptionEntity {
  public override Validate(): ValidationResult {
    const result = super.Validate();
    const refusal = this.IsSaved ? this.savedRowRefusal() : this.newRowRefusal();
    if (refusal) {
      result.Success = false;
      result.Errors.push(new ValidationErrorInfo(SOURCE, refusal, null));
    }
    return result;
  }

  public override async Delete(_options?: EntityDeleteOptions): Promise<boolean> {
    throw new Error(
      `Finance exception ${this.ID} cannot be deleted. Clear it through Accounting.ClearFinanceException as Reviewed or Corrected; deleting an Open exception would unblock its month without a review.`,
    );
  }

  private newRowRefusal(): string | null {
    if (this.Status !== 'Open') {
      return `A finance exception is raised Open; '${this.Status}' is reached only through Accounting.ClearFinanceException.`;
    }
    if (this.ReviewedByUserID || this.ReviewedAt || this.ReviewNote) {
      return 'A new finance exception carries no review; ReviewedByUserID, ReviewedAt and ReviewNote are written by Accounting.ClearFinanceException.';
    }
    return null;
  }

  private savedRowRefusal(): string | null {
    const storedStatus = this.storedStatus();
    if (TERMINAL.has(storedStatus) && this.Dirty) {
      return `Finance exception ${this.ID} is ${storedStatus}, which is terminal: it cannot be changed.`;
    }
    const reviewChanged = REVIEW_FIELDS.some(name => this.Fields.find(f => f.Name === name)?.Dirty);
    if (!reviewChanged) return null;
    if (!sanctionedSaves.has(this)) {
      return `The status and review of finance exception ${this.ID} change only through Accounting.ClearFinanceException.`;
    }
    if (storedStatus !== 'Open' || !TERMINAL.has(this.Status)) {
      return `Finance exception ${this.ID} can only move from Open to Reviewed or Corrected (was ${storedStatus}, now ${this.Status}).`;
    }
    return null;
  }

  /** The status as stored: OldValue when the field is being changed, the current value otherwise. */
  private storedStatus(): FinanceExceptionStatus {
    const field = this.Fields.find(f => f.Name === 'Status');
    return (field?.Dirty ? field.OldValue : this.Status) as FinanceExceptionStatus;
  }
}

/**
 * Saves a clearance the clear operation has already authorized. The only path by which a saved
 * finance exception's status or review fields may change. Not exported from the package index:
 * `Accounting.ClearFinanceException` is its one caller.
 */
export async function SaveFinanceExceptionClearance(entity: FinanceExceptionEntityServer): Promise<boolean> {
  sanctionedSaves.add(entity);
  try {
    return await entity.Save();
  } finally {
    sanctionedSaves.delete(entity);
  }
}

/** Anti-tree-shake loader (mirrors the other entity servers). */
export function LoadFinanceExceptionEntityServer(): void {
  // intentional no-op — importing this module registers the class
}
