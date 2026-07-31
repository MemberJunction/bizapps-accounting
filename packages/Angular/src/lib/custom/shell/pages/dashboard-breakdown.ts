/**
 * The composition ("breakdown") card view model shared by the two accounting category dashboards.
 *
 * ── WHY THIS EXISTS, AND WHY IT COSTS NOTHING ──────────────────────────────────────────────────
 * The dashboards were fair criticism: a row of counters does not tell you how the ledger is
 * SHAPED. But §0 (see AccountingDashboardBase) rules out on-demand heavy aggregates, so the
 * obvious fix — SUM/GROUP BY over the ledger — is not available.
 *
 * A breakdown card sidesteps that entirely: it is derived **purely client-side from counts the page
 * has ALREADY fetched**. Pending / Batched / GLPosted are each a `MaxRows: 1` + `TotalRowCount`
 * read the page runs regardless; stacking those three numbers into one proportional bar adds
 * **zero** queries and zero rows transferred, and turns "three numbers" into "here is the shape of
 * the pipeline". That is materially more content at literally no read cost — which is exactly the
 * kind of content §0 wants us to prefer.
 *
 * The rule to keep: a segment's `Value` must come from a count the page already had. The moment a
 * breakdown needs its OWN query, it stops being free and belongs in a precompute instead.
 */

/**
 * A segment's accent. Mirrors the Credentials dashboard's `icon-wrapper` colour set
 * (blue/green/amber/red) so an accent means the same thing on every MJ dashboard, and maps 1:1 onto
 * the `--mj-status-*` / `--mj-brand-primary` tokens — never onto a literal colour.
 */
export type DashboardTone = 'brand' | 'success' | 'warning' | 'error' | 'info';

/** One slice of a breakdown bar (and one row of its legend). */
export interface DashboardBreakdownSegment {
  Id: string;
  Label: string;
  /**
   * The count. MUST be sourced from a count the page already ran — see the note above; a segment
   * that needs its own read defeats the entire point of this card.
   */
  Value: number;
  Tone: DashboardTone;
  /** Says what this slice MEANS, not just what it counts. Rendered as the legend row's tooltip. */
  Tooltip: string;
}

/** A composition card: a proportional bar, then a legend naming every slice. */
export interface DashboardBreakdown {
  Id: string;
  Title: string;
  Icon: string;
  /** One line under the title saying what population the bar covers (e.g. "every entry in scope"). */
  Caption: string;
  Segments: DashboardBreakdownSegment[];
  /** Shown when every segment is zero — an empty ledger is a real state, not an error. */
  EmptyMessage: string;
}

/** The denominator. Zero is a legitimate answer (nothing in scope), so callers must guard on it. */
export function BreakdownTotal(b: DashboardBreakdown): number {
  return b.Segments.reduce((sum, s) => sum + s.Value, 0);
}

/**
 * A segment's share of the bar, 0–100.
 *
 * Returns 0 — never NaN — when the total is zero. A `0/0` would render as `width: NaN%`, which the
 * browser drops silently, leaving a bar that looks full rather than empty: a wrong answer that
 * looks like a right one.
 */
export function BreakdownPercent(b: DashboardBreakdown, s: DashboardBreakdownSegment): number {
  const total = BreakdownTotal(b);
  return total === 0 ? 0 : (s.Value / total) * 100;
}
