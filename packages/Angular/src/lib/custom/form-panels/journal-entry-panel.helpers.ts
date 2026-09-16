import { ToCalendarDay, FromCalendarDay } from '@mj-biz-apps/common-entities';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import type { JEStatus } from '../shared/je-rules';

const DATE_DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

export const JOURNAL_ENTRY_ENTITY = JE_ENTITY;
export const JOURNAL_ENTRY_LINE_ENTITY = JEL_ENTITY;
export const GL_ACCOUNT_ENTITY = GL_ENTITY;
export const JOURNAL_ENTRY_BATCH_ENTITY = BATCH_ENTITY;

const HEADER_COLLAPSED_KEY = 'mj.identityHeader.collapsed.journalEntry';

export const JOURNAL_ENTRY_HEADER_SETTING_KEY = HEADER_COLLAPSED_KEY;

export interface JournalLineTotals {
    Debits: number;
    Credits: number;
}

export interface JournalLineAmount {
    DebitAmount: number | null;
    CreditAmount: number | null;
}

/** Functional-currency amount for the hero / totals strip. Empty string when the cell is blank. */
export function formatJournalMoney(amount: number | null | undefined): string {
    if (amount == null) {
        return '';
    }
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function journalLineTotals(lines: readonly JournalLineAmount[]): JournalLineTotals {
    let debits = 0;
    let credits = 0;
    for (const line of lines) {
        debits += line.DebitAmount ?? 0;
        credits += line.CreditAmount ?? 0;
    }
    return { Debits: debits, Credits: credits };
}

export function journalStatusChipClass(status: JEStatus | null | undefined): string {
    switch (status) {
        case 'GLPosted':
            return 'mja-je-chip mja-je-chip--ok';
        case 'Batched':
            return 'mja-je-chip mja-je-chip--info';
        case 'Pending':
            return 'mja-je-chip mja-je-chip--warn';
        default:
            return 'mja-je-chip';
    }
}

/**
 * A `DATE` column's calendar day, formatted for display (`EffectiveDate`/`PostingDate`, never a
 * timestamp).
 *
 * Reads the value's UTC parts via `ToCalendarDay` rather than local parts, then re-anchors to UTC
 * midnight of that day before formatting. `timeZone: 'UTC'` is load-bearing: without it the
 * formatter would re-interpret `FromCalendarDay`'s UTC midnight in the viewer's zone, sliding the
 * day back by one anywhere west of Greenwich — the same bug this fixes, reintroduced one call later.
 * See `formatJournalTimestamp` for a true `DATETIMEOFFSET` field, which this must NOT be used for.
 *
 * `options` lets a caller pick a shorter/longer rendering (e.g. the batch hero cards drop the
 * year) without forking the UTC-anchoring logic — `timeZone` is always forced to `'UTC'` regardless
 * of what a caller passes, so a copy/pasted options object can never reintroduce the local-parts bug.
 */
export function formatJournalDate(
    value: Date | string | null | undefined,
    options: Intl.DateTimeFormatOptions = DATE_DISPLAY_OPTIONS,
): string {
    const day = ToCalendarDay(value);
    if (day === null) {
        return '—';
    }
    return FromCalendarDay(day).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

/**
 * A true timestamp (`DATETIMEOFFSET`), formatted in the VIEWER'S local time.
 *
 * Unlike a calendar day, a timestamp has no single "day" independent of a zone — the business zone
 * governs "today" and cutoffs only, never display (spec §3), so this stays on local parts. Used for
 * `GLPostedAt`; do not repoint a `DATE`-column field (like `EffectiveDate`) at this — use
 * `formatJournalDate` instead.
 */
export function formatJournalTimestamp(value: Date | string | null | undefined): string {
    if (value == null || value === '') {
        return '—';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }
    return date.toLocaleDateString('en-US', DATE_DISPLAY_OPTIONS);
}

/**
 * Load the entry's `Lines` collection and each line's `Dimensions`.
 * Uses the related-record graph — no parallel RunView.
 */
export async function ensureJournalEntryLines(
    record: mjBizAppsAccountingJournalEntryEntity,
    force = false,
): Promise<void> {
    if (!record.IsSaved) {
        return;
    }
    if (force) {
        await record.Lines.Load(true);
    } else {
        await record.LoadRelatedRecords('Lines');
    }
    await Promise.all(record.Lines.Items.map((line) => line.Dimensions.Load(force)));
}
