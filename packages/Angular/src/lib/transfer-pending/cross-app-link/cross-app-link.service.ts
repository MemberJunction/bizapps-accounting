import { Injectable, inject } from '@angular/core';
import { Metadata, LogError } from '@memberjunction/core';
import { NavigationService } from '@memberjunction/ng-shared';

/**
 * Cross-app deep linking — "Fix this in Accounting → Account links", for real.
 *
 * ⚠ THE THING THIS EXISTS TO GET RIGHT: **Explorer is a tabbed SPA, not a set of URLs.** A
 * `/app/<app>/<NavItem>` URL only works on a COLD load, because the shell bootstraps its tab from
 * the address bar. Once the shell is running, changing the URL does not navigate — navigation means
 * asking `NavigationService` to open or switch a TAB. (MJ's Explorer guide is explicit: components
 * MUST use NavigationService and must never import `Router`.)
 *
 * So a cross-app "link" cannot be an `<a href>`. It is a call to
 * `NavigationService.OpenNavItemByName(navItemName, config, appId, options)`, which resolves the
 * target app, finds the nav item by its LABEL, and opens it as a tab — the same call Explorer's own
 * chat resource uses to hop to another app's nav item.
 *
 * Both apps' plans specify these links (orders §13.1's Confirm-failure "Fix in Accounting → Account
 * links"; §0 lists a shared cross-app deep-link helper targeted at MJ base) — hence this parked,
 * framework-clean helper: it knows nothing about accounting or orders, only about app + nav-item
 * names.
 *
 * PARKED (transfer-pending): no app-specific imports. TRANSFER-BACKLOG target: MJ base.
 *
 * CONNECTS TO:
 *   MJ: NavigationService (@memberjunction/ng-shared) — the ONLY supported navigation seam
 */
@Injectable({ providedIn: 'root' })
export class CrossAppLinkService {
  private nav = inject(NavigationService);

  /**
   * Open a nav item in another (or the same) app, as a tab.
   *
   * @param appName   the Application's Name, e.g. 'Accounting'. Omit for the current app.
   * @param navItemLabel the nav item's LABEL as it appears in DefaultNavItems, e.g. 'Accounts'.
   * @param queryParams optional params applied to the target tab (deep-link state).
   * @returns true when the tab was opened; false when the app or nav item could not be resolved —
   *          callers should keep whatever text they were showing rather than silently doing nothing.
   */
  public async Open(
    appName: string | undefined,
    navItemLabel: string,
    queryParams?: Record<string, string | null>,
  ): Promise<boolean> {
    try {
      const appId = appName ? this.resolveAppId(appName) : undefined;
      // A named app that does not resolve is a REAL failure (renamed/uninstalled app): falling back
      // to "the current app" would open the wrong screen, which is worse than not navigating.
      if (appName && !appId) {
        LogError(`CrossAppLinkService: no application named "${appName}" — cannot open "${navItemLabel}".`);
        return false;
      }
      const tabId = await this.nav.OpenNavItemByName(navItemLabel, undefined, appId, { queryParams });
      if (!tabId) {
        LogError(`CrossAppLinkService: app "${appName ?? '(current)'}" has no nav item labelled "${navItemLabel}".`);
        return false;
      }
      return true;
    } catch (e) {
      LogError(`CrossAppLinkService: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  /** Can this link actually be followed? Lets a caller render a link vs. plain text honestly. */
  public CanOpen(appName: string): boolean {
    return !!this.resolveAppId(appName);
  }

  private resolveAppId(appName: string): string | undefined {
    const md = new Metadata();
    return md.Applications?.find((a) => a.Name?.trim().toLowerCase() === appName.trim().toLowerCase())?.ID;
  }
}
