import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, Input } from '@angular/core';
import { takeUntil } from 'rxjs';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { RegisterClass } from '@memberjunction/global';
import { Metadata, CompositeKey } from '@memberjunction/core';
import { ResourceData } from '@memberjunction/core-entities';
import { mjBizAppsAccountingGLAccountEntity } from '@mj-biz-apps/accounting-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';

const GL_ACCOUNT_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

/** AccountType union, derived from the generated entity (rule 2c — never hand-copied). */
type AccountType = mjBizAppsAccountingGLAccountEntity['AccountType'];

/** One GL account, flattened for the tree. */
interface GLAccountRow {
  ID: string;
  Code: string;
  Name: string;
  AccountType: AccountType;
  CompanyID: string;
  Company: string;
  ParentGLAccountID: string | null;
  CurrencyCode: string | null;
  IsActive: boolean;
}

/** A company option for the selector. Its ID equals the owning __mj.Company ID (IsA pattern). */
interface CompanyOption {
  ID: string;
  Name: string;
  CompanyCode: string;
}

/** A node in the flattened tree traversal — the account plus its indentation depth. */
interface TreeNode {
  Row: GLAccountRow;
  Depth: number;
}

/** The curated, editable shape shown in the account dialog (a user-friendly subset of the GL Account entity). */
interface AccountEditModel {
  ID: string | null; // null = create mode
  Code: string;
  Name: string;
  AccountType: AccountType;
  CompanyID: string;
  ParentGLAccountID: string | null;
  CurrencyCode: string; // '' → stored as NULL (company functional currency)
  IsActive: boolean;
  Description: string; // '' → stored as NULL
}

/**
 * Chart of Accounts — a hierarchical, company-scoped view of the GL account tree.
 *
 * Loads all GL accounts + all company profiles (for the company selector) in one batched read.
 * Builds the parent→child hierarchy client-side from ParentGLAccountID, renders it as an indented
 * flat list ordered by depth-first traversal, and filters by company / account type / search. Clicking
 * a row opens the existing generated GL Account form via the BaseDashboard OpenEntityRecord output.
 */
@Component({
  standalone: false,
  selector: 'mj-chart-of-accounts-dashboard',
  templateUrl: './coa-dashboard.component.html',
  styleUrls: ['./coa-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'ChartOfAccountsDashboard')
export class ChartOfAccountsDashboardComponent extends BaseDashboard {
  private cdr = inject(ChangeDetectorRef);
  private md = new Metadata();

  public IsBusy = false;
  public LoadError: string | null = null;

  public AllAccounts: GLAccountRow[] = [];
  public Companies: CompanyOption[] = [];

  // ─── account view/edit/create dialog ─────────────────────────────────────────
  public DialogVisible = false;
  public DialogMode: 'view' | 'edit' | 'create' = 'view';
  public Saving = false;
  public DialogError: string | null = null;
  public Model: AccountEditModel = this.blankModel();
  /** The valid AccountType values, sourced from entity metadata (rule 2c — not a hand-copied union). */
  public AccountTypeOptions: AccountType[] = [];
  /** Seeded currency roster for the editor's searchable combobox (Marcelo 2026-07-30: free-text
   *  invited typos the DB then rejected). Label = "CODE — Name" so the combobox's contains-filter
   *  matches typing either the actual code ("USD") or the name ("dollar"). */
  public get CurrencyOptions(): Array<{ Code: string; Name: string; Label: string }> {
    return AccountingEngineBase.Instance.Currencies
      .map((c) => ({ Code: c.Code, Name: c.Name, Label: `${c.Code} — ${c.Name}` }))
      .sort((a, b) => a.Code.localeCompare(b.Code));
  }
  /** Snapshot taken when opening an existing account, so Cancel can revert edits back to the view. */
  private savedModel: AccountEditModel | null = null;
  /** One-time guard for the reactive engine subscription. */
  private engineSubscribed = false;

  // ─── filters ───────────────────────────────────────────────────────────────
  public AccountTypeFilter: AccountType | 'All' = 'All';
  public Search = '';

  // ─── list-page standard chrome (fused subheader — Marcelo 2026-08-04) ────────

  public get SummaryFigures(): Array<{ Label: string; Value: string; Tone?: 'default' | 'credit' | 'muted' | 'success' | 'warning' | 'danger' | 'info' }> {
    return [
      { Label: 'Accounts', Value: String(this.AllAccounts.length) },
      { Label: 'Companies', Value: String(this.CompanyCount) },
    ];
  }

  /** Account types as chips (single-select, matching SetAccountTypeFilter's semantics). */
  public get TypeChips(): Array<{ Key: string; Label: string; Count?: number | null }> {
    return [
      { Key: 'All', Label: 'All types' },
      ...(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const)
        .filter((t) => this.AllAccounts.some((a) => a.AccountType === t))
        .map((t) => ({ Key: t, Label: t, Count: this.AllAccounts.filter((a) => a.AccountType === t).length })),
    ];
  }

  public get ActiveTypeKeys(): string[] {
    return [this.AccountTypeFilter];
  }

  public OnTypeToggled(key: string): void {
    this.SetAccountTypeFilter(key as AccountType | 'All');
  }

  public AdvancedOpen = false;

  public get AdvancedCount(): number {
    return this.SelectedCompanyIDs.length ? 1 : 0;
  }

  public OnToolbarSearch(text: string): void {
    this.Search = text;
  }

  /** The scoped, fully-traversed tree — rebuilt whenever the company scope or data changes. */
  private scopedTree: TreeNode[] = [];

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Chart of Accounts';
  }

  protected initDashboard(): void {
    // One-time setup; data loads in loadData().
  }

  protected async loadData(): Promise<void> {
    this.IsBusy = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      await this.loadAll();
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsBusy = false;
      this.cdr.markForCheck();
    }
    // BaseDashboard.ngOnInit() calls NotifyLoadComplete() after loadData() resolves.
  }

  // ─── data loading ────────────────────────────────────────────────────────────

  private async loadAll(): Promise<void> {
    // GL Accounts + Company Profiles come from the shared reactive reference engine (AccountingEngineBase),
    // not a per-page RunView — so every page shares one cache and edits/creates propagate automatically.
    await AccountingEngineBase.Instance.ConfigEx({ contextUser: this.ProviderToUse.CurrentUser, provider: this.ProviderToUse });
    this.loadAccountTypeOptions();
    this.hydrateFromEngine();
    // Default the company scope to the first company (single, clean chart) — else show all.
    if (this.SelectedCompanyIDs.length === 0 && this.Companies.length > 0) {
      this.SelectedCompanyIDs = [this.Companies[0].ID];
      this.rebuildTree();
    }
    this.ensureEngineSubscription();
  }

  /** Project the engine's cached entities into the page's row/option shapes + rebuild the tree (scope preserved). */
  private hydrateFromEngine(): void {
    const eng = AccountingEngineBase.Instance;
    this.AllAccounts = eng.GLAccounts.map(a => ({
      ID: a.ID, Code: a.Code, Name: a.Name, AccountType: a.AccountType, CompanyID: a.CompanyID,
      Company: a.Company ?? '', ParentGLAccountID: a.ParentGLAccountID, CurrencyCode: a.CurrencyCode, IsActive: a.IsActive,
    }));
    this.Companies = eng.CompanyProfiles
      .map(c => ({ ID: c.ID, Name: c.Name, CompanyCode: c.CompanyCode }))
      .sort((x, y) => x.Name.localeCompare(y.Name));
    this.rebuildTree();
  }

  /** Subscribe once: when the engine's GL-account cache changes (any save/create/delete, from anywhere), re-hydrate. */
  private ensureEngineSubscription(): void {
    if (this.engineSubscribed) return;
    this.engineSubscribed = true;
    AccountingEngineBase.Instance
      .ObserveProperty<mjBizAppsAccountingGLAccountEntity>('_glAccounts')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => { this.hydrateFromEngine(); this.cdr.markForCheck(); });
  }

  /** Valid AccountType values from the entity's field metadata (CHECK-constraint source of truth); fall back to the distinct set present in the data. */
  private loadAccountTypeOptions(): void {
    const field = this.md.EntityByName(GL_ACCOUNT_ENTITY)?.Fields?.find(f => f.Name === 'AccountType');
    const fromMeta = (field?.EntityFieldValues ?? []).map(v => v.Value as AccountType);
    this.AccountTypeOptions = fromMeta.length ? fromMeta : this.AccountTypes;
  }

  // ─── company scope ─────────────────────────────────────────────────────────

  /** Company rows shaped for the dropdowns — "Name (CODE)", the label the old <option>s composed. */
  public get CompanyScopeOptions(): ReadonlyArray<{ ID: string; Name: string }> {
    return (this.Companies ?? []).map((c) => ({ ID: c.ID, Name: `${c.Name} (${c.CompanyCode})` }));
  }

  /** Parent rows shaped for the dropdown — "Code · Name". */
  public get ParentChoices(): ReadonlyArray<{ ID: string; Label: string }> {
    return (this.ParentOptions ?? []).map((p) => ({ ID: p.ID, Label: `${p.Code} · ${p.Name}` }));
  }

  public readonly ParentNoneDefault = { ID: null, Label: '— none (top level) —' };

  /** MULTI-select company narrowing (Marcelo 2026-08-05): empty = every company's tree. */
  public SelectedCompanyIDs: string[] = [];

  public OnCompanyIDsChanged(ids: string[]): void {
    this.SelectedCompanyIDs = ids;
    this.rebuildTree();
    this.cdr.markForCheck();
  }

  /** Accounts within the current company scope (all companies when nothing is checked). */
  private scopedAccounts(): GLAccountRow[] {
    if (this.SelectedCompanyIDs.length === 0) return this.AllAccounts;
    const targets = new Set(this.SelectedCompanyIDs.map(x => x.toUpperCase()));
    return this.AllAccounts.filter(a => targets.has(a.CompanyID.toUpperCase()));
  }

  private rebuildTree(): void {
    this.scopedTree = this.flattenTree(this.scopedAccounts());
  }

  // ─── tree building ───────────────────────────────────────────────────────────

  /** Group the scoped accounts by parent ID (uppercased); each bucket sorted by Code. */
  private buildChildMap(rows: GLAccountRow[]): Map<string, GLAccountRow[]> {
    const byParent = new Map<string, GLAccountRow[]>();
    for (const r of rows) {
      const key = r.ParentGLAccountID ? r.ParentGLAccountID.toUpperCase() : '';
      const bucket = byParent.get(key) ?? [];
      bucket.push(r);
      byParent.set(key, bucket);
    }
    for (const bucket of byParent.values()) {
      bucket.sort((a, b) => a.Code.localeCompare(b.Code));
    }
    return byParent;
  }

  /** Roots = accounts with no parent, or whose parent is outside the scoped set. */
  private findRoots(rows: GLAccountRow[]): GLAccountRow[] {
    const idSet = new Set(rows.map(r => r.ID.toUpperCase()));
    return rows
      .filter(r => !r.ParentGLAccountID || !idSet.has(r.ParentGLAccountID.toUpperCase()))
      .sort((a, b) => a.Code.localeCompare(b.Code));
  }

  /** Depth-first traversal → flat list of {node, depth} for indented rendering. */
  private flattenTree(rows: GLAccountRow[]): TreeNode[] {
    const byParent = this.buildChildMap(rows);
    const out: TreeNode[] = [];
    const visit = (row: GLAccountRow, depth: number): void => {
      out.push({ Row: row, Depth: depth });
      const children = byParent.get(row.ID.toUpperCase()) ?? [];
      for (const child of children) visit(child, depth + 1);
    };
    for (const root of this.findRoots(rows)) visit(root, 0);
    return out;
  }

  // ─── filtered view ─────────────────────────────────────────────────────────

  /** Distinct account types present in the data — sourced from the data (no hand-copied union). */
  public get AccountTypes(): AccountType[] {
    return Array.from(new Set(this.AllAccounts.map(a => a.AccountType))).sort();
  }

  public get CompanyCount(): number {
    return this.Companies.length;
  }

  public get FilteredTree(): TreeNode[] {
    const q = this.Search.trim().toLowerCase();
    return this.scopedTree.filter(n => {
      if (this.AccountTypeFilter !== 'All' && n.Row.AccountType !== this.AccountTypeFilter) return false;
      if (q && !this.matchesSearch(n.Row, q)) return false;
      return true;
    });
  }

  private matchesSearch(row: GLAccountRow, q: string): boolean {
    return row.Code.toLowerCase().includes(q) || row.Name.toLowerCase().includes(q);
  }

  public SetAccountTypeFilter(type: AccountType | 'All'): void {
    this.AccountTypeFilter = type;
    this.cdr.markForCheck();
  }

  // ─── presentation helpers ────────────────────────────────────────────────────

  /** Left padding for a row at the given tree depth (keeps the row's 12px base indent at depth 0). */
  public Indent(depth: number): string {
    return `${12 + depth * 22}px`;
  }

  public TypeVariant(type: AccountType): string {
    switch (type) {
      case 'Asset': return 'info';
      case 'Liability': return 'warning';
      case 'Revenue': return 'success';
      case 'Expense': return 'error';
      case 'Equity': return 'default';
      default: return 'default';
    }
  }

  // ─── account navigation (Explorer record tab) ────────────────────────────────

  /** Open the GL Account entity record in an Explorer tab via NavigationService. */
  public async OpenAccount(row: GLAccountRow): Promise<void> {
    if (!row?.ID) return;
    if (this.navigationService) {
      this.navigationService.OpenEntityRecord(GL_ACCOUNT_ENTITY, CompositeKey.FromID(row.ID));
    }
  }

  /** Monotonic counter from the header's "New account" verb. */
  private _createSignal = 0;
  @Input() set CreateSignal(v: number) {
    if (v > this._createSignal) {
      this._createSignal = v;
      this.OnNewAccount();
    }
  }

  public OnNewAccount(): void {
    if (this.navigationService) {
      this.navigationService.OpenNewEntityRecord(GL_ACCOUNT_ENTITY);
    }
  }

  public StartEdit(): void { this.DialogMode = 'edit'; this.DialogError = null; this.cdr.markForCheck(); }

  /** Cancel: an edit reverts to the saved view; a create just closes. */
  public OnDialogCancel(): void {
    if (this.DialogMode === 'edit' && this.savedModel) {
      this.Model = { ...this.savedModel };
      this.DialogMode = 'view';
      this.DialogError = null;
      this.cdr.markForCheck();
    } else {
      this.CloseDialog();
    }
  }

  public CloseDialog(): void { this.DialogVisible = false; this.DialogError = null; this.cdr.markForCheck(); }

  /** Persist the model via the typed entity (create or update), refresh the tree, land on the clean view. */
  public async SaveAccount(): Promise<void> {
    if (this.Saving) return;
    const err = this.validate();
    if (err) { this.DialogError = err; this.cdr.markForCheck(); return; }
    this.Saving = true; this.DialogError = null; this.cdr.markForCheck();
    try {
      const entity = await this.md.GetEntityObject<mjBizAppsAccountingGLAccountEntity>(GL_ACCOUNT_ENTITY);
      if (this.Model.ID) {
        if (!(await entity.Load(this.Model.ID))) throw new Error('Account no longer exists.');
      } else {
        entity.NewRecord();
      }
      entity.Code = this.Model.Code.trim();
      entity.Name = this.Model.Name.trim();
      entity.AccountType = this.Model.AccountType;
      entity.CompanyID = this.Model.CompanyID;
      entity.ParentGLAccountID = this.Model.ParentGLAccountID || null;
      entity.CurrencyCode = (this.Model.CurrencyCode ?? '').trim() || null; // combobox clear can write null
      entity.IsActive = this.Model.IsActive;
      entity.Description = this.Model.Description.trim() || null;
      if (!(await entity.Save())) throw new Error(entity.LatestResult?.CompleteMessage ?? 'Save failed.');

      // No manual reload: the save fires a BaseEntity event → the engine updates its GL-account cache →
      // ObserveProperty emits → the tree re-hydrates automatically (reactive).
      this.Model = this.modelFromEntity(entity);
      this.savedModel = { ...this.Model };
      this.DialogMode = 'view';
    } catch (e) {
      this.DialogError = e instanceof Error ? e.message : String(e);
    } finally {
      this.Saving = false;
      this.cdr.markForCheck();
    }
  }

  private validate(): string | null {
    if (!this.Model.Code.trim()) return 'Account code is required.';
    if (!this.Model.Name.trim()) return 'Account name is required.';
    if (!this.Model.CompanyID) return 'Company is required.';
    if (!this.Model.AccountType) return 'Account type is required.';
    return null;
  }

  private modelFromEntity(e: mjBizAppsAccountingGLAccountEntity): AccountEditModel {
    return {
      ID: e.ID, Code: e.Code, Name: e.Name, AccountType: e.AccountType, CompanyID: e.CompanyID,
      ParentGLAccountID: e.ParentGLAccountID, CurrencyCode: e.CurrencyCode ?? '', IsActive: e.IsActive,
      Description: e.Description ?? '',
    };
  }

  private blankModel(): AccountEditModel {
    // Null-safe: this runs once as a field initializer BEFORE the other fields are set, and again in OnNewAccount.
    // Pre-pick the scoped company only when the scope narrows to exactly one.
    const sel = this.SelectedCompanyIDs?.length === 1 ? this.SelectedCompanyIDs[0] : '';
    const companyID = sel || (this.Companies?.[0]?.ID ?? '');
    return {
      ID: null, Code: '', Name: '', AccountType: this.AccountTypeOptions?.[0] ?? ('Asset' as AccountType),
      CompanyID: companyID, ParentGLAccountID: null, CurrencyCode: '', IsActive: true, Description: '',
    };
  }

  // ─── dialog presentation helpers ─────────────────────────────────────────────

  public get DialogTitle(): string {
    if (this.DialogMode === 'create') return 'New GL Account';
    return this.Model.Code ? `${this.Model.Code} · ${this.Model.Name}` : 'GL Account';
  }

  /** Parent-account choices: accounts in the model's company, excluding the account itself. */
  public get ParentOptions(): GLAccountRow[] {
    const co = this.Model.CompanyID?.toUpperCase();
    return this.AllAccounts
      .filter(a => a.CompanyID.toUpperCase() === co && a.ID !== this.Model.ID)
      .sort((a, b) => a.Code.localeCompare(b.Code));
  }

  public get ParentName(): string {
    const p = this.AllAccounts.find(a => a.ID === this.Model.ParentGLAccountID);
    return p ? `${p.Code} · ${p.Name}` : '—';
  }

  public companyName(id: string): string {
    return this.Companies.find(c => c.ID.toUpperCase() === (id ?? '').toUpperCase())?.Name ?? id;
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadChartOfAccountsDashboard(): void {
  // No-op. Keeps @RegisterClass(BaseDashboard, 'ChartOfAccountsDashboard') alive.
}
