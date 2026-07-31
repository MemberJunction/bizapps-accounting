import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { RegisterClass } from '@memberjunction/global';
import { CompositeKey, Metadata, RunView } from '@memberjunction/core';
import { ResourceData } from '@memberjunction/core-entities';
import { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';

const COMPANY_PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
// __mj.User — the CFO approver FK target (ApprovalCFOUserID). MJ v5: core entities REQUIRE the
// 'MJ: ' prefix — the bare 'Users' no longer resolves and threw "Entity Users not found in
// metadata" as a red card on the Configuration page (same bug class as TasksAppApprovalGate).
const USER_ENTITY = 'MJ: Users';

/** Value-list unions, derived from the generated entity (rule 2c — never hand-copied). */
type EntityType = mjBizAppsAccountingAccountingCompanyProfileEntity['EntityType'];
type LegalStructureType = mjBizAppsAccountingAccountingCompanyProfileEntity['LegalStructureType'];

/** One company profile row (read-only v1 detail). */
interface CompanyProfileRow {
  ID: string;
  Name: string;
  CompanyCode: string;
  EntityType: EntityType;
  LegalStructureType: LegalStructureType;
  FunctionalCurrencyCode: string;
  ReportingCurrencyCode: string | null;
  FiscalYearStartMonth: number;
  FiscalYearStartDay: number;
  IsActive: boolean;
  // CFO approver (the bizapps-tasks approval gate assigns batch-approval Tasks to this __mj User).
  ApprovalCFOUserID: string | null;
  ApprovalCFOUser: string | null;
}

/** A selectable __mj User for the CFO picker. */
interface UserOption {
  ID: string;
  Name: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Company Setup — a read-only, navigational hub for the deployment's accounting company profiles.
 *
 * Loads all Accounting Company Profiles, lists them on the left, and shows a read-only detail card
 * on the right for the selected company: identity + fiscal + currency settings and the CFO approver.
 * An "Open profile" button opens the generated profile form (via OpenEntityRecord) for editing.
 * (The former default-GL-account slots were retired with the rewritten baseline — the role-based
 * GLAccountRole/GLAccountLink model replaces them; its UI lands with the port work.)
 */
@Component({
  standalone: false,
  selector: 'mj-company-setup-dashboard',
  templateUrl: './company-setup-dashboard.component.html',
  styleUrls: ['./company-setup-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'CompanySetupDashboard')
export class CompanySetupDashboardComponent extends BaseDashboard {
  private cdr = inject(ChangeDetectorRef);
  private forms = inject(MJFormPresenterService);

  public IsBusy = false;
  public LoadError: string | null = null;

  public Companies: CompanyProfileRow[] = [];
  public Users: UserOption[] = [];

  // ─── CFO assignment state ────────────────────────────────────────────────────
  public SelectedUserID = '';
  public Saving = false;
  public ActionMessage: string | null = null;
  public ActionIsError = false;

  private _selectedID: string | null = null;

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Company Setup';
  }

  protected initDashboard(): void {
    // One-time setup; data loads in loadData().
  }

  protected async loadData(): Promise<void> {
    this.IsBusy = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      await this.loadCompanies();
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsBusy = false;
      this.cdr.markForCheck();
    }
    // BaseDashboard.ngOnInit() calls NotifyLoadComplete() after loadData() resolves.
  }

  private async loadCompanies(): Promise<void> {
    const rv = new RunView();
    const [companies, users] = await rv.RunViews([
      {
        EntityName: COMPANY_PROFILE_ENTITY,
        Fields: [
          'ID', 'Name', 'CompanyCode', 'EntityType', 'LegalStructureType',
          'FunctionalCurrencyCode', 'ReportingCurrencyCode', 'FiscalYearStartMonth', 'FiscalYearStartDay', 'IsActive',
          'ApprovalCFOUserID', 'ApprovalCFOUser',
        ],
        OrderBy: 'Name ASC',
        MaxRows: 1000,
        ResultType: 'simple',
      },
      { EntityName: USER_ENTITY, Fields: ['ID', 'Name'], OrderBy: 'Name ASC', MaxRows: 500, ResultType: 'simple' },
    ]);
    if (!companies.Success) throw new Error(companies.ErrorMessage ?? 'Failed to load company profiles.');
    this.Companies = (companies.Results ?? []) as CompanyProfileRow[];
    this.Users = ((users.Results ?? []) as Array<{ ID: string; Name: string }>)
      .map(u => ({ ID: u.ID, Name: u.Name }));
    this._selectedID = this.Companies.length > 0 ? this.Companies[0].ID : null;
  }

  // ─── selection ───────────────────────────────────────────────────────────────

  public get SelectedID(): string | null {
    return this._selectedID;
  }

  public SelectCompany(row: CompanyProfileRow): void {
    this._selectedID = row.ID;
    this.cdr.markForCheck();
  }

  public IsSelected(row: CompanyProfileRow): boolean {
    return !!this._selectedID && row.ID.toUpperCase() === this._selectedID.toUpperCase();
  }

  public get Selected(): CompanyProfileRow | null {
    if (!this._selectedID) return null;
    const target = this._selectedID.toUpperCase();
    return this.Companies.find(c => c.ID.toUpperCase() === target) ?? null;
  }

  // ─── detail helpers ────────────────────────────────────────────────────────

  public get FiscalYearStart(): string {
    const c = this.Selected;
    if (!c) return '';
    const month = MONTH_NAMES[c.FiscalYearStartMonth - 1] ?? `Month ${c.FiscalYearStartMonth}`;
    return `${month} ${c.FiscalYearStartDay}`;
  }

  public get ReportingCurrency(): string {
    const c = this.Selected;
    if (!c) return '';
    return c.ReportingCurrencyCode ?? `${c.FunctionalCurrencyCode} (same as functional)`;
  }

  // ─── actions ──────────────────────────────────────────────────────────────────

  public OpenProfile(): void {
    const c = this.Selected;
    if (!c) return;
    this.forms.Open({ EntityName: COMPANY_PROFILE_ENTITY, PrimaryKey: CompositeKey.FromID(c.ID), Presentation: 'dialog', Width: '94vw' });
  }

  /**
   * Create a new accounting company. ONE profile save is the whole creation path: the entity's
   * IS-A machinery creates the `__mj.Company` parent row (same UUID) and the server-side W1 hook
   * seeds the company's default chart of accounts — the same path the test fixture uses. No keys
   * passed to the presenter = new-record form in edit mode.
   */
  public async NewCompany(): Promise<void> {
    const ref = this.forms.Open({ EntityName: COMPANY_PROFILE_ENTITY, Presentation: 'dialog', Width: '94vw' });
    const saved = await ref.AfterSaved();
    if (!saved) return; // cancelled
    const created = saved as mjBizAppsAccountingAccountingCompanyProfileEntity;
    await this.loadCompanies();
    this._selectedID = created.ID;
    this.ActionMessage = `Company ${created.Name} created — its default chart of accounts has been seeded.`;
    this.ActionIsError = false;
    this.cdr.markForCheck();
  }

  // ─── CFO assignment ─────────────────────────────────────────────────────────

  /** The selected company's current CFO approver name, or null when unassigned. */
  public get CurrentCFO(): string | null {
    return this.Selected?.ApprovalCFOUser ?? null;
  }

  public get CanAssignSelected(): boolean {
    return !!this.Selected && !!this.SelectedUserID && !this.Saving;
  }

  /**
   * Make the CURRENT logged-in user the CFO of the selected company — robust to sign-in method
   * (magic link or otherwise). ApprovalCFOUserID is a __mj.User FK, so the current user's ID
   * assigns directly.
   */
  public async MakeMeCFO(): Promise<void> {
    const company = this.Selected;
    if (!company || this.Saving) return;
    this.beginSave();
    try {
      const user = this.ProviderToUse.CurrentUser;
      if (!user) { this.setError('No current user is available.'); return; }
      await this.setCompanyCFO(company.ID, user.ID, `You are now the CFO approver for ${company.Name}.`);
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.endSave();
    }
  }

  /** Assign an existing __mj User (picked from the dropdown) as the selected company's CFO. */
  public async AssignSelectedCFO(): Promise<void> {
    const company = this.Selected;
    if (!company || !this.SelectedUserID || this.Saving) return;
    this.beginSave();
    try {
      const user = this.Users.find(u => u.ID === this.SelectedUserID);
      await this.setCompanyCFO(company.ID, this.SelectedUserID, `CFO approver set to ${user?.Name ?? 'the selected user'} for ${company.Name}.`);
      this.SelectedUserID = '';
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.endSave();
    }
  }

  /** Clear the selected company's CFO approver. */
  public async ClearCFO(): Promise<void> {
    const company = this.Selected;
    if (!company || this.Saving) return;
    this.beginSave();
    try {
      await this.setCompanyCFO(company.ID, null, `CFO approver cleared for ${company.Name}.`);
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.endSave();
    }
  }

  /** Set (or clear) a company's ApprovalCFOUserID, then reload so the detail reflects it. */
  private async setCompanyCFO(companyID: string, userID: string | null, successMessage: string): Promise<void> {
    const md = new Metadata();
    const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(COMPANY_PROFILE_ENTITY);
    if (!(await acp.Load(companyID))) { this.setError('Could not load the company profile.'); return; }
    acp.ApprovalCFOUserID = userID;
    if (!(await acp.Save())) {
      this.setError(`Could not save the CFO: ${acp.LatestResult?.CompleteMessage ?? 'unknown error'}`);
      return;
    }
    this.ActionMessage = successMessage;
    this.ActionIsError = false;
    await this.loadCompanies();
    this._selectedID = companyID;
  }

  private beginSave(): void { this.Saving = true; this.ActionMessage = null; this.cdr.markForCheck(); }
  private endSave(): void { this.Saving = false; this.cdr.markForCheck(); }
  private setError(message: string): void { this.ActionMessage = message; this.ActionIsError = true; this.cdr.markForCheck(); }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadCompanySetupDashboard(): void {
  // No-op. Keeps @RegisterClass(BaseDashboard, 'CompanySetupDashboard') alive.
}
