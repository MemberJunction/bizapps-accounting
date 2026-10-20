/**
 * The books-closed-through rule (bc-aidp-next-golive#316), shared by the batch build (server), the
 * batch screens (browser) and the apps that date entries into the ledger. Pure: no engine, no clock,
 * no zone.
 *
 * `AccountingCompanyProfile.BooksClosedThroughDate` is the last day of the latest month finance has
 * closed for a company. A day on or before it is in a closed month; NULL means nothing is closed.
 * Days are fixed-width `YYYY-MM-DD` calendar days, which compare lexically in chronological order.
 */

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when `day` is on or before `closedThrough`. A missing `closedThrough` closes nothing. */
export function IsInClosedBooks(day: string, closedThrough: string | null | undefined): boolean {
  return !!closedThrough && day <= closedThrough;
}

/** The first day finance has not closed: the day after `closedThrough`. */
export function FirstOpenDay(closedThrough: string): string {
  const m = CALENDAR_DAY.exec(closedThrough);
  if (!m) throw new Error(`FirstOpenDay: '${closedThrough}' is not a YYYY-MM-DD calendar day`);
  const next = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return next.toISOString().slice(0, 10);
}

/**
 * Why a batch cannot post on `postingDate`, or null when the day is open. The ERP would refuse it
 * after the batch was sent, so the build refuses it first.
 */
export function ClosedBooksPostingDateProblem(postingDate: string, closedThrough: string | null | undefined): string | null {
  if (!closedThrough || !IsInClosedBooks(postingDate, closedThrough)) return null;
  return `The posting date ${postingDate} is in a month finance has closed: the books are closed through ${closedThrough}. ` +
    `Choose ${FirstOpenDay(closedThrough)} or later, or ask finance to reopen the month.`;
}
