import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RunView, RunViewParams } from '@memberjunction/core';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { BatchDetailPanelComponent, BatchDetailHeader } from './batch-detail-panel.component';
import { stubbedReadsProvider, viewResult } from '../../../../__tests__/support/business-clock';

const BATCH_ID = 'aaaaaaaa-0000-0000-0000-000000000184';

function header(overrides: Partial<BatchDetailHeader>): BatchDetailHeader {
  return {
    ID: BATCH_ID,
    JournalEntryBatchNumber: 'JEB-0184',
    Status: 'Posted',
    TargetSystem: 'BusinessCentral',
    PostingDate: new Date('2026-09-30T00:00:00Z'),
    TotalEntries: 2,
    TotalDebits: 100,
    TotalCredits: 100,
    CompanyID: 'bbbbbbbb-0000-0000-0000-000000000001',
    Company: 'Test Co',
    ExternalJournalEntryBatchRef: 'ERP-1',
    ApprovedAt: new Date('2026-09-30T10:00:00Z'),
    SentAt: new Date('2026-09-30T11:00:00Z'),
    SentByUser: null,
    SendAttemptCount: 1,
    PostedAt: new Date('2026-09-30T11:01:00Z'),
    SealMismatchDetectedAt: null,
    ErrorMessage: null,
    ApprovalTaskID: null,
    ApprovalTaskRaisedAt: null,
    SummaryJournalEntryID: null,
    __mj_CreatedAt: new Date('2026-09-30T09:00:00Z'),
    ...overrides,
  };
}

/**
 * The send audit on the batch detail panel (#184): who made the latest send, and — only once a batch
 * has needed more than one — how many attempts entered Sent.
 */
describe('BatchDetailPanelComponent — send audit facts (DOM)', () => {
  let shown: BatchDetailHeader;

  beforeEach(async () => {
    vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (ps: RunViewParams[]) =>
      ps.map((p) => (p.EntityName?.endsWith('Journal Entry Batches') ? viewResult([shown]) : viewResult([], 0))));

    // Declared bare: the slide panel, badges and alerts are shells around projected markup, and the
    // facts under test are plain text inside it.
    await TestBed.configureTestingModule({
      declarations: [BatchDetailPanelComponent],
      imports: [CommonModule],
      providers: [{ provide: MJFormPresenterService, useValue: {} }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  async function render(h: BatchDetailHeader): Promise<string> {
    shown = h;
    const fixture = TestBed.createComponent(BatchDetailPanelComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.componentRef.setInput('JournalEntryBatchID', BATCH_ID);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.Header).not.toBeNull());
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('names the sender and counts the attempts once a batch has needed more than one', async () => {
    const text = await render(header({ SentByUser: 'Dana Operator', SendAttemptCount: 3 }));

    expect(text).toContain('by Dana Operator');
    expect(text).toMatch(/Send attempts\s*3/);
  });

  it('shows no attempt count for a batch sent once, and no sender for one sent before the column existed', async () => {
    const text = await render(header({ SentByUser: null, SendAttemptCount: 1 }));

    expect(text).toContain('Sent');
    expect(text).not.toContain('Send attempts');
    expect(text).not.toContain(' by ');
  });

  // #216: a Failed retry adopted from the ERP over a broken seal is flagged for review.
  it('flags a batch recorded Posted over a broken approved-content seal', async () => {
    const text = await render(header({ SealMismatchDetectedAt: new Date('2026-09-30T11:01:00Z') }));

    expect(text).toContain('Seal mismatch');
  });

  it('shows no seal-mismatch fact when the seal matched', async () => {
    const text = await render(header({ SealMismatchDetectedAt: null }));

    expect(text).not.toContain('Seal mismatch');
  });
});
