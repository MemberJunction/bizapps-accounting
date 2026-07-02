/**
 * ReadModelDashboardBase — shared base for the four Stage-2 read-model dashboards.
 *
 * They all share the same shape: a company selector (accounting-enabled companies =
 * those that have an AccountingCompanyProfile, an IsA child of Company sharing its PK),
 * a loading/error lifecycle, and a thin ReadModelsClient bound to the active provider.
 * Subclasses implement `loadModel()` to fetch their specific view(s) for the selected
 * company. BaseDashboard.ngOnInit() calls NotifyLoadComplete() after loadData() resolves.
 */
import { ChangeDetectorRef, Directive, inject } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { ResourceData } from '@memberjunction/core-entities';
import { RunView } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { MjButtonVariant } from '@memberjunction/ng-ui-components';
import { ReadModelsClient } from './read-models.client';

/** One selectable accounting-enabled company. */
export interface CompanyOption {
  ID: string;
  Name: string;
}

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const COMPANY_ENTITY = 'MJ: Companies';

@Directive() // Angular requires a decorator on a base with DI / lifecycle; never instantiated directly.
export abstract class ReadModelDashboardBase extends BaseDashboard {
  public IsLoading = false;
  public LoadError: string | null = null;
  public Companies: CompanyOption[] = [];
  public SelectedCompanyID: string | null = null;

  protected cdr = inject(ChangeDetectorRef);

  /** The display name shown in the dashboard's resource header. */
  abstract get DashboardTitle(): string;

  /** Fetch this dashboard's view data for the currently-selected company. */
  protected abstract loadModel(companyID: string): Promise<void>;

  /** Reset this dashboard's view data (called when no company is selectable). */
  protected abstract clearModel(): void;

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return this.DashboardTitle;
  }

  protected initDashboard(): void {
    // One-time setup; data loads in loadData(). No persisted UI state for v1.
  }

  protected async loadData(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    try {
      await this.loadCompanies();
      if (!this.SelectedCompanyID && this.Companies.length > 0) {
        this.SelectedCompanyID = this.Companies[0].ID;
      }
      if (this.SelectedCompanyID) {
        await this.loadModel(this.SelectedCompanyID);
      } else {
        this.clearModel();
      }
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  public async OnCompanyChange(companyID: string): Promise<void> {
    this.SelectedCompanyID = companyID;
    this.LoadError = null;
    this.IsLoading = true;
    this.cdr.markForCheck();
    try {
      await this.loadModel(companyID);
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  /** Re-run the whole load (refresh button). */
  public async Reload(): Promise<void> {
    await this.loadData();
  }

  /**
   * Typed mjButton variant for a tab toggle (`primary` when active, `flat` otherwise).
   * strictTemplates needs the `MjButtonVariant` union, not an inline string literal — so
   * tab buttons bind `[variant]="TabVariant(active)"` instead of a ternary in the template.
   */
  public TabVariant(active: boolean): MjButtonVariant {
    return active ? 'primary' : 'flat';
  }

  // ─── plumbing ────────────────────────────────────────────────────────────

  /** A new read-model client bound to the active provider (multi-provider aware via ProviderToUse). */
  protected client(): ReadModelsClient {
    return new ReadModelsClient(this.ProviderToUse as GraphQLDataProvider);
  }

  private runView(): RunView {
    return RunView.FromMetadataProvider(this.ProviderToUse);
  }

  private contextUser() {
    return this.ProviderToUse.CurrentUser;
  }

  /** Accounting-enabled companies = those with an AccountingCompanyProfile (same PK as the Company). */
  private async loadCompanies(): Promise<void> {
    const rv = this.runView();
    const acpRes = await rv.RunView<{ ID: string }>(
      { EntityName: ACP_ENTITY, Fields: ['ID'], OrderBy: 'ID ASC', ResultType: 'simple' },
      this.contextUser(),
    );
    const ids = acpRes.Success ? (acpRes.Results ?? []).map(r => r.ID) : [];
    if (ids.length === 0) { this.Companies = []; return; }

    const inList = ids.map(id => `'${id}'`).join(',');
    const coRes = await rv.RunView<{ ID: string; Name: string }>(
      { EntityName: COMPANY_ENTITY, ExtraFilter: `ID IN (${inList})`, Fields: ['ID', 'Name'], OrderBy: 'Name ASC', ResultType: 'simple' },
      this.contextUser(),
    );
    this.Companies = coRes.Success ? (coRes.Results ?? []).map(c => ({ ID: c.ID, Name: c.Name })) : [];
  }
}
