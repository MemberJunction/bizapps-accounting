import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit } from '@angular/core';
import { RunView } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import type { GlResolutionResult } from '../../shared/gl-resolution-preview.component';

const LINK_ENTITY = 'MJ_BizApps_Accounting: GL Account Links';

interface LinkRow {
  ID: string;
  GLAccountRole: string | null;
  GLAccountRoleID: string;
  GLAccount: string | null;
  GLAccountID: string;
  Entity: string | null;
  EntityID: string;
  RecordID: string;
  Status: string;
  StartedAt: string | null;
  EndedAt: string | null;
}

/**
 * Account links (UI plan §8.3 / §5) — the GLAccountLink manager: which GL account a record books to,
 * in which role, over which date window.
 *
 * **This is the landing target of orders' Confirm-failure deep link** (orders UI §1): when an order
 * cannot resolve an account, the accountant is sent here to fix the link. That is why the
 * unmapped-ROLES chip matters more than a row count — a missing role IS the Confirm failure.
 *
 * The GL-resolution preview reads `AccountingEngineBase.ResolveLinkedAccount`, which is a CLIENT-side
 * cached engine — so "why does this resolve to 4000?" needs no server round-trip, and it answers with
 * the same primitive the booking pipeline uses rather than a re-implementation that could disagree.
 */
@Component({
  standalone: false,
  selector: 'mj-account-links-page',
  templateUrl: './account-links.page.html',
  styleUrls: ['./account-links.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountLinksPageComponent extends BaseAngularComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  public Rows: LinkRow[] = [];
  public Roles: Array<{ ID: string; Name: string }> = [];
  public UnmappedRoles: string[] = [];
  public IsLoading = false;
  public LoadError: string | null = null;

  public RoleFilter = 'All';
  public StatusFilter: 'Active' | 'All' = 'Active';

  /** The preview for the row the user picked — the "why does this resolve to X?" answer. */
  public Preview: GlResolutionResult | null = null;
  public PreviewFor: string | null = null;

  ngOnInit(): void {
    void this.load();
  }

  public Refresh(): void {
    void this.load();
  }

  public get Filtered(): LinkRow[] {
    return this.Rows.filter(
      (r) =>
        (this.RoleFilter === 'All' || r.GLAccountRoleID === this.RoleFilter) &&
        (this.StatusFilter === 'All' || r.Status === 'Active'),
    );
  }

  /**
   * Show the resolution chain for a link's target. Uses the engine primitive the booking pipeline
   * uses — not a reimplementation, which could drift and then LIE about why a booking happened.
   */
  public ShowPreview(r: LinkRow): void {
    this.PreviewFor = r.ID;
    const engine = AccountingEngineBase.Instance;
    const resolved = engine.ResolveLinkedAccount(r.EntityID, r.RecordID, r.GLAccountRoleID, new Date());
    const account = resolved ? engine.GLAccountByID(resolved.Link.GLAccountID) : null;

    this.Preview = {
      Role: r.GLAccountRole ?? 'role',
      ResolvedCode: account?.Code ?? null,
      ResolvedName: account?.Name ?? null,
      Steps: [
        {
          Scope: `${r.Entity ?? 'record'}: ${r.RecordID.slice(0, 8)}…`,
          AccountCode: account?.Code ?? null,
          AccountName: account?.Name ?? null,
          Won: !!resolved,
          Dimensions: (resolved?.Dimensions ?? []).map((d) => engine.Dimensions.find((x) => x.ID === d.DimensionID)?.Name ?? d.DimensionID),
        },
      ],
    };
    this.cdr.markForCheck();
  }

  private async load(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      // The engine caches roles + links; Config is a no-op once loaded (the lazy-load pattern).
      await AccountingEngineBase.Instance.Config(false, this.ProviderToUse.CurrentUser, this.ProviderToUse);
      this.Roles = AccountingEngineBase.Instance.GLAccountRoles.map((r) => ({ ID: r.ID, Name: r.Name }));

      const rv = RunView.FromMetadataProvider(this.ProviderToUse);
      const res = await rv.RunView<LinkRow>(
        {
          EntityName: LINK_ENTITY,
          Fields: ['ID', 'GLAccountRole', 'GLAccountRoleID', 'GLAccount', 'GLAccountID', 'Entity', 'EntityID', 'RecordID', 'Status', 'StartedAt', 'EndedAt'],
          OrderBy: 'GLAccountRole ASC, StartedAt DESC',
          ResultType: 'simple',
        },
        this.ProviderToUse.CurrentUser,
      );
      if (!res.Success) throw new Error(res.ErrorMessage ?? 'could not load account links');
      this.Rows = res.Results ?? [];

      // The chip that matters: a role with NO active link is exactly an order that will fail to
      // Confirm. Surfacing it here — where it gets fixed — is the whole point of this screen.
      const linkedRoleIds = new Set(this.Rows.filter((r) => r.Status === 'Active').map((r) => r.GLAccountRoleID));
      this.UnmappedRoles = this.Roles.filter((r) => !linkedRoleIds.has(r.ID)).map((r) => r.Name);
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.Rows = [];
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }
}
