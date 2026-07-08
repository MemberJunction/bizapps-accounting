import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { RegisterClass } from '@memberjunction/global';
import { CompositeKey, RunView } from '@memberjunction/core';
import { ResourceData } from '@memberjunction/core-entities';
import { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';

const COMPANY_PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

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
    const res = await rv.RunView<CompanyProfileRow>({
      EntityName: COMPANY_PROFILE_ENTITY,
      Fields: [
        'ID', 'Name', 'CompanyCode', 'EntityType', 'LegalStructureType',
        'FunctionalCurrencyCode', 'ReportingCurrencyCode', 'FiscalYearStartMonth', 'FiscalYearStartDay', 'IsActive',
        'AROpenGLAccountID', 'AROpenGLAccount',
        'DeferredRevenueGLAccountID', 'DeferredRevenueGLAccount',
        'SalesTaxPayableGLAccountID', 'SalesTaxPayableGLAccount',
        'RealizedFXGainLossGLAccountID', 'RealizedFXGainLossGLAccount',
        'UnrealizedFXGainLossGLAccountID', 'UnrealizedFXGainLossGLAccount',
      ],
      OrderBy: 'Name ASC',
      MaxRows: 1000,
      ResultType: 'simple',
    });
    if (!res.Success) throw new Error(res.ErrorMessage ?? 'Failed to load company profiles.');
    this.Companies = res.Results ?? [];
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
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadCompanySetupDashboard(): void {
  // No-op. Keeps @RegisterClass(BaseDashboard, 'CompanySetupDashboard') alive.
}
