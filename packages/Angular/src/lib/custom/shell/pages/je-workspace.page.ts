import { Component, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, Input, ViewChild, inject, OnInit } from '@angular/core';
import { Metadata, type IRemoteOperationProvider } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { NormalizeUUID, UUIDsEqual } from '@memberjunction/global';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import type { JEValidationError } from '@mj-biz-apps/accounting-engine-base';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { WorkspaceTabStore } from '../../../transfer-pending/workspace-tabs/workspace-tab-store';
import { WorkspaceTab } from '../../../transfer-pending/workspace-tabs/workspace-tabs.types';
import { isBalanced } from '../../shared/je-rules';
import { JEWorkspaceClient } from './je-workspace.client';
import type { JournalEntryEntity, JournalEntryLineEntity } from '@mj-biz-apps/accounting-entities';
import {
  type JEDraftState,
  type JEAmountText,
  newAmountText,
  parseMoney,
  draftTotals,
  toCreateInput,
  LiveLines,
  TextIssue,
} from './je-draft';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

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

/** A counterparty (customer/vendor Organization) offered by the optional per-line picker. */
/**
 * JE workspace (UI plan §8.1) — the manual-JE creation home and the full-depth target of every JE
 * pop-out. Built as a workspace (session tabs) rather than a modal because a JE with a line editor
 * fails the element doctrine's encapsulation test, exactly like the batch workspace.
 *
 * Follows the approved mockup (`design-docs/ui-design/mockups/nav-shell-je-workspace.html`) with
 * three deliberate corrections, each forced by the actual contract rather than by taste:
 *
 *  1. **Company scopes the account picker and is never SENT.** The contract has no CompanyID — the
 *     engine derives it from the lines' accounts (MOD-12). It is held on the entity because that is
 *     where a company belongs, and simply left out of the submission.
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
 *   ENTITY: JournalEntryEntity + its Lines collection, and each line's own Dimensions collection —
 *           the model, and the SAME Validate() the server runs. There is no draft mirror any more;
 *           ./je-draft holds the one thing that is genuinely UI state: the raw text of each money box.
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
  /** Options for the optional per-line counterparty picker (AR "who owes"). Loaded once at open. */

  async ngOnInit(): Promise<void> {
    this.DimensionColumns = this.loadDimensionColumns();
    await this.openNewDraft();
    this.initialized = true;
    if (this.pendingFocusID) {
      const id = this.pendingFocusID;
      this.pendingFocusID = null;
      await this.openExistingEntry(id);
    }
  }

  // ─── open an EXISTING entry (the lists' "Open in workspace") ────────────────

  /**
   * An existing entry to open as a LOCKED receipt tab — the target of the detail panels' "Open in
   * workspace". The category passes its `PageParam` here (GoToPage('workspace', id)). The entry
   * renders in the editor layout with every control locked (the same `CreatedEntryNumber` receipt
   * mode a just-created entry gets), so "open in workspace" means *see it where JEs live*, not
   * *edit it* — posted ledger rows are immutable by trigger anyway.
   */
  @Input()
  set FocusEntryID(value: string | null) {
    if (!value || value === this._focusEntryID) return;
    this._focusEntryID = value;
    if (this.initialized) void this.openExistingEntry(value);
    else this.pendingFocusID = value;
  }
  get FocusEntryID(): string | null {
    return this._focusEntryID;
  }
  private _focusEntryID: string | null = null;
  private pendingFocusID: string | null = null;
  private initialized = false;

  /**
   * Load an existing entry as a locked receipt tab, labeled by its number.
   *
   * The entry and its lines are loaded as ENTITIES rather than as rows, because the editor renders
   * exactly the same way for a receipt as for a draft — a second read shape for the same screen is a
   * second set of field names to keep in step with the first.
   */
  private async openExistingEntry(id: string): Promise<void> {
    try {
      const md = new Metadata();
      const entry = await md.GetEntityObject<JournalEntryEntity>(JE_ENTITY, this.ProviderToUse.CurrentUser);
      if (!(await entry.Load(id))) {
        this.ActionMessage = 'That journal entry could not be loaded into the workspace.';
        this.ActionIsError = true;
        this.cdr.markForCheck();
        return;
      }
      await entry.Lines.Load();

      const state = this.stateFor(entry);
      state.CreatedEntryNumber = entry.EntryNumber;
      // Seed the money boxes FROM the entity, so a receipt reads its own amounts rather than blanks.
      for (const line of entry.Lines.Items as JournalEntryLineEntity[]) {
        state.Amounts.set(line.ID, {
          Debit: line.DebitAmount ? String(line.DebitAmount) : '',
          Credit: line.CreditAmount ? String(line.CreditAmount) : '',
        });
      }

      this.tabs.Open({
        Id: `je-view-${id}`,
        Label: entry.EntryNumber ?? 'Entry',
        Icon: 'fa-solid fa-book-open',
        Status: 'complete', // locked receipt — viewing, never editing
        State: state,
      });
      this.clearMessages();
    } catch (e) {
      this.ActionMessage = e instanceof Error ? e.message : String(e);
      this.ActionIsError = true;
    }
    this.cdr.markForCheck();
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

  public async openNewDraft(): Promise<void> {
    this.tabs.Open({
      Id: `je-draft-${++this.keySeq}-${Date.now()}`,
      Label: 'New JE',
      Icon: 'fa-solid fa-pen-ruler',
      Status: 'draft',
      State: await this.defaultDraft(),
    });
    // Derive from the (empty) draft so the caption rule has a single source of truth from tab one.
    this.renameActiveTab(this.jeTabLabel());
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
    // Never leave the workspace with no tab — an empty shell reads as a page that failed to load.
    if (this.tabs.Count === 0) void this.openNewDraft();
    this.clearMessages();
    this.cdr.markForCheck();
  }

  /** Drag-reorder from the strip — apply to the store (order only; active tab + drafts untouched). */
  public ReorderTabs(e: { previousIndex: number; currentIndex: number }): void {
    this.tabs.Reorder(e.previousIndex, e.currentIndex);
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

  /** A fresh entry with the two blank lines double entry starts from. */
  private async defaultDraft(): Promise<JEDraftState> {
    const md = new Metadata();
    const entry = await md.GetEntityObject<JournalEntryEntity>(JE_ENTITY, this.ProviderToUse.CurrentUser);
    entry.NewRecord();
    // Seed from the app-wide scope when it names exactly one company — with several in scope we
    // cannot know which one the operator means, so we ask rather than guess wrong.
    if (this.Scope.SelectedIDs.length === 1) entry.CompanyID = this.Scope.SelectedIDs[0];
    entry.EffectiveDate = new Date();
    entry.Status = 'Pending';
    // The workspace is the MANUAL-entry home (§8.1), so the type is fixed rather than offered — a
    // one-option select would be a control that cannot be operated. Stamped on the entity rather
    // than left for the engine to resolve, because the entity validates its own required fields and
    // an unset EntryTypeID would surface as an error about a control the screen does not have.
    const manual = AccountingEngineBase.Instance.JournalEntryTypeByCode('Manual');
    if (manual) entry.EntryTypeID = manual.ID;

    const state = this.stateFor(entry);
    await this.addLineTo(state);
    await this.addLineTo(state);
    return state;
  }

  /** The per-tab state around an entry: the entity, plus the two things it has nowhere to hold. */
  private stateFor(entry: JournalEntryEntity): JEDraftState {
    return { Entry: entry, Amounts: new Map() };
  }

  /** Append a blank line to an entry, with its money boxes ready to be typed in. */
  private async addLineTo(state: JEDraftState): Promise<JournalEntryLineEntity> {
    const line = (await state.Entry.Lines.Create()) as JournalEntryLineEntity;
    state.Amounts.set(line.ID, newAmountText());
    return line;
  }

  // ─── posting date ──────────────────────────────────────────────────────────

  /**
   * The posting date as `<input type="date">` wants it, and back.
   *
   * Formatted from the LOCAL parts rather than `toISOString()`: an entry posted on the 1st in a
   * timezone behind UTC serialises as the 31st of the previous month, which files it in the wrong
   * accounting period — balanced, reconciling against itself, and wrong.
   */
  public get EffectiveDateValue(): string {
    const value = this.Draft?.Entry.EffectiveDate;
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  public SetEffectiveDate(text: string): void {
    const d = this.Draft;
    if (!d) return;
    // Parsed as LOCAL midnight (the `T00:00:00` is load-bearing): `new Date('2026-03-15')` is UTC
    // midnight, which reads as the 14th anywhere west of Greenwich.
    d.Entry.EffectiveDate = text ? new Date(`${text}T00:00:00`) : (null as unknown as Date);
    this.touch();
  }

  // ─── company / accounts / dimensions ───────────────────────────────────────

  public get Companies(): Array<{ ID: string; Name: string }> {
    return this.Scope.Companies;
  }

  /** The company's functional currency — display-only (no FX in the v1 contract). */
  public get FunctionalCurrency(): string | null {
    const companyId = this.Draft?.Entry.CompanyID ?? null;
    if (!companyId) return null;
    const profile = AccountingEngineBase.Instance.CompanyProfiles.find((p) => UUIDsEqual(p.ID, companyId));
    return profile?.FunctionalCurrencyCode ?? null;
  }

  /**
   * Active accounts for the chosen company, from the engine's cache — no query.
   * Empty until a company is picked: an account list spanning companies would invite the exact
   * cross-company draft the engine rejects (MOD-12).
   */
  /** The dropdowns' null-sentinel rows (mj-dropdown DefaultItem = the old <option [ngValue]="null">). */
  public readonly CompanyPickDefault = { ID: null, Name: 'Pick a company…' };
  public readonly AccountPickDefault = { ID: null, Label: 'Pick an account…' };
  public readonly DimensionNoneDefault = { ID: null, Label: '—' };

  public get AccountOptions(): AccountOption[] {
    const companyId = this.Draft?.Entry.CompanyID ?? null;
    if (!companyId) return [];
    // Dedupe by normalized ID (2026-07-30): the engine cache can hold a client-created row AND its
    // server-refreshed case-variant copy until the upstream BaseEngine `===`-PK fix lands
    // (MJ-UPSTREAM.md). Last copy wins (the freshest upsert).
    const byId = new Map<string, AccountOption>();
    for (const a of AccountingEngineBase.Instance.GLAccounts) {
      if (!UUIDsEqual(a.CompanyID, companyId) || !a.IsActive) continue;
      byId.set(NormalizeUUID(a.ID), { ID: a.ID, Label: `${a.Code} · ${a.Name}` });
    }
    return [...byId.values()].sort((a, b) => a.Label.localeCompare(b.Label));
  }

  /** The chosen account's full "Code · Name" — bound to the select's title so the full name shows on
   *  hover even when the fixed-width column truncates it (Marcelo 2026-07-21). */
  public AccountLabel(id: string | null): string {
    if (!id) return '';
    return this.AccountOptions.find((a) => UUIDsEqual(a.ID, id))?.Label ?? '';
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

  /** Companies whose empty cached chart we already re-checked against the server this session. */
  private accountsRechecked = new Set<string>();

  public OnCompanyChanged(): void {
    const d = this.Draft;
    if (!d) return;
    // The old accounts belong to the previous company — keeping them would submit a cross-company
    // draft the engine rejects. Clear the selections, keep everything the operator typed.
    // Cast because the generated type describes a SAVED row, where GLAccountID is NOT NULL. An
    // unsaved line legitimately has no account yet — that is the state the picker's "Pick an
    // account…" row exists for, and the one this restores.
    for (const line of this.Lines) line.GLAccountID = null as unknown as string;
    this.touch();
    void this.recheckAccountsIfCacheEmpty(d.Entry.CompanyID ?? null);
  }

  /**
   * Staleness self-heal (Marcelo 2026-07-30): the picker reads the client engine cache, but a
   * company's chart can be created SERVER-side (seed hooks, another user, the accounts editor in
   * another tab) — the cache never hears about those rows. An empty cached chart for a picked
   * company is therefore suspect: force ONE engine refresh for it per session before trusting
   * "no accounts". Genuinely empty companies cost one extra read, then stay marked as checked.
   */
  private async recheckAccountsIfCacheEmpty(companyId: string | null): Promise<void> {
    if (!companyId || this.AccountOptions.length > 0) return;
    const key = NormalizeUUID(companyId);
    if (this.accountsRechecked.has(key)) return;
    this.accountsRechecked.add(key);
    await AccountingEngineBase.Instance.Config(true, this.ProviderToUse.CurrentUser, this.ProviderToUse);
    this.cdr.markForCheck();
  }

  // ─── lines ─────────────────────────────────────────────────────────────────

  /** The scrollable line-grid wrapper — so Add line can bring the new (bottom) row into view. */
  @ViewChild('gridScroll') private gridScroll?: ElementRef<HTMLElement>;

  /**
   * Drag the full-width bottom bar to resize the grid vertically. Sets an explicit height (a user-chosen
   * size), clamped to [min, 85% of the CONTAINER card] — container-based, not viewport. Pure DOM writes
   * (no change detection needed), so window-level pointer listeners are fine under zoneless OnPush.
   */
  public StartGridResize(ev: PointerEvent): void {
    ev.preventDefault();
    const el = this.gridScroll?.nativeElement;
    if (!el) return;
    const card = el.closest('.ws-card') as HTMLElement | null;
    const MIN = 150; // ≈ 2–3 rows — the smallest the grid can be dragged
    const MAX = card ? Math.round(card.clientHeight * 0.85) : 900;
    const startY = ev.clientY;
    const startH = Math.round(el.getBoundingClientRect().height);
    const onMove = (e: PointerEvent) => {
      const h = Math.max(MIN, Math.min(MAX, startH + (e.clientY - startY)));
      el.style.height = `${h}px`;
      el.style.maxHeight = `${h}px`;
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  /** The rows the grid renders — the entity's own collection, not a copy of it. */
  public get Lines(): JournalEntryLineEntity[] {
    return (this.Draft?.Entry.Lines.Items ?? []) as JournalEntryLineEntity[];
  }

  public async AddLine(): Promise<void> {
    const d = this.Draft;
    if (!d) return;
    await this.addLineTo(d);
    this.touch();
    // Scroll the new (last) row into view AFTER it renders. setTimeout(0) runs post-render; this only
    // reads/sets scrollTop (no change detection), so it's safe under zoneless OnPush.
    setTimeout(() => {
      const el = this.gridScroll?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  public async RemoveLine(line: JournalEntryLineEntity): Promise<void> {
    const d = this.Draft;
    if (!d) return;
    d.Entry.Lines.Remove(line);
    d.Amounts.delete(line.ID);
    // An editor with no rows offers nowhere to type. Removing the last line gives back a blank one.
    if (d.Entry.Lines.Count === 0) await this.addLineTo(d);
    this.touch();
  }

  /**
   * Why this row cannot be submitted, or null.
   *
   * The rules are the ENTITY's — an account, exactly one side, neither side negative — so this asks
   * the line rather than restating them. The one thing the entity cannot see is a money box holding
   * something that is not a number: by the time it reaches `DebitAmount` a typo has already become
   * `NaN`, which reads as "no amount" rather than as the mistake it is.
   */
  public LineIssue(line: JournalEntryLineEntity): string | null {
    const typo = TextIssue(this.Draft?.Amounts.get(line.ID));
    if (typo) return typo;
    if (line.IsEmpty) return null;
    const result = line.Validate();
    return result.Success ? null : (result.Errors[0]?.Message ?? null);
  }

  // ─── money boxes ───────────────────────────────────────────────────────────

  /**
   * The RAW TEXT of a money box.
   *
   * Bound instead of `line.DebitAmount` because a half-typed "8." is not a number: binding the
   * entity would erase the decimal point the instant change detection ran, and typing "8.50" would
   * be impossible.
   */
  public AmountText(line: JournalEntryLineEntity, side: keyof JEAmountText): string {
    return this.Draft?.Amounts.get(line.ID)?.[side] ?? '';
  }

  /** Keep the text as typed, and put the VALUE on the line. */
  public SetAmount(line: JournalEntryLineEntity, side: keyof JEAmountText, text: string): void {
    const d = this.Draft;
    if (!d) return;
    const amounts = d.Amounts.get(line.ID) ?? newAmountText();
    amounts[side] = text;
    d.Amounts.set(line.ID, amounts);

    // A blank box is zero, not null: `null` on both sides is how the entity reads an untouched row,
    // and a row the operator has cleared is not untouched.
    const parsed = parseMoney(text);
    const value = Number.isFinite(parsed) ? parsed : 0;
    if (side === 'Debit') line.DebitAmount = value;
    else line.CreditAmount = value;

    this.touch();
  }

  /** The engine's own complaint about this row, if it named one. */
  public EngineLineError(index: number): string | null {
    return this.LineErrors.get(index) ?? null;
  }

  /**
   * The value tagged on this line for one dimension axis, read from the LINE.
   *
   * These lived in a component `Map<lineID, Record<dimensionID, valueID>>`, justified at the time by
   * "`JournalEntryLine` declares no `Dimensions` related collection". That was true and is not any
   * more — the collection is declared and available on both tiers — so the Map was a mirror kept
   * alive by its own stale comment.
   */
  public DimensionValueFor(line: JournalEntryLineEntity, dimensionId: string): string | null {
    const key = dimensionId.toLowerCase();
    const tag = line.Dimensions.Items.find((d) => String(d.DimensionID ?? '').toLowerCase() === key);
    return tag?.DimensionValueID ?? null;
  }

  /**
   * Tag this line with a dimension value, or clear the tag.
   *
   * One row per axis: `UQ_JELDimension_Line_Dimension` says so, and picking a second value for the
   * same axis REPLACES rather than adds. Clearing REMOVES the row — an axis with no value is an
   * absent tag, not a tag pointing at nothing, and the engine rejects the latter.
   */
  public async SetDimensionValue(line: JournalEntryLineEntity, dimensionId: string, value: string): Promise<void> {
    const key = dimensionId.toLowerCase();
    const existing = line.Dimensions.Items.find((d) => String(d.DimensionID ?? '').toLowerCase() === key);

    if (!value) {
      if (existing) line.Dimensions.Remove(existing);
    } else if (existing) {
      existing.DimensionValueID = value;
    } else {
      const tag = await line.Dimensions.Create();
      tag.DimensionID = dimensionId;
      tag.DimensionValueID = value;
    }
    this.touch();
  }

  /** Any edit invalidates the server's verdict on the previous shape. */
  public touch(): void {
    if (this.tabs.ActiveId && this.Draft) this.tabs.UpdateState(this.tabs.ActiveId, this.Draft);
    // The memo lives in `d.Description` and its input calls `touch()` on every keystroke, so driving
    // the caption here makes it track the memo LIVE as the user types (renameActiveTab is cheap — a
    // single string assignment on the active tab).
    this.renameActiveTab(this.jeTabLabel());
    this.LineErrors.clear();
    this.DraftErrors = [];
    this.cdr.markForCheck();
  }

  /**
   * The active tab's caption, derived from the memo (Marcelo 2026-07-17: the memo is the human label
   * people scan by). The memo is the JE's free-text meaning — the `Description` field on the draft
   * (there is no `Memo` column on the Journal Entry entity). When it is empty we fall back to the
   * created entry NUMBER, then to "New JE" for a brand-new untyped draft.
   */
  private jeTabLabel(): string {
    const d = this.Draft;
    const memo = d?.Entry.Description?.trim();
    if (memo) return memo;
    return d?.CreatedEntryNumber || 'New JE';
  }

  /**
   * Write the active tab's caption — the ONE place the tab label is set, matching the order editor's
   * `renameActiveTab`. Mutating `tab.Label` in place is what the strip re-reads on the next OnPush
   * pass (its `Tabs` getter returns a fresh copy). The icon is left untouched.
   */
  private renameActiveTab(label: string): void {
    const tab = this.tabs.ActiveTab;
    if (tab) tab.Label = label;
  }

  // ─── balance strip ─────────────────────────────────────────────────────────

  public get Totals(): { Debits: number; Credits: number } {
    return this.Draft ? draftTotals(this.Draft.Entry) : { Debits: 0, Credits: 0 };
  }

  public get IsBalanced(): boolean {
    const { Debits, Credits } = this.Totals;
    return Debits > 0 && isBalanced(Debits, Credits);
  }

  // ─── submit ────────────────────────────────────────────────────────────────

  /**
   * Everything blocking submission, in reading order.
   *
   * The double-entry rules come from `Entry.Validate()` — the SAME call the server makes — rather
   * than from a hand-written list that says the same things in different words. What is added here
   * is what the entity genuinely cannot know: that a money box holds a typo rather than a number,
   * and that no company has been picked (the company scopes the account list; the engine derives the
   * entry's own from the accounts).
   */
  public get Issues(): string[] {
    const d = this.Draft;
    if (!d) return [];

    const issues: string[] = [];
    if (!d.Entry.CompanyID) issues.push('Pick a company to choose accounts from.');
    if (!d.Entry.EffectiveDate) issues.push('Pick an entry date.');

    // Typos first: a box holding "8o" reads as no amount to everything downstream, so an unbalanced
    // complaint about it would send the operator looking in the wrong place.
    for (const [i, line] of LiveLines(d.Entry).entries()) {
      const typo = TextIssue(d.Amounts.get(line.ID));
      if (typo) issues.push(`Line ${i + 1}: ${typo}`);
    }
    if (issues.some((m) => m.includes('must be numbers'))) return issues;

    const result = d.Entry.Validate();
    if (!result.Success) {
      for (const error of result.Errors) issues.push(error.Message);
    }
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
      // Mirror the number onto the entity so the receipt tab reads its own identity rather than the
      // component's copy of it. Only when there IS one — the column is NOT NULL once saved.
      if (d.CreatedEntryNumber) d.Entry.EntryNumber = d.CreatedEntryNumber;
      if (this.tabs.ActiveId) {
        this.tabs.UpdateState(this.tabs.ActiveId, d, false);
        this.tabs.SetStatus(this.tabs.ActiveId, 'complete');
      }
      // A memo-less entry now falls back to its freshly-minted number (touch() no longer fires on a
      // locked receipt); a memo'd entry keeps its memo caption.
      this.renameActiveTab(this.jeTabLabel());
      // On confirm, behave like a form that refreshes (Marcelo 2026-07-21): open a FRESH tab so the
      // operator can immediately enter the next entry. The just-created entry stays in its own tab,
      // read-only, for review. (openNewDraft clears messages, so set the confirmation after it.)
      const createdNumber = d.CreatedEntryNumber;
      await this.openNewDraft();
      this.ActionMessage = `Created entry ${createdNumber} — Pending, in the unbatched pool. Its tab is kept for review; this is a fresh entry.`;
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
    this.Lines.forEach((line, i) => {
      if (!line.IsEmpty) map.push(i);
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
