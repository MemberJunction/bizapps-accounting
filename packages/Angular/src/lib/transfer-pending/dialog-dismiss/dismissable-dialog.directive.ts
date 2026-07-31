import {
  ComponentRef,
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { DiscardConfirmComponent } from './discard-confirm.component';

/**
 * Backdrop-click + Escape dismissal for a scrim-style editor dialog (parked, framework-clean —
 * TRANSFER-BACKLOG target: common -> MJ base).
 *
 * Put it on the SCRIM element (the full-viewport backdrop that contains the card), not the card:
 *
 * ```html
 * <div class="x__scrim" role="dialog" aria-modal="true"
 *      mjDismissableDialog [mjDismissableDialogDirty]="IsDirty" (Dismiss)="CancelEditor()">
 * ```
 *
 * ## The rule it owns (one place, six editors)
 *  - **Clean editor** -> an outside click or Escape closes it immediately. No friction: nothing is lost.
 *  - **Dirty editor** -> it does NOT silently discard. It raises `DiscardConfirmComponent`; only an
 *    explicit "Discard changes" emits `Dismiss`. Typed work is never lost without a prompt.
 *
 * That split is the design ruling: a dialog whose contents are too precious to lose on a stray click
 * is a dialog whose contents deserve a prompt — not a dialog that traps the user inside it.
 *
 * ## Why the press is tracked on mousedown (the classic bug in this pattern)
 * Selecting text inside the card and releasing the mouse outside it fires ONE `click` whose target is
 * the scrim (the common ancestor) — a naive `click`-target check reads that as "clicked outside" and
 * destroys the edit the user was mid-way through selecting. So a dismissal requires BOTH: the press
 * STARTED on the scrim and the release landed on the scrim.
 */
@Directive({
  standalone: true,
  selector: '[mjDismissableDialog]',
})
export class DismissableDialogDirective implements OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private viewContainer = inject(ViewContainerRef);

  /** True when the editor holds unsaved edits — the only thing that turns on the confirm gate. */
  @Input('mjDismissableDialogDirty') Dirty = false;

  /** Emitted when the dialog should close: a clean dismissal, or a confirmed discard. */
  @Output() Dismiss = new EventEmitter<void>();

  /** Set on mousedown; a dismissal is refused unless the press ALSO started on the scrim. */
  private pressStartedOnBackdrop = false;
  private confirmRef: ComponentRef<DiscardConfirmComponent> | null = null;
  private confirmSubs: Subscription[] = [];

  @HostListener('mousedown', ['$event'])
  public OnMouseDown(event: MouseEvent): void {
    this.pressStartedOnBackdrop = event.target === this.host.nativeElement;
  }

  @HostListener('click', ['$event'])
  public OnClick(event: MouseEvent): void {
    // Release landed inside the card -> not an outside click at all.
    if (event.target !== this.host.nativeElement) return;
    // Release landed on the scrim but the press began inside the card -> a selection drag, not a dismiss.
    if (!this.pressStartedOnBackdrop) return;
    this.pressStartedOnBackdrop = false;
    this.attemptDismiss();
  }

  // The param is `Event`, not `KeyboardEvent`: Angular's AOT compiler types a HostListener's
  // `$event` from the DOM event map, and `keydown.escape` is a pseudo-event Angular synthesises —
  // it is not in the map, so `$event` widens to `Event` and a `KeyboardEvent` annotation fails to
  // compile. Note `tsc --noEmit` does NOT catch this (it never checks host bindings); only ngc does.
  @HostListener('document:keydown.escape', ['$event'])
  public OnEscape(event: Event): void {
    // The directive only exists while the dialog is rendered, so this can't fire for a closed editor.
    event.stopPropagation();
    if (this.confirmRef) {
      this.closeConfirm(); // Escape backs out of the gate, it never answers it "discard".
      return;
    }
    this.attemptDismiss();
  }

  ngOnDestroy(): void {
    this.closeConfirm();
  }

  private attemptDismiss(): void {
    if (this.confirmRef) return; // the gate is already up — it owns the decision
    if (!this.Dirty) {
      this.Dismiss.emit();
      return;
    }
    this.openConfirm();
  }

  private openConfirm(): void {
    const ref = this.viewContainer.createComponent(DiscardConfirmComponent);
    this.confirmRef = ref;
    this.confirmSubs = [
      ref.instance.Discard.subscribe(() => {
        this.closeConfirm();
        this.Dismiss.emit();
      }),
      ref.instance.Keep.subscribe(() => this.closeConfirm()),
    ];
  }

  private closeConfirm(): void {
    for (const sub of this.confirmSubs) sub.unsubscribe();
    this.confirmSubs = [];
    this.confirmRef?.destroy();
    this.confirmRef = null;
  }
}
