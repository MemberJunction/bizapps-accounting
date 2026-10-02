import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { RunView, RunViewParams } from '@memberjunction/core';
import { AccountingOverviewPageComponent } from './accounting-overview.component';
import { AUGUST_CLOSE_IN_CHICAGO, useBusinessClock, viewResult } from '../../../__tests__/support/business-clock';

/**
 * The overview reads two DATE columns — `PostingDate` (recent batches) and `EffectiveDate` (the
 * monthly volume chart) — and must show the STORED day for a viewer west of UTC (golive #168).
 *
 * The driver delivers a DATE as UTC midnight, so in Chicago `2026-10-01T00:00:00Z` is 30 September,
 * 7 PM. Local getters and a zone-less `date` pipe both read it as 30 September. The machine zone is
 * pinned to Chicago here so a regression to either fails on any laptop and on CI.
 */
const WEST_OF_UTC = { ...AUGUST_CLOSE_IN_CHICAGO, MachineZone: 'America/Chicago' };
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const FIRST_OF_OCTOBER = '2026-10-01T00:00:00.000Z';

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

/** Two entries dated 1 October and one mid-September: the chart must show Sep 1, Oct 2. */
const ENTRY_SAMPLES = [{ EffectiveDate: FIRST_OF_OCTOBER }, { EffectiveDate: FIRST_OF_OCTOBER }, { EffectiveDate: '2026-09-15T00:00:00.000Z' }];

describe('AccountingOverviewPageComponent — DATE columns read as the stored day west of UTC (DOM)', () => {
  useBusinessClock(WEST_OF_UTC);

  beforeEach(() => {
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      if (p.EntityName === BATCH_ENTITY) return viewResult([BATCH]);
      if (p.EntityName === JE_ENTITY && p.ExtraFilter) return viewResult([], 0); // the Pending count
      if (p.EntityName === JE_ENTITY) return viewResult(ENTRY_SAMPLES);
      return viewResult([], 0);
    });
  });

  async function render(): Promise<ComponentFixture<AccountingOverviewPageComponent>> {
    const fixture = TestBed.createComponent(AccountingOverviewPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    return fixture;
  }

  it('files an entry dated the 1st under its own month in the volume chart', async () => {
    const fixture = await render();

    const bars = fixture.componentInstance.MonthlyBars.map(b => [b.Period, b.Count]);
    expect(bars).toEqual([
      ['2026-09', 1],
      ['2026-10', 2],
    ]);
    const labels = [...fixture.nativeElement.querySelectorAll('.mja-bar-label')].map((el: Element) => el.textContent?.trim());
    expect(labels).toEqual(["Sep '26", "Oct '26"]);
  });

  it('shows a batch PostingDate of 1 October as Oct 1, not the evening before', async () => {
    const fixture = await render();

    const row = fixture.nativeElement.querySelector('.mja-batch-num')?.closest('tr') as HTMLTableRowElement | null;
    expect(row, 'the recent-batches row rendered').not.toBeNull();
    expect(row!.cells[2].textContent?.trim()).toBe('Oct 1, 2026');
  });
});
