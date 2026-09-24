/**
 * Time-window defaults for list screens (UI plan §0: "time-window defaults on every list").
 *
 * Pure + framework-free (the tier-1 boundary): given a window id and a "now", produce the date range
 * and the SQL predicate. Extracted so every list gets the SAME window semantics and so the
 * boundary/business-zone behaviour is unit-testable without a browser or a DB.
 *
 * **`today` is anchored on the BUSINESS day, not the UTC day.** The bound columns are `DATE`
 * (calendar days — global-constraints.md §1), and "today", "last 7 days", etc. are concepts the
 * business zone governs (global-constraints.md §2), not UTC or the browser's zone. Everything past
 * `today` is still built with `Date.UTC` / `toISOString()`, because a calendar day's boundary and
 * the UTC-midnight instant a `DATE` value round-trips as are the same shape once the DAY is chosen
 * correctly; only picking WHICH day is `today` needs the zone.
 *
 * This file lives under `transfer-pending/` and may not import `@mj-biz-apps/common-entities`
 * (enforced by `__tests__/transfer-pending-purity.test.ts` — parked code must not bind to a sibling
 * app package, extraction is meant to be a file move). So `zone` is always an explicit, caller-supplied
 * IANA name, and the instant-to-calendar-day conversion below is a small local reimplementation of
 * `@mj-biz-apps/common-entities`'s `CalendarDayIn`/`FromCalendarDay` — same technique (`Intl.DateTimeFormat`
 * with a `timeZone` option), same result, zero dependency on the accounting/bizapps-common packages.
 */

/** The windows every list offers. `all` means no date predicate at all. */
export type TimeWindowId = 'last7' | 'last30' | 'last90' | 'ytd' | 'last12m' | 'all';

export interface TimeWindowOption {
  Id: TimeWindowId;
  Label: string;
}

/** Presentation order for the window picker. */
export const TIME_WINDOWS: readonly TimeWindowOption[] = [
  { Id: 'last7', Label: 'Last 7 days' },
  { Id: 'last30', Label: 'Last 30 days' },
  { Id: 'last90', Label: 'Last 90 days' },
  { Id: 'ytd', Label: 'Year to date' },
  { Id: 'last12m', Label: 'Last 12 months' },
  { Id: 'all', Label: 'All time' },
] as const;

/** An inclusive-start / exclusive-end UTC range. `null` bounds mean unbounded. */
export interface TimeWindowRange {
  /** Inclusive lower bound (UTC midnight), or null for "all time". */
  From: Date | null;
  /** Exclusive upper bound (UTC midnight AFTER today), or null for "all time". */
  To: Date | null;
}

/** `UTC`, as a plain literal rather than an import from `@mj-biz-apps/common-entities` — see the file header. */
const UTC = 'UTC';

/**
 * One cached `Intl.DateTimeFormat` per zone — mirrors `@mj-biz-apps/common-entities`'s
 * `formatterFor` (`business-day.ts`), which this file cannot import (see the file header) but
 * whose technique it deliberately duplicates, cache included: constructing a formatter is not
 * free, and every window resolution for a given zone would otherwise pay for a fresh one.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(zone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(zone, formatter);
  }
  return formatter;
}

/**
 * The calendar day (`YYYY-MM-DD`) it is in `zone` at `instant`, read via `Intl.DateTimeFormat`'s
 * `timeZone` option — never local `Date` getters, which would answer for the RUNNER's zone instead.
 */
function calendarDayIn(instant: Date, zone: string): string {
  const parts = formatterFor(zone).formatToParts(instant);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** UTC midnight of a `YYYY-MM-DD` calendar day: the shape a `DATE` column round-trips as. */
function utcMidnightOf(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Resolve a window to its UTC range.
 *
 * The upper bound is **tomorrow's UTC midnight, exclusive** — not "now" — so rows stamped later
 * today are still inside "last 30 days". A `<= now` bound would hide entries booked minutes ago,
 * which reads as data loss to an accountant.
 *
 * @param now injected for testability; defaults to the current instant.
 * @param zone the BUSINESS zone `today` is judged in; defaults to UTC so every existing call site
 *   (and the pre-existing UTC-pinned tests) keeps its old behaviour unless it opts in.
 */
export function timeWindowRange(window: TimeWindowId, now: Date = new Date(), zone: string = UTC): TimeWindowRange {
  if (window === 'all') return { From: null, To: null };

  const today = utcMidnightOf(calendarDayIn(now, zone));
  const to = new Date(today.getTime() + DAY_MS); // exclusive: tomorrow 00:00 UTC

  switch (window) {
    case 'last7':
      return { From: new Date(today.getTime() - 6 * DAY_MS), To: to };
    case 'last30':
      return { From: new Date(today.getTime() - 29 * DAY_MS), To: to };
    case 'last90':
      return { From: new Date(today.getTime() - 89 * DAY_MS), To: to };
    case 'ytd':
      return { From: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)), To: to };
    case 'last12m':
      // Calendar-month arithmetic, not 365 days: Date.UTC normalises overflow, so 12 months back
      // from 29 Feb lands on 1 Mar of the prior year rather than an invalid date.
      return { From: new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate())), To: to };
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` in UTC — the form SQL Server compares safely against DATE/DATETIMEOFFSET. */
export function toSqlDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The window's contribution to a RunView ExtraFilter, or null when unbounded ('all').
 * Half-open [From, To) so a row can never fall in two adjacent windows.
 *
 * @param now the instant to judge `window` from; no default (see `zone`) — pass `new Date()`.
 * @param zone the BUSINESS zone `today` is judged in. Required, not defaulted: this file cannot
 *   import `BusinessTimeZoneEngine` (see the file header), so there is no live-zone default to
 *   fall back to, and a silent `'UTC'` default would let a caller believe it got the business-day
 *   fix for free when it did not. Pass `BusinessTimeZoneEngine.Instance.Zone` explicitly (from a
 *   caller in `lib/custom/shell/pages/` or similar, which CAN import it), or the literal `'UTC'`
 *   if UTC is genuinely what's wanted.
 */
export function timeWindowFilter(window: TimeWindowId, columnName: string, now: Date, zone: string): string | null {
  const { From, To } = timeWindowRange(window, now, zone);
  if (!From || !To) return null;
  return `${columnName} >= '${toSqlDate(From)}' AND ${columnName} < '${toSqlDate(To)}'`;
}

/** Compose any number of optional filter fragments into one ANDed ExtraFilter. */
export function andFilters(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => p?.trim())
    .filter((p): p is string => !!p && p.length > 0)
    .map((p) => `(${p})`)
    .join(' AND ');
}
