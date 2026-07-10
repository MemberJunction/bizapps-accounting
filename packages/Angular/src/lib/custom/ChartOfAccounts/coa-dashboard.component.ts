import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { RegisterClass } from '@memberjunction/global';
import { Metadata, RunView } from '@memberjunction/core';
import { ResourceData } from '@memberjunction/core-entities';
import { mjBizAppsAccountingGLAccountEntity } from '@mj-biz-apps/accounting-entities';

const GL_ACCOUNT_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const COMPANY_PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

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
  /** Snapshot taken when opening an existing account, so Cancel can revert edits back to the view. */
  private savedModel: AccountEditModel | null = null;

  // ─── filters ───────────────────────────────────────────────────────────────
  public AccountTypeFilter: AccountType | 'All' = 'All';
  public Search = '';

  private _selectedCompanyID = 'All';
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
    const rv = new RunView();
    const [accountsRes, companiesRes] = await rv.RunViews([
      {
        EntityName: GL_ACCOUNT_ENTITY,
        Fields: ['ID', 'Code', 'Name', 'AccountType', 'CompanyID', 'Company', 'ParentGLAccountID', 'CurrencyCode', 'IsActive'],
        OrderBy: 'Code ASC',
        MaxRows: 1000,
        ResultType: 'simple',
      },
      {
        EntityName: COMPANY_PROFILE_ENTITY,
        Fields: ['ID', 'Name', 'CompanyCode'],
        OrderBy: 'Name ASC',
        MaxRows: 1000,
        ResultType: 'simple',
      },
    ]);

    if (!accountsRes.Success) throw new Error(accountsRes.ErrorMessage ?? 'Failed to load GL accounts.');
    if (!companiesRes.Success) throw new Error(companiesRes.ErrorMessage ?? 'Failed to load company profiles.');

    this.AllAccounts = (accountsRes.Results ?? []) as GLAccountRow[];
    this.Companies = (companiesRes.Results ?? []) as CompanyOption[];
    this.loadAccountTypeOptions();

    // Default the company scope to the first company (single, clean chart) — else show all.
    this._selectedCompanyID = this.Companies.length > 0 ? this.Companies[0].ID : 'All';
    this.rebuildTree();
  }

  /** Valid AccountType values from the entity's field metadata (CHECK-constraint source of truth); fall back to the distinct set present in the data. */
  private loadAccountTypeOptions(): void {
    const field = this.md.EntityByName(GL_ACCOUNT_ENTITY)?.Fields?.find(f => f.Name === 'AccountType');
    const fromMeta = (field?.EntityFieldValues ?? []).map(v => v.Value as AccountType);
    this.AccountTypeOptions = fromMeta.length ? fromMeta : this.AccountTypes;
  }

  /** Reload just the GL accounts + rebuild the tree, PRESERVING the current company scope (used after a save). */
  private async reloadAccounts(): Promise<void> {
    const res = await new RunView().RunView({
      EntityName: GL_ACCOUNT_ENTITY,
      Fields: ['ID', 'Code', 'Name', 'AccountType', 'CompanyID', 'Company', 'ParentGLAccountID', 'CurrencyCode', 'IsActive'],
      OrderBy: 'Code ASC', MaxRows: 1000, ResultType: 'simple',
    });
    if (res.Success) { this.AllAccounts = (res.Results ?? []) as GLAccountRow[]; this.rebuildTree(); }
  }

  // ─── company scope ─────────────────────────────────────────────────────────

  public get SelectedCompanyID(): string {
    return this._selectedCompanyID;
  }
  public set SelectedCompanyID(value: string) {
    this._selectedCompanyID = value;
    this.rebuildTree();
    this.cdr.markForCheck();
  }

  /** Accounts within the current company scope (all companies when 'All'). */
  private scopedAccounts(): GLAccountRow[] {
    if (this._selectedCompanyID === 'All') return this.AllAccounts;
    const target = this._selectedCompanyID.toUpperCase();
    return this.AllAccounts.filter(a => a.CompanyID.toUpperCase() === target);
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

  // ─── account dialog (view / edit / create) ────────────────────────────────────

  /** Open the clean, curated account panel in read-only VIEW mode (loads the full record). */
  public async OpenAccount(row: GLAccountRow): Promise<void> {
    this.DialogError = null;
    const entity = await this.md.GetEntityObject<mjBizAppsAccountingGLAccountEntity>(GL_ACCOUNT_ENTITY);
    if (!(await entity.Load(row.ID))) {
      this.DialogError = `Could not load account ${row.Code}.`;
    }
    this.Model = this.modelFromEntity(entity);
    this.savedModel = { ...this.Model };
    this.DialogMode = 'view';
    this.DialogVisible = true;
    this.cdr.markForCheck();
  }

  /** Open the same panel blank + editable to create a new account (scoped to the current company). */
  public OnNewAccount(): void {
    this.DialogError = null;
    this.Model = this.blankModel();
    this.savedModel = null;
    this.DialogMode = 'create';
    this.DialogVisible = true;
    this.cdr.markForCheck();
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
      entity.CurrencyCode = this.Model.CurrencyCode.trim() || null;
      entity.IsActive = this.Model.IsActive;
      entity.Description = this.Model.Description.trim() || null;
      if (!(await entity.Save())) throw new Error(entity.LatestResult?.CompleteMessage ?? 'Save failed.');

      await this.reloadAccounts();
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
    const sel = this._selectedCompanyID;
    const companyID = sel && sel !== 'All' ? sel : (this.Companies?.[0]?.ID ?? '');
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
