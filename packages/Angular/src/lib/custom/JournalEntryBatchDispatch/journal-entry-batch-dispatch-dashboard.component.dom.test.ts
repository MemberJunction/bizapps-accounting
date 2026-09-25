import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { RunView, RunViewParams } from '@memberjunction/core';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import { JournalEntryBatchDispatchDashboardComponent } from './journal-entry-batch-dispatch-dashboard.component';
import { JournalEntryBatchDispatchModule } from './journal-entry-batch-dispatch.module';
import { JournalEntryBatchDispatchClient, DispatchJournalEntryBatchResult } from './journal-entry-batch-dispatch.client';
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
