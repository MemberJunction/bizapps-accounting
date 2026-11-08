import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompositeKey, Metadata, RunView } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { NavigationService } from '@memberjunction/ng-shared';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { MJButtonDirective, MJDialogComponent, MJDialogActionsComponent } from '@memberjunction/ng-ui-components';
import { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import {
  CanCloseMonth,
  CloseMonthThrough,
  ReopenMonthThrough,
  UserCanSetBooksClosedThroughDate,
  UserCanSetPostingStartDate,
} from '@mj-biz-apps/accounting-engine-base';
import { BusinessTimeZoneEngine, FromCalendarDay, IsCalendarDay, ToCalendarDay } from '@mj-biz-apps/common-entities';
import { JournalEntryBatchDispatchClient } from '../JournalEntryBatchDispatch/journal-entry-batch-dispatch.client';
import { PostingMonthLabel } from '../shared/posting-date-warning';

const COMPANY_PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

type CompanyProfile = mjBizAppsAccountingAccountingCompanyProfileEntity;
type CutoffField = 'BooksClosedThroughDate' | 'PostingStartDate';

/** The confirmation the page is asking for, or none. */
export interface PeriodsConfirmation {
  Kind: 'close' | 'reopen' | 'edit-start';
  Profile: CompanyProfile;
  /** The BooksClosedThroughDate a close or reopen sets; null for 'edit-start'. */
  NewDay: string | null;
  Title: string;
  Message: string;
}

/**
 * Periods: month close for each company (bc-aidp-next-golive#447).
 *
 * One row per active company, showing the two posting cutoffs on its Accounting Company Profile:
 *   - Books closed through: Close month / Reopen month move it by whole calendar months, to a month
 *     end (`CloseMonthThrough` / `ReopenMonthThrough`). A batch cannot post on or before it.
 *   - Posting start date: read-only, with an Edit that asks first. Entries dated before it never
 *     enter a batch; the count shown is the batch preview's own `BeforePostingStartCount`.
 *
 * The buttons show only to holders of each date's Authorization (the Finance role). The profile's
 * server entity is the authority: it refuses either change from anyone else.
 *
 * Binds to the profile entities directly and saves them (docs/ui-architecture.md); the count comes
 * from the `Accounting.PreviewJournalEntryBatch` operation, the same read the batch builder shows.
 */
@Component({
  selector: 'mj-accounting-periods-page',
  standalone: true,
  imports: [FormsModule, SharedGenericModule, MJButtonDirective, MJDialogComponent, MJDialogActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './periods.page.html',
  styleUrls: ['./periods.page.css'],
})
export class PeriodsPageComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private navService = inject(NavigationService, { optional: true });

  public Profiles: CompanyProfile[] = [];
  public IsLoading = true;
  public LoadError: string | null = null;
  public Message: string | null = null;
  public MessageIsError = false;

  /** Entries held back by each company's posting start date; null while counting or when the count failed. */
  public HeldBackCounts = new Map<string, number | null>();
  public Confirmation: PeriodsConfirmation | null = null;
  /** The company whose posting start date is open for editing, after the confirmation. */
  public EditingStartFor: string | null = null;
  public EditStartValue = '';
  public SavingFor: string | null = null;

  ngOnInit(): void {
    void this.Load();
  }

  // ─── who may do what (display only; the server entity refuses the rest) ─────

  public get MayCloseBooks(): boolean {
    const md = new Metadata();
    return UserCanSetBooksClosedThroughDate(md.CurrentUser, md.Authorizations);
  }

  public get MayEditPostingStart(): boolean {
    const md = new Metadata();
    return UserCanSetPostingStartDate(md.CurrentUser, md.Authorizations);
  }

  // ─── loading ─────────────────────────────────────────────────────────────────

  public async Load(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    const res = await new RunView().RunView<CompanyProfile>({
      EntityName: COMPANY_PROFILE_ENTITY,
      ExtraFilter: 'IsActive=1',
      OrderBy: 'Name ASC',
      ResultType: 'entity_object',
    });
    this.Profiles = res.Success ? (res.Results ?? []) : [];
    this.LoadError = res.Success ? null : (res.ErrorMessage || 'Could not load the companies. Refresh the page to try again.');
    this.IsLoading = false;
    this.cdr.markForCheck();
    await this.loadHeldBackCounts(this.Profiles);
  }

  /**
   * One preview per company with a posting start date, ticking nothing so the server skips the
   * netting: only its count of entries dated before the posting start date is read.
   */
  private async loadHeldBackCounts(profiles: CompanyProfile[]): Promise<void> {
    const dated = profiles.filter(p => this.PostingStartDay(p) !== null);
    for (const p of dated) this.HeldBackCounts.set(p.ID, null);
    this.cdr.markForCheck();
    const client = new JournalEntryBatchDispatchClient(Metadata.Provider as GraphQLDataProvider);
    await Promise.all(dated.map(async p => {
      const res = await client.PreviewJournalEntryBatch({ CompanyIDs: [p.ID], IncludedJournalEntryIDs: [] });
      this.HeldBackCounts.set(p.ID, res.Success ? res.BeforePostingStartCount : null);
    }));
    this.cdr.markForCheck();
  }

  // ─── row helpers ─────────────────────────────────────────────────────────────

  public ClosedThroughDay(p: CompanyProfile): string | null {
    return ToCalendarDay(p.BooksClosedThroughDate);
  }

  public PostingStartDay(p: CompanyProfile): string | null {
    return ToCalendarDay(p.PostingStartDate);
  }

  /** 'September 2026' for the month a close would close. */
  public NextMonthToClose(p: CompanyProfile): string {
    return PostingMonthLabel(CloseMonthThrough(this.ClosedThroughDay(p), this.today()));
  }

  public CanClose(p: CompanyProfile): boolean {
    return this.MayCloseBooks && CanCloseMonth(this.ClosedThroughDay(p), this.today());
  }

  public CanReopen(p: CompanyProfile): boolean {
    return this.MayCloseBooks && this.ClosedThroughDay(p) !== null;
  }

  public HeldBackText(p: CompanyProfile): string {
    if (!this.HeldBackCounts.has(p.ID)) return '';
    const count = this.HeldBackCounts.get(p.ID);
    if (count === null || count === undefined) return 'Counting the entries it holds back…';
    return count === 1 ? '1 pending entry dated before it is held back.' : `${count} pending entries dated before it are held back.`;
  }

  public IsBusy(p: CompanyProfile): boolean {
    return this.SavingFor === p.ID;
  }

  private today(): string {
    return BusinessTimeZoneEngine.Instance.Today();
  }

  // ─── asking first ────────────────────────────────────────────────────────────

  public AskClose(p: CompanyProfile): void {
    if (!this.CanClose(p)) return;
    const newDay = CloseMonthThrough(this.ClosedThroughDay(p), this.today());
    this.Confirmation = {
      Kind: 'close', Profile: p, NewDay: newDay,
      Title: `Close ${PostingMonthLabel(newDay)}`,
      Message: `${p.Name}'s books will be closed through ${newDay}. No batch can post on or before that date until the month is reopened.`,
    };
    this.cdr.markForCheck();
  }

  public AskReopen(p: CompanyProfile): void {
    const closedThrough = this.ClosedThroughDay(p);
    if (!closedThrough || !this.CanReopen(p)) return;
    const newDay = ReopenMonthThrough(closedThrough);
    this.Confirmation = {
      Kind: 'reopen', Profile: p, NewDay: newDay,
      Title: `Reopen ${PostingMonthLabel(closedThrough)}`,
      Message: `${p.Name}'s books will be closed through ${newDay}, so batches can post in ${PostingMonthLabel(closedThrough)} again. Reopen it in the ERP too, or the ERP will refuse those batches.`,
    };
    this.cdr.markForCheck();
  }

  public AskEditPostingStart(p: CompanyProfile): void {
    if (!this.MayEditPostingStart) return;
    this.Confirmation = {
      Kind: 'edit-start', Profile: p, NewDay: null,
      Title: 'Change the posting start date',
      Message: 'Journal entries dated before the posting start date never enter a batch. Moving it earlier sends those entries to the ERP in the next batch; moving it later holds entries back. Change it only when the ERP needs that history, or already has it.',
    };
    this.cdr.markForCheck();
  }

  public CancelConfirmation(): void {
    this.Confirmation = null;
    this.cdr.markForCheck();
  }

  public async Confirm(): Promise<void> {
    const c = this.Confirmation;
    if (!c) return;
    this.Confirmation = null;
    if (c.Kind === 'edit-start') {
      this.EditingStartFor = c.Profile.ID;
      this.EditStartValue = this.PostingStartDay(c.Profile) ?? '';
      this.cdr.markForCheck();
      return;
    }
    const verb = c.Kind === 'close' ? 'Closed' : 'Reopened';
    await this.saveCutoff(c.Profile, 'BooksClosedThroughDate', c.NewDay, `${verb}: ${c.Profile.Name}'s books are closed through ${c.NewDay}.`);
  }

  // ─── editing the posting start date ──────────────────────────────────────────

  public CancelEditPostingStart(): void {
    this.EditingStartFor = null;
    this.EditStartValue = '';
    this.cdr.markForCheck();
  }

  /** An empty value clears the date: every Pending entry is then a candidate. */
  public async SavePostingStart(p: CompanyProfile): Promise<void> {
    const value = this.EditStartValue.trim();
    if (value && !IsCalendarDay(value)) {
      this.showMessage('Enter the posting start date as a date, or leave it empty to clear it.', true);
      return;
    }
    const done = value ? `${p.Name}'s posting start date is ${value}.` : `${p.Name} has no posting start date now.`;
    if (await this.saveCutoff(p, 'PostingStartDate', value || null, done)) {
      this.EditingStartFor = null;
      await this.loadHeldBackCounts([p]);
    }
  }

  // ─── saving ──────────────────────────────────────────────────────────────────

  /** Sets one cutoff and saves the profile; on a refusal shows the server's reason and puts the date back. */
  private async saveCutoff(p: CompanyProfile, field: CutoffField, day: string | null, done: string): Promise<boolean> {
    this.SavingFor = p.ID;
    this.cdr.markForCheck();
    try {
      p[field] = day ? FromCalendarDay(day) : null;
      const saved = await p.Save();
      if (saved) this.showMessage(done, false);
      else {
        this.showMessage(p.LatestResult?.CompleteMessage || 'The change was not saved. Try again.', true);
        p.Revert();
      }
      return saved;
    } finally {
      this.SavingFor = null;
      this.cdr.markForCheck();
    }
  }

  private showMessage(text: string, isError: boolean): void {
    this.Message = text;
    this.MessageIsError = isError;
    this.cdr.markForCheck();
  }

  /** The profile record, whose History tab lists every change to both dates. */
  public OpenProfile(p: CompanyProfile): void {
    this.navService?.OpenEntityRecord(COMPANY_PROFILE_ENTITY, CompositeKey.FromID(p.ID));
  }
}
