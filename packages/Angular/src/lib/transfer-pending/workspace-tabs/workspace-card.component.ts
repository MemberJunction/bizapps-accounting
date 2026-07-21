import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceTab } from './workspace-tabs.types';
import { WorkspaceTabStripComponent, TabReorder } from './workspace-tab-strip.component';

/**
 * `mj-workspace-card` — the reusable frame every "workspace" screen shares (JE + batch workspaces,
 * order editor). A THIN, slotted wrapper (Marcelo 2026-07-21): it owns ONLY the invariant chrome —
 *   • the card surface (border + rounded corners + contained scroll),
 *   • the tab-strip row (delegated to `mj-workspace-tab-strip`, which carries all tab behavior),
 *   • an identity band beside the tabs, and
 *   • a single scrollable body —
 * and PROJECTS everything that varies:
 *   • `[workspaceHeader]` — the per-workshop identity band content (JE's number/status/currency badges);
 *   • the default slot — the workshop's form/body.
 *
 * The card deliberately bakes in NO workshop-specific header (no currency badge, no entry-number field);
 * those differ per workshop and are projected. Height chain: `:host` fills its parent (a display:block
 * `mj-page-body-interior`), the card fills the host, the body is the flex:1 scroller — so the BODY
 * scrolls in place while the strip + identity band stay pinned (the compact-workspace feel).
 */
@Component({
  standalone: true,
  selector: 'mj-workspace-card',
  imports: [CommonModule, WorkspaceTabStripComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ws-card" [attr.aria-label]="AriaLabel">
      <header class="ws-card__head">
        <mj-workspace-tab-strip
          [Tabs]="Tabs"
          [ActiveId]="ActiveId"
          [NewTabLabel]="NewTabLabel"
          (TabSelected)="TabSelected.emit($event)"
          (TabClosed)="TabClosed.emit($event)"
          (NewTabRequested)="NewTabRequested.emit()"
          (TabReordered)="TabReordered.emit($event)">
        </mj-workspace-tab-strip>
        <div class="ws-card__headmeta">
          <ng-content select="[workspaceHeader]"></ng-content>
        </div>
      </header>
      <div class="ws-card__body">
        <ng-content></ng-content>
      </div>
    </section>
  `,
  styleUrls: ['./workspace-card.component.css'],
})
export class WorkspaceCardComponent {
  @Input() Tabs: WorkspaceTab[] = [];
  @Input() ActiveId: string | null = null;
  @Input() NewTabLabel = 'New';
  @Input() AriaLabel = 'Workspace';

  @Output() TabSelected = new EventEmitter<string>();
  @Output() TabClosed = new EventEmitter<string>();
  @Output() NewTabRequested = new EventEmitter<void>();
  @Output() TabReordered = new EventEmitter<TabReorder>();
}
