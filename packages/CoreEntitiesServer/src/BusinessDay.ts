/**
 * Today's BUSINESS day for server-side date-only stamps (JournalEntryBatch.PostingDate,
 * JournalEntry.EffectiveDate on a generated reversal). `new Date()` is an instant; stored in a
 * DATE column it becomes whatever calendar day the server process's zone is on, which near
 * midnight differs from the business day and can move an entry into the wrong month or period.
 */
import { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

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
