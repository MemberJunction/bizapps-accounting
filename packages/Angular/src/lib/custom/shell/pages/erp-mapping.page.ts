import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit, OnDestroy } from '@angular/core';
import { RunView, type IRemoteOperationProvider } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';

const COA_MAP_ENTITY = 'MJ_BizApps_Accounting: Chart Of Accounts Mappings';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

interface MappingRow {
  ID: string;
  InternalGLAccount: string | null;
  InternalGLAccountID: string;
  ExternalSystem: string;
  ExternalAccountID: string;
  ExternalAccountName: string | null;
  EffectiveFrom: string | null;
  EffectiveTo: string | null;
  ApprovedByUserID: string | null;
  ApprovedByUser: string | null;
  Company: string | null;
}

/**
 * ERP mapping (UI plan §8.3 / §5 B.3) — the CoA↔ERP approval grid.
 *
 * Plain grid actions, NOT tasks-routed: this is admin curation, not workflow (ruled 2026-07-15 —
 * contrast the C.8 manual-JE gate). Default filter is "needs approval", because that is the only
 * reason to open this screen.
 *
 * **Approve goes through `Accounting.ApproveChartOfAccountsMapping`, never a direct entity save.**
 * approveMapping() enforces the strict 1:1 rule by superseding any prior approved+effective mapping
 * for the same account; stamping ApprovedByUserID from the client would skip that and leave two live
 * approved mappings, which resolveExternalAccount would then choose between arbitrarily — silently
 * batching to the wrong ERP account. The op reports what it superseded so we can say so.
 */
@Component({
  standalone: false,
  selector: 'mj-erp-mapping-page',
  templateUrl: './erp-mapping.page.html',
  styleUrls: ['./shell-table.css', './erp-mapping.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpMappingPageComponent extends BaseAngularComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  /** The shell header's Refresh reaches this page while it is the mounted one. */
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;

  public Rows: MappingRow[] = [];
  public UnmappedAccountCount = 0;
  public IsLoading = false;
  public LoadError: string | null = null;
  public ApprovingID: string | null = null;
  public ActionMessage: string | null = null;
  public ActionIsError = false;

  /** Default: the reason you opened this screen. */
  public Filter: 'NeedsApproval' | 'Approved' | 'All' = 'NeedsApproval';
  /**
   * One box over the rows this filter already loaded. CLIENT-side on purpose: the approval filter is
   * a server round-trip because it changes WHICH rows exist, but a search must never be one — and
   * user-typed text must never reach an `ExtraFilter`.
   */
  public Search = '';

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

  public OnFilterChanged(): void {
    void this.load();
  }

  public OnSearchChanged(): void {
    this.cdr.markForCheck();
  }

  /** The rows the grid shows — filtered CLIENT-side over what's loaded, no round-trip per keystroke. */
  public get Filtered(): MappingRow[] {
    const q = this.Search.trim().toLowerCase();
    if (!q) return this.Rows;
    // The names + the ERP account CODE lead — what an admin actually knows. The ids match too, for
    // anyone pasting one. Lowercased `includes` — a text match, not a UUID equality test.
    return this.Rows.filter((r) =>
      [r.InternalGLAccount, r.ExternalAccountID, r.ExternalAccountName, r.ExternalSystem, r.Company, r.InternalGLAccountID, r.ID].some(
        (v) => (v ?? '').toLowerCase().includes(q),
      ),
    );
  }

  /**
   * DELIBERATELY counted over every loaded row, never the searched subset — a chip a search box can
   * mute is not a chip.
   */
  public get NeedsApprovalCount(): number {
    return this.Rows.filter((r) => !r.ApprovedByUserID).length;
  }

  public IsApproved(r: MappingRow): boolean {
    return !!r.ApprovedByUserID;
  }

  public async Approve(r: MappingRow): Promise<void> {
    if (this.IsApproved(r) || this.ApprovingID) return;
    this.ApprovingID = r.ID;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      const provider = this.ProviderToUse as unknown as IRemoteOperationProvider;
      const res = await provider.RouteOperation<{ MappingID: string }, { supersededMappingIds: string[] }>(
        'Accounting.ApproveChartOfAccountsMapping',
        { MappingID: r.ID },
      );
      if (!res.Success || !res.Output) throw new Error(res.ErrorMessage ?? 'Approve failed.');

      const superseded = res.Output.supersededMappingIds?.length ?? 0;
      // Say what it REPLACED. Strict 1:1 means approving here silently retires another mapping —
      // an admin must see that, not discover it later in a mis-posted batch.
      this.ActionMessage =
        superseded > 0
          ? `Approved ${r.ExternalAccountID} — superseded ${superseded} previously approved mapping${superseded === 1 ? '' : 's'} for this account.`
          : `Approved ${r.ExternalAccountID}.`;
      this.ActionIsError = false;
      await this.load(); // refetch-on-mutating-action
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.ApprovingID = null;
      this.cdr.markForCheck();
    }
  }

  private async load(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      const rv = RunView.FromMetadataProvider(this.ProviderToUse);
      const filter =
        this.Filter === 'NeedsApproval' ? `ApprovedByUserID IS NULL`
        : this.Filter === 'Approved' ? `ApprovedByUserID IS NOT NULL`
        : '';
      const [maps, unmapped] = await rv.RunViews(
        [
          {
            EntityName: COA_MAP_ENTITY,
            ExtraFilter: filter || undefined,
            Fields: ['ID', 'InternalGLAccount', 'InternalGLAccountID', 'ExternalSystem', 'ExternalAccountID',
                     'ExternalAccountName', 'EffectiveFrom', 'EffectiveTo', 'ApprovedByUserID', 'ApprovedByUser', 'Company'],
            OrderBy: 'ExternalSystem ASC, ExternalAccountID ASC',
            ResultType: 'simple',
          },
          // The warning chip: accounts with NO mapping at all. Not an error — resolveExternalAccount
          // falls back to the account Code (AM-4) — but an admin should know the ERP is receiving a
          // code rather than a curated mapping.
          {
            EntityName: GL_ENTITY,
            ExtraFilter: `IsActive=1 AND ID NOT IN (SELECT InternalGLAccountID FROM __mj_BizAppsAccounting.vwChartOfAccountsMappings WHERE ApprovedByUserID IS NOT NULL)`,
            Fields: ['ID'],
            MaxRows: 1,
            ResultType: 'simple',
          },
        ],
        this.ProviderToUse.CurrentUser,
      );
      if (!maps?.Success) throw new Error(maps?.ErrorMessage ?? 'could not load mappings');
      this.Rows = (maps.Results ?? []) as MappingRow[];
      this.UnmappedAccountCount = unmapped?.Success ? (unmapped.TotalRowCount ?? 0) : 0;
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.Rows = [];
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  private setError(message: string): void {
    this.ActionMessage = message;
    this.ActionIsError = true;
    this.cdr.markForCheck();
  }
}
