/**
 * Server-side subclass of JournalEntryBatch.
 *
 * Pre-save: when this is a new record and BatchNumber is empty, calls the
 * DB-level atomic counter sproc `spAssignNextBatchNumber` and writes the
 * resulting 'BATCH-{seq:000000}' onto the entity (GLOBAL sequence — D-SEQ
 * 2026-07-06: batches are multi-company). Save flows through BaseEntity so
 * `__mj.RecordChange` captures the create.
 *
 * Batch dispatch orchestration (collecting Pending JEs and flipping them to
 * Batched) lives in a separate Scheduled Action — see
 * workflows-and-agents.plan.md S1.
 */

import { BaseEntity, EntitySaveOptions, IMetadataProvider, ValidationErrorInfo, ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';

import { getNextBatchNumber } from './SequenceService.js';

/**
 * The legal batch status graph (plan §7): Pending → Approved | Cancelled · Approved → Sent ·
 * Sent → Posted | Failed · Failed → Sent (retry) · Posted / Cancelled are terminal.
 * The DB immutability trigger freezes Approved/Sent/Posted content but does not police the
 * transition GRAPH itself — that is this entity's always-applies invariant, so a direct
 * client save can never jump Pending→Sent (skip approval) or resurrect a terminal batch.
 */
const LEGAL_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  Pending: ['Pending', 'Approved', 'Cancelled'],
  Approved: ['Approved', 'Sent'],
  Sent: ['Sent', 'Posted', 'Failed'],
  Failed: ['Failed', 'Sent'],
  Posted: ['Posted'],
  Cancelled: ['Cancelled'],
};

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entry Batches')
export class JournalEntryBatchEntityServer extends mjBizAppsAccountingJournalEntryBatchEntity {

  override async Save(options?: EntitySaveOptions): Promise<boolean> {
    if (!this.IsSaved && !this.BatchNumber) {
      await this.assignBatchNumber();
    }
    return super.Save(options);
  }

  /** Always-applies batch invariants: legal status transitions + approval-audit pairing. */
  public override Validate(): ValidationResult {
    const result = super.Validate();

    if (!this.IsSaved) {
      // A batch is born Pending — no path creates it mid-lifecycle.
      if (this.Status && this.Status !== 'Pending') {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'JournalEntryBatchEntityServer.Validate',
            `A new batch must start at Status='Pending' (got '${this.Status}') — lifecycle transitions happen through the batching process.`,
            null,
          ),
        );
      }
    } else {
      const oldStatus = this.GetFieldByName('Status')?.OldValue as string | undefined;
      if (oldStatus && this.Status !== oldStatus && !(LEGAL_TRANSITIONS[oldStatus] ?? []).includes(this.Status)) {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'JournalEntryBatchEntityServer.Validate',
            `Illegal batch status transition '${oldStatus}' → '${this.Status}'. Legal from '${oldStatus}': ${(LEGAL_TRANSITIONS[oldStatus] ?? []).filter(s => s !== oldStatus).join(', ') || '(terminal)'}.`,
            null,
          ),
        );
      }
    }

    // Approval audit pair: an Approved batch carries WHO and WHEN, together.
    if (this.Status === 'Approved' && (!this.ApprovedAt || !this.ApprovedByUserID)) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryBatchEntityServer.Validate',
          `An Approved batch must carry both ApprovedAt and ApprovedByUserID.`,
          null,
        ),
      );
    }

    return result;
  }

  private async assignBatchNumber(): Promise<void> {
    if (!this.ContextCurrentUser) {
      throw new Error('JournalEntryBatchEntityServer.assignBatchNumber: ContextCurrentUser is required');
    }
    const batchNumber = await getNextBatchNumber(
      this.ContextCurrentUser,
      this.ProviderToUse as unknown as IMetadataProvider,
    );
    this.BatchNumber = batchNumber;
  }
}
