import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';

/** What the operator asked for: reverse this entry, with this reason. */
export interface JEReversalRequest {
  Reason: string;
}

/**
 * `<mjacc-je-reversal-panel>` — the "Generate Reversal" affordance.
 *
 * **Layer 1.** It renders a verb and collects a reason. It does not decide *whether* the verb
 * is legal — `[CanReverse]` and `[BlockedReason]` come from the L0 rules
 * (`canReverse` / `reversalBlockedReason`), which mirror the server guard and are unit-tested
 * against it. A widget that re-derived the rule would be a second definition, and second
 * definitions drift: the Explorer form previously gated reversal on `Status === 'GLPosted'`,
 * which both **refused** reversals the server allows (a Batched entry) and **offered**
 * reversals the server rejects (a reversal of a reversal).
 *
 * When the verb is unavailable the button stays visible and disabled with the reason as its
 * tooltip, rather than vanishing — a control that disappears teaches nobody why.
 *
 * ## Example
 * ```html
 * <mjacc-je-reversal-panel
 *   [CanReverse]="CanReverse"
 *   [BlockedReason]="ReverseBlockedReason"
 *   [Busy]="IsReversing"
 *   (ReversalRequested)="reverse($event)" />
 * ```
 */
@Component({
  selector: 'mjacc-je-reversal-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MJButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!IsOpen) {
      <button
        type="button"
        mjButton
        variant="warning"
        size="sm"
        [disabled]="!CanReverse || Busy"
        [title]="BlockedReason ?? 'Create an offsetting entry with the debits and credits swapped'"
        (click)="Open()">
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Generate Reversal
      </button>
    } @else {
      <div class="jerp__form">
        <label class="jerp__label" [attr.for]="ReasonInputId">Reason</label>
        <input
          class="mj-input jerp__reason"
          [id]="ReasonInputId"
          [(ngModel)]="Reason"
          name="reversalReason"
          [disabled]="Busy"
          placeholder="Why is this entry being reversed? (optional)" />
        <button type="button" mjButton variant="primary" size="sm" [disabled]="Busy" (click)="Confirm()">
          @if (Busy) {
            <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Reversing…
          } @else {
            <i class="fa-solid fa-check" aria-hidden="true"></i> Confirm
          }
        </button>
        <button type="button" mjButton variant="flat" size="sm" [disabled]="Busy" (click)="Cancel()">Cancel</button>
      </div>
    }
  `,
  styles: [
    `
      .jerp__form {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .jerp__label {
        font-size: var(--mj-text-sm);
        color: var(--mj-text-secondary);
      }
      .jerp__reason {
        min-width: 240px;
        flex: 1 1 240px;
      }
    `,
  ],
})
export class JEReversalPanelComponent {
  /** Whether the verb is legal for this entry. Comes from the L0 rule, never computed here. */
  @Input() CanReverse = false;

  /** Why it is not legal, when it isn't. Shown as the disabled button's tooltip. */
  @Input() BlockedReason: string | null = null;

  /** A reversal is in flight. Locks the form without unmounting it. */
  @Input() Busy = false;

  /** Distinct id so the label binds correctly when several panels share a page. */
  @Input() ReasonInputId = 'jerp-reason';

  /** The operator confirmed. The host performs the reversal. */
  @Output() ReversalRequested = new EventEmitter<JEReversalRequest>();

  /** The operator backed out before confirming. Lets a host clear a stale message. */
  @Output() ReversalDismissed = new EventEmitter<void>();

  public IsOpen = false;
  public Reason = '';

  public Open(): void {
    if (!this.CanReverse || this.Busy) return;
    this.IsOpen = true;
  }

  public Cancel(): void {
    if (this.Busy) return;
    this.IsOpen = false;
    this.Reason = '';
    this.ReversalDismissed.emit();
  }

  public Confirm(): void {
    if (this.Busy) return;
    this.ReversalRequested.emit({ Reason: this.Reason.trim() });
  }

  /**
   * Called by the host once the request settles. On success the form closes; on failure it
   * stays open with the typed reason intact, so a transient error does not cost the operator
   * their words.
   */
  public Settle(success: boolean): void {
    if (!success) return;
    this.IsOpen = false;
    this.Reason = '';
  }
}
