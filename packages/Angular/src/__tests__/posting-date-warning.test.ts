import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { ClosedBooksProblem, PostingDateMonthWarning, PostingMonthLabel } from '../lib/custom/shared/posting-date-warning';

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

/** A posting date in a month finance has closed (golive #316): refused, naming the first open day. */
describe('ClosedBooksProblem', () => {
  const CO_CLOSED = 'aaaaaaaa-0000-0000-0000-000000000316';
  const CO_OPEN = 'bbbbbbbb-0000-0000-0000-000000000316';

  afterEach(() => vi.restoreAllMocks());

  const closedThrough = (byCompany: Record<string, string | null>): void => {
    vi.spyOn(AccountingEngineBase.Instance, 'BooksClosedThroughFor').mockImplementation((id) => {
      const day = id ? byCompany[id] : null;
      return day ? new Date(`${day}T00:00:00Z`) : null;
    });
  };

  it('refuses a date on or before a company\'s closed-through date', () => {
    closedThrough({ [CO_CLOSED]: '2026-08-31' });
    expect(ClosedBooksProblem('2026-08-31', [CO_CLOSED])).toContain('closed through 2026-08-31');
    expect(ClosedBooksProblem('2026-08-01', [CO_OPEN, CO_CLOSED])).toContain('2026-09-01 or later');
  });

  it('allows a date after it, a company with no date, and no companies', () => {
    closedThrough({ [CO_CLOSED]: '2026-08-31', [CO_OPEN]: null });
    expect(ClosedBooksProblem('2026-09-01', [CO_CLOSED])).toBeNull();
    expect(ClosedBooksProblem('2026-08-31', [CO_OPEN])).toBeNull();
    expect(ClosedBooksProblem('2026-08-31', [])).toBeNull();
  });

  it('says nothing about an unreadable date, which the screen already blocks', () => {
    closedThrough({ [CO_CLOSED]: '2026-08-31' });
    expect(ClosedBooksProblem('', [CO_CLOSED])).toBeNull();
    expect(ClosedBooksProblem(null, [CO_CLOSED])).toBeNull();
  });
});
