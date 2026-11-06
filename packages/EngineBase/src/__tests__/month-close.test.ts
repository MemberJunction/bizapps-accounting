/**
 * Closing and reopening a month on the Periods page (bc-aidp-next-golive#447): BooksClosedThroughDate
 * moves by whole calendar months, always to a month end.
 *
 * CONNECTS TO:
 *   TESTS: ../books-closed.ts (CloseMonthThrough, ReopenMonthThrough, CanCloseMonth)
 */
import { describe, expect, it } from 'vitest';
import { CanCloseMonth, CloseMonthThrough, ReopenMonthThrough } from '../books-closed.js';

describe('CloseMonthThrough', () => {
  it('moves a month end to the next month end, across year ends and leap years', () => {
    expect(CloseMonthThrough('2026-08-31', '2026-11-05')).toBe('2026-09-30');
    expect(CloseMonthThrough('2026-12-31', '2027-03-01')).toBe('2027-01-31');
    expect(CloseMonthThrough('2028-01-31', '2028-04-01')).toBe('2028-02-29');
  });

  it('closes the rest of the month when the date was left mid-month', () => {
    expect(CloseMonthThrough('2026-08-15', '2026-11-05')).toBe('2026-08-31');
  });

  it('with nothing closed, closes the month before today', () => {
    expect(CloseMonthThrough(null, '2026-11-05')).toBe('2026-10-31');
    expect(CloseMonthThrough(undefined, '2027-01-01')).toBe('2026-12-31');
  });
});

describe('ReopenMonthThrough', () => {
  it('moves back to the end of the month before', () => {
    expect(ReopenMonthThrough('2026-09-30')).toBe('2026-08-31');
    expect(ReopenMonthThrough('2027-01-31')).toBe('2026-12-31');
    expect(ReopenMonthThrough('2028-03-31')).toBe('2028-02-29');
  });

  it('reopens the whole month a mid-month date falls in', () => {
    expect(ReopenMonthThrough('2026-08-15')).toBe('2026-07-31');
  });
});

describe('CanCloseMonth', () => {
  it('allows closing a month that has finished', () => {
    expect(CanCloseMonth('2026-09-30', '2026-11-05')).toBe(true);
    expect(CanCloseMonth('2026-09-30', '2026-11-01')).toBe(true);
  });

  it('refuses closing the month still under way, including on its last day', () => {
    expect(CanCloseMonth('2026-10-31', '2026-11-05')).toBe(false);
    expect(CanCloseMonth('2026-09-30', '2026-10-31')).toBe(false);
  });
});
