import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { RegisterClass } from '@memberjunction/global';
import { CompositeKey, Metadata, RunView, UserInfo } from '@memberjunction/core';
import { ResourceData } from '@memberjunction/core-entities';
import { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import { mjBizAppsCommonPersonEntity } from '@mj-biz-apps/common-entities';

const COMPANY_PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const PERSON_ENTITY = 'MJ_BizApps_Common: People';

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
  // Default GL accounts — denormalized names + their FK IDs (ID null ⇒ "not set").
  AROpenGLAccountID: string | null;
  AROpenGLAccount: string | null;
  DeferredRevenueGLAccountID: string | null;
  DeferredRevenueGLAccount: string | null;
  SalesTaxPayableGLAccountID: string | null;
  SalesTaxPayableGLAccount: string | null;
  RealizedFXGainLossGLAccountID: string | null;
  RealizedFXGainLossGLAccount: string | null;
  UnrealizedFXGainLossGLAccountID: string | null;
  UnrealizedFXGainLossGLAccount: string | null;
  // CFO approver (the bizapps-tasks approval gate assigns batch-approval Tasks to this Person).
  ApprovalCFOPersonID: string | null;
  ApprovalCFOPerson: string | null;
}

/** A selectable Person for the CFO picker. */
interface PersonOption {
  ID: string;
  Name: string;
  LinkedUserID: string | null;
}

/** One "default GL account" display slot for the detail card. */
interface DefaultAccountSlot {
  Label: string;
  ID: string | null;
  Name: string | null;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Company Setup — a read-only, navigational hub for the deployment's accounting company profiles.
 *
 * Loads all Accounting Company Profiles, lists them on the left, and shows a read-only detail card on
 * the right for the selected company: identity + fiscal + currency settings and the five default GL
 * accounts (each shown by its denormalized name, or "— not set" when unassigned). An "Open profile"
 * button opens the generated profile form (via OpenEntityRecord) for editing. No inline editing in v1.
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

  public IsBusy = false;
  public LoadError: string | null = null;

  public Companies: CompanyProfileRow[] = [];
  public People: PersonOption[] = [];

  // ─── CFO assignment state ────────────────────────────────────────────────────
  public SelectedPersonID = '';
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
    const [companies, people] = await rv.RunViews([
      {
        EntityName: COMPANY_PROFILE_ENTITY,
        Fields: [
          'ID', 'Name', 'CompanyCode', 'EntityType', 'LegalStructureType',
          'FunctionalCurrencyCode', 'ReportingCurrencyCode', 'FiscalYearStartMonth', 'FiscalYearStartDay', 'IsActive',
          'AROpenGLAccountID', 'AROpenGLAccount',
          'DeferredRevenueGLAccountID', 'DeferredRevenueGLAccount',
          'SalesTaxPayableGLAccountID', 'SalesTaxPayableGLAccount',
          'RealizedFXGainLossGLAccountID', 'RealizedFXGainLossGLAccount',
          'UnrealizedFXGainLossGLAccountID', 'UnrealizedFXGainLossGLAccount',
          'ApprovalCFOPersonID', 'ApprovalCFOPerson',
        ],
        OrderBy: 'Name ASC',
        MaxRows: 1000,
        ResultType: 'simple',
      },
      { EntityName: PERSON_ENTITY, Fields: ['ID', 'DisplayName', 'FirstName', 'LastName', 'LinkedUserID'], OrderBy: 'LastName ASC, FirstName ASC', MaxRows: 500, ResultType: 'simple' },
    ]);
    if (!companies.Success) throw new Error(companies.ErrorMessage ?? 'Failed to load company profiles.');
    this.Companies = (companies.Results ?? []) as CompanyProfileRow[];
    this.People = ((people.Results ?? []) as Array<{ ID: string; DisplayName: string | null; FirstName: string; LastName: string; LinkedUserID: string | null }>)
      .map(p => ({ ID: p.ID, Name: p.DisplayName?.trim() || `${p.FirstName} ${p.LastName}`.trim(), LinkedUserID: p.LinkedUserID }));
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

  /** The five default GL account slots for the selected company. */
  public get DefaultAccounts(): DefaultAccountSlot[] {
    const c = this.Selected;
    if (!c) return [];
    return [
      { Label: 'AR Open', ID: c.AROpenGLAccountID, Name: c.AROpenGLAccount },
      { Label: 'Deferred Revenue', ID: c.DeferredRevenueGLAccountID, Name: c.DeferredRevenueGLAccount },
      { Label: 'Sales Tax Payable', ID: c.SalesTaxPayableGLAccountID, Name: c.SalesTaxPayableGLAccount },
      { Label: 'Realized FX Gain/Loss', ID: c.RealizedFXGainLossGLAccountID, Name: c.RealizedFXGainLossGLAccount },
      { Label: 'Unrealized FX Gain/Loss', ID: c.UnrealizedFXGainLossGLAccountID, Name: c.UnrealizedFXGainLossGLAccount },
    ];
  }

  // ─── actions ──────────────────────────────────────────────────────────────────

  public OpenProfile(): void {
    const c = this.Selected;
    if (!c) return;
    this.OpenEntityRecord.emit({ EntityName: COMPANY_PROFILE_ENTITY, RecordPKey: CompositeKey.FromID(c.ID) });
  }

  // ─── CFO assignment ─────────────────────────────────────────────────────────

  /** The selected company's current CFO approver name, or null when unassigned. */
  public get CurrentCFO(): string | null {
    return this.Selected?.ApprovalCFOPerson ?? null;
  }

  public get CanAssignSelected(): boolean {
    return !!this.Selected && !!this.SelectedPersonID && !this.Saving;
  }

  /**
   * Make the CURRENT logged-in user the CFO of the selected company — robust to sign-in method
   * (magic link or otherwise). Finds or creates a Person linked to the current user
   * (Person.LinkedUserID == user.ID), then assigns it as the company's approver. The server's
   * approval gate resolves the same link when attributing decisions, so "approve as me" works.
   */
  public async MakeMeCFO(): Promise<void> {
    const company = this.Selected;
    if (!company || this.Saving) return;
    this.beginSave();
    try {
      const user = this.ProviderToUse.CurrentUser;
      if (!user) { this.setError('No current user is available.'); return; }
      const personId = await this.findOrCreateSelfPerson(user);
      if (!personId) return;
      await this.setCompanyCFO(company.ID, personId, `You are now the CFO approver for ${company.Name}.`);
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.endSave();
    }
  }

  /** Assign an existing Person (picked from the dropdown) as the selected company's CFO. */
  public async AssignSelectedCFO(): Promise<void> {
    const company = this.Selected;
    if (!company || !this.SelectedPersonID || this.Saving) return;
    this.beginSave();
    try {
      const person = this.People.find(p => p.ID === this.SelectedPersonID);
      await this.setCompanyCFO(company.ID, this.SelectedPersonID, `CFO approver set to ${person?.Name ?? 'the selected person'} for ${company.Name}.`);
      this.SelectedPersonID = '';
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

  /** Find the Person linked to this user (LinkedUserID), or create one from the user's identity. */
  private async findOrCreateSelfPerson(user: UserInfo): Promise<string | null> {
    const existing = this.People.find(p => p.LinkedUserID && p.LinkedUserID.toUpperCase() === user.ID.toUpperCase());
    if (existing) return existing.ID;

    const md = new Metadata();
    const person = await md.GetEntityObject<mjBizAppsCommonPersonEntity>(PERSON_ENTITY);
    person.NewRecord();
    person.FirstName = user.FirstName?.trim() || user.Name?.split(' ')[0]?.trim() || 'Test';
    person.LastName = user.LastName?.trim() || user.Name?.split(' ').slice(1).join(' ').trim() || 'User';
    person.Email = user.Email || `${user.ID}@mjdev.local`;
    person.LinkedUserID = user.ID;
    if (!(await person.Save())) {
      this.setError(`Could not create your Person record: ${person.LatestResult?.CompleteMessage ?? 'unknown error'}`);
      return null;
    }
    return person.ID;
  }

  /** Set (or clear) a company's ApprovalCFOPersonID, then reload so the detail reflects it. */
  private async setCompanyCFO(companyID: string, personID: string | null, successMessage: string): Promise<void> {
    const md = new Metadata();
    const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(COMPANY_PROFILE_ENTITY);
    if (!(await acp.Load(companyID))) { this.setError('Could not load the company profile.'); return; }
    acp.ApprovalCFOPersonID = personID;
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
