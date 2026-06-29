/**
 * Unit tests for the minimal starter chart of accounts (Block 0 — AD-8 + plan §C1).
 *
 * CONNECTS TO:
 *   TESTS:     SeedData.DEFAULT_CHART_OF_ACCOUNTS + DEFAULT_GL_ACCOUNT_REFS
 *   SEEDED BY: AccountingCompanyProfileEntityServer (W1) — the LIVE seeding behavior is
 *              covered by test-harness/block0-runtime.ts (this file is pure-logic, no DB)
 *   DOC:       docs/ARCHITECTURE.md#company-profile-init
 *
 * Pure logic, no database, deterministic, < 5s (MJ unit-test convention).
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_CHART_OF_ACCOUNTS, DEFAULT_GL_ACCOUNT_REFS } from '../SeedData.js';

const EXPECTED_CODES = [
  '11101', '11201', '21201', '21301', '21401', '21402', '40100', '40200', '50400', '50500',
];

// Accounts deliberately dropped from the original 23-account illustrative set.
const DROPPED_CODES = [
  '11211', '21501',                               // intercompany — now per-company-pair (§C1), generated upstream
  '11301', '21101', '21202', '50300', '90100',    // ERP-owned GL/P&L accounts (sync from BC, AD-1)
  '50100', '50200',                               // commission / partner-rev-share EXPENSE legs (ERP-owned)
  '40300', '40400', '40500', '40900',             // extra revenue accounts (not in the minimal AR set)
];

describe('DEFAULT_CHART_OF_ACCOUNTS (minimal AR-subledger starter chart)', () => {
  it('seeds exactly the 10 minimal accounts', () => {
    expect(DEFAULT_CHART_OF_ACCOUNTS).toHaveLength(10);
    expect(DEFAULT_CHART_OF_ACCOUNTS.map(a => a.code).sort()).toEqual([...EXPECTED_CODES].sort());
  });

  it('has no duplicate codes', () => {
    const codes = DEFAULT_CHART_OF_ACCOUNTS.map(a => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('gives every account a non-empty name and a valid account type', () => {
    const validTypes = new Set([
      'Asset', 'Liability', 'Equity', 'Revenue', 'Expense',
      'ContraAsset', 'ContraLiability', 'ContraRevenue', 'ContraExpense', 'Statistical',
    ]);
    for (const a of DEFAULT_CHART_OF_ACCOUNTS) {
      expect(a.name.trim().length).toBeGreaterThan(0);
      expect(validTypes.has(a.accountType)).toBe(true);
    }
  });

  it('does NOT seed the dropped GL/P&L or centralized-intercompany accounts', () => {
    const codes = new Set(DEFAULT_CHART_OF_ACCOUNTS.map(a => a.code));
    for (const dropped of DROPPED_CODES) {
      expect(codes.has(dropped), `dropped account ${dropped} must not be seeded`).toBe(false);
    }
  });
});

describe('DEFAULT_GL_ACCOUNT_REFS (the profile default-account refs)', () => {
  it('every ref resolves to a seeded account code', () => {
    const codes = new Set(DEFAULT_CHART_OF_ACCOUNTS.map(a => a.code));
    for (const [refName, code] of Object.entries(DEFAULT_GL_ACCOUNT_REFS)) {
      expect(codes.has(code), `${refName} -> ${code} must be a seeded account`).toBe(true);
    }
  });

  it('wires all five expected refs', () => {
    expect(Object.keys(DEFAULT_GL_ACCOUNT_REFS).sort()).toEqual(
      ['AROpen', 'DeferredRevenue', 'RealizedFXGainLoss', 'SalesTaxPayable', 'UnrealizedFXGainLoss'].sort(),
    );
  });
});
