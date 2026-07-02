/**
 * Block 4 unit tests — the PURE schedule math + type mapping (no DB).
 *
 * computeStraightLineSchedule is the money-correctness core: a multi-period schedule must sum to EXACTLY
 * the total (no penny created or lost) — an off-by-a-cent here becomes an unbalanced JE downstream.
 * mapScheduledEntryType pins the SJE→JE EntryType translation (the two enums are not the same set).
 */
import { describe, it, expect } from 'vitest';
import { computeStraightLineSchedule, mapScheduledEntryType } from '../ScheduledJournalEntryService.js';

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

describe('computeStraightLineSchedule', () => {
  it('splits evenly when it divides cleanly', () => {
    const s = computeStraightLineSchedule(1200, 12);
    expect(s).toHaveLength(12);
    expect(s.every(x => x === 100)).toBe(true);
    expect(sum(s)).toBe(1200);
  });

  it('distributes the rounding remainder cent-by-cent and still sums to EXACTLY the total', () => {
    const s = computeStraightLineSchedule(100, 12); // 8.3333.. /mo
    expect(s).toHaveLength(12);
    expect(sum(s)).toBe(100); // not 99.96 or 100.04
    // earliest periods absorb the 4 leftover cents → 8.34 ×4 then 8.33 ×8
    expect(s.filter(x => x === 8.34)).toHaveLength(4);
    expect(s.filter(x => x === 8.33)).toHaveLength(8);
  });

  it('handles a single-period schedule (whole amount)', () => {
    expect(computeStraightLineSchedule(999.99, 1)).toEqual([999.99]);
  });

  it('handles an amount smaller than the period count (sub-cent base)', () => {
    const s = computeStraightLineSchedule(0.03, 5); // 3 cents over 5 periods
    expect(sum(s)).toBe(0.03);
    expect(s.filter(x => x === 0.01)).toHaveLength(3);
    expect(s.filter(x => x === 0).length).toBe(2);
  });

  it('throws on a non-positive or non-integer count', () => {
    expect(() => computeStraightLineSchedule(100, 0)).toThrow();
    expect(() => computeStraightLineSchedule(100, -3)).toThrow();
    expect(() => computeStraightLineSchedule(100, 2.5)).toThrow();
  });

  it('throws on a negative total', () => {
    expect(() => computeStraightLineSchedule(-100, 12)).toThrow();
  });
});

describe('mapScheduledEntryType', () => {
  it('maps deferred-revenue release to revenue recognition', () => {
    expect(mapScheduledEntryType('RevenueRecognition')).toBe('RevenueRecognition');
    expect(mapScheduledEntryType('DeferredRevenueRelease')).toBe('RevenueRecognition');
  });
  it('maps amortization + depreciation to period-end accrual', () => {
    expect(mapScheduledEntryType('PrepaidAmortization')).toBe('PeriodEndAccrual');
    expect(mapScheduledEntryType('DepreciationAccrual')).toBe('PeriodEndAccrual');
    expect(mapScheduledEntryType('PeriodEndAccrual')).toBe('PeriodEndAccrual');
  });
  it('passes Manual through', () => {
    expect(mapScheduledEntryType('Manual')).toBe('Manual');
  });
});
