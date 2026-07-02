/**
 * Unit tests for F1's pure balance/two-line checks (Block 1). Isolated, no DB.
 *
 * CONNECTS TO:
 *   TESTS:  JournalEntryValidation.checkBalance
 *   LIVE:   the DB-backed validateJournalEntry + the balanced-on-lock trigger are exercised by
 *           test-harnesses/server/block1-runtime.ts (this file is pure-logic, no DB)
 *   DOC:    docs/ARCHITECTURE.md#je-lifecycle
 */
import { describe, it, expect } from 'vitest';
import { checkBalance } from '../JournalEntryValidation.js';

describe('checkBalance (F1 — pure balance + two-line-minimum)', () => {
  it('passes a balanced two-line entry', () => {
    expect(checkBalance([
      { DebitAmount: 100, CreditAmount: null },
      { DebitAmount: null, CreditAmount: 100 },
    ])).toEqual([]);
  });

  it('flags an unbalanced entry', () => {
    const errs = checkBalance([
      { DebitAmount: 100, CreditAmount: null },
      { DebitAmount: null, CreditAmount: 80 },
    ]);
    expect(errs.some(e => e.includes('unbalanced'))).toBe(true);
  });

  it('flags a single-line entry (double-entry requires >= 2 lines)', () => {
    const errs = checkBalance([{ DebitAmount: 100, CreditAmount: null }]);
    expect(errs.some(e => e.includes('at least two lines'))).toBe(true);
  });

  it('tolerates sub-cent rounding within 0.005', () => {
    expect(checkBalance([
      { DebitAmount: 100.0, CreditAmount: null },
      { DebitAmount: null, CreditAmount: 100.004 },
    ])).toEqual([]);
  });

  it('flags rounding beyond tolerance', () => {
    const errs = checkBalance([
      { DebitAmount: 100, CreditAmount: null },
      { DebitAmount: null, CreditAmount: 100.02 },
    ]);
    expect(errs.some(e => e.includes('unbalanced'))).toBe(true);
  });
});
