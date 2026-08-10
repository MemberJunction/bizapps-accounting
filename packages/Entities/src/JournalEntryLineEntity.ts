/**
 * @fileoverview `JournalEntryLineEntity` — the per-line debit/credit rules, on BOTH tiers.
 *
 * WHY THIS LAYER EXISTS
 *
 * These rules — an account is required, exactly one side carries an amount, neither side is
 * negative — need nothing but the line itself. They lived in `JournalEntryLineEntityServer`, in a
 * server-only package, so the browser could not run them; the JE workspace therefore carried a
 * hand-written `lineIssue()` saying the same things in different words, and the two were free to
 * drift. They did: the server's wording named `DebitAmount`, the screen's named "the debit column",
 * and only one of them was ever updated when the rule changed.
 *
 * `super.Validate()` on the parent entry fans out to the `Lines` collection, so these run as part of
 * the entry's own validation and arrive attributed by position — `Lines[3].DebitAmount` — which is
 * what lets the editor put an error on the offending ROW rather than in a list above the grid.
 *
 * WHAT DELIBERATELY STAYED ON THE SERVER SUBCLASS. Anything that reads reference data: whether the
 * GL account is active, whether it belongs to the entry's company, whether a dimension value belongs
 * to the dimension it tags. The browser has a cache of those, but a cache is not an authority, and a
 * rule enforced against a stale cache is worse than one enforced late.
 *
 * @module @mj-biz-apps/accounting-entities
 */
import { BaseEntity, ValidationErrorInfo, ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingJournalEntryLineEntity } from './generated/entity_subclasses';

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entry Lines')
export class JournalEntryLineEntity extends mjBizAppsAccountingJournalEntryLineEntity {
    /** How this line names itself in a message. Falls back to the id while the number is unassigned. */
    protected get Label(): string {
        return this.LineNumber ? `Line ${this.LineNumber}` : 'This line';
    }

    /**
     * True when the operator has not touched this row at all.
     *
     * An untouched row is not an error — the editor opens with two blank lines by design, and
     * reporting "pick an account" against a row nobody has typed in is noise that trains people to
     * ignore the error list. It is dropped at save rather than reported.
     */
    public get IsEmpty(): boolean {
        return (
            !this.GLAccountID &&
            !(this.DebitAmount ?? 0) &&
            !(this.CreditAmount ?? 0) &&
            !(this.Description ?? '').trim()
        );
    }

    public override Validate(): ValidationResult {
        // AN UNTOUCHED ROW REPORTS NOTHING — including whatever the generated base would say about
        // it. `super.Validate()` mirrors the table's CHECK constraints, one of which is "a line must
        // have a positive debit or a positive credit"; running it here would put that on the blank
        // row the editor always keeps at the bottom, which is the noise this whole rule exists to
        // avoid. A blank line that reaches a SAVE is caught by `JournalEntryEntityServer.Validate()`,
        // which names it by number.
        if (this.IsEmpty) {
            const quiet = new ValidationResult();
            quiet.Success = true;
            return quiet;
        }

        const result = super.Validate();

        const debit = this.DebitAmount ?? 0;
        const credit = this.CreditAmount ?? 0;

        const fail = (source: string, message: string, value: unknown) => {
            result.Success = false;
            result.Errors.push(new ValidationErrorInfo(source, message, value));
        };

        if (!this.GLAccountID) {
            fail('GLAccountID', `${this.Label} needs an account.`, null);
        }

        // ONE SIDE ONLY. A line carrying both is not a line that nets — it is two lines somebody
        // typed into one row, and the entry would still balance, so nothing downstream would notice.
        if (debit > 0 && credit > 0) {
            fail(
                'DebitAmount',
                `${this.Label} is either a debit or a credit, not both (${debit} / ${credit}).`,
                debit,
            );
        }

        if (debit === 0 && credit === 0) {
            fail('DebitAmount', `${this.Label} needs a debit or a credit amount.`, null);
        }

        // A NEGATIVE AMOUNT IS THE OTHER COLUMN. Accepting one would let an entry balance by two
        // wrongs — a negative debit against a smaller credit sums correctly and posts backwards.
        if (debit < 0) {
            fail('DebitAmount', `${this.Label} cannot have a negative debit — use the credit column instead.`, debit);
        }
        if (credit < 0) {
            fail('CreditAmount', `${this.Label} cannot have a negative credit — use the debit column instead.`, credit);
        }

        return result;
    }
}
