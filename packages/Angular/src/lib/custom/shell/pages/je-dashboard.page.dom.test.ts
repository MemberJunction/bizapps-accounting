import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
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
import { AUGUST_CLOSE_IN_CHICAGO, stubbedReadsProvider, useBusinessClock, viewResult } from '../../../../__tests__/support/business-clock';

/**
 * "Entries this month" counts from the first day of the BUSINESS month (monthStartBusiness in
 * AccountingDashboardBase), not the UTC or browser month. See AUGUST_CLOSE_IN_CHICAGO: the business
 * month is still August, while the old window, monthStartUTC, answered 1 September, so for the last
 * hours of every business month the card counted only entries dated tomorrow.
 */
const MONTH_CLAUSE = "EffectiveDate >= '2026-08-01'";
const MONTH_COUNT = 42;

describe('JeDashboardPageComponent — "Entries this month" window (DOM)', () => {
  useBusinessClock(AUGUST_CLOSE_IN_CHICAGO);
  let countFilters: string[];

  beforeEach(async () => {
    // Counts answer MONTH_COUNT only for the business-month clause, so the card's value proves
    // which window was queried, not just that some query ran. Matched by substring: the company
    // scope wraps and joins clauses, and that composition is not what this spec is about.
    countFilters = [];
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      // The page writes plain-string filters; a PlatformSQL filter would not be this page's.
      const filter = typeof p.ExtraFilter === 'string' ? p.ExtraFilter : '';
      countFilters.push(filter);
      return viewResult([], filter.includes(MONTH_CLAUSE) ? MONTH_COUNT : 0);
    });
    vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (ps: RunViewParams[]) => ps.map(() => viewResult([], 0)));

    // Declared directly with its template's dependencies rather than through ShellModule, whose
    // circular import leaves module symbols undefined when entered from a spec. CompanyScopeService
    // is the real one: it is plain state until Load(), and a fresh one scopes to all companies.
    await TestBed.configureTestingModule({
      declarations: [JeDashboardPageComponent],
      imports: [CommonModule, SharedGenericModule, MJButtonDirective, MJPageHeaderInteriorComponent, MJPageBodyInteriorComponent, MJLeftNavContentComponent, MJEmptyStateComponent, MJAlertComponent],
      providers: [PageRefreshService],
    }).compileComponents();
  });

  it('queries from the first of the business month, shows that count on the card, and says so in its tooltip', async () => {
    const fixture = TestBed.createComponent(JeDashboardPageComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.detectChanges();
    await fixture.whenStable();
    // load() awaits both reads, then assigns Stats; let that settle and re-render.
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();

    expect(fixture.componentInstance.LoadError).toBeNull();
    expect(countFilters.some(f => f.includes(MONTH_CLAUSE)), `month clause in ${JSON.stringify(countFilters)}`).toBe(true);

    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.dash-stat'));
    const card = cards.find(el => el.querySelector('.dash-stat__label')?.textContent?.trim() === 'Entries this month');
    expect(card, 'the "Entries this month" card renders').toBeTruthy();
    expect(card!.querySelector('.dash-stat__value')?.textContent?.trim()).toBe(String(MONTH_COUNT));
    // The tooltip is the card's definition of the number; it must name the business zone, not UTC.
    expect(card!.title).toContain('business time zone');
    expect(card!.title).not.toContain('UTC');
  });
});
