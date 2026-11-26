import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CompositeKey, RunView, type RunViewParams } from '@memberjunction/core';
import type { mjBizAppsAccountingAccountingEngineExtensionEntity } from '@mj-biz-apps/accounting-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { NavigationService } from '@memberjunction/ng-shared';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { ERPSyncClient } from './erp-sync.client';
import type { ERPConnectionCardModel, ERPExtensionRowModel, ERPSyncCompanyResultModel } from '../../../widgets/erp-sync/erp-sync.types';
import type { ERPSyncRequest } from '../../../widgets/erp-sync/erp-sync-panel.component';

const CI_ENTITY = 'MJ: Company Integrations';
const EXT_ENTITY = 'MJ_BizApps_Accounting: Accounting Engine Extensions';
const RUN_ENTITY = 'MJ: Company Integration Runs';

@Component({
  standalone: false,
  selector: 'mj-erp-sync-page',
  templateUrl: './erp-sync.page.html',
  styleUrls: ['./accounting-dashboard.css', './erp-sync.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ERPSyncPageComponent extends BaseAngularComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private pageRefresh = inject(PageRefreshService);
  private nav = inject(NavigationService);
  public Scope = inject(CompanyScopeService);
  private refreshSub: { unsubscribe: () => void } | null = null;

  public Connections: ERPConnectionCardModel[] = [];
  public Extensions: ERPExtensionRowModel[] = [];
  public Results: ERPSyncCompanyResultModel[] = [];
  public IsLoading = false;
  public Running = false;
  public LoadError: string | null = null;

  ngOnInit(): void {
    this.refreshSub = this.pageRefresh.OnRefresh(() => { void this.Load(); });
    void this.Load();
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  private canReadEntity(entityName: string): boolean {
    const user = this.ProviderToUse?.CurrentUser;
    const info = this.ProviderToUse?.EntityByName?.(entityName);
    if (!info || !user) return true;
    return info.GetUserPermisions(user)?.CanRead ?? false;
  }

  public async Load(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      const provider = this.ProviderToUse;
      const user = provider.CurrentUser;
      const rv = RunView.FromMetadataProvider(provider);

      const canReadCI = this.canReadEntity(CI_ENTITY);
      const canReadRuns = this.canReadEntity(RUN_ENTITY);
      const batch: RunViewParams[] = [];
      let ciIndex = -1;
      let runsIndex = -1;
      if (canReadCI) {
        ciIndex = batch.length;
        batch.push({
          EntityName: CI_ENTITY,
          ExtraFilter: 'IsActive = 1',
          Fields: ['ID', 'CompanyID', 'Company', 'Integration', 'IsActive'],
          ResultType: 'simple',
        });
      }
      if (canReadRuns) {
        runsIndex = batch.length;
        batch.push({
          EntityName: RUN_ENTITY,
          Fields: ['CompanyIntegrationID', 'Status', 'StartedAt', 'ErrorMessage'],
          OrderBy: 'StartedAt DESC',
          MaxRows: 50,
          ResultType: 'simple',
        });
      }

      const [viewResults] = await Promise.all([
        batch.length > 0 ? rv.RunViews(batch, user) : Promise.resolve([]),
        AccountingEngineBase.Instance.Config(false, user, provider),
      ]);

      const ciRows = (ciIndex >= 0 ? (viewResults[ciIndex]?.Results ?? []) : []) as Array<Record<string, string | boolean | Date | null>>;
      const runRows = (runsIndex >= 0 ? (viewResults[runsIndex]?.Results ?? []) : []) as Array<Record<string, string | Date | null>>;

      const latestByCI = new Map<string, Record<string, string | Date | null>>();
      for (const r of runRows) {
        const id = String(r.CompanyIntegrationID ?? '');
        if (id && !latestByCI.has(id)) latestByCI.set(id, r);
      }
      const scoped = this.Scope.SelectedIDs;
      this.Connections = ciRows
        .filter((row) => scoped.length === 0 || scoped.includes(String(row.CompanyID)))
        .map((row) => {
          const last = latestByCI.get(String(row.ID));
          return {
            CompanyIntegrationID: String(row.ID),
            CompanyID: String(row.CompanyID),
            CompanyName: String(row.Company ?? row.CompanyID),
            IntegrationName: String(row.Integration ?? 'ERP'),
            IsActive: row.IsActive !== false,
            LastRunStatus: last ? String(last.Status ?? '') : null,
            LastRunAt: last?.StartedAt ? new Date(last.StartedAt) : null,
            LastError: last?.ErrorMessage ? String(last.ErrorMessage) : null,
          };
        });

      const cachedExtensions = this.canReadEntity(EXT_ENTITY)
        ? AccountingEngineBase.Instance.AccountingEngineExtensions
        : [];
      this.Extensions = [...cachedExtensions]
        .sort((a, b) => (a.Sequence - b.Sequence) || (a.Name ?? '').localeCompare(b.Name ?? ''))
        .map((ext) => ({
          ID: ext.ID,
          Code: ext.Code,
          Name: ext.Name,
          Description: ext.Description,
          DriverClass: ext.DriverClass,
          Status: ext.Status,
          Sequence: ext.Sequence,
          CompanyID: ext.CompanyID,
          Company: ext.Company,
        }));
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  public async OnRun(req: ERPSyncRequest): Promise<void> {
    this.Running = true;
    this.cdr.markForCheck();
    const client = new ERPSyncClient(this.ProviderToUse as GraphQLDataProvider);
    const companyIds = req.CompanyIDs ?? (this.Scope.SelectedIDs.length > 0 ? this.Scope.SelectedIDs : undefined);
    const out = await client.RunERPSync({ Objects: req.Objects, CompanyIDs: companyIds });
    this.Results = out.Results;
    this.Running = false;
    await this.Load();
  }

  public OnRunCard(card: ERPConnectionCardModel): void {
    void this.OnRun({ Objects: ['accounts', 'dimensions', 'dimensionValues'], CompanyIDs: [card.CompanyID] });
  }

  public OpenCompany(card: ERPConnectionCardModel): void {
    this.nav.OpenEntityRecord('MJ: Companies', CompositeKey.FromID(card.CompanyID));
  }

  public OpenIntegration(card: ERPConnectionCardModel): void {
    this.nav.OpenEntityRecord(CI_ENTITY, CompositeKey.FromID(card.CompanyIntegrationID));
  }

  public OpenExtension(ext: ERPExtensionRowModel): void {
    this.nav.OpenEntityRecord(EXT_ENTITY, CompositeKey.FromID(ext.ID));
  }

  public async ToggleExtension(ext: ERPExtensionRowModel): Promise<void> {
    const md = this.ProviderToUse;
    const rec = await md.GetEntityObject<mjBizAppsAccountingAccountingEngineExtensionEntity>(EXT_ENTITY, md.CurrentUser);
    if (!(await rec.Load(ext.ID))) return;
    rec.Status = ext.Status === 'Active' ? 'Disabled' : 'Active';
    await rec.Save();
    await this.Load();
  }
}
