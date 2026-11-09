import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { SendApprovedBatchesComponent } from './send-approved-batches.component';
import { JournalEntryBatchDispatchClient, SendApprovedBatchesResult } from '../journal-entry-batch-dispatch.client';

/**
 * The Batches page's Send approved batches button (bc-aidp-next-golive#451): it asks first with the
 * number of approved batches, shows a loading state while the server sends, then lists each batch's
 * result and tells the host to reload. The server call is faked; what it sends is tested server-side.
 */
const RESULT: SendApprovedBatchesResult = {
  Success: true,
  PostedCount: 1,
  Batches: [
    { JournalEntryBatchID: 'B-1', JournalEntryBatchNumber: 'JEB-TEST-0001', CompanyID: 'C-1', Company: 'Test Company', Status: 'Posted', Posted: true, Message: null },
    { JournalEntryBatchID: 'B-2', JournalEntryBatchNumber: 'JEB-TEST-0002', CompanyID: 'C-1', Company: 'Test Company', Status: 'Failed', Posted: false, Message: 'The ERP rejected the journal: posting date is closed.' },
  ],
};

describe('SendApprovedBatchesComponent (golive #451, DOM)', () => {
  let fixture: ComponentFixture<SendApprovedBatchesComponent>;
  let sent: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SendApprovedBatchesComponent] }).compileComponents();
    fixture = TestBed.createComponent(SendApprovedBatchesComponent);
    sent = 0;
    fixture.componentInstance.Sent.subscribe(() => sent++);
  });

  function render(approvedCount: number): void {
    fixture.componentRef.setInput('ApprovedCount', approvedCount);
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function openButton(): HTMLButtonElement {
    return el().querySelector<HTMLButtonElement>('button.sab-open')!;
  }

  function dialogButtons(): HTMLButtonElement[] {
    return Array.from(el().querySelectorAll<HTMLButtonElement>('mj-dialog-actions button'));
  }

  it('is disabled with nothing approved', () => {
    render(0);
    expect(openButton().disabled).toBe(true);
    expect(openButton().textContent).toContain('Send approved batches (0)');
  });

  it('asks first, naming how many approved batches will be sent, with Send left and Cancel right', () => {
    render(3);
    openButton().click();
    fixture.detectChanges();

    expect(el().querySelector('.mj-dialog-title')?.textContent?.trim()).toBe('Send approved batches');
    expect(el().querySelector('.sab-question')?.textContent?.trim()).toBe('Send 3 approved batches to the ERP now?');
    expect(dialogButtons().map(b => b.textContent?.trim())).toEqual(['Send 3 batches', 'Cancel']);
  });

  it('says "batch" for one', () => {
    render(1);
    openButton().click();
    fixture.detectChanges();

    expect(el().querySelector('.sab-question')?.textContent?.trim()).toBe('Send 1 approved batch to the ERP now?');
  });

  it('Cancel closes without sending', () => {
    const send = vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'DispatchApprovedJournalEntryBatches');
    render(2);
    openButton().click();
    fixture.detectChanges();
    dialogButtons()[1].click();
    fixture.detectChanges();

    expect(el().querySelector('.mj-dialog-title')).toBeNull();
    expect(send).not.toHaveBeenCalled();
    expect(sent).toBe(0);
  });

  it('shows the loading state while sending, then each batch result, and tells the host to reload', async () => {
    let finish!: (r: SendApprovedBatchesResult) => void;
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'DispatchApprovedJournalEntryBatches')
      .mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(2);
    openButton().click();
    fixture.detectChanges();

    const confirm = fixture.componentInstance.Confirm();
    fixture.detectChanges();
    expect(el().querySelector('mj-loading')).not.toBeNull();
    expect(dialogButtons()).toHaveLength(0);
    fixture.componentInstance.Close(); // refused while sending
    expect(fixture.componentInstance.Phase).toBe('sending');

    finish(RESULT);
    await confirm;
    fixture.detectChanges();

    expect(el().querySelector('mj-loading')).toBeNull();
    expect(el().querySelector('.mj-dialog-title')?.textContent?.trim()).toBe('Send results');
    expect(el().querySelector('.sab-summary')?.textContent?.trim()).toBe('1 of 2 batches posted.');
    const rows = Array.from(el().querySelectorAll('.sab-result'));
    expect(rows).toHaveLength(2);
    expect(rows[0].classList).toContain('sab-result--ok');
    expect(rows[0].textContent).toContain('JEB-TEST-0001');
    expect(rows[0].textContent).toContain('Test Company');
    expect(rows[1].classList).toContain('sab-result--bad');
    expect(rows[1].textContent).toContain('Failed');
    expect(rows[1].textContent).toContain('posting date is closed');
    expect(sent).toBe(1);
    expect(dialogButtons().map(b => b.textContent?.trim())).toEqual(['Close']);
  });

  it('says nothing was sent when no batch was approved by the time the send ran', async () => {
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'DispatchApprovedJournalEntryBatches')
      .mockResolvedValue({ Success: true, Batches: [], PostedCount: 0 });
    render(1);
    openButton().click();
    await fixture.componentInstance.Confirm();
    fixture.detectChanges();

    expect(el().querySelector('.sab-summary')?.textContent).toContain('nothing was sent');
    expect(sent).toBe(1);
  });

  it('shows the server refusal and still tells the host to reload', async () => {
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'DispatchApprovedJournalEntryBatches')
      .mockResolvedValue({ Success: false, Batches: [], PostedCount: 0, ErrorMessage: 'requires the batch-operator authorization' });
    render(1);
    openButton().click();
    await fixture.componentInstance.Confirm();
    fixture.detectChanges();

    expect(el().querySelector('.sab-error')?.textContent).toContain('requires the batch-operator authorization');
    expect(sent).toBe(1);
  });
});
