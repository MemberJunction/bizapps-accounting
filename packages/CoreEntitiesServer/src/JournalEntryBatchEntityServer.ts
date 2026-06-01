/**
 * Server-side subclass of JournalEntryBatch.
 *
 * Pre-save: when this is a new record and BatchNumber is empty, calls the
 * DB-level atomic counter sproc `spAssignNextBatchNumber` and writes the
 * resulting 'BATCH-{CompanyCode}-{seq:000000}' onto the entity. Save flows
 * through BaseEntity so `__mj.RecordChange` captures the create.
 *
 * Batch dispatch orchestration (collecting Pending JEs and flipping them to
 * Batched) lives in a separate Scheduled Action — see
 * workflows-and-agents.plan.md S1.
 */

import { BaseEntity, EntitySaveOptions, LogError } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';

import { EntityNames } from './EntityNames.js';
import { getNextBatchNumber } from './SequenceService.js';

@RegisterClass(BaseEntity, EntityNames.JournalEntryBatch)
export class JournalEntryBatchEntityServer extends mjBizAppsAccountingJournalEntryBatchEntity {

  override async Save(options?: EntitySaveOptions): Promise<boolean> {
    if (!this.IsSaved && !this.Get('BatchNumber')) {
      await this.assignBatchNumber();
    }
    return super.Save(options);
  }

  private async assignBatchNumber(): Promise<void> {
    const companyId = this.Get<string>('CompanyID');
    if (!companyId) {
      LogError('JournalEntryBatchEntityServer.assignBatchNumber: CompanyID is required before save');
      throw new Error('JournalEntryBatch.CompanyID is required before save');
    }
    if (!this.ContextCurrentUser) {
      throw new Error('JournalEntryBatchEntityServer.assignBatchNumber: ContextCurrentUser is required');
    }

    const batchNumber = await getNextBatchNumber(companyId, this.ContextCurrentUser);
    this.Set('BatchNumber', batchNumber);
  }
}
