import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * The shell header's Refresh button → the page currently in the body.
 *
 * WHY THIS IS PAGE-AWARE FOR FREE (Marcelo: "refresh the current body, not every single page in
 * the category"): the category shell renders its pages through an `@switch`, so exactly ONE page
 * component is instantiated at a time — the others are destroyed, not hidden. A component
 * subscribes on init and Angular tears the subscription down on destroy, so a refresh signal can
 * only ever reach the mounted page. There is no page registry to keep in sync and no way for a
 * background page to receive it.
 *
 * It also cannot touch the rail: the rail is not a subscriber.
 *
 * Pages OPT IN — a page that doesn't subscribe simply isn't refreshable, which is correct for ones
 * with nothing to reload (e.g. an unbuilt placeholder). The header hides the button in that case
 * rather than offering a control that does nothing (`HasSubscriber`).
 *
 * Scoped per shell instance (provided by the category shell), NOT root: two categories open in two
 * Explorer tabs must not refresh each other.
 *
 * PARKED (transfer-pending): framework-clean, no app imports. TRANSFER-BACKLOG target: MJ base —
 * every left-nav shell has this same "refresh what I'm looking at" need.
 */
@Injectable()
export class PageRefreshService {
  private refresh$ = new Subject<void>();
  private subscribers = 0;

  /** True when the mounted page can actually be refreshed — the header uses this to show/hide. */
  public get HasSubscriber(): boolean {
    return this.subscribers > 0;
  }

  /**
   * Subscribe the mounted page. Unsubscribing (on destroy) decrements, so the count tracks the
   * live page rather than every page that ever mounted.
   */
  public OnRefresh(handler: () => void): { unsubscribe: () => void } {
    this.subscribers++;
    const sub = this.refresh$.subscribe(handler);
    return {
      unsubscribe: () => {
        this.subscribers = Math.max(0, this.subscribers - 1);
        sub.unsubscribe();
      },
    };
  }

  public get Refresh$(): Observable<void> {
    return this.refresh$.asObservable();
  }

  /** Fired by the shell header's Refresh button. */
  public RequestRefresh(): void {
    this.refresh$.next();
  }
}
