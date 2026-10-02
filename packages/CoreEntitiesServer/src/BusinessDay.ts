/**
 * Today's BUSINESS day for server-side date-only stamps (JournalEntryBatch.PostingDate,
 * JournalEntry.EffectiveDate on a generated reversal). `new Date()` is an instant; stored in a
 * DATE column it becomes whatever calendar day the server process's zone is on, which near
 * midnight differs from the business day and can move an entry into the wrong month or period.
 */
import { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { BusinessTimeZoneEngine, CalendarDayIn, type CalendarDay } from '@mj-biz-apps/common-entities';

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
