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

/**
 * The later of two business dates, each a date-only value held as UTC midnight of its day (the
 * shape {@link todayBusiness} returns and a DATE column hydrates to). `other` is reduced to its
 * calendar day first — a raw-loaded value can arrive as an ISO string at runtime despite the Date
 * type — so the comparison is day against day, never instant against instant.
 */
export function laterBusinessDate(today: Date, other: Date | string): Date {
  const day = toDateOnly(other);
  return day.getTime() > today.getTime() ? day : today;
}

/** `value`'s calendar day as UTC midnight. Throws on a missing or unparseable value. */
function toDateOnly(value: Date | string): Date {
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  const d = value instanceof Date ? value : new Date(value);
  if (!value || Number.isNaN(d.getTime())) {
    throw new Error(`BusinessDay: invalid date-only value: ${String(value)}`);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
