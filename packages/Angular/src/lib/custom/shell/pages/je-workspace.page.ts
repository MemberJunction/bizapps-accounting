import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit } from '@angular/core';
import { type IRemoteOperationProvider } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { UUIDsEqual } from '@memberjunction/global';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import type { JEValidationError } from '@mj-biz-apps/accounting-engine-base';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { WorkspaceTabStore } from '../../../transfer-pending/workspace-tabs/workspace-tab-store';
import { WorkspaceTab } from '../../../transfer-pending/workspace-tabs/workspace-tabs.types';
import { isBalanced } from '../../shared/je-rules';
import { JEWorkspaceClient } from './je-workspace.client';
import {
  type JEDraftState,
  type JEDraftLine,
  newDraftLine,
  draftTotals,
  draftIssues,
  lineIssue,
  isLineEmpty,
  toCreateInput,
} from './je-draft';

/** An account offered by the picker — flattened so the template does no entity work. */
export interface AccountOption {
  ID: string;
  Label: string;
}

/** One dimension axis rendered as a per-line column. */
export interface DimensionColumn {
  ID: string;
  Name: string;
  Values: Array<{ ID: string; Label: string }>;
}

/**
 * JE workspace (UI plan §8.1) — the manual-JE creation home and the full-depth target of every JE
 * pop-out. Built as a workspace (session tabs) rather than a modal because a JE with a line editor
 * fails the element doctrine's encapsulation test, exactly like the batch workspace.
 *
 * Follows the approved mockup (`design-docs/ui-design/mockups/nav-shell-je-workspace.html`) with
 * three deliberate corrections, each forced by the actual contract rather than by taste:
 *
 *  1. **Company is a FILTER, not a field.** `JournalEntryDraft` has no CompanyID — the engine derives
 *     it from the lines' accounts (MOD-12). The select scopes the account picker; it is never sent.
 *  2. **Currency is display-only.** There are no FX fields in the v1 contract, so a currency select
 *     would be a control that does nothing. It reads the company's functional currency instead.
 *  3. **The verb is "Create entry", not "Submit for approval".** The C.8 CFO gate is designed but NOT
 *     enforced (there is no `Approved` JE status; see je-rules.awaitsApproval + QUESTIONS.md#q6), so
 *     a submit-for-approval label would promise routing that does not happen.
 *
 * Dimension columns are data-driven off the engine's cached Dimensions — with none configured (the
 * current state) the editor simply has no dimension columns, rather than a dead control.
 *
 * CONNECTS TO:
 *   OP:     ./je-workspace.client → 'Accounting.CreateJournalEntry'
 *   PURE:   ./je-draft (money math, balance, contract mapping — tier 1)
 *   ENGINE: AccountingEngineBase (cached GL accounts + dimensions — no round-trip to populate)
 */
@Component({
  standalone: false,
  selector: 'mj-je-workspace-page',
  templateUrl: './je-workspace.page.html',
  styleUrls: ['./shell-table.css', './je-workspace.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JEWorkspacePageComponent extends BaseAngularComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  public Scope = inject(CompanyScopeService);

  private tabs = new WorkspaceTabStore<JEDraftState>();
  private client = new JEWorkspaceClient();
  private keySeq = 0;

  public IsSubmitting = false;
  public ActionMessage: string | null = null;
  public ActionIsError = false;
  /** Engine-reported errors, keyed by the line index they name — rendered ON the offending row. */
  public LineErrors = new Map<number, string>();
  public DraftErrors: string[] = [];

  public DimensionColumns: DimensionColumn[] = [];

  ngOnInit(): void {
    this.DimensionColumns = this.loadDimensionColumns();
    this.openNewDraft();
  }

  // ─── tabs ──────────────────────────────────────────────────────────────────

  public get Tabs(): WorkspaceTab[] {
    return this.tabs.Tabs;
  }
  public get ActiveTabId(): string | null {
    return this.tabs.ActiveId;
  }
  public get Draft(): JEDraftState | null {
    return this.tabs.ActiveTab?.State ?? null;
  }
  /** A submitted tab is a receipt, not an editor — every control locks. */
  public get IsCreated(): boolean {
    return !!this.Draft?.CreatedEntryNumber;
  }

  public openNewDraft(): void {
    this.tabs.Open({
      Id: `je-draft-${++this.keySeq}-${Date.now()}`,
      Label: 'New entry (draft)',
      Icon: 'fa-solid fa-pen-ruler',
      Status: 'draft',
      State: this.defaultDraft(),
    });
    this.clearMessages();
    this.cdr.markForCheck();
  }

  public SelectTab(id: string): void {
    this.tabs.Activate(id);
    this.clearMessages();
    this.cdr.markForCheck();
  }

  public CloseTab(id: string): void {
    this.tabs.Close(id);
    if (this.tabs.Count === 0) this.openNewDraft();
    this.clearMessages();
    this.cdr.markForCheck();
  }

  /** "Keep as draft tab" — the tab already holds the state; this makes that explicit + clean. */
  public KeepAsDraft(): void {
    if (this.tabs.ActiveId) this.tabs.MarkClean(this.tabs.ActiveId);
    this.ActionMessage = 'Kept as a draft tab — it stays for this session (drafts are not saved to the database in v1).';
    this.ActionIsError = false;
    this.cdr.markForCheck();
  }

  public Discard(): void {
    if (this.tabs.ActiveId) this.CloseTab(this.tabs.ActiveId);
  }

  private defaultDraft(): JEDraftState {
    return {
      // Seed from the app-wide scope when it names exactly one company — with several in scope we
      // cannot know which one the operator means, so we ask rather than guess wrong.
      CompanyID: this.Scope.SelectedIDs.length === 1 ? this.Scope.SelectedIDs[0] : null,
      EffectiveDate: new Date().toISOString().slice(0, 10),
      Description: '',
      Lines: [this.newLine(), this.newLine()],
    };
  }

  private newLine(): JEDraftLine {
    return newDraftLine(`l-${++this.keySeq}`);
  }

  // ─── company / accounts / dimensions ───────────────────────────────────────

  public get Companies(): Array<{ ID: string; Name: string }> {
    return this.Scope.Companies;
  }

  /** The company's functional currency — display-only (no FX in the v1 contract). */
  public get FunctionalCurrency(): string | null {
    const companyId = this.Draft?.CompanyID;
    if (!companyId) return null;
    const profile = AccountingEngineBase.Instance.CompanyProfiles.find((p) => UUIDsEqual(p.ID, companyId));
    return profile?.FunctionalCurrencyCode ?? null;
  }

  /**
   * Active accounts for the chosen company, from the engine's cache — no query.
   * Empty until a company is picked: an account list spanning companies would invite the exact
   * cross-company draft the engine rejects (MOD-12).
   */
  public get AccountOptions(): AccountOption[] {
    const companyId = this.Draft?.CompanyID;
    if (!companyId) return [];
    return AccountingEngineBase.Instance.GLAccounts
      .filter((a) => UUIDsEqual(a.CompanyID, companyId) && a.IsActive)
      .map((a) => ({ ID: a.ID, Label: `${a.Code} · ${a.Name}` }))
      .sort((a, b) => a.Label.localeCompare(b.Label));
  }

  /** One column per ACTIVE dimension. None configured ⇒ no columns (today's state), not a dead control. */
  private loadDimensionColumns(): DimensionColumn[] {
    const engine = AccountingEngineBase.Instance;
    return engine.Dimensions
      .filter((d) => d.IsActive)
      .map((d) => ({
        ID: d.ID,
        Name: d.Name,
        Values: engine.DimensionValues
          .filter((v) => UUIDsEqual(v.DimensionID, d.ID) && v.IsActive)
          .map((v) => ({ ID: v.ID, Label: v.Name }))
          .sort((a, b) => a.Label.localeCompare(b.Label)),
      }));
  }

  public OnCompanyChanged(): void {
    const d = this.Draft;
    if (!d) return;
    // The old accounts belong to the previous company — keeping them would submit a cross-company
    // draft the engine rejects. Clear the selections, keep everything the operator typed.
    for (const line of d.Lines) line.GLAccountID = null;
    this.touch();
  }

  // ─── lines ─────────────────────────────────────────────────────────────────

  public AddLine(): void {
    this.Draft?.Lines.push(this.newLine());
    this.touch();
  }

  public RemoveLine(key: string): void {
    const d = this.Draft;
    if (!d) return;
    d.Lines = d.Lines.filter((l) => l.Key !== key);
    if (d.Lines.length === 0) d.Lines.push(this.newLine());
    this.touch();
  }

  public LineIssue(line: JEDraftLine): string | null {
    return lineIssue(line);
  }

  /** The engine's own complaint about this row, if it named one. */
  public EngineLineError(index: number): string | null {
    return this.LineErrors.get(index) ?? null;
  }

  public DimensionValueFor(line: JEDraftLine, dimensionId: string): string | null {
    return line.DimensionValueIDs[dimensionId] ?? null;
  }

  public SetDimensionValue(line: JEDraftLine, dimensionId: string, value: string): void {
    line.DimensionValueIDs[dimensionId] = value || null;
    this.touch();
  }

  /** Any edit invalidates the server's verdict on the previous shape. */
  public touch(): void {
    if (this.tabs.ActiveId && this.Draft) this.tabs.UpdateState(this.tabs.ActiveId, this.Draft);
    this.LineErrors.clear();
    this.DraftErrors = [];
    this.cdr.markForCheck();
  }

  // ─── balance strip ─────────────────────────────────────────────────────────

  public get Totals(): { Debits: number; Credits: number } {
    return this.Draft ? draftTotals(this.Draft.Lines) : { Debits: 0, Credits: 0 };
  }

  public get IsBalanced(): boolean {
    const { Debits, Credits } = this.Totals;
    return Debits > 0 && isBalanced(Debits, Credits);
  }

  // ─── submit ────────────────────────────────────────────────────────────────

  public get Issues(): string[] {
    if (!this.Draft) return [];
    const issues = draftIssues(this.Draft);
    if (!this.Draft.CompanyID) issues.unshift('Pick a company to choose accounts from.');
    return issues;
  }

  public get CanSubmit(): boolean {
    return !!this.Draft && !this.IsCreated && !this.IsSubmitting && this.Issues.length === 0;
  }

  public get SubmitBlockedReason(): string | null {
    if (this.IsCreated) return 'This entry has already been created.';
    return this.Issues[0] ?? null;
  }

  public async Submit(): Promise<void> {
    const d = this.Draft;
    if (!d || !this.CanSubmit) return;

    this.IsSubmitting = true;
    this.clearMessages();
    this.cdr.markForCheck();
    try {
      const result = await this.client.Create(this.opProvider, toCreateInput(d));

      if (!result.Success) {
        this.applyEngineErrors(result.Errors ?? []);
        this.setError('The ledger rejected this entry — see the errors above.');
        return;
      }

      d.CreatedEntryNumber = result.EntryNumber ?? result.JournalEntryID;
      if (this.tabs.ActiveId) {
        this.tabs.UpdateState(this.tabs.ActiveId, d, false);
        this.tabs.SetStatus(this.tabs.ActiveId, 'complete');
      }
      this.ActionMessage = `Created entry ${d.CreatedEntryNumber} — it is Pending and joins the unbatched pool.`;
      this.ActionIsError = false;
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.IsSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Put each engine error where it belongs: line-scoped ones on their row, the rest in the summary.
   * The engine's LineIndex is an index into the SUBMITTED lines (empties dropped), so it is mapped
   * back onto the editor's rows — otherwise a blank row above the culprit would shift the marker.
   */
  private applyEngineErrors(errors: JEValidationError[]): void {
    this.LineErrors.clear();
    this.DraftErrors = [];
    const editorIndexes = this.submittedToEditorIndexes();

    for (const err of errors) {
      if (err.LineIndex === undefined) {
        this.DraftErrors.push(err.Message);
        continue;
      }
      const editorIndex = editorIndexes[err.LineIndex];
      if (editorIndex === undefined) this.DraftErrors.push(err.Message);
      else this.LineErrors.set(editorIndex, err.Message);
    }
  }

  /** submitted-line index → editor-row index. Uses the SAME emptiness rule the mapping used. */
  private submittedToEditorIndexes(): number[] {
    const map: number[] = [];
    this.Draft?.Lines.forEach((line, i) => {
      if (!isLineEmpty(line)) map.push(i);
    });
    return map;
  }

  private clearMessages(): void {
    this.ActionMessage = null;
    this.ActionIsError = false;
    this.LineErrors.clear();
    this.DraftErrors = [];
  }

  private setError(message: string): void {
    this.ActionMessage = message;
    this.ActionIsError = true;
    this.cdr.markForCheck();
  }

  /**
   * The provider, narrowed to the Remote-Operation seam. `ProviderToUse` is typed
   * `IMetadataProvider`, but every resolved provider IS a `ProviderBase` and therefore also
   * implements `IRemoteOperationProvider`. Narrowed in ONE place rather than at each call site.
   */
  private get opProvider(): IRemoteOperationProvider {
    return this.ProviderToUse as unknown as IRemoteOperationProvider;
  }
}
