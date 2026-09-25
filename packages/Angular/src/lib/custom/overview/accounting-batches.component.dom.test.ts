import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { RunView, RunViewParams } from '@memberjunction/core';
import { AccountingBatchesPageComponent, BatchItem } from './accounting-batches.component';
import {
  JournalEntryBatchDispatchClient,
  PreviewJournalEntryBatchOptionsInput,
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
      return { Success: true, Candidates: [], TotalDebits: 0, TotalCredits: 0, OutOfOrderSkipCount: 0 };
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
});

describe('AccountingBatchesPageComponent — Cancel an Approved/Failed batch (#183)', () => {
  const APPROVED: BatchItem = { ...LISTED_BATCH, ID: '00000000-0000-0000-0000-000000000002', JournalEntryBatchNumber: 'JEB-TEST-0002', Status: 'Approved' };
  const FAILED: BatchItem = { ...LISTED_BATCH, ID: '00000000-0000-0000-0000-000000000003', JournalEntryBatchNumber: 'JEB-TEST-0003', Status: 'Failed' };
  let cancelCalls: { ID: string; Reason: string; Confirm: boolean }[];

  beforeEach(() => {
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) =>
      p.EntityName === BATCH_ENTITY ? viewResult([LISTED_BATCH, APPROVED, FAILED]) : viewResult([], 0),
    );
    cancelCalls = [];
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'CancelBatch').mockImplementation(async (id, reason, confirm = false) => {
      cancelCalls.push({ ID: id, Reason: reason, Confirm: confirm });
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

  it('offers Cancel on Approved and Failed batches but not on Pending', async () => {
    const page = await render();
    expect(page.CanCancelApproved(APPROVED)).toBe(true);
    expect(page.CanCancelApproved(FAILED)).toBe(true);
    expect(page.CanCancelApproved(LISTED_BATCH)).toBe(false);
  });

  it('does not cancel with a blank reason', async () => {
    const page = await render();
    page.OnCancelApproved(APPROVED, new Event('click'));
    page.CancelReasonDraft = '   ';
    await page.ConfirmCancelApproved();
    expect(cancelCalls).toEqual([]);
  });

  it('cancels an Approved batch without the ERP confirmation', async () => {
    const page = await render();
    page.OnCancelApproved(APPROVED, new Event('click'));
    page.CancelReasonDraft = '  wrong period  ';
    await page.ConfirmCancelApproved();
    expect(cancelCalls).toEqual([{ ID: APPROVED.ID, Reason: 'wrong period', Confirm: false }]);
    expect(page.ActionMessageIsError).toBe(false);
    expect(page.CancelModalVisible).toBe(false);
  });

  it('does not cancel a Failed batch until the operator confirms it has not posted in the ERP', async () => {
    const page = await render();
    page.OnCancelApproved(FAILED, new Event('click'));
    page.CancelReasonDraft = 'ERP rejected the journal';
    await page.ConfirmCancelApproved();
    expect(cancelCalls).toEqual([]);

    page.CancelConfirmNotPostedInERP = true;
    await page.ConfirmCancelApproved();
    expect(cancelCalls).toEqual([{ ID: FAILED.ID, Reason: 'ERP rejected the journal', Confirm: true }]);
  });
});
