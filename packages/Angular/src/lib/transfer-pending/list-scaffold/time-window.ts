/**
 * Time-window defaults for list screens (UI plan §0: "time-window defaults on every list").
 *
 * Pure + framework-free (the tier-1 boundary): given a window id and a "now", produce the date range
 * and the SQL predicate. Extracted so every list gets the SAME window semantics and so the
 * boundary/UTC behaviour is unit-testable without a browser or a DB.
 *
 * **UTC throughout** — this app stores every timestamp in UTC (repo CLAUDE.md convention). We build
 * range bounds with `Date.UTC` and format with `toISOString()`; local-time getters are never used,
 * because they'd shift the window by the runner's offset and quietly include/exclude edge rows.
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

/** UTC midnight at the start of `d`'s day. */
function utcStartOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Resolve a window to its UTC range.
 *
 * The upper bound is **tomorrow's UTC midnight, exclusive** — not "now" — so rows stamped later
 * today are still inside "last 30 days". A `<= now` bound would hide entries booked minutes ago,
 * which reads as data loss to an accountant.
 *
 * @param now injected for testability; defaults to the current instant.
 */
export function timeWindowRange(window: TimeWindowId, now: Date = new Date()): TimeWindowRange {
  if (window === 'all') return { From: null, To: null };

  const today = utcStartOfDay(now);
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
 */
export function timeWindowFilter(window: TimeWindowId, columnName: string, now: Date = new Date()): string | null {
  const { From, To } = timeWindowRange(window, now);
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
