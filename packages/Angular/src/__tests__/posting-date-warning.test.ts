import { describe, expect, it } from 'vitest';
import { PostingDateMonthWarning, PostingMonthLabel } from '../lib/custom/shared/posting-date-warning';

/** The manual-batch posting date warning (golive #315): a prior or future month is confirmed, never refused. */
describe('PostingDateMonthWarning', () => {
  const TODAY = '2026-10-03';

  it.each([
    ['today', '2026-10-03'],
    ['earlier this month', '2026-10-01'],
    ['later this month', '2026-10-31'],
  ])('says nothing for %s', (_label, day) => {
    expect(PostingDateMonthWarning(day, TODAY)).toBeNull();
  });

  it('warns on a prior month', () => {
    expect(PostingDateMonthWarning('2026-09-30', TODAY))
      .toBe('The posting date 2026-09-30 is in a prior month, so the ERP books this batch in September 2026. Are you sure?');
  });

  it('warns on a future month', () => {
    expect(PostingDateMonthWarning('2026-11-01', TODAY))
      .toBe('The posting date 2026-11-01 is in a future month, so the ERP books this batch in November 2026. Are you sure?');
  });

  it('compares the year as well as the month', () => {
    expect(PostingDateMonthWarning('2025-10-03', TODAY)).toMatch(/in a prior month, so the ERP books this batch in October 2025/);
  });

  it.each([[''], [null], [undefined], ['2026-02-30']])('leaves an unreadable date (%s) to the build block', (day) => {
    expect(PostingDateMonthWarning(day, TODAY)).toBeNull();
  });
});

describe('PostingMonthLabel', () => {
  it('names the month in UTC, whatever the machine zone', () => {
    expect(PostingMonthLabel('2026-09-01')).toBe('September 2026');
    expect(PostingMonthLabel('2026-12-31')).toBe('December 2026');
  });
});
