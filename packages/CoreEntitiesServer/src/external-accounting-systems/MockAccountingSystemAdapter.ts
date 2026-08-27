/**
 * MockAccountingSystemAdapter — the catalog's explicit test destination.
 *
 * Always succeeds with a `MOCK-<batchNumber>` reference and touches no external system.
 * It exists as a REAL, selectable ExternalAccountingSystem row (Name='Mock') so the whole
 * dispatch flow — build → approve → Sent → Posted, JEs → GLPosted — is provable with zero
 * connector code involved. Selecting it is always an explicit choice: real systems fail
 * loudly when unconfigured; nothing ever falls back to this adapter (D6).
 *
 * Replaces the engine's former hardcoded `mockErpPoster` seam default.
 */
import { RegisterClass } from '@memberjunction/global';
import {
  BaseExternalAccountingSystemAdapter,
  PostJournalEntryBatchContext,
  PostJournalEntryBatchResult,
  VerifyPostedResult,
} from './BaseExternalAccountingSystemAdapter.js';

@RegisterClass(BaseExternalAccountingSystemAdapter, 'MockAccountingSystemAdapter')
export class MockAccountingSystemAdapter extends BaseExternalAccountingSystemAdapter {
  public override async PostJournalEntryBatch(context: PostJournalEntryBatchContext): Promise<PostJournalEntryBatchResult> {
    return {
      Success: true,
      ExternalRef: `MOCK-${context.Batch.JournalEntryBatchNumber}`,
    };
  }

  /** The mock destination "posted" anything we ever sent it — by construction. */
  public override async VerifyPosted(_documentNumber: string, _context: PostJournalEntryBatchContext): Promise<VerifyPostedResult> {
    return { Status: 'posted', EntryCount: 0 };
  }
}
