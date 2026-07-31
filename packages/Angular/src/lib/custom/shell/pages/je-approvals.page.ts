import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit, OnDestroy } from '@angular/core';
import { RunView } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { UUIDsEqual } from '@memberjunction/global';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { CompanyScopeService } from '../../shared/company-scope.service';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JE_LINE_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';

/** One inbox row — flattened so the template does no entity work. */
export interface PendingManualEntry {
  ID: string;
  EntryNumber: string;
  Company: string;
  EffectiveDate: Date;
  Description: string | null;
  CreatedAt: Date;
  /** Summed from the entry's lines — JournalEntry carries no total (see loadAmounts). */
  Amount: number;
  /**
   * The company's functional currency. Carried per row because these entries span companies and the
   * `currency` pipe silently defaults to USD — which would print "$" on an AED entry.
   */
  CurrencyCode: string;
}

/**
 * Awaiting approval (UI plan §8.1) — the manual-JE review queue (C.8).
 *
 * ⚠ WHAT THIS HONESTLY IS TODAY: a REVIEW QUEUE, not an approval gate.
 *
 * The mockup (`nav-shell-je-approvals.html`) shows Approve/Reject verbs, and §8.1 specs them. They
 * are deliberately NOT built, because the thing they would act on does not exist:
 *   - `JournalEntry.Status` has three values — `Pending | Batched | GLPosted`. There is no
 *     `Approved` state for an approve verb to move an entry into.
 *   - The server's batch candidate filter (`pendingCandidateFilter`) selects `Status='Pending'`
 *     with no entry-type exclusion, so a manual entry is batchable whether or not anyone reviewed it.
 *   - C.8's shape is unresolved — held as "lean yes" pending Robert (plans/QUESTIONS.md#q6 (3)).
 * Shipping the verbs would mean inventing the approval model this app has explicitly deferred, and a
 * button that appears to gate the ledger but does not is worse than no button.
 *
 * So this page ships the half that is real and useful now: the entries a CFO would review, with the
 * full-depth review surface (the existing JE detail slide-in) and a pop-out to the workspace. The
 * verbs land with C.8. The banner says so on-screen rather than letting the emptiness imply consent.
 *
 * CONNECTS TO:
 *   REUSES: ./journal-entry-detail-panel (the review surface — lines, dimensions, lineage)
 *   RULE:   ../../shared/je-rules (awaitsApproval — the same Manual+Pending set, one definition)
 */
@Component({
  standalone: false,
  selector: 'mj-je-approvals-page',
  templateUrl: './je-approvals.page.html',
  styleUrls: ['./je-approvals.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JEApprovalsPageComponent extends BaseAngularComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  /** The shell header's Refresh reaches this page while it is the mounted one. */
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;
  public Scope = inject(CompanyScopeService);

  public Rows: PendingManualEntry[] = [];
  public IsLoading = false;
  public LoadError: string | null = null;
  public SelectedID: string | null = null;

  ngOnInit(): void {
    this.subscribeToShellRefresh();
    void this.load();
  }

  public get Count(): number {
    return this.Rows.length;
  }

  public Refresh(): void {
    void this.load();
  }

  private subscribeToShellRefresh(): void {
    this.refreshSub = this.pageRefresh.OnRefresh(() => this.Refresh());
  }

  ngOnDestroy(): void {
    // Unsubscribing is what keeps the header's Refresh page-aware: a destroyed page stops counting.
    this.refreshSub?.unsubscribe();
  }

  public Review(id: string): void {
    this.SelectedID = id;
    this.cdr.markForCheck();
  }

  public OnDetailClosed(): void {
    this.SelectedID = null;
    this.cdr.markForCheck();
  }

  /** The detail panel can reverse an entry — that changes this queue, so refetch. */
  public OnDetailChanged(): void {
    void this.load();
  }

  /**
   * The queue = the `awaitsApproval` set (Manual + Pending), company-scoped.
   *
   * The predicate is duplicated here as SQL rather than reusing je-rules.awaitsApproval because that
   * seam filters an in-memory row; filtering thousands of entries client-side to find a handful is
   * the wrong shape. The two must agree — the shared rule is the definition, this is its pushdown.
   */
  private async load(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      const rv = RunView.FromMetadataProvider(this.ProviderToUse);
      const res = await rv.RunView<PendingManualEntry & { CompanyID: string; __mj_CreatedAt: Date }>(
        {
          EntityName: JE_ENTITY,
          ExtraFilter: this.Scope.ComposeFilter(`EntryType='Manual' AND Status='Pending'`),
          // Company is a VIEW field — no lookup query (MJ perf rule).
          Fields: ['ID', 'EntryNumber', 'Company', 'CompanyID', 'EffectiveDate', 'Description', '__mj_CreatedAt'],
          OrderBy: 'EffectiveDate ASC, EntryNumber ASC',
          ResultType: 'simple',
        },
        this.ProviderToUse.CurrentUser,
      );
      if (!res.Success) throw new Error(res.ErrorMessage ?? 'Could not load the review queue.');

      const rows = res.Results ?? [];
      const amounts = await this.loadAmounts(rows.map((r) => r.ID));
      this.Rows = rows.map((r) => ({
        ID: r.ID,
        EntryNumber: r.EntryNumber,
        Company: r.Company,
        EffectiveDate: r.EffectiveDate,
        Description: r.Description,
        CreatedAt: r.__mj_CreatedAt,
        Amount: amounts.get(r.ID) ?? 0,
        CurrencyCode: this.functionalCurrency(r.CompanyID),
      }));
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.Rows = [];
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * The company's functional currency, from the engine's cache (no query).
   *
   * Falls back to USD only when the profile is missing — the same thing the `currency` pipe would
   * have done anyway, but reached deliberately rather than by omission.
   */
  private functionalCurrency(companyId: string): string {
    const profile = AccountingEngineBase.Instance.CompanyProfiles.find((p) => UUIDsEqual(p.ID, companyId));
    return profile?.FunctionalCurrencyCode ?? 'USD';
  }

  /**
   * An entry's amount = the sum of its debits (a balanced entry's debits ARE its magnitude).
   *
   * JournalEntry stores no total, so this reads the lines. ONE read for the whole queue, summed in
   * memory — never a per-row query (MJ perf rule: no RunView in a loop). Cheap because the queue is
   * a handful of entries by construction; if it ever isn't, this becomes a read model, not a loop.
   */
  private async loadAmounts(entryIds: string[]): Promise<Map<string, number>> {
    const totals = new Map<string, number>();
    if (entryIds.length === 0) return totals;

    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const res = await rv.RunView<{ JournalEntryID: string; DebitAmount: number | null }>(
      {
        EntityName: JE_LINE_ENTITY,
        ExtraFilter: `JournalEntryID IN (${entryIds.map((id) => `'${id}'`).join(',')})`,
        Fields: ['JournalEntryID', 'DebitAmount'],
        ResultType: 'simple',
      },
      this.ProviderToUse.CurrentUser,
    );
    if (!res.Success) return totals; // a missing amount degrades the row, it must not fail the queue

    for (const line of res.Results ?? []) {
      totals.set(line.JournalEntryID, (totals.get(line.JournalEntryID) ?? 0) + (line.DebitAmount ?? 0));
    }
    return totals;
  }
}
