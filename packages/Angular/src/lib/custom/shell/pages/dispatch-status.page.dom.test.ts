import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { IMetadataProvider, Metadata, RunView, RunViewParams, UserInfo } from '@memberjunction/core';
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
const COMPANY_PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const BATCH_NUMBER = 'JEB-TEST-0207';
const COMPANY_ID = '00000000-0000-0000-0000-0000000000c1';
const APPROVER_USER_ID = '00000000-0000-0000-0000-0000000000a1';
/** The user recorded as having approved the batch, who may cancel it past approval. */
const APPROVED_BY_USER_ID = '00000000-0000-0000-0000-0000000000d1';
const OTHER_USER_ID = '00000000-0000-0000-0000-0000000000f1';

async function failedBatch(): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const batch = await entityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY);
  batch.NewRecord();
  batch.JournalEntryBatchNumber = BATCH_NUMBER;
  batch.Status = 'Failed';
  batch.TargetSystem = 'BusinessCentral';
  batch.CompanyID = COMPANY_ID;
  batch.ApprovedByUserID = APPROVED_BY_USER_ID;
  return batch;
}

/** Sign in as `userId`: the page reads the current user from the global provider, which keeps the stub's members. */
function signInAs(userId: string): void {
  const user = new UserInfo();
  user.ID = userId;
  const stub = Metadata.Provider;
  const provider: IMetadataProvider = Object.assign(Object.create(stub), { CurrentUser: user });
  vi.spyOn(Metadata, 'Provider', 'get').mockReturnValue(provider);
}

/** Answer the approver read: the company's approver, or a failed read. */
function stubApproverRead(succeeds = true): void {
  vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
    if (p.EntityName !== COMPANY_PROFILE_ENTITY) return viewResult([], 0);
    return succeeds
      ? viewResult([{ ID: COMPANY_ID, ApprovalCFOUserID: APPROVER_USER_ID }])
      : { ...viewResult([]), Success: false, ErrorMessage: 'read refused' };
  });
}

/** Configure the page with its grid template removed; the cancel flow is component state. */
async function configurePage(): Promise<void> {
  await TestBed.configureTestingModule({
    declarations: [DispatchStatusPageComponent],
    providers: [PageRefreshService],
  })
    .overrideComponent(DispatchStatusPageComponent, { set: { template: '' } })
    .compileComponents();
}

/** Render the page and wait for its first load (the failed batches and the approvers). */
async function renderPage(): Promise<DispatchStatusPageComponent> {
  const fixture = TestBed.createComponent(DispatchStatusPageComponent);
  fixture.componentRef.setInput('Provider', stubbedReadsProvider());
  fixture.detectChanges();
  await fixture.whenStable();
  await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
  return fixture.componentInstance;
}

/** The page's batched reads and the stranded-entries call, answered empty. */
function stubPageLoads(): void {
  installStubProvider([stubEntityInfo(BATCH_ENTITY, ['ID', 'JournalEntryBatchNumber', 'Status', 'TargetSystem', 'TotalEntries', 'CompanyID', 'ApprovedByUserID'])]);
  vi.spyOn(RunView.prototype, 'RunViews').mockResolvedValue([viewResult([], 0), viewResult([], 0)]);
  vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'GetStrandedJournalEntries')
    .mockResolvedValue({ Success: true, Batches: [], JournalEntryCount: 0 });
}

describe('DispatchStatusPageComponent — cancelling a Failed batch (#207)', () => {
  let cancelCalls: boolean[];
  /** What the server answers an unconfirmed cancel; null = its lookup found nothing, so it cancels. */
  let unconfirmedAnswer: CancelJournalEntryBatchResult | null;

  beforeEach(async () => {
    stubPageLoads();
    stubApproverRead();
    signInAs(APPROVED_BY_USER_ID);
    cancelCalls = [];
    unconfirmedAnswer = null;
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'CancelBatch').mockImplementation(async (_id, _reason, confirm = false) => {
      cancelCalls.push(confirm);
      if (!confirm && unconfirmedAnswer) return unconfirmedAnswer;
      return { Success: true, Status: 'Cancelled' };
    });
    await configurePage();
  });

  async function openCancel(): Promise<DispatchStatusPageComponent> {
    const page = await renderPage();
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

/**
 * #339: Cancel on a Failed batch shows only to the users the server lets cancel it past approval, the
 * company's approver or the user who approved the batch.
 */
describe('DispatchStatusPageComponent — who sees Cancel on a Failed batch (#339)', () => {
  beforeEach(async () => {
    stubPageLoads();
    await configurePage();
  });

  it("shows Cancel to the company's approver and the user who approved the batch", async () => {
    stubApproverRead();
    signInAs(APPROVER_USER_ID);
    expect((await renderPage()).MayCancelBatch(await failedBatch())).toBe(true);
    signInAs(APPROVED_BY_USER_ID);
    expect((await renderPage()).MayCancelBatch(await failedBatch())).toBe(true);
  });

  it('shows anyone else no Cancel, and does not open the dialog for them', async () => {
    stubApproverRead();
    signInAs(OTHER_USER_ID);
    const page = await renderPage();
    const batch = await failedBatch();
    expect(page.MayCancelBatch(batch)).toBe(false);
    page.CancelBatch(batch);
    expect(page.CancelConfirmBatch).toBeNull();
  });

  it('shows Cancel only to the user who approved the batch when the approvers cannot be read', async () => {
    stubApproverRead(false);
    signInAs(APPROVER_USER_ID);
    expect((await renderPage()).MayCancelBatch(await failedBatch())).toBe(false);
    signInAs(APPROVED_BY_USER_ID);
    expect((await renderPage()).MayCancelBatch(await failedBatch())).toBe(true);
  });
});
