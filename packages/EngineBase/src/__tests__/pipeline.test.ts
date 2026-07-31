/**
 * Unit tests for the pure CreateJournalEntry draft pipeline (plan §6 test matrix):
 * every error code, grouping/merge, Dr-before-Cr ordering, overall + per-company balance.
 * Isolated, no DB — lookups are plain in-memory fakes.
 *
 * CONNECTS TO:
 *   TESTS: ../pipeline.ts (stages 1-5)
 *   LIVE:  the DB-backed engine + remotable op are exercised by
 *          test-harnesses/server/engine-runtime.ts (this file is pure-logic, no DB)
 */
import { describe, it, expect } from 'vitest';
import type { JournalEntryDraft } from '../contract.js';
import {
  checkDraftBalance,
  normalizeLines,
  runDraftPipeline,
  validateAccounts,
  validateDimensions,
  validateDraftShape,
  validateEntryType,
  type PipelineLookups,
} from '../pipeline.js';

// ─── fakes ───────────────────────────────────────────────────────────────────
// Two companies (A, B), two active accounts each + one inactive; one dimension with one value.
const GL = {
  aAR: 'aaaaaaaa-0000-4000-8000-00000000ar01',
  aRev: 'aaaaaaaa-0000-4000-8000-0000000rev01',
  aDead: 'aaaaaaaa-0000-4000-8000-00000dead01',
  bAR: 'bbbbbbbb-0000-4000-8000-00000000ar01',
  bRev: 'bbbbbbbb-0000-4000-8000-0000000rev01',
};
const CO_A = 'ca000000-0000-4000-8000-000000000001';
const CO_B = 'cb000000-0000-4000-8000-000000000001';
const DIM_DEPT = 'd1000000-0000-4000-8000-000000000001';
const DIMVAL_SALES = 'd1000000-0000-4000-8000-0000000000v1';

const JET = {
  manual: 'e1000000-0000-4000-8000-000000000001',
  retired: 'e1000000-0000-4000-8000-000000000002',
};

const lookups: PipelineLookups = {
  accountByID: (id) => {
    const k = id.toLowerCase();
    if (k === GL.aAR) return { ID: GL.aAR, CompanyID: CO_A, IsActive: true };
    if (k === GL.aRev) return { ID: GL.aRev, CompanyID: CO_A, IsActive: true };
    if (k === GL.aDead) return { ID: GL.aDead, CompanyID: CO_A, IsActive: false };
    if (k === GL.bAR) return { ID: GL.bAR, CompanyID: CO_B, IsActive: true };
    if (k === GL.bRev) return { ID: GL.bRev, CompanyID: CO_B, IsActive: true };
    return undefined;
  },
  entryTypeByCode: (code) => {
    const k = (code ?? '').trim().toLowerCase();
    if (k === 'manual') return { ID: JET.manual, Code: 'Manual', IsActive: true, IsBatchSummary: false };
    if (k === 'retiredtype') return { ID: JET.retired, Code: 'RetiredType', IsActive: false, IsBatchSummary: false };
    return undefined;
  },
  dimensionExists: (id) => id.toLowerCase() === DIM_DEPT,
  dimensionValueBelongs: (dim, val) => dim.toLowerCase() === DIM_DEPT && val.toLowerCase() === DIMVAL_SALES,
};

const balancedDraft = (over: Partial<JournalEntryDraft> = {}): JournalEntryDraft => ({
  EffectiveDate: '2026-07-06',
  EntryType: 'Manual',
  Description: 'test',
  Lines: [
    { GLAccountID: GL.aAR, DebitAmount: 100 },
    { GLAccountID: GL.aRev, CreditAmount: 100 },
  ],
  ...over,
});

// ─── stage 1: shape → MALFORMED_DRAFT ────────────────────────────────────────

describe('validateDraftShape (stage 1 — MALFORMED_DRAFT)', () => {
  it('passes a well-formed two-line draft', () => {
    expect(validateDraftShape(balancedDraft())).toEqual([]);
  });

  it('rejects fewer than two lines', () => {
    const errs = validateDraftShape(balancedDraft({ Lines: [{ GLAccountID: GL.aAR, DebitAmount: 100 }] }));
    expect(errs.some(e => e.Code === 'MALFORMED_DRAFT' && /two lines/.test(e.Message))).toBe(true);
  });

  it('rejects a line with BOTH sides set (exactly-one-side rule)', () => {
    const errs = validateDraftShape(balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 100, CreditAmount: 100 },
      { GLAccountID: GL.aRev, CreditAmount: 100 },
    ] }));
    expect(errs.some(e => e.Code === 'MALFORMED_DRAFT' && e.LineIndex === 0)).toBe(true);
  });

  it('rejects a line with NEITHER side set', () => {
    const errs = validateDraftShape(balancedDraft({ Lines: [
      { GLAccountID: GL.aAR },
      { GLAccountID: GL.aRev, CreditAmount: 100 },
    ] }));
    expect(errs.some(e => e.Code === 'MALFORMED_DRAFT' && e.LineIndex === 0)).toBe(true);
  });

  it('rejects zero and negative amounts', () => {
    for (const amount of [0, -50]) {
      const errs = validateDraftShape(balancedDraft({ Lines: [
        { GLAccountID: GL.aAR, DebitAmount: amount },
        { GLAccountID: GL.aRev, CreditAmount: 100 },
      ] }));
      expect(errs.some(e => e.Code === 'MALFORMED_DRAFT' && e.LineIndex === 0)).toBe(true);
    }
  });

  it('rejects a debits-only entry (needs at least one of each side)', () => {
    const errs = validateDraftShape(balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 100 },
      { GLAccountID: GL.aRev, DebitAmount: 100 },
    ] }));
    expect(errs.some(e => /one debit AND one credit/.test(e.Message))).toBe(true);
  });

  it('rejects an invalid EffectiveDate', () => {
    const errs = validateDraftShape(balancedDraft({ EffectiveDate: 'not-a-date' }));
    expect(errs.some(e => /EffectiveDate/.test(e.Message))).toBe(true);
  });

  it('rejects an empty EntryType code (shape only — existence is stage 1b)', () => {
    const errs = validateDraftShape(balancedDraft({ EntryType: '  ' }));
    expect(errs.some(e => /EntryType/.test(e.Message))).toBe(true);
  });
});

// ─── stage 1b: entry type (issue #24 — validated against the lookup) ─────────

describe('validateEntryType', () => {
  it('accepts a known active type code (case-insensitive)', () => {
    expect(validateEntryType(balancedDraft({ EntryType: 'manual' }), lookups)).toEqual([]);
  });

  it('rejects an unknown type code with ENTRY_TYPE_UNKNOWN', () => {
    const errs = validateEntryType(balancedDraft({ EntryType: 'NotARealType' }), lookups);
    expect(errs).toEqual([expect.objectContaining({ Code: 'ENTRY_TYPE_UNKNOWN' })]);
  });

  it('rejects an inactive type code with ENTRY_TYPE_INACTIVE', () => {
    const errs = validateEntryType(balancedDraft({ EntryType: 'RetiredType' }), lookups);
    expect(errs).toEqual([expect.objectContaining({ Code: 'ENTRY_TYPE_INACTIVE' })]);
  });
});

// ─── stage 2: accounts ───────────────────────────────────────────────────────

describe('validateAccounts (stage 2 — ACCOUNT_UNKNOWN / ACCOUNT_INACTIVE)', () => {
  it('passes known active accounts', () => {
    expect(validateAccounts(balancedDraft(), lookups)).toEqual([]);
  });

  it('flags an unknown account with its line index', () => {
    const errs = validateAccounts(balancedDraft({ Lines: [
      { GLAccountID: '99999999-0000-4000-8000-000000000099', DebitAmount: 100 },
      { GLAccountID: GL.aRev, CreditAmount: 100 },
    ] }), lookups);
    expect(errs).toEqual([expect.objectContaining({ Code: 'ACCOUNT_UNKNOWN', LineIndex: 0 })]);
  });

  it('flags an inactive account', () => {
    const errs = validateAccounts(balancedDraft({ Lines: [
      { GLAccountID: GL.aDead, DebitAmount: 100 },
      { GLAccountID: GL.aRev, CreditAmount: 100 },
    ] }), lookups);
    expect(errs).toEqual([expect.objectContaining({ Code: 'ACCOUNT_INACTIVE', LineIndex: 0 })]);
  });

  it('is case-insensitive on the UUID (SQL Server uppercases)', () => {
    const errs = validateAccounts(balancedDraft({ Lines: [
      { GLAccountID: GL.aAR.toUpperCase(), DebitAmount: 100 },
      { GLAccountID: GL.aRev, CreditAmount: 100 },
    ] }), lookups);
    expect(errs).toEqual([]);
  });
});

// ─── stage 3: dimensions (validate-only — CH-12) ─────────────────────────────

describe('validateDimensions (stage 3 — DIMENSION_UNKNOWN / DIMENSION_VALUE_UNKNOWN)', () => {
  it('passes a pre-existing dimension/value pair', () => {
    const draft = balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 100 },
      { GLAccountID: GL.aRev, CreditAmount: 100, Dimensions: [{ DimensionID: DIM_DEPT, DimensionValueID: DIMVAL_SALES }] },
    ] });
    expect(validateDimensions(draft, lookups)).toEqual([]);
  });

  it('flags an unknown dimension', () => {
    const draft = balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 100 },
      { GLAccountID: GL.aRev, CreditAmount: 100, Dimensions: [{ DimensionID: 'ffffffff-0000-4000-8000-000000000001', DimensionValueID: DIMVAL_SALES }] },
    ] });
    expect(validateDimensions(draft, lookups)).toEqual([expect.objectContaining({ Code: 'DIMENSION_UNKNOWN', LineIndex: 1 })]);
  });

  it('flags a value that does not belong to the dimension (never auto-creates)', () => {
    const draft = balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 100 },
      { GLAccountID: GL.aRev, CreditAmount: 100, Dimensions: [{ DimensionID: DIM_DEPT, DimensionValueID: 'ffffffff-0000-4000-8000-0000000000ff' }] },
    ] });
    expect(validateDimensions(draft, lookups)).toEqual([expect.objectContaining({ Code: 'DIMENSION_VALUE_UNKNOWN', LineIndex: 1 })]);
  });
});

// ─── stage 4: grouping + normalization ───────────────────────────────────────

describe('normalizeLines (stage 4 — merge, order, number)', () => {
  it('merges same-side lines on the same account + dimension set, summing amounts', () => {
    const draft = balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 60 },
      { GLAccountID: GL.aAR, DebitAmount: 40 },
      { GLAccountID: GL.aRev, CreditAmount: 100 },
    ] });
    const lines = normalizeLines(draft, lookups);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ GLAccountID: GL.aAR, DebitAmount: 100, CreditAmount: null, SourceLineIndexes: [0, 1] });
  });

  it('does NOT merge across different dimension sets on the same account', () => {
    const draft = balancedDraft({ Lines: [
      { GLAccountID: GL.aRev, CreditAmount: 60, Dimensions: [{ DimensionID: DIM_DEPT, DimensionValueID: DIMVAL_SALES }] },
      { GLAccountID: GL.aRev, CreditAmount: 40 },
      { GLAccountID: GL.aAR, DebitAmount: 100 },
    ] });
    const lines = normalizeLines(draft, lookups);
    expect(lines).toHaveLength(3);
  });

  it('does NOT merge a debit with a credit on the same account (no netting at create — that is batching)', () => {
    const draft = balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 100 },
      { GLAccountID: GL.aAR, CreditAmount: 40 },
      { GLAccountID: GL.aRev, CreditAmount: 60 },
    ] });
    const lines = normalizeLines(draft, lookups);
    expect(lines).toHaveLength(3);
  });

  it('orders debits before credits and numbers lines 1..n', () => {
    const draft = balancedDraft({ Lines: [
      { GLAccountID: GL.aRev, CreditAmount: 100 },
      { GLAccountID: GL.aAR, DebitAmount: 100 },
    ] });
    const lines = normalizeLines(draft, lookups);
    expect(lines.map(l => l.LineNumber)).toEqual([1, 2]);
    expect(lines[0].DebitAmount).toBe(100);
    expect(lines[1].CreditAmount).toBe(100);
  });

  it('carries the company from the account lookup onto each line (CH-2)', () => {
    const draft = balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 100 },
      { GLAccountID: GL.aRev, CreditAmount: 100 },
      { GLAccountID: GL.bAR, DebitAmount: 40 },
      { GLAccountID: GL.bRev, CreditAmount: 40 },
    ] });
    const lines = normalizeLines(draft, lookups);
    expect(lines.find(l => l.GLAccountID === GL.bAR)?.CompanyID).toBe(CO_B);
  });
});

// ─── stage 5: balance (overall + per company — AM-4) ─────────────────────────

describe('checkDraftBalance (stage 5 — UNBALANCED)', () => {
  const norm = (draft: JournalEntryDraft) => normalizeLines(draft, lookups);

  it('passes a balanced single-company entry', () => {
    expect(checkDraftBalance(norm(balancedDraft()))).toEqual([]);
  });

  it('rejects a multi-company draft with the TYPED code, even when balanced per company (plan D3)', () => {
    const draft = balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 100 },
      { GLAccountID: GL.aRev, CreditAmount: 100 },
      { GLAccountID: GL.bAR, DebitAmount: 40 },
      { GLAccountID: GL.bRev, CreditAmount: 40 },
    ] });
    const errs = checkDraftBalance(norm(draft));
    expect(errs).toHaveLength(1);
    expect(errs[0].Code).toBe('MULTI_COMPANY_DRAFT');
    expect(errs[0].Message).toMatch(/split the draft per company/);
  });

  it('flags an overall imbalance', () => {
    const draft = balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 100 },
      { GLAccountID: GL.aRev, CreditAmount: 80 },
    ] });
    const errs = checkDraftBalance(norm(draft));
    expect(errs.some(e => e.Code === 'UNBALANCED' && !/within company/.test(e.Message))).toBe(true);
  });

  it('rejects the cross-company case (overall-balanced, spans two companies) as MULTI_COMPANY_DRAFT', () => {
    // Pre-D3 this was the AM-4 per-company-balance case; single-company JEs make ANY
    // multi-company draft invalid regardless of how it foots.
    const draft = balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 100 },
      { GLAccountID: GL.bRev, CreditAmount: 100 },
    ] });
    const errs = checkDraftBalance(norm(draft));
    expect(errs).toHaveLength(1);
    expect(errs[0].Code).toBe('MULTI_COMPANY_DRAFT');
  });

  it('tolerates sub-cent rounding within 0.005 (matches the DB trigger)', () => {
    const draft = balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 100.0 },
      { GLAccountID: GL.aRev, CreditAmount: 100.004 },
    ] });
    expect(checkDraftBalance(norm(draft))).toEqual([]);
  });
});

// ─── composition ─────────────────────────────────────────────────────────────

describe('runDraftPipeline (stages 1-5 composed, fail-fast per stage)', () => {
  it('returns normalized lines for a fully valid draft', () => {
    const out = runDraftPipeline(balancedDraft(), lookups);
    expect(out.errors).toEqual([]);
    expect(out.normalized).toHaveLength(2);
  });

  it('stops at shape errors before account checks (no cascade noise)', () => {
    const out = runDraftPipeline(balancedDraft({ Lines: [{ GLAccountID: 'nope', DebitAmount: 100 }] }), lookups);
    expect(out.errors.every(e => e.Code === 'MALFORMED_DRAFT')).toBe(true);
    expect(out.normalized).toEqual([]);
  });

  it('surfaces UNBALANCED only after accounts + dimensions pass (whole-entry footing, like trigger 50001)', () => {
    const out = runDraftPipeline(balancedDraft({ Lines: [
      { GLAccountID: GL.aAR, DebitAmount: 100 },
      { GLAccountID: GL.aRev, CreditAmount: 60 },
    ] }), lookups);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].Code).toBe('UNBALANCED');
    expect(out.normalized).toEqual([]);
    expect(out.companyID).toBe('');
  });

  it('reports the single resolved company on success (the JE header CompanyID, plan D3)', () => {
    const out = runDraftPipeline(balancedDraft(), lookups);
    expect(out.errors).toEqual([]);
    expect(out.companyID).toBe(out.normalized[0].CompanyID);
  });
});
