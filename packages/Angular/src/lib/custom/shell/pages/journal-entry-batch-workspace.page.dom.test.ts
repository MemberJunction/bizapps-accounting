import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MJButtonDirective,
  MJPageHeaderInteriorComponent,
  MJPageBodyInteriorComponent,
  MJLeftNavContentComponent,
  MJStatBadgeComponent,
  MJAlertComponent,
  MJEmptyStateComponent,
  MJDropdownComponent,
} from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { JournalEntryBatchWorkspacePageComponent } from './journal-entry-batch-workspace.page';
import { JournalEntryBatchWorkspaceClient, type BatchPreview } from './journal-entry-batch-workspace.client';
import { WorkspaceCardComponent } from '../../../transfer-pending/workspace-tabs/workspace-card.component';
import { WorkspaceTabStripComponent } from '../../../transfer-pending/workspace-tabs/workspace-tab-strip.component';
import { WorkspaceTipDirective } from '../../../transfer-pending/workspace-tabs/workspace-tip.directive';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { stubbedReadsProvider } from '../../../../__tests__/support/business-clock';

/**
 * Overlapping previews (#254): ticking fires a preview per tick, and the responses can settle out
 * of order. Only the latest request for a tab may write that tab's preview, and a response must
 * land on the tab that asked for it, not on whichever tab is active when it arrives.
 */
const ENTRY_A = { ID: 'je-a', EntryNumber: 'JE-A', EffectiveDate: '2026-08-01', EntryTypeCode: 'Manual', CompanyID: 'co-1', Description: null, Amount: 100 };
const ENTRY_B = { ID: 'je-b', EntryNumber: 'JE-B', EffectiveDate: '2026-08-02', EntryTypeCode: 'Manual', CompanyID: 'co-1', Description: null, Amount: 200 };

function preview(debits: number): BatchPreview {
  return {
    Candidates: [ENTRY_A, ENTRY_B],
    AffectedAccounts: [],
    TotalDebits: debits,
    TotalCredits: debits,
    GrossDebits: debits,
    GrossCredits: debits,
    PerCompany: [],
    OutOfOrderSkipCount: 0,
  };
}

describe('JournalEntryBatchWorkspacePageComponent — overlapping previews (DOM, #254)', () => {
  /** One deferred per preview call, settled by the spec in whatever order it chooses. */
  let pending: Array<{ resolve: (p: BatchPreview) => void; reject: (e: Error) => void }>;

  beforeEach(async () => {
    vi.spyOn(AccountingEngineBase.Instance, 'Config').mockResolvedValue(undefined);
    pending = [];
    vi.spyOn(JournalEntryBatchWorkspaceClient.prototype, 'Preview').mockImplementation(
      () => new Promise<BatchPreview>((resolve, reject) => pending.push({ resolve, reject })),
    );
    await TestBed.configureTestingModule({
      declarations: [JournalEntryBatchWorkspacePageComponent],
      imports: [
        CommonModule,
        FormsModule,
        SharedGenericModule,
        MJButtonDirective,
        MJPageHeaderInteriorComponent,
        MJPageBodyInteriorComponent,
        MJLeftNavContentComponent,
        MJStatBadgeComponent,
        MJAlertComponent,
        MJEmptyStateComponent,
        MJDropdownComponent,
        WorkspaceCardComponent,
        WorkspaceTabStripComponent,
        WorkspaceTipDirective,
      ],
      providers: [PageRefreshService],
    }).compileComponents();
  });

  /** Renders the page and loads the first tab's preview: both entries ticked. */
  async function loaded(): Promise<JournalEntryBatchWorkspacePageComponent> {
    const fixture = TestBed.createComponent(JournalEntryBatchWorkspacePageComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.Apply();
    pending[0].resolve(preview(300));
    await vi.waitFor(() => expect(page.IsPreviewing).toBe(false));
    expect(page.Preview?.TotalDebits).toBe(300);
    return page;
  }

  /** Lets the page's awaited preview continuation run. */
  const settle = () => new Promise<void>((r) => setTimeout(r, 0));

  it('applies only the latest response when an earlier one settles last', async () => {
    const page = await loaded();
    page.ToggleEntry(ENTRY_A.ID);
    page.ToggleEntry(ENTRY_B.ID);
    expect(pending).toHaveLength(3);

    pending[2].resolve(preview(0));
    await settle();
    expect(page.Preview?.TotalDebits).toBe(0);
    expect(page.IsPreviewing).toBe(false);

    pending[1].resolve(preview(200)); // the stale answer arrives last
    await settle();
    expect(page.Preview?.TotalDebits).toBe(0);
    expect(page.IsPreviewing).toBe(false);
  });

  it('stays previewing until the latest request settles, even when an earlier one settles first', async () => {
    const page = await loaded();
    page.ToggleEntry(ENTRY_A.ID);
    page.ToggleEntry(ENTRY_B.ID);

    pending[1].resolve(preview(200));
    await settle();
    expect(page.IsPreviewing, 'an older response does not end the loading state').toBe(true);
    expect(page.Preview?.TotalDebits, 'nor is it applied').toBe(300);

    pending[2].resolve(preview(0));
    await settle();
    expect(page.IsPreviewing).toBe(false);
    expect(page.Preview?.TotalDebits).toBe(0);
  });

  it('writes a response to the tab that asked for it when the operator switches tabs mid-request', async () => {
    const page = await loaded();
    const firstTab = page.ActiveTabId!;
    page.ToggleEntry(ENTRY_A.ID);

    page.openNewDraft();
    const secondTab = page.ActiveTabId!;
    expect(secondTab).not.toBe(firstTab);
    expect(page.Preview, 'the new tab has no preview of its own').toBeNull();

    pending[1].resolve(preview(200));
    await settle();
    expect(page.Preview, 'the response did not land on the new tab').toBeNull();
    expect(page.Draft?.ExcludedIDs).toEqual([]);

    page.SelectTab(firstTab);
    expect(page.Preview?.TotalDebits).toBe(200);
    expect(page.Draft?.ExcludedIDs).toEqual([ENTRY_A.ID]);
  });
});
