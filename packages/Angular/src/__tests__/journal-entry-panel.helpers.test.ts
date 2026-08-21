import { describe, it, expect } from 'vitest';
import {
  formatJournalDate,
  formatJournalMoney,
  journalLineTotals,
  journalStatusChipClass,
} from '../lib/custom/form-panels/journal-entry-panel.helpers';
import { isBalanced } from '../lib/custom/shared/je-rules';

describe('formatJournalMoney', () => {
  it('formats two decimal places', () => {
    expect(formatJournalMoney(12)).toBe('12.00');
    expect(formatJournalMoney(12.5)).toBe('12.50');
    expect(formatJournalMoney(1000.1)).toBe('1,000.10');
  });

  it('returns empty string for nullish amounts so blank Dr/Cr cells stay blank', () => {
    expect(formatJournalMoney(null)).toBe('');
    expect(formatJournalMoney(undefined)).toBe('');
  });
});

describe('journalLineTotals', () => {
  it('sums debit and credit independently', () => {
    expect(journalLineTotals([
      { DebitAmount: 100, CreditAmount: null },
      { DebitAmount: null, CreditAmount: 40 },
      { DebitAmount: 25.5, CreditAmount: null },
      { DebitAmount: null, CreditAmount: 85.5 },
    ])).toEqual({ Debits: 125.5, Credits: 125.5 });
  });

  it('treats an empty line set as zeros', () => {
    expect(journalLineTotals([])).toEqual({ Debits: 0, Credits: 0 });
  });
});

describe('journalStatusChipClass', () => {
  it('maps each generated Status value to a chip tone', () => {
    expect(journalStatusChipClass('GLPosted')).toContain('mja-je-chip--ok');
    expect(journalStatusChipClass('Batched')).toContain('mja-je-chip--info');
    expect(journalStatusChipClass('Pending')).toContain('mja-je-chip--warn');
  });

  it('falls back without throwing when Status is missing', () => {
    expect(journalStatusChipClass(null)).toBe('mja-je-chip');
  });
});

describe('formatJournalDate', () => {
  it('renders a readable date', () => {
    expect(formatJournalDate(new Date(2026, 7, 19))).toMatch(/2026/);
  });

  it('returns an em dash for empty values', () => {
    expect(formatJournalDate(null)).toBe('—');
    expect(formatJournalDate('')).toBe('—');
  });
});

describe('isBalanced with journalLineTotals', () => {
  it('agrees that matching Dr/Cr is balanced', () => {
    const totals = journalLineTotals([
      { DebitAmount: 10.001, CreditAmount: null },
      { DebitAmount: null, CreditAmount: 10 },
    ]);
    expect(isBalanced(totals.Debits, totals.Credits)).toBe(true);
  });

  it('detects unbalance when debits and credits differ', () => {
    const totals = journalLineTotals([
      { DebitAmount: 100, CreditAmount: null },
      { DebitAmount: null, CreditAmount: 80 },
    ]);
    expect(isBalanced(totals.Debits, totals.Credits)).toBe(false);
  });
});

