import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { IMetadataProvider, RunView, RunViewParams, UserInfo } from '@memberjunction/core';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import { JournalEntryBatchDispatchDashboardComponent } from './journal-entry-batch-dispatch-dashboard.component';
import { JournalEntryBatchDispatchModule } from './journal-entry-batch-dispatch.module';
import { JournalEntryBatchDispatchClient, DispatchJournalEntryBatchResult, CancelJournalEntryBatchResult } from './journal-entry-batch-dispatch.client';
import { stubbedReadsProvider, viewResult } from '../../../__tests__/support/business-clock';

/**
 * #192: a first dispatch reports success only when the batch POSTED. The dispatch call returns
 * `Success` when the ERP rejects the batch too, so `{ Success: true, Status: 'Failed' }` must show
 * the error banner. Every outcome reloads the list, including a failed call: the server can throw
 * after the batch has already moved, and the card must not keep offering Dispatch.
 */
type BatchStatus = mjBizAppsAccountingJournalEntryBatchEntity['Status'];

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const BATCH_NUMBER = 'JEB-TEST-0001';
const COMPANY_PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const COMPANY_ID = '00000000-0000-0000-0000-0000000000c1';
const BUILDER_USER_ID = '00000000-0000-0000-0000-0000000000b1';
const APPROVER_USER_ID = '00000000-0000-0000-0000-0000000000a1';
const OTHER_USER_ID = '00000000-0000-0000-0000-0000000000f1';
/** The MJ system user, which the nightly job builds as. */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-0000000000e1';

/** A provider signed in as `userId`; every read is stubbed at `RunView.prototype`. */
function providerSignedInAs(userId: string): IMetadataProvider {
  const user = new UserInfo();
  user.ID = userId;
  const provider: Pick<IMetadataProvider, 'CurrentUser'> = { CurrentUser: user };
  return provider as IMetadataProvider;
}

function batchRow(status: BatchStatus): Record<string, unknown> {
  return {
    ID: '00000000-0000-0000-0000-000000000001',
    JournalEntryBatchNumber: BATCH_NUMBER,
    Status: status,
    TargetSystem: 'BusinessCentral',
    TotalEntries: 1,
    TotalDebits: 100,
    TotalCredits: 100,
    ExternalJournalEntryBatchRef: null,
    ErrorMessage: null,
    ArchiveReason: null,
    CompanyID: COMPANY_ID,
    BatchedByUserID: BUILDER_USER_ID,
  };
}

describe('JournalEntryBatchDispatchDashboardComponent — first dispatch outcome (DOM)', () => {
  /** The status the batch list answers with; a case moves it to what the server left behind. */
  let listedStatus: BatchStatus;
  let batchReads: number;

  beforeEach(async () => {
    listedStatus = 'Approved';
    batchReads = 0;
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      if (p.EntityName !== BATCH_ENTITY) return viewResult([], 0);
      batchReads++;
      return viewResult([batchRow(listedStatus)]);
    });
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'GetApprovalState').mockResolvedValue({ Success: true, Approved: true });
    await TestBed.configureTestingModule({ imports: [JournalEntryBatchDispatchModule] }).compileComponents();
  });

  async function render(): Promise<ComponentFixture<JournalEntryBatchDispatchDashboardComponent>> {
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    return fixture;
  }

  function dispatchButton(fixture: ComponentFixture<JournalEntryBatchDispatchDashboardComponent>): HTMLButtonElement | undefined {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.bd-card__actions button'));
    return buttons.find(b => b.textContent?.includes('Dispatch to'));
  }

  /** Click Dispatch with the server answering `result` and leaving the batch at `after`. */
  async function dispatch(result: DispatchJournalEntryBatchResult, after: BatchStatus): Promise<HTMLElement> {
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'DispatchJournalEntryBatch').mockImplementation(async () => {
      listedStatus = after;
      return result;
    });
    const fixture = await render();
    const button = dispatchButton(fixture);
    expect(button, 'an Approved batch offers Dispatch').toBeTruthy();
    button!.click();
    await vi.waitFor(() => expect(batchReads, 'the list reloaded after the dispatch').toBe(2));
    await fixture.whenStable();
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.bd-banner[role="status"]') as HTMLElement | null;
    expect(banner, 'the action banner renders').not.toBeNull();
    expect(dispatchButton(fixture), 'no Dispatch button after the reload').toBeUndefined();
    return banner!;
  }

  it('shows an ERP rejection (Success with Status Failed) as an error', async () => {
    const banner = await dispatch({ Success: true, Status: 'Failed' }, 'Failed');
    expect(banner.classList).toContain('bd-banner--error');
    expect(banner.textContent).toContain(`Batch ${BATCH_NUMBER} did not post — the batch is Failed.`);
  });

  it('shows a Posted dispatch as a success', async () => {
    const banner = await dispatch({ Success: true, Status: 'Posted', ExternalJournalEntryBatchRef: 'ERP-1' }, 'Posted');
    expect(banner.classList).toContain('bd-banner--success');
    expect(banner.textContent).toContain(`Dispatched batch ${BATCH_NUMBER} → Posted (ref ERP-1).`);
  });

  it('shows a failed call as an error and still reloads the batch the server moved', async () => {
    const banner = await dispatch({ Success: false, ErrorMessage: 'Marking the batch Posted did not save.' }, 'Sent');
    expect(banner.classList).toContain('bd-banner--error');
    expect(banner.textContent).toContain('Marking the batch Posted did not save.');
  });
});

/**
 * #207: cancelling a Failed batch from Batch Dispatch. The server looks the batch number up in the ERP
 * first, so the first attempt carries NO confirmation; the operator is asked (natively) only when the
 * lookup cannot settle it, and a Mismatch needs the batch number typed.
 */
describe('JournalEntryBatchDispatchDashboardComponent — cancelling a Failed batch (#207)', () => {
  let cancelCalls: boolean[];
  /** What the server answers an unconfirmed cancel; null = its lookup found nothing, so it cancels. */
  let unconfirmedAnswer: CancelJournalEntryBatchResult | null;
  let confirmSpy: MockInstance<typeof window.confirm>;

  beforeEach(async () => {
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) =>
      p.EntityName === BATCH_ENTITY ? viewResult([batchRow('Failed')]) : viewResult([], 0),
    );
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'GetApprovalState').mockResolvedValue({ Success: true, Approved: true });
    cancelCalls = [];
    unconfirmedAnswer = null;
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'CancelBatch').mockImplementation(async (_id, _reason, confirm = false) => {
      cancelCalls.push(confirm);
      if (!confirm && unconfirmedAnswer) return unconfirmedAnswer;
      return { Success: true, Status: 'Cancelled' };
    });
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await TestBed.configureTestingModule({ imports: [JournalEntryBatchDispatchModule] }).compileComponents();
  });

  /** Render, then answer the native prompts: the reason first, then (for a Mismatch) the typed number. */
  async function cancel(...promptAnswers: string[]): Promise<JournalEntryBatchDispatchDashboardComponent> {
    const answers = [...promptAnswers];
    vi.spyOn(window, 'prompt').mockImplementation(() => answers.shift() ?? null);
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    const dashboard = fixture.componentInstance;
    const row = dashboard.Batches[0];
    expect(dashboard.canCancel(row), 'a Failed batch offers Cancel').toBe(true);
    await dashboard.OnCancel(row);
    return dashboard;
  }

  it('does not offer Cancel on a Failed batch carrying the ERP reference: the ERP accepted it', async () => {
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    const row = { ...fixture.componentInstance.Batches[0], ExternalJournalEntryBatchRef: 'G00042' };

    expect(fixture.componentInstance.canCancel(row)).toBe(false);
  });

  it('cancels on the first attempt, unconfirmed, without asking, when the server finds nothing in the ERP', async () => {
    const dashboard = await cancel('ERP rejected the journal');
    expect(cancelCalls).toEqual([false]);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(dashboard.ActionMessageIsError).toBe(false);
  });

  it('asks only when the lookup cannot settle it, showing the server reason, then sends the confirmation', async () => {
    unconfirmedAnswer = { Success: true, Status: 'Failed', ConfirmationRequired: 'could not check the ERP: timeout', ConfirmationKind: 'Error' };
    await cancel('ERP rejected the journal');
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('could not check the ERP: timeout'));
    expect(cancelCalls).toEqual([false, true]);
  });

  it('leaves the batch alone when the operator declines the ERP check', async () => {
    unconfirmedAnswer = { Success: true, Status: 'Failed', ConfirmationRequired: 'could not check the ERP: timeout', ConfirmationKind: 'Error' };
    confirmSpy.mockReturnValue(false);
    const dashboard = await cancel('ERP rejected the journal');
    expect(cancelCalls).toEqual([false]);
    expect(dashboard.ActionMessage).toBe(`Batch ${BATCH_NUMBER} was not cancelled.`);
  });

  it('needs the batch number typed to cancel past a Mismatch', async () => {
    unconfirmedAnswer = { Success: true, Status: 'Failed', ConfirmationRequired: 'the ERP already holds this document', ConfirmationKind: 'Mismatch' };
    await cancel('ERP rejected the journal', 'JEB-TEST-000');
    expect(cancelCalls).toEqual([false]);

    cancelCalls = [];
    await cancel('ERP rejected the journal', BATCH_NUMBER);
    expect(cancelCalls).toEqual([false, true]);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('shows the refusal when the ERP holds the batch, and never sends a confirmation', async () => {
    unconfirmedAnswer = { Success: false, ErrorMessage: 'the ERP already holds document JEB-TEST-0001 and it matches this batch, so the batch posted.' };
    const dashboard = await cancel('ERP rejected the journal');
    expect(cancelCalls).toEqual([false]);
    expect(dashboard.ActionMessageIsError).toBe(true);
    expect(dashboard.ActionMessage).toMatch(/so the batch posted/);
  });
});

/**
 * golive #302: a Pending batch can be cancelled, not only rejected. Cancel is the builder's way to
 * withdraw it (the server decides who may); Reject is the CFO's decision, and now asks for a reason.
 */
describe('JournalEntryBatchDispatchDashboardComponent — a Pending batch (golive #302)', () => {
  let cancelCalls: Array<{ Reason: string; Confirm: boolean }>;
  let decisionCalls: Array<{ Decision: string; Notes: string | undefined }>;

  beforeEach(async () => {
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) =>
      p.EntityName === BATCH_ENTITY ? viewResult([batchRow('Pending')]) : viewResult([], 0),
    );
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'GetApprovalState').mockResolvedValue({ Success: true, Approved: false });
    cancelCalls = [];
    decisionCalls = [];
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'CancelBatch').mockImplementation(async (_id, reason, confirm = false) => {
      cancelCalls.push({ Reason: reason, Confirm: confirm });
      return { Success: true, Status: 'Cancelled' };
    });
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'RecordDecision').mockImplementation(async (_id, decision, notes) => {
      decisionCalls.push({ Decision: decision, Notes: notes });
      return { Success: true };
    });
    await TestBed.configureTestingModule({ imports: [JournalEntryBatchDispatchModule] }).compileComponents();
  });

  async function render(...promptAnswers: Array<string | null>): Promise<JournalEntryBatchDispatchDashboardComponent> {
    const answers = [...promptAnswers];
    vi.spyOn(window, 'prompt').mockImplementation(() => answers.shift() ?? null);
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', providerSignedInAs(BUILDER_USER_ID));
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    return fixture.componentInstance;
  }

  it('offers Cancel beside Reject on a Pending batch', async () => {
    const dashboard = await render();
    const row = dashboard.Batches[0];
    expect(dashboard.canCancel(row)).toBe(true);
    expect(dashboard.canDecide(row)).toBe(true);
  });

  it('cancels a Pending batch with the reason, unconfirmed', async () => {
    const dashboard = await render('  Built with the wrong entries  ');
    await dashboard.OnCancel(dashboard.Batches[0]);
    expect(cancelCalls).toEqual([{ Reason: 'Built with the wrong entries', Confirm: false }]);
    expect(dashboard.ActionMessageIsError).toBe(false);
  });

  it('sends a rejection with its reason as the decision notes', async () => {
    const dashboard = await render('  Wrong period  ');
    await dashboard.OnRecordDecision(dashboard.Batches[0], 'Rejected');
    expect(decisionCalls).toEqual([{ Decision: 'Rejected', Notes: 'Wrong period' }]);
  });

  it.each([null, '   '])('does not reject without a reason (%s)', async (answer) => {
    const dashboard = await render(answer);
    await dashboard.OnRecordDecision(dashboard.Batches[0], 'Rejected');
    expect(decisionCalls).toEqual([]);
  });

  it('approves without asking for a reason', async () => {
    const dashboard = await render();
    await dashboard.OnRecordDecision(dashboard.Batches[0], 'Approved');
    expect(window.prompt).not.toHaveBeenCalled();
    expect(decisionCalls).toEqual([{ Decision: 'Approved', Notes: undefined }]);
  });
});

/**
 * #308: on a Pending batch the Cancel button shows only to the users the server lets cancel it, the
 * company's approver or the batch's builder. A batch the nightly job built has the system user as its
 * builder, so only the approver sees it.
 */
describe('JournalEntryBatchDispatchDashboardComponent — who sees Cancel on a Pending batch (#308, DOM)', () => {
  let builtBy: string;

  beforeEach(async () => {
    builtBy = BUILDER_USER_ID;
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      if (p.EntityName === BATCH_ENTITY) return viewResult([{ ...batchRow('Pending'), BatchedByUserID: builtBy }]);
      if (p.EntityName === COMPANY_PROFILE_ENTITY) return viewResult([{ ID: COMPANY_ID, ApprovalCFOUserID: APPROVER_USER_ID }]);
      return viewResult([], 0);
    });
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'GetApprovalState').mockResolvedValue({ Success: true, Approved: false });
    await TestBed.configureTestingModule({ imports: [JournalEntryBatchDispatchModule] }).compileComponents();
  });

  /** The labels of the Pending batch card's action buttons, as `userId` sees them. */
  async function actionsFor(userId: string): Promise<string[]> {
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', providerSignedInAs(userId));
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.bd-card__actions button'));
    return buttons.map(b => b.textContent?.trim() ?? '');
  }

  it('shows the builder Cancel', async () => {
    expect(await actionsFor(BUILDER_USER_ID)).toContain('Cancel');
  });

  it("shows the company's approver Cancel", async () => {
    expect(await actionsFor(APPROVER_USER_ID)).toContain('Cancel');
  });

  it('shows anyone else no Cancel, and still the other actions', async () => {
    const actions = await actionsFor(OTHER_USER_ID);
    expect(actions).not.toContain('Cancel');
    expect(actions).toContain('Archive');
  });

  it("shows only the approver Cancel on the nightly job's batch", async () => {
    builtBy = SYSTEM_USER_ID;
    expect(await actionsFor(BUILDER_USER_ID)).not.toContain('Cancel');
    expect(await actionsFor(APPROVER_USER_ID)).toContain('Cancel');
  });
});
