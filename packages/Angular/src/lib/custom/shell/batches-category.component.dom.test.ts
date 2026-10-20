import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IMetadataProvider } from '@memberjunction/core';
import { BatchesCategoryComponent } from './batches-category.component';
import { PageRefreshService } from '../../transfer-pending/shell-refresh/page-refresh.service';
import { JournalEntryBatchDispatchClient } from '../JournalEntryBatchDispatch/journal-entry-batch-dispatch.client';
import { stubbedReadsProvider } from '../../../__tests__/support/business-clock';
import { BatchOperatorCatalog } from '../../../__tests__/support/batch-operator';

/**
 * The Batches category header's "Build JE batch" shows only to holders of the batch-operator grant
 * (#448), the Finance role's Authorization the server's Build operation requires. The shell's rail and
 * pages are not under test, so the template is replaced; the template's own gate is read from source.
 */
describe('BatchesCategoryComponent — Build JE batch needs the batch-operator grant (#448)', () => {
  let builds: number;

  beforeEach(async () => {
    builds = 0;
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'BuildJournalEntryBatch').mockImplementation(async () => {
      builds++;
      return { Success: true, NothingToBatch: true, SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, CompanyCount: 0 };
    });
    await TestBed.configureTestingModule({ declarations: [BatchesCategoryComponent], providers: [PageRefreshService] })
      .overrideComponent(BatchesCategoryComponent, { set: { template: '' } })
      .compileComponents();
  });

  /** The component for a user who holds the grant, or not. The shell's own loads answer empty. */
  function create(holdsGrant: boolean): BatchesCategoryComponent {
    const empty = { Success: true, Results: [], TotalRowCount: 0 };
    const reads = { RunView: async () => empty, RunViews: async (params: unknown[]) => params.map(() => empty), EntityByName: () => undefined };
    const grant = holdsGrant ? {} : { Authorizations: BatchOperatorCatalog([]) };
    const provider: IMetadataProvider = Object.assign(stubbedReadsProvider(), reads, grant);
    const fixture = TestBed.createComponent(BatchesCategoryComponent);
    fixture.componentRef.setInput('Provider', provider);
    return fixture.componentInstance;
  }

  it('lets a holder build', async () => {
    const category = create(true);
    expect(category.MayBuild).toBe(true);
    await category.BuildJournalEntryBatch();
    expect(builds).toBe(1);
  });

  it('withholds Build from anyone else and builds nothing', async () => {
    const category = create(false);
    expect(category.MayBuild).toBe(false);
    await category.BuildJournalEntryBatch();
    expect(builds).toBe(0);
  });

  it('renders the Build button only inside the MayBuild gate', () => {
    const html = readFileSync(join(__dirname, 'batches-category.component.html'), 'utf8');
    expect(html).toMatch(/@if \(MayBuild\) \{\s*<button[^>]*\(click\)="BuildJournalEntryBatch\(\)"/);
  });
});
