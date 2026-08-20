import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, Input, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { UUIDsEqual, NormalizeUUID } from '@memberjunction/global';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { RunView, RunViewParams } from '@memberjunction/core';
import type { MJScheduledJobEntity } from '@memberjunction/core-entities';
import { GridColumnConfig, EntityDataGridComponent } from '@memberjunction/ng-entity-viewer';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { rowKeyToId } from '../../../transfer-pending/list-scaffold/grid-row-key';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import type { mjBizAppsAccountingGLAccountEntity } from '@mj-biz-apps/accounting-entities';
import { GraphQLActionClient, GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import type { ActionParam } from '@memberjunction/actions-base';

/** Name of the erp-account-sync Company Integration that pulls GL accounts from Business Central. */
const BC_INTEGRATION_NAME = 'business-central';
/** MJ action (from @memberjunction/integration-actions) that runs a Company Integration sync. */
const RUN_INTEGRATION_SYNC_ACTION = 'Run Integration Sync';
/** DriverClass of the app's nightly BC fan-out scheduled job — used to find its job row for notification settings. */
const BC_FANOUT_DRIVER_CLASS = 'BizAppsAccountingBCFanOutSyncDriver';

const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

/** Derived from the entity — a widened CHECK constraint breaks the build here, by design. */
type AccountType = mjBizAppsAccountingGLAccountEntity['AccountType'];
type ParentID = mjBizAppsAccountingGLAccountEntity['ParentGLAccountID'];

/** The four account-type values, for the filter + the editor. Derived, never hand-listed as a type. */
const ACCOUNT_TYPES: readonly AccountType[] = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

/**
 * One row of the chart, already positioned in its company's rollup tree.
 *
 * `Depth` is what makes `ParentGLAccountID` — otherwise an invisible uniqueidentifier — legible:
 * a child is indented under its parent. `IsOrphan` / `InCycle` mark rows whose parent pointer is
 * broken; they are surfaced as roots WITH a marker rather than dropped, because a dropped row is a
 * chart that silently lies about its own contents.
 */
interface AccountRow {
  ID: string;
  CompanyID: string;
  Company: string;
  Code: string;
  Name: string;
  AccountType: AccountType;
  ParentGLAccountID: ParentID;
  ParentLabel: string | null;
  CurrencyCode: string | null;
  ExternalSystem: string | null;
  ExternalAccountID: string | null;
  IsActive: boolean;
  IsSystemSeeded: boolean;
  Description: string | null;
  Depth: number;
  /** Parent pointer names an account that isn't in this chart (or isn't visible). */
  IsOrphan: boolean;
  /** Parent chain loops back on itself — bad data; shown as a root so the page cannot hang. */
  InCycle: boolean;
}

/** The editor's working copy. Kept separate from the entity so a cancel is a genuine no-op. */
/** Filter option for the company drop-down. */
interface CompanyOption {
  ID: string;
  Name: string;
}

/** The parent picker's options — one company's own chart, self + descendants removed. */
interface ParentOption {
  ID: string;
  Label: string;
}

/** A read-only projection of MJ: Company Integration Runs for the sync-log panel. */
interface SyncRunRow {
  ID: string;
  Company: string | null;
  Status: string | null;
  StartedAt: string | null;
  TotalRecords: number | null;
  ErrorLog: string | null;
}

/** One per-record failure parsed out of CompanyIntegrationRun.ErrorLog (a SyncRecordError). */
interface SyncLogError {
  ExternalID?: string;
  ChangeType?: string;
  ErrorMessage: string;
  ErrorCode?: string;
  Severity?: string;
}

/** One option in the failure-notification recipient dropdown. `ID: null` = the "No one" sentinel. */
interface NotifyUserOption {
  ID: string | null;
  Label: string;
}

/** A sync run as shown in the log panel — run summary plus its parsed per-record failures. */
interface SyncLogRun {
  ID: string;
  Company: string;
  Status: string;
  StartedDisplay: string;
  TotalRecords: number;
  ErrorCount: number;
  Errors: SyncLogError[];
  /** Set when ErrorLog is a plain string (fatal/cancel) rather than the per-record array. */
  RawError: string | null;
  Expanded: boolean;
}

/**
 * GL accounts — view and manage every account, across every company the user can see.
 *
 * **The shape this page has to make legible (Marcelo 2026-07-16 expected something different):**
 * `GLAccount.CompanyID` is **NOT NULL** with **UNIQUE (CompanyID, Code)** — "each company has its
 * own chart" (the field's own description). There is **no global pool of unowned accounts** that
 * you then "hook to companies": an account is born inside exactly one company's chart, seeded by
 * `spSeedDefaultChartOfAccounts` (which is what `IsSystemSeeded` distinguishes from deployment
 * customizations). So this page is "every account, GROUPED BY COMPANY" — the Company column is
 * first, the company drop-down narrows rather than assigns, and creating an account REQUIRES
 * picking the company that will own it. That per-company reality is surfaced, not hidden. Whether
 * a shared/global pool is ever wanted is Q29 in plans/QUESTIONS.md — and it would be a migration,
 * not a UI change.
 *
 * **ERP direction is OUTBOUND.** `ExternalSystem` + `ExternalAccountID` map MJ's account OUT to the
 * ERP's account: MJ's copy is the record, the ERP is the mirror target. The two columns sit
 * together so "which system is this connected to?" reads at a glance.
 *
 * **Parent = rollup within ONE company's own chart** ("Parent account for hierarchical rollup
 * (NULL = top of chart)"), e.g. 11200 Cash parents 11201 Cash — Operating. The picker therefore
 * offers only the same company's accounts, minus the account itself and its own descendants (a
 * cycle would break rollup), and the list indents children under parents so the structure is
 * visible without opening anything.
 *
 * Data comes from `AccountingEngineBase`'s cache (`Config` is a no-op once loaded) — never one
 * query per row.
 */
@Component({
  standalone: false,
  selector: 'mj-gl-accounts-page',
  templateUrl: './gl-accounts.page.html',
  styleUrls: ['./shell-table.css', './gl-accounts.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GLAccountsPageComponent extends BaseAngularComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  /** The shell header's Refresh reaches this page while it is the mounted one — the page adds none of its own. */
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;

  /** The app-wide company scope (the rail-top chip) — the shared source, not a new one. */
  public Scope = inject(CompanyScopeService);

  public Rows: AccountRow[] = [];
  public CompanyOptions: CompanyOption[] = [];
  public CurrencyOptions: Array<{ Code: string; Name: string }> = [];
  public AccountTypes = ACCOUNT_TYPES;

  public IsLoading = false;
  public LoadError: string | null = null;

  /** Shared busy/feedback state for the toolbar's Sync verb. */
  public ActionBusy = false;
  public ActionMessage: string | null = null;

  /** Business Central sync-log panel state (why records failed to pull). */
  public ShowSyncLog = false;
  public SyncLogLoading = false;
  public SyncLogError: string | null = null;
  public SyncLogRuns: SyncLogRun[] = [];

  /**
   * Failure-notification recipient for the nightly BC fan-out job. The recipient lives on the
   * MJ: Scheduled Jobs row (NotifyUserID + channel flags); this lets an accounting admin set it
   * in-app instead of hand-editing metadata. One recipient (MJ's native job model).
   */
  public ShowNotifySettings = false;
  public NotifyJobID: string | null = null;
  public NotifyRecipientID: string | null = null;
  /** The recipient actually persisted on the job — drives the "currently notifying" line, which
   *  stays put until the user Saves (distinct from the editable NotifyRecipientID). */
  public NotifySavedRecipientID: string | null = null;
  public NotifyViaEmail = false;
  public NotifyViaInApp = true;
  public NotifyUserOptions: NotifyUserOption[] = [];
  public NotifySaving = false;
  public NotifyMessage: string | null = null;
  /** "No one" sentinel for the recipient dropdown — clears NotifyUserID so no failure alert is sent.
   *  Typed as the mj-dropdown DefaultItem shape (Record<string, unknown>); ID:null clears the value. */
  public readonly NotifyNoneDefault: Record<string, unknown> = { ID: null, Label: '— No one (no failure alert) —' };

  // --- filters (one line; search sits to the right of the drop-downs) ---
  /** MULTI-select company narrowing (Marcelo 2026-08-05): empty = no narrowing ("All companies"). */
  public FilterCompanyIDs: string[] = [];
  public FilterAccountType = '';
  /** '' = any, 'Active' | 'Inactive'. */
  public FilterActive = '';

  /** The checkbox-dropdown hands back the whole selection (client-side filter — no refetch needed). */
  public OnFilterCompanyIDsChanged(ids: string[]): void {
    this.FilterCompanyIDs = ids;
    this.rebuildGridParams();
  }

  /** Currency rows shaped for the dropdown ("USD — US Dollar"). */
  public get CurrencyChoices(): ReadonlyArray<{ Code: string; Label: string }> {
    return this.CurrencyOptions.map((c) => ({ Code: c.Code, Label: `${c.Code} — ${c.Name}` }));
  }

  /** The editor dropdowns' empty-state rows (mj-dropdown DefaultItem = the '' sentinel each select had). */
  public readonly OwningCompanyDefault = { ID: '', Name: 'Choose the owning company…' };
  public readonly ParentNoneDefault = { ID: '', Label: 'None — top of the chart' };
  public readonly CurrencyDefault = { Code: '', Label: 'Company’s functional currency' };

  public readonly StatusChoices: ReadonlyArray<{ Label: string; Value: string }> = [
    { Label: 'Active & inactive', Value: '' },
    { Label: 'Active only', Value: 'Active' },
    { Label: 'Inactive only', Value: 'Inactive' },
  ];

  public readonly SourceChoices: ReadonlyArray<{ Label: string; Value: string }> = [
    { Label: 'Seeded & custom', Value: '' },
    { Label: 'System-seeded', Value: 'Seeded' },
    { Label: 'Custom', Value: 'Custom' },
  ];
  /** '' = any, 'Seeded' = platform-shipped, 'Custom' = deployment customization. */
  public FilterSource = '';
  public SearchText = '';

  // ─── list-page standard chrome (fused subheader: strip + toolbar) ────────────

  /** The strip's figures — the same counts the old header badges carried. */
  public get SummaryFigures(): Array<{ Label: string; Value: string; Tone?: 'default' | 'credit' | 'muted' | 'success' | 'warning' | 'danger' | 'info' }> {
    const figures: Array<{ Label: string; Value: string; Tone?: 'default' | 'credit' | 'muted' | 'success' | 'warning' | 'danger' | 'info' }> = [
      { Label: 'Accounts', Value: String(this.Rows.length) },
      { Label: 'Companies', Value: String(this.CompanyOptions.length) },
    ];
    if (this.OrphanCount > 0) figures.push({ Label: 'Broken parents', Value: String(this.OrphanCount), Tone: 'warning' });
    return figures;
  }

  /** Account types as preset chips, with client-side counts — the fast path the selects buried. */
  public get TypeChips(): Array<{ Key: string; Label: string; Count?: number | null }> {
    return [
      { Key: 'all', Label: 'All' },
      ...this.AccountTypes.map((t) => ({ Key: t, Label: t, Count: this.Rows.filter((r) => r.AccountType === t).length })),
    ];
  }

  public get ActiveTypeKeys(): string[] {
    return this.FilterAccountType ? [this.FilterAccountType] : ['all'];
  }

  /** Single-select semantics (matching the old Type select): re-clicking the active chip clears. */
  public OnTypeToggled(key: string): void {
    this.FilterAccountType = key === 'all' || this.FilterAccountType === key ? '' : key;
    this.rebuildGridParams();
  }

  public AdvancedOpen = false;

  /** Count pill on the Filters button — a hidden active filter must never silently shape the list. */
  // ── the STANDARD MJ grid (Marcelo 2026-08-05) ─────────────────────────────────
  /** Escape a value for an ExtraFilter literal (single quotes doubled). */
  private sqlLit(v: string): string {
    return v.replace(/'/g, "''");
  }

  /**
   * The grid's query — the SAME predicate the old client-side filter applied, expressed as the
   * entity view's ExtraFilter so the standard grid owns fetching/sorting/paging/state.
   */
  public GridParams: RunViewParams = { EntityName: GL_ENTITY };

  /** The grid itself — needed because its Params setter DEEP-COMPARES and skips the refetch when
   *  the rebuilt params are equivalent (same filters/search). After a save, the predicate hasn't
   *  changed but the DATA has, so the refresh must be explicit. */
  @ViewChild(EntityDataGridComponent) private grid?: EntityDataGridComponent;

  public readonly GridColumns: GridColumnConfig[] = [
    // Company first, always: an account only exists inside a company's chart.
    { field: 'Company', title: 'Company', width: 180, sortable: true },
    { field: 'Code', title: 'Code', width: 110, sortable: true },
    { field: 'Name', title: 'Name', width: 'auto', maxWidth: 380, sortable: true },
    { field: 'AccountType', title: 'Type', width: 110, sortable: true },
    { field: 'CurrencyCode', title: 'Currency', width: 100, sortable: true },
    { field: 'ExternalSystem', title: 'External system', width: 140, sortable: true },
    { field: 'ExternalAccountID', title: 'External account ID', width: 160, sortable: true },
    { field: 'IsActive', title: 'Active', type: 'boolean', width: 90, sortable: true },
    { field: 'IsSystemSeeded', title: 'Seeded', type: 'boolean', width: 90, sortable: true },
    { field: 'ID', title: 'ID', width: 280, sortable: true },
  ];

  /** Rebuild the grid predicate from the toolbar state. New object identity triggers a refetch. */
  private rebuildGridParams(): void {
    const parts: string[] = [];
    if (this.FilterCompanyIDs.length) parts.push(`CompanyID IN (${this.FilterCompanyIDs.map((id) => `'${this.sqlLit(id)}'`).join(',')})`);
    if (this.FilterAccountType) parts.push(`AccountType='${this.sqlLit(this.FilterAccountType)}'`);
    if (this.FilterActive) parts.push(`IsActive=${this.FilterActive === 'Active' ? 1 : 0}`);
    if (this.FilterSource) parts.push(`IsSystemSeeded=${this.FilterSource === 'Seeded' ? 1 : 0}`);
    const q = this.SearchText.trim();
    if (q) {
      const like = this.sqlLit(q);
      parts.push(`(Name LIKE '%${like}%' OR Code LIKE '%${like}%' OR CAST(ID AS NVARCHAR(50)) LIKE '%${like}%')`);
    }
    const scope = this.Scope.FilterFor('CompanyID');
    if (scope) parts.push(scope);
    this.GridParams = {
      EntityName: GL_ENTITY,
      ExtraFilter: parts.length ? parts.join(' AND ') : undefined,
      OrderBy: 'Company ASC, Code ASC',
    };
    this.cdr.markForCheck();
  }

  /** Status/Source dropdowns re-query the grid like every other filter edit. */
  public OnStatusOrSourceChanged(): void {
    this.rebuildGridParams();
  }

  /** Row click = edit (the per-row Edit button retired with the hand-rolled table). The grid's
   *  rowKey is a CompositeKey concatenated string ('ID|<uuid>'), not a bare ID — parse it (same
   *  lesson the JE detail panel learned; see rowKeyToId). */
  public OnGridRowClicked(rowKey: string): void {
    const id = rowKeyToId(rowKey);
    if (!id) return;
    const row = this.Rows.find((r) => UUIDsEqual(r.ID, id));
    if (row) this.StartEdit(row);
  }

  public get AdvancedCount(): number {
    let n = 0;
    if (this.FilterCompanyIDs.length) n++;
    if (this.FilterActive) n++;
    if (this.FilterSource) n++;
    return n;
  }

  /** Client-side filtering — instant, no debounce needed. */
  public OnToolbarSearch(text: string): void {
    this.SearchText = text;
    this.rebuildGridParams();
  }

  // --- editor ---
  /**
   * The account being edited — the ENTITY, not a copy of one.
   *
   * This was an `AccountDraft`: eleven fields, every one a `GLAccount` column, filled by hand in two
   * places and copied back by `applyDraft`. Three statements of the same shape, and the compiler
   * could not see that they were meant to agree. Binding the entity means the form writes the record
   * it will save, and a column added to the table needs no second and third edit here.
   */
  public Draft: mjBizAppsAccountingGLAccountEntity | null = null;
  public IsSaving = false;
  public EditorError: string | null = null;
  /** The account being edited was seeded by the platform — worth knowing before you rename it. */
  public EditingSeeded = false;

  ngOnInit(): void {
    this.refreshSub = this.pageRefresh.OnRefresh(() => this.Refresh());
    this.rebuildGridParams(); // the grid queries immediately; the engine rows load alongside
    void this.load();
  }

  ngOnDestroy(): void {
    // A destroyed page stops answering the header's Refresh — that's what makes it page-aware.
    this.refreshSub?.unsubscribe();
  }

  public Refresh(): void {
    void this.load(true);
    void this.grid?.Refresh(); // header Refresh must refetch the grid too — unchanged params won't
  }

  // ------------------------------------------------------------------ integration + clear verbs

  /**
   * Runs the Business Central → GL Accounts sync by invoking the 'Run Integration Sync' MJ action
   * against the erp-account-sync Company Integration, then refreshes the list. The heavy lifting
   * (fetch from BC, field mapping, GLAccount upsert) all lives server-side in the integration-engine.
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
        Fields: ['ID'],
        ResultType: 'simple',
        MaxRows: 1,
      });
      if (!integration.Success || integration.Results.length === 0) {
        this.ActionMessage = `Business Central integration ('${BC_INTEGRATION_NAME}') is not registered in this environment.`;
        return;
      }

      // Fan out over EVERY active, credentialed Business Central company integration — mirrors the
      // nightly fan-out job, so the button syncs all companies, not just one.
      const cis = await rv.RunView<{ ID: string; Name: string }>({
        EntityName: 'MJ: Company Integrations',
        ExtraFilter: `IntegrationID='${integration.Results[0].ID}' AND IsActive=1 AND CredentialID IS NOT NULL`,
        Fields: ['ID', 'Name'],
        OrderBy: 'Name',
        ResultType: 'simple',
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
        Fields: ['ID'],
        ResultType: 'simple',
        MaxRows: 1,
      });
      if (!act.Success || act.Results.length === 0) {
        this.ActionMessage = `The '${RUN_INTEGRATION_SYNC_ACTION}' action is not installed on this server.`;
        return;
      }

      const client = new GraphQLActionClient(GraphQLDataProvider.Instance);
      const failures: string[] = [];
      for (const ci of cis.Results) {
        const failure = await this.runIntegrationSyncForCompany(client, act.Results[0].ID, ci);
        if (failure) {
          failures.push(failure);
        }
      }

      const total = cis.Results.length;
      const succeeded = total - failures.length;
      this.ActionMessage = failures.length === 0
        ? `Business Central sync ran for ${total} company integration(s). Refreshing accounts…`
        : `Business Central sync: ${succeeded}/${total} succeeded. Failed — ${failures.join('; ')}`;
      if (succeeded > 0) {
        this.Refresh();
      }
    } catch (err) {
      this.ActionMessage = `Sync error: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.ActionBusy = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Runs the Run Integration Sync action for ONE company integration. Returns null on success, or a
   * "<name>: <error>" string on failure — FullSync='true' so a manual run ignores the incremental
   * watermark and re-pulls the whole chart (matches the "Clear GL accounts" -> re-sync path).
   */
  private async runIntegrationSyncForCompany(
    client: GraphQLActionClient,
    actionID: string,
    ci: { ID: string; Name: string },
  ): Promise<string | null> {
    const params: ActionParam[] = [
      { Name: 'CompanyIntegrationID', Value: ci.ID, Type: 'Input' },
      { Name: 'FullSync', Value: 'true', Type: 'Input' },
    ];
    try {
      const result = await client.RunAction(actionID, params);
      return result?.Success ? null : `${ci.Name}: ${result?.Message ?? 'unknown error'}`;
    } catch (err) {
      return `${ci.Name}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // ------------------------------------------------------------------ sync log

  /** Show/hide the Business Central sync-log panel; loads on first open. */
  public async ToggleSyncLog(): Promise<void> {
    this.ShowSyncLog = !this.ShowSyncLog;
    this.cdr.markForCheck();
    if (this.ShowSyncLog) {
      await this.LoadSyncLog();
    }
  }

  /** Show/hide the nightly-sync failure-alert settings; loads current recipient on first open. */
  public async ToggleNotifySettings(): Promise<void> {
    this.ShowNotifySettings = !this.ShowNotifySettings;
    this.cdr.markForCheck();
    if (this.ShowNotifySettings) {
      await this.LoadNotifySettings();
    }
  }

  /** Human label for the recipient currently PERSISTED on the job (not the pending dropdown pick). */
  public get NotifyRecipientLabel(): string {
    if (!this.NotifySavedRecipientID) {
      return 'no one';
    }
    const match = this.NotifyUserOptions.find((o) => o.ID === this.NotifySavedRecipientID);
    return match ? match.Label : this.NotifySavedRecipientID;
  }

  /**
   * Loads the recent Business Central sync runs and the per-record failures behind them. Reads
   * CompanyIntegrationRun.ErrorLog (JSON array of SyncRecordError), so it covers BOTH manual button
   * runs and the nightly fan-out job. Read-only projection — no mutation.
   */
  public async LoadSyncLog(): Promise<void> {
    this.SyncLogLoading = true;
    this.SyncLogError = null;
    this.cdr.markForCheck();
    try {
      const rv = new RunView();
      const res = await rv.RunView<SyncRunRow>({
        EntityName: 'MJ: Company Integration Runs',
        ExtraFilter: `Integration='${BC_INTEGRATION_NAME}'`,
        Fields: ['ID', 'Company', 'Status', 'StartedAt', 'TotalRecords', 'ErrorLog'],
        OrderBy: '__mj_CreatedAt DESC',
        MaxRows: 25,
        ResultType: 'simple',
      });
      if (!res.Success) {
        this.SyncLogError = `Could not load the sync log: ${res.ErrorMessage}`;
        this.SyncLogRuns = [];
        return;
      }
      this.SyncLogRuns = res.Results.map((r) => this.toSyncLogRun(r));
    } catch (err) {
      this.SyncLogError = `Sync log error: ${err instanceof Error ? err.message : String(err)}`;
      this.SyncLogRuns = [];
    } finally {
      this.SyncLogLoading = false;
      this.cdr.markForCheck();
    }
  }

  /** Expand/collapse one run's per-record failure list. */
  public ToggleRunExpanded(run: SyncLogRun): void {
    run.Expanded = !run.Expanded;
    this.cdr.markForCheck();
  }

  private toSyncLogRun(r: SyncRunRow): SyncLogRun {
    const parsed = this.parseErrorLog(r.ErrorLog);
    return {
      ID: r.ID,
      Company: r.Company ?? '(unknown company)',
      Status: r.Status ?? 'Unknown',
      StartedDisplay: r.StartedAt ? new Date(r.StartedAt).toLocaleString() : '—',
      TotalRecords: r.TotalRecords ?? 0,
      ErrorCount: parsed.errors.length,
      Errors: parsed.errors,
      RawError: parsed.raw,
      Expanded: false,
    };
  }

  /**
   * ErrorLog is `JSON.stringify(result.Errors.slice(0,100))` for per-record failures, but a plain
   * string (or single object) for fatal/cancel cases — parse defensively and surface either shape.
   */
  private parseErrorLog(raw: string | null): { errors: SyncLogError[]; raw: string | null } {
    if (!raw) {
      return { errors: [], raw: null };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { errors: [], raw };
    }
    if (Array.isArray(parsed)) {
      return { errors: parsed.map((e) => this.toSyncLogError(e)), raw: null };
    }
    if (parsed && typeof parsed === 'object' && 'ErrorMessage' in parsed) {
      return { errors: [this.toSyncLogError(parsed)], raw: null };
    }
    return { errors: [], raw };
  }

  private toSyncLogError(entry: unknown): SyncLogError {
    const o: Record<string, unknown> = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
    return {
      ExternalID: str(o['ExternalID']),
      ChangeType: str(o['ChangeType']),
      ErrorMessage: str(o['ErrorMessage']) ?? 'Unknown error',
      ErrorCode: str(o['ErrorCode']),
      Severity: str(o['Severity']),
    };
  }

  // ------------------------------------------------------------- failure notification

  /**
   * Loads the nightly fan-out job's current failure-notification recipient + channels, and the list
   * of active users to choose from. Read-only; the actual write happens in {@link SaveNotifySettings}.
   */
  public async LoadNotifySettings(): Promise<void> {
    try {
      const rv = new RunView();
      const jobType = await rv.RunView<{ ID: string }>({
        EntityName: 'MJ: Scheduled Job Types',
        ExtraFilter: `DriverClass='${BC_FANOUT_DRIVER_CLASS}'`,
        Fields: ['ID'],
        ResultType: 'simple',
        MaxRows: 1,
      });
      if (!jobType.Success || jobType.Results.length === 0) {
        this.NotifyJobID = null;
        return;
      }
      const job = await rv.RunView<{ ID: string; NotifyUserID: string | null; NotifyViaEmail: boolean; NotifyViaInApp: boolean }>({
        EntityName: 'MJ: Scheduled Jobs',
        ExtraFilter: `JobTypeID='${jobType.Results[0].ID}'`,
        Fields: ['ID', 'NotifyUserID', 'NotifyViaEmail', 'NotifyViaInApp'],
        OrderBy: '__mj_CreatedAt ASC',
        ResultType: 'simple',
        MaxRows: 1,
      });
      if (!job.Success || job.Results.length === 0) {
        this.NotifyJobID = null;
        return;
      }
      const j = job.Results[0];
      this.NotifyJobID = j.ID;
      this.NotifyRecipientID = j.NotifyUserID ?? null;
      this.NotifySavedRecipientID = j.NotifyUserID ?? null;
      this.NotifyViaEmail = !!j.NotifyViaEmail;
      this.NotifyViaInApp = !!j.NotifyViaInApp;
      this.NotifyUserOptions = await this.loadNotifyUserOptions();
    } catch (err) {
      this.NotifyMessage = `Could not load notification settings: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.cdr.markForCheck();
    }
  }

  private async loadNotifyUserOptions(): Promise<NotifyUserOption[]> {
    const rv = new RunView();
    const users = await rv.RunView<{ ID: string; Name: string | null; Email: string | null }>({
      EntityName: 'MJ: Users',
      ExtraFilter: 'IsActive=1',
      Fields: ['ID', 'Name', 'Email'],
      OrderBy: 'Name',
      ResultType: 'simple',
      MaxRows: 1000,
    });
    if (!users.Success) {
      return [];
    }
    return users.Results.map((u) => ({
      ID: u.ID,
      Label: u.Name ? (u.Email ? `${u.Name} (${u.Email})` : u.Name) : (u.Email ?? u.ID),
    }));
  }

  /** Persists the chosen recipient + channels onto the nightly job (ensuring NotifyOnFailure stays on). */
  public async SaveNotifySettings(): Promise<void> {
    if (!this.NotifyJobID || this.NotifySaving) {
      return;
    }
    this.NotifySaving = true;
    this.NotifyMessage = null;
    this.cdr.markForCheck();
    try {
      const job = await this.ProviderToUse.GetEntityObject<MJScheduledJobEntity>('MJ: Scheduled Jobs', this.ProviderToUse.CurrentUser);
      if (!(await job.Load(this.NotifyJobID))) {
        this.NotifyMessage = 'Could not load the scheduled job to save.';
        return;
      }
      job.NotifyUserID = this.NotifyRecipientID;
      job.NotifyViaEmail = this.NotifyViaEmail;
      job.NotifyViaInApp = this.NotifyViaInApp;
      job.NotifyOnFailure = true; // a recipient is meaningless unless failures actually notify
      const saved = await job.Save();
      if (saved) {
        this.NotifySavedRecipientID = this.NotifyRecipientID;
      }
      this.NotifyMessage = saved
        ? (this.NotifyRecipientID ? 'Saved — nightly-sync failures will notify the selected user.' : 'Saved — nightly-sync failure alerts are off (no recipient).')
        : `Save failed: ${job.LatestResult?.CompleteMessage ?? 'unknown error'}`;
    } catch (err) {
      this.NotifyMessage = `Save error: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.NotifySaving = false;
      this.cdr.markForCheck();
    }
  }

  // ------------------------------------------------------------------ filtering

  public get Filtered(): AccountRow[] {
    const q = this.SearchText.trim().toLowerCase();
    return this.Rows.filter((r) => this.matchesFilters(r, q));
  }

  /**
   * Search covers Name, Code AND ID. Humans search by name and code; the ID stays searchable (and
   * visible) so an ID pasted from a log or a deep link still finds its row.
   */
  private matchesFilters(r: AccountRow, q: string): boolean {
    if (this.FilterCompanyIDs.length && !this.FilterCompanyIDs.some((id) => UUIDsEqual(r.CompanyID, id))) return false;
    if (this.FilterAccountType && r.AccountType !== this.FilterAccountType) return false;
    if (this.FilterActive === 'Active' && !r.IsActive) return false;
    if (this.FilterActive === 'Inactive' && r.IsActive) return false;
    if (this.FilterSource === 'Seeded' && !r.IsSystemSeeded) return false;
    if (this.FilterSource === 'Custom' && r.IsSystemSeeded) return false;
    if (!q) return true;
    return r.Name.toLowerCase().includes(q) || r.Code.toLowerCase().includes(q) || r.ID.toLowerCase().includes(q);
  }

  public ClearFilters(): void {
    this.FilterCompanyIDs = [];
    this.FilterAccountType = '';
    this.FilterActive = '';
    this.FilterSource = '';
    this.SearchText = '';
    this.rebuildGridParams();
  }

  public get OrphanCount(): number {
    return this.Rows.filter((r) => r.IsOrphan || r.InCycle).length;
  }

  /** Indentation is the rollup — one step per level of parentage. */
  public IndentFor(r: AccountRow): string {
    return `${r.Depth * 18}px`;
  }

  // ------------------------------------------------------------------ editor

  /** Monotonic counter from the category header's "New account" verb — each bump opens the editor. */
  private _createSignal = 0;
  @Input() set CreateSignal(v: number) {
    if (v > this._createSignal) {
      this._createSignal = v;
      this.StartCreate();
    }
  }

  public async StartCreate(): Promise<void> {
    // An account cannot exist outside a company's chart, so the company is a REQUIRED first choice,
    // not an optional afterthought. Pre-pick only when the choice is unambiguous.
    const only = this.CompanyOptions.length === 1 ? this.CompanyOptions[0].ID : '';
    const entity = await this.ProviderToUse.GetEntityObject<mjBizAppsAccountingGLAccountEntity>(
      GL_ENTITY,
      this.ProviderToUse.CurrentUser,
    );
    entity.NewRecord();
    // Pre-pick the filtered company only when the filter narrows to EXACTLY one — else unambiguous-only.
    const company = (this.FilterCompanyIDs.length === 1 ? this.FilterCompanyIDs[0] : '') || only;
    if (company) entity.CompanyID = company;
    entity.AccountType = 'Asset';
    entity.IsActive = true;
    this.Draft = entity;
    this.EditingSeeded = false;
    this.EditorError = null;
    this.cdr.markForCheck();
  }

  public async StartEdit(r: AccountRow): Promise<void> {
    // LOADED, not copied from the grid row. The row is a projection for a table; the editor needs the
    // record, and loading it is also what makes the save a normal update rather than a re-assembly.
    const entity = await this.ProviderToUse.GetEntityObject<mjBizAppsAccountingGLAccountEntity>(
      GL_ENTITY,
      this.ProviderToUse.CurrentUser,
    );
    if (!(await entity.Load(r.ID))) {
      this.EditorError = `Could not load account ${r.Code}.`;
      this.cdr.markForCheck();
      return;
    }
    this.Draft = entity;
    this.EditingSeeded = r.IsSystemSeeded;
    this.EditorError = null;
    this.cdr.markForCheck();
  }

  public CancelEdit(): void {
    this.Draft = null;
    this.EditorError = null;
    this.cdr.markForCheck();
  }

  /**
   * The parent picker for the draft: **only the draft company's own chart** (that is what a rollup
   * parent IS), minus the account itself and its own descendants — a cycle would break rollup and
   * is exactly the bad data this page has to guard the tree against.
   */
  public get ParentOptions(): ParentOption[] {
    const d = this.Draft;
    if (!d?.CompanyID) return [];
    const excluded = d.IsSaved ? this.selfAndDescendants(d.ID) : new Set<string>();
    return this.Rows.filter((r) => UUIDsEqual(r.CompanyID, d.CompanyID) && !excluded.has(NormalizeUUID(r.ID)))
      .map((r) => ({ ID: r.ID, Label: `${r.Code} — ${r.Name}` }))
      .sort((a, b) => a.Label.localeCompare(b.Label));
  }

  /** The id set that may not be a parent of `id`: itself plus everything beneath it. */
  private selfAndDescendants(id: string): Set<string> {
    const childrenByParent = this.buildChildIndex();
    const out = new Set<string>([NormalizeUUID(id)]);
    const queue = [NormalizeUUID(id)];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const child of childrenByParent.get(current) ?? []) {
        const key = NormalizeUUID(child.ID);
        // The visited set doubles as the cycle guard: already-seen ids are never re-queued.
        if (out.has(key)) continue;
        out.add(key);
        queue.push(key);
      }
    }
    return out;
  }

  private buildChildIndex(): Map<string, AccountRow[]> {
    const index = new Map<string, AccountRow[]>();
    for (const r of this.Rows) {
      if (!r.ParentGLAccountID) continue;
      const key = NormalizeUUID(r.ParentGLAccountID);
      const bucket = index.get(key);
      if (bucket) bucket.push(r);
      else index.set(key, [r]);
    }
    return index;
  }

  public async Save(): Promise<void> {
    const d = this.Draft;
    if (!d) return;

    const invalid = this.validateDraft(d);
    if (invalid) {
      this.EditorError = invalid;
      this.cdr.markForCheck();
      return;
    }

    this.IsSaving = true;
    this.EditorError = null;
    this.cdr.markForCheck();
    try {
      // Empty strings are NULL, not empty text: an optional FK or code left blank must be absent
      // rather than a zero-length string the database would happily store and nothing would match.
      this.blankToNull(d);

      // Save() returns a boolean and does NOT throw on a logical failure (a UNIQUE violation, a
      // permission denial) — reading the return value is the only way to know it worked.
      const saved = await d.Save();
      if (!saved) {
        // MJ core already console-logs the full failure (SQL included) — here we only present the
        // human sentence; adding our own console.error would double-log and trip the test keystone.
        this.EditorError = this.friendlySaveError(d.LatestResult?.CompleteMessage, 'The account could not be saved.');
        return;
      }

      this.Draft = null;
      await this.load(true);
      void this.grid?.Refresh(); // params are unchanged post-save (deep-equal → setter skips), so refetch explicitly
    } catch (e) {
      this.EditorError = this.friendlySaveError(e instanceof Error ? e.message : String(e), 'The account could not be saved.');
    } finally {
      this.IsSaving = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Client-side guards, so the common mistakes read as sentences rather than as an opaque SQL
   * constraint error. `UNIQUE (CompanyID, Code)` is the one that bites: a duplicate code inside one
   * company is legal-looking and fails at the DB. The DB stays the authority — `Save()`'s return is
   * still checked — this just gets there first with a message a human can act on.
   */
  private validateDraft(d: mjBizAppsAccountingGLAccountEntity): string | null {
    if (!d.CompanyID) return 'Pick the company that will own this account — every account lives in exactly one company’s chart.';
    if (!(d.Code ?? '').trim()) return 'Code is required.';
    if (!(d.Name ?? '').trim()) return 'Name is required.';

    const code = (d.Code ?? '').trim().toLowerCase();
    const clash = this.Rows.find(
      (r) => UUIDsEqual(r.CompanyID, d.CompanyID) && r.Code.trim().toLowerCase() === code && !(d.IsSaved && UUIDsEqual(r.ID, d.ID)),
    );
    if (clash) {
      const company = this.CompanyOptions.find((c) => UUIDsEqual(c.ID, d.CompanyID))?.Name ?? 'this company';
      return `${company} already has an account with code ${clash.Code} (“${clash.Name}”). Each company’s chart requires a unique code.`;
    }

    if (d.ParentGLAccountID) {
      const parent = this.Rows.find((r) => UUIDsEqual(r.ID, d.ParentGLAccountID));
      if (!parent) return 'The selected parent account no longer exists — pick another.';
      if (!UUIDsEqual(parent.CompanyID, d.CompanyID)) {
        return 'A parent account must belong to the same company — rollup happens inside one company’s chart.';
      }
      if (d.IsSaved && this.selfAndDescendants(d.ID).has(NormalizeUUID(d.ParentGLAccountID))) {
        return 'That account sits beneath this one — making it the parent would create a loop in the rollup.';
      }
    }
    return null;
  }

  /**
   * Trim the text fields and turn the blanks into NULL, in place on the entity.
   *
   * All that survives of `applyDraft`, which copied eleven fields from a mirror. The copying is gone
   * — the form writes the entity — but this rule is not cosmetic: an empty string in an optional FK
   * or code is a value the database stores and nothing ever matches, which reads as "set to nothing"
   * and behaves as "set to something nobody can find".
   *
   * `IsSystemSeeded` is deliberately never written by this page. It records that
   * `spSeedDefaultChartOfAccounts` created the row — provenance, not a user preference. Letting the
   * UI set it would let a deployment customization claim to be platform-shipped, which is precisely
   * the distinction the flag exists to preserve. Binding the entity makes that a rule about what the
   * TEMPLATE offers rather than one enforced by a copier nobody can see.
   */
  private blankToNull(d: mjBizAppsAccountingGLAccountEntity): void {
    d.Code = (d.Code ?? '').trim();
    d.Name = (d.Name ?? '').trim();
    d.ParentGLAccountID = d.ParentGLAccountID || null;
    d.CurrencyCode = d.CurrencyCode || null;
    d.ExternalSystem = (d.ExternalSystem ?? '').trim() || null;
    d.ExternalAccountID = (d.ExternalAccountID ?? '').trim() || null;
    d.Description = (d.Description ?? '').trim() || null;
  }

  /**
   * **Retire, don't delete — deliberate.** There is no Delete on this page. An account referenced
   * by a journal-entry line or a GLAccountLink cannot be deleted (FK), so a delete button would be
   * a button that fails with an opaque constraint error on exactly the accounts people most want to
   * clean up. The schema names the intended path itself: IsActive is "whether the account is
   * available for new JE lines. **Inactive accounts retain historical data.**" So retiring an
   * account = clearing IsActive, which is safe for every account, keeps the history readable, and
   * never produces an error we'd have to translate.
   */
  public async ToggleActive(r: AccountRow): Promise<void> {
    this.IsSaving = true;
    this.cdr.markForCheck();
    try {
      const entity = await this.ProviderToUse.GetEntityObject<mjBizAppsAccountingGLAccountEntity>(GL_ENTITY, this.ProviderToUse.CurrentUser);
      const loaded = await entity.Load(r.ID);
      if (!loaded) throw new Error(`Could not load account ${r.Code}.`);
      entity.IsActive = !r.IsActive;
      const saved = await entity.Save();
      if (!saved) {
        this.LoadError = this.friendlySaveError(entity.LatestResult?.CompleteMessage, `Could not update ${r.Code}.`);
        return;
      }
      await this.load(true);
      void this.grid?.Refresh(); // params are unchanged post-save (deep-equal → setter skips), so refetch explicitly
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsSaving = false;
      this.cdr.markForCheck();
    }
  }

  // ------------------------------------------------------------------ loading

  private async load(forceRefresh = false): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      const user = this.ProviderToUse.CurrentUser;
      await AccountingEngineBase.Instance.Config(forceRefresh, user, this.ProviderToUse);
      await this.Scope.Load(user, this.ProviderToUse);

      const engine = AccountingEngineBase.Instance;
      this.CurrencyOptions = engine.Currencies.map((c) => ({ Code: c.Code, Name: c.Name })).sort((a, b) => a.Code.localeCompare(b.Code));

      const scoped = this.scopedAccounts(engine.GLAccounts);
      // Companies come from the SCOPE service (ACP-backed, reactive) — NOT derived from cached GL
      // account rows (Marcelo 2026-07-30). The old derivation had two failure modes: a freshly
      // created company (whose W1 chart was seeded SERVER-side, so no client entity events) never
      // appeared, and companies deleted out-of-band lingered as ghosts — picking one produced a raw
      // FK_GLAccount_Company error at save. The scope roster tracks ACP saves live, and a company
      // with no accounts yet is exactly the one you create the first account FOR.
      this.CompanyOptions = this.Scope.Companies.map((c) => ({ ID: c.ID, Name: `${c.Name} (${c.CompanyCode})` }));
      this.Rows = this.buildRollup(scoped);
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.Rows = [];
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * The company scope narrows the chart; empty scope = every company (the service's rule, applied
   * through the service so it lives in one place). Permission-based narrowing lands here later —
   * "eventually we will limit with what a person has permissions and access to see."
   */
  private scopedAccounts(all: mjBizAppsAccountingGLAccountEntity[]): mjBizAppsAccountingGLAccountEntity[] {
    if (this.Scope.IsAllCompanies) return all;
    const selected = new Set(this.Scope.SelectedIDs.map((id) => NormalizeUUID(id)));
    return all.filter((a) => selected.has(NormalizeUUID(a.CompanyID)));
  }

  /**
   * Present a save failure as a human sentence, never a raw SQL dump (Marcelo 2026-07-30 — the
   * FK-ghost incident leaked a full spCreate batch into the editor). MJ's CompleteMessage appends
   * the executed SQL after "Query:"; everything from there down is log material, not UI copy. The
   * one constraint a user can actually hit from this editor gets a specific, actionable message.
   */
  private friendlySaveError(raw: string | null | undefined, fallback: string): string {
    if (!raw) return fallback;
    const beforeQuery = raw.split(/\bQuery:/)[0].trim();
    if (/FK_GLAccount_Company/i.test(beforeQuery)) {
      return 'The selected owning company no longer exists — it may have been removed since this page loaded. Refresh and choose again.';
    }
    const firstLine = beforeQuery.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
    return firstLine ?? fallback;
  }

  /**
   * Order the chart company-by-company, each company's accounts walked as a rollup tree so children
   * sit under their parents with a `Depth` the template turns into indentation.
   *
   * Two data hazards are handled rather than ignored: a parent that isn't in the set (**orphan**)
   * and a parent chain that loops (**cycle**). Both are promoted to roots and flagged — a cycle
   * that hung the walk would blank the page, and a dropped orphan would be a chart quietly missing
   * accounts.
   */
  private buildRollup(accounts: mjBizAppsAccountingGLAccountEntity[]): AccountRow[] {
    const byID = new Map<string, mjBizAppsAccountingGLAccountEntity>();
    for (const a of accounts) byID.set(NormalizeUUID(a.ID), a);

    const cyclic = this.findCyclicIDs(accounts, byID);
    const children = new Map<string, mjBizAppsAccountingGLAccountEntity[]>();
    const roots: mjBizAppsAccountingGLAccountEntity[] = [];

    for (const a of accounts) {
      const parentKey = a.ParentGLAccountID ? NormalizeUUID(a.ParentGLAccountID) : null;
      const attachable = parentKey !== null && byID.has(parentKey) && !cyclic.has(NormalizeUUID(a.ID));
      if (!attachable) {
        roots.push(a);
        continue;
      }
      const bucket = children.get(parentKey as string);
      if (bucket) bucket.push(a);
      else children.set(parentKey as string, [a]);
    }

    const byCode = (x: mjBizAppsAccountingGLAccountEntity, y: mjBizAppsAccountingGLAccountEntity) => x.Code.localeCompare(y.Code);
    const rootsByCompany = new Map<string, mjBizAppsAccountingGLAccountEntity[]>();
    for (const r of roots) {
      const key = NormalizeUUID(r.CompanyID);
      const bucket = rootsByCompany.get(key);
      if (bucket) bucket.push(r);
      else rootsByCompany.set(key, [r]);
    }

    const companies = [...rootsByCompany.entries()].sort((a, b) => {
      const an = byID.get(NormalizeUUID(a[1][0].ID))?.Company ?? '';
      const bn = byID.get(NormalizeUUID(b[1][0].ID))?.Company ?? '';
      return an.localeCompare(bn);
    });

    const out: AccountRow[] = [];
    const emitted = new Set<string>();
    for (const [, companyRoots] of companies) {
      for (const root of [...companyRoots].sort(byCode)) {
        this.walk(root, 0, children, byID, cyclic, emitted, out, byCode);
      }
    }
    return out;
  }

  /** Depth-first emit. `emitted` is the belt-and-braces guard: no id is ever walked twice. */
  private walk(
    node: mjBizAppsAccountingGLAccountEntity,
    depth: number,
    children: Map<string, mjBizAppsAccountingGLAccountEntity[]>,
    byID: Map<string, mjBizAppsAccountingGLAccountEntity>,
    cyclic: Set<string>,
    emitted: Set<string>,
    out: AccountRow[],
    byCode: (x: mjBizAppsAccountingGLAccountEntity, y: mjBizAppsAccountingGLAccountEntity) => number,
  ): void {
    const key = NormalizeUUID(node.ID);
    if (emitted.has(key)) return;
    emitted.add(key);
    out.push(this.toRow(node, depth, byID, cyclic));
    for (const child of [...(children.get(key) ?? [])].sort(byCode)) {
      this.walk(child, depth + 1, children, byID, cyclic, emitted, out, byCode);
    }
  }

  /**
   * Every id whose parent chain loops. Walked per-node with a local visited set and a hard step cap,
   * so bad data costs a bounded amount of work instead of hanging the page.
   */
  private findCyclicIDs(accounts: mjBizAppsAccountingGLAccountEntity[], byID: Map<string, mjBizAppsAccountingGLAccountEntity>): Set<string> {
    const cyclic = new Set<string>();
    for (const start of accounts) {
      const seen = new Set<string>([NormalizeUUID(start.ID)]);
      let current = start;
      let steps = 0;
      while (current.ParentGLAccountID && steps++ <= accounts.length) {
        const parent = byID.get(NormalizeUUID(current.ParentGLAccountID));
        if (!parent) break;
        const parentKey = NormalizeUUID(parent.ID);
        if (seen.has(parentKey)) {
          cyclic.add(NormalizeUUID(start.ID));
          break;
        }
        seen.add(parentKey);
        current = parent;
      }
    }
    return cyclic;
  }

  private toRow(
    a: mjBizAppsAccountingGLAccountEntity,
    depth: number,
    byID: Map<string, mjBizAppsAccountingGLAccountEntity>,
    cyclic: Set<string>,
  ): AccountRow {
    const parent = a.ParentGLAccountID ? byID.get(NormalizeUUID(a.ParentGLAccountID)) : undefined;
    return {
      ID: a.ID,
      CompanyID: a.CompanyID,
      Company: a.Company,
      Code: a.Code,
      Name: a.Name,
      AccountType: a.AccountType,
      ParentGLAccountID: a.ParentGLAccountID,
      ParentLabel: parent ? `${parent.Code} — ${parent.Name}` : a.ParentGLAccount,
      CurrencyCode: a.CurrencyCode,
      ExternalSystem: a.ExternalSystem,
      ExternalAccountID: a.ExternalAccountID,
      IsActive: a.IsActive,
      IsSystemSeeded: a.IsSystemSeeded,
      Description: a.Description,
      Depth: depth,
      IsOrphan: !!a.ParentGLAccountID && !parent,
      InCycle: cyclic.has(NormalizeUUID(a.ID)),
    };
  }
}
