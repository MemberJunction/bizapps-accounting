import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { buildJETimeline, type JEStatus, type JETimelineStep } from './je-view-models';

/**
 * `<mjacc-je-status-timeline>` — the Pending → Batched → GL Posted progression.
 *
 * **Layer 1.** One input, no outputs, no injected services, no data access. Rendering a
 * timeline for a given status is a total function of that status, so this component is a
 * total function of its input — which is exactly what makes it droppable into a form, a
 * slide-in, a list row, or a test.
 *
 * ## Example
 * ```html
 * <mjacc-je-status-timeline [Status]="'Batched'" />
 * ```
 */
@Component({
  selector: 'mjacc-je-status-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jest" role="list" aria-label="Journal entry status">
      @for (step of Steps; track step.Key; let last = $last) {
        <div
          class="jest__step"
          role="listitem"
          [attr.aria-current]="step.Current ? 'step' : null"
          [class.jest__step--done]="step.Done"
          [class.jest__step--current]="step.Current">
          <span class="jest__dot"><i [class]="step.Icon" aria-hidden="true"></i></span>
          <span class="jest__label">{{ step.Label }}</span>
        </div>
        @if (!last) {
          <span class="jest__sep" [class.jest__sep--done]="step.Done" aria-hidden="true"></span>
        }
      }
    </div>
  `,
  styles: [
    `
      /* Design tokens only — no hardcoded colors (MJ design-token rule). */
      .jest {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .jest__step {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--mj-text-muted);
        white-space: nowrap;
      }
      .jest__label {
        font-size: var(--mj-text-sm);
      }
      .jest__step--done {
        color: var(--mj-text-primary);
      }
      .jest__step--current .jest__label {
        font-weight: var(--mj-font-semibold);
      }
      .jest__dot {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: var(--mj-radius-full);
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface-card);
        font-size: var(--mj-text-xs);
      }
      .jest__step--done .jest__dot {
        border-color: color-mix(in srgb, var(--mj-brand-primary) 40%, var(--mj-border-default));
        background: color-mix(in srgb, var(--mj-brand-primary) 12%, var(--mj-bg-surface));
        color: var(--mj-brand-primary);
      }
      .jest__step--current .jest__dot {
        border-color: var(--mj-brand-primary);
        background: color-mix(in srgb, var(--mj-brand-primary) 18%, var(--mj-bg-surface));
      }
      .jest__sep {
        width: 28px;
        height: 2px;
        background: var(--mj-border-default);
        border-radius: var(--mj-radius-full);
      }
      .jest__sep--done {
        background: color-mix(in srgb, var(--mj-brand-primary) 40%, var(--mj-border-default));
      }
    `,
  ],
})
export class JEStatusTimelineComponent {
  /**
   * Where the entry is. Setter-computed rather than a template call so the (pure but
   * non-trivial) timeline build happens on change, not on every change-detection pass.
   */
  @Input()
  set Status(value: JEStatus) {
    this._status = value;
    this.Steps = buildJETimeline(value);
  }
  get Status(): JEStatus {
    return this._status;
  }
  private _status: JEStatus = 'Pending';

  public Steps: JETimelineStep[] = buildJETimeline('Pending');
}
