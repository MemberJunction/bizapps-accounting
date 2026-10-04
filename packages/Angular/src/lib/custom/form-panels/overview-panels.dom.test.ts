import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RunView } from '@memberjunction/core';
import type { MJCompanyEntity } from '@memberjunction/core-entities';
import type { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import { JournalEntryBatchOverviewComponent } from './journal-entry-batch-overview.panel';
import { CompanyAccountingOverviewComponent } from './company-accounting-overview.panel';
import { viewResult } from '../../../__tests__/support/business-clock';
import { entityObject, installStubProvider, stubEntityInfo } from '../../../__tests__/support/entity-stubs';

/**
 * golive #300: both overview mini-dashboards must mount. `mj-card`'s tools and footer slots are
 * TemplateRef directives, so they only work on an `<ng-template>`; on a `<div>` Angular throws
 * NG0201 (No provider for TemplateRef) and the form-panel slot drops the whole panel — on a batch,
 * that took the member journal entries table with it.
 */
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const COMPANY_ENTITY = 'MJ: Companies';
const BATCH_ID = '00000000-0000-0000-0000-000000000300';

describe('overview panels mount with their card tools and footers (#300)', () => {
  beforeEach(() => {
    installStubProvider([
      stubEntityInfo(BATCH_ENTITY, ['ID', 'JournalEntryBatchNumber', 'Status', 'TargetSystem', 'TotalEntries', 'TotalDebits']),
      stubEntityInfo(COMPANY_ENTITY, ['ID', 'Name']),
    ]);
  });

  it('lists a batch\'s member journal entries', async () => {
    const runView = vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue(viewResult([
      { ID: 'je-1', EntryNumber: 'JE-0001', EffectiveDate: '2026-09-29', Description: 'Member one', Status: 'Batched' },
      { ID: 'je-2', EntryNumber: 'JE-0002', EffectiveDate: '2026-09-29', Description: 'Member two', Status: 'Batched' },
      { ID: 'je-3', EntryNumber: 'JE-0003', EffectiveDate: '2026-09-29', Description: 'Batch summary', Status: 'Batched' },
    ]));
    const batch = await entityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY);
    batch.NewRecord();
    batch.ID = BATCH_ID;
    batch.Status = 'Pending';
    batch.TotalEntries = 2;

    const fixture = TestBed.createComponent(JournalEntryBatchOverviewComponent);
    fixture.componentRef.setInput('Record', batch);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(runView).toHaveBeenCalledWith(expect.objectContaining({ ExtraFilter: `JournalEntryBatchID = '${BATCH_ID}'` }));
    const el: HTMLElement = fixture.nativeElement;
    expect(Array.from(el.querySelectorAll('tbody tr td.mja-code')).map((td) => td.textContent?.trim()))
      .toEqual(['JE-0001', 'JE-0002', 'JE-0003']);
    expect(el.textContent).toContain('3 Loaded');
    expect(el.textContent).toContain('Total Members');
  });

  it('renders a company\'s recent batches', async () => {
    vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue(viewResult([
      { ID: 'b-1', JournalEntryBatchNumber: 'BATCH-0001', PostingDate: '2026-09-29', TotalDebits: 100, Status: 'Pending', TargetSystem: 'BusinessCentral' },
    ]));
    const company = await entityObject<MJCompanyEntity>(COMPANY_ENTITY);
    company.NewRecord();
    company.ID = BATCH_ID;

    const fixture = TestBed.createComponent(CompanyAccountingOverviewComponent);
    fixture.componentRef.setInput('Record', company);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('1 Logged');
    expect(el.textContent).toContain('BATCH-0001');
  });
});
