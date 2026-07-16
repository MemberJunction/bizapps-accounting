import { describe, it, expect } from 'vitest';
import { outOfOrderSkipCount, perCompanySubtotals } from '../BatchingEngine';
import type { NetGroup } from '../BatchingEngine';

/**
 * TIER 1 — the MOD-8 out-of-order rule + per-company subtotals (§8.2 Batch workspace).
 *
 * The out-of-order rule is the subtle one: excluding entries off the END of the oldest-first pool is
 * NOT out-of-order (you are just batching less far forward), while excluding one from the MIDDLE is
 * (a later entry batches ahead of an older one). Getting that backwards would either cry wolf on
 * every normal cutoff-style build, or stay silent on the case MOD-8 exists to surface.
 */

const je = (id: string) => ({ ID: id });
/** The candidate pool is always gathered oldest-first (EffectiveDate ASC) — a..e is old→new. */
const POOL = [je('a'), je('b'), je('c'), je('d'), je('e')];

describe('outOfOrderSkipCount', () => {
  it('is 0 when everything is included', () => {
    expect(outOfOrderSkipCount(POOL, new Set(['a', 'b', 'c', 'd', 'e']))).toBe(0);
  });

  it('is 0 when NOTHING is included (nothing can jump a queue it is not in)', () => {
    expect(outOfOrderSkipCount(POOL, new Set())).toBe(0);
  });

  it('is 0 when the excluded entries are all at the END (batching less far forward)', () => {
    // Keeping a,b,c and dropping d,e is exactly a cutoff — the normal, unremarkable build.
    // Warning here would cry wolf on the most common flow.
    expect(outOfOrderSkipCount(POOL, new Set(['a', 'b', 'c']))).toBe(0);
  });

  it('counts an entry excluded from the MIDDLE (a later entry batches ahead of it)', () => {
    // Keep a,c,d,e — drop b. b is older than e, so e jumps ahead of b. THIS is MOD-8's case.
    expect(outOfOrderSkipCount(POOL, new Set(['a', 'c', 'd', 'e']))).toBe(1);
  });

  it('counts an entry excluded from the FRONT', () => {
    // Dropping the oldest while keeping newer ones is the starkest out-of-order case.
    expect(outOfOrderSkipCount(POOL, new Set(['b', 'c', 'd', 'e']))).toBe(1);
  });

  it('counts EVERY older excluded entry, not just the first', () => {
    // Keep only e (the newest) — a,b,c,d are all skipped.
    expect(outOfOrderSkipCount(POOL, new Set(['e']))).toBe(4);
  });

  it('counts only entries older than the NEWEST included one', () => {
    // Keep a,c — d,e are excluded but they are NEWER than c, so they are not "skipped", only
    // "not reached". Only b counts.
    expect(outOfOrderSkipCount(POOL, new Set(['a', 'c']))).toBe(1);
  });

  it('is 0 for a single included entry that is the oldest', () => {
    expect(outOfOrderSkipCount(POOL, new Set(['a']))).toBe(0);
  });

  it('handles an empty pool', () => {
    expect(outOfOrderSkipCount([], new Set(['a']))).toBe(0);
  });

  it('ignores included ids that are not in the pool', () => {
    // A stale selection must not be counted as a position in the queue.
    expect(outOfOrderSkipCount(POOL, new Set(['zzz']))).toBe(0);
  });
});

describe('perCompanySubtotals', () => {
  const CO_A = 'co-a';
  const CO_B = 'co-b';
  const group = (companyId: string, side: 'Debit' | 'Credit', net: number): NetGroup => ({
    companyId,
    glAccountId: 'gl',
    dims: [],
    dimKey: '',
    net: side === 'Debit' ? net : -net,
    side,
    sourceLineCount: 1,
  });

  it('is empty for no groups', () => {
    expect(perCompanySubtotals([])).toEqual([]);
  });

  it('splits Dr/Cr per company', () => {
    const out = perCompanySubtotals([
      group(CO_A, 'Debit', 100),
      group(CO_A, 'Credit', 100),
      group(CO_B, 'Debit', 50),
      group(CO_B, 'Credit', 50),
    ]);
    expect(out).toEqual([
      { CompanyID: CO_A, Debit: 100, Credit: 100 },
      { CompanyID: CO_B, Debit: 50, Credit: 50 },
    ]);
  });

  it('reports credits POSITIVE (net is stored signed)', () => {
    expect(perCompanySubtotals([group(CO_A, 'Credit', 75)])).toEqual([{ CompanyID: CO_A, Debit: 0, Credit: 75 }]);
  });

  it('each company foots independently — the AM-4 / 50023 per-company invariant', () => {
    // The workspace footer exists to show this: a batch can foot overall while a COMPANY does not.
    const out = perCompanySubtotals([
      group(CO_A, 'Debit', 100),
      group(CO_A, 'Credit', 90), // CO_A does NOT foot
      group(CO_B, 'Debit', 50),
      group(CO_B, 'Credit', 60), // CO_B does NOT foot
    ]);
    const overallDr = out.reduce((s, c) => s + c.Debit, 0);
    const overallCr = out.reduce((s, c) => s + c.Credit, 0);
    expect(overallDr).toBe(overallCr); // 150 = 150 — balanced OVERALL...
    expect(out[0].Debit).not.toBe(out[0].Credit); // ...but NOT per company. The footer must show this.
  });

  it('rounds to cents', () => {
    expect(perCompanySubtotals([group(CO_A, 'Debit', 0.1), group(CO_A, 'Debit', 0.2)])).toEqual([
      { CompanyID: CO_A, Debit: 0.3, Credit: 0 },
    ]);
  });
});
