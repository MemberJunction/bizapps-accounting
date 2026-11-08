import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { RetryConfirmDialogComponent } from './retry-confirm-dialog.component';
import { RetryConfirmBatch, RetryConfirmState } from './retry-confirm-dialog.state';

/**
 * The retry confirmation Dispatch status and the Batches overview share (#466). An unsettled lookup
 * asks once; a Mismatch puts the override on the left and Cancel on the right as the primary
 * (default) action, and the override waits for the retyped batch number (#398).
 */
const BATCH: RetryConfirmBatch = { JournalEntryBatchNumber: 'JEB-TEST-0466', TargetSystem: 'BusinessCentral' };

describe('RetryConfirmDialogComponent (#466, DOM)', () => {
  let fixture: ComponentFixture<RetryConfirmDialogComponent>;
  let state: RetryConfirmState;
  let confirms: number;
  let dismisses: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RetryConfirmDialogComponent] }).compileComponents();
    state = new RetryConfirmState();
    fixture = TestBed.createComponent(RetryConfirmDialogComponent);
    fixture.componentRef.setInput('State', state);
    confirms = 0;
    dismisses = 0;
    fixture.componentInstance.Confirm.subscribe(() => confirms++);
    fixture.componentInstance.Dismiss.subscribe(() => dismisses++);
    fixture.detectChanges();
  });

  function render(): void {
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from(el().querySelectorAll<HTMLButtonElement>('mj-dialog-actions button'));
  }

  it('renders nothing while closed', () => {
    expect(el().querySelector('.mj-dialog-title')).toBeNull();
  });

  it('an unsettled lookup shows the server reason and confirms in one click', () => {
    state.Open(BATCH, 'the ERP lookup failed', 'Unavailable');
    render();

    expect(el().querySelector('.mj-dialog-title')?.textContent?.trim()).toBe('Check the ERP before retrying');
    expect(el().textContent).toContain('the ERP lookup failed');
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['It has not posted — retry', 'Cancel']);
    buttons()[0].click();
    expect(confirms).toBe(1);
  });

  it('a Mismatch shows the override first, disabled, and Cancel second as the primary action', () => {
    state.Open(BATCH, 'the ERP already holds this document', 'Mismatch');
    render();

    expect(el().querySelector('.mj-dialog-title')?.textContent?.trim()).toBe('The ERP already holds this document number');
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['It is not this batch — post again', 'Cancel']);
    expect(buttons()[0].disabled, 'the override waits for the retyped number').toBe(true);
    expect(buttons()[1].getAttribute('variant'), 'Cancel stays the default action').toBe('primary');

    buttons()[1].click();
    expect(dismisses).toBe(1);
    expect(confirms).toBe(0);
  });

  it('a Mismatch override is enabled once the batch number is retyped exactly', () => {
    state.Open(BATCH, 'the ERP already holds this document', 'Mismatch');
    state.MismatchText = 'JEB-TEST-046';
    expect(state.CanConfirm).toBe(false);
    state.MismatchText = ' JEB-TEST-0466 ';
    expect(state.CanConfirm).toBe(true);
    render();
    expect(buttons()[0].disabled).toBe(false);
  });
});
