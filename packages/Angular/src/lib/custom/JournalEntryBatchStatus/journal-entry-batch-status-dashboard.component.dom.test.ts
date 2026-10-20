import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { EntityInfo, Metadata, RunView, RunViewParams } from '@memberjunction/core';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { JournalEntryBatchStatusDashboardComponent } from './journal-entry-batch-status-dashboard.component';
import { ReadModelsModule } from '../shared/read-models.module';
import { JournalEntryBatchDispatchClient, type BuildJournalEntryBatchOptionsInput } from '../JournalEntryBatchDispatch/journal-entry-batch-dispatch.client';
import { AUGUST_CLOSE_IN_CHICAGO, stubbedReadsProvider, useBusinessClock, viewResult } from '../../../__tests__/support/business-clock';
import { BatchOperatorCatalog } from '../../../__tests__/support/batch-operator';

/**
 * A batch's Start → End range is inferred from its entries' EffectiveDates — a DATE column the
 * driver delivers as UTC midnight. In Chicago `2026-10-01T00:00:00Z` is the evening of
 * 30 September, so a zone-less `date` pipe showed every range one day early (golive #168). The
 * machine zone is pinned west of UTC so that regression fails on any laptop and on CI.
 */
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const BATCH_ID = '00000000-0000-0000-0000-000000000001';

const BATCH = {
  ID: BATCH_ID,
  JournalEntryBatchNumber: 'JEB-TEST-0001',
  Status: 'Pending',
  TargetSystem: 'BusinessCentral',
  CompanyID: null,
  TotalEntries: 2,
  TotalDebits: 100,
  TotalCredits: 100,
  ExternalJournalEntryBatchRef: null,
  ArchiveReason: null,
  BatchedAt: '2026-10-02T15:00:00.000Z',
  SummaryJournalEntryID: null,
};

const SOURCE_ENTRIES = [
  { ID: 'aaaaaaaa-0000-0000-0000-000000000001', JournalEntryBatchID: BATCH_ID, EffectiveDate: '2026-09-15T00:00:00.000Z' },
  { ID: 'aaaaaaaa-0000-0000-0000-000000000002', JournalEntryBatchID: BATCH_ID, EffectiveDate: '2026-10-01T00:00:00.000Z' },
];

/**
 * The Build-Batch preview's candidates: unbatched Pending entries, oldest first. The business day is
 * 2026-08-31, so JE-0003 is dated in the future and a build leaves it out (#426).
 */
const PENDING_ENTRIES = [
  { ID: 'bbbbbbbb-0000-0000-0000-000000000001', EntryNumber: 'JE-0001', EffectiveDate: '2026-08-03T00:00:00.000Z', EntryType: 'Manual', Description: null },
  { ID: 'bbbbbbbb-0000-0000-0000-000000000002', EntryNumber: 'JE-0002', EffectiveDate: '2026-08-28T00:00:00.000Z', EntryType: 'Manual', Description: null },
  { ID: 'bbbbbbbb-0000-0000-0000-000000000003', EntryNumber: 'JE-0003', EffectiveDate: '2026-09-02T00:00:00.000Z', EntryType: 'Manual', Description: null },
];

describe('JournalEntryBatchStatusDashboardComponent — inferred date range west of UTC (golive #168, DOM)', () => {
  useBusinessClock({ ...AUGUST_CLOSE_IN_CHICAGO, MachineZone: 'America/Chicago' });

  beforeEach(async () => {
    vi.spyOn(AccountingEngineBase.prototype, 'ConfigEx').mockResolvedValue(undefined);
    // The status/target filter value-lists read entity metadata; there is no provider here, and
    // the date columns do not depend on them.
    vi.spyOn(Metadata.prototype, 'EntityByName').mockReturnValue(new EntityInfo());
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      if (p.EntityName === BATCH_ENTITY) return viewResult([BATCH]);
      if (p.EntityName === JE_ENTITY && p.ExtraFilter === "Status='Pending'") return viewResult(PENDING_ENTRIES);
      if (p.EntityName === JE_ENTITY) return viewResult(SOURCE_ENTRIES);
      return viewResult([], 0);
    });
    await TestBed.configureTestingModule({ imports: [ReadModelsModule] }).compileComponents();
  });

  async function render(): Promise<ComponentFixture<JournalEntryBatchStatusDashboardComponent>> {
    const fixture = TestBed.createComponent(JournalEntryBatchStatusDashboardComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.Batches).toHaveLength(1));
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    return fixture;
  }

  it('shows the Start and End columns as the stored days', async () => {
    const fixture = await render();
    const cells = [...fixture.nativeElement.querySelectorAll('tbody tr td')].map((td: Element) => td.textContent?.trim());
    expect(cells).toContain('2026-09-15');
    expect(cells).toContain('2026-10-01');
    expect(cells).not.toContain('2026-09-14');
    expect(cells).not.toContain('2026-09-30');
  });

  it('shows the Build-Batch preview range and each candidate date as the stored days', async () => {
    const fixture = await render();
    await fixture.componentInstance.OpenBuildPreview();
    fixture.detectChanges();
    await fixture.whenStable();

    const covers = [...(fixture.nativeElement.querySelector('.bs-preview__facts div')?.querySelectorAll('strong') ?? [])].map(
      (el: Element) => el.textContent?.trim(),
    );
    expect(covers).toEqual(['2026-08-03', '2026-08-28']);
    const dates = [...fixture.nativeElement.querySelectorAll('tr.bs-detail-line')].map(
      (tr: Element) => (tr as HTMLTableRowElement).cells[1].textContent?.trim(),
    );
    expect(dates).toEqual(['2026-08-03', '2026-08-28']);
  });
});

describe('JournalEntryBatchStatusDashboardComponent — build cutoff (#426, DOM)', () => {
  useBusinessClock(AUGUST_CLOSE_IN_CHICAGO);
  let builds: Array<string | BuildJournalEntryBatchOptionsInput>;

  beforeEach(async () => {
    builds = [];
    vi.spyOn(AccountingEngineBase.prototype, 'ConfigEx').mockResolvedValue(undefined);
    vi.spyOn(Metadata.prototype, 'EntityByName').mockReturnValue(new EntityInfo());
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      if (p.EntityName === JE_ENTITY && p.ExtraFilter === "Status='Pending'") return viewResult(PENDING_ENTRIES);
      return viewResult([], 0);
    });
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'BuildJournalEntryBatch').mockImplementation(async (input) => {
      builds.push(input);
      return { Success: true, NothingToBatch: true, SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, CompanyCount: 0 };
    });
    await TestBed.configureTestingModule({ imports: [ReadModelsModule] }).compileComponents();
  });

  async function openPreview(): Promise<ComponentFixture<JournalEntryBatchStatusDashboardComponent>> {
    const fixture = TestBed.createComponent(JournalEntryBatchStatusDashboardComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.OpenBuildPreview();
    fixture.detectChanges();
    return fixture;
  }

  function hint(fixture: ComponentFixture<JournalEntryBatchStatusDashboardComponent>): string | null {
    return fixture.nativeElement.querySelector('.bs-field__hint')?.textContent?.trim() ?? null;
  }

  it('defaults the cutoff to the business day, leaves future-dated entries out, and sends the cutoff', async () => {
    const fixture = await openPreview();
    const page = fixture.componentInstance;
    expect(page.BuildCutoffDate).toBe('2026-08-31');
    expect(page.PreviewEntries.map(e => e.EntryNumber)).toEqual(['JE-0001', 'JE-0002']);
    expect(hint(fixture)).toBeNull();

    await page.OnBuildJournalEntryBatch();
    expect(builds).toEqual([{ TargetSystem: 'BusinessCentral', Cutoff: '2026-08-31' }]);
  });

  it('narrows the preview to an earlier cutoff', async () => {
    const page = (await openPreview()).componentInstance;
    page.OnBuildCutoffChange('2026-08-10');
    expect(page.PreviewEntries.map(e => e.EntryNumber)).toEqual(['JE-0001']);
  });

  it('says so when the cutoff is cleared, still stops at today, and sends no cutoff', async () => {
    const fixture = await openPreview();
    const page = fixture.componentInstance;
    page.OnBuildCutoffChange('');
    fixture.detectChanges();

    expect(hint(fixture)).toBe('No cutoff — includes everything through the posting date, today.');
    expect(page.PreviewEntries.map(e => e.EntryNumber)).toEqual(['JE-0001', 'JE-0002']);
    await page.OnBuildJournalEntryBatch();
    expect(builds).toEqual([{ TargetSystem: 'BusinessCentral', Cutoff: null }]);
  });
});

describe('JournalEntryBatchStatusDashboardComponent — Build needs the batch-operator grant (#448, DOM)', () => {
  let builds: number;

  beforeEach(async () => {
    builds = 0;
    vi.spyOn(AccountingEngineBase.prototype, 'ConfigEx').mockResolvedValue(undefined);
    vi.spyOn(Metadata.prototype, 'EntityByName').mockReturnValue(new EntityInfo());
    vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue(viewResult([], 0));
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'BuildJournalEntryBatch').mockImplementation(async () => {
      builds++;
      return { Success: true, NothingToBatch: true, SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, CompanyCount: 0 };
    });
    await TestBed.configureTestingModule({ imports: [ReadModelsModule] }).compileComponents();
  });

  /** Rendered for a user who holds the grant, or not. */
  async function render(holdsGrant: boolean): Promise<ComponentFixture<JournalEntryBatchStatusDashboardComponent>> {
    const provider = Object.assign(stubbedReadsProvider(), holdsGrant ? {} : { Authorizations: BatchOperatorCatalog([]) });
    const fixture = TestBed.createComponent(JournalEntryBatchStatusDashboardComponent);
    fixture.componentRef.setInput('Provider', provider);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const buildButton = (fixture: ComponentFixture<JournalEntryBatchStatusDashboardComponent>): HTMLButtonElement | undefined =>
    [...fixture.nativeElement.querySelectorAll('button')].find((b: HTMLButtonElement) => b.textContent?.includes('Build Batch'));

  it('shows Build Batch to a holder', async () => {
    expect(buildButton(await render(true))).toBeDefined();
  });

  it('hides Build Batch from anyone else, and neither opens the preview nor builds', async () => {
    const fixture = await render(false);
    expect(buildButton(fixture)).toBeUndefined();
    await fixture.componentInstance.OpenBuildPreview();
    expect(fixture.componentInstance.BuildPreviewVisible).toBe(false);
    await fixture.componentInstance.OnBuildJournalEntryBatch();
    expect(builds).toBe(0);
  });
});
