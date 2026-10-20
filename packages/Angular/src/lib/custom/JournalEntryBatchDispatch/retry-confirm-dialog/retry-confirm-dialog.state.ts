import type { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import type { DispatchConfirmationKind } from '../journal-entry-batch-dispatch.client';

/** The batch fields the retry dialog shows. Every batch screen's row type carries these. */
export type RetryConfirmBatch = Pick<mjBizAppsAccountingJournalEntryBatchEntity, 'JournalEntryBatchNumber' | 'TargetSystem'>;

/**
 * The state behind the shared retry confirmation (#182, #398, #466). A Failed batch's retry goes to
 * the server unconfirmed first; only when its ERP lookup cannot settle whether the batch already
 * posted does the host open this, with the server's reason. A `Mismatch` needs the batch number
 * retyped before the override is allowed. Each batch screen owns one and runs the retry itself.
 */
export class RetryConfirmState<T extends RetryConfirmBatch = RetryConfirmBatch> {
  public Batch: T | null = null;
  /** The server's reason it could not settle the ERP lookup. */
  public Reason: string | null = null;
  public Kind: DispatchConfirmationKind | null = null;
  /** The batch number, retyped to post again past a `Mismatch`. */
  public MismatchText = '';

  public get IsOpen(): boolean {
    return this.Batch !== null;
  }

  public get IsMismatch(): boolean {
    return this.Kind === 'Mismatch';
  }

  public Open(batch: T, reason: string, kind: DispatchConfirmationKind | null): void {
    this.Batch = batch;
    this.Reason = reason;
    this.Kind = kind;
    this.MismatchText = '';
  }

  public Close(): void {
    this.Batch = null;
    this.Reason = null;
    this.Kind = null;
    this.MismatchText = '';
  }

  /** A `Mismatch` override is enabled only once the batch number has been retyped exactly. */
  public get CanConfirm(): boolean {
    if (!this.Batch) return false;
    if (!this.IsMismatch) return true;
    return this.MismatchText.trim() === (this.Batch.JournalEntryBatchNumber ?? '');
  }
}
