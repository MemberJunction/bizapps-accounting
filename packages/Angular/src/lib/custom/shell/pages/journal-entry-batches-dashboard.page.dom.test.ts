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
import { JournalEntryBatchesDashboardPageComponent } from './journal-entry-batches-dashboard.page';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { DashboardPeriodService } from '../../shared/dashboard-period.service';
import { AccountingDashboardFiltersComponent } from '../../shared/dashboard-filters.component';
import { stubbedReadsProvider, useBusinessClock, viewResult, type BusinessClock } from '../../../../__tests__/support/business-clock';
import { ACME, BIRCH, stubDashboardFilterSources } from '../../../../__tests__/support/dashboard-filters';

const OCTOBER_IN_CHICAGO: BusinessClock = {
  BusinessZone: 'America/Chicago',
  BusinessSqlZone: 'Central Standard Time',
  MachineZone: 'America/Chicago',
  Instant: new Date('2026-10-20T15:00:00.000Z'),
};
const Q4 = "PostingDate >= '2026-10-01' AND PostingDate <= '2026-12-31'";

/** Each status counts as its position, so a segment's value proves which filter fed it. */
const IN_PERIOD: Record<string, number> = { Pending: 1, Approved: 2, Sent: 3, Posted: 4, Failed: 5, Cancelled: 6, Archived: 7 };

describe('JournalEntryBatchesDashboardPageComponent — company scope and period (DOM)', () => {
  useBusinessClock(OCTOBER_IN_CHICAGO);
  let countFilters: string[];
  let listFilters: string[];

  beforeEach(async () => {
    countFilters = [];
    listFilters = [];
    stubDashboardFilterSources([ACME, BIRCH], { [CompanyScopeService.SettingKey]: JSON.stringify([ACME.ID]) });
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      const filter = typeof p.ExtraFilter === 'string' ? p.ExtraFilter : '';
      countFilters.push(filter);
      const status = /Status='(\w+)'/.exec(filter)?.[1] ?? '';
      return viewResult([], filter.includes(Q4) ? (IN_PERIOD[status] ?? 0) : 9);
    });
    vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (ps: RunViewParams[]) => {
      listFilters.push(...ps.map((p) => (typeof p.ExtraFilter === 'string' ? p.ExtraFilter : '')));
      return ps.map(() => viewResult([], 0));
    });

    await TestBed.configureTestingModule({
      declarations: [JournalEntryBatchesDashboardPageComponent],
      imports: [CommonModule, SharedGenericModule, MJButtonDirective, MJPageHeaderInteriorComponent, MJPageBodyInteriorComponent, MJLeftNavContentComponent, MJEmptyStateComponent, MJAlertComponent, AccountingDashboardFiltersComponent],
      providers: [PageRefreshService],
    }).compileComponents();
    await TestBed.inject(CompanyScopeService).Load();
    await TestBed.inject(DashboardPeriodService).Load();
  });

  async function render(): Promise<ComponentFixture<JournalEntryBatchesDashboardPageComponent>> {
    const fixture = TestBed.createComponent(JournalEntryBatchesDashboardPageComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    return fixture;
  }

  it('scopes every batch read to the selected company, which the saved scope names', async () => {
    await render();

    expect(countFilters.length).toBeGreaterThan(0);
    expect(countFilters.every((f) => f.includes(`CompanyID IN ('${ACME.ID}')`)), JSON.stringify(countFilters)).toBe(true);
    expect(listFilters.every((f) => f.includes(`CompanyID IN ('${ACME.ID}')`)), JSON.stringify(listFilters)).toBe(true);
  });

  it('bounds the dispatch pipeline by posting date, one count per status including Archived', async () => {
    const fixture = await render();

    const pipeline = fixture.componentInstance.Breakdowns.find((b) => b.Id === 'dispatch-pipeline');
    expect(pipeline?.Segments.map((s) => [s.Label, s.Value])).toEqual([
      ['Awaiting approval', 1],
      ['Approved', 2],
      ['Sent', 3],
      ['Posted', 4],
      ['Failed', 5],
      ['Cancelled', 6],
      ['Archived', 7],
    ]);
    expect(pipeline?.Caption).toBe('Journal entry batches posting in this quarter, by status');
    // The recent card lists the period's batches, and its header is their total.
    expect(listFilters).toContain(`(${Q4}) AND (CompanyID IN ('${ACME.ID}'))`);
    expect(fixture.componentInstance.Lists.find((l) => l.Id === 'recent')?.Count).toBe(28);
  });

  it('keeps the queue cards unbounded by the period, and says so', async () => {
    const fixture = await render();

    const stats = fixture.componentInstance.Stats;
    for (const id of ['open', 'awaiting', 'failed', 'unbatched', 'unstamped']) {
      const stat = stats.find((s) => s.Id === id);
      expect(stat?.Value, id).toBe(9);
      expect(stat?.Tooltip, id).toMatch(/not only the selected period/);
    }
  });
});
