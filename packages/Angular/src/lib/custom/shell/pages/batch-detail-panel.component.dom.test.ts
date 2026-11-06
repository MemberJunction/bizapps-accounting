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

/**
 * The Source column (bc-aidp-next-golive#452): each member entry names the record that created it
 * and opens it, resolved generically from the entry's LinkedEntity / LinkedRecordID.
 */
describe('BatchDetailPanelComponent — member source links (DOM)', () => {
  const NAMED = 'Test: Invoices';
  const UNNAMED = 'Test: Payment Lines';
  const ENTITIES: Record<string, { Name: string; DisplayNameOrName: string; NameField: { Name: string } | null; PrimaryKeys: Array<{ Name: string }> }> = {
    [NAMED]: { Name: NAMED, DisplayNameOrName: 'Invoices', NameField: { Name: 'InvoiceNumber' }, PrimaryKeys: [{ Name: 'ID' }] },
    [UNNAMED]: { Name: UNNAMED, DisplayNameOrName: 'Payment Lines', NameField: null, PrimaryKeys: [{ Name: 'ID' }] },
  };
  const MEMBERS = [
    { ID: 'je-1', EntryNumber: 'JE-1', EntryType: 'PaymentReceipt', Status: 'Batched', EffectiveDate: null, Description: 'Payment PAY-074 — Acme — order ORD-61', LinkedEntity: UNNAMED, LinkedRecordID: 'pl-1' },
    { ID: 'je-2', EntryNumber: 'JE-2', EntryType: 'OrderBooking', Status: 'Batched', EffectiveDate: null, Description: 'Order ORD-61 line 1', LinkedEntity: NAMED, LinkedRecordID: 'inv-1' },
    { ID: 'je-3', EntryNumber: 'JE-3', EntryType: 'Manual', Status: 'Batched', EffectiveDate: null, Description: null, LinkedEntity: null, LinkedRecordID: null },
  ];
  const open = vi.fn();

  beforeEach(async () => {
    open.mockReset();
    vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (ps: RunViewParams[]) =>
      ps.map((p) => {
        if (p.EntityName?.endsWith('Journal Entry Batches')) return viewResult([header({})]);
        if (p.EntityName?.endsWith('Journal Entries')) return viewResult(MEMBERS);
        if (p.EntityName === NAMED) return viewResult([{ ID: 'inv-1', InvoiceNumber: 'INV-0001' }]);
        return viewResult([], 0);
      }));
    await TestBed.configureTestingModule({
      declarations: [BatchDetailPanelComponent],
      imports: [CommonModule],
      providers: [{ provide: MJFormPresenterService, useValue: { Open: open } }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(BatchDetailPanelComponent);
    const provider = Object.assign(stubbedReadsProvider(), { EntityByName: (name: string) => ENTITIES[name] as never });
    fixture.componentRef.setInput('Provider', provider);
    fixture.componentRef.setInput('JournalEntryBatchID', BATCH_ID);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.Sources.size).toBe(2));
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    return fixture;
  }

  function cells(el: HTMLElement): string[] {
    return Array.from(el.querySelectorAll('.bdp__source')).map((c) => (c.textContent ?? '').trim());
  }

  it('reads the origin pair with the members and shows a Source column beside the memo', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    const memberParams = vi.mocked(RunView.prototype.RunViews).mock.calls[0][0].find((p) => p.EntityName?.endsWith('Journal Entries'));

    expect(memberParams?.Fields).toEqual(expect.arrayContaining(['LinkedEntity', 'LinkedRecordID', 'Description']));
    expect(Array.from(el.querySelectorAll('.bdp__members th')).map((th) => th.textContent)).toContain('Source');
    // Named entity → record name; unnamed entity → entity label; manual entry → "Manual".
    expect(cells(el)).toEqual(['Payment Lines', 'INV-0001', 'Manual']);
    expect(el.textContent).toContain('Payment PAY-074 — Acme — order ORD-61');
  });

  it('opens the source record and closes the panel', async () => {
    const fixture = await render();
    const closed = vi.fn();
    fixture.componentInstance.Closed.subscribe(closed);
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.bdp__source-link');

    links[1].click();

    expect(open).toHaveBeenCalledTimes(1);
    const opened = open.mock.calls[0][0];
    expect(opened.EntityName).toBe(NAMED);
    expect(opened.PrimaryKey.ToString()).toContain('inv-1');
    expect(closed).toHaveBeenCalled();
  });
});
