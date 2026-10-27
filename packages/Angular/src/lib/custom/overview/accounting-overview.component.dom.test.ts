import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { IMetadataProvider, Metadata, RunView, RunViewParams, UserInfo } from '@memberjunction/core';
import { AccountingOverviewPageComponent } from './accounting-overview.component';
import { AUGUST_CLOSE_IN_CHICAGO, useBusinessClock, viewResult } from '../../../__tests__/support/business-clock';
import { BatchOperatorCatalog } from '../../../__tests__/support/batch-operator';
import { ComponentCss, RuleBody } from '../../../__tests__/support/component-styles';

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

describe('AccountingOverviewPageComponent — Build Batch needs the batch-operator grant (#448, DOM)', () => {
  const USER_ID = '00000000-0000-0000-0000-0000000000a1';

  beforeEach(() => {
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) =>
      p.EntityName === BATCH_ENTITY ? viewResult([BATCH]) : viewResult([], 0),
    );
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

/**
 * THE PAGE CARRIES ITS OWN SCROLLBAR (bc-aidp-next-golive#367).
 *
 * The shell sizes this host to its content pane and clips what overflows, and no window scrollbar
 * sits behind it, so a page that declares no scroller of its own simply hides everything past the
 * first screen. That is what shipped: the host was height:100% with overflow left at its initial
 * `visible`, and the layout inside it min-height:100% with no scroller either, so the content grew
 * past the host exactly as asked and then had nowhere to go.
 *
 * Measured in a browser against the shipped rules, ten cards in a 300px pane: the host reported
 * clientHeight 300 against scrollHeight 704, and setting scrollTop on the host, on the layout and
 * on the document each left it at 0 -- 404px unreachable. Under the rules below the layout reports
 * the same 704 against a 300px client and scrolls to 404, the whole overflow.
 */
describe('AccountingOverviewPageComponent — the dashboard scrolls (DOM)', () => {
  const css = ComponentCss(AccountingOverviewPageComponent);

  it('hides overflow on the host, so the scrollbar belongs to the page and not the shell', () => {
    const host = RuleBody(css, '[_nghost');
    expect(host).toContain('overflow: hidden');
    expect(host).toContain('height: 100%');
  });

  it('scrolls the layout, and does not let it grow past the host instead', () => {
    const layout = RuleBody(css, '.mja-overview[');
    expect(layout).toContain('overflow-y: auto');
    expect(layout).toContain('min-height: 0');
    // min-height:100% is what made this box taller than the thing meant to scroll it.
    expect(layout).not.toContain('min-height: 100%');
  });
});
