import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit, OnDestroy } from '@angular/core';
import { RunView } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import type { GlResolutionResult } from '../../shared/gl-resolution-preview.component';

const LINK_ENTITY = 'MJ_BizApps_Accounting: GL Account Links';

/** The columns the view hands back — the raw link row, before we try to NAME its target. */
interface LinkRecord {
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

/** A link row plus the one thing the raw row cannot give us: a name for what it points AT. */
interface LinkRow extends LinkRecord {
  /**
   * The target record's human-readable name, or null when this app cannot resolve it.
   *
   * These links are POLYMORPHIC — `(EntityID, RecordID)` can point at anything, including orders'
   * Products and Product Categories. Accounting must not depend on orders, so those stay unnamed
   * here BY DESIGN (see `targetNameFor`), and the UI says so honestly rather than showing a bare
   * UUID and calling it a day.
   */
  TargetName: string | null;
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
export class AccountLinksPageComponent extends BaseAngularComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  /** The shell header's Refresh reaches this page while it is the mounted one. */
  private pageRefresh = inject(PageRefreshService);
  private refreshSub: { unsubscribe: () => void } | null = null;

  public Rows: LinkRow[] = [];
  public Roles: Array<{ ID: string; Name: string }> = [];
  public UnmappedRoles: string[] = [];
  public IsLoading = false;
  public LoadError: string | null = null;

  public RoleFilter = 'All';
  public StatusFilter: 'Active' | 'All' = 'Active';
  /** One box, matching the names a human knows AND the ids they paste out of a log or an error. */
  public Search = '';

  /** The preview for the row the user picked — the "why does this resolve to X?" answer. */
  public Preview: GlResolutionResult | null = null;
  public PreviewFor: string | null = null;

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

  /** Everything filters CLIENT-SIDE over the rows already loaded — no round-trip per keystroke. */
  public get Filtered(): LinkRow[] {
    const q = this.Search.trim().toLowerCase();
    return this.Rows.filter(
      (r) =>
        (this.RoleFilter === 'All' || r.GLAccountRoleID === this.RoleFilter) &&
        (this.StatusFilter === 'All' || r.Status === 'Active') &&
        this.matchesSearch(r, q),
    );
  }

  /**
   * The names lead — role, GL account, target entity, and (where we could resolve it) the target
   * record's own name. The ids match too, because this screen IS where someone lands holding a
   * RecordID copied out of a Confirm failure. A lowercased `includes`: a text match, deliberately
   * NOT `UUIDsEqual` — that would only ever match a whole, exact id, never a pasted fragment.
   */
  private matchesSearch(row: LinkRow, q: string): boolean {
    if (!q) return true;
    const haystack = [
      row.TargetName,
      row.GLAccountRole,
      row.GLAccount,
      row.Entity,
      row.RecordID,
      row.GLAccountID,
      row.ID,
    ];
    return haystack.some((v) => (v ?? '').toLowerCase().includes(q));
  }

  public OnFilterChanged(): void {
    this.cdr.markForCheck();
  }

  /** What to show for the link's target: its name when we have one, else an honest label. */
  public TargetLabel(row: LinkRow): string {
    return row.TargetName ?? 'Not named here';
  }

  /**
   * Name the record a link points AT — the whole point being that `RecordID.slice(0, 8)…` is a
   * meaningless string to the human reading this grid.
   *
   * Resolution runs off caches accounting ALREADY holds (`AccountingEngineBase.Config` loaded them
   * at page load), so naming costs no round-trip. What we can reach is exactly what accounting owns
   * plus MJ core's companies (an Accounting Company Profile is an IsA child of `__mj.Company` —
   * SAME UUID — so a company-scoped link's RecordID is its profile's ID).
   *
   * Orders' Products / Product Categories are NOT resolvable here and must not be: accounting does
   * not depend on orders, and adding that dependency to prettify a cell would invert the app
   * hierarchy. Those rows fall back to the raw id with a label that says so.
   */
  private targetNameFor(entityName: string | null, recordId: string): string | null {
    const engine = AccountingEngineBase.Instance;
    switch (entityName) {
      case 'MJ: Companies': {
        // IsA (same UUID as the Company row) — see the accounting master plan §5.
        const company = engine.CompanyProfiles.find((c) => UUIDsEqual(c.ID, recordId));
        return company ? `${company.Name} (${company.CompanyCode})` : null;
      }
      case 'MJ_BizApps_Accounting: GL Accounts': {
        const account = engine.GLAccountByID(recordId);
        return account ? `${account.Code} ${account.Name}` : null;
      }
      case 'MJ_BizApps_Accounting: Dimensions': {
        const dimension = engine.Dimensions.find((d) => UUIDsEqual(d.ID, recordId));
        return dimension ? `${dimension.Code} ${dimension.Name}` : null;
      }
      case 'MJ_BizApps_Accounting: Dimension Values': {
        const value = engine.DimensionValues.find((v) => UUIDsEqual(v.ID, recordId));
        return value ? `${value.Code} ${value.Name}` : null;
      }
      default:
        // Everything accounting cannot see from here — notably orders' Products and Product
        // Categories. Honest null, never a fabricated label.
        return null;
    }
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
          // Name the target where we can — `Products: 3f2a1c9b…` told the reader nothing.
          Scope: `${r.Entity ?? 'record'}: ${r.TargetName ?? `${r.RecordID.slice(0, 8)}…`}`,
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
      const res = await rv.RunView<LinkRecord>(
        {
          EntityName: LINK_ENTITY,
          Fields: ['ID', 'GLAccountRole', 'GLAccountRoleID', 'GLAccount', 'GLAccountID', 'Entity', 'EntityID', 'RecordID', 'Status', 'StartedAt', 'EndedAt'],
          OrderBy: 'GLAccountRole ASC, StartedAt DESC',
          ResultType: 'simple',
        },
        this.ProviderToUse.CurrentUser,
      );
      if (!res.Success) throw new Error(res.ErrorMessage ?? 'could not load account links');
      // Name each link's target off the engine caches Config just loaded — no extra round-trip.
      this.Rows = (res.Results ?? []).map((r) => ({ ...r, TargetName: this.targetNameFor(r.Entity, r.RecordID) }));

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
