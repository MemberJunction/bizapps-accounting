/**
 * Today's BUSINESS day for server-side date-only stamps (JournalEntryBatch.PostingDate,
 * JournalEntry.EffectiveDate on a generated reversal). `new Date()` is an instant; stored in a
 * DATE column it becomes whatever calendar day the server process's zone is on, which near
 * midnight differs from the business day and can move an entry into the wrong month or period.
 */
import { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { BusinessTimeZoneEngine, CalendarDayIn, IsBeforeDay, IsCalendarDay, type CalendarDay } from '@mj-biz-apps/common-entities';

/**
 * Today as a date-only value in the business zone, UTC midnight of that day. Assumes
 * `BusinessTimeZoneEngine` is already configured; use {@link loadTodayBusiness} when it may not be.
 * Sync and provider-free so the business-day-semantics tests can call it directly.
 */
export function todayBusiness(companyID?: string): Date {
  return BusinessTimeZoneEngine.Instance.TodayAsDate(companyID);
}

/** Configures `BusinessTimeZoneEngine` (a no-op once loaded), then returns {@link todayBusiness}. */
export async function loadTodayBusiness(contextUser: UserInfo, provider: IMetadataProvider, companyID?: string): Promise<Date> {
  await BusinessTimeZoneEngine.Instance.Config(false, contextUser, provider);
  return todayBusiness(companyID);
}

/**
 * The BUSINESS day an instant falls on — e.g. a batch cutoff an API or Action caller sends as a
 * datetime (the batch workspace sends a plain YYYY-MM-DD day and never reaches this).
 * Compared against a DATE column, the instant itself would be read as its UTC day, which from
 * ~7 PM Central onward is already tomorrow. Configures `BusinessTimeZoneEngine` first (a no-op once
 * loaded); `companyID` picks that company's zone once the engine carries one (today it is the
 * app-wide `BizApps.BusinessTimeZone`).
 */
export async function loadBusinessDayOf(instant: Date, contextUser: UserInfo, provider: IMetadataProvider, companyID?: string): Promise<CalendarDay> {
  await BusinessTimeZoneEngine.Instance.Config(false, contextUser, provider);
  return CalendarDayIn(instant, BusinessTimeZoneEngine.Instance.Resolve(companyID));
}

/**
 * A caller-supplied date bound (a batch cutoff or start date): a calendar day written `YYYY-MM-DD`,
 * an ISO date-time WITH an explicit offset, or a `Date`. The SHAPE decides what it means — see
 * {@link loadBoundDay}.
 */
export type DateBound = Date | string;

/** `YYYY-MM-DDTHH:mm[:ss[.fff]]` followed by `Z` or `±HH:mm`. A zone-less date-time is refused:
 *  `new Date()` would read it in the server process's zone, which is nobody's business day. */
const ISO_INSTANT = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Validates a date bound from a remote caller and returns it unchanged — the date counterpart of
 * `requireSqlGuid`, for operation and Action boundaries. Refuses anything that is not a real calendar
 * day or a real instant: `new Date('garbage')` would throw a bare `RangeError` deep in the engine, and
 * `new Date('2026-02-30')` silently rolls over to 2 March.
 */
export function requireDateBound<T extends DateBound>(value: T, context: string): T {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`${context}: not a valid date.`);
    return value;
  }
  if (typeof value === 'string') {
    const text: string = value;
    const datePart = text.slice(0, 10);
    if (IsCalendarDay(text)) return value;
    const instant = ISO_INSTANT.exec(text);
    if (instant && IsCalendarDay(instant[1]) && !Number.isNaN(new Date(text).getTime())) return value;
    if (/^\d{4}-\d{2}-\d{2}/.test(text) && !IsCalendarDay(datePart)) {
      throw new Error(`${context}: '${text}' is not a real calendar day.`);
    }
  }
  throw new Error(
    `${context}: '${String(value)}' is not a calendar day (YYYY-MM-DD) or an ISO date-time with an offset (e.g. 2026-09-30T19:00:00-05:00).`,
  );
}

/**
 * The calendar day a date bound names. EffectiveDate is a DATE column, so a bound is always a day.
 *   - A `YYYY-MM-DD` string IS that day. No zone is involved.
 *   - A date-time string is an instant: the BUSINESS day it falls on. `2026-09-30T19:00:00-05:00` is
 *     30 September in Chicago, although its UTC day is already 1 October.
 *   - A `Date` at exactly UTC midnight is read as a day — that is the shape `FromCalendarDay` and the
 *     DATE-column driver produce, and how in-process callers (`resolveCutoff`) hand one over. Any other
 *     `Date` is an instant, resolved like a date-time string. An instant that happens to sit on UTC
 *     midnight (7 PM Central) is therefore read as the following day; send a string to avoid that.
 * Configures `BusinessTimeZoneEngine` only when an instant needs the zone.
 */
export async function loadBoundDay(
  bound: DateBound, context: string, contextUser: UserInfo, provider: IMetadataProvider, companyID?: string,
): Promise<CalendarDay> {
  requireDateBound(bound, context);
  if (typeof bound === 'string') {
    return IsCalendarDay(bound) ? bound : loadBusinessDayOf(new Date(bound), contextUser, provider, companyID);
  }
  if (isUtcMidnight(bound)) return bound.toISOString().slice(0, 10);
  return loadBusinessDayOf(bound, contextUser, provider, companyID);
}

/**
 * A batch's PostingDate — the journal date the ERP receives — as a calendar day: the day the caller
 * asked for, read by the same shape rules as a cutoff ({@link loadBoundDay}), or today's business day
 * when it asked for none (golive #315). A future day is refused: the ERP would book the batch in a
 * period that has not happened yet.
 */
export async function loadPostingDay(
  postingDate: DateBound | null | undefined, contextUser: UserInfo, provider: IMetadataProvider, companyID?: string,
): Promise<CalendarDay> {
  await BusinessTimeZoneEngine.Instance.Config(false, contextUser, provider);
  const today = BusinessTimeZoneEngine.Instance.Today(companyID);
  if (!postingDate) return today;
  const day = await loadBoundDay(postingDate, 'Batch PostingDate', contextUser, provider, companyID);
  if (IsBeforeDay(today, day)) {
    throw new Error(`Batch PostingDate ${day} is in the future (today is ${today}). Choose today or an earlier day.`);
  }
  return day;
}

const isUtcMidnight = (d: Date): boolean =>
  d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
