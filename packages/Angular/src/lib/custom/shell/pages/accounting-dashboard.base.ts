import { Directive, ChangeDetectorRef, EventEmitter, Output, inject } from '@angular/core';
import { RunView, RunViewParams } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';

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

  public Stats: DashboardStat[] = [];
  /** The list cards rendered under the stats. Empty while loading. */
  public Lists: DashboardList[] = [];
  public IsLoading = false;
  public LoadError: string | null = null;

  /**
   * The primary create button's label — "New journal entry", "New batch", "New order", … Each page
   * sets it for ITS section; the shared template renders one button from it.
   */
  public CreateLabel = '';

  /**
   * Emitted when the user asks to create a new record of this section's kind.
   *
   * **The page does NOT navigate itself, by design.** An Explorer resource is not a routed
   * component — which page is showing is shell state, and MJ forbids importing the Router into a
   * Generic-layer component. So the dashboard states the INTENT and the shell that hosts it decides
   * what "create" means (open a form, switch pages, pop a panel). **Every shell mounting one of
   * these dashboards must bind `(CreateRequested)` or the button will do nothing.**
   */
  @Output() CreateRequested = new EventEmitter<void>();

  /** Template hook for the create button. Emits the intent — see CreateRequested. */
  public RequestCreate(): void {
    this.CreateRequested.emit();
  }

  /** Count-only read: MaxRows 1 keeps the transfer to one row; TotalRowCount is the answer. */
  protected async count(params: Omit<RunViewParams, 'MaxRows' | 'ResultType'>): Promise<number> {
    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const res = await rv.RunView(
      { ...params, Fields: ['ID'], MaxRows: 1, ResultType: 'simple' },
      this.ProviderToUse.CurrentUser,
    );
    if (!res.Success) throw new Error(res.ErrorMessage ?? 'count failed');
    return res.TotalRowCount ?? 0;
  }

  /** First day of the current month, UTC — this app stores UTC (repo convention). */
  protected monthStartUTC(): string {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  }

  public StatValue(s: DashboardStat): string {
    return s.Value === null ? '—' : String(s.Value);
  }
}
