import { IsCalendarDay } from '@mj-biz-apps/common-entities';

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
