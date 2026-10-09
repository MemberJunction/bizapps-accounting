import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { IMetadataProvider, Metadata, RunView, RunViewParams, UserInfo } from '@memberjunction/core';
import { AccountingBatchesPageComponent, BatchItem } from './accounting-batches.component';
import {
  BuildJournalEntryBatchOptionsInput,
  CancelJournalEntryBatchResult,
  JournalEntryBatchDispatchClient,
  PreviewEntryWire,
  PreviewJournalEntryBatchOptionsInput,
  PreviewJournalEntryBatchResult,
} from '../JournalEntryBatchDispatch/journal-entry-batch-dispatch.client';
import { AUGUST_CLOSE_IN_CHICAGO, useBusinessClock, viewResult } from '../../../__tests__/support/business-clock';

/**
 * The Build Batch modal's default cutoff is the BUSINESS day, not the UTC or browser day.
 * See AUGUST_CLOSE_IN_CHICAGO: the business day is 31 August, while the old default,
 * `new Date().toISOString().slice(0, 10)`, answered 1 September and swept entries dated the
 * next business day into tonight's batch.
 */
const BUSINESS_DAY = '2026-08-31';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const COMPANY_PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const COMPANY_ID = '00000000-0000-0000-0000-0000000000c1';
const BUILDER_USER_ID = '00000000-0000-0000-0000-0000000000b1';
const APPROVER_USER_ID = '00000000-0000-0000-0000-0000000000a1';
const OTHER_USER_ID = '00000000-0000-0000-0000-0000000000f1';
/** The MJ system user, which the nightly job builds as. */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-0000000000e1';

/** Sign in as `userId`: the page reads the current user from the global provider. */
function signInAs(userId: string): void {
  const user = new UserInfo();
  user.ID = userId;
  const provider: Pick<IMetadataProvider, 'CurrentUser'> = { CurrentUser: user };
  vi.spyOn(Metadata, 'Provider', 'get').mockReturnValue(provider as IMetadataProvider);
}

const LISTED_BATCH: BatchItem = {
  ID: '00000000-0000-0000-0000-000000000001',
  JournalEntryBatchNumber: 'JEB-TEST-0001',
  Status: 'Pending',
  TargetSystem: 'BusinessCentral',
  PostingDate: new Date('2026-08-30T00:00:00.000Z'),
  BatchedAt: new Date('2026-08-30T06:00:00.000Z'),
  TotalEntries: 1,
  TotalDebits: 100,
  TotalCredits: 100,
  Company: 'Test Company',
  ExternalJournalEntryBatchRef: null,
  ArchiveReason: null,
  CancelReason: null,
  CompanyID: COMPANY_ID,
  BatchedByUserID: BUILDER_USER_ID,
};

describe('AccountingBatchesPageComponent — Build Batch modal cutoff (DOM)', () => {
  useBusinessClock(AUGUST_CLOSE_IN_CHICAGO);
  let previewCalls: PreviewJournalEntryBatchOptionsInput[];

  beforeEach(() => {
    // The page's batch list (ngOnInit) reads through the global RunView. One batch comes back so
    // the spec can see the list render: LoadBatches swallows its own errors, so an empty page is
    // not evidence that it loaded.
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) =>
      p.EntityName === BATCH_ENTITY ? viewResult([LISTED_BATCH]) : viewResult([], 0),
    );
    previewCalls = [];
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'PreviewJournalEntryBatch').mockImplementation(async (options) => {
      previewCalls.push(options ?? {});
      return { Success: true, Candidates: [], TotalDebits: 0, TotalCredits: 0, GrossDebits: 0, GrossCredits: 0, OutOfOrderSkipCount: 0, BeforePostingStartCount: 0 };
    });
  });

  async function render(): Promise<ComponentFixture<AccountingBatchesPageComponent>> {
    const fixture = TestBed.createComponent(AccountingBatchesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mja-batch-num')?.textContent?.trim(), 'the batch list rendered').toBe(
      LISTED_BATCH.JournalEntryBatchNumber,
    );
    return fixture;
  }

  async function openModal(fixture: ComponentFixture<AccountingBatchesPageComponent>): Promise<HTMLInputElement> {
    await fixture.componentInstance.OpenBuildBatchModal();
    fixture.detectChanges();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input[aria-label="Effective Date Cutoff"]') as HTMLInputElement | null;
    expect(input, 'the modal renders its cutoff date input').not.toBeNull();
    return input!;
  }

  async function closeModal(fixture: ComponentFixture<AccountingBatchesPageComponent>): Promise<void> {
    fixture.componentInstance.CloseBuildBatchModal();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('defaults an empty cutoff to the business day, sends it to the preview, and shows it in the date input', async () => {
    const fixture = await render();
    const input = await openModal(fixture);

    expect(fixture.componentInstance.BuildCutoffDate).toBe(BUSINESS_DAY);
    expect(previewCalls.map(c => c.Cutoff)).toEqual([BUSINESS_DAY]);
    expect(input.value).toBe(BUSINESS_DAY);
  });

  it('says so when the cutoff is cleared — the preview then includes future-dated entries', async () => {
    const fixture = await render();
    const input = await openModal(fixture);
    const hint = () => fixture.nativeElement.querySelector('.mja-modal-hint') as HTMLElement | null;
    expect(hint(), 'no warning while a cutoff is set').toBeNull();

    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(previewCalls.at(-1)?.Cutoff).toBeNull();
    expect(hint()?.textContent?.trim()).toBe('No cutoff — includes future-dated entries.');
  });

  it('keeps a cutoff the user chose when the modal is closed and reopened', async () => {
    const fixture = await render();
    const first = await openModal(fixture);
    // Choose a day through the input itself, as an operator would.
    first.value = '2026-07-15';
    first.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    await closeModal(fixture);

    const reopened = await openModal(fixture);

    expect(fixture.componentInstance.BuildCutoffDate).toBe('2026-07-15');
    expect(previewCalls.at(-1)?.Cutoff).toBe('2026-07-15');
    expect(reopened.value).toBe('2026-07-15');
  });

  it('shows entry totals beside the netted totals, and counts the excluded entries in the ordering warning (golive #284)', async () => {
    vi.mocked(JournalEntryBatchDispatchClient.prototype.PreviewJournalEntryBatch).mockResolvedValue({
      Success: true,
      Candidates: [],
      TotalDebits: 8000,
      TotalCredits: 8000,
      GrossDebits: 8666.63,
      GrossCredits: 8666.63,
      OutOfOrderSkipCount: 225,
      BeforePostingStartCount: 0,
    });
    const fixture = await render();
    await openModal(fixture);

    const facts = [...fixture.nativeElement.querySelectorAll('.mja-fact-item')].map((el: Element) =>
      Array.from(el.querySelectorAll('.mja-fact-lbl, .mja-fact-val'), p => p.textContent?.trim()).join(' '),
    );
    expect(facts).toContain('Entry Totals Dr $8,666.63 Cr $8,666.63');
    expect(facts).toContain('Net to Post Dr $8,000.00 Cr $8,000.00');
    expect(fixture.nativeElement.querySelector('.mja-fact-note')?.textContent).toContain('Net to Post is what the batch carries');

    const warning = fixture.nativeElement.querySelector('.mja-banner[role="status"]')?.textContent?.replace(/\s+/g, ' ');
    expect(warning).toContain('225 excluded entries are older than an entry you included');
    expect(warning).not.toContain('included entries will batch');
  });
});

describe('AccountingBatchesPageComponent — DATE columns read as the stored day west of UTC (golive #168, DOM)', () => {
  // The driver delivers a DATE as UTC midnight; in Chicago that is the evening BEFORE. A zone-less
  // `date` pipe, or a covered range built from instants, shows every stored day one day early.
  // The machine zone is pinned west of UTC so that regression fails here, not just in production.
  useBusinessClock({ ...AUGUST_CLOSE_IN_CHICAGO, MachineZone: 'America/Chicago' });

  const CANDIDATES: PreviewEntryWire[] = [
    { ID: 'aaaaaaaa-0000-0000-0000-000000000001', EntryNumber: 'JE-0001', EffectiveDate: '2026-09-01T00:00:00.000Z', EntryTypeCode: 'Manual', CompanyID: '11111111-0000-0000-0000-000000000001', Description: null, Amount: 10 },
    { ID: 'aaaaaaaa-0000-0000-0000-000000000002', EntryNumber: 'JE-0002', EffectiveDate: '2026-08-03T00:00:00.000Z', EntryTypeCode: 'Manual', CompanyID: '11111111-0000-0000-0000-000000000001', Description: null, Amount: 20 },
  ];

  beforeEach(() => {
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) =>
      p.EntityName === BATCH_ENTITY ? viewResult([LISTED_BATCH]) : viewResult([], 0),
    );
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'PreviewJournalEntryBatch').mockResolvedValue({
      Success: true,
      Candidates: CANDIDATES,
      TotalDebits: 30,
      TotalCredits: 30,
      GrossDebits: 30,
      GrossCredits: 30,
      OutOfOrderSkipCount: 0,
      BeforePostingStartCount: 0,
    });
  });

  async function render(): Promise<ComponentFixture<AccountingBatchesPageComponent>> {
    const fixture = TestBed.createComponent(AccountingBatchesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    return fixture;
  }

  it('shows a listed batch PostingDate as the stored day', async () => {
    const fixture = await render();
    const row = fixture.nativeElement.querySelector('.mja-batch-num')?.closest('tr') as HTMLTableRowElement | null;
    expect(row, 'the batch list rendered').not.toBeNull();
    const cells = Array.from(row!.cells, c => c.textContent?.trim());
    expect(cells).toContain('Aug 30, 2026'); // LISTED_BATCH.PostingDate
    expect(cells).not.toContain('Aug 29, 2026');
  });

  it('shows the preview covered range and each entry date as the stored days', async () => {
    const fixture = await render();
    await fixture.componentInstance.OpenBuildBatchModal();
    fixture.detectChanges();
    await fixture.whenStable();

    const range = [...fixture.nativeElement.querySelectorAll('.mja-fact-item')]
      .find((el: Element) => el.querySelector('.mja-fact-lbl')?.textContent?.trim() === 'Date Range')
      ?.querySelector('.mja-fact-val')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(range).toBe('Aug 3, 2026 → Sep 1, 2026');

    const entryDates = [...fixture.nativeElement.querySelectorAll('.mja-modal-table tbody tr')].map(
      (tr: Element) => (tr as HTMLTableRowElement).cells[2].textContent?.trim(),
    );
    expect(entryDates).toEqual(['Sep 1, 2026', 'Aug 3, 2026']);
  });
});

describe('AccountingBatchesPageComponent — entries held back by a posting start date', () => {
  useBusinessClock(AUGUST_CLOSE_IN_CHICAGO);

  beforeEach(() => {
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async () => viewResult([], 0));
  });

  async function openWith(heldBack: number): Promise<ComponentFixture<AccountingBatchesPageComponent>> {
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'PreviewJournalEntryBatch').mockResolvedValue({
      Success: true, Candidates: [], TotalDebits: 0, TotalCredits: 0, GrossDebits: 0, GrossCredits: 0, OutOfOrderSkipCount: 0, BeforePostingStartCount: heldBack,
    });
    const fixture = TestBed.createComponent(AccountingBatchesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.OpenBuildBatchModal();
    fixture.detectChanges();
    return fixture;
  }

  const banners = (fixture: ComponentFixture<AccountingBatchesPageComponent>): string[] =>
    [...fixture.nativeElement.querySelectorAll('.mja-banner[role="status"]')].map((el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '');

  it('says how many entries the posting start date holds back', async () => {
    const fixture = await openWith(3);
    expect(banners(fixture).some(b => b.includes("3 entries are dated before their company's posting start date and held back"))).toBe(true);
  });

  it('says nothing when none are held back', async () => {
    const fixture = await openWith(0);
    expect(banners(fixture).some(b => b.includes('posting start date'))).toBe(false);
  });
});

describe('AccountingBatchesPageComponent — overlapping Build Batch previews (#254)', () => {
  useBusinessClock(AUGUST_CLOSE_IN_CHICAGO);
  /** One deferred per preview call, settled by the spec in whatever order it chooses. */
  let pending: Array<{ resolve: (r: PreviewJournalEntryBatchResult) => void; reject: (e: Error) => void }>;

  const ENTRY_A = { ID: 'je-a', EntryNumber: 'JE-A', EffectiveDate: '2026-08-01', EntryTypeCode: 'Manual', CompanyID: 'co-1', Description: null, Amount: 100 };
  const ENTRY_B = { ID: 'je-b', EntryNumber: 'JE-B', EffectiveDate: '2026-08-02', EntryTypeCode: 'Manual', CompanyID: 'co-1', Description: null, Amount: 200 };
  const totals = (debits: number, skips: number): PreviewJournalEntryBatchResult => ({
    Success: true,
    Candidates: [ENTRY_A, ENTRY_B],
    TotalDebits: debits,
    TotalCredits: debits,
    GrossDebits: debits,
    GrossCredits: debits,
    OutOfOrderSkipCount: skips,
    BeforePostingStartCount: 0,
  });

  beforeEach(() => {
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async () => viewResult([], 0));
    pending = [];
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'PreviewJournalEntryBatch').mockImplementation(
      () => new Promise<PreviewJournalEntryBatchResult>((resolve, reject) => pending.push({ resolve, reject })),
    );
  });

  /** Renders the page and opens the modal with its first preview settled: both entries ticked. */
  async function openModal(): Promise<AccountingBatchesPageComponent> {
    const fixture = TestBed.createComponent(AccountingBatchesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    const opened = page.OpenBuildBatchModal();
    pending[0].resolve(totals(300, 0));
    await opened;
    expect(page.PreviewTotalDebits).toBe(300);
    return page;
  }

  it('applies only the latest response when an earlier one settles last', async () => {
    const page = await openModal();
    const untickA = page.ToggleEntry(ENTRY_A.ID); // previews B only
    const untickB = page.ToggleEntry(ENTRY_B.ID); // previews nothing ticked
    expect(pending).toHaveLength(3);

    pending[2].resolve(totals(0, 0));
    await untickB;
    expect(page.PreviewTotalDebits).toBe(0);
    expect(page.IsPreviewLoading).toBe(false);

    pending[1].resolve(totals(200, 1)); // the stale answer arrives last
    await untickA;
    expect(page.PreviewTotalDebits).toBe(0);
    expect(page.PreviewOutOfOrderSkipCount).toBe(0);
    expect(page.IsPreviewLoading).toBe(false);
  });

  it('stays loading until the latest request settles, even when an earlier one settles first', async () => {
    const page = await openModal();
    const first = page.ToggleEntry(ENTRY_A.ID);
    const second = page.ToggleEntry(ENTRY_B.ID);

    pending[1].resolve(totals(200, 1));
    await first;
    expect(page.IsPreviewLoading, 'an older response does not end the loading state').toBe(true);
    expect(page.PreviewTotalDebits, 'nor is it applied').toBe(300);

    pending[2].resolve(totals(0, 0));
    await second;
    expect(page.IsPreviewLoading).toBe(false);
    expect(page.PreviewTotalDebits).toBe(0);
  });

  it('ignores a failure from a superseded request', async () => {
    const page = await openModal();
    const first = page.ToggleEntry(ENTRY_A.ID);
    const second = page.ToggleEntry(ENTRY_B.ID);

    pending[2].resolve(totals(0, 0));
    await second;
    pending[1].reject(new Error('timeout'));
    await first;
    expect(page.ModalErrorMessage).toBeNull();
    expect(page.PreviewTotalDebits).toBe(0);
  });

  it('drops a response that arrives after the modal is closed', async () => {
    const page = await openModal();
    const toggled = page.ToggleEntry(ENTRY_A.ID);
    page.CloseBuildBatchModal();
    expect(page.IsPreviewLoading).toBe(false);

    pending[1].resolve(totals(200, 1));
    await toggled;
    expect(page.PreviewTotalDebits).toBe(300);
    expect(page.IsPreviewLoading).toBe(false);
  });
});

/**
 * The Build Batch modal's selection (golive #284): every candidate, or an explicit include set sent
 * to the preview as it is. The fake server below answers the way previewBatch does: it filters the
 * pool by the criteria, totals only the included ids that are in that pool, and counts the
 * out-of-order skips with the engine's own function. A request built from the previous response's
 * candidates, the defect, makes the totals and the ticks on screen disagree after a filter change.
 */
describe('AccountingBatchesPageComponent — Build Batch selection after Clear All and filter changes (golive #284, DOM)', () => {
  useBusinessClock(AUGUST_CLOSE_IN_CHICAGO);

  const entry = (n: number, type: string, day: string, amount: number): PreviewEntryWire => ({
    ID: `je-${n}`, EntryNumber: `JE-${n}`, EffectiveDate: `${day}T00:00:00.000Z`, EntryTypeCode: type, CompanyID: 'co-1', Description: null, Amount: amount,
  });
  // Oldest first, the order the engine returns candidates in.
  const POOL: PreviewEntryWire[] = [
    entry(1, 'Invoice', '2026-08-01', 100),
    entry(2, 'RevenueRecognition', '2026-08-02', 30),
    entry(3, 'Invoice', '2026-08-03', 200),
    entry(4, 'RevenueRecognition', '2026-08-04', 40),
    entry(5, 'Invoice', '2026-08-05', 300),
  ];
  let previewCalls: PreviewJournalEntryBatchOptionsInput[];
  let buildCalls: BuildJournalEntryBatchOptionsInput[];

  /** The engine's outOfOrderSkipCount (JournalEntryBatchEngine.ts), copied: this package does not depend on the server one. */
  function outOfOrderSkipCount(rows: PreviewEntryWire[], included: ReadonlySet<string>): number {
    const newest = rows.reduce((last, r, i) => (included.has(r.ID) ? i : last), -1);
    return rows.slice(0, Math.max(newest, 0)).filter(r => !included.has(r.ID)).length;
  }

  /** Mirrors previewBatch: criteria filter, totals over included ∩ pool, outOfOrderSkipCount. */
  function fakePreview(options: PreviewJournalEntryBatchOptionsInput): PreviewJournalEntryBatchResult {
    const excludedTypes = new Set(options.ExcludeEntryTypeCodes ?? []);
    const rows = POOL.filter(e => !excludedTypes.has(e.EntryTypeCode));
    const included = new Set(options.IncludedJournalEntryIDs ?? rows.map(r => r.ID));
    const total = rows.filter(r => included.has(r.ID)).reduce((sum, r) => sum + r.Amount, 0);
    return {
      Success: true,
      Candidates: rows,
      TotalDebits: total,
      TotalCredits: total,
      GrossDebits: total,
      GrossCredits: total,
      OutOfOrderSkipCount: outOfOrderSkipCount(rows, included),
      BeforePostingStartCount: 0,
    };
  }

  beforeEach(() => {
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async () => viewResult([], 0));
    previewCalls = [];
    buildCalls = [];
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'PreviewJournalEntryBatch').mockImplementation(async (options) => {
      previewCalls.push(options ?? {});
      return fakePreview(options ?? {});
    });
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'BuildJournalEntryBatch').mockImplementation(async (options) => {
      buildCalls.push(options as BuildJournalEntryBatchOptionsInput);
      return { Success: true, SummaryLineCount: 1, TotalDebits: 0, TotalCredits: 0, JECount: 1, CompanyCount: 1, NothingToBatch: false };
    });
  });

  async function openModal(): Promise<ComponentFixture<AccountingBatchesPageComponent>> {
    const fixture = TestBed.createComponent(AccountingBatchesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.OpenBuildBatchModal();
    fixture.detectChanges();
    return fixture;
  }

  /** Clicks a checkbox the way an operator does and waits for the preview it fires to land. */
  async function click(fixture: ComponentFixture<AccountingBatchesPageComponent>, selector: string): Promise<void> {
    const box = fixture.nativeElement.querySelector(selector) as HTMLInputElement | null;
    expect(box, `${selector} is on screen`).not.toBeNull();
    box!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsPreviewLoading).toBe(false));
    fixture.detectChanges();
  }

  const revRecFilter = 'label.mja-modal-checkbox-label input[type="checkbox"]';
  const clearAll = 'input[aria-label="Include every candidate"]';
  const row = (n: number) => `input[aria-label="Include JE-${n}"]`;

  /** What the operator reads: the header count, Entry Totals, the warning, the ticks and the Build button. */
  function screen(fixture: ComponentFixture<AccountingBatchesPageComponent>) {
    const el = fixture.nativeElement as HTMLElement;
    const fact = (label: string) =>
      Array.from(el.querySelectorAll('.mja-fact-item'))
        .find(f => f.querySelector('.mja-fact-lbl')?.textContent?.trim() === label)
        ?.querySelectorAll('.mja-fact-val');
    const build = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Build Batch (')) as HTMLButtonElement | undefined;
    return {
      Including: fact('Including')?.[0]?.textContent?.trim(),
      EntryTotals: Array.from(fact('Entry Totals') ?? [], (v: Element) => v.textContent?.trim()).join(' '),
      Warning: el.querySelector('.mja-banner[role="status"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      Ticked: Array.from(el.querySelectorAll<HTMLInputElement>('.mja-modal-table tbody input[type="checkbox"]'))
        .filter(b => b.checked)
        .map(b => b.getAttribute('aria-label')?.replace('Include ', '')),
      Build: build?.textContent?.trim(),
      BuildEnabled: build ? !build.disabled : false,
    };
  }

  it('after Clear All, unticking Exclude Rev Rec brings the recognition entries in unticked, and the totals stay at zero', async () => {
    const fixture = await openModal();
    expect(screen(fixture)).toMatchObject({ Including: '3 of 3 JEs', EntryTotals: 'Dr $600.00 Cr $600.00', Build: 'Build Batch (3)', BuildEnabled: true });

    await click(fixture, clearAll);
    expect(previewCalls.at(-1)?.IncludedJournalEntryIDs).toEqual([]);
    expect(screen(fixture)).toMatchObject({ Including: '0 of 3 JEs', EntryTotals: 'Dr $0.00 Cr $0.00', Ticked: [], Build: 'Build Batch (0)', BuildEnabled: false });

    await click(fixture, revRecFilter);
    expect(previewCalls.at(-1)).toMatchObject({ ExcludeEntryTypeCodes: null, IncludedJournalEntryIDs: [] });
    expect(screen(fixture)).toEqual({
      Including: '0 of 5 JEs',
      EntryTotals: 'Dr $0.00 Cr $0.00',
      Warning: null,
      Ticked: [],
      Build: 'Build Batch (0)',
      BuildEnabled: false,
    });
  });

  it('ticking one entry then totals that entry alone, counts the older unticked ones in the warning, and builds only it', async () => {
    const fixture = await openModal();
    await click(fixture, clearAll);
    await click(fixture, revRecFilter);

    await click(fixture, row(3));
    expect(previewCalls.at(-1)?.IncludedJournalEntryIDs).toEqual(['je-3']);
    expect(screen(fixture)).toEqual({
      Including: '1 of 5 JEs',
      EntryTotals: 'Dr $200.00 Cr $200.00',
      Warning: expect.stringContaining('2 excluded entries are older than an entry you included'),
      Ticked: ['JE-3'],
      Build: 'Build Batch (1)',
      BuildEnabled: true,
    });

    await fixture.componentInstance.ExecuteBuildBatch();
    expect(buildCalls.map(c => c.JournalEntryIDs)).toEqual([['je-3']]);
  });

  it('a filter change after unticking one keeps the request and the ticks the same selection', async () => {
    const fixture = await openModal();
    await click(fixture, row(1));
    expect(previewCalls.at(-1)?.IncludedJournalEntryIDs).toEqual(['je-3', 'je-5']);

    await click(fixture, revRecFilter);
    expect(previewCalls.at(-1)?.IncludedJournalEntryIDs).toEqual(['je-3', 'je-5']);
    expect(screen(fixture)).toEqual({
      Including: '2 of 5 JEs',
      EntryTotals: 'Dr $500.00 Cr $500.00',
      Warning: expect.stringContaining('3 excluded entries are older than an entry you included'),
      Ticked: ['JE-3', 'JE-5'],
      Build: 'Build Batch (2)',
      BuildEnabled: true,
    });
  });

  it('ticking every candidate again sends no selection, so later entries come in ticked', async () => {
    const fixture = await openModal();
    await click(fixture, clearAll);
    await click(fixture, clearAll);
    expect(previewCalls.at(-1)?.IncludedJournalEntryIDs).toBeNull();

    await click(fixture, revRecFilter);
    expect(screen(fixture)).toMatchObject({ Including: '5 of 5 JEs', EntryTotals: 'Dr $670.00 Cr $670.00', Build: 'Build Batch (5)' });
  });
});

describe('AccountingBatchesPageComponent — Cancel a batch (#183, golive #302)', () => {
  const APPROVED: BatchItem = { ...LISTED_BATCH, ID: '00000000-0000-0000-0000-000000000002', JournalEntryBatchNumber: 'JEB-TEST-0002', Status: 'Approved' };
  const FAILED: BatchItem = { ...LISTED_BATCH, ID: '00000000-0000-0000-0000-000000000003', JournalEntryBatchNumber: 'JEB-TEST-0003', Status: 'Failed' };
  let cancelCalls: { ID: string; Reason: string; Confirm: boolean }[];
  /**
   * What the server answers an unconfirmed Failed cancel, standing in for its ERP lookup (#207):
   * null = nothing posted, so it cancels; otherwise the refusal the operator must answer.
   */
  let unconfirmedFailedAnswer: CancelJournalEntryBatchResult | null;

  beforeEach(() => {
    signInAs(BUILDER_USER_ID);
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) =>
      p.EntityName === BATCH_ENTITY ? viewResult([LISTED_BATCH, APPROVED, FAILED]) : viewResult([], 0),
    );
    cancelCalls = [];
    unconfirmedFailedAnswer = null;
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'CancelBatch').mockImplementation(async (id, reason, confirm = false) => {
      cancelCalls.push({ ID: id, Reason: reason, Confirm: confirm });
      if (id === FAILED.ID && !confirm && unconfirmedFailedAnswer) return unconfirmedFailedAnswer;
      return { Success: true, Status: 'Cancelled' };
    });
  });

  async function render(): Promise<AccountingBatchesPageComponent> {
    const fixture = TestBed.createComponent(AccountingBatchesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    return fixture.componentInstance;
  }

  it('offers Cancel on Pending (golive #302), Approved and Failed batches but not on a closed one', async () => {
    const page = await render();
    expect(page.CanCancel(LISTED_BATCH)).toBe(true);
    expect(page.CanCancel(APPROVED)).toBe(true);
    expect(page.CanCancel(FAILED)).toBe(true);
    expect(page.CanCancel({ ...LISTED_BATCH, Status: 'Cancelled' })).toBe(false);
    expect(page.CanCancel({ ...LISTED_BATCH, Status: 'Posted' })).toBe(false);
  });

  it('cancels a Pending batch with the reason, unconfirmed (golive #302)', async () => {
    const page = await render();
    page.OnCancel(LISTED_BATCH, new Event('click'));
    page.CancelReasonDraft = '  Built with the wrong entries  ';
    await page.ConfirmCancel();
    expect(cancelCalls).toEqual([{ ID: LISTED_BATCH.ID, Reason: 'Built with the wrong entries', Confirm: false }]);
    expect(page.ActionMessageIsError).toBe(false);
    expect(page.CancelModalVisible).toBe(false);
  });

  it('does not cancel with a blank reason', async () => {
    const page = await render();
    page.OnCancel(APPROVED, new Event('click'));
    page.CancelReasonDraft = '   ';
    await page.ConfirmCancel();
    expect(cancelCalls).toEqual([]);
  });

  it('cancels an Approved batch without the ERP confirmation', async () => {
    const page = await render();
    page.OnCancel(APPROVED, new Event('click'));
    page.CancelReasonDraft = '  wrong period  ';
    await page.ConfirmCancel();
    expect(cancelCalls).toEqual([{ ID: APPROVED.ID, Reason: 'wrong period', Confirm: false }]);
    expect(page.ActionMessageIsError).toBe(false);
    expect(page.CancelModalVisible).toBe(false);
  });

  it('cancels a Failed batch on the first attempt, unconfirmed, when the server finds nothing in the ERP', async () => {
    const page = await render();
    page.OnCancel(FAILED, new Event('click'));
    page.CancelReasonDraft = 'ERP rejected the journal';
    await page.ConfirmCancel();
    expect(cancelCalls).toEqual([{ ID: FAILED.ID, Reason: 'ERP rejected the journal', Confirm: false }]);
    expect(page.CancelModalVisible).toBe(false);
    expect(page.ActionMessageIsError).toBe(false);
  });

  it('asks for the ERP check only when the server cannot settle it, then sends the confirmation', async () => {
    unconfirmedFailedAnswer = { Success: true, Status: 'Failed', ConfirmationRequired: 'could not check the ERP for document JEB-TEST-0003: timeout', ConfirmationKind: 'Error' };
    const page = await render();
    page.OnCancel(FAILED, new Event('click'));
    page.CancelReasonDraft = 'ERP rejected the journal';
    await page.ConfirmCancel();

    expect(page.CancelModalVisible).toBe(true);
    expect(page.CancelERPCheckReason).toMatch(/could not check the ERP/);
    expect(page.CanConfirmCancel).toBe(false); // the checkbox is the operator's word

    page.CancelConfirmNotPostedInERP = true;
    await page.ConfirmCancel();
    expect(cancelCalls.map((c) => c.Confirm)).toEqual([false, true]);
    expect(page.CancelModalVisible).toBe(false);
  });

  it('needs the batch number retyped to cancel past a Mismatch — the checkbox is not enough', async () => {
    unconfirmedFailedAnswer = { Success: true, Status: 'Failed', ConfirmationRequired: 'the ERP already holds document JEB-TEST-0003, and it does not match', ConfirmationKind: 'Mismatch' };
    const page = await render();
    page.OnCancel(FAILED, new Event('click'));
    page.CancelReasonDraft = 'ERP rejected the journal';
    await page.ConfirmCancel();

    page.CancelConfirmNotPostedInERP = true;
    page.CancelMismatchText = 'JEB-TEST-000';
    expect(page.CanConfirmCancel).toBe(false);
    page.CancelMismatchText = 'JEB-TEST-0003';
    expect(page.CanConfirmCancel).toBe(true);
    await page.ConfirmCancel();
    expect(cancelCalls.map((c) => c.Confirm)).toEqual([false, true]);
  });

  it('shows the refusal when the ERP holds the batch, and does not ask to override it', async () => {
    unconfirmedFailedAnswer = { Success: false, ErrorMessage: 'the ERP already holds document JEB-TEST-0003 and it matches this batch, so the batch posted. Retry it from Dispatch status instead' };
    const page = await render();
    page.OnCancel(FAILED, new Event('click'));
    page.CancelReasonDraft = 'ERP rejected the journal';
    await page.ConfirmCancel();

    expect(cancelCalls).toHaveLength(1);
    expect(page.ActionMessageIsError).toBe(true);
    expect(page.ActionMessage).toMatch(/so the batch posted/);
    expect(page.CancelERPCheckReason).toBeNull();
    expect(page.CancelModalVisible).toBe(false); // the refusal is on the page, not behind the modal
  });
});

/**
 * #308: on a Pending batch the Cancel button shows only to the users the server lets cancel it, the
 * company's approver or the batch's builder. A batch the nightly job built has the system user as its
 * builder, so only the approver sees it.
 */
describe('AccountingBatchesPageComponent — who sees Cancel on a Pending batch (#308, DOM)', () => {
  const NIGHTLY: BatchItem = {
    ...LISTED_BATCH,
    ID: '00000000-0000-0000-0000-000000000004',
    JournalEntryBatchNumber: 'JEB-TEST-0004',
    BatchedByUserID: SYSTEM_USER_ID,
  };
  const APPROVED: BatchItem = { ...LISTED_BATCH, ID: '00000000-0000-0000-0000-000000000002', JournalEntryBatchNumber: 'JEB-TEST-0002', Status: 'Approved' };
  /** The profile read the page answers with; a case can make it fail. */
  let profilesRead: boolean;

  beforeEach(() => {
    profilesRead = true;
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      if (p.EntityName === BATCH_ENTITY) return viewResult([LISTED_BATCH, NIGHTLY, APPROVED]);
      if (p.EntityName === COMPANY_PROFILE_ENTITY) {
        return profilesRead
          ? viewResult([{ ID: COMPANY_ID, ApprovalCFOUserID: APPROVER_USER_ID }])
          : { ...viewResult([]), Success: false, ErrorMessage: 'read refused' };
      }
      return viewResult([], 0);
    });
  });

  /** The batch numbers whose row shows a Cancel button. */
  async function rowsOfferingCancel(): Promise<string[]> {
    const fixture = TestBed.createComponent(AccountingBatchesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('tr'));
    return rows
      .filter(row => Array.from(row.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Cancel'))
      .map(row => row.querySelector('.mja-batch-num')?.textContent?.trim() ?? '');
  }

  it("shows the builder Cancel on their own Pending batch, not on the nightly job's", async () => {
    signInAs(BUILDER_USER_ID);
    expect(await rowsOfferingCancel()).toEqual(['JEB-TEST-0001', 'JEB-TEST-0002']);
  });

  it("shows the company's approver Cancel on every Pending batch, the nightly job's included", async () => {
    signInAs(APPROVER_USER_ID);
    expect(await rowsOfferingCancel()).toEqual(['JEB-TEST-0001', 'JEB-TEST-0004', 'JEB-TEST-0002']);
  });

  it('shows anyone else no Cancel on a Pending batch; past approval the server still decides', async () => {
    signInAs(OTHER_USER_ID);
    expect(await rowsOfferingCancel()).toEqual(['JEB-TEST-0002']);
  });

  it('shows only the builder Cancel when the approvers cannot be read', async () => {
    profilesRead = false;
    signInAs(APPROVER_USER_ID);
    expect(await rowsOfferingCancel()).toEqual(['JEB-TEST-0002']);
  });
});
