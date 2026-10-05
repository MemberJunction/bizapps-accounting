import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { RunView, RunViewParams } from '@memberjunction/core';
import { AccountingBatchesPageComponent, BatchItem } from './accounting-batches.component';
import {
  CancelJournalEntryBatchResult,
  JournalEntryBatchDispatchClient,
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
