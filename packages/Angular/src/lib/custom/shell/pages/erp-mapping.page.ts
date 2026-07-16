import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit } from '@angular/core';
import { RunView, type IRemoteOperationProvider } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';

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
  styleUrls: ['./erp-mapping.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpMappingPageComponent extends BaseAngularComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  public Rows: MappingRow[] = [];
  public UnmappedAccountCount = 0;
  public IsLoading = false;
  public LoadError: string | null = null;
  public ApprovingID: string | null = null;
  public ActionMessage: string | null = null;
  public ActionIsError = false;

  /** Default: the reason you opened this screen. */
  public Filter: 'NeedsApproval' | 'Approved' | 'All' = 'NeedsApproval';

  ngOnInit(): void {
    void this.load();
  }

  public Refresh(): void {
    void this.load();
  }

  public OnFilterChanged(): void {
    void this.load();
  }

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
