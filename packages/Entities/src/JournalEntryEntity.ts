/**
 * ⚠️ NOT YET EXPORTED — see the commented line in `index.ts`.
 *
 * This class reads `this.Lines`, which CodeGen emits onto the generated
 * `mjBizAppsAccountingJournalEntryEntity` from the `RelatedRecordCollection` metadata in
 * `metadata/entity-relationships/`. That metadata has to be pushed and CodeGen re-run against a
 * rebuilt `bizapps_accounting` before the property exists and this file compiles. Committed ahead of
 * that so the design is reviewable; wired up in the same PR once the database cycle has run.
 */
/**
 * @fileoverview `JournalEntryEntity` — the double-entry rules, on BOTH tiers.
 *
 * WHY THIS LAYER EXISTS
 *
 * Every journal-entry rule lived in `JournalEntryEntityServer`, in a server-only package, alongside
 * a hand-rolled child collection (`_lines`, `_deletedLines`, `AddLine`, `RemoveLine`, `CreateLine`,
 * `LoadLines`). The browser could not model an entry at all, so the JE editor reached through an
 * Angular service layer to compose something it had no type for — and learned an entry was
 * unbalanced only after a round trip.
 *
 * The rules now split by what they NEED rather than where they were written:
 *
 *   · Here — decidable from the entry and its lines alone. No database, no provider. Runs in the
 *     browser before a round trip, and again on the server, because the server subclass extends
 *     this one and `super.Validate()` still fires.
 *   · `JournalEntryEntityServer` — anything requiring the database: entry numbering, fiscal-year
 *     derivation, the reversal-type discriminator, GL account existence and company scoping.
 *
 * `ClassFactory` priority auto-increments by load order, so the server subclass wins server-side
 * with no configuration while the browser resolves to this one and keeps the `Lines` collection the
 * generated class declares.
 *
 * @module @mj-biz-apps/accounting-entities
 */
import { BaseEntity, ValidationErrorInfo, ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingJournalEntryEntity } from './generated/entity_subclasses';

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entries')
export class JournalEntryEntity extends mjBizAppsAccountingJournalEntryEntity {
    /**
     * Whether the line set is KNOWN, as opposed to merely empty.
     *
     * An empty collection means "no lines" only when there cannot be any on disk: an entry that was
     * never saved, or one whose collection was actually loaded. On a saved entry with an unloaded
     * collection, empty means "unknown" — and counting it as zero would reject a perfectly good
     * entry whose lines are sitting in the table.
     *
     * `IsLoaded` alone is not the test, because `Add()` does not mark a collection loaded: an entry
     * composed in the browser has lines and `IsLoaded === false`.
     */
    protected get LinesAreKnown(): boolean {
        return !this.IsSaved || this.Lines.IsLoaded || this.Lines.Count > 0;
    }

    /**
     * The double-entry invariants, over the complete line set, before anything is written.
     *
     * `super.Validate()` fans out to the `Lines` collection, so each line's own `Validate()` runs
     * here too and its failures arrive attributed by position (`Lines[3].DebitAmount`). That
     * replaces a hand-written per-line loop that existed only on the server.
     */
    public override Validate(): ValidationResult {
        const result = super.Validate();

        if (!this.LinesAreKnown) {
            return result; // the server subclass settles it against the database
        }

        const lines = this.Lines.Items;

        // A JE must have at least two lines — that is what double entry MEANS.
        if (lines.length < 2) {
            result.Success = false;
            result.Errors.push(
                new ValidationErrorInfo(
                    'Lines',
                    `A Journal Entry must have at least 2 line items (double-entry invariant). Found ${lines.length} line(s).`,
                    null,
                ),
            );
        }

        // EQUAL DEBITS AND CREDITS, COMPARED AT PENNY PRECISION.
        //
        // This was `totalDebits !== totalCredits` — exact float equality on accumulated sums — and
        // it rejected entries that balance perfectly. A four-line entry of
        //
        //     Dr AR 302.59  /  Cr Sales 233.51 + Cr Tax 25.30 + Cr Shipping 43.78
        //
        // sums on the credit side to 302.59000000000003 in IEEE-754, so the comparison failed while
        // the error message printed both sides as "302.59" — telling the caller two identical
        // numbers were unequal. It stayed latent while entries had two or three lines and friendly
        // amounts; the first four-line entry from bizapps-orders hit it.
        //
        // DebitAmount and CreditAmount are DECIMAL(18,2), so a penny IS the unit of account and
        // anything finer is an artefact of summing in binary floating point. Half a penny is
        // therefore the correct tolerance: tight enough that no real imbalance passes — the smallest
        // storable discrepancy is a whole penny, two hundred times the epsilon — and loose enough
        // that accumulation order cannot decide whether a balanced entry is accepted.
        const totalDebits = lines.reduce((sum, l) => sum + (l.DebitAmount ?? 0), 0);
        const totalCredits = lines.reduce((sum, l) => sum + (l.CreditAmount ?? 0), 0);
        if (Math.abs(totalDebits - totalCredits) >= 0.005) {
            result.Success = false;
            result.Errors.push(
                new ValidationErrorInfo(
                    'Lines',
                    `Unbalanced Journal Entry: total debits (${totalDebits.toFixed(2)}) must equal ` +
                        `total credits (${totalCredits.toFixed(2)}).`,
                    null,
                ),
            );
        }

        return result;
    }
}
