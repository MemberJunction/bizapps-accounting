import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { IMetadataProvider, RunView, RunViewParams, UserInfo } from '@memberjunction/core';
import { BatchOperatorCatalog } from '../../../__tests__/support/batch-operator';
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
/** The user recorded as having approved a batch, who may cancel it past approval. */
const APPROVED_BY_USER_ID = '00000000-0000-0000-0000-0000000000d1';
/** The MJ system user, which the nightly job builds as. */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-0000000000e1';

/** A provider signed in as `userId`; every read is stubbed at `RunView.prototype`. */
/** Signed in as `userId`; the batch-operator grant (#448) goes to `operators`, or to every user when omitted. */
function providerSignedInAs(userId: string, operators?: readonly string[]): IMetadataProvider {
  const user = new UserInfo();
  user.ID = userId;
  const provider: Pick<IMetadataProvider, 'CurrentUser' | 'Authorizations'> = { CurrentUser: user, Authorizations: BatchOperatorCatalog(operators) };
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
    ApprovedByUserID: null,
  };
}

/** A short CancelReason limit, as the entity's field metadata reports it, so a test reason can pass it. */
const CANCEL_REASON_MAX_LENGTH = 30;

/** The reads provider, plus the batch entity's metadata the reason dialog reads its limits from (#307). */
function providerWithCancelReasonLimit(): IMetadataProvider {
  const entity = { Fields: [{ Name: 'CancelReason', MaxLength: CANCEL_REASON_MAX_LENGTH }, { Name: 'ArchiveReason', MaxLength: 500 }] };
  return Object.assign(stubbedReadsProvider(), {
    EntityByName: (name: string) => (name === BATCH_ENTITY ? entity : undefined),
  }) as IMetadataProvider;
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
 * #405: Reject, Archive and Cancel ask for their reason in an mj-dialog. The desktop Explorer has no
 * window.prompt, so every test here makes prompt throw the way Electron does: a flow that still
 * reached for it would fail.
 */
function promptUnsupported(): void {
  vi.spyOn(window, 'prompt').mockImplementation(() => { throw new Error('prompt() is not supported.'); });
  vi.spyOn(window, 'confirm').mockImplementation(() => { throw new Error('confirm() is not supported.'); });
}

/** Open the action's dialog, type the reason and confirm it. */
async function giveReason(
  dashboard: JournalEntryBatchDispatchDashboardComponent,
  open: (row: JournalEntryBatchDispatchDashboardComponent['Batches'][number]) => unknown,
  reason: string,
): Promise<void> {
  await open(dashboard.Batches[0]);
  expect(dashboard.Dialog.Batch, 'the reason dialog opened').not.toBeNull();
  dashboard.Dialog.Reason = reason;
  await dashboard.ConfirmDialog();
}

/**
 * #207: cancelling a Failed batch from Batch approvals. The server looks the batch number up in the
 * ERP first, so the first attempt carries NO confirmation; the dialog asks only when the lookup cannot
 * settle it, and a Mismatch needs the batch number typed.
 */
describe('JournalEntryBatchDispatchDashboardComponent — cancelling a Failed batch (#207)', () => {
  let cancelCalls: boolean[];
  /** What the server answers an unconfirmed cancel; null = its lookup found nothing, so it cancels. */
  let unconfirmedAnswer: CancelJournalEntryBatchResult | null;

  beforeEach(async () => {
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) =>
      p.EntityName === BATCH_ENTITY ? viewResult([{ ...batchRow('Failed'), ApprovedByUserID: APPROVED_BY_USER_ID }]) : viewResult([], 0),
    );
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'GetApprovalState').mockResolvedValue({ Success: true, Approved: true });
    cancelCalls = [];
    unconfirmedAnswer = null;
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'CancelBatch').mockImplementation(async (_id, _reason, confirm = false) => {
      cancelCalls.push(confirm);
      if (!confirm && unconfirmedAnswer) return unconfirmedAnswer;
      return { Success: true, Status: 'Cancelled' };
    });
    promptUnsupported();
    await TestBed.configureTestingModule({ imports: [JournalEntryBatchDispatchModule] }).compileComponents();
  });

  async function render(): Promise<JournalEntryBatchDispatchDashboardComponent> {
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', Object.assign(providerWithCancelReasonLimit(), { CurrentUser: providerSignedInAs(APPROVED_BY_USER_ID).CurrentUser }));
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    return fixture.componentInstance;
  }

  /** Render and send the cancel with its reason. */
  async function cancel(): Promise<JournalEntryBatchDispatchDashboardComponent> {
    const dashboard = await render();
    expect(dashboard.canCancel(dashboard.Batches[0]), 'a Failed batch offers Cancel').toBe(true);
    await giveReason(dashboard, (row) => dashboard.OnCancel(row), 'ERP rejected the journal');
    return dashboard;
  }

  it('does not offer Cancel on a Failed batch carrying the ERP reference: the ERP accepted it', async () => {
    const dashboard = await render();
    const row = { ...dashboard.Batches[0], ExternalJournalEntryBatchRef: 'G00042' };

    expect(dashboard.canCancel(row)).toBe(false);
    expect(dashboard.canArchive(row), 'nor Archive (#413)').toBe(false);
    expect(dashboard.canArchive(dashboard.Batches[0])).toBe(true);
  });

  it('cancels on the first attempt, unconfirmed, without asking, when the server finds nothing in the ERP', async () => {
    const dashboard = await cancel();
    expect(cancelCalls).toEqual([false]);
    expect(dashboard.Dialog.Batch, 'the dialog closed').toBeNull();
    expect(dashboard.ActionMessageIsError).toBe(false);
  });

  it('asks only when the lookup cannot settle it, keeping the reason, then sends the confirmation', async () => {
    unconfirmedAnswer = { Success: true, Status: 'Failed', ConfirmationRequired: 'could not check the ERP: timeout', ConfirmationKind: 'Error' };
    const dashboard = await cancel();
    expect(cancelCalls).toEqual([false]);
    expect(dashboard.Dialog.Batch, 'the dialog stays open for the ERP check').not.toBeNull();
    expect(dashboard.Dialog.ERPCheckReason).toBe('could not check the ERP: timeout');
    expect(dashboard.Dialog.Reason).toBe('ERP rejected the journal');

    await dashboard.ConfirmDialog();
    expect(cancelCalls).toEqual([false, true]);
    expect(dashboard.Dialog.Batch).toBeNull();
  });

  it('leaves the batch alone when the operator declines the ERP check', async () => {
    unconfirmedAnswer = { Success: true, Status: 'Failed', ConfirmationRequired: 'could not check the ERP: timeout', ConfirmationKind: 'Error' };
    const dashboard = await cancel();
    dashboard.DismissDialog();
    expect(cancelCalls).toEqual([false]);
    expect(dashboard.Dialog.IsOpen).toBe(false);
    expect(dashboard.ActionMessageIsError).toBe(false);
  });

  it('needs the batch number typed to cancel past a Mismatch', async () => {
    unconfirmedAnswer = { Success: true, Status: 'Failed', ConfirmationRequired: 'the ERP already holds this document', ConfirmationKind: 'Mismatch' };
    const dashboard = await cancel();
    dashboard.Dialog.MismatchText = 'JEB-TEST-000';
    expect(dashboard.Dialog.CanConfirm).toBe(false);
    await dashboard.ConfirmDialog();
    expect(cancelCalls).toEqual([false]);

    dashboard.Dialog.MismatchText = BATCH_NUMBER;
    await dashboard.ConfirmDialog();
    expect(cancelCalls).toEqual([false, true]);
  });

  it('shows the refusal when the ERP holds the batch, and never sends a confirmation', async () => {
    unconfirmedAnswer = { Success: false, ErrorMessage: 'the ERP already holds document JEB-TEST-0001 and it matches this batch, so the batch posted.' };
    const dashboard = await cancel();
    expect(cancelCalls).toEqual([false]);
    expect(dashboard.ActionMessageIsError).toBe(true);
    expect(dashboard.ActionMessage).toMatch(/so the batch posted/);
  });
});

/**
 * #324: a cancel the server refuses still reloads the list. Cancelling a Failed batch can find that the
 * ERP posted it during the cancel; the server then records the batch Posted and refuses, and the card
 * must show Posted, not keep offering Cancel on a Failed batch.
 */
describe('JournalEntryBatchDispatchDashboardComponent — a refused cancel reloads the batch (#324)', () => {
  let listedStatus: BatchStatus;
  let batchReads: number;

  beforeEach(async () => {
    listedStatus = 'Failed';
    batchReads = 0;
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      if (p.EntityName !== BATCH_ENTITY) return viewResult([], 0);
      batchReads++;
      return viewResult([{ ...batchRow(listedStatus), ApprovedByUserID: APPROVED_BY_USER_ID }]);
    });
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'GetApprovalState').mockResolvedValue({ Success: true, Approved: true });
    promptUnsupported();
    await TestBed.configureTestingModule({ imports: [JournalEntryBatchDispatchModule] }).compileComponents();
  });

  function buttonLabelled(root: HTMLElement, selector: string, label: string): HTMLButtonElement | undefined {
    const buttons: HTMLButtonElement[] = Array.from(root.querySelectorAll(`${selector} button`));
    return buttons.find(b => b.textContent?.trim() === label);
  }

  it('shows the batch as Posted and keeps the refusal when the ERP posted it during the cancel', async () => {
    const refusal = 'The ERP posted batch JEB-TEST-0001 while it was being cancelled; it is now recorded Posted.';
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'CancelBatch').mockImplementation(async () => {
      listedStatus = 'Posted';
      return { Success: false, ErrorMessage: refusal };
    });
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', Object.assign(providerWithCancelReasonLimit(), { CurrentUser: providerSignedInAs(APPROVED_BY_USER_ID).CurrentUser }));
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const cancelButton = buttonLabelled(root, '.bd-card__actions', 'Cancel');
    expect(cancelButton, 'a Failed batch offers Cancel').toBeTruthy();
    cancelButton!.click();
    fixture.detectChanges();
    const reason = root.querySelector('textarea#bad-reason') as HTMLTextAreaElement | null;
    expect(reason, 'the cancel dialog asks for the reason').not.toBeNull();
    reason!.value = 'ERP rejected the journal';
    reason!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    buttonLabelled(root, 'mj-dialog-actions', 'Cancel batch')!.click();
    await vi.waitFor(() => expect(batchReads, 'the list reloaded after the refused cancel').toBe(2));
    await fixture.whenStable();
    fixture.detectChanges();

    const banner = root.querySelector('.bd-banner[role="status"]') as HTMLElement | null;
    expect(banner?.classList).toContain('bd-banner--error');
    expect(banner?.textContent).toContain(refusal);
    const badge = root.querySelector('.bd-card__badges mj-stat-badge') as HTMLElement | null;
    expect(badge?.textContent).toContain('Posted');
    expect(buttonLabelled(root, '.bd-card__actions', 'Cancel'), 'a Posted batch offers no Cancel').toBeUndefined();
  });
});

/**
 * golive #302: a Pending batch can be cancelled, not only rejected. Cancel is the builder's way to
 * withdraw it (the server decides who may); Reject is the CFO's decision, and asks for a reason.
 * Signed in as the company's approver, who may do both.
 */
describe('JournalEntryBatchDispatchDashboardComponent — a Pending batch (golive #302)', () => {
  let cancelCalls: Array<{ Reason: string; Confirm: boolean }>;
  let decisionCalls: Array<{ Decision: string; Notes: string | undefined }>;

  beforeEach(async () => {
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      if (p.EntityName === BATCH_ENTITY) return viewResult([batchRow('Pending')]);
      if (p.EntityName === COMPANY_PROFILE_ENTITY) return viewResult([{ ID: COMPANY_ID, ApprovalCFOUserID: APPROVER_USER_ID }]);
      return viewResult([], 0);
    });
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
    promptUnsupported();
    await TestBed.configureTestingModule({ imports: [JournalEntryBatchDispatchModule] }).compileComponents();
  });

  async function render(): Promise<JournalEntryBatchDispatchDashboardComponent> {
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', Object.assign(providerWithCancelReasonLimit(), { CurrentUser: providerSignedInAs(APPROVER_USER_ID).CurrentUser }));
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
    const dashboard = await render();
    await giveReason(dashboard, (row) => dashboard.OnCancel(row), '  Built with the wrong entries  ');
    expect(cancelCalls).toEqual([{ Reason: 'Built with the wrong entries', Confirm: false }]);
    expect(dashboard.ActionMessageIsError).toBe(false);
  });

  it('sends a rejection with its reason as the decision notes', async () => {
    const dashboard = await render();
    await giveReason(dashboard, (row) => dashboard.OnRecordDecision(row, 'Rejected'), '  Wrong period  ');
    expect(decisionCalls).toEqual([{ Decision: 'Rejected', Notes: 'Wrong period' }]);
    expect(dashboard.Dialog.Batch, 'the dialog closed').toBeNull();
  });

  it.each(['', '   '])('does not reject without a reason (%j)', async (answer) => {
    const dashboard = await render();
    await giveReason(dashboard, (row) => dashboard.OnRecordDecision(row, 'Rejected'), answer);
    expect(dashboard.Dialog.CanConfirm).toBe(false);
    expect(decisionCalls).toEqual([]);
  });

  it('does not reject when the dialog is closed', async () => {
    const dashboard = await render();
    await dashboard.OnRecordDecision(dashboard.Batches[0], 'Rejected');
    dashboard.Dialog.Reason = 'Wrong period';
    dashboard.DismissDialog();
    expect(decisionCalls).toEqual([]);
    expect(dashboard.Dialog.Batch).toBeNull();
  });

  // #307: the reason becomes the batch's CancelReason, so a longer one is held back, with the text kept.
  it('holds back a rejection reason longer than the batch holds, keeping the text, and sends the shortened one', async () => {
    const tooLong = 'Wrong period, see the close notes';
    const dashboard = await render();
    await giveReason(dashboard, (row) => dashboard.OnRecordDecision(row, 'Rejected'), tooLong);
    expect(decisionCalls).toEqual([]);
    expect(dashboard.Dialog.Reason).toBe(tooLong);
    expect(dashboard.Dialog.ReasonProblem).toBe(`This reason is ${tooLong.length} characters; the limit is ${CANCEL_REASON_MAX_LENGTH}.`);

    dashboard.Dialog.Reason = 'Wrong period';
    await dashboard.ConfirmDialog();
    expect(decisionCalls).toEqual([{ Decision: 'Rejected', Notes: 'Wrong period' }]);
  });

  it('accepts a reason at the limit, measured without surrounding spaces', async () => {
    const atLimit = 'x'.repeat(CANCEL_REASON_MAX_LENGTH);
    const dashboard = await render();
    await giveReason(dashboard, (row) => dashboard.OnRecordDecision(row, 'Rejected'), `  ${atLimit}  `);
    expect(decisionCalls).toEqual([{ Decision: 'Rejected', Notes: atLimit }]);
  });

  it('holds back a cancel reason longer than the batch holds', async () => {
    const dashboard = await render();
    await giveReason(dashboard, (row) => dashboard.OnCancel(row), 'Built with the wrong entries for August');
    expect(cancelCalls).toEqual([]);
    dashboard.Dialog.Reason = 'Wrong entries';
    await dashboard.ConfirmDialog();
    expect(cancelCalls).toEqual([{ Reason: 'Wrong entries', Confirm: false }]);
  });

  it('approves without asking for a reason', async () => {
    const dashboard = await render();
    await dashboard.OnRecordDecision(dashboard.Batches[0], 'Approved');
    expect(dashboard.Dialog.Batch).toBeNull();
    expect(decisionCalls).toEqual([{ Decision: 'Approved', Notes: undefined }]);
  });
});

/**
 * #405: the dialog itself, rendered. Clicking Reject, Archive or Cancel opens it in place of a native
 * prompt, with the confirm action on the left and Keep batch on the right.
 */
describe('JournalEntryBatchDispatchDashboardComponent — the reason dialog (#405, DOM)', () => {
  beforeEach(async () => {
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      if (p.EntityName === BATCH_ENTITY) return viewResult([batchRow('Pending')]);
      if (p.EntityName === COMPANY_PROFILE_ENTITY) return viewResult([{ ID: COMPANY_ID, ApprovalCFOUserID: APPROVER_USER_ID }]);
      return viewResult([], 0);
    });
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'GetApprovalState').mockResolvedValue({ Success: true, Approved: false });
    promptUnsupported();
    await TestBed.configureTestingModule({ imports: [JournalEntryBatchDispatchModule] }).compileComponents();
  });

  it.each([
    ['Reject', 'Reject this batch', 'Reject batch'],
    ['Archive', 'Archive this batch', 'Archive batch'],
    ['Cancel', 'Cancel this batch', 'Cancel batch'],
  ])('%s opens the dialog, confirm left and Keep batch right', async (action, title, confirmLabel) => {
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', Object.assign(providerWithCancelReasonLimit(), { CurrentUser: providerSignedInAs(APPROVER_USER_ID).CurrentUser }));
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const cardButton = Array.from(root.querySelectorAll<HTMLButtonElement>('.bd-card__actions button')).find(b => b.textContent?.trim() === action);
    expect(cardButton, `the card offers ${action}`).toBeTruthy();
    cardButton!.click();
    fixture.detectChanges();

    expect(root.querySelector('.mj-dialog-title')?.textContent?.trim()).toBe(title);
    const labels = Array.from(root.querySelectorAll('mj-dialog-actions button')).map(b => b.textContent?.trim());
    expect(labels).toEqual([confirmLabel, 'Keep batch']);
    expect(window.prompt).not.toHaveBeenCalled();
  });
});

/**
 * golive #325: an archive whose response is lost (a gateway timeout) may still have gone through on
 * the server, so the list reloads after an error too and the card shows the batch's real status.
 */
describe('JournalEntryBatchDispatchDashboardComponent — a failed archive reloads the batch (golive #325)', () => {
  let listedStatus: BatchStatus;
  let batchReads: number;

  beforeEach(async () => {
    listedStatus = 'Pending';
    batchReads = 0;
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      if (p.EntityName !== BATCH_ENTITY) return viewResult([], 0);
      batchReads++;
      return viewResult([batchRow(listedStatus)]);
    });
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'GetApprovalState').mockResolvedValue({ Success: true, Approved: false });
    promptUnsupported();
    await TestBed.configureTestingModule({ imports: [JournalEntryBatchDispatchModule] }).compileComponents();
  });

  it('shows the batch Archived, and keeps the error, when the archive went through but its response timed out', async () => {
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'ArchiveBatch').mockImplementation(async () => {
      listedStatus = 'Archived';
      return { Success: false, ErrorMessage: 'GraphQL Error (Code: 504)' };
    });
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', providerWithCancelReasonLimit());
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    const dashboard = fixture.componentInstance;

    await giveReason(dashboard, (row) => dashboard.OnArchive(row), 'Posted in the legacy system');

    expect(batchReads, 'the list reloaded after the failed archive').toBe(2);
    expect(dashboard.Batches.map((b) => b.Status)).toEqual(['Archived']);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.bd-banner[role="status"]') as HTMLElement | null;
    expect(banner?.classList).toContain('bd-banner--error');
    expect(banner?.textContent).toContain('GraphQL Error (Code: 504)');
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
  async function actionsFor(userId: string, operators?: readonly string[]): Promise<string[]> {
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', providerSignedInAs(userId, operators));
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

  it('shows anyone else no Cancel and no Archive (#448), and still the other actions', async () => {
    const actions = await actionsFor(OTHER_USER_ID);
    expect(actions).not.toContain('Cancel');
    expect(actions).not.toContain('Archive');
    expect(actions).toContain('Regenerate');
  });

  it('shows only the approver Archive on a Pending batch; the builder may cancel it, not archive it (#448)', async () => {
    expect(await actionsFor(APPROVER_USER_ID)).toContain('Archive');
    const builder = await actionsFor(BUILDER_USER_ID);
    expect(builder).not.toContain('Archive');
    expect(builder).toContain('Cancel');
  });

  it('shows no Regenerate or Archive to a user without the batch-operator grant, even the approver (#448)', async () => {
    const actions = await actionsFor(APPROVER_USER_ID, []);
    expect(actions).not.toContain('Regenerate');
    expect(actions).not.toContain('Archive');
    expect(actions, 'Cancel follows the approver rule alone').toContain('Cancel');
  });

  it("shows only the approver Cancel on the nightly job's batch", async () => {
    builtBy = SYSTEM_USER_ID;
    expect(await actionsFor(BUILDER_USER_ID)).not.toContain('Cancel');
    expect(await actionsFor(APPROVER_USER_ID)).toContain('Cancel');
  });
});

/**
 * #339: Approve and Reject show only to the users the server records a decision from, the company's
 * approver when they did not build the batch. Cancel past approval shows only to the company's approver
 * or the user who approved the batch.
 */
describe('JournalEntryBatchDispatchDashboardComponent — who sees Approve, Reject and Cancel past approval (#339, DOM)', () => {
  let listed: Record<string, unknown>;
  /** Whether the approver read succeeds; a case can make it fail. */
  let profilesRead: boolean;

  beforeEach(async () => {
    listed = batchRow('Pending');
    profilesRead = true;
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      if (p.EntityName === BATCH_ENTITY) return viewResult([listed]);
      if (p.EntityName === COMPANY_PROFILE_ENTITY) {
        return profilesRead
          ? viewResult([{ ID: COMPANY_ID, ApprovalCFOUserID: APPROVER_USER_ID }])
          : { ...viewResult([]), Success: false, ErrorMessage: 'read refused' };
      }
      return viewResult([], 0);
    });
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'GetApprovalState').mockResolvedValue({ Success: true, Approved: false });
    await TestBed.configureTestingModule({ imports: [JournalEntryBatchDispatchModule] }).compileComponents();
  });

  /** The labels of the batch card's action buttons, as `userId` sees them. */
  async function actionsFor(userId: string, operators?: readonly string[]): Promise<string[]> {
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', providerSignedInAs(userId, operators));
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.bd-card__actions button'));
    return buttons.map(b => b.textContent?.trim() ?? '');
  }

  it("shows the company's approver Approve and Reject on a Pending batch", async () => {
    const actions = await actionsFor(APPROVER_USER_ID);
    expect(actions).toContain('Approve');
    expect(actions).toContain('Reject');
  });

  it('shows the approver no Approve or Reject on a batch they built', async () => {
    listed = { ...batchRow('Pending'), BatchedByUserID: APPROVER_USER_ID };
    const actions = await actionsFor(APPROVER_USER_ID);
    expect(actions).not.toContain('Approve');
    expect(actions).not.toContain('Reject');
    expect(actions, 'the builder may still cancel it').toContain('Cancel');
  });

  it.each([['the builder', BUILDER_USER_ID], ['anyone else', OTHER_USER_ID]])('shows %s no Approve or Reject', async (_who, userId) => {
    const actions = await actionsFor(userId);
    expect(actions).not.toContain('Approve');
    expect(actions).not.toContain('Reject');
  });

  it('shows no one Approve or Reject when the approvers cannot be read', async () => {
    profilesRead = false;
    expect(await actionsFor(APPROVER_USER_ID)).not.toContain('Approve');
  });

  it.each(['Approved', 'Failed'] as const)(
    "shows Cancel and Archive on a batch in %s to the company's approver and the user who approved it, and no one else",
    async (status) => {
      listed = { ...batchRow(status), ApprovedByUserID: APPROVED_BY_USER_ID };
      for (const allowed of [APPROVER_USER_ID, APPROVED_BY_USER_ID]) {
        const actions = await actionsFor(allowed);
        expect(actions).toContain('Cancel');
        expect(actions).toContain('Archive');
      }
      for (const refused of [BUILDER_USER_ID, OTHER_USER_ID]) {
        const actions = await actionsFor(refused);
        expect(actions).not.toContain('Cancel');
        expect(actions).not.toContain('Archive');
      }
    },
  );

  it('shows Cancel past approval only to the user who approved the batch when the approvers cannot be read', async () => {
    profilesRead = false;
    listed = { ...batchRow('Approved'), ApprovedByUserID: APPROVED_BY_USER_ID };
    expect(await actionsFor(APPROVER_USER_ID)).not.toContain('Cancel');
    expect(await actionsFor(APPROVED_BY_USER_ID)).toContain('Cancel');
  });
});

/**
 * A Pending batch's card states its stage. The send gate refuses every Pending batch with a reason
 * ("records no approver") that read like an error on an ordinary card; it is not shown there.
 */
describe('JournalEntryBatchDispatchDashboardComponent — a Pending card reads as awaiting approval (DOM)', () => {
  const GATE_REASON = `Batch ${BATCH_NUMBER} is not approved — it records no approver, so it was never approved through the approval decision.`;
  let status: BatchStatus;

  beforeEach(async () => {
    status = 'Pending';
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
      if (p.EntityName === BATCH_ENTITY) return viewResult([batchRow(status)]);
      if (p.EntityName === COMPANY_PROFILE_ENTITY) return viewResult([{ ID: COMPANY_ID, ApprovalCFOUserID: APPROVER_USER_ID }]);
      return viewResult([], 0);
    });
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'GetApprovalState').mockResolvedValue({ Success: true, Approved: false, Reason: GATE_REASON });
    await TestBed.configureTestingModule({ imports: [JournalEntryBatchDispatchModule] }).compileComponents();
  });

  async function cardText(): Promise<string> {
    const fixture = TestBed.createComponent(JournalEntryBatchDispatchDashboardComponent);
    fixture.componentRef.setInput('Provider', providerSignedInAs(APPROVER_USER_ID));
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows "Awaiting approval", not the send gate\'s refusal', async () => {
    const text = await cardText();
    expect(text).toContain('Awaiting approval');
    expect(text).not.toContain('records no approver');
    expect(text).not.toContain('is not approved');
  });

  it('shows no awaiting line once the batch is past Pending', async () => {
    status = 'Approved';
    expect(await cardText()).not.toContain('Awaiting approval');
  });
});
