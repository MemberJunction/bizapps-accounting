import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';

/**
 * The "you have unsaved edits" gate a dismissable dialog raises before it throws typed work away.
 *
 * Created dynamically by `DismissableDialogDirective` — never placed in a page template — so the
 * dismiss rule lives in ONE place and every roster editor gets the same wording and the same
 * default (keep, not discard).
 */
@Component({
  standalone: true,
  selector: 'mj-discard-confirm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dc__scrim" role="dialog" aria-modal="true" aria-label="Discard unsaved changes?">
      <div class="dc__card">
        <h3 class="dc__title">Discard your changes?</h3>
        <p class="dc__body">This editor has edits that have not been saved. Closing it will throw them away.</p>
        <div class="dc__actions">
          <button class="mj-btn mj-btn--outline" type="button" (click)="Keep.emit()">Keep editing</button>
          <button class="mj-btn mj-btn--danger" type="button" (click)="Discard.emit()">Discard changes</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .dc__scrim {
        position: fixed;
        inset: 0;
        /* Above the editor scrim (1000) it is gating. */
        z-index: 1100;
        background: var(--mj-bg-overlay);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .dc__card {
        background: var(--mj-bg-surface);
        border: 1px solid var(--mj-border-default);
        border-radius: 10px;
        padding: 18px 20px;
        max-width: 420px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .dc__title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--mj-text-primary);
      }
      .dc__body {
        margin: 0;
        font-size: 13px;
        color: var(--mj-text-secondary);
      }
      .dc__actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 4px;
      }
    `,
  ],
})
export class DiscardConfirmComponent {
  /** The user chose to throw the edits away. */
  @Output() Discard = new EventEmitter<void>();
  /** The user chose to go back to the editor — the safe default. */
  @Output() Keep = new EventEmitter<void>();
}
