import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit } from '@angular/core';
import { Metadata, type IRemoteOperationProvider } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { WorkspaceTabStore } from '../../../transfer-pending/workspace-tabs/workspace-tab-store';
import { WorkspaceTab } from '../../../transfer-pending/workspace-tabs/workspace-tabs.types';
import {
  BatchWorkspaceClient,
  type BatchCriteria,
  type BatchPreview,
  type EntryTypeScope,
  type BatchTargetSystem,
} from './batch-workspace.client';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/** One workspace tab's session state — the draft the operator is composing. */
interface BatchDraft {
  Criteria: BatchCriteria;
  /** Ids the operator has UN-ticked. Kept as the exclusion set (not the inclusion set) so newly
   *  appearing candidates default to INCLUDED, which is what an oldest-forward sweep means. */
  ExcludedIDs: string[];
  /** Set once built — the tab becomes a read-only record of the batch. */
  BuiltBatchNumber?: string;
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
 * Everything server-side goes through the `Accounting.PreviewBatch` / `Accounting.BuildBatch`
 * Remote Operations — the preview runs the SAME candidate filter and netting the build runs, so
 * what you see is what you get.
 */
@Component({
  standalone: false,
  selector: 'mj-batch-workspace-page',
  templateUrl: './batch-workspace.page.html',
  styleUrls: ['./batch-workspace.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BatchWorkspacePageComponent extends BaseAngularComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  public Scope = inject(CompanyScopeService);

  private tabs = new WorkspaceTabStore<BatchDraft>();
  private client = new BatchWorkspaceClient();

  public Preview: BatchPreview | null = null;
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
    return !!this.Draft?.BuiltBatchNumber;
  }

  public openNewDraft(): void {
    const id = `draft-${this.tabs.Count + 1}-${Date.now()}`;
    this.tabs.Open({
      Id: id,
      Label: 'New batch (draft)',
      Icon: 'fa-solid fa-pen-ruler',
      Status: 'draft',
      State: { Criteria: this.defaultCriteria(), ExcludedIDs: [] },
    });
    void this.refreshPreview();
  }

  public SelectTab(id: string): void {
    this.tabs.Activate(id);
    this.Preview = null;
    void this.refreshPreview();
  }

  public CloseTab(id: string): void {
    this.tabs.Close(id);
    if (this.tabs.Count === 0) this.openNewDraft();
    else void this.refreshPreview();
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
    // Criteria changed → the previous selection's exclusions may reference entries that are no
    // longer candidates. Keep them (harmless — they're filtered on use) but refetch the pool.
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
      this.Preview = await this.client.Preview(this.opProvider, d.Criteria, this.includedIds(d), this.entryTypeValues(d.Criteria.EntryTypeScope));
      this.ActionMessage = null;
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
      this.Preview = null;
    } finally {
      this.IsPreviewing = false;
      this.cdr.markForCheck();
    }
  }

  public Refresh(): void {
    void this.refreshPreview();
  }

  /**
   * The 3-way scope → the engine's raw EntryType list.
   *
   * 'System' means "every type except Manual" — derived from entity METADATA, never a hand-written
   * complement, because EntryType is a 16-value CodeGen union off the column's CHECK and a migration
   * can widen it (MJ rule 2c). A hardcoded list would silently stop batching any new system type.
   */
  private entryTypeValues(scope: EntryTypeScope): string[] | null {
    if (scope === 'All') return null; // no clause
    const field = new Metadata().EntityByName(JE_ENTITY)?.Fields.find((f) => f.Name === 'EntryType');
    const all = (field?.EntityFieldValues ?? []).map((v) => v.Value);
    if (scope === 'Manual') return ['Manual'];
    return all.filter((v) => v !== 'Manual');
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
      const res = await this.client.Build(this.opProvider, d.Criteria, this.includedIds(d) ?? []);

      if (res.NothingToBatch) {
        this.setError('Nothing to batch — the selection netted to zero.');
        return;
      }

      d.BuiltBatchNumber = res.BatchNumber ?? res.BatchID;
      if (this.tabs.ActiveId) {
        this.tabs.UpdateState(this.tabs.ActiveId, d, false);
        this.tabs.SetStatus(this.tabs.ActiveId, 'complete');
      }
      this.ActionMessage = res.ApprovalTaskRaised
        ? `Built batch ${d.BuiltBatchNumber} — sent for CFO approval.`
        : `Built batch ${d.BuiltBatchNumber}. ⚠ Its approval task could not be raised — the batch is valid and can be retried from Batch approvals.`;
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
