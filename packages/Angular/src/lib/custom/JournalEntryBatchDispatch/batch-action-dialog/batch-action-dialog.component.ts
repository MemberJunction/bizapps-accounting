import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MJButtonDirective, MJDialogActionsComponent, MJDialogComponent } from '@memberjunction/ng-ui-components';
import { BatchActionDialogState } from './batch-action-dialog.state';

/**
 * The one Reject / Archive / Cancel dialog for the batch screens: Batch approvals, Dispatch status and
 * the Batches overview (#405). An mj-dialog, not window.prompt, which the desktop Explorer does not
 * support. It renders a `BatchActionDialogState` the host owns and tells the host when the operator
 * confirms or closes; the host runs the server call. The confirm action is on the left and Keep
 * batch on the right; past a `Mismatch`, Keep batch becomes the primary (default) action.
 */
@Component({
  standalone: true,
  selector: 'mja-batch-action-dialog',
  imports: [FormsModule, MJButtonDirective, MJDialogComponent, MJDialogActionsComponent],
  templateUrl: './batch-action-dialog.component.html',
  styleUrls: ['./batch-action-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class BatchActionDialogComponent {
  @Input({ required: true }) State!: BatchActionDialogState;

  /** The operator confirmed; read the reason and the ERP confirmation from `State`. */
  @Output() Confirm = new EventEmitter<void>();
  /** The operator closed the dialog without acting. */
  @Output() Dismiss = new EventEmitter<void>();

  public OnConfirm(): void {
    if (this.State.CanConfirm) this.Confirm.emit();
  }

  public OnDismiss(): void {
    if (!this.State.Busy) this.Dismiss.emit();
  }
}
