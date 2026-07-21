import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceTab } from './workspace-tabs.types';

/**
 * The workspace tab strip — presentation over `WorkspaceTabStore` (UI plan §8.0).
 *
 * Dumb by design: it renders the tabs it is handed and emits intent. The store holds the state
 * machine (unit-tested on its own); the host owns what a tab's payload means. That split is what
 * keeps this framework-clean and transferable (../README.md).
 *
 * **Browser-tab behavior lives HERE, not in the workshop card** (Marcelo 2026-07-21): every consumer
 * (JE + batch workspaces, order editor, product workshop) gets it for free, even without the card.
 *  - **Pinned new-tab button** — sits at the right of the tabs; once the tabs overflow, the tab LIST
 *    scrolls horizontally *behind* it while the button stays put (Firefox/Chrome new-tab affordance).
 *  - **Fixed-width tabs** — every tab is the SAME width (`--ws-tab-width`), so the close buttons line
 *    up and tabs are easy to X-out / reorder regardless of label length.
 *  - **Fade, not ellipsis** — a long label fades out on the right; the unsaved-dot sits in that same
 *    right zone (absolutely positioned) so a dirty tab is the SAME width as a clean one.
 *  - **Delayed, non-interactive tooltip** — the full label shows only after the pointer holds still
 *    over a *truncated* tab (~`HOVER_DELAY_MS`); it is `pointer-events:none` (never blocks a click)
 *    and leaves the instant the pointer moves again.
 */
const HOVER_DELAY_MS = 450;

@Component({
  standalone: true,
  selector: 'mj-workspace-tab-strip',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ws-tabbar">
      <div class="ws-tabs" role="tablist">
        @for (tab of Tabs; track tab.Id) {
          <div
            class="ws-tab"
            [class.ws-tab--active]="tab.Id === ActiveId"
            [class.ws-tab--rejected]="tab.Status === 'rejected'"
            [class.ws-tab--complete]="tab.Status === 'complete'"
            role="tab"
            [attr.aria-selected]="tab.Id === ActiveId"
            (mouseenter)="OnTabEnter(tab, $event)"
            (mousemove)="OnTabMove()"
            (mouseleave)="OnTabLeave()">
            <button type="button" class="ws-tab__select" (click)="TabSelected.emit(tab.Id)">
              @if (tab.Icon) {
                <i [class]="tab.Icon" aria-hidden="true"></i>
              }
              @if (tab.Status === 'rejected') {
                <i class="fa-solid fa-triangle-exclamation ws-tab__reject-icon" aria-hidden="true"></i>
              }
              <span class="ws-tab__label">{{ tab.Label }}</span>
              @if (tab.Dirty) {
                <span class="ws-tab__dirty" aria-label="unsaved changes">&bull;</span>
              }
            </button>
            <button
              type="button"
              class="ws-tab__close"
              [attr.aria-label]="'Close ' + tab.Label"
              (click)="TabClosed.emit(tab.Id)">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        }
      </div>
      @if (ShowNewTab) {
        <button type="button" class="ws-tabs__new" (click)="NewTabRequested.emit()" [attr.aria-label]="NewTabLabel">
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
          <span class="ws-tabs__new-label">{{ NewTabLabel }}</span>
        </button>
      }
    </div>

    @if (Tooltip) {
      <!-- Non-interactive by construction: pointer-events:none in CSS, positioned in viewport coords.
           It can never sit between the pointer and a control, and it leaves on the next mousemove. -->
      <div class="ws-tab__tooltip" role="tooltip" [style.left.px]="TooltipX" [style.top.px]="TooltipY">
        {{ Tooltip }}
      </div>
    }
  `,
  styleUrls: ['./workspace-tab-strip.component.css'],
})
export class WorkspaceTabStripComponent implements OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  @Input() Tabs: WorkspaceTab[] = [];
  @Input() ActiveId: string | null = null;
  @Input() ShowNewTab = true;
  @Input() NewTabLabel = 'New';

  @Output() TabSelected = new EventEmitter<string>();
  @Output() TabClosed = new EventEmitter<string>();
  @Output() NewTabRequested = new EventEmitter<void>();

  /** The full label shown by the delayed tooltip, or null when hidden. */
  public Tooltip: string | null = null;
  public TooltipX = 0;
  public TooltipY = 0;

  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private hoverEl: HTMLElement | null = null;
  private hoverLabel = '';

  ngOnDestroy(): void {
    this.clearHoverTimer();
  }

  /** Pointer entered a tab — arm the hold-still timer; nothing shows until motion stops. */
  public OnTabEnter(tab: WorkspaceTab, event: MouseEvent): void {
    this.hoverEl = event.currentTarget as HTMLElement;
    this.hoverLabel = tab.Label;
    this.armHoverTimer();
  }

  /** Any motion cancels a shown tooltip and re-arms the timer — it reappears only once the pointer
   *  holds still again. This is what "only after holding still / leaves when you move" means. */
  public OnTabMove(): void {
    if (this.Tooltip !== null) this.hideTooltip();
    this.armHoverTimer();
  }

  public OnTabLeave(): void {
    this.hoverEl = null;
    this.clearHoverTimer();
    this.hideTooltip();
  }

  private armHoverTimer(): void {
    this.clearHoverTimer();
    this.hoverTimer = setTimeout(() => this.showTooltipIfTruncated(), HOVER_DELAY_MS);
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  /** Show the full label ONLY when the on-tab label is actually truncated (Firefox behavior) — a
   *  short label that fully fits needs no redundant tooltip. */
  private showTooltipIfTruncated(): void {
    this.hoverTimer = null;
    const el = this.hoverEl;
    if (!el) return;
    const label = el.querySelector<HTMLElement>('.ws-tab__label');
    if (!label || label.scrollWidth <= label.clientWidth + 1) return; // not truncated → no tooltip
    const rect = el.getBoundingClientRect();
    this.TooltipX = Math.round(rect.left);
    this.TooltipY = Math.round(rect.bottom + 4);
    this.Tooltip = this.hoverLabel;
    this.cdr.markForCheck();
  }

  private hideTooltip(): void {
    if (this.Tooltip === null) return;
    this.Tooltip = null;
    this.cdr.markForCheck();
  }
}
