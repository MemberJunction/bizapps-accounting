import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, Input, OnInit, OnDestroy } from '@angular/core';
import { RunView, RunViewParams } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { GridColumnConfig } from '@memberjunction/ng-entity-viewer';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { CompositeKey } from '@memberjunction/core';
import { openBizDetail, openBizCreate } from '../../shared/biz-detail-form';
import { GraphQLActionClient, GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { ActionParam } from '@memberjunction/actions-base';

const DIM_ENTITY = 'MJ_BizApps_Accounting: Dimensions';
const DIMVAL_ENTITY = 'MJ_BizApps_Accounting: Dimension Values';

/** The Business Central integration these dimensions are pulled from. */
const BC_INTEGRATION_NAME = 'business-central';
/** MJ action (from @memberjunction/integration-actions) that runs a Company Integration sync. */
const RUN_INTEGRATION_SYNC_ACTION = 'Run Integration Sync';
/**
 * The BC objects this page's Sync verb pulls. The nightly fan-out job deliberately runs the WHOLE
 * Company Integration (dimensions -> dimensionValues -> accounts, by entity-map Priority), but a
 * manual trigger should do only what its page is about — so we pass EntityMapIDs to
 * `Run Integration Sync`, which narrows the run. Pressing Sync here never re-pulls the chart of
 * accounts, and Boston's "Sync accounts" button is unaffected.
 */
const DIMENSION_OBJECT_NAMES: ReadonlyArray<string> = ['dimensions', 'dimensionValues'];

interface DimensionRow {
  ID: string;
  Code: string;
  Name: string;
  IsActive: boolean;
}

/**
 * Dimensions (UI plan §8.3) — Dimension + DimensionValue admin: a master list on the left, its
 * values on the right. Master/detail rather than one grid because a DimensionValue only means
 * anything in the context of its Dimension.
 *
 * Values use MJ's house grid (§8 MJ-wins); the master list is a short, always-visible picker (there
 * are a handful of dimensions, not thousands), so a full grid there would be ceremony.
 */
@Component({
  standalone: false,
  selector: 'mj-dimensions-page',
  templateUrl: './dimensions.page.html',
  styleUrls: ['./dimensions.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DimensionsPageComponent extends BaseAngularComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  /** The shell header's Refresh reaches this page while it is the mounted one. */
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;

  private forms = inject(MJFormPresenterService);

  public Dimensions: DimensionRow[] = [];
  public SelectedID: string | null = null;
  public IsLoading = false;
  public LoadError: string | null = null;
  /** One box over the master list: the code + name a human knows, plus the ID they may paste. */
  public Search = '';

  /** Shared busy/feedback state for the toolbar's Sync verb (mirrors the GL-accounts page). */
  public ActionBusy = false;
  public ActionMessage: string | null = null;
  /** 'Active' narrows the master list to active dimensions; 'All' shows everything. */
  public StatusFilter: 'Active' | 'All' = 'All';
  public readonly StatusChoices: ReadonlyArray<{ Label: string; Value: string }> = [
    { Label: 'All', Value: 'All' },
    { Label: 'Active only', Value: 'Active' },
  ];

  /** Monotonic counter from the category header's "New dimension" verb (Marcelo 2026-08-05). */
  private _createSignal = 0;
  @Input() set CreateSignal(v: number) {
    if (v > this._createSignal) {
      this._createSignal = v;
      this.CreateDimension();
    }
  }
  public ValueParams: RunViewParams = { EntityName: DIMVAL_ENTITY };

  public ValueColumns: GridColumnConfig[] = [
    { field: 'Code', title: 'Code', width: 140, sortable: true },
    { field: 'Name', title: 'Name', width: 'auto', sortable: true },
    { field: 'IsActive', title: 'Active', width: 90, sortable: true },
    { field: 'EffectiveFrom', title: 'From', width: 120, sortable: true },
    { field: 'EffectiveTo', title: 'To', width: 120, sortable: true },
    // The ID is meaningless to read but IS what a human copies into a filter or a bug report —
    // Code + Name above are how they find the row.
    { field: 'ID', title: 'ID', width: 280, sortable: true },
  ];

  ngOnInit(): void {
    this.subscribeToShellRefresh();
    void this.load();
  }

  public Refresh(): void {
    void this.load();
  }

  private subscribeToShellRefresh(): void {
    this.refreshSub = this.pageRefresh.OnRefresh(() => this.Refresh());
  }

  ngOnDestroy(): void {
    // Unsubscribing is what keeps the header's Refresh page-aware: a destroyed page stops counting.
    this.refreshSub?.unsubscribe();
  }

  public get Selected(): DimensionRow | null {
    return this.Dimensions.find((d) => d.ID === this.SelectedID) ?? null;
  }

  /**
   * The master list the rail shows. Filters CLIENT-SIDE over the dimensions already loaded — no
   * round-trip per keystroke, and no user-typed text anywhere near an `ExtraFilter`.
   */
  public get FilteredDimensions(): DimensionRow[] {
    const q = this.Search.trim().toLowerCase();
    const pool = this.StatusFilter === 'Active' ? this.Dimensions.filter((d) => d.IsActive) : this.Dimensions;
    if (!q) return pool;
    // Code + name lead — what a human knows. The ID matches too, for anyone pasting one.
    // Lowercased `includes`: a text match, not a UUID equality test.
    return pool.filter(
      (d) => d.Code.toLowerCase().includes(q) || d.Name.toLowerCase().includes(q) || d.ID.toLowerCase().includes(q),
    );
  }

  /** Open the dimension's own FORM in the standardized slide-in (read-only, edit on demand). */
  public OpenDetails(id: string): void {
    const row = this.Dimensions.find((d) => d.ID === id);
    const ref = openBizDetail(this.forms, {
      entityName: DIM_ENTITY,
      primaryKey: CompositeKey.FromID(id),
      title: row ? `Dimension ${row.Code} — ${row.Name}` : 'Dimension',
      mode: 'slide-in',
    });
    // AfterSaved resolves with the saved record (or null on plain close) — reload either way a save happened.
    void ref.AfterSaved().then((saved) => { if (saved) void this.load(); });
  }

  /** The category header's "New dimension" — a create form in the same slide-in surface. */
  public CreateDimension(): void {
    const ref = openBizCreate(this.forms, { entityName: DIM_ENTITY, title: 'New dimension', mode: 'slide-in' });
    void ref.AfterSaved().then((saved) => { if (saved) void this.load(); });
  }

  public OnSearchChanged(): void {
    this.cdr.markForCheck();
  }

  public Select(id: string): void {
    this.SelectedID = id;
    this.applyValueParams();
  }

  private applyValueParams(): void {
    this.ValueParams = {
      EntityName: DIMVAL_ENTITY,
      // No dimension selected → an impossible filter rather than ALL values: showing every value
      // across every dimension would be meaningless (codes only mean something within a dimension).
      ExtraFilter: this.SelectedID ? `DimensionID='${this.SelectedID}'` : `1=0`,
      OrderBy: 'Code ASC',
    };
    this.cdr.markForCheck();
  }

  private async load(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      const rv = RunView.FromMetadataProvider(this.ProviderToUse);
      const res = await rv.RunView<DimensionRow>(
        { EntityName: DIM_ENTITY, Fields: ['ID', 'Code', 'Name', 'IsActive'], OrderBy: 'DisplayOrder ASC, Code ASC', ResultType: 'simple' },
        this.ProviderToUse.CurrentUser,
      );
      if (!res.Success) throw new Error(res.ErrorMessage ?? 'could not load dimensions');
      this.Dimensions = res.Results ?? [];
      if (!this.SelectedID && this.Dimensions.length > 0) this.SelectedID = this.Dimensions[0].ID;
      this.applyValueParams();
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.Dimensions = [];
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  // ------------------------------------------------------------------ Business Central sync

  /**
   * Pulls Business Central dimensions + dimension values by invoking the 'Run Integration Sync' MJ
   * action against every active, credentialed Business Central company integration — mirroring the
   * nightly fan-out job, so the button syncs all companies rather than one.
   *
   * Scoped with EntityMapIDs to this page's two entity maps, so it never re-pulls GL accounts.
   */
  public async RunSync(): Promise<void> {
    if (this.ActionBusy) return;
    this.ActionBusy = true;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      const rv = new RunView();
      const integration = await rv.RunView<{ ID: string }>({
        EntityName: 'MJ: Integrations',
        ExtraFilter: `Name='${BC_INTEGRATION_NAME}'`,
        Fields: ['ID'], ResultType: 'simple', MaxRows: 1,
      });
      if (!integration.Success || integration.Results.length === 0) {
        this.ActionMessage = `Business Central integration ('${BC_INTEGRATION_NAME}') is not registered in this environment.`;
        return;
      }
      const integrationID = integration.Results[0].ID;

      const entityMapIDs = await this.loadDimensionEntityMapIDs(rv, integrationID);
      if (entityMapIDs.length === 0) {
        this.ActionMessage = 'No dimension entity maps are configured for Business Central.';
        return;
      }

      const cis = await rv.RunView<{ ID: string; Name: string }>({
        EntityName: 'MJ: Company Integrations',
        ExtraFilter: `IntegrationID='${integrationID}' AND IsActive=1 AND CredentialID IS NOT NULL`,
        Fields: ['ID', 'Name'], OrderBy: 'Name', ResultType: 'simple',
      });
      if (!cis.Success) {
        this.ActionMessage = `Could not load Business Central company integrations: ${cis.ErrorMessage}`;
        return;
      }
      if (cis.Results.length === 0) {
        this.ActionMessage = 'No active, credentialed Business Central company integrations to sync.';
        return;
      }

      const act = await rv.RunView<{ ID: string }>({
        EntityName: 'MJ: Actions',
        ExtraFilter: `Name='${RUN_INTEGRATION_SYNC_ACTION}'`,
        Fields: ['ID'], ResultType: 'simple', MaxRows: 1,
      });
      if (!act.Success || act.Results.length === 0) {
        this.ActionMessage = `The '${RUN_INTEGRATION_SYNC_ACTION}' action is not installed on this server.`;
        return;
      }

      const client = new GraphQLActionClient(GraphQLDataProvider.Instance);
      const failures: string[] = [];
      for (const ci of cis.Results) {
        const failure = await this.runDimensionSyncForCompany(client, act.Results[0].ID, ci, entityMapIDs);
        if (failure) failures.push(failure);
      }

      const total = cis.Results.length;
      const succeeded = total - failures.length;
      this.ActionMessage = failures.length === 0
        ? `Dimension sync ran for ${total} company integration(s). Refreshing…`
        : `Dimension sync: ${succeeded}/${total} succeeded. Failed — ${failures.join('; ')}`;
      if (succeeded > 0) this.Refresh();
    } catch (err) {
      this.ActionMessage = `Sync error: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.ActionBusy = false;
      this.cdr.markForCheck();
    }
  }

  /** The entity-map IDs for this integration's dimension objects — what narrows the manual run. */
  private async loadDimensionEntityMapIDs(rv: RunView, integrationID: string): Promise<string[]> {
    const quoted = DIMENSION_OBJECT_NAMES.map((n) => `'${n}'`).join(',');
    const maps = await rv.RunView<{ ID: string }>({
      EntityName: 'MJ: Company Integration Entity Maps',
      ExtraFilter:
        `ExternalObjectName IN (${quoted}) AND Status='Active' AND CompanyIntegrationID IN ` +
        `(SELECT ID FROM __mj.vwCompanyIntegrations WHERE IntegrationID='${integrationID}')`,
      Fields: ['ID'], ResultType: 'simple',
    });
    return maps.Success ? (maps.Results ?? []).map((m) => m.ID) : [];
  }

  /** Runs the scoped sync for ONE company integration. Returns null on success, else "<name>: <error>". */
  private async runDimensionSyncForCompany(
    client: GraphQLActionClient,
    actionID: string,
    ci: { ID: string; Name: string },
    entityMapIDs: string[],
  ): Promise<string | null> {
    const params: ActionParam[] = [
      { Name: 'CompanyIntegrationID', Value: ci.ID, Type: 'Input' },
      { Name: 'FullSync', Value: 'true', Type: 'Input' },
      { Name: 'EntityMapIDs', Value: entityMapIDs.join(','), Type: 'Input' },
    ];
    try {
      const result = await client.RunAction(actionID, params);
      return result?.Success ? null : `${ci.Name}: ${result?.Message ?? 'unknown error'}`;
    } catch (err) {
      return `${ci.Name}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}
