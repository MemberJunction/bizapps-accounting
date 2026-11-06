import { Directive, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { combineLatest } from 'rxjs';
import { distinctUntilChanged, skip } from 'rxjs/operators';
import { RunView, RunViewParams } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { FormatWindow, PeriodPhrase, PeriodSqlFilter, SameIDs, type PeriodWindow } from '@mj-biz-apps/common-ng';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { DashboardPeriodService } from '../../shared/dashboard-period.service';

/** One stat card. `Value` is null while loading so the card can show a placeholder, not a wrong 0. */
export interface DashboardStat {
  Id: string;
  Label: string;
  Value: number | null;
  Icon: string;
  /** Rendered as the card's tooltip — says what the number MEANS, not just what it counts. */
  Tooltip: string;
  /** Optional: which rail page this card drills into. */
  GoTo?: string;
  Warn?: boolean;
}

/** One row inside a dashboard list card. Shaped for DISPLAY — the page maps its entity rows to this. */
export interface DashboardListItem {
  Id: string;
  /** The identifying label — an entry number / batch number. */
  Title: string;
  /** One line of supporting detail under the title (description, target system, …). */
  Detail: string;
  /** Short status text, rendered as a pill. */
  Status: string;
  /** The timestamp shown on the right. */
  When: Date | string | null;
  /**
   * True when `When` came from a DATE column (no timezone). The template must then render it with the
   * explicit 'UTC' arg — without it Angular applies the browser zone and every user west of UTC sees
   * the PREVIOUS day. An instant (DATETIMEOFFSET) must NOT set this: local rendering is correct there.
   */
  WhenIsDateOnly: boolean;
  /** Marks a row that needs attention (mirrors DashboardStat.Warn). */
  Warn?: boolean;
}

/** A card holding a short list. Small by construction — see the §0 note on the base class. */
export interface DashboardList {
  Id: string;
  Title: string;
  Icon: string;
  /** Shown instead of rows when the list is empty. An empty inbox is good news — say so, don't say "no data". */
  EmptyMessage: string;
  Items: DashboardListItem[];
  /**
   * The header count. NOT `Items.length`: the lists are capped at DASHBOARD_LIST_ROWS (§0 — small
   * lists only), so a card showing 5 of 40 must say 40. Source it from the authoritative COUNT the
   * page already ran; `null` renders "—" rather than a fabricated 0 when the count could not be had.
   */
  Count: number | null;
}

/** How many rows a dashboard list card shows. Small enough that these stay cheap reads (§0). */
export const DASHBOARD_LIST_ROWS = 5;

/**
 * Shared machinery for the two category dashboards (UI plan §8.6 step 6).
 *
 * The §0 ruling is the whole design constraint here: **no on-demand heavy aggregates**. Anything
 * expensive (an entries-per-day trend) is precomputed on a schedule or does not ship. So every stat
 * on these dashboards is a **filtered COUNT** — `MaxRows: 1` + `TotalRowCount`, which asks SQL for a
 * count and transfers one row. That is cheap enough to run on every dashboard open, which is why
 * these can be plain reads with no caching layer.
 *
 * The same rule governs the LIST cards: a `MaxRows: 5` top-N over an indexed sort column is a cheap
 * read, so "recent entries" and "awaiting approval" are fine. A list that needed a per-row total
 * would not be — it would mean summing lines under every row.
 *
 * If you are tempted to add a stat that needs summing or grouping over the ledger: it belongs in a
 * scheduled precompute or a read model, not here.
 */
@Directive()
export abstract class AccountingDashboardBase extends BaseAngularComponent {
  protected cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  /** App-wide company scope: the rail chip and the filter bar's company picker. */
  public Scope = inject(CompanyScopeService);
  /** The filter bar's period, shared by every accounting dashboard. */
  public Periods = inject(DashboardPeriodService);
  private loadSeq = 0;

  public Stats: DashboardStat[] = [];
  /** The list cards rendered under the stats. Empty while loading. */
  public Lists: DashboardList[] = [];
  public IsLoading = false;
  public LoadError: string | null = null;

  // The old CreateLabel/CreateRequested header-card machinery was removed:
  // the section's create verb lives in the CATEGORY header now, so the dashboards ship no
  // duplicate create button and no header-interior card at all.

  /** Count-only read: MaxRows 1 keeps the transfer to one row; TotalRowCount is the answer. */
  protected async count(params: Omit<RunViewParams, 'MaxRows' | 'ResultType'>): Promise<number> {
    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const res = await rv.RunView(
      { ...params, Fields: ['ID'], MaxRows: 1, ResultType: 'simple' },
      this.ProviderToUse.CurrentUser,
    );
    if (!res.Success) throw new Error(res.ErrorMessage ?? 'Could not load the dashboard totals. Refresh the page to try again.');
    return res.TotalRowCount ?? 0;
  }

  /** The selected period's bounds for the companies in scope. Arithmetic, so recomputed per read. */
  protected get window(): PeriodWindow {
    return this.Periods.WindowFor(this.Scope.SelectedIDs);
  }

  /** The period in a sentence for a tooltip or caption: "this quarter", "all time", or the dates. */
  protected get periodPhrase(): string {
    return PeriodPhrase(this.window);
  }

  /** "Jul 1, 2026 – Sep 30, 2026", or "all time": the bounds a period tooltip states. */
  protected get windowText(): string {
    return FormatWindow(this.window);
  }

  /** The period's clause over a DATE column, or null for all time. Inclusive, ISO dates. */
  protected periodFilter(column: string): string | null {
    return PeriodSqlFilter(column, this.window);
  }

  /** The clauses that are present, ANDed (each parenthesised when there are two or more). Null when none. */
  protected allOf(...clauses: (string | null | undefined)[]): string | null {
    const parts = clauses.filter((c): c is string => !!c && c.trim().length > 0);
    if (parts.length <= 1) return parts[0] ?? null;
    return parts.map((c) => `(${c})`).join(' AND ');
  }

  /**
   * Calls `reload` whenever the company scope or the period changes after the page opened, from the
   * filter bar or from the rail chip. The first emission is the state the page already loaded with.
   */
  protected reloadOnFilterChange(reload: () => void): void {
    const sub = combineLatest([this.Scope.SelectedIDs$.pipe(distinctUntilChanged(SameIDs)), this.Periods.State$])
      .pipe(skip(1))
      .subscribe(() => reload());
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  /**
   * Starts a load and returns a check that is true only while it is the latest one, so a slow read
   * from before a filter change cannot overwrite the figures for the new filters.
   */
  protected beginLoad(): () => boolean {
    const seq = ++this.loadSeq;
    return () => seq === this.loadSeq;
  }

  public StatValue(s: DashboardStat): string {
    return s.Value === null ? '—' : String(s.Value);
  }
}
