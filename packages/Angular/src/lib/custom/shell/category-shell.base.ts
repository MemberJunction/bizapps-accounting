import { Directive, ChangeDetectorRef, inject } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { MJLeftNavItem, MJLeftNavSection } from '@memberjunction/ng-ui-components';
import { CompanyScopeService } from '../shared/company-scope.service';

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

  public GoToPage(pageId: string): void {
    if (this.ActivePageId === pageId) return;
    this.ActivePageId = pageId;
    this.cdr.markForCheck();
  }
}
