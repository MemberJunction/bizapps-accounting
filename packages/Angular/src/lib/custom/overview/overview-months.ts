import { AddDays, FirstDayOfMonth, ToCalendarDay } from '@mj-biz-apps/common-entities';

/** One bar of the Overview's monthly volume chart: a calendar month, clipped to the period. */
export interface ChartMonth {
  /** `YYYY-MM`. */
  Period: string;
  /** Inclusive `YYYY-MM-DD` bounds: the month, or the part of it inside the period. */
  Start: string;
  End: string;
}

/** The most months the chart draws. A longer period shows its latest months and says so. */
export const MAX_CHART_MONTHS = 24;

function lastDayOfMonth(day: string): string {
  const [y, m] = day.split('-').map(Number);
  // Day 0 of the next month is the last day of this one, read from its UTC parts.
  return ToCalendarDay(new Date(Date.UTC(y, m, 0))) ?? day;
}

/**
 * The calendar months from `start` to `end` (inclusive `YYYY-MM-DD`), the first and last clipped to
 * those days, keeping only the latest `max`. Empty when `end` is before `start`.
 *
 * Pure. The Overview reads one count per month for these, so the chart follows the period exactly
 * instead of bucketing a capped sample of entries.
 */
export function MonthsBetween(start: string, end: string, max: number = MAX_CHART_MONTHS): ChartMonth[] {
  if (end < start) return [];
  const months: ChartMonth[] = [];
  let monthStart = FirstDayOfMonth(start);
  while (monthStart <= end) {
    const monthEnd = lastDayOfMonth(monthStart);
    months.push({
      Period: monthStart.slice(0, 7),
      Start: monthStart < start ? start : monthStart,
      End: monthEnd > end ? end : monthEnd,
    });
    monthStart = AddDays(monthEnd, 1);
  }
  return months.slice(-Math.max(max, 1));
}

/** "Sep '26" for `2026-09`. */
export function MonthBarLabel(period: string): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m] = period.split('-');
  return `${names[Number(m) - 1]} '${y.slice(2)}`;
}
