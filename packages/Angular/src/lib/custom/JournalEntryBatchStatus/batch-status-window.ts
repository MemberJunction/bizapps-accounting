import { AddDays, BusinessTimeZoneEngine, CalendarDay } from '@mj-biz-apps/common-entities';

/**
 * The moving-window presets on the Batch Status dashboard's date-span filter
 * (`journal-entry-batch-status-dashboard.component.ts`'s `ApplyWindow`).
 */
export type BatchStatusWindow = 'today' | '7d' | '30d';

export interface BatchStatusWindowRange {
    FromDate: CalendarDay;
    ToDate: CalendarDay;
}

/**
 * The `[FromDate, ToDate]` calendar-day span for a moving-window preset ("Today" / "7 days" /
 * "30 days"), anchored on the BUSINESS day (`BusinessTimeZoneEngine.Instance.Today()`) — never
 * `new Date()`'s local getters, which answer for the BROWSER's zone instead.
 *
 * `FromDate`/`ToDate` feed a native `<input type="date">` directly and the span filter
 * (`inSpan` in the dashboard component) parses them back as UTC-midnight bounds, so a
 * `CalendarDay` (`YYYY-MM-DD`) round-trips cleanly through both ends with no separate
 * `toDateInput`/local-getter formatting step.
 *
 * This component lives under `lib/custom/JournalEntryBatchStatus/`, not `lib/transfer-pending/`,
 * so the parking-discipline guard (`__tests__/transfer-pending-purity.test.ts`) does not restrict
 * it, and it may import `@mj-biz-apps/common-entities` directly — the same footing the three
 * "last N days" list pages (`dispatch-status.page.ts`, `all-batches.page.ts`,
 * `all-journal-entries.page.ts`) were put on in the prior fix round.
 */
export function resolveBatchStatusWindow(win: BatchStatusWindow): BatchStatusWindowRange {
    const today = BusinessTimeZoneEngine.Instance.Today();
    const from = win === '7d' ? AddDays(today, -6) : win === '30d' ? AddDays(today, -29) : today;
    return { FromDate: from, ToDate: today };
}
