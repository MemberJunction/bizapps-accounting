import { describe, it, expect } from 'vitest';
import { MonthBarLabel, MonthsBetween } from '../lib/custom/overview/overview-months';

/**
 * TIER 1 — the months the Overview's volume chart draws for a period. Each month is one count read,
 * so its bounds must be the period's: clipped at both ends, inclusive, no day lost at a month edge.
 */
describe('MonthsBetween', () => {
  it('covers a quarter month by month, each to its last day', () => {
    expect(MonthsBetween('2026-07-01', '2026-09-30')).toEqual([
      { Period: '2026-07', Start: '2026-07-01', End: '2026-07-31' },
      { Period: '2026-08', Start: '2026-08-01', End: '2026-08-31' },
      { Period: '2026-09', Start: '2026-09-01', End: '2026-09-30' },
    ]);
  });

  it('clips the first and last month to a period that starts and ends mid-month', () => {
    expect(MonthsBetween('2026-04-06', '2026-07-05')).toEqual([
      { Period: '2026-04', Start: '2026-04-06', End: '2026-04-30' },
      { Period: '2026-05', Start: '2026-05-01', End: '2026-05-31' },
      { Period: '2026-06', Start: '2026-06-01', End: '2026-06-30' },
      { Period: '2026-07', Start: '2026-07-01', End: '2026-07-05' },
    ]);
  });

  it('crosses a year end and ends February on the leap day', () => {
    expect(MonthsBetween('2027-12-15', '2028-02-29').map((m) => [m.Period, m.End])).toEqual([
      ['2027-12', '2027-12-31'],
      ['2028-01', '2028-01-31'],
      ['2028-02', '2028-02-29'],
    ]);
  });

  it('keeps only the latest months when the period is longer than the chart', () => {
    const months = MonthsBetween('2020-01-01', '2026-09-30', 24);
    expect(months).toHaveLength(24);
    expect(months[0].Period).toBe('2024-10');
    expect(months[23].Period).toBe('2026-09');
  });

  it('is empty when the end is before the start, and one month for a single day', () => {
    expect(MonthsBetween('2026-09-02', '2026-09-01')).toEqual([]);
    expect(MonthsBetween('2026-09-01', '2026-09-01')).toEqual([{ Period: '2026-09', Start: '2026-09-01', End: '2026-09-01' }]);
  });
});

describe('MonthBarLabel', () => {
  it("reads 2026-09 as Sep '26", () => {
    expect(MonthBarLabel('2026-09')).toBe("Sep '26");
  });
});
