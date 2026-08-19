import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import type { JEStatus } from '../shared/je-rules';

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

export function formatJournalDate(value: Date | string | null | undefined): string {
    if (value == null || value === '') {
        return '—';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
