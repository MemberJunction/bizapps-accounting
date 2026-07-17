import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { MJLeftNavComponent, MJLeftNavItem, MJLeftNavSection } from '@memberjunction/ng-ui-components';

/** The user-setting key holding the rail's collapsed state. Shared by BOTH apps deliberately. */
const RAIL_COLLAPSED_SETTING = 'mj.bizapps.shell.railCollapsed';

/**
 * The category shells' nav rail — MJ's `<mj-left-nav>` plus the one affordance it does not ship:
 * a desktop icons-only collapse.
 *
 * ## Why this component exists at all
 * Nine category shells (five accounting, four orders) rendered an IDENTICAL `<mj-left-nav>` block.
 * Collapse needs state + persistence + a toggle + collapsed styling; adding that nine times would
 * be nine copies to keep in step. This wraps it once and every shell swaps one element for another.
 *
 * ## Why we are not forking MJ's rail
 * `mj-left-nav` has no `[Collapsed]` input — checked the component source, not just the docs. MJ's
 * OWN Data Explorer wanted the same affordance and answered it by hand-rolling a SEPARATE
 * navigation-panel (`[collapsed]` in, `(toggleCollapse)` out, parent owns state + persistence). So
 * MJ has two rails and only the bespoke one collapses. That is the argument for making it native —
 * `plans/QUESTIONS.md#q27` asks for it. Until then the collapse lives here, in OUR wrapper, and
 * this whole component thins to a pass-through the day MJ ships `[Collapsed]`.
 *
 * ## What was checked before overriding any MJ chrome (the lesson from the .mj-btn + title misses)
 * Read `left-nav.component.ts`'s stylesheet end to end first:
 *  - **`@media (max-width: 700px)` turns the rail into a fixed off-canvas drawer** with
 *    `width: min(320px, 84vw) !important` and `:host { width: 100% !important }`. MJ's `!important`
 *    already defends the WIDTH from us — but nothing defends the labels, so every collapsed rule
 *    below is scoped to `min-width: 701px`. Collapsing a drawer would be nonsense: it is already
 *    dismissable, and the switcher + drawer header are the mobile answer.
 *  - `prefers-reduced-motion: reduce` kills the drawer's transform transition — untouched here.
 *  - The drawer header is `position: sticky` inside the rail's own scroll container — which is why
 *    the toggle below sits OUTSIDE `<mj-left-nav>` rather than in its `[footer]` slot: the footer
 *    slot renders inside `overflow-y: auto`, so it would scroll away with the content instead of
 *    staying put, and pinning it would mean restyling MJ's rail into a flex column.
 */
// STANDALONE, unlike the shells that host it. Both apps' shell modules use this component, and a
// module-declared component can only be shared by importing the whole declaring NgModule — which
// would drag accounting's entire ShellModule into orders. Standalone is also what MJ rule #4 asks
// for on a new leaf component, and matches how ui-components itself ships.
@Component({
  standalone: true,
  imports: [MJLeftNavComponent],
  selector: 'mj-shell-rail',
  templateUrl: './shell-rail.component.html',
  styleUrls: ['./shell-rail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellRailComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  /** Passed straight through to `mj-left-nav`. */
  @Input() Sections: MJLeftNavSection[] = [];
  @Input() ActiveId: string | null = null;
  @Input() MobileTitle = 'Menu';

  /** Re-emitted from `mj-left-nav` untouched — the shell still owns page switching. */
  @Output() ItemClicked = new EventEmitter<MJLeftNavItem>();

  /**
   * Collapsed = icons only. Marcelo's ruling (2026-07-16): default EXPANDED, and a plain toggle —
   * no pin/auto-expand-on-hover. A rail that expands when the pointer grazes it moves the target
   * you were aiming at; deliberate is better than clever.
   */
  public Collapsed = false;

  /**
   * 60px is the collapsed rail: MJ's own numbers, not a guess — rail padding 8+8, item padding
   * 12+12, icon 18, border 1. Derived rather than eyeballed so it stays exact if MJ retunes them.
   */
  public get RailWidth(): number {
    return this.Collapsed ? 60 : 240;
  }

  public get ToggleLabel(): string {
    return this.Collapsed ? 'Expand navigation' : 'Collapse navigation';
  }

  public async ngOnInit(): Promise<void> {
    // MJ rule #9: preferences go through UserInfoEngine (server-side, per-user, cross-device),
    // NEVER localStorage — which dies on a browser switch or a second machine. Config() is a no-op
    // when another feature already loaded it; GetSetting is then a synchronous cache hit.
    await UserInfoEngine.Instance.Config(false);
    this.Collapsed = UserInfoEngine.Instance.GetSetting(RAIL_COLLAPSED_SETTING) === 'true';
    this.cdr.markForCheck();
  }

  public Toggle(): void {
    this.Collapsed = !this.Collapsed;
    // Debounced: a user flicking the rail should not hammer the DB. Fire-and-forget is right here —
    // if the write loses, the rail is still correct for this session and re-asserts on the next toggle.
    UserInfoEngine.Instance.SetSettingDebounced(RAIL_COLLAPSED_SETTING, String(this.Collapsed));
    this.cdr.markForCheck();
  }
}
