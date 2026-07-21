import { Injectable } from '@angular/core';
import { UserInfoEngine } from '@memberjunction/core-entities';

/** The user-setting key holding the rail's collapsed state. Shared by BOTH apps deliberately. */
const RAIL_COLLAPSED_SETTING = 'mj.bizapps.shell.railCollapsed';

/**
 * Shared, app-wide collapse state for the nav rail.
 *
 * ## Why this exists (Marcelo 2026-07-21: "the collapse must be scoped app-wide — switching top-bar
 *    nav items shouldn't change it")
 * Every top-nav category shell renders its OWN `<mj-shell-rail>` instance. When the collapse state
 * lived as a FIELD on the component, each instance had its own copy: switching category mounted a
 * fresh rail that started at the default (expanded) and only restored from UserInfoEngine in an async
 * `ngOnInit` — so a collapsed rail visibly flipped back to expanded on every category switch.
 *
 * Holding the state HERE — one `providedIn: 'root'` singleton per app — makes every rail instance read
 * and write the SAME live value SYNCHRONOUSLY. Switching category now paints the correct width on the
 * first frame (no async flash, no reset). The setting still persists via UserInfoEngine (MJ rule #9 —
 * server-side, per-user, cross-device; never localStorage); we load it once, then serve from memory.
 */
@Injectable({ providedIn: 'root' })
export class ShellRailStateService {
  private _collapsed = false;
  private _loaded = false;

  /** The live, shared collapsed state — synchronous, so a freshly-mounted rail paints it immediately. */
  public get Collapsed(): boolean {
    return this._collapsed;
  }

  /**
   * Load the persisted state ONCE (the first rail to mount). Idempotent + cheap thereafter: a no-op
   * when already loaded, and `Config(false)` is a no-op when another feature already loaded the engine,
   * so `GetSetting` is then a synchronous cache hit.
   */
  public async EnsureLoaded(): Promise<void> {
    if (this._loaded) return;
    await UserInfoEngine.Instance.Config(false);
    this._collapsed = UserInfoEngine.Instance.GetSetting(RAIL_COLLAPSED_SETTING) === 'true';
    this._loaded = true;
  }

  /** Flip the shared state and persist it (debounced — a user flicking the rail must not hammer the DB). */
  public Toggle(): void {
    this._collapsed = !this._collapsed;
    UserInfoEngine.Instance.SetSettingDebounced(RAIL_COLLAPSED_SETTING, String(this._collapsed));
  }
}
