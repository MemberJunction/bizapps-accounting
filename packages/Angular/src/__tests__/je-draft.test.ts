import { describe, it, expect } from 'vitest';
import {
  newDraftLine,
  parseMoney,
  isLineEmpty,
  draftTotals,
  lineIssue,
  draftIssues,
  toCreateInput,
  type JEDraftLine,
  type JEDraftState,
} from '../lib/custom/shell/pages/je-draft';

/**
 * Tier 1 for the JE workspace's pure seam (§8.1).
 *
 * These are the rules the operator feels while typing — money parsing, the one-side-only rule, the
 * balance check, and the mapping onto the engine contract. They mirror the server's guards, so the
 * exact values matter: a wrong tolerance or a dropped side books a real, wrong journal entry.
 */

function line(over: Partial<JEDraftLine> = {}): JEDraftLine {
  return { ...newDraftLine('k'), ...over };
}

/** A minimal balanced two-line draft — the shape most tests vary from. */
function balancedDraft(over: Partial<JEDraftState> = {}): JEDraftState {
  return {
    CompanyID: 'c1',
    EffectiveDate: '2026-07-16',
    Description: 'Event deposit accrual',
    Lines: [
      line({ Key: 'a', GLAccountID: 'gl-cash', Debit: '860.00' }),
      line({ Key: 'b', GLAccountID: 'gl-deposits', Credit: '860.00' }),
    ],
    ...over,
  };
}

describe('parseMoney', () => {
  it('reads a plain decimal', () => {
    expect(parseMoney('860.00')).toBe(860);
  });

  it('treats blank/whitespace as zero — an untouched side is not an error', () => {
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('   ')).toBe(0);
  });

  it('strips thousands separators an accountant will paste in', () => {
    expect(parseMoney('1,250.75')).toBe(1250.75);
  });

  it('returns NaN for a typo rather than silently booking zero', () => {
    // The whole point: '8o0' must NOT become 0 and post a wrong entry.
    expect(Number.isNaN(parseMoney('8o0'))).toBe(true);
  });
});

describe('isLineEmpty', () => {
  it('is true for an untouched row', () => {
    expect(isLineEmpty(line())).toBe(true);
  });

  it('is false when any field carries intent', () => {
    expect(isLineEmpty(line({ GLAccountID: 'gl-1' }))).toBe(false);
    expect(isLineEmpty(line({ Debit: '5' }))).toBe(false);
    expect(isLineEmpty(line({ Description: 'x' }))).toBe(false);
  });
});

describe('draftTotals', () => {
  it('sums each side independently and ignores empty rows', () => {
    const lines = [
      line({ Key: 'a', GLAccountID: 'g1', Debit: '100' }),
      line({ Key: 'b', GLAccountID: 'g2', Credit: '40' }),
      line({ Key: 'c', GLAccountID: 'g3', Credit: '60' }),
      line({ Key: 'd' }), // untouched — must not perturb the totals
    ];
    expect(draftTotals(lines)).toEqual({ Debits: 100, Credits: 100 });
  });

  it('does not let a NaN amount poison the totals', () => {
    const lines = [line({ Key: 'a', GLAccountID: 'g1', Debit: 'oops' }), line({ Key: 'b', GLAccountID: 'g2', Credit: '60' })];
    // The bad line contributes nothing (lineIssue reports it); credits still foot exactly.
    expect(draftTotals(lines)).toEqual({ Debits: 0, Credits: 60 });
  });
});

describe('lineIssue', () => {
  it('passes a well-formed debit line', () => {
    expect(lineIssue(line({ GLAccountID: 'g1', Debit: '10' }))).toBeNull();
  });

  it('ignores an untouched row', () => {
    expect(lineIssue(line())).toBeNull();
  });

  it('rejects both sides at once — a line is a debit or a credit, never both', () => {
    expect(lineIssue(line({ GLAccountID: 'g1', Debit: '10', Credit: '10' }))).toMatch(/not both/i);
  });

  it('rejects an amount with no account', () => {
    expect(lineIssue(line({ Debit: '10' }))).toMatch(/account/i);
  });

  it('rejects a negative amount instead of quietly flipping the side', () => {
    expect(lineIssue(line({ GLAccountID: 'g1', Debit: '-10' }))).toMatch(/negative/i);
  });

  it('rejects an account with no amount', () => {
    expect(lineIssue(line({ GLAccountID: 'g1' , Description: 'x' }))).toMatch(/debit or a credit/i);
  });
});

describe('draftIssues', () => {
  it('accepts a balanced two-line draft', () => {
    expect(draftIssues(balancedDraft())).toEqual([]);
  });

  it('requires at least two lines', () => {
    const d = balancedDraft({ Lines: [line({ Key: 'a', GLAccountID: 'g1', Debit: '10' })] });
    expect(draftIssues(d).some((i) => /two lines/i.test(i))).toBe(true);
  });

  it('requires an entry date', () => {
    expect(draftIssues(balancedDraft({ EffectiveDate: '' })).some((i) => /date/i.test(i))).toBe(true);
  });

  it('reports an unbalanced draft with BOTH exact totals', () => {
    const d = balancedDraft();
    d.Lines[1].Credit = '860.01';
    const issues = draftIssues(d);
    // The operator needs the two numbers to find the typo — not just "unbalanced".
    expect(issues.some((i) => i.includes('860.00') && i.includes('860.01'))).toBe(true);
  });

  it('accepts a one-cent-tolerance match (money is never compared with ===)', () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point; the entry is still balanced.
    const d = balancedDraft({
      Lines: [
        line({ Key: 'a', GLAccountID: 'g1', Debit: '0.1' }),
        line({ Key: 'b', GLAccountID: 'g2', Debit: '0.2' }),
        line({ Key: 'c', GLAccountID: 'g3', Credit: '0.3' }),
      ],
    });
    expect(draftIssues(d)).toEqual([]);
  });

  it('does not double-report: a malformed line suppresses the balance complaint', () => {
    const d = balancedDraft();
    d.Lines[0].Debit = 'oops';
    const issues = draftIssues(d);
    expect(issues.some((i) => /must be numbers/i.test(i))).toBe(true);
    expect(issues.some((i) => /must equal credits/i.test(i))).toBe(false);
  });

  it('numbers issues by LIVE line, so a blank row above does not shift the label', () => {
    const d = balancedDraft({
      Lines: [
        line({ Key: 'blank' }), // untouched — not a "line 1" for the operator
        line({ Key: 'a', GLAccountID: 'g1', Debit: '10', Credit: '10' }),
        line({ Key: 'b', GLAccountID: 'g2', Credit: '10' }),
      ],
    });
    expect(draftIssues(d).some((i) => i.startsWith('Line 1:'))).toBe(true);
  });
});

describe('toCreateInput', () => {
  it('maps a balanced draft onto the engine contract', () => {
    const input = toCreateInput(balancedDraft());
    expect(input.EntryType).toBe('Manual');
    expect(input.EffectiveDate).toBe('2026-07-16');
    expect(input.Description).toBe('Event deposit accrual');
    expect(input.Lines).toHaveLength(2);
  });

  it('sends ONLY the side that carries an amount — absent, never zero', () => {
    const [debitLine, creditLine] = toCreateInput(balancedDraft()).Lines;
    expect(debitLine.DebitAmount).toBe(860);
    expect(debitLine).not.toHaveProperty('CreditAmount');
    expect(creditLine.CreditAmount).toBe(860);
    expect(creditLine).not.toHaveProperty('DebitAmount');
  });

  it('never sends a CompanyID — the engine derives the company from the accounts (MOD-12)', () => {
    expect(toCreateInput(balancedDraft())).not.toHaveProperty('CompanyID');
  });

  it('drops empty rows so a trailing blank line does not reach the ledger', () => {
    const d = balancedDraft();
    d.Lines.push(line({ Key: 'trailing' }));
    expect(toCreateInput(d).Lines).toHaveLength(2);
  });

  it('sends only dimension pairs the operator actually chose', () => {
    const d = balancedDraft();
    d.Lines[0].DimensionValueIDs = { 'dim-dept': 'val-events', 'dim-region': null };
    const [first] = toCreateInput(d).Lines;
    expect(first.Dimensions).toEqual([{ DimensionID: 'dim-dept', DimensionValueID: 'val-events' }]);
  });

  it('omits Dimensions entirely when none are chosen', () => {
    expect(toCreateInput(balancedDraft()).Lines[0]).not.toHaveProperty('Dimensions');
  });

  it('omits a blank memo rather than sending an empty string', () => {
    expect(toCreateInput(balancedDraft({ Description: '   ' }))).not.toHaveProperty('Description');
  });

  it('trims a line description', () => {
    const d = balancedDraft();
    d.Lines[0].Description = '  cash in  ';
    expect(toCreateInput(d).Lines[0].Description).toBe('cash in');
  });

  it('sends CounterpartyOrganizationID on a line when the operator picked one', () => {
    const d = balancedDraft();
    d.Lines[0].CounterpartyOrganizationID = 'org-acme';
    expect(toCreateInput(d).Lines[0].CounterpartyOrganizationID).toBe('org-acme');
  });

  it('omits CounterpartyOrganizationID entirely when no counterparty is chosen (absent, not null)', () => {
    // newDraftLine() defaults it to null; the contract field is optional, so it must not be sent.
    expect(toCreateInput(balancedDraft()).Lines[0]).not.toHaveProperty('CounterpartyOrganizationID');
  });
});
