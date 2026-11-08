import type { IMetadataProvider } from '@memberjunction/core';
import type { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import type { DispatchConfirmationKind } from '../journal-entry-batch-dispatch.client';
import { archiveReasonMaxLength, cancelReasonMaxLength } from '../cancel-reason';

/** The three batch actions that ask for a reason before they run. */
export type BatchAction = 'Reject' | 'Archive' | 'Cancel';

/** The batch fields the dialog shows. Every batch screen's row type carries these. */
export type BatchActionDialogBatch = Pick<
  mjBizAppsAccountingJournalEntryBatchEntity,
  'JournalEntryBatchNumber' | 'TargetSystem' | 'TotalEntries' | 'Status'
>;

/**
 * The state behind the shared Reject / Archive / Cancel dialog (#405). Each batch screen owns one and
 * runs the server call itself; this holds what the operator typed and what the dialog may confirm, so
 * the three screens ask the same questions and apply the same rules:
 * - a reason is required, and holds no more than its column (#307);
 * - a Failed batch's cancel goes to the server unconfirmed first. Only when its ERP lookup cannot
 *   settle whether the batch posted does the dialog stay open and ask (#207), and a `Mismatch` needs
 *   the batch number retyped.
 */
export class BatchActionDialogState<T extends BatchActionDialogBatch = BatchActionDialogBatch> {
  public Batch: T | null = null;
  public Action: BatchAction | null = null;
  public Reason = '';
  /** The reason column's length; null while the dialog is closed. */
  public ReasonMaxLength: number | null = null;
  /** Set when the server could not settle a Failed batch's ERP lookup and asks the operator. */
  public ERPCheckReason: string | null = null;
  public ERPCheckKind: DispatchConfirmationKind | null = null;
  /** The batch number, retyped to cancel past a `Mismatch`. */
  public MismatchText = '';
  /** A server call is in flight: nothing may confirm or close. */
  public Busy = false;

  public get IsOpen(): boolean {
    return this.Batch !== null;
  }

  /** Open for `batch`, reading the reason column's length from `provider`'s metadata. */
  public Open(batch: T, action: BatchAction, provider: IMetadataProvider): void {
    this.Close();
    this.ReasonMaxLength = action === 'Archive' ? archiveReasonMaxLength(provider) : cancelReasonMaxLength(provider);
    this.Batch = batch;
    this.Action = action;
  }

  public Close(): void {
    this.Batch = null;
    this.Action = null;
    this.Reason = '';
    this.ReasonMaxLength = null;
    this.ERPCheckReason = null;
    this.ERPCheckKind = null;
    this.MismatchText = '';
    this.Busy = false;
  }

  /** The server asked for the ERP check: keep the dialog and the reason, and ask. */
  public AskForERPCheck(reason: string, kind: DispatchConfirmationKind | null): void {
    this.ERPCheckReason = reason;
    this.ERPCheckKind = kind;
    this.MismatchText = '';
  }

  /** The reason as it is sent: without surrounding spaces. */
  public get TrimmedReason(): string {
    return this.Reason.trim();
  }

  /** Whether the next attempt carries the operator's word that the batch has not posted in the ERP. */
  public get ConfirmsNotPostedInERP(): boolean {
    return this.ERPCheckReason !== null;
  }

  public get Title(): string {
    switch (this.Action) {
      case 'Reject': return 'Reject this batch';
      case 'Archive': return 'Archive this batch';
      default: return 'Cancel this batch';
    }
  }

  /** Why the reason cannot be sent as typed, or null. */
  public get ReasonProblem(): string | null {
    const length = this.TrimmedReason.length;
    const max = this.ReasonMaxLength;
    return max !== null && length > max ? `This reason is ${length} characters; the limit is ${max}.` : null;
  }

  public get CanConfirm(): boolean {
    const batch = this.Batch;
    if (!batch || this.Busy || !this.TrimmedReason || this.ReasonProblem) return false;
    return this.ERPCheckKind !== 'Mismatch' || this.MismatchText.trim() === batch.JournalEntryBatchNumber;
  }
}
