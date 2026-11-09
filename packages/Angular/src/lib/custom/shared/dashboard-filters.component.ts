import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import {
  DashboardFilterBarComponent,
  PENDING_FISCAL_BASIS,
  type DashboardPeriodState,
  type FilterOption,
  type FiscalYearStartResolution,
} from '@mj-biz-apps/common-ng';
import { CompanyScopeService } from './company-scope.service';
import { DashboardPeriodService } from './dashboard-period.service';

/**
 * The accounting dashboards' filter bar: common's `bizapps-dashboard-filter-bar`, bound to the two
 * app-wide services.
 *
 * The company picker IS the company scope. Its options are `CompanyScopeService.Companies`, its
 * selection is `SelectedIDs`, and a change goes through `SetScope`, so the rail's scope chip and this
 * bar always show the same companies and empty means all of them. The period is
 * `DashboardPeriodService`, shared by every dashboard and persisted per user.
 *
 * Pages do not listen to this component. They subscribe to the services, which also catches a scope
 * change made from the rail chip.
 */
@Component({
  standalone: true,
  selector: 'mj-accounting-dashboard-filters',
  imports: [DashboardFilterBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bizapps-dashboard-filter-bar
      CompanyLabel="Company"
      [CompanyOptions]="CompanyOptions"
      [SelectedCompanyIDs]="SelectedCompanyIDs"
      (SelectedCompanyIDsChange)="OnCompaniesChanged($event)"
      [PeriodState]="Period"
      (PeriodStateChange)="OnPeriodChanged($event)"
      [FiscalBasis]="FiscalBasis">
    </bizapps-dashboard-filter-bar>
  `,
  styles: [`:host { display: block; }`],
})
export class AccountingDashboardFiltersComponent implements OnInit {
  private scope = inject(CompanyScopeService);
  private periods = inject(DashboardPeriodService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  public CompanyOptions: FilterOption[] = [];
  public SelectedCompanyIDs: string[] = [];
  public Period: DashboardPeriodState = this.periods.State;
  public FiscalBasis: FiscalYearStartResolution = PENDING_FISCAL_BASIS;

  ngOnInit(): void {
    // Each emission re-reads all four: the fiscal basis depends on both the roster (the engine has
    // loaded) and the selection (whose profiles decide).
    merge(this.scope.Companies$, this.scope.SelectedIDs$, this.periods.State$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.sync());
  }

  public OnCompaniesChanged(ids: string[]): void {
    this.scope.SetScope(ids);
  }

  public OnPeriodChanged(state: DashboardPeriodState): void {
    this.periods.SetState(state);
  }

  private sync(): void {
    this.CompanyOptions = this.scope.Companies.map((c) => ({ ID: c.ID, Name: c.Name }));
    this.SelectedCompanyIDs = this.scope.SelectedIDs;
    this.Period = this.periods.State;
    this.FiscalBasis = this.periods.FiscalBasisFor(this.SelectedCompanyIDs);
    this.cdr.markForCheck();
  }
}
