import { Directive, ChangeDetectorRef, inject } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { MJLeftNavItem, MJLeftNavSection, MJStatBadgeVariant } from '@memberjunction/ng-ui-components';
import { CompanyScopeService } from '../shared/company-scope.service';
import { PageRefreshService } from '../../transfer-pending/shell-refresh/page-refresh.service';

/** One composite, category-level stat chip in the shell header. */
export interface ShellHeaderStat {
  Label: string;
  Icon?: string;
  Variant?: MJStatBadgeVariant;
  /** Says what the number MEANS — the chip alone is just a figure. */
  Tooltip?: string;
}

/**
 * Shared behaviour for the five category shells (UI plan §8.0).
 *
 * A "category" is an Explorer app nav item (`DefaultNavItems` metadata). Its DriverClass resolves to
 * a thin shell that hosts the left nav + the category's pages. Explorer owns the TOP nav; everything
 * below it is ours, so page switching inside a category is local state — not the Angular router
 * (Explorer resources are not routed components).
 *
 * **The rail is MJ's `<mj-left-nav>`, not a bespoke one** (UI plan §8 MJ-wins rule). MJ already
 * ships the idiom — labelled sections, badges, active state, `[header]`/`[footer]` slots (the scope
 * chip goes in `[header]`), and a responsive mobile drawer. The approved mockup drew a custom rail;
 * mockups are directionally, not pixel, binding. The one mockup affordance `mj-left-nav` lacks is
 * desktop icons-only collapse — raised upstream rather than forked (plans/QUESTIONS.md#q27).
 *
 * Subclasses supply `RailSections` + `DefaultPageId` and render their pages with an `@switch` over
 * `ActivePageId`. Everything else lives here so it exists once.
 */
@Directive()
export abstract class CategoryShellBase extends BaseDashboard {
  protected cdr = inject(ChangeDetectorRef);
  public Scope = inject(CompanyScopeService);
  /** Provided per shell (see the component's `providers`), so two open categories stay independent. */
  public PageRefresh = inject(PageRefreshService);

  /** The rail this category renders (MJ left-nav sections). */
  public abstract get RailSections(): MJLeftNavSection[];

  /** The page shown when the category is first opened. */
  protected abstract get DefaultPageId(): string;

  /** Human name of the category — the mobile drawer's title. */
  public abstract get CategoryTitle(): string;

  public ActivePageId = '';

  /** Runs once at creation, before loadData. Seed the landing page so the rail renders active. */
  protected initDashboard(): void {
    this.ActivePageId = this.DefaultPageId;
  }

  /**
   * BaseDashboard calls this on init and on Refresh(); it calls NotifyLoadComplete for us after the
   * first run (which is what clears Explorer's loading screen on a direct deep link).
   */
  protected async loadData(): Promise<void> {
    if (!this.ActivePageId) this.ActivePageId = this.DefaultPageId;
    await this.Scope.Load(this.ProviderToUse.CurrentUser, this.ProviderToUse);
    await this.loadCategoryData();
    this.cdr.markForCheck();
  }

  /** Per-category init (e.g. rail badge counts). Default: nothing. */
  protected async loadCategoryData(): Promise<void> {
    // Intentionally empty — most categories need nothing beyond the scope.
  }

  /** mj-left-nav emits the whole item; the shell only cares about its id. */
  public OnRailItemClicked(item: MJLeftNavItem): void {
    this.GoToPage(item.id);
  }

  /**
   * A record id handed to the page being opened — how one page opens another ON a specific record
   * (Catalog's "Edit" → the Product workshop for that product).
   *
   * Deliberately a plain string, not a route param: page switching inside a category is local state
   * (Explorer resources are not routed components), so there is nowhere else to put it. Cleared on
   * every switch so a later plain rail click can never resurrect a stale record.
   */
  public PageParam: string | null = null;

  public GoToPage(pageId: string, param: string | null = null): void {
    if (this.ActivePageId === pageId && this.PageParam === param) return;
    this.ActivePageId = pageId;
    this.PageParam = param;
    this.cdr.markForCheck();
  }

  /**
   * The header's Refresh — reloads ONLY the page in the body.
   *
   * It cannot reach the rail or a background page: the `@switch` means exactly one page is
   * instantiated, so it is the only subscriber (see PageRefreshService).
   */
  public RefreshActivePage(): void {
    this.PageRefresh.RequestRefresh();
  }

  /** Hide the button rather than offer one that does nothing on a page with nothing to reload. */
  public get CanRefreshActivePage(): boolean {
    return this.PageRefresh.HasSubscriber;
  }

  /** Label for a rail page that isn't built yet — read back off the rail so it can't drift. */
  public PendingPageName(pageId: string): string {
    return this.RailItemLabel(pageId) ?? 'This screen';
  }

  /**
   * The ACTIVE page's label. Kept for the mobile drawer + the not-built placeholder — it is NOT the
   * header title (see the header note below).
   */
  public get ActivePageLabel(): string {
    return this.RailItemLabel(this.ActivePageId) ?? this.CategoryTitle;
  }

  /** The active page's icon. */
  public get ActivePageIcon(): string {
    return this.RailItemIcon(this.ActivePageId) ?? this.CategoryIcon;
  }

  /**
   * ── The shell header ──────────────────────────────────────────────────────
   * Marcelo (2026-07-16), revising his earlier call: the header shows the CATEGORY, not the
   * sub-page — *"the tab that we're in is really more descriptive of where we are"*. The sub-page
   * name is already the rail's active item, inches away, so restating it bought nothing. The
   * category is the one piece of context NOT otherwise on screen once you are deep in a page.
   *
   * That frees the header to be useful rather than decorative: it carries the company scope and
   * per-category COMPOSITE STATS — a "through line" that stays meaningful across every sub-page —
   * plus the refresh, which belongs in one reliable place rather than repeated in every body.
   */

  /** Subclasses override to give their category a through-line stat set. Empty = no chips. */
  public get HeaderStats(): ShellHeaderStat[] {
    return [];
  }

  /** The category's icon — subclasses override; used when a page has none. */
  public get CategoryIcon(): string {
    return 'fa-solid fa-table-list';
  }

  private RailItemLabel(pageId: string): string | null {
    for (const section of this.RailSections) {
      const item = section.items.find((i) => i.id === pageId);
      if (item) return item.label;
    }
    return null;
  }

  private RailItemIcon(pageId: string): string | null {
    for (const section of this.RailSections) {
      const item = section.items.find((i) => i.id === pageId);
      if (item?.icon) return item.icon;
    }
    return null;
  }
}
