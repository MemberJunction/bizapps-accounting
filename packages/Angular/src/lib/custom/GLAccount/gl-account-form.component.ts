import { Component } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import { RunView } from '@memberjunction/core';
import {
  mjBizAppsAccountingGLAccountEntity,
} from '@mj-biz-apps/accounting-entities';
import { mjBizAppsAccountingGLAccountFormComponent } from '../../generated/Entities/mjBizAppsAccountingGLAccount/mjbizappsaccountingglaccount.form.component';

const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

type AccountType = mjBizAppsAccountingGLAccountEntity['AccountType'];
type StatusFilter = 'all' | 'active' | 'inactive';

/** A node in the chart-of-accounts tree. */
interface GLNode {
  ID: string;
  Code: string;
  Name: string;
  AccountType: AccountType;
  IsActive: boolean;
  ParentGLAccountID: string | null;
  Depth: number;
  Children: GLNode[];
  Expanded: boolean;
  /** True when this node is the GL account this form is showing (highlighted in the tree). */
  IsCurrent: boolean;
}

/**
 * GL Account — custom form. Extends the generated form (winning @RegisterClass priority) and adds
 * a parent/child CHART-OF-ACCOUNTS TREE for the account's company, with type + status filters and a
 * company selector. The tree is built from GLAccount.ParentGLAccountID; the current record is
 * highlighted. The generated Details fields stay in their own panel.
 */
@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: GL Accounts')
@Component({
  standalone: false,
  selector: 'mj-gl-account-form',
  templateUrl: './gl-account-form.component.html',
  styleUrls: ['./gl-account-form.component.css'],
})
export class GLAccountFormComponentExtended extends mjBizAppsAccountingGLAccountFormComponent {
  public declare record: mjBizAppsAccountingGLAccountEntity;

  public TreeLoading = false;
  public TreeError: string | null = null;

  /** All accounts for the selected company (flat), and the roots of the built tree. */
  private allAccounts: mjBizAppsAccountingGLAccountEntity[] = [];
  public Roots: GLNode[] = [];

  // Filters.
  public Companies: { ID: string; Name: string }[] = [];
  public SelectedCompanyID: string | null = null;
  public TypeFilter: AccountType | 'all' = 'all';
  public StatusFilter: StatusFilter = 'all';

  public readonly AccountTypes: AccountType[] = [
    'Asset', 'Liability', 'Equity', 'Revenue', 'Expense',
    'ContraAsset', 'ContraLiability', 'ContraRevenue', 'ContraExpense', 'Statistical',
  ];

  override async ngOnInit(): Promise<void> {
    await super.ngOnInit();
    // Default the tree's company + selector to the record's company.
    this.SelectedCompanyID = this.record?.CompanyID ?? null;
    await Promise.all([this.loadCompanies(), this.loadTree()]);
  }

  // ─── filter handlers ───────────────────────────────────────────────────────

  public async OnCompanyChange(companyID: string): Promise<void> {
    this.SelectedCompanyID = companyID;
    await this.loadTree();
  }

  public OnTypeFilterChange(value: string): void {
    this.TypeFilter = value as AccountType | 'all';
    this.rebuildTree();
  }

  public OnStatusFilterChange(value: string): void {
    this.StatusFilter = value as StatusFilter;
    this.rebuildTree();
  }

  public ToggleNode(node: GLNode): void {
    node.Expanded = !node.Expanded;
    this.cdr.markForCheck();
  }

  /** Flatten the tree for template rendering (depth-aware, respecting expanded state). */
  public get VisibleNodes(): GLNode[] {
    const out: GLNode[] = [];
    const walk = (nodes: GLNode[]) => {
      for (const n of nodes) {
        out.push(n);
        if (n.Expanded && n.Children.length) walk(n.Children);
      }
    };
    walk(this.Roots);
    return out;
  }

  // ─── data loading + tree build ─────────────────────────────────────────────

  private async loadCompanies(): Promise<void> {
    const rv = RunView.FromMetadataProvider(this.ProviderToUse);
    const res = await rv.RunView<{ ID: string; Name: string }>(
      { EntityName: 'MJ: Companies', Fields: ['ID', 'Name'], OrderBy: 'Name ASC', ResultType: 'simple' },
      this.ProviderToUse.CurrentUser,
    );
    this.Companies = res.Success ? (res.Results ?? []) : [];
    this.cdr.markForCheck();
  }

  private async loadTree(): Promise<void> {
    if (!this.SelectedCompanyID) { this.allAccounts = []; this.Roots = []; return; }
    this.TreeLoading = true;
    this.TreeError = null;
    this.cdr.markForCheck();
    try {
      const rv = RunView.FromMetadataProvider(this.ProviderToUse);
      const res = await rv.RunView<mjBizAppsAccountingGLAccountEntity>(
        { EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${this.SelectedCompanyID}'`, OrderBy: 'Code ASC', ResultType: 'simple' },
        this.ProviderToUse.CurrentUser,
      );
      if (!res.Success) { this.TreeError = res.ErrorMessage ?? 'Failed to load chart of accounts.'; this.allAccounts = []; }
      else this.allAccounts = res.Results ?? [];
      this.rebuildTree();
    } catch (e) {
      this.TreeError = e instanceof Error ? e.message : String(e);
      this.allAccounts = [];
      this.Roots = [];
    } finally {
      this.TreeLoading = false;
      this.cdr.markForCheck();
    }
  }

  /** Apply the type/status filters then rebuild the parent/child tree from the flat account list. */
  private rebuildTree(): void {
    const filtered = this.allAccounts.filter(a => this.passesFilters(a));
    const byId = new Map<string, GLNode>();
    for (const a of filtered) {
      byId.set(a.ID, {
        ID: a.ID, Code: a.Code, Name: a.Name, AccountType: a.AccountType, IsActive: a.IsActive,
        ParentGLAccountID: a.ParentGLAccountID, Depth: 0, Children: [], Expanded: true,
        IsCurrent: a.ID === this.record?.ID,
      });
    }
    const roots: GLNode[] = [];
    for (const node of byId.values()) {
      const parent = node.ParentGLAccountID ? byId.get(node.ParentGLAccountID) : undefined;
      if (parent) { node.Depth = parent.Depth + 1; parent.Children.push(node); }
      else roots.push(node);
    }
    // A node whose parent was filtered out becomes a root (so filtering never hides survivors).
    this.normalizeDepths(roots, 0);
    this.Roots = roots;
    this.cdr.markForCheck();
  }

  private normalizeDepths(nodes: GLNode[], depth: number): void {
    for (const n of nodes) { n.Depth = depth; this.normalizeDepths(n.Children, depth + 1); }
  }

  private passesFilters(a: mjBizAppsAccountingGLAccountEntity): boolean {
    if (this.TypeFilter !== 'all' && a.AccountType !== this.TypeFilter) return false;
    if (this.StatusFilter === 'active' && !a.IsActive) return false;
    if (this.StatusFilter === 'inactive' && a.IsActive) return false;
    return true;
  }
}

/** Tree-shaking prevention — called from custom-forms.module.ts's load function. */
export function LoadGLAccountFormComponentExtended(): void {
  // No-op.
}
