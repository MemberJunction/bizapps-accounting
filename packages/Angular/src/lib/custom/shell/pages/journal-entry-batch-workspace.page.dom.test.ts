import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { UserInfo, type IMetadataProvider, type IRemoteOperationProvider, type RemoteOpResult } from '@memberjunction/core';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { JournalEntryBatchWorkspacePageComponent } from './journal-entry-batch-workspace.page';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { AccountingShellModule } from '../shell.module';
import { AUGUST_CLOSE_IN_CHICAGO, useBusinessClock } from '../../../../__tests__/support/business-clock';

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
      AffectedAccounts: [], TotalDebits: 100, TotalCredits: 100, GrossDebits: 100, GrossCredits: 100, PerCompany: [], OutOfOrderSkipCount: 0,
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
    ['in the future', '2026-09-01', 'The posting date 2026-09-01 is in the future — choose today or an earlier day.'],
    ['earlier than an included entry', '2026-08-29',
      'The posting date 2026-08-29 is earlier than an included entry dated 2026-08-30 — move it to 2026-08-30 or later, or apply the filters again.'],
  ])('blocks the build when the posting date is %s', async (_label, postingDate, reason) => {
    const page = await render();
    withPreview(page, '2026-08-30');
    page.Draft!.Criteria.PostingDate = postingDate;
    expect(page.CanBuild).toBe(false);
    expect(page.BuildBlockedReason).toBe(reason);
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
