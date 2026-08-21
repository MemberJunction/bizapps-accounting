import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostBinding, HostListener, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { MJLeftNavComponent, MJLeftNavItem, MJLeftNavSection } from '@memberjunction/ng-ui-components';
import { ShellRailStateService } from './shell-rail-state.service';

/** Hover-to-expand timings (Marcelo 2026-07-21). Enter is delayed so an accidental graze does not pop
 *  the rail open; leave has a small grace so a wobble off the edge doesn't collapse it mid-reach. */
const HOVER_EXPAND_DELAY_MS = 450;
const HOVER_COLLAPSE_DELAY_MS = 160;

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
export class ShellRailComponent implements OnInit, OnDestroy {
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
   *
   * The state itself lives in the APP-WIDE ShellRailStateService (Marcelo 2026-07-21), not as a field
   * here — otherwise each category's own rail instance keeps its own copy and switching top-nav
   * categories resets it. Reading through the service means every rail reflects the same live value.
   */
  private railState = inject(ShellRailStateService);
  public get Collapsed(): boolean {
    return this.railState.Collapsed;
  }

  /**
   * Hover-to-expand (Marcelo 2026-07-21): while COLLAPSED, hovering the rail (after a delay) expands it
   * as an OVERLAY that floats over the content — it does NOT change the reserved layout width, so the
   * body never shifts. Transient (not persisted): mouse-only, desktop-only (the mobile drawer is its own
   * thing). Superseded the earlier no-hover ruling now that overlay + delay remove the "moves the target
   * you were aiming at" problem the old instant-hover would have had.
   *
   * OFF BY DEFAULT (Marcelo 2026-07-30): the machinery stays (cleanly gated here), but no shell opts in
   * today — the toggle is the affordance. Re-enable per-shell with `[HoverPeek]="true"` if it earns its
   * way back.
   */
  @Input() HoverPeek = false;
  public HoverExpanded = false;
  private enterTimer: ReturnType<typeof setTimeout> | null = null;
  private leaveTimer: ReturnType<typeof setTimeout> | null = null;

  /** The rail is visually wide when the user expanded it OR when a collapsed rail is hover-peeked. */
  private get ShowingWide(): boolean {
    return !this.Collapsed || this.HoverExpanded;
  }

  /**
   * True exactly when the rail is showing icons with NO labels — the same condition as the
   * `.sr--collapsed` class, expressed once so the two can't drift. Drives `mj-left-nav`'s `IconOnly`,
   * which turns on per-item tooltips + accessible names. Hover-peek is deliberately excluded: while
   * peeking, the labels are back on screen, so a tooltip would just repeat what the user can read.
   */
  public get IconOnly(): boolean {
    return !this.ShowingWide;
  }

  /**
   * The width the nav renders at. 60px is the collapsed rail (MJ's own numbers: rail padding 8+8, item
   * padding 12+12, icon 18, border 1 — derived so it stays exact if MJ retunes them); 240px expanded.
   */
  public get RailWidth(): number {
    return this.ShowingWide ? 240 : 60;
  }

  /** Host reserves the COLLAPSED footprint while hover-peeking, so the overlay never pushes the body. */
  @HostBinding('class.sr-collapsed') get isCollapsedHost(): boolean { return this.Collapsed; }
  @HostBinding('class.sr-peeking') get isPeeking(): boolean { return this.Collapsed && this.HoverExpanded; }

  @HostListener('mouseenter')
  onRailEnter(): void {
    if (!this.HoverPeek) return; // feature gated off by default (Marcelo 2026-07-30)
    if (!this.Collapsed) return; // expanded rail has nothing to peek
    this.clearTimers();
    this.enterTimer = setTimeout(() => { this.HoverExpanded = true; this.cdr.markForCheck(); }, HOVER_EXPAND_DELAY_MS);
  }

  @HostListener('mouseleave')
  onRailLeave(): void {
    this.clearTimers();
    if (!this.HoverExpanded) return;
    this.leaveTimer = setTimeout(() => { this.HoverExpanded = false; this.cdr.markForCheck(); }, HOVER_COLLAPSE_DELAY_MS);
  }

  private clearTimers(): void {
    if (this.enterTimer) { clearTimeout(this.enterTimer); this.enterTimer = null; }
    if (this.leaveTimer) { clearTimeout(this.leaveTimer); this.leaveTimer = null; }
  }

  /** Picking a destination dismisses the hover-peek immediately (the overlay has served its purpose). */
  public onItemClicked(item: MJLeftNavItem): void {
    if (this.HoverExpanded) { this.clearTimers(); this.HoverExpanded = false; }
    this.ItemClicked.emit(item);
  }

  public ngOnDestroy(): void {
    this.clearTimers();
  }

  public get ToggleLabel(): string {
    return this.Collapsed ? 'Expand navigation' : 'Collapse navigation';
  }

  public async ngOnInit(): Promise<void> {
    // Load the persisted state ONCE via the shared service (MJ rule #9: UserInfoEngine, server-side +
    // cross-device, never localStorage). After the first rail loads it, every later category's rail
    // reads the same in-memory value synchronously — so switching categories never resets the collapse.
    await this.railState.EnsureLoaded();
    this.cdr.markForCheck();
  }

  public Toggle(): void {
    // Flip + persist through the shared service, so ALL rail instances (every category) reflect it live.
    this.railState.Toggle();
    // A deliberate collapse click OVERRIDES an in-progress hover-peek: cancel the peek + its timers so the
    // rail snaps shut instantly instead of staying open because the pointer is still over it (Marcelo).
    this.clearTimers();
    this.HoverExpanded = false;
    this.cdr.markForCheck();
  }
}
