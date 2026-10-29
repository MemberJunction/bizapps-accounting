import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RunView, RunViewParams } from '@memberjunction/core';
import {
  MJButtonDirective,
  MJPageHeaderInteriorComponent,
  MJPageBodyInteriorComponent,
  MJLeftNavContentComponent,
  MJEmptyStateComponent,
  MJAlertComponent,
} from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { JeDashboardPageComponent } from './je-dashboard.page';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { DashboardPeriodService } from '../../shared/dashboard-period.service';
import { AccountingDashboardFiltersComponent } from '../../shared/dashboard-filters.component';
import { stubbedReadsProvider, useBusinessClock, viewResult, type BusinessClock } from '../../../../__tests__/support/business-clock';
import { ACME, BIRCH, stubDashboardFilterSources } from '../../../../__tests__/support/dashboard-filters';

/**
 * The period counts from the BUSINESS day. At this instant it is 30 September, 22:30 in Chicago and
 * already 1 October in UTC and in Tokyo, so "this quarter" must still be July to September: a UTC or
 * browser-local reading would select October to December.
 */
const QUARTER_CLOSE_IN_CHICAGO: BusinessClock = {
  BusinessZone: 'America/Chicago',
  BusinessSqlZone: 'Central Standard Time',
  MachineZone: 'Asia/Tokyo',
  Instant: new Date('2026-10-01T03:30:00.000Z'),
};
const Q3 = "EffectiveDate >= '2026-07-01' AND EffectiveDate <= '2026-09-30'";
const PERIOD_COUNT = 42;

describe('JeDashboardPageComponent — company scope and period (DOM)', () => {
  useBusinessClock(QUARTER_CLOSE_IN_CHICAGO);
  let countFilters: string[];

  beforeEach(async () => {
    // Counts answer PERIOD_COUNT only for a filter carrying the Q3 clause, so a card's value proves
    // which window was queried, not just that some query ran.
    countFilters = [];
    stubDashboardFilterSources([ACME, BIRCH]);
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      const filter = typeof p.ExtraFilter === 'string' ? p.ExtraFilter : '';
      countFilters.push(filter);
      return viewResult([], filter.includes(Q3) ? PERIOD_COUNT : 3);
    });
    vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (ps: RunViewParams[]) => ps.map(() => viewResult([], 0)));

    // Declared directly with its template's dependencies rather than through ShellModule, whose
    // circular import leaves module symbols undefined when entered from a spec.
    await TestBed.configureTestingModule({
      declarations: [JeDashboardPageComponent],
      imports: [CommonModule, SharedGenericModule, MJButtonDirective, MJPageHeaderInteriorComponent, MJPageBodyInteriorComponent, MJLeftNavContentComponent, MJEmptyStateComponent, MJAlertComponent, AccountingDashboardFiltersComponent],
      providers: [PageRefreshService],
    }).compileComponents();
    // What the shell does before it mounts a page.
    await TestBed.inject(CompanyScopeService).Load();
    await TestBed.inject(DashboardPeriodService).Load();
  });

  async function render(): Promise<ComponentFixture<JeDashboardPageComponent>> {
    const fixture = TestBed.createComponent(JeDashboardPageComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  }

  async function settle(fixture: ComponentFixture<JeDashboardPageComponent>): Promise<void> {
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
  }

  function card(fixture: ComponentFixture<JeDashboardPageComponent>, label: string): HTMLElement {
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.dash-stat'));
    const found = cards.find((el) => el.querySelector('.dash-stat__label')?.textContent?.trim() === label);
    expect(found, `the "${label}" card renders`).toBeTruthy();
    return found!;
  }

  it('counts the business quarter\'s entries, and says which dates in the tooltip', async () => {
    const fixture = await render();

    expect(fixture.componentInstance.LoadError).toBeNull();
    const entries = card(fixture, 'Entries');
    expect(entries.querySelector('.dash-stat__value')?.textContent?.trim()).toBe(String(PERIOD_COUNT));
    expect(entries.title).toContain('this quarter (Jul 1, 2026 – Sep 30, 2026)');
    expect(fixture.nativeElement.querySelector('[data-testid="dashboard-period-window"]')?.textContent?.trim()).toBe('Jul 1, 2026 – Sep 30, 2026');
  });

  it('leaves the queues unbounded by the period, and their tooltips say so', async () => {
    const fixture = await render();

    const pending = countFilters.filter((f) => f.includes("Status='Pending'") && !f.includes('EffectiveDate'));
    expect(pending.length, 'Pending and Awaiting CFO approval are read for every date').toBe(2);
    expect(card(fixture, 'Pending').title).toContain('Every date');
    expect(card(fixture, 'Awaiting CFO approval').title).toContain('Every date');
    expect(card(fixture, 'Batched').querySelector('.dash-stat__value')?.textContent?.trim()).toBe(String(PERIOD_COUNT));
  });

  it('re-reads when the scope changes from outside the page (the rail chip)', async () => {
    const fixture = await render();
    countFilters = [];

    TestBed.inject(CompanyScopeService).SetScope([BIRCH.ID]);
    await vi.waitFor(() => expect(countFilters.length).toBeGreaterThan(0));
    await settle(fixture);

    expect(countFilters.every((f) => f.includes(`CompanyID IN ('${BIRCH.ID}')`)), JSON.stringify(countFilters)).toBe(true);
  });

  it('re-reads with the new bounds when the period changes in the bar', async () => {
    const fixture = await render();
    countFilters = [];

    const select = fixture.nativeElement.querySelector('[data-testid="dashboard-period"]') as HTMLSelectElement;
    select.value = 'year';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(countFilters.length).toBeGreaterThan(0));
    await settle(fixture);

    expect(countFilters).toContain("(EffectiveDate >= '2026-01-01' AND EffectiveDate <= '2026-12-31')");
    expect(card(fixture, 'Entries').title).toContain('this year');
  });
});
