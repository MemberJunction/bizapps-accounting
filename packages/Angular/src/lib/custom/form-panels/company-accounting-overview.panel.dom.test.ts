import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { RunView, RunViewParams } from '@memberjunction/core';
import type { MJCompanyEntity } from '@memberjunction/core-entities';
import { CompanyAccountingOverviewComponent } from './company-accounting-overview.panel';
import { AUGUST_CLOSE_IN_CHICAGO, useBusinessClock, viewResult } from '../../../__tests__/support/business-clock';

/**
 * The Company form's "Recent ERP Batches" card shows each batch's `PostingDate`, a DATE column the
 * driver delivers as UTC midnight (golive #168). In Chicago `2026-10-01T00:00:00Z` is 30 September,
 * 7 PM, so a local-getter `toLocaleDateString` printed "Sep 30". The machine zone is pinned west of
 * UTC so a regression fails on any laptop and on CI.
 *
 * The component's own template renders; only the MJ card shell is swapped for plain elements — its
 * structural directives need a host card that has no bearing on how a date is printed.
 */
const WEST_OF_UTC = { ...AUGUST_CLOSE_IN_CHICAGO, MachineZone: 'America/Chicago' };
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

describe('CompanyAccountingOverviewComponent — PostingDate reads as the stored day west of UTC (DOM)', () => {
  useBusinessClock(WEST_OF_UTC);

  beforeEach(() => {
    TestBed.overrideComponent(CompanyAccountingOverviewComponent, { set: { imports: [CommonModule], schemas: [CUSTOM_ELEMENTS_SCHEMA] } });
    // `simple` results arrive as JSON: the DATE column is an ISO string at UTC midnight.
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) =>
      p.EntityName === BATCH_ENTITY
        ? viewResult([{ ID: 'b-1', JournalEntryBatchNumber: 'JEB-0001', PostingDate: '2026-10-01T00:00:00.000Z', TotalDebits: 100, Status: 'Posted' }])
        : viewResult([], 0),
    );
  });

  it('shows a PostingDate of 1 October as Oct 1, not the evening before', async () => {
    const fixture = TestBed.createComponent(CompanyAccountingOverviewComponent);
    fixture.componentInstance.Record = { ID: '11111111-0000-4000-8000-000000000001' } as MJCompanyEntity;
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.Batches).toHaveLength(1));
    fixture.detectChanges();

    const row = [...fixture.nativeElement.querySelectorAll('tr')].find((tr: HTMLTableRowElement) =>
      tr.cells[0]?.textContent?.trim() === 'JEB-0001',
    ) as HTMLTableRowElement | undefined;
    expect(row, 'the recent-batches row rendered').toBeDefined();
    expect(row!.cells[1].textContent?.trim()).toBe('Oct 1');
  });
});
