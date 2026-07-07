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

import { BaseEntity, EntitySaveOptions } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';

import { getNextBatchNumber } from './SequenceService.js';

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entry Batches')
export class JournalEntryBatchEntityServer extends mjBizAppsAccountingJournalEntryBatchEntity {

  override async Save(options?: EntitySaveOptions): Promise<boolean> {
    if (!this.IsSaved && !this.BatchNumber) {
      await this.assignBatchNumber();
    }
    return super.Save(options);
  }

  private async assignBatchNumber(): Promise<void> {
    if (!this.ContextCurrentUser) {
      throw new Error('JournalEntryBatchEntityServer.assignBatchNumber: ContextCurrentUser is required');
    }
    const batchNumber = await getNextBatchNumber(this.ContextCurrentUser);
    this.BatchNumber = batchNumber;
  }
}
