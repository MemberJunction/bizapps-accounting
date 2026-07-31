import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { MJEmptyStateComponent } from '@memberjunction/ng-ui-components';

/**
 * Honest placeholder for a rail page that the UI wave has not built yet.
 *
 * The nav shape is APPROVED (design record navigation map) and the rail renders it in full, so a
 * user can see where the app is going. A page that isn't built says so plainly rather than
 * rendering an empty grid that reads as "no data" — which would be a lie about the state of the
 * system, and is exactly the failure the workspace's honesty rule targets.
 *
 * Every one of these is a tracked gap, not a design: they disappear as the UI wave proceeds.
 *
 * STANDALONE (unlike its sibling pages): orders' shell imports it directly, and MJ prefers
 * standalone for leaf components. Both apps' rails render the same placeholder rather than two.
 */
@Component({
  standalone: true,
  selector: 'mj-shell-page-pending',
  imports: [MJEmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mj-empty-state
      Icon="fa-solid fa-helmet-safety"
      [Title]="PageName + ' — not built yet'"
      Message="This screen is part of the approved design and is being built in the current UI wave. It is listed here so the navigation matches the agreed shape; there is no data behind it yet.">
    </mj-empty-state>
  `,
})
export class ShellPagePendingComponent {
  @Input() PageName = 'This screen';
}
