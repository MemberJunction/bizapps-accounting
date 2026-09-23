import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { IMetadataProvider, RunView, RunViewParams } from '@memberjunction/core';
import {
  MJButtonDirective,
  MJPageHeaderInteriorComponent,
  MJPageBodyInteriorComponent,
  MJLeftNavContentComponent,
  MJEmptyStateComponent,
  MJAlertComponent,
} from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { BusinessTimeZoneEngine, type InstanceConfigurationRow } from '@mj-biz-apps/common-entities';
import { JeDashboardPageComponent } from './je-dashboard.page';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { CompanyScopeService } from '../../shared/company-scope.service';

/**
 * "Entries this month" counts from the first day of the BUSINESS month (monthStartBusiness in
 * AccountingDashboardBase), not the UTC month.
 *
 * 2026-09-01T03:30:00Z is 22:30 CDT on 31 August in Chicago (the business zone) but already
 * 1 September in UTC. The old window, monthStartUTC, answered '2026-09-01' here, so for the
 * last hours of every business month the card counted only entries dated tomorrow.
 */
const INSTANT = new Date('2026-09-01T03:30:00.000Z');
const MONTH_FILTER = "EffectiveDate >= '2026-08-01'";
const MONTH_COUNT = 42;

describe('JeDashboardPageComponent — "Entries this month" window (DOM)', () => {
  // The engine is a singleton; set its loaded state directly (as `batch-status-window.test.ts`
  // does) so it answers a chosen zone with no IMetadataProvider, then restore it.
  const engine = BusinessTimeZoneEngine.Instance as unknown as { _configurations: InstanceConfigurationRow[]; _loaded: boolean };
  const original = { rows: engine._configurations, loaded: engine._loaded };
  let countFilters: string[];

  beforeEach(async () => {
    engine._configurations = [
      { FeatureKey: 'BizApps.BusinessTimeZone', Value: '{"iana":"America/Chicago","sql":"Central Standard Time"}', DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
    ];
    engine._loaded = true;
    // Only Date is faked: Angular's zoneless scheduler and whenStable() still need real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(INSTANT);

    // Counts answer MONTH_COUNT only for the expected month filter, so the card's value proves
    // which window was queried, not just that some query ran.
    countFilters = [];
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      const filter = String(p.ExtraFilter ?? '');
      countFilters.push(filter);
      return { Success: true, Results: [], TotalRowCount: filter === MONTH_FILTER ? MONTH_COUNT : 0 } as never;
    });
    vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (ps: RunViewParams[]) =>
      ps.map(() => ({ Success: true, Results: [], TotalRowCount: 0 })) as never,
    );

    // Declared directly with its template's dependencies rather than through ShellModule, whose
    // circular import leaves module symbols undefined when entered from a spec.
    await TestBed.configureTestingModule({
      declarations: [JeDashboardPageComponent],
      imports: [CommonModule, SharedGenericModule, MJButtonDirective, MJPageHeaderInteriorComponent, MJPageBodyInteriorComponent, MJLeftNavContentComponent, MJEmptyStateComponent, MJAlertComponent],
      providers: [
        PageRefreshService,
        // "All companies": the page's own filter, unscoped.
        { provide: CompanyScopeService, useValue: { ComposeFilter: (own: string | null) => own ?? '' } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    engine._configurations = original.rows;
    engine._loaded = original.loaded;
    vi.useRealTimers();
  });

  it('queries from the first of the business month and shows that count on the card', async () => {
    const fixture = TestBed.createComponent(JeDashboardPageComponent);
    fixture.componentRef.setInput('Provider', { CurrentUser: {} } as unknown as IMetadataProvider);
    fixture.detectChanges();
    await fixture.whenStable();
    // load() awaits both reads, then assigns Stats; let that settle and re-render.
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();

    expect(fixture.componentInstance.LoadError).toBeNull();
    expect(countFilters).toContain(MONTH_FILTER);

    const card = Array.from(fixture.nativeElement.querySelectorAll('.dash-stat') as NodeListOf<HTMLElement>)
      .find(el => el.querySelector('.dash-stat__label')?.textContent?.trim() === 'Entries this month');
    expect(card, 'the "Entries this month" card renders').toBeTruthy();
    expect(card!.querySelector('.dash-stat__value')?.textContent?.trim()).toBe(String(MONTH_COUNT));
  });
});
