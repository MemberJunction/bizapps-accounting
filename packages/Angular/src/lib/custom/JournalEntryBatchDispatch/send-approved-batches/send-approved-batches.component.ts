import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Metadata } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { MJButtonDirective, MJDialogActionsComponent, MJDialogComponent } from '@memberjunction/ng-ui-components';
import { JournalEntryBatchDispatchClient, SendApprovedBatchOutcome } from '../journal-entry-batch-dispatch.client';

/** Where the dialog is: closed, asking to confirm, waiting on the server, or showing each batch's result. */
export type SendApprovedBatchesPhase = 'closed' | 'confirm' | 'sending' | 'results';

/** "1 batch" / "3 batches". */
export function BatchCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'batch' : 'batches'}`;
}

/**
 * The Batches page's "Send approved batches" button (bc-aidp-next-golive#451): sends every Approved
 * batch to its ERP now through `Accounting.DispatchApprovedJournalEntryBatches`, the same send as each
 * batch's Dispatch button, instead of waiting for the hourly job. It asks first, stating how many
 * approved batches will go, shows a loading state while the server sends them, then lists each
 * batch's result. The host shows it only to holders of the batch-operator Authorization and reloads
 * its list on `Sent`; the server checks the Authorization again.
 */
@Component({
  standalone: true,
  selector: 'mja-send-approved-batches',
  imports: [SharedGenericModule, MJButtonDirective, MJDialogComponent, MJDialogActionsComponent],
  templateUrl: './send-approved-batches.component.html',
  styleUrls: ['./send-approved-batches.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendApprovedBatchesComponent {
  private cdr = inject(ChangeDetectorRef);

  /** How many batches the host's list shows as Approved: what the confirmation says will be sent. */
  @Input() ApprovedCount = 0;

  /** The send ran (whatever each batch's result); the host reloads its list. */
  @Output() Sent = new EventEmitter<void>();

  public Phase: SendApprovedBatchesPhase = 'closed';
  public Results: SendApprovedBatchOutcome[] = [];
  public PostedCount = 0;
  public ErrorMessage: string | null = null;

  public readonly CountLabel = BatchCountLabel;

  public get DialogTitle(): string {
    return this.Phase === 'results' ? 'Send results' : 'Send approved batches';
  }

  public get CanOpen(): boolean {
    return this.ApprovedCount > 0 && this.Phase === 'closed';
  }

  public Open(): void {
    if (!this.CanOpen) return;
    this.Phase = 'confirm';
    this.cdr.markForCheck();
  }

  /** Closing is refused while the send runs: the result list is the only report of what happened. */
  public Close(): void {
    if (this.Phase === 'sending') return;
    this.Phase = 'closed';
    this.cdr.markForCheck();
  }

  public async Confirm(): Promise<void> {
    if (this.Phase !== 'confirm') return;
    this.Phase = 'sending';
    this.Results = [];
    this.PostedCount = 0;
    this.ErrorMessage = null;
    this.cdr.markForCheck();
    try {
      const res = await this.client.DispatchApprovedJournalEntryBatches();
      this.Results = res.Batches;
      this.PostedCount = res.PostedCount;
      this.ErrorMessage = res.Success ? null : (res.ErrorMessage ?? 'The approved batches were not sent. Try again.');
    } finally {
      this.Phase = 'results';
      this.cdr.markForCheck();
      // Every outcome reloads the host: a server error can land after some batches already moved.
      this.Sent.emit();
    }
  }

  private get client(): JournalEntryBatchDispatchClient {
    return new JournalEntryBatchDispatchClient(Metadata.Provider as GraphQLDataProvider);
  }
}
