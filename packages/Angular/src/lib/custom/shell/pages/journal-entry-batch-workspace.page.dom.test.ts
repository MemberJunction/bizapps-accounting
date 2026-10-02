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

  it('sends the cutoff to the preview as that day, never an instant', async () => {
    const page = (await render()).componentInstance;
    page.Apply();
    await vi.waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0].Name).toBe('Accounting.PreviewJournalEntryBatch');
    expect(calls[0].Payload['Cutoff']).toBe(BUSINESS_DAY);
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
  });
});
