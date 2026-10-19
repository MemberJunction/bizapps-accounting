import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RunView } from '@memberjunction/core';
import type { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import { DispatchStatusPageComponent } from './dispatch-status.page';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import {
  CancelJournalEntryBatchResult,
  JournalEntryBatchDispatchClient,
} from '../../JournalEntryBatchDispatch/journal-entry-batch-dispatch.client';
import { stubbedReadsProvider, viewResult } from '../../../../__tests__/support/business-clock';
import { entityObject, installStubProvider, stubEntityInfo } from '../../../../__tests__/support/entity-stubs';

/**
 * #207: cancelling a Failed batch from Dispatch status. The server looks the batch number up in the
 * ERP first, so the first attempt carries NO confirmation; the dialog asks only when the server's
 * lookup cannot settle it, and only that second attempt sends the operator's word. A posting the
 * ERP holds is a refusal with no override.
 *
 * The page's grid is not under test, so its template is replaced; the cancel flow is component state.
 */
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const BATCH_NUMBER = 'JEB-TEST-0207';

async function failedBatch(): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const batch = await entityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY);
  batch.NewRecord();
  batch.JournalEntryBatchNumber = BATCH_NUMBER;
  batch.Status = 'Failed';
  batch.TargetSystem = 'BusinessCentral';
  return batch;
}

describe('DispatchStatusPageComponent — cancelling a Failed batch (#207)', () => {
  let cancelCalls: boolean[];
  /** What the server answers an unconfirmed cancel; null = its lookup found nothing, so it cancels. */
  let unconfirmedAnswer: CancelJournalEntryBatchResult | null;

  beforeEach(async () => {
    installStubProvider([stubEntityInfo(BATCH_ENTITY, ['ID', 'JournalEntryBatchNumber', 'Status', 'TargetSystem', 'TotalEntries'])]);
    vi.spyOn(RunView.prototype, 'RunViews').mockResolvedValue([viewResult([], 0), viewResult([], 0)]);
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'GetStrandedJournalEntries')
      .mockResolvedValue({ Success: true, Batches: [], JournalEntryCount: 0 });
    cancelCalls = [];
    unconfirmedAnswer = null;
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'CancelBatch').mockImplementation(async (_id, _reason, confirm = false) => {
      cancelCalls.push(confirm);
      if (!confirm && unconfirmedAnswer) return unconfirmedAnswer;
      return { Success: true, Status: 'Cancelled' };
    });
    await TestBed.configureTestingModule({
      declarations: [DispatchStatusPageComponent],
      providers: [PageRefreshService],
    })
      .overrideComponent(DispatchStatusPageComponent, { set: { template: '' } })
      .compileComponents();
  });

  async function openCancel(): Promise<DispatchStatusPageComponent> {
    const fixture = TestBed.createComponent(DispatchStatusPageComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.CancelBatch(await failedBatch());
    page.CancelReason = 'ERP rejected the journal';
    return page;
  }

  it('cancels on the first attempt, unconfirmed, when the server finds nothing in the ERP', async () => {
    const page = await openCancel();
    await page.ConfirmCancelBatch();

    expect(cancelCalls).toEqual([false]);
    expect(page.CancelConfirmBatch).toBeNull();
    expect(page.ActionIsError).toBe(false);
  });

  it('asks only when the lookup cannot settle it, keeping the reason, then sends the confirmation', async () => {
    unconfirmedAnswer = { Success: true, Status: 'Failed', ConfirmationRequired: 'could not check the ERP: timeout', ConfirmationKind: 'Error' };
    const page = await openCancel();
    await page.ConfirmCancelBatch();

    expect(cancelCalls).toEqual([false]);
    expect(page.CancelConfirmBatch).not.toBeNull();
    expect(page.CancelERPCheckReason).toMatch(/could not check the ERP/);
    expect(page.CancelReason).toBe('ERP rejected the journal');

    await page.ConfirmCancelBatch();
    expect(cancelCalls).toEqual([false, true]);
    expect(page.CancelConfirmBatch).toBeNull();
  });

  it('needs the batch number retyped to cancel past a Mismatch', async () => {
    unconfirmedAnswer = { Success: true, Status: 'Failed', ConfirmationRequired: 'the ERP already holds this document', ConfirmationKind: 'Mismatch' };
    const page = await openCancel();
    await page.ConfirmCancelBatch();

    expect(page.CanConfirmCancelBatch).toBe(false);
    page.CancelMismatchText = 'JEB-TEST-020';
    expect(page.CanConfirmCancelBatch).toBe(false);
    page.CancelMismatchText = BATCH_NUMBER;
    expect(page.CanConfirmCancelBatch).toBe(true);
    await page.ConfirmCancelBatch();
    expect(cancelCalls).toEqual([false, true]);
  });

  it('closes on the refusal when the ERP holds the batch, and never sends a confirmation', async () => {
    unconfirmedAnswer = { Success: false, ErrorMessage: 'the ERP already holds document JEB-TEST-0207 and it matches this batch, so the batch posted.' };
    const page = await openCancel();
    await page.ConfirmCancelBatch();

    expect(cancelCalls).toEqual([false]);
    expect(page.CancelConfirmBatch).toBeNull();
    expect(page.ActionIsError).toBe(true);
    expect(page.ActionMessage).toMatch(/so the batch posted/);
  });
});
