import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MJButtonDirective, MJDialogActionsComponent, MJDialogComponent } from '@memberjunction/ng-ui-components';
import { RetryConfirmState } from './retry-confirm-dialog.state';

/**
 * The retry confirmation for a Failed batch, shared by Dispatch status and the Batches overview
 * (#466). It renders a `RetryConfirmState` the host owns and tells the host when the operator
 * confirms or closes; the host runs the retry with the operator's word that the batch has not posted.
 * An unsettled lookup gets one dialog; a `Mismatch` gets a stronger one whose override waits for the
 * retyped batch number and whose Cancel stays the default action (#398).
 */
@Component({
  standalone: true,
  selector: 'mja-retry-confirm-dialog',
  imports: [FormsModule, MJButtonDirective, MJDialogComponent, MJDialogActionsComponent],
  templateUrl: './retry-confirm-dialog.component.html',
  styleUrls: ['./retry-confirm-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class RetryConfirmDialogComponent {
  @Input({ required: true }) State!: RetryConfirmState;

  /** The operator confirmed the batch has not posted; retry it. */
  @Output() Confirm = new EventEmitter<void>();
  /** The operator closed the dialog without retrying. */
  @Output() Dismiss = new EventEmitter<void>();

  public OnConfirm(): void {
    if (this.State.CanConfirm) this.Confirm.emit();
  }

  public OnDismiss(): void {
    this.Dismiss.emit();
  }
}
