import { Directive, ChangeDetectorRef, inject } from '@angular/core';
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

/**
 * Shared machinery for the two category dashboards (UI plan §8.6 step 6).
 *
 * The §0 ruling is the whole design constraint here: **no on-demand heavy aggregates**. Anything
 * expensive (an entries-per-day trend) is precomputed on a schedule or does not ship. So every stat
 * on these dashboards is a **filtered COUNT** — `MaxRows: 1` + `TotalRowCount`, which asks SQL for a
 * count and transfers one row. That is cheap enough to run on every dashboard open, which is why
 * these can be plain reads with no caching layer.
 *
 * If you are tempted to add a stat that needs summing or grouping over the ledger: it belongs in a
 * scheduled precompute or a read model, not here.
 */
@Directive()
export abstract class AccountingDashboardBase extends BaseAngularComponent {
  protected cdr = inject(ChangeDetectorRef);

  public Stats: DashboardStat[] = [];
  public IsLoading = false;
  public LoadError: string | null = null;

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
