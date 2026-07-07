/**
 * Unit tests for F1's pure balance/two-line + AM-4 per-company checks (Block 1). Isolated, no DB.
 *
 * CONNECTS TO:
 *   TESTS:  JournalEntryValidation.checkBalance · checkPerCompanyBalance
 *   LIVE:   the DB-backed validateJournalEntry + the balanced-on-lock triggers (50001/50019) are
 *           exercised by test-harnesses/server/block1-runtime.ts (this file is pure-logic, no DB)
 *   DOC:    docs/ARCHITECTURE.md#je-lifecycle
 */
import { describe, it, expect } from 'vitest';
import { checkBalance, checkPerCompanyBalance } from '../JournalEntryValidation.js';

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

describe('checkPerCompanyBalance (F1 — AM-4 per-company balance, mirrors trigger 50019)', () => {
  const companyMap = new Map<string, string>([
    ['gl-a-ar', 'CO_A'], ['gl-a-rev', 'CO_A'],
    ['gl-b-ar', 'CO_B'], ['gl-b-rev', 'CO_B'],
  ]);

  it('passes a multi-company entry balanced within each company', () => {
    expect(checkPerCompanyBalance([
      { GLAccountID: 'gl-a-ar', DebitAmount: 100, CreditAmount: null },
      { GLAccountID: 'gl-a-rev', DebitAmount: null, CreditAmount: 100 },
      { GLAccountID: 'gl-b-ar', DebitAmount: 40, CreditAmount: null },
      { GLAccountID: 'gl-b-rev', DebitAmount: null, CreditAmount: 40 },
    ], companyMap)).toEqual([]);
  });

  it('flags an overall-balanced entry that is unbalanced across companies (the AM-4 case)', () => {
    const errs = checkPerCompanyBalance([
      { GLAccountID: 'gl-a-ar', DebitAmount: 100, CreditAmount: null },
      { GLAccountID: 'gl-b-rev', DebitAmount: null, CreditAmount: 100 },
    ], companyMap);
    expect(errs).toHaveLength(2); // both CO_A and CO_B are one-sided
    expect(errs.every(e => e.includes('AM-4'))).toBe(true);
    expect(errs.some(e => e.includes('CO_A'))).toBe(true);
    expect(errs.some(e => e.includes('CO_B'))).toBe(true);
  });

  it('names the exact per-company sums in the error', () => {
    const errs = checkPerCompanyBalance([
      { GLAccountID: 'gl-a-ar', DebitAmount: 100, CreditAmount: null },
      { GLAccountID: 'gl-a-rev', DebitAmount: null, CreditAmount: 60 },
    ], companyMap);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('Sum(Debits)=100.00');
    expect(errs[0]).toContain('Sum(Credits)=60.00');
  });

  it('is case-insensitive on GLAccountID map keys (UUID casing varies by platform)', () => {
    expect(checkPerCompanyBalance([
      { GLAccountID: 'GL-A-AR', DebitAmount: 50, CreditAmount: null },
      { GLAccountID: 'GL-A-REV', DebitAmount: null, CreditAmount: 50 },
    ], companyMap)).toEqual([]);
  });

  it('tolerates sub-cent rounding within 0.005 per company', () => {
    expect(checkPerCompanyBalance([
      { GLAccountID: 'gl-a-ar', DebitAmount: 100.0, CreditAmount: null },
      { GLAccountID: 'gl-a-rev', DebitAmount: null, CreditAmount: 100.004 },
    ], companyMap)).toEqual([]);
  });
});
