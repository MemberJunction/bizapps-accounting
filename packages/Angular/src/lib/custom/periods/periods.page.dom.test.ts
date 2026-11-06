import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AuthorizationInfo, IMetadataProvider, Metadata, RunView, UserInfo } from '@memberjunction/core';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import { BOOKS_CLOSED_THROUGH_SET_AUTH, POSTING_START_DATE_SET_AUTH } from '@mj-biz-apps/accounting-engine-base';
import { PeriodsPageComponent } from './periods.page';
import { JournalEntryBatchDispatchClient, PreviewJournalEntryBatchResult } from '../JournalEntryBatchDispatch/journal-entry-batch-dispatch.client';
import { useBusinessClock, viewResult } from '../../../__tests__/support/business-clock';

/**
 * Periods (bc-aidp-next-golive#447): each company's books-closed and posting start dates, the
 * month-close buttons and the posting-start edit behind a confirmation, all shown only to holders
 * of each date's Authorization. The profile's server entity is the authority; here the save is
 * stubbed and the page's handling of its answer is what is tested.
 *
 * The business day is 4 November 2026 in Chicago while the machine is already on the 5th in Tokyo.
 */
const NOVEMBER_4_IN_CHICAGO = {
  BusinessZone: 'America/Chicago',
  BusinessSqlZone: 'Central Standard Time',
  MachineZone: 'Asia/Tokyo',
  Instant: new Date('2026-11-05T03:30:00.000Z'),
};
const COMPANY_ID = '00000000-0000-0000-0000-000000000447';
const USER_ID = '00000000-0000-0000-0000-0000000000a1';
const day = (d: string): Date => new Date(`${d}T00:00:00.000Z`);

type Profile = mjBizAppsAccountingAccountingCompanyProfileEntity;

/** A profile row as the page binds it: the two dates, Save answering `saves`, and Revert. */
function profile(closedThrough: string | null, postingStart: string | null, saves = true) {
  const row = {
    ID: COMPANY_ID,
    Name: 'Placeholder Co',
    BooksClosedThroughDate: closedThrough ? day(closedThrough) : null,
    PostingStartDate: postingStart ? day(postingStart) : null,
    LatestResult: saves ? null : { CompleteMessage: 'Only finance can change the date the books are closed through.' },
    Save: vi.fn(async () => saves),
    Revert: vi.fn(() => true),
  };
  return row;
}

/** Sign in as a user holding the named Authorizations. */
function signInHolding(held: string[]): void {
  const user = new UserInfo();
  user.ID = USER_ID;
  const catalog = [BOOKS_CLOSED_THROUGH_SET_AUTH, POSTING_START_DATE_SET_AUTH].map((Name, i) => ({
    ID: `AUTH-${i}`,
    Name,
    ParentID: null,
    UserCanExecute: () => held.includes(Name),
  })) as unknown as AuthorizationInfo[];
  vi.spyOn(Metadata, 'Provider', 'get').mockReturnValue({ CurrentUser: user, Authorizations: catalog } as unknown as IMetadataProvider);
}

function previewAnswer(count: number): PreviewJournalEntryBatchResult {
  return { Success: true, Candidates: [], TotalDebits: 0, TotalCredits: 0, GrossDebits: 0, GrossCredits: 0, OutOfOrderSkipCount: 0, BeforePostingStartCount: count };
}

describe('PeriodsPageComponent (DOM)', () => {
  useBusinessClock(NOVEMBER_4_IN_CHICAGO);
  let preview: ReturnType<typeof vi.fn<JournalEntryBatchDispatchClient['PreviewJournalEntryBatch']>>;

  beforeEach(() => {
    preview = vi.fn<JournalEntryBatchDispatchClient['PreviewJournalEntryBatch']>(async () => previewAnswer(3));
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'PreviewJournalEntryBatch').mockImplementation(preview);
  });

  async function render(row: ReturnType<typeof profile>): Promise<ComponentFixture<PeriodsPageComponent>> {
    vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue(viewResult([row as unknown as Profile]));
    const fixture = TestBed.createComponent(PeriodsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.IsLoading).toBe(false));
    // Counting runs after the rows render; wait until every count is in.
    await vi.waitFor(() => expect([...fixture.componentInstance.HeldBackCounts.values()].every(c => c !== null)).toBe(true));
    fixture.detectChanges();
    return fixture;
  }

  const button = (f: ComponentFixture<PeriodsPageComponent>, cls: string): HTMLButtonElement | null =>
    f.nativeElement.querySelector(`button.${cls}`);
  const text = (f: ComponentFixture<PeriodsPageComponent>): string => f.nativeElement.textContent.replace(/\s+/g, ' ');

  it('shows both dates and what the posting start date holds back, counted by the batch preview', async () => {
    signInHolding([BOOKS_CLOSED_THROUGH_SET_AUTH, POSTING_START_DATE_SET_AUTH]);
    const fixture = await render(profile('2026-09-30', '2026-10-01'));

    expect(text(fixture)).toContain('2026-09-30');
    expect(text(fixture)).toContain('2026-10-01');
    expect(text(fixture)).toContain('3 pending entries dated before it are held back.');
    expect(preview).toHaveBeenCalledWith({ CompanyIDs: [COMPANY_ID], IncludedJournalEntryIDs: [] });
  });

  it('offers a holder Close October 2026, Reopen month and Edit', async () => {
    signInHolding([BOOKS_CLOSED_THROUGH_SET_AUTH, POSTING_START_DATE_SET_AUTH]);
    const fixture = await render(profile('2026-09-30', '2026-10-01'));

    expect(button(fixture, 'mja-close-month')?.textContent?.trim()).toBe('Close October 2026');
    expect(button(fixture, 'mja-close-month')?.disabled).toBe(false);
    expect(button(fixture, 'mja-reopen-month')?.disabled).toBe(false);
    expect(button(fixture, 'mja-edit-start')).not.toBeNull();
  });

  it('shows anyone without the Authorizations no buttons at all', async () => {
    signInHolding([]);
    const fixture = await render(profile('2026-09-30', '2026-10-01'));

    expect(button(fixture, 'mja-close-month')).toBeNull();
    expect(button(fixture, 'mja-reopen-month')).toBeNull();
    expect(button(fixture, 'mja-edit-start')).toBeNull();
  });

  it('shows each button only to the holder of its own Authorization', async () => {
    signInHolding([BOOKS_CLOSED_THROUGH_SET_AUTH]);
    const fixture = await render(profile('2026-09-30', '2026-10-01'));

    expect(button(fixture, 'mja-close-month')).not.toBeNull();
    expect(button(fixture, 'mja-edit-start')).toBeNull();
  });

  it('will not close the month still under way', async () => {
    signInHolding([BOOKS_CLOSED_THROUGH_SET_AUTH]);
    const fixture = await render(profile('2026-10-31', null));

    expect(button(fixture, 'mja-close-month')?.textContent?.trim()).toBe('Close November 2026');
    expect(button(fixture, 'mja-close-month')?.disabled).toBe(true);
  });

  it('asks before closing, then saves the next month end', async () => {
    signInHolding([BOOKS_CLOSED_THROUGH_SET_AUTH]);
    const row = profile('2026-09-30', null);
    const fixture = await render(row);

    button(fixture, 'mja-close-month')!.click();
    expect(row.Save).not.toHaveBeenCalled();
    expect(fixture.componentInstance.Confirmation?.Message).toContain('closed through 2026-10-31');

    await fixture.componentInstance.Confirm();

    expect(row.Save).toHaveBeenCalledOnce();
    expect(row.BooksClosedThroughDate?.toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });

  it('reopens by moving back to the end of the month before', async () => {
    signInHolding([BOOKS_CLOSED_THROUGH_SET_AUTH]);
    const row = profile('2026-09-30', null);
    const fixture = await render(row);

    button(fixture, 'mja-reopen-month')!.click();
    await fixture.componentInstance.Confirm();

    expect(row.BooksClosedThroughDate?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });

  it('opens the posting start date for editing only after the confirmation, then saves and recounts', async () => {
    signInHolding([POSTING_START_DATE_SET_AUTH]);
    const row = profile(null, '2026-10-01');
    const fixture = await render(row);

    button(fixture, 'mja-edit-start')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type="date"]')).toBeNull();

    await fixture.componentInstance.Confirm();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type="date"]')).not.toBeNull();

    fixture.componentInstance.EditStartValue = '2026-09-01';
    preview.mockClear();
    await fixture.componentInstance.SavePostingStart(row as unknown as Profile);

    expect(row.PostingStartDate?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(preview).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.EditingStartFor).toBeNull();
  });

  it('shows the server refusal and puts the date back', async () => {
    signInHolding([BOOKS_CLOSED_THROUGH_SET_AUTH]);
    const row = profile('2026-09-30', null, false);
    const fixture = await render(row);

    button(fixture, 'mja-close-month')!.click();
    await fixture.componentInstance.Confirm();
    fixture.detectChanges();

    expect(row.Revert).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.MessageIsError).toBe(true);
    expect(text(fixture)).toContain('Only finance can change the date the books are closed through.');
  });
});
