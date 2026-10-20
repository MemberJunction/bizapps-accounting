import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import type { IMetadataProvider } from '@memberjunction/core';
import { BatchActionDialogComponent } from './batch-action-dialog.component';
import { BatchActionDialogBatch, BatchActionDialogState } from './batch-action-dialog.state';

/**
 * #405: the one Reject / Archive / Cancel dialog the three batch screens share. The confirm action is
 * on the left and Keep batch on the right (#398); past a Mismatch, Keep batch is the primary action
 * and the override waits for the batch number.
 */
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const BATCH_NUMBER = 'JEB-TEST-0405';

const PROVIDER = {
  EntityByName: (name: string) =>
    name === BATCH_ENTITY ? { Fields: [{ Name: 'CancelReason', MaxLength: 20 }, { Name: 'ArchiveReason', MaxLength: 40 }] } : undefined,
} as unknown as IMetadataProvider;

function batch(status: BatchActionDialogBatch['Status']): BatchActionDialogBatch {
  return { JournalEntryBatchNumber: BATCH_NUMBER, TargetSystem: 'BusinessCentral', TotalEntries: 3, Status: status };
}

describe('BatchActionDialogComponent (#405, DOM)', () => {
  let fixture: ComponentFixture<BatchActionDialogComponent>;
  let state: BatchActionDialogState;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BatchActionDialogComponent] }).compileComponents();
    state = new BatchActionDialogState();
    fixture = TestBed.createComponent(BatchActionDialogComponent);
    fixture.componentRef.setInput('State', state);
    fixture.detectChanges();
  });

  /** Re-render after changing the state, as a host's own change detection would. */
  function render(): void {
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('mj-dialog-actions button'));
  }

  it('renders nothing while closed', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('.mj-dialog-title')).toBeNull();
  });

  it.each([
    ['Reject', 'Reject this batch', 'Reject batch'],
    ['Archive', 'Archive this batch', 'Archive batch'],
    ['Cancel', 'Cancel this batch', 'Cancel batch'],
  ] as const)('%s: title, confirm on the left, Keep batch on the right, confirm waits for a reason', (action, title, confirmLabel) => {
    state.Open(batch('Pending'), action, PROVIDER);
    render();

    expect((fixture.nativeElement as HTMLElement).querySelector('.mj-dialog-title')?.textContent?.trim()).toBe(title);
    expect(buttons().map((b) => b.textContent?.trim())).toEqual([confirmLabel, 'Keep batch']);
    expect(buttons()[0].disabled).toBe(true);

    state.Reason = 'Wrong entries';
    render();
    expect(buttons()[0].disabled).toBe(false);
  });

  it('reads each reason column\'s own limit and holds back a longer reason', () => {
    state.Open(batch('Pending'), 'Archive', PROVIDER);
    expect(state.ReasonMaxLength).toBe(40);
    state.Open(batch('Pending'), 'Cancel', PROVIDER);
    expect(state.ReasonMaxLength).toBe(20);
    state.Reason = 'x'.repeat(21);
    render();

    expect((fixture.nativeElement as HTMLElement).querySelector('.bad-reason__problem')?.textContent).toBe('This reason is 21 characters; the limit is 20.');
    expect(buttons()[0].disabled).toBe(true);
  });

  it('keeps the reason and asks for the ERP check the server could not do', () => {
    state.Open(batch('Failed'), 'Cancel', PROVIDER);
    state.Reason = 'ERP rejected it';
    state.AskForERPCheck('could not check the ERP: timeout', 'Error');
    render();

    expect(state.Reason).toBe('ERP rejected it');
    expect(state.ConfirmsNotPostedInERP).toBe(true);
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['It has not posted — cancel batch', 'Keep batch']);
    expect(buttons()[0].disabled).toBe(false);
  });

  it('past a Mismatch, makes Keep batch the default and needs the batch number retyped', () => {
    state.Open(batch('Failed'), 'Cancel', PROVIDER);
    state.Reason = 'ERP rejected it';
    state.AskForERPCheck('the ERP already holds this document', 'Mismatch');
    render();

    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['It is not this batch — cancel anyway', 'Keep batch']);
    expect(buttons()[0].className).toContain('mj-btn--flat');
    expect(buttons()[1].className).toContain('mj-btn--primary');
    expect(buttons()[0].disabled).toBe(true);

    state.MismatchText = BATCH_NUMBER;
    render();
    expect(buttons()[0].disabled).toBe(false);
  });

  it('emits Confirm and Dismiss, and neither while a call is in flight', () => {
    let confirms = 0;
    let dismisses = 0;
    fixture.componentInstance.Confirm.subscribe(() => confirms++);
    fixture.componentInstance.Dismiss.subscribe(() => dismisses++);
    state.Open(batch('Pending'), 'Reject', PROVIDER);
    state.Reason = 'Wrong period';
    render();

    buttons()[0].click();
    buttons()[1].click();
    expect([confirms, dismisses]).toEqual([1, 1]);

    state.Busy = true;
    fixture.componentInstance.OnConfirm();
    fixture.componentInstance.OnDismiss();
    expect([confirms, dismisses]).toEqual([1, 1]);
  });
});
