/**
 * TIER 4 (4e-ii) — the JournalEntry detail panel (`JournalEntryDetailPanelComponent`, a
 * BaseAngularComponent). It's the review surface behind the All-journal-entries grid: given a loaded
 * Header it renders the title + status + reversal affordance. We set `Header` directly (bypassing the
 * API load) and assert the panel's DISPLAY getters across the states that drive them — the panel's own
 * layer, not the raw view. Previously blocked by the tier-4 locale crash; unblocked by 1.3.0.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { bootstrapTier4 } from './tier4-bootstrap';
import { AccountingShellModule } from '../../src/lib/custom/shell/shell.module';
import { JournalEntryDetailPanelComponent, type JEDetailHeader } from '../../src/lib/custom/shell/pages/journal-entry-detail-panel.component';

interface Model {
  Header: JEDetailHeader | null;
  Title: string;
  CanReverse: boolean;
  ReverseBlockedReason: string | null;
  StatusVariant: string;
}

function header(over: Partial<JEDetailHeader>): JEDetailHeader {
  return {
    ID: '00000000-0000-4000-8000-000000000001', EntryNumber: 'JE-TEST-000001', EntryType: 'Manual',
    Status: 'GLPosted', EffectiveDate: null, Description: 'panel spec', CompanyID: 'c0', Company: 'Test Co',
    OrderID: null, BatchID: null, ReversedByJournalEntryID: null, ReversesJournalEntryID: null,
    GLPostedAt: null, GLReferenceID: null, __mj_CreatedAt: new Date(0), ...over,
  };
}

describe('TIER 4 (4e-ii): JournalEntry detail panel — title + status + reversal gate', () => {
  beforeAll(async () => { await bootstrapTier4(); }, 180000);

  it('renders title/status and gates the reversal affordance off the Header', () => {
    TestBed.configureTestingModule({ imports: [AccountingShellModule], providers: [MJFormPresenterService] });
    const f = TestBed.createComponent(JournalEntryDetailPanelComponent);
    const c = f.componentInstance as unknown as Model;

    // 1. GLPosted + not reversed → reversible; title carries the entry number.
    c.Header = header({ Status: 'GLPosted', ReversedByJournalEntryID: null });
    f.detectChanges();
    expect(c.Title, 'title carries the entry number').toContain('JE-TEST-000001');
    expect(c.CanReverse, 'not-yet-reversed ⇒ reversible').toBe(true);
    expect(c.ReverseBlockedReason, 'no block reason when reversible').toBeNull();
    expect(c.StatusVariant, 'GLPosted status has a non-default badge variant').not.toBe('default');

    // 2. Already reversed → NOT reversible, with the explaining reason.
    c.Header = header({ Status: 'GLPosted', ReversedByJournalEntryID: '00000000-0000-4000-8000-000000000abc' });
    f.detectChanges();
    expect(c.CanReverse, 'already-reversed ⇒ not reversible').toBe(false);
    expect(c.ReverseBlockedReason, 'block reason names the prior reversal').toMatch(/already been reversed/i);
  });
});
