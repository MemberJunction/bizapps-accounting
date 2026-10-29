import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IMetadataProvider, Metadata, RunView, RunViewParams, RunViewResult, UserInfo } from '@memberjunction/core';
import { DashboardFilterBarComponent } from '@mj-biz-apps/common-ng';
import { AccountingOverviewPageComponent } from './accounting-overview.component';
import { CompanyScopeService } from '../shared/company-scope.service';
import { useBusinessClock, viewResult, type BusinessClock } from '../../../__tests__/support/business-clock';
import { ACME, BIRCH, stubDashboardFilterSources } from '../../../__tests__/support/dashboard-filters';
import { BatchOperatorCatalog } from '../../../__tests__/support/batch-operator';

/**
 * The Overview reads its figures for the filter bar's companies and period, on the server: the
 * period's batches (every one, not a sample), journal-entry counts, and one count per chart month.
 * A failed read shows dashes and the reason, never invented numbers.
 *
 * The machine zone is Chicago, so a batch PostingDate delivered as UTC midnight on 1 October must
 * still read as 1 October (golive #168). "Today" is 20 October in the business zone: this quarter
 * is October to December.
 */
const OCTOBER_IN_CHICAGO: BusinessClock = {
  BusinessZone: 'America/Chicago',
  BusinessSqlZone: 'Central Standard Time',
  MachineZone: 'America/Chicago',
  Instant: new Date('2026-10-20T15:00:00.000Z'),
};
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const FIRST_OF_OCTOBER = '2026-10-01T00:00:00.000Z';
const Q4 = "PostingDate >= '2026-10-01' AND PostingDate <= '2026-12-31'";

const BATCH = {
  ID: '00000000-0000-0000-0000-000000000001',
  JournalEntryBatchNumber: 'JEB-TEST-0001',
  Status: 'Pending',
  TargetSystem: 'BusinessCentral',
  PostingDate: new Date(FIRST_OF_OCTOBER),
  TotalEntries: 3,
  TotalDebits: 100,
  TotalCredits: 100,
  Company: 'Test Company',
};
const POSTED_BATCH = { ...BATCH, ID: '00000000-0000-0000-0000-000000000002', JournalEntryBatchNumber: 'JEB-TEST-0002', Status: 'Posted', TotalDebits: 250 };

/** Monthly counts by the month a filter names: October 2, November 0, December 1. */
const MONTH_COUNTS: Record<string, number> = { '2026-10': 2, '2026-11': 0, '2026-12': 1 };

const filterOf = (p: RunViewParams): string => (typeof p.ExtraFilter === 'string' ? p.ExtraFilter : '');

describe('AccountingOverviewPageComponent (DOM)', () => {
  useBusinessClock(OCTOBER_IN_CHICAGO);
  let reads: RunViewParams[];
  let failBatches: boolean;

  /** Answers each read by what it asks for, and records it. */
  function answer(p: RunViewParams): RunViewResult {
    reads.push(p);
    const filter = filterOf(p);
    if (p.EntityName === BATCH_ENTITY) {
      return failBatches ? { ...viewResult([]), Success: false, ErrorMessage: 'batches unavailable' } : viewResult([BATCH, POSTED_BATCH]);
    }
    if (filter.includes("Status='Pending'")) return viewResult([{ ID: 'je' }], 7);
    if (p.OrderBy === 'EffectiveDate ASC') return viewResult([{ ID: 'je1', EffectiveDate: FIRST_OF_OCTOBER }], 3);
    if (p.OrderBy === 'EffectiveDate DESC') return viewResult([{ ID: 'je3', EffectiveDate: '2026-12-02T00:00:00.000Z' }], 3);
    const month = /EffectiveDate >= '(\d{4}-\d{2})-/.exec(filter)?.[1] ?? '';
    return viewResult([], MONTH_COUNTS[month] ?? 0);
  }

  beforeEach(() => {
    reads = [];
    failBatches = false;
    stubDashboardFilterSources([ACME, BIRCH]);
    vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (ps: RunViewParams[]) => ps.map(answer));
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => answer(p));
  });

  async function settle(fixture: ComponentFixture<AccountingOverviewPageComponent>): Promise<void> {
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
  }

  async function render(): Promise<ComponentFixture<AccountingOverviewPageComponent>> {
    const fixture = TestBed.createComponent(AccountingOverviewPageComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(reads.length).toBeGreaterThan(0));
    await settle(fixture);
    return fixture;
  }

  const text = (fixture: ComponentFixture<AccountingOverviewPageComponent>, testid: string): string =>
    (fixture.nativeElement.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null)?.textContent?.trim() ?? '';

  it('reads every batch posting in the period on the server, with no row cap', async () => {
    const fixture = await render();

    const batchRead = reads.find((p) => p.EntityName === BATCH_ENTITY);
    // The company scope composes the period clause into one parenthesised filter.
    expect(filterOf(batchRead!)).toBe(`(${Q4})`);
    expect(batchRead!.MaxRows).toBeUndefined();
    expect(text(fixture, 'overview-kpi-batches')).toBe('2');
    expect(text(fixture, 'overview-kpi-volume')).toBe('$350.00');
    expect(text(fixture, 'dashboard-period-window')).toBe('Oct 1, 2026 – Dec 31, 2026');
  });

  it('counts pending entries for every date, and the period\'s entries on the server', async () => {
    const fixture = await render();

    const pending = reads.find((p) => filterOf(p).includes("Status='Pending'"));
    expect(filterOf(pending!)).not.toContain('EffectiveDate');
    expect(pending!.MaxRows).toBe(1);
    expect(text(fixture, 'overview-kpi-pending-entries')).toBe('7');
    expect(text(fixture, 'overview-entries-in-period')).toBe('3');
  });

  it('draws one bar per month of the period from server counts, each bounded to its month', async () => {
    const fixture = await render();

    expect(fixture.componentInstance.MonthlyBars.map((b) => [b.Period, b.Count])).toEqual([
      ['2026-10', 2],
      ['2026-11', 0],
      ['2026-12', 1],
    ]);
    const monthFilters = reads.map(filterOf).filter((f) => /EffectiveDate >= '\d{4}-\d{2}-01' AND EffectiveDate <= /.test(f));
    expect(monthFilters).toContain("(EffectiveDate >= '2026-11-01' AND EffectiveDate <= '2026-11-30')");
    const labels = [...fixture.nativeElement.querySelectorAll('.mja-bar-label')].map((el: Element) => el.textContent?.trim());
    expect(labels).toEqual(["Oct '26", "Nov '26", "Dec '26"]);
  });

  it('shows a batch PostingDate of 1 October as Oct 1, not the evening before', async () => {
    const fixture = await render();

    const row = fixture.nativeElement.querySelector('.mja-batch-num')?.closest('tr') as HTMLTableRowElement | null;
    expect(row, 'the recent-batches row rendered').not.toBeNull();
    expect(row!.cells[2].textContent?.trim()).toBe('Oct 1, 2026');
  });

  it('a company picked in the bar becomes the app-wide scope, and every read is narrowed to it', async () => {
    const fixture = await render();
    const scope = TestBed.inject(CompanyScopeService);
    reads = [];

    fixture.debugElement.query(By.directive(DashboardFilterBarComponent)).componentInstance.ToggleCompany(ACME.ID);
    await vi.waitFor(() => expect(reads.length).toBeGreaterThan(0));
    await settle(fixture);

    expect(scope.SelectedIDs).toEqual([ACME.ID]);
    const batchRead = reads.find((p) => p.EntityName === BATCH_ENTITY);
    expect(filterOf(batchRead!)).toBe(`(${Q4}) AND (CompanyID IN ('${ACME.ID}'))`);
    expect(reads.filter((p) => p.EntityName === JE_ENTITY).every((p) => filterOf(p).includes(`CompanyID IN ('${ACME.ID}')`))).toBe(true);
  });

  it('a period picked in the dropdown re-reads with its bounds', async () => {
    const fixture = await render();
    reads = [];

    const select = fixture.nativeElement.querySelector('[data-testid="dashboard-period"]') as HTMLSelectElement;
    select.value = 'lastquarter';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(reads.length).toBeGreaterThan(0));
    await settle(fixture);

    expect(filterOf(reads.find((p) => p.EntityName === BATCH_ENTITY)!)).toBe("(PostingDate >= '2026-07-01' AND PostingDate <= '2026-09-30')");
    expect(text(fixture, 'dashboard-period-window')).toBe('Jul 1, 2026 – Sep 30, 2026');
  });

  it('a failed read shows the reason and dashes, not invented numbers', async () => {
    failBatches = true;
    const fixture = await render();

    expect(fixture.componentInstance.LoadError).toBe('batches unavailable');
    expect(fixture.nativeElement.querySelector('mj-alert')).not.toBeNull();
    expect(text(fixture, 'overview-kpi-batches')).toBe('—');
    expect(text(fixture, 'overview-kpi-pending-entries')).toBe('—');
    expect(text(fixture, 'overview-kpi-volume')).toBe('—');
    expect(fixture.componentInstance.MonthlyBars).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Posting history could not be loaded.');
  });
});

describe('AccountingOverviewPageComponent — Build Batch needs the batch-operator grant (#448, DOM)', () => {
  const USER_ID = '00000000-0000-0000-0000-0000000000a1';

  useBusinessClock(OCTOBER_IN_CHICAGO);

  beforeEach(() => {
    stubDashboardFilterSources([ACME, BIRCH]);
    const answer = (p: RunViewParams): RunViewResult => (p.EntityName === BATCH_ENTITY ? viewResult([BATCH]) : viewResult([], 0));
    vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (ps: RunViewParams[]) => ps.map(answer));
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => answer(p));
  });

  async function buildButtonsFor(holdsGrant: boolean): Promise<string[]> {
    const user = new UserInfo();
    user.ID = USER_ID;
    const provider = { CurrentUser: user, Authorizations: BatchOperatorCatalog(holdsGrant ? [USER_ID] : []) };
    vi.spyOn(Metadata, 'Provider', 'get').mockReturnValue(provider as unknown as IMetadataProvider);
    const fixture = TestBed.createComponent(AccountingOverviewPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    return [...fixture.nativeElement.querySelectorAll('button')]
      .map((b: HTMLButtonElement) => b.textContent?.trim() ?? '')
      .filter((label: string) => label.startsWith('Build Batch'));
  }

  it('shows a holder both Build Batch buttons', async () => {
    expect(await buildButtonsFor(true)).toEqual(['Build Batch', 'Build Batch']);
  });

  it('shows anyone else none', async () => {
    expect(await buildButtonsFor(false)).toEqual([]);
  });
});
