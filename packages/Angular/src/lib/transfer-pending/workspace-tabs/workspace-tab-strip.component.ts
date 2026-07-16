import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceTab } from './workspace-tabs.types';

/**
 * The workspace tab strip — presentation over `WorkspaceTabStore` (UI plan §8.0).
 *
 * Dumb by design: it renders the tabs it is handed and emits intent. The store holds the state
 * machine (and is unit-tested on its own); the host owns what a tab's payload means. That split is
 * what keeps this framework-clean and transferable (../README.md).
 */
@Component({
  standalone: true,
  selector: 'mj-workspace-tab-strip',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ws-tabs" role="tablist">
      @for (tab of Tabs; track tab.Id) {
        <div
          class="ws-tab"
          [class.ws-tab--active]="tab.Id === ActiveId"
          [class.ws-tab--rejected]="tab.Status === 'rejected'"
          [class.ws-tab--complete]="tab.Status === 'complete'"
          role="tab"
          [attr.aria-selected]="tab.Id === ActiveId"
          [title]="TooltipFor(tab)">
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
      @if (ShowNewTab) {
        <button type="button" class="ws-tabs__new" (click)="NewTabRequested.emit()" [title]="NewTabLabel">
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
          <span>{{ NewTabLabel }}</span>
        </button>
      }
    </div>
  `,
  styleUrls: ['./workspace-tab-strip.component.css'],
})
export class WorkspaceTabStripComponent {
  @Input() Tabs: WorkspaceTab[] = [];
  @Input() ActiveId: string | null = null;
  @Input() ShowNewTab = true;
  @Input() NewTabLabel = 'New';

  @Output() TabSelected = new EventEmitter<string>();
  @Output() TabClosed = new EventEmitter<string>();
  @Output() NewTabRequested = new EventEmitter<void>();

  /** A rejected tab carries its reason as the tooltip so the "why" travels with the tab. */
  public TooltipFor(tab: WorkspaceTab): string {
    if (tab.Status === 'rejected' && tab.RejectionReason) return `Rejected — ${tab.RejectionReason}`;
    return tab.Label;
  }
}
