import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { RegisterClass } from '@memberjunction/global';
import { CompositeKey, RunView } from '@memberjunction/core';
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
  private forms = inject(MJFormPresenterService);

  public IsBusy = false;
  public LoadError: string | null = null;

  public AllAccounts: GLAccountRow[] = [];
  public Companies: CompanyOption[] = [];

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

    // Default the company scope to the first company (single, clean chart) — else show all.
    this._selectedCompanyID = this.Companies.length > 0 ? this.Companies[0].ID : 'All';
    this.rebuildTree();
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

  // ─── actions ──────────────────────────────────────────────────────────────────

  public OpenAccount(row: GLAccountRow): void {
    this.forms.Open({ EntityName: GL_ACCOUNT_ENTITY, PrimaryKey: CompositeKey.FromID(row.ID), Presentation: 'dialog', Width: '94vw' });
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadChartOfAccountsDashboard(): void {
  // No-op. Keeps @RegisterClass(BaseDashboard, 'ChartOfAccountsDashboard') alive.
}
