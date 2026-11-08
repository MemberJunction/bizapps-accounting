import { AccountingEngineBase, ClosedBooksPostingDateProblem } from '@mj-biz-apps/accounting-engine-base';
import { IsCalendarDay, ToCalendarDay } from '@mj-biz-apps/common-entities';

/**
 * The "are you sure?" text for a batch posting date outside today's month, or null (golive #315).
 * The ERP books the whole batch in the posting date's month, so a prior or future month is allowed
 * but must be confirmed. Days are `YYYY-MM-DD` business days; an unreadable date gets no warning
 * (the screen already blocks the build for it).
 */
export function PostingDateMonthWarning(postingDate: string | null | undefined, today: string): string | null {
  if (!postingDate || !IsCalendarDay(postingDate) || !IsCalendarDay(today)) return null;
  const postingMonth = postingDate.slice(0, 7);
  const todayMonth = today.slice(0, 7);
  if (postingMonth === todayMonth) return null;
  const which = postingMonth < todayMonth ? 'a prior' : 'a future';
  return `The posting date ${postingDate} is in ${which} month, so the ERP books this batch in ${PostingMonthLabel(postingDate)}. Are you sure?`;
}

/** `2026-09-30` → `September 2026`. */
export function PostingMonthLabel(day: string): string {
  return new Date(`${day.slice(0, 7)}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Why a batch cannot post on `postingDate` for one of `companyIds`, or null (golive #316): the date is
 * on or before a company's BooksClosedThroughDate, read from the accounting engine's profiles. The
 * build refuses the same case on the server; checking here says so before the click. A company whose
 * profile the engine has not loaded closes nothing here, and the server still refuses.
 */
export function ClosedBooksProblem(postingDate: string | null | undefined, companyIds: Iterable<string>): string | null {
  if (!postingDate || !IsCalendarDay(postingDate)) return null;
  for (const id of new Set(companyIds)) {
    const closedThrough = ToCalendarDay(AccountingEngineBase.Instance.BooksClosedThroughFor(id));
    const problem = ClosedBooksPostingDateProblem(postingDate, closedThrough);
    if (problem) return problem;
  }
  return null;
}
