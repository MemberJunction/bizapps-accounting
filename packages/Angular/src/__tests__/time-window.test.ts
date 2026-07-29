import { describe, it, expect } from 'vitest';
import {
  timeWindowRange,
  timeWindowFilter,
  toSqlDate,
  andFilters,
  TIME_WINDOWS,
  TimeWindowId,
} from '../lib/transfer-pending/list-scaffold/time-window';

/**
 * TIER 1 — the list time-window seam (UI plan §0).
 *
 * `now` is injected everywhere, so these assert EXACT dates rather than drift-prone relative ones.
 * The UTC boundary cases are the point: this app stores UTC, and a local-time slip would silently
 * shift every list window by the runner's offset.
 */

/** A deliberately awkward instant: late-evening UTC, mid-year, so a local-time bug would show. */
const NOW = new Date('2026-07-16T23:30:00.000Z');

describe('timeWindowRange', () => {
  it('returns an unbounded range for "all"', () => {
    expect(timeWindowRange('all', NOW)).toEqual({ From: null, To: null });
  });

  it('ends at TOMORROW UTC midnight (exclusive), so rows booked later today still count', () => {
    // The bug this pins: a `<= now` bound would exclude an entry stamped 23:45 today.
    const { To } = timeWindowRange('last30', NOW);
    expect(To?.toISOString()).toBe('2026-07-17T00:00:00.000Z');
  });

  it('last7 spans 7 calendar days INCLUDING today', () => {
    const { From, To } = timeWindowRange('last7', NOW);
    expect(From?.toISOString()).toBe('2026-07-10T00:00:00.000Z');
    expect(To?.toISOString()).toBe('2026-07-17T00:00:00.000Z');

    const days = (To!.getTime() - From!.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(7);
  });

  it('last30 spans 30 calendar days including today', () => {
    const { From, To } = timeWindowRange('last30', NOW);
    expect(From?.toISOString()).toBe('2026-06-17T00:00:00.000Z');
    const days = (To!.getTime() - From!.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(30);
  });

  it('last90 spans 90 calendar days including today', () => {
    const { From, To } = timeWindowRange('last90', NOW);
    const days = (To!.getTime() - From!.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(90);
    expect(From?.toISOString()).toBe('2026-04-18T00:00:00.000Z');
  });

  it('ytd starts at 1 January UTC of the current year', () => {
    const { From } = timeWindowRange('ytd', NOW);
    expect(From?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('last12m goes back a calendar year, not 365 days', () => {
    const { From } = timeWindowRange('last12m', NOW);
    expect(From?.toISOString()).toBe('2025-07-16T00:00:00.000Z');
  });

  describe('UTC boundary behaviour', () => {
    it('uses the UTC day even when the instant is late-evening UTC', () => {
      // 23:30Z on the 16th is already the 17th in +01:00 and still the 16th in UTC.
      // Reading local date parts here would move the whole window a day.
      const { To } = timeWindowRange('last7', new Date('2026-07-16T23:59:59.999Z'));
      expect(To?.toISOString()).toBe('2026-07-17T00:00:00.000Z');
    });

    it('uses the UTC day at exactly midnight UTC', () => {
      const { From, To } = timeWindowRange('last7', new Date('2026-07-16T00:00:00.000Z'));
      expect(From?.toISOString()).toBe('2026-07-10T00:00:00.000Z');
      expect(To?.toISOString()).toBe('2026-07-17T00:00:00.000Z');
    });

    it('handles a leap day without producing an invalid date', () => {
      const { From } = timeWindowRange('last12m', new Date('2024-02-29T12:00:00.000Z'));
      // Date.UTC normalises 2023-02-29 (nonexistent) to 2023-03-01 rather than NaN.
      expect(Number.isNaN(From!.getTime())).toBe(false);
      expect(From?.toISOString()).toBe('2023-03-01T00:00:00.000Z');
    });

    it('crosses a year boundary correctly for ytd on 1 January', () => {
      const { From, To } = timeWindowRange('ytd', new Date('2026-01-01T08:00:00.000Z'));
      expect(From?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(To?.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    });
  });
});

describe('toSqlDate', () => {
  it('formats UTC YYYY-MM-DD', () => {
    expect(toSqlDate(new Date('2026-07-16T23:30:00.000Z'))).toBe('2026-07-16');
  });
});

describe('timeWindowFilter', () => {
  it('is null for "all" (no date predicate at all)', () => {
    expect(timeWindowFilter('all', 'EffectiveDate', NOW)).toBeNull();
  });

  it('emits a half-open [From, To) predicate on the given column', () => {
    expect(timeWindowFilter('last7', 'EffectiveDate', NOW)).toBe(
      "EffectiveDate >= '2026-07-10' AND EffectiveDate < '2026-07-17'",
    );
  });

  it('half-open bounds mean a row cannot fall into two adjacent windows', () => {
    // The `To` of a window is the `From` of the next day's window — exclusive on one side only.
    const f = timeWindowFilter('last30', 'EffectiveDate', NOW)!;
    expect(f).toContain("< '2026-07-17'");
    expect(f).not.toContain("<= '2026-07-17'");
  });

  it('every offered window produces a filter (or null for all) — no unhandled ids', () => {
    for (const w of TIME_WINDOWS) {
      const result = timeWindowFilter(w.Id as TimeWindowId, 'EffectiveDate', NOW);
      if (w.Id === 'all') expect(result).toBeNull();
      else expect(result).toBeTruthy();
    }
  });
});

describe('andFilters', () => {
  it('returns an empty string when everything is empty', () => {
    expect(andFilters(null, undefined, '', '   ')).toBe('');
  });

  it('returns a single parenthesised fragment', () => {
    expect(andFilters("Status='Pending'")).toBe("(Status='Pending')");
  });

  it('ANDs and parenthesises each fragment so OR-containing fragments cannot leak', () => {
    // Without the parens, "A OR B" AND "C" would bind as "A OR (B AND C)" — a real correctness bug.
    expect(andFilters("Status='A' OR Status='B'", "CompanyID='x'")).toBe(
      "(Status='A' OR Status='B') AND (CompanyID='x')",
    );
  });

  it('skips null/empty fragments while keeping the rest', () => {
    expect(andFilters(null, "A=1", undefined, '', "B=2")).toBe('(A=1) AND (B=2)');
  });
});
