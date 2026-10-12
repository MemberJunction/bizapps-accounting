/**
 * The fiscal-year rule, shared by journal-entry numbering (server) and any figure that reports
 * "this fiscal year" (browser). Pure: no engine, no clock, no zone.
 *
 * A fiscal year is labeled by the calendar year it STARTS in. For the default 1 January start this
 * equals the calendar year. A day falls in the previous fiscal year when its (month, day) is before
 * the start's (month, day).
 */

/** A company's fiscal-year start, as `AccountingCompanyProfile.FiscalYearStartMonth` / `...Day`. */
export interface FiscalYearStart {
  Month: number;
  Day: number;
}

/** The start used when a company has no profile: 1 January. */
export const DEFAULT_FISCAL_YEAR_START: Readonly<FiscalYearStart> = Object.freeze({ Month: 1, Day: 1 });

/** The fiscal year containing a calendar day (`YYYY-MM-DD`). */
export function FiscalYearOf(day: string, start: FiscalYearStart): number {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(dayOfMonth)) {
    throw new Error(`FiscalYearOf: '${day}' is not a YYYY-MM-DD calendar day`);
  }
  const beforeStart = month < start.Month || (month === start.Month && dayOfMonth < start.Day);
  return beforeStart ? year - 1 : year;
}

/**
 * True when `day` falls between the first day of `today`'s fiscal year and `today`, inclusive.
 * Both are fixed-width `YYYY-MM-DD` days, which compare lexically in chronological order.
 */
export function IsInFiscalYearToDate(day: string, today: string, start: FiscalYearStart): boolean {
  return day <= today && FiscalYearOf(day, start) === FiscalYearOf(today, start);
}
