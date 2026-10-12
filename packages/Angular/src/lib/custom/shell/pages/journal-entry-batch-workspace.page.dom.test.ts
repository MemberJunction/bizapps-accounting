import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserInfo, type IMetadataProvider, type IRemoteOperationProvider, type RemoteOpResult } from '@memberjunction/core';
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
import { AccountingShellModule } from '../shell.module';
import { AUGUST_CLOSE_IN_CHICAGO, stubbedReadsProvider, useBusinessClock } from '../../../../__tests__/support/business-clock';

/**
 * The batch workspace's default cutoff is the BUSINESS day, sent as a day (golive #168).
 *
 * At AUGUST_CLOSE_IN_CHICAGO it is 31 August in Chicago and already 1 September in UTC. The old
 * default was a `datetime-local` "now" sent as a UTC instant; the engine compared that instant
 * with EffectiveDate — a DATE column — so the preview admitted entries dated 1 September, and the
 * operator's ticked list then went into the batch.
 *
 * The first suite blanks the template: the default and what reaches the wire are component state.
 * The second renders the real template through AccountingShellModule, so the input's `type="date"`
 * (a `datetime-local` would hold an instant) is pinned too.
 */
const BUSINESS_DAY = '2026-08-31';
const NO_CUTOFF = 'no cutoff — through the posting date';

interface RecordedCall {
  Name: string;
  Payload: Record<string, unknown>;
}

/** A provider that carries a user and records every remote operation the page routes. */
function recordingProvider(calls: RecordedCall[]): IMetadataProvider {
  const provider: Pick<IMetadataProvider, 'CurrentUser'> & Pick<IRemoteOperationProvider, 'RouteOperation'> = {
    CurrentUser: new UserInfo(),
    RouteOperation: async <TInput, TOutput>(name: string, payload: TInput): Promise<RemoteOpResult<TOutput>> => {
      calls.push({ Name: name, Payload: payload as Record<string, unknown> });
      const emptyPreview = { Candidates: [] } as unknown as TOutput;
      return { Success: true, Output: emptyPreview } as RemoteOpResult<TOutput>;
    },
  };
  return provider as unknown as IMetadataProvider;
}

describe('JournalEntryBatchWorkspacePageComponent — default cutoff (DOM)', () => {
  useBusinessClock(AUGUST_CLOSE_IN_CHICAGO);
  let calls: RecordedCall[];

  beforeEach(async () => {
    calls = [];
    vi.spyOn(AccountingEngineBase.prototype, 'Config').mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      declarations: [JournalEntryBatchWorkspacePageComponent],
      providers: [PageRefreshService],
    })
      .overrideComponent(JournalEntryBatchWorkspacePageComponent, { set: { template: '' } })
      .compileComponents();
  });

  async function render(): Promise<ComponentFixture<JournalEntryBatchWorkspacePageComponent>> {
    const fixture = TestBed.createComponent(JournalEntryBatchWorkspacePageComponent);
    fixture.componentRef.setInput('Provider', recordingProvider(calls));
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('defaults a new draft to the business day, not a clock reading', async () => {
    const page = (await render()).componentInstance;
    expect(page.Draft?.Criteria.Cutoff).toBe(BUSINESS_DAY);
    expect(page.CriteriaChips).toContain(`through ${BUSINESS_DAY}`);
  });

  it('says so when the cutoff is cleared — an empty cutoff previews everything through the posting date', async () => {
    // Clearing the date input sends no cutoff, so the pool ends at the posting date (golive #315).
    // That was silent: the "through" chip simply vanished.
    const page = (await render()).componentInstance;
    page.Draft!.Criteria.Cutoff = '';
    page.OnCriteriaChanged();
    page.Apply();
    await vi.waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0].Payload['Cutoff']).toBeNull();
    expect(page.CriteriaChips).toContain(NO_CUTOFF);
  });

  it('sends the cutoff to the preview as that day, never an instant', async () => {
    const page = (await render()).componentInstance;
    page.Apply();
    await vi.waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0].Name).toBe('Accounting.PreviewJournalEntryBatch');
    expect(calls[0].Payload['Cutoff']).toBe(BUSINESS_DAY);
  });
});

describe('JournalEntryBatchWorkspacePageComponent — posting date (golive #315)', () => {
  useBusinessClock(AUGUST_CLOSE_IN_CHICAGO);
  let calls: RecordedCall[];

  beforeEach(async () => {
    calls = [];
    vi.spyOn(AccountingEngineBase.prototype, 'Config').mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      declarations: [JournalEntryBatchWorkspacePageComponent],
      providers: [PageRefreshService],
    })
      .overrideComponent(JournalEntryBatchWorkspacePageComponent, { set: { template: '' } })
      .compileComponents();
  });

  async function render(): Promise<JournalEntryBatchWorkspacePageComponent> {
    const fixture = TestBed.createComponent(JournalEntryBatchWorkspacePageComponent);
    fixture.componentRef.setInput('Provider', recordingProvider(calls));
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  /** A loaded, balanced preview of one entry dated `day`. */
  function withPreview(page: JournalEntryBatchWorkspacePageComponent, day: string): void {
    page.Draft!.Preview = {
      Candidates: [{ ID: 'je-1', EntryNumber: 'JE-0001', EffectiveDate: `${day}T00:00:00.000Z`, EntryTypeCode: 'Manual', CompanyID: 'c-1', Description: null, Amount: 100 }],
      AffectedAccounts: [], TotalDebits: 100, TotalCredits: 100, GrossDebits: 100, GrossCredits: 100, PerCompany: [], OutOfOrderSkipCount: 0, BeforePostingStartCount: 0,
    };
  }

  it('defaults to the business day, shows it as a chip, and sends it with the preview', async () => {
    const page = await render();
    expect(page.Draft?.Criteria.PostingDate).toBe(BUSINESS_DAY);
    expect(page.CriteriaChips).toContain(`posting date ${BUSINESS_DAY}`);

    page.Apply();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].Payload['PostingDate']).toBe(BUSINESS_DAY);
  });

  it('sends the chosen posting date with the build', async () => {
    const page = await render();
    page.Draft!.Criteria.PostingDate = '2026-08-30';
    withPreview(page, '2026-08-29');
    await page.Build();

    const build = calls.find(c => c.Name === 'Accounting.BuildJournalEntryBatch');
    expect(build?.Payload['PostingDate']).toBe('2026-08-30');
  });

  it.each([
    ['empty', '', 'Choose a posting date.'],
    ['earlier than an included entry', '2026-08-29',
      'The posting date 2026-08-29 is earlier than an included entry dated 2026-08-30 — move it to 2026-08-30 or later, or apply the filters again.'],
  ])('blocks the build when the posting date is %s', async (_label, postingDate, reason) => {
    const page = await render();
    withPreview(page, '2026-08-30');
    page.Draft!.Criteria.PostingDate = postingDate;
    expect(page.CanBuild).toBe(false);
    expect(page.BuildBlockedReason).toBe(reason);
  });

  it.each([
    ['future', '2026-09-01', 'September 2026'],
    ['prior', '2026-07-31', 'July 2026'],
  ])('asks before building on a %s-month posting date, and asks again when the date changes', async (which, day, month) => {
    const page = await render();
    withPreview(page, '2026-07-01');
    page.Draft!.Criteria.PostingDate = day;
    expect(page.PostingDateWarning).toBe(`The posting date ${day} is in a ${which} month, so the ERP books this batch in ${month}. Are you sure?`);
    expect(page.CanBuild).toBe(false);
    expect(page.BuildBlockedReason).toBe(`Confirm posting this batch in ${month}.`);

    page.ConfirmPostingDate(true);
    expect(page.CanBuild).toBe(true);
    expect(page.BuildBlockedReason).toBeNull();

    page.Draft!.Criteria.PostingDate = which === 'future' ? '2026-09-02' : '2026-07-30';
    expect(page.PostingDateProblem).toBeNull();
    expect(page.CanBuild, 'a different date asks again').toBe(false);
  });

  it('sends a confirmed future-month posting date with the build', async () => {
    const page = await render();
    withPreview(page, '2026-08-30');
    page.Draft!.Criteria.PostingDate = '2026-09-01';
    page.ConfirmPostingDate(true);
    await page.Build();

    const build = calls.find(c => c.Name === 'Accounting.BuildJournalEntryBatch');
    expect(build?.Payload['PostingDate']).toBe('2026-09-01');
  });

  it('allows a posting date on the latest included entry\'s day', async () => {
    const page = await render();
    withPreview(page, '2026-08-30');
    page.Draft!.Criteria.PostingDate = '2026-08-30';
    expect(page.PostingDateProblem).toBeNull();
    expect(page.CanBuild).toBe(true);
  });
});

describe('JournalEntryBatchWorkspacePageComponent — cutoff input (DOM, real template)', () => {
  useBusinessClock(AUGUST_CLOSE_IN_CHICAGO);
  let calls: RecordedCall[];

  beforeEach(async () => {
    calls = [];
    vi.spyOn(AccountingEngineBase.prototype, 'Config').mockResolvedValue(undefined);
    await TestBed.configureTestingModule({ imports: [AccountingShellModule], providers: [PageRefreshService] }).compileComponents();
  });

  it('renders the cutoff as a date input holding the business day', async () => {
    const fixture = TestBed.createComponent(JournalEntryBatchWorkspacePageComponent);
    fixture.componentRef.setInput('Provider', recordingProvider(calls));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const label = [...fixture.nativeElement.querySelectorAll('label.bw-field')].find(
      (el: Element) => el.querySelector('span')?.textContent?.trim() === 'Include unbatched through',
    );
    const input = label?.querySelector('input') as HTMLInputElement | null;
    expect(input, 'the cutoff input rendered').not.toBeNull();
    expect(input!.type).toBe('date');
    await vi.waitFor(() => expect(input!.value).toBe(BUSINESS_DAY));
    expect(label!.querySelector('.bw-hint'), 'no warning while a cutoff is set').toBeNull();

    input!.value = '';
    input!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(label!.querySelector('.bw-hint')?.textContent?.trim()).toBe('No cutoff — includes everything through the posting date.');
  });
});

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
    BeforePostingStartCount: 0,
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
    expect(page.Draft?.Selection).toBeNull();

    page.SelectTab(firstTab);
    expect(page.Preview?.TotalDebits).toBe(200);
    expect(page.Draft?.Selection).toEqual([ENTRY_B.ID]);
  });
});

/**
 * The selection after a criteria change (golive #284). The preview request carries the selection
 * as it is; it used to be derived from the previous preview's candidates, so after Apply on wider
 * criteria the totals covered the old pool while the new entries showed ticked.
 */
describe('JournalEntryBatchWorkspacePageComponent — selection across a criteria change (DOM, golive #284)', () => {
  const MANUAL = { ...ENTRY_A, EntryTypeCode: 'Manual', Amount: 100 };
  const SYSTEM_OLD = { ...ENTRY_B, ID: 'je-s1', EntryNumber: 'JE-S1', EffectiveDate: '2026-07-31', EntryTypeCode: 'Invoice', Amount: 50 };
  const SYSTEM_NEW = { ...ENTRY_B, ID: 'je-s2', EntryNumber: 'JE-S2', EffectiveDate: '2026-08-03', EntryTypeCode: 'Invoice', Amount: 70 };
  const POOL = [SYSTEM_OLD, MANUAL, SYSTEM_NEW]; // oldest first
  let requested: Array<string[] | null>;

  beforeEach(async () => {
    vi.spyOn(AccountingEngineBase.Instance, 'Config').mockResolvedValue(undefined);
    requested = [];
    // Answers like previewBatch: filter by type, total the included ids that are in the pool.
    vi.spyOn(JournalEntryBatchWorkspaceClient.prototype, 'Preview').mockImplementation(async (_p, _c, includedIds, entryTypes) => {
      requested.push(includedIds);
      const rows = POOL.filter((e) => !entryTypes || entryTypes.includes(e.EntryTypeCode));
      const included = new Set(includedIds ?? rows.map((r) => r.ID));
      const total = rows.filter((r) => included.has(r.ID)).reduce((s, r) => s + r.Amount, 0);
      return { ...preview(total), Candidates: rows };
    });
    await TestBed.configureTestingModule({ imports: [AccountingShellModule], providers: [PageRefreshService] }).compileComponents();
  });

  async function loadedManualOnly(): Promise<ComponentFixture<JournalEntryBatchWorkspacePageComponent>> {
    const fixture = TestBed.createComponent(JournalEntryBatchWorkspacePageComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.Draft!.Criteria.EntryTypeScope = 'Manual';
    page.Apply();
    await vi.waitFor(() => expect(page.IsPreviewing).toBe(false));
    fixture.detectChanges();
    return fixture;
  }

  async function widenToAll(fixture: ComponentFixture<JournalEntryBatchWorkspacePageComponent>): Promise<void> {
    const page = fixture.componentInstance;
    page.Draft!.Criteria.EntryTypeScope = 'All';
    page.OnCriteriaChanged();
    page.Apply();
    await vi.waitFor(() => expect(page.IsPreviewing).toBe(false));
    fixture.detectChanges();
  }

  const ticked = (fixture: ComponentFixture<JournalEntryBatchWorkspacePageComponent>) =>
    Array.from(fixture.nativeElement.querySelectorAll('.bw-grid tbody input[type="checkbox"]') as NodeListOf<HTMLInputElement>)
      .filter((b) => b.checked)
      .map((b) => b.getAttribute('aria-label'));

  it('with every entry ticked, wider criteria bring the new entries in ticked and totalled', async () => {
    const fixture = await loadedManualOnly();
    await widenToAll(fixture);
    const page = fixture.componentInstance;
    expect(requested).toEqual([null, null]);
    expect(ticked(fixture)).toEqual(['Include JE-S1', 'Include JE-A', 'Include JE-S2']);
    expect(page.IncludedCount).toBe(3);
    expect(page.Preview?.GrossDebits).toBe(220);
  });

  it('after an untick, wider criteria bring the new entries in unticked, and the totals match the ticks', async () => {
    const fixture = await loadedManualOnly();
    const page = fixture.componentInstance;
    page.ToggleEntry(MANUAL.ID); // untick the only entry
    await vi.waitFor(() => expect(page.IsPreviewing).toBe(false));
    expect(requested.at(-1)).toEqual([]);

    await widenToAll(fixture);
    expect(requested.at(-1)).toEqual([]);
    expect(ticked(fixture)).toEqual([]);
    expect(page.IncludedCount).toBe(0);
    expect(page.Preview?.GrossDebits).toBe(0);
    expect(page.CanBuild).toBe(false);

    page.ToggleEntry(SYSTEM_NEW.ID);
    await vi.waitFor(() => expect(page.IsPreviewing).toBe(false));
    fixture.detectChanges();
    expect(requested.at(-1)).toEqual([SYSTEM_NEW.ID]);
    expect(ticked(fixture)).toEqual(['Include JE-S2']);
    expect(page.IncludedCount).toBe(1);
    expect(page.Preview?.GrossDebits).toBe(70);
  });
});
