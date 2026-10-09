import { Component, ChangeDetectionStrategy, ChangeDetectorRef, Input, inject, OnInit, OnDestroy } from '@angular/core';
import { RunView, type IRemoteOperationProvider } from '@memberjunction/core';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { BusinessTimeZoneEngine, IsBeforeDay, IsCalendarDay, ToCalendarDay } from '@mj-biz-apps/common-entities';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { PostingDateMonthWarning, PostingMonthLabel } from '../../shared/posting-date-warning';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { WorkspaceTabStore } from '../../../transfer-pending/workspace-tabs/workspace-tab-store';
import { WorkspaceTab } from '../../../transfer-pending/workspace-tabs/workspace-tabs.types';
import {
  JournalEntryBatchWorkspaceClient,
  type JournalEntryBatchCriteria,
  type BatchPreview,
  type EntryTypeScope,
  type JournalEntryBatchTargetSystem,
} from './journal-entry-batch-workspace.client';
import {
  ALL_ENTRIES,
  IncludedCandidateIds,
  IsEntryIncluded,
  SelectionRequestIds,
  ToggleEntrySelection,
  type EntrySelection,
} from '../../shared/entry-selection';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/** One workspace tab's session state — the draft the operator is composing. */
interface BatchDraft {
  Criteria: JournalEntryBatchCriteria;
  /** Optional free-text label (JournalEntryBatch.Memo) — "what was this batch for". NOT identity
   *  (JournalEntryBatchNumber is); purely for findability. Editable pre-build, and it drives the tab caption. */
  Memo: string;
  /** The ticked entries: every candidate (null), or an explicit include set sent to the preview as
   *  it is (golive #284). Once the operator unticks one, entries a later Apply brings in start unticked. */
  Selection: EntrySelection;
  /** Set once built — the tab becomes a read-only record of the batch. */
  BuiltJournalEntryBatchNumber?: string;
  /** The loaded preview — stored PER-TAB so switching tabs does NOT re-query the server (Marcelo
   *  2026-07-21). Null until the operator clicks Load / Apply (the query is deferred, never automatic). */
  Preview?: BatchPreview | null;
  /** True when the criteria changed since the last load — the shown preview is stale; Apply refreshes it. */
  PreviewStale?: boolean;
}

/**
 * Batch workspace (UI plan §8.2) — the batch BUILDER, built as a workspace rather than a
 * wizard/modal because batch building fails the element doctrine's encapsulation test.
 *
 * Follows the approved mockup (`design-docs/ui-design/mockups/nav-shell-batch-workspace.html`):
 * criteria panel left (the ONLY filter surface on the page — round-2 ruling: never two filter
 * systems), preview right with include/exclude, the MOD-8 out-of-order warning, a live Dr = Cr
 * strip with per-company subtotals, and session tabs.
 *
 * Everything server-side goes through the `Accounting.PreviewJournalEntryBatch` / `Accounting.BuildJournalEntryBatch`
 * Remote Operations — the preview runs the SAME candidate filter and netting the build runs, so
 * what you see is what you get.
 */
@Component({
  standalone: false,
  selector: 'mj-batch-workspace-page',
  templateUrl: './journal-entry-batch-workspace.page.html',
  styleUrls: ['./shell-table.css', './journal-entry-batch-workspace.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalEntryBatchWorkspacePageComponent extends BaseAngularComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  /** The shell header's Refresh reaches this page only while it is the mounted one. */
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;
  public Scope = inject(CompanyScopeService);

  private tabs = new WorkspaceTabStore<BatchDraft>();
  private client = new JournalEntryBatchWorkspaceClient();

  /** The active tab's loaded preview (per-tab, so tab switches don't re-query). Null until Load/Apply. */
  public get Preview(): BatchPreview | null {
    return this.Draft?.Preview ?? null;
  }
  /** True once this tab has loaded a preview — drives the "Load entries" empty-state vs the table. */
  public get PreviewLoaded(): boolean {
    return !!this.Draft?.Preview;
  }
  /** True when the criteria changed since the last load — show an "Apply to refresh" hint. */
  public get PreviewStale(): boolean {
    return !!this.Draft?.PreviewStale && !this.IsBuilt;
  }
  public IsPreviewing = false;
  public IsBuilding = false;
  public ActionMessage: string | null = null;
  public ActionIsError = false;

  /**
   * The mockup's 3-way entry-type control — NOT the entity's 16-value EntryType union.
   *
   * The mockup labelled 'All' as "approved only". It is NOT: the C.8 manual-JE approval gate does
   * not exist server-side (see je-rules.awaitsApproval / QUESTIONS.md#q6), so 'All' really does mean
   * every Pending entry, manual ones included. Label says what the build does.
   */
  /** Dropdown sentinel + choice rows (were inline <option>s). */
  public readonly AllCompaniesDefault = { ID: null, Name: 'All companies' };
  public readonly SourceChoices: ReadonlyArray<{ Label: string; Value: string }> = [
    { Label: 'Standard (oldest-forward)', Value: 'Standard' },
    { Label: 'From a saved view…', Value: 'View' },
  ];

  public readonly EntryTypeScopes: ReadonlyArray<{ Id: EntryTypeScope; Label: string }> = [
    { Id: 'All', Label: 'All (system + manual)' },
    { Id: 'System', Label: 'System only' },
    { Id: 'Manual', Label: 'Manual only' },
  ];

  public readonly TargetSystems: readonly JournalEntryBatchTargetSystem[] = ['BusinessCentral'];

  ngOnInit(): void {
    this.refreshSub = this.pageRefresh.OnRefresh(() => this.Refresh());
    // Prime the engine cache (JournalEntryTypes for the scope control) — no-op when already loaded.
    void AccountingEngineBase.Instance.Config(false, this.ProviderToUse.CurrentUser, this.ProviderToUse);
    this.openNewDraft();
    this.initialized = true;
    if (this.pendingFocusID) {
      const id = this.pendingFocusID;
      this.pendingFocusID = null;
      void this.openExistingBatch(id);
    }
  }

  // ─── open an EXISTING batch (the lists' "Open in workspace") ────────────────

  /**
   * An existing batch to open as a read-only record tab — the target of the batch detail panel's
   * "Open in workspace". The category passes its `PageParam` here (GoToPage('workspace', id)). The
   * tab uses the same `BuiltJournalEntryBatchNumber` receipt mode a just-built batch gets: viewing where
   * batches live, never editing a built batch.
   */
  @Input()
  set FocusJournalEntryBatchID(value: string | null) {
    if (!value || value === this._focusJournalEntryBatchID) return;
    this._focusJournalEntryBatchID = value;
    if (this.initialized) void this.openExistingBatch(value);
    else this.pendingFocusID = value;
  }
  get FocusJournalEntryBatchID(): string | null {
    return this._focusJournalEntryBatchID;
  }
  private _focusJournalEntryBatchID: string | null = null;
  private pendingFocusID: string | null = null;
  private initialized = false;

  /** Load the batch and open it as a locked record tab labeled by batch number. */
  private async openExistingBatch(id: string): Promise<void> {
    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const res = await rv.RunView<{ ID: string; JournalEntryBatchNumber: string; Memo: string | null }>(
      {
        EntityName: 'MJ_BizApps_Accounting: Journal Entry Batches',
        ExtraFilter: `ID='${id}'`,
        Fields: ['ID', 'JournalEntryBatchNumber', 'Memo'],
        ResultType: 'simple',
      },
      this.ProviderToUse.CurrentUser,
    );
    const row = res.Success ? (res.Results?.[0] ?? null) : null;
    if (!row) {
      this.cdr.markForCheck();
      return;
    }
    this.tabs.Open({
      Id: `batch-view-${id}`,
      Label: row.JournalEntryBatchNumber,
      Icon: 'fa-solid fa-layer-group',
      Status: 'complete', // read-only record — a built batch is immutable from here
      State: {
        Criteria: this.defaultCriteria(),
        Selection: ALL_ENTRIES,
        Memo: row.Memo ?? '',
        Preview: null,
        PreviewStale: false,
        BuiltJournalEntryBatchNumber: row.JournalEntryBatchNumber,
      },
    });
    this.cdr.markForCheck();
  }

  // ─── tabs ──────────────────────────────────────────────────────────────────

  public get Tabs(): WorkspaceTab[] {
    return this.tabs.Tabs;
  }
  public get ActiveTabId(): string | null {
    return this.tabs.ActiveId;
  }
  public get Draft(): BatchDraft | null {
    return this.tabs.ActiveTab?.State ?? null;
  }
  public get IsBuilt(): boolean {
    return !!this.Draft?.BuiltJournalEntryBatchNumber;
  }

  public openNewDraft(): void {
    const id = `draft-${this.tabs.Count + 1}-${Date.now()}`;
    this.tabs.Open({
      Id: id,
      Label: 'New JE batch (draft)',
      Icon: 'fa-solid fa-pen-ruler',
      Status: 'draft',
      State: { Criteria: this.defaultCriteria(), Selection: ALL_ENTRIES, Memo: '', Preview: null, PreviewStale: false },
    });
    // NO auto-query (Marcelo 2026-07-21): a new tab does NOT hit the server. The operator clicks
    // "Load entries" in the table (or Apply in the filters) to run the first query.
    this.cdr.markForCheck();
  }

  // ─── memo (the tab caption / findability label) ──────────────────────────────

  /**
   * The tab caption. Human fields lead: a typed memo IS the caption; else the built batch number;
   * else a plain "New batch". JournalEntryBatchNumber stays the batch's identity — the memo only makes the tab
   * (and later the All-Batches list) findable by a phrase the operator remembers.
   */
  private batchTabLabel(d: BatchDraft): string {
    const memo = d.Memo?.trim();
    if (memo) return memo;
    return d.BuiltJournalEntryBatchNumber?.trim() || 'New JE batch';
  }

  /**
   * Drive the active tab's caption from the memo as it is typed. The tab store owns the caption; this
   * is the ONE place it is written (mirrors the order editor's renameActiveTab — no second path).
   * The store leaks the live tab object through ActiveTab, so mutating Label here is what the strip
   * re-renders (Tabs returns a fresh array each read, so OnPush picks the new labels up).
   */
  private renameActiveTab(label: string): void {
    const tab = this.tabs.ActiveTab;
    if (tab) tab.Label = label;
  }

  /** Memo edited → persist onto the draft and re-caption the tab reactively. */
  public OnMemoChanged(): void {
    const d = this.Draft;
    if (!d) return;
    if (this.tabs.ActiveId) this.tabs.UpdateState(this.tabs.ActiveId, d);
    this.renameActiveTab(this.batchTabLabel(d));
    this.cdr.markForCheck();
  }

  public SelectTab(id: string): void {
    // Just show the tab's OWN stored preview — no re-query (Marcelo 2026-07-21).
    this.tabs.Activate(id);
    this.cdr.markForCheck();
  }

  public CloseTab(id: string): void {
    this.tabs.Close(id);
    if (this.tabs.Count === 0) this.openNewDraft();
    else this.cdr.markForCheck();
  }

  /** "Keep as draft tab" — the tab already holds the state; this just makes that explicit + clean. */
  public KeepAsDraft(): void {
    if (this.tabs.ActiveId) this.tabs.MarkClean(this.tabs.ActiveId);
    this.ActionMessage = 'Kept as a draft tab — it stays for this session (drafts are not saved to the database in v1).';
    this.ActionIsError = false;
    this.cdr.markForCheck();
  }

  public Discard(): void {
    if (this.tabs.ActiveId) this.CloseTab(this.tabs.ActiveId);
  }

  // ─── criteria ──────────────────────────────────────────────────────────────

  private defaultCriteria(): JournalEntryBatchCriteria {
    return {
      // "Include unbatched through [today]" — the §2 default flow. Today is the BUSINESS day, not
      // the browser's: the cutoff is matched against EffectiveDate, a DATE column (golive #168).
      Cutoff: BusinessTimeZoneEngine.Instance.Today(),
      // The journal date the ERP receives (golive #315). Today by default; month-end work back-dates it.
      PostingDate: BusinessTimeZoneEngine.Instance.Today(),
      // Seed from the app-wide company scope: the operator already told us which companies they
      // work in, so re-asking with a blank multi-select would be rude.
      CompanyIDs: [...this.Scope.SelectedIDs],
      EntryTypeScope: 'All',
      Source: 'Standard',
      ViewID: null,
      TargetSystem: 'BusinessCentral',
    };
  }

  public OnCriteriaChanged(): void {
    // NO auto-query (Marcelo 2026-07-21): changing a filter does NOT hit the server. Mark the shown
    // preview stale so the UI prompts "Apply to refresh"; the operator clicks Apply to re-query. This
    // is what keeps the page fast — no round-trip on every keystroke/filter tweak.
    const d = this.Draft;
    if (!d) return;
    if (d.Preview) d.PreviewStale = true;
    if (this.tabs.ActiveId) this.tabs.UpdateState(this.tabs.ActiveId, d);
    this.cdr.markForCheck();
  }

  /** Apply the criteria — the deferred query. Also does the FIRST load (the empty-state Load button
   *  calls this too). This is the ONLY path (besides toggle + header Refresh) that hits the server. */
  public Apply(): void {
    void this.refreshPreview();
  }

  /** The criteria echoed as chips — always visible, because approvers see these too (§0). */
  public get CriteriaChips(): string[] {
    const d = this.Draft;
    if (!d) return [];
    const chips: string[] = [];
    // An empty cutoff is shown, not left to the absence of a chip: the pool then runs through the
    // posting date, which always ends it (golive #315).
    chips.push(d.Criteria.Cutoff ? `through ${d.Criteria.Cutoff}` : 'no cutoff — through the posting date');
    chips.push(`posting date ${d.Criteria.PostingDate || 'not set'}`);
    chips.push(this.companyChipLabel(d.Criteria.CompanyIDs));
    chips.push(this.EntryTypeScopes.find((s) => s.Id === d.Criteria.EntryTypeScope)?.Label ?? 'All');
    chips.push(d.Criteria.Source === 'View' ? 'from a saved view' : 'oldest-forward');
    chips.push(`→ ${d.Criteria.TargetSystem}`);
    return chips;
  }

  private companyChipLabel(ids: string[]): string {
    if (ids.length === 0) return 'all companies';
    const names = ids.map((id) => this.CompanyName(id));
    return names.length <= 2 ? names.join(' + ') : `${names[0]} +${names.length - 1}`;
  }

  public CompanyName(id: string): string {
    return this.Scope.Companies.find((c) => c.ID === id)?.Name ?? 'Unknown company';
  }

  // ─── preview ───────────────────────────────────────────────────────────────

  /**
   * Numbers each preview request (#254). Overlapping requests (fast ticking) can settle out of
   * order, so a response is applied only when it is still the latest request for ITS tab, and the
   * spinner clears only when the latest request overall settles.
   */
  private previewRequestSeq = 0;
  private latestPreviewSeqByTab = new Map<string, number>();

  private async refreshPreview(): Promise<void> {
    const d = this.Draft;
    // The tab the request belongs to — the operator may switch tabs before it settles.
    const tabId = this.tabs.ActiveId;
    if (!d || !tabId || this.IsBuilt) return;

    const seq = ++this.previewRequestSeq;
    this.latestPreviewSeqByTab.set(tabId, seq);
    const isLatestForTab = () => this.latestPreviewSeqByTab.get(tabId) === seq;

    this.IsPreviewing = true;
    this.cdr.markForCheck();
    try {
      // The selection goes as it is — never derived from the previous preview's candidates, which
      // after a criteria change are the old pool (golive #284).
      const preview = await this.client.Preview(this.opProvider, d.Criteria, SelectionRequestIds(d.Selection), this.entryTypeValues(d.Criteria.EntryTypeScope));
      if (!isLatestForTab()) return; // superseded by a newer request for this tab
      // Store the preview ON THE TAB (per-tab), and clear the stale flag — the shown data now matches
      // the criteria again.
      d.Preview = preview;
      d.PreviewStale = false;
      this.tabs.UpdateState(tabId, d);
      this.ActionMessage = null;
    } catch (e) {
      if (!isLatestForTab()) return;
      this.setError(e instanceof Error ? e.message : String(e));
      d.Preview = null;
      this.tabs.UpdateState(tabId, d);
    } finally {
      if (isLatestForTab()) this.latestPreviewSeqByTab.delete(tabId);
      if (seq === this.previewRequestSeq) this.IsPreviewing = false;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    // Unsubscribing is what keeps the header's Refresh page-aware: a destroyed page stops counting.
    this.refreshSub?.unsubscribe();
  }
  public Refresh(): void {
    void this.refreshPreview();
  }

  /**
   * The 3-way scope → the engine's EntryType CODE list (issue #24: the JournalEntryType lookup
   * replaced the CHECK-enum; codes come from the engine's cached type table, never a hand-written
   * complement — a consuming app can seed new types without an accounting migration).
   */
  private entryTypeValues(scope: EntryTypeScope): string[] | null {
    if (scope === 'All') return null; // no clause
    if (scope === 'Manual') return ['Manual'];
    const all = AccountingEngineBase.Instance.JournalEntryTypes
      .filter((t) => t.IsActive && !t.IsJournalEntryBatchSummary)
      .map((t) => t.Code);
    return all.filter((c) => c !== 'Manual');
  }

  /** The ticked candidates of the shown preview: what the build sends. */
  private includedIds(d: BatchDraft): string[] {
    return IncludedCandidateIds(d.Selection, (d.Preview?.Candidates ?? []).map((c) => c.ID));
  }

  // ─── include / exclude ─────────────────────────────────────────────────────

  public IsExcluded(id: string): boolean {
    const d = this.Draft;
    return !!d && !IsEntryIncluded(d.Selection, id);
  }

  public ToggleEntry(id: string): void {
    const d = this.Draft;
    if (!d || this.IsBuilt) return;
    d.Selection = ToggleEntrySelection(d.Selection, id, (d.Preview?.Candidates ?? []).map((c) => c.ID));
    if (this.tabs.ActiveId) this.tabs.UpdateState(this.tabs.ActiveId, d);
    // Re-preview: the netted summary, totals and the MOD-8 warning are all a function of the
    // selection, and they are computed SERVER-side by the same code the build uses.
    void this.refreshPreview();
  }

  public get IncludedCount(): number {
    const d = this.Draft;
    return d?.Preview ? this.includedIds(d).length : 0;
  }
  public get ExcludedCount(): number {
    if (!this.Preview) return 0;
    return this.Preview.Candidates.length - this.IncludedCount;
  }
  public get IsBalanced(): boolean {
    if (!this.Preview) return false;
    return Math.abs(this.Preview.TotalDebits - this.Preview.TotalCredits) < 0.005;
  }
  public get HasOutOfOrder(): boolean {
    return (this.Preview?.OutOfOrderSkipCount ?? 0) > 0;
  }
  public get BeforePostingStartCount(): number {
    return this.Preview?.BeforePostingStartCount ?? 0;
  }

  // ─── build ─────────────────────────────────────────────────────────────────

  public get CanBuild(): boolean {
    return !!this.Preview && this.IncludedCount > 0 && !this.IsBuilding && !this.IsBuilt && this.IsBalanced && !this.PostingDateProblem
      && (!this.PostingDateWarning || this.PostingDateConfirmed);
  }

  /** Today's business day. */
  public get Today(): string {
    return BusinessTimeZoneEngine.Instance.Today();
  }

  /** The draft tab and posting date whose prior/future-month warning was confirmed; any other asks again. */
  private confirmedPostingDate: { tabId: string; day: string } | null = null;

  /** "Are you sure?" text when the posting date is in a prior or future month (golive #315), or null. */
  public get PostingDateWarning(): string | null {
    return PostingDateMonthWarning(this.Draft?.Criteria.PostingDate, this.Today);
  }

  /** The posting date's month, e.g. `September 2026`, for the confirmation label. */
  public get PostingMonth(): string {
    const postingDate = this.Draft?.Criteria.PostingDate;
    return postingDate && IsCalendarDay(postingDate) ? PostingMonthLabel(postingDate) : '';
  }

  /** True when the current posting date's month warning has been confirmed. */
  public get PostingDateConfirmed(): boolean {
    const c = this.confirmedPostingDate;
    return !!c && c.tabId === this.tabs.ActiveId && c.day === this.Draft?.Criteria.PostingDate;
  }

  public ConfirmPostingDate(confirmed: boolean): void {
    const tabId = this.tabs.ActiveId;
    const day = this.Draft?.Criteria.PostingDate;
    this.confirmedPostingDate = confirmed && tabId && day ? { tabId, day } : null;
    this.cdr.markForCheck();
  }

  public OnPostingDateConfirmChange(event: Event): void {
    this.ConfirmPostingDate((event.target as HTMLInputElement).checked);
  }

  /**
   * Why the chosen posting date cannot be built, or null. The server refuses the same cases; checking
   * here says so before the click. An included entry can postdate it only when the posting date moved
   * after the preview loaded — the preview's own pool already ends at it.
   */
  public get PostingDateProblem(): string | null {
    const postingDate = this.Draft?.Criteria.PostingDate ?? null;
    if (!postingDate || !IsCalendarDay(postingDate)) return 'Choose a posting date.';
    const latest = this.latestIncludedDay();
    if (latest && IsBeforeDay(postingDate, latest)) {
      return `The posting date ${postingDate} is earlier than an included entry dated ${latest} — move it to ${latest} or later, or apply the filters again.`;
    }
    return null;
  }

  private latestIncludedDay(): string | null {
    const d = this.Draft;
    if (!d || !this.Preview) return null;
    let latest: string | null = null;
    for (const c of this.Preview.Candidates) {
      const day = IsEntryIncluded(d.Selection, c.ID) ? ToCalendarDay(c.EffectiveDate) : null;
      if (day && (!latest || IsBeforeDay(latest, day))) latest = day;
    }
    return latest;
  }

  public get BuildBlockedReason(): string | null {
    if (this.IsBuilt) return 'This tab is already built.';
    if (!this.Preview || this.Preview.Candidates.length === 0) return 'Nothing matches these criteria.';
    if (this.IncludedCount === 0) return 'Every entry is excluded — nothing to build.';
    if (!this.IsBalanced) return 'The selection does not balance (Dr ≠ Cr) — it would be rejected by the ledger.';
    if (this.PostingDateProblem) return this.PostingDateProblem;
    if (this.PostingDateWarning && !this.PostingDateConfirmed) return `Confirm posting this batch in ${this.PostingMonth}.`;
    return null;
  }

  public async Build(): Promise<void> {
    const d = this.Draft;
    if (!d || !this.CanBuild) return;

    this.IsBuilding = true;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      // Build EXACTLY the ticked set. Source='Explicit' re-validates server-side that every id is
      // still Pending and loud-rejects a stale selection — the preview is a snapshot.
      // An empty / zero-net selection now throws server-side (EmptyBatchError) and lands in the catch
      // below with the engine's message — no silent "nothing to batch" success to check for.
      const res = await this.client.Build(this.opProvider, d.Criteria, this.includedIds(d));

      // A selection spanning companies builds one batch per company (D7) — show them all.
      d.BuiltJournalEntryBatchNumber = res.JournalEntryBatchIDs.join(', ');
      if (this.tabs.ActiveId) {
        this.tabs.UpdateState(this.tabs.ActiveId, d, false);
        this.tabs.SetStatus(this.tabs.ActiveId, 'complete');
        // Keep a memo caption if the operator gave one; otherwise fall to the now-known batch number.
        this.renameActiveTab(this.batchTabLabel(d));
      }
      // On confirm, refresh to a FRESH tab (Marcelo 2026-07-21) — the built batch stays in its own
      // read-only tab for review while a new draft is ready. (openNewDraft clears messages; set after.)
      const builtNumber = d.BuiltJournalEntryBatchNumber;
      const taskRaised = res.ApprovalTaskRaised;
      this.openNewDraft();
      this.ActionMessage = taskRaised
        ? `Built batch ${builtNumber} — sent for CFO approval. Its tab is kept for review; this is a fresh batch.`
        : `Built batch ${builtNumber}. ⚠ Its approval task could not be raised — the batch is valid and can be retried from Batch approvals.`;
      this.ActionIsError = false;
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.IsBuilding = false;
      this.cdr.markForCheck();
    }
  }

  private setError(message: string): void {
    this.ActionMessage = message;
    this.ActionIsError = true;
    this.cdr.markForCheck();
  }

  /** Drag-reorder the session tabs (browser-style), mirroring the JE workspace. */
  public ReorderTabs(e: { previousIndex: number; currentIndex: number }): void {
    this.tabs.Reorder(e.previousIndex, e.currentIndex);
    this.cdr.markForCheck();
  }

  /**
   * Single-company selection for the build criteria (Marcelo 2026-07-21). The criteria model still holds
   * `CompanyIDs: string[]` (the engine's multi-company shape), so this maps the single choice to a
   * 0-or-1-element array: null → [] (all companies), an id → [id]. Removing "all" + requiring exactly one
   * is the single-company engine invariant, landing with the zero-net work.
   */
  public get SelectedCompanyId(): string | null {
    return this.Draft?.Criteria.CompanyIDs[0] ?? null;
  }
  public set SelectedCompanyId(value: string | null) {
    if (this.Draft) this.Draft.Criteria.CompanyIDs = value ? [value] : [];
  }

  /**
   * The provider, narrowed to the Remote-Operation seam. `ProviderToUse` is typed
   * `IMetadataProvider`, but every resolved provider IS a `ProviderBase` and therefore also
   * implements `IRemoteOperationProvider` — stated in MJ's own RemoteOpInvokeOptions docs. Narrowed
   * in ONE place rather than at each call site.
   */
  private get opProvider(): IRemoteOperationProvider {
    return this.ProviderToUse as unknown as IRemoteOperationProvider;
  }
}
