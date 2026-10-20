import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { LogError } from '@memberjunction/core';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import {
  DEFAULT_PERIOD_STATE,
  NormalizePeriodState,
  PENDING_FISCAL_BASIS,
  ParsePeriodStateJSON,
  PeriodWindowOf,
  SamePeriodState,
  type DashboardPeriodState,
  type FiscalYearStartResolution,
  type PeriodWindow,
} from '@mj-biz-apps/common-ng';
import { ResolveScopeFiscalBasis } from './dashboard-fiscal-basis';

/**
 * The reporting period the accounting dashboards share (the filter bar's Period dropdown).
 *
 * One root singleton, so the Overview and the Journal Entries and Batches dashboards show the same
 * period, the way `CompanyScopeService` gives them the same companies. Persisted per user through
 * UserInfoEngine, never localStorage; accounting's shell has no URL-state pattern, so the setting is
 * what brings a user back to the period they left.
 *
 * Holds filter state only. The pages read their own data with the window this resolves.
 */
@Injectable({ providedIn: 'root' })
export class DashboardPeriodService {
  /** UserInfoEngine settings key. Versioned so the shape can evolve. */
  public static readonly SettingKey = 'mj.bizappsacct.dashboardPeriod.v1';

  private state$ = new BehaviorSubject<DashboardPeriodState>(DEFAULT_PERIOD_STATE);
  private loaded = false;

  public get State(): DashboardPeriodState {
    return this.state$.value;
  }

  /** Emits the current state on subscribe, then each change. */
  public get State$(): Observable<DashboardPeriodState> {
    return this.state$.pipe(distinctUntilChanged(SamePeriodState));
  }

  /** Reads the persisted period once. Idempotent; a failed read leaves the default in place. */
  public async Load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      await UserInfoEngine.Instance.Config(false);
      this.state$.next(ParsePeriodStateJSON(UserInfoEngine.Instance.GetSetting(DashboardPeriodService.SettingKey)));
    } catch (e) {
      // An unreadable preference is not a broken dashboard: it opens on the default period.
      LogError(`Accounting: the saved dashboard period could not be read - ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Replace the period and persist it. */
  public SetState(state: DashboardPeriodState): void {
    const next = NormalizePeriodState(state);
    if (SamePeriodState(next, this.state$.value)) return;
    this.state$.next(next);
    UserInfoEngine.Instance.SetSettingDebounced(DashboardPeriodService.SettingKey, JSON.stringify(next));
  }

  /**
   * The fiscal start for the companies in view, from the profiles `AccountingEngineBase` caches.
   * `pending` until the engine has loaded; `unreadable` when the user cannot read profiles.
   */
  public FiscalBasisFor(selectedCompanyIDs: readonly string[]): FiscalYearStartResolution {
    const engine = AccountingEngineBase.Instance;
    if (!engine.Loaded) return PENDING_FISCAL_BASIS;
    if (engine.IsPropertyPermissionConstrained('_companyProfiles')) {
      return { Start: PENDING_FISCAL_BASIS.Start, Basis: 'unreadable' };
    }
    return ResolveScopeFiscalBasis(engine.CompanyProfiles, selectedCompanyIDs);
  }

  /** The window the selected period covers for the companies in view. */
  public WindowFor(selectedCompanyIDs: readonly string[]): PeriodWindow {
    return PeriodWindowOf(this.state$.value, this.FiscalBasisFor(selectedCompanyIDs).Start);
  }
}
