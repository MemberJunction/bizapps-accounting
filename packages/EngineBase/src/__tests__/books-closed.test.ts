/**
 * The books-closed-through rule (bc-aidp-next-golive#316).
 *
 * CONNECTS TO:
 *   TESTS: ../books-closed.ts, AccountingEngineBase.BooksClosedThroughFor
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import { AccountingEngineBase } from '../AccountingEngineBase.js';
import { ClosedBooksPostingDateProblem, FirstOpenDay, IsInClosedBooks } from '../books-closed.js';

describe('IsInClosedBooks', () => {
  it('treats the closed-through day and earlier as closed', () => {
    expect(IsInClosedBooks('2026-08-31', '2026-08-31')).toBe(true);
    expect(IsInClosedBooks('2026-08-01', '2026-08-31')).toBe(true);
    expect(IsInClosedBooks('2025-12-31', '2026-08-31')).toBe(true);
  });

  it('treats the next day and later as open', () => {
    expect(IsInClosedBooks('2026-09-01', '2026-08-31')).toBe(false);
    expect(IsInClosedBooks('2027-08-31', '2026-08-31')).toBe(false);
  });

  it('closes nothing when no date is set', () => {
    expect(IsInClosedBooks('2020-01-01', null)).toBe(false);
    expect(IsInClosedBooks('2020-01-01', undefined)).toBe(false);
    expect(IsInClosedBooks('2020-01-01', '')).toBe(false);
  });
});

describe('FirstOpenDay', () => {
  it('is the day after, across month and year ends', () => {
    expect(FirstOpenDay('2026-08-31')).toBe('2026-09-01');
    expect(FirstOpenDay('2026-12-31')).toBe('2027-01-01');
    expect(FirstOpenDay('2028-02-28')).toBe('2028-02-29');
    expect(FirstOpenDay('2026-09-15')).toBe('2026-09-16');
  });

  it('throws on a value that is not a calendar day', () => {
    expect(() => FirstOpenDay('8/31/2026')).toThrow(/not a YYYY-MM-DD/);
  });
});

describe('ClosedBooksPostingDateProblem', () => {
  it('refuses a posting date on or before the closed-through date and names the first open day', () => {
    const problem = ClosedBooksPostingDateProblem('2026-08-31', '2026-08-31');
    expect(problem).toContain('closed through 2026-08-31');
    expect(problem).toContain('2026-09-01 or later');
  });

  it('allows an open posting date, or any date when nothing is closed', () => {
    expect(ClosedBooksPostingDateProblem('2026-09-30', '2026-08-31')).toBeNull();
    expect(ClosedBooksPostingDateProblem('2026-08-31', null)).toBeNull();
  });
});

describe('AccountingEngineBase.BooksClosedThroughFor', () => {
  afterEach(() => vi.restoreAllMocks());

  const withProfiles = (profiles: Array<Partial<mjBizAppsAccountingAccountingCompanyProfileEntity>>): void => {
    vi.spyOn(AccountingEngineBase.Instance, 'CompanyProfiles', 'get')
      .mockReturnValue(profiles as mjBizAppsAccountingAccountingCompanyProfileEntity[]);
  };

  it("returns the company's date, matching the id in any case", () => {
    const closed = new Date('2026-08-31T00:00:00Z');
    withProfiles([{ ID: 'AAAAAAAA-0000-0000-0000-000000000001', BooksClosedThroughDate: closed }]);
    expect(AccountingEngineBase.Instance.BooksClosedThroughFor('aaaaaaaa-0000-0000-0000-000000000001')).toBe(closed);
  });

  it('returns null for a company with no profile, no date, or no id', () => {
    withProfiles([{ ID: 'AAAAAAAA-0000-0000-0000-000000000001', BooksClosedThroughDate: null }]);
    expect(AccountingEngineBase.Instance.BooksClosedThroughFor('AAAAAAAA-0000-0000-0000-000000000001')).toBeNull();
    expect(AccountingEngineBase.Instance.BooksClosedThroughFor('BBBBBBBB-0000-0000-0000-000000000002')).toBeNull();
    expect(AccountingEngineBase.Instance.BooksClosedThroughFor(null)).toBeNull();
  });
});
