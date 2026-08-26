import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, Input, OnInit, OnDestroy } from '@angular/core';
import { RunView, RunViewParams } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { GridColumnConfig } from '@memberjunction/ng-entity-viewer';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { CompositeKey } from '@memberjunction/core';
import { openBizDetail, openBizCreate } from '../../shared/biz-detail-form';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { DimensionSyncClient, DimensionSyncResult } from './dimension-sync.client';

const DIM_ENTITY = 'MJ_BizApps_Accounting: Dimensions';
const DIMVAL_ENTITY = 'MJ_BizApps_Accounting: Dimension Values';


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
   * Pulls Business Central dimensions + dimension values.
   *
   * Everything real happens server-side in the 'Accounting.RunBusinessCentralSync' Remote Operation
   * (→ BusinessCentralSyncEngine): resolving the integration, fanning out across every active,
   * credentialed company integration, narrowing to this page's objects, and the fetch/mapping/upsert
   * itself. This method awaits that one call, says what happened, and refreshes the view.
   */
  public async RunSync(): Promise<void> {
    if (this.ActionBusy) return;
    this.ActionBusy = true;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      const result = await new DimensionSyncClient(GraphQLDataProvider.Instance).SyncDimensions();
      this.ActionMessage = this.describeSync(result);
      if ((result.Summary?.Succeeded ?? 0) > 0) this.Refresh();
    } finally {
      this.ActionBusy = false;
      this.cdr.markForCheck();
    }
  }

  /** Turns the operation's counts into the toolbar message. Presentation belongs here, not in the client. */
  private describeSync(result: DimensionSyncResult): string {
    if (!result.Success || !result.Summary) {
      return `Sync error: ${result.ErrorMessage ?? 'unknown error'}`;
    }
    const s = result.Summary;
    if (s.SkipReason) return s.SkipReason;

    const counts = `${s.RecordsProcessed} processed, ${s.RecordsCreated} created, ${s.RecordsUpdated} updated`;
    if (s.Failed === 0) {
      return `Dimension sync ran for ${s.CompanyIntegrationCount} company integration(s) — ${counts}.`;
    }
    const failures = (s.Outcomes ?? [])
      .filter((o) => o.Status === 'error')
      .map((o) => `${o.CompanyIntegrationName}: ${o.ErrorMessage ?? 'unknown error'}`)
      .join('; ');
    return `Dimension sync: ${s.Succeeded}/${s.CompanyIntegrationCount} succeeded (${counts}). Failed — ${failures}`;
  }
}
