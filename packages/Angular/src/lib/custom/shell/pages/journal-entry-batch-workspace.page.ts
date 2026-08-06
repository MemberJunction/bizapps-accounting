import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit, OnDestroy } from '@angular/core';
import { type IRemoteOperationProvider } from '@memberjunction/core';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { WorkspaceTabStore } from '../../../transfer-pending/workspace-tabs/workspace-tab-store';
import { WorkspaceTab } from '../../../transfer-pending/workspace-tabs/workspace-tabs.types';
import {
  JournalEntryBatchWorkspaceClient,
  type BatchCriteria,
  type BatchPreview,
  type EntryTypeScope,
  type BatchTargetSystem,
} from './journal-entry-batch-workspace.client';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/** One workspace tab's session state — the draft the operator is composing. */
interface BatchDraft {
  Criteria: BatchCriteria;
  /** Optional free-text label (JournalEntryBatch.Memo) — "what was this batch for". NOT identity
   *  (JournalEntryBatchNumber is); purely for findability. Editable pre-build, and it drives the tab caption. */
  Memo: string;
  /** Ids the operator has UN-ticked. Kept as the exclusion set (not the inclusion set) so newly
   *  appearing candidates default to INCLUDED, which is what an oldest-forward sweep means. */
  ExcludedIDs: string[];
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
  public readonly EntryTypeScopes: ReadonlyArray<{ Id: EntryTypeScope; Label: string }> = [
    { Id: 'All', Label: 'All (system + manual)' },
    { Id: 'System', Label: 'System only' },
    { Id: 'Manual', Label: 'Manual only' },
  ];

  public readonly TargetSystems: readonly BatchTargetSystem[] = ['BusinessCentral'];

  ngOnInit(): void {
    this.refreshSub = this.pageRefresh.OnRefresh(() => this.Refresh());
    // Prime the engine cache (JournalEntryTypes for the scope control) — no-op when already loaded.
    void AccountingEngineBase.Instance.Config(false, this.ProviderToUse.CurrentUser, this.ProviderToUse);
    this.openNewDraft();
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
      Label: 'New batch (draft)',
      Icon: 'fa-solid fa-pen-ruler',
      Status: 'draft',
      State: { Criteria: this.defaultCriteria(), ExcludedIDs: [], Memo: '', Preview: null, PreviewStale: false },
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
    return d.BuiltJournalEntryBatchNumber?.trim() || 'New batch';
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

  private defaultCriteria(): BatchCriteria {
    return {
      // "Include unbatched through [now]" — the §2 default flow.
      Cutoff: this.toLocalInput(new Date()),
      // Seed from the app-wide company scope: the operator already told us which companies they
      // work in, so re-asking with a blank multi-select would be rude.
      CompanyIDs: [...this.Scope.SelectedIDs],
      EntryTypeScope: 'All',
      Source: 'Standard',
      ViewID: null,
      TargetSystem: 'BusinessCentral',
    };
  }

  /** `datetime-local` wants `YYYY-MM-DDTHH:mm` in LOCAL time (the only place local time is right:
   *  it is what the operator typed). Converted back to a UTC instant on the way out. */
  private toLocalInput(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    if (d.Criteria.Cutoff) chips.push(`through ${d.Criteria.Cutoff.replace('T', ' ')}`);
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

  private async refreshPreview(): Promise<void> {
    const d = this.Draft;
    if (!d || this.IsBuilt) return;

    this.IsPreviewing = true;
    this.cdr.markForCheck();
    try {
      const preview = await this.client.Preview(this.opProvider, d.Criteria, this.includedIds(d), this.entryTypeValues(d.Criteria.EntryTypeScope));
      // Store the preview ON THE TAB (per-tab), and clear the stale flag — the shown data now matches
      // the criteria again.
      d.Preview = preview;
      d.PreviewStale = false;
      if (this.tabs.ActiveId) this.tabs.UpdateState(this.tabs.ActiveId, d);
      this.ActionMessage = null;
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
      d.Preview = null;
      if (this.tabs.ActiveId) this.tabs.UpdateState(this.tabs.ActiveId, d);
    } finally {
      this.IsPreviewing = false;
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

  private includedIds(d: BatchDraft): string[] | null {
    if (!this.Preview) return null;
    const excluded = new Set(d.ExcludedIDs);
    return this.Preview.Candidates.filter((c) => !excluded.has(c.ID)).map((c) => c.ID);
  }

  // ─── include / exclude ─────────────────────────────────────────────────────

  public IsExcluded(id: string): boolean {
    return this.Draft?.ExcludedIDs.includes(id) ?? false;
  }

  public ToggleEntry(id: string): void {
    const d = this.Draft;
    if (!d || this.IsBuilt) return;
    d.ExcludedIDs = d.ExcludedIDs.includes(id) ? d.ExcludedIDs.filter((x) => x !== id) : [...d.ExcludedIDs, id];
    if (this.tabs.ActiveId) this.tabs.UpdateState(this.tabs.ActiveId, d);
    // Re-preview: the netted summary, totals and the MOD-8 warning are all a function of the
    // selection, and they are computed SERVER-side by the same code the build uses.
    void this.refreshPreview();
  }

  public get IncludedCount(): number {
    if (!this.Preview) return 0;
    return this.Preview.Candidates.length - this.ExcludedCount;
  }
  public get ExcludedCount(): number {
    if (!this.Preview || !this.Draft) return 0;
    const ids = new Set(this.Preview.Candidates.map((c) => c.ID));
    return this.Draft.ExcludedIDs.filter((x) => ids.has(x)).length;
  }
  public get IsBalanced(): boolean {
    if (!this.Preview) return false;
    return Math.abs(this.Preview.TotalDebits - this.Preview.TotalCredits) < 0.005;
  }
  public get HasOutOfOrder(): boolean {
    return (this.Preview?.OutOfOrderSkipCount ?? 0) > 0;
  }

  // ─── build ─────────────────────────────────────────────────────────────────

  public get CanBuild(): boolean {
    return !!this.Preview && this.IncludedCount > 0 && !this.IsBuilding && !this.IsBuilt && this.IsBalanced;
  }

  public get BuildBlockedReason(): string | null {
    if (this.IsBuilt) return 'This tab is already built.';
    if (!this.Preview || this.Preview.Candidates.length === 0) return 'Nothing matches these criteria.';
    if (this.IncludedCount === 0) return 'Every entry is excluded — nothing to build.';
    if (!this.IsBalanced) return 'The selection does not balance (Dr ≠ Cr) — it would be rejected by the ledger.';
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
      const res = await this.client.Build(this.opProvider, d.Criteria, this.includedIds(d) ?? []);

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
