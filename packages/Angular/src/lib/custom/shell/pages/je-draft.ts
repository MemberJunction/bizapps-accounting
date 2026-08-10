import type { CreateJournalEntryInput, JournalEntryLineDraft } from '@mj-biz-apps/accounting-engine-base';
import type { JournalEntryEntity, JournalEntryLineEntity } from '@mj-biz-apps/accounting-entities';

/**
 * What the JE workspace holds per tab, and the few rules that are genuinely the SCREEN's (§8.1).
 *
 * WHAT THIS USED TO BE. A `JEDraftState` with a `JEDraftLine[]` — a hand-maintained mirror of the
 * journal entry and its lines, carrying its own copy of the money math, the one-side-only rule and
 * the balance check, all of which the server also enforced in different words. Two statements of one
 * rule drift, and these had: the server's messages named `DebitAmount`, the screen's named "the debit
 * column", and only one of them was updated when the rule changed.
 *
 * WHAT IT IS NOW. The entry IS a `JournalEntryEntity` with a real `Lines` collection, so the screen
 * and the ledger run the SAME `Validate()` — at least two lines, debits equal credits at penny
 * precision, and per line: an account, exactly one side, neither side negative. None of that lives
 * here any more.
 *
 * WHAT REMAINS HERE IS ACTUALLY UI STATE, and it is here for a reason rather than by inertia:
 *
 *   · `Amounts` — the raw TEXT of each money box. `DebitAmount` is a number; a half-typed "8." is
 *     not one, and binding the entity directly would erase the decimal point the moment change
 *     detection ran. The text is the buffer, the entity is the value, and they meet at `SetAmount`.
 *   · `Dimensions` — the per-line analytical tags. `JournalEntryLine` declares no `Dimensions`
 *     related collection (the SERVER subclass hand-rolls one), so there is nothing on the client
 *     entity to hold them. They travel in the contract instead.
 *
 * CONNECTS TO:
 *   ENTITY:   @mj-biz-apps/accounting-entities (JournalEntryEntity / JournalEntryLineEntity)
 *   CONTRACT: @mj-biz-apps/accounting-engine-base (CreateJournalEntryInput / JournalEntryLineDraft)
 */
export interface JEDraftState {
    /** The entry being composed. Its `Lines` collection is the line set — there is no second copy. */
    Entry: JournalEntryEntity;

    /**
     * Raw money text, keyed by line id.
     *
     * Keyed rather than held on the line because the line has nowhere to put it: the entity is the
     * VALUE, and this is what the operator has typed so far on the way to one.
     */
    Amounts: Map<string, JEAmountText>;

    /** DimensionID → DimensionValueID, per line id. Only pre-existing values (CH-12: never auto-create). */
    Dimensions: Map<string, Record<string, string | null>>;

    /** Set once submitted — the tab becomes a read-only record of the created entry. */
    CreatedEntryNumber?: string;
}

export interface JEAmountText {
    Debit: string;
    Credit: string;
}

export function newAmountText(): JEAmountText {
    return { Debit: '', Credit: '' };
}

/**
 * Parse a money box. Blank → 0 (an untouched side is not an error). Anything non-numeric → NaN,
 * which `TextIssue` reports rather than silently coercing to 0 — a typo must never book as zero.
 */
export function parseMoney(text: string): number {
    const t = (text ?? '').trim();
    if (t === '') return 0;
    return Number(t.replace(/,/g, ''));
}

/**
 * The one line-level complaint the ENTITY cannot make: the box does not hold a number.
 *
 * By the time a value reaches `DebitAmount` it is already a number — `NaN` at worst, which reads as
 * "no amount" rather than as the typo it is. So this is checked against the text, before the entity
 * ever sees it, and it is the only per-line rule left on this side of the wire.
 */
export function TextIssue(text: JEAmountText | undefined): string | null {
    if (!text) return null;
    const debit = parseMoney(text.Debit);
    const credit = parseMoney(text.Credit);
    if (!Number.isFinite(debit) || !Number.isFinite(credit)) return 'Amounts must be numbers.';
    return null;
}

/**
 * A posting date as `yyyy-mm-dd`, from the LOCAL parts.
 *
 * NOT `toISOString().slice(0, 10)`. A `Date` at local midnight serialises to the PREVIOUS day
 * anywhere west of Greenwich, so an entry posted on the 1st files into the previous month — and the
 * ledger balances either way, which is why nothing downstream would ever report it.
 */
function isoDate(value: Date | string | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The lines that carry something, in order. Untouched rows are dropped, never reported. */
export function LiveLines(entry: JournalEntryEntity): JournalEntryLineEntity[] {
    return (entry.Lines.Items as JournalEntryLineEntity[]).filter((l) => !l.IsEmpty);
}

/** Running totals for the balance strip, read off the entity rather than re-parsed. */
export function draftTotals(entry: JournalEntryEntity): { Debits: number; Credits: number } {
    let Debits = 0;
    let Credits = 0;
    for (const line of LiveLines(entry)) {
        Debits += line.DebitAmount ?? 0;
        Credits += line.CreditAmount ?? 0;
    }
    return { Debits, Credits };
}

/**
 * Map the composed entry onto the engine contract.
 *
 * This is the one place a shape is translated, and it goes ONE way: entity → operation input. That
 * is not the mirror this file used to hold — nothing reads back through it, so there is no second
 * definition of an entry to drift from the first.
 *
 * `Accounting.CreateJournalEntry` is still an operation rather than `entry.Save()` because it
 * validates against LIVE reference data — that the accounts exist and are active, that every
 * dimension value belongs to its dimension, that the entry type is real — and derives the entry's
 * company from its accounts. A browser has a cache of those, and a cache is not an authority.
 */
export function toCreateInput(state: JEDraftState): CreateJournalEntryInput {
    const Lines: JournalEntryLineDraft[] = LiveLines(state.Entry).map((l) => {
        const debit = l.DebitAmount ?? 0;
        const credit = l.CreditAmount ?? 0;
        const dimensions = Object.entries(state.Dimensions.get(l.ID) ?? {})
            .filter((entry): entry is [string, string] => !!entry[1])
            .map(([DimensionID, DimensionValueID]) => ({ DimensionID, DimensionValueID }));

        // The contract's optional Debit/CreditAmount means ABSENT, not zero — sending a zero would
        // read as a stated amount of nothing rather than as the side this line is not on.
        const line: JournalEntryLineDraft = { GLAccountID: l.GLAccountID as string };
        if (debit > 0) line.DebitAmount = debit;
        if (credit > 0) line.CreditAmount = credit;
        if ((l.Description ?? '').trim()) line.Description = (l.Description as string).trim();
        if (dimensions.length) line.Dimensions = dimensions;
        return line;
    });

    const input: CreateJournalEntryInput = {
        EffectiveDate: isoDate(state.Entry.EffectiveDate),
        // The workspace is the MANUAL-entry home (§8.1). A single literal into the generated union is
        // fine; what rule 2c forbids is restating the union itself.
        EntryType: 'Manual',
        Lines,
    };
    const description = (state.Entry.Description ?? '').trim();
    if (description) input.Description = description;
    return input;
}
