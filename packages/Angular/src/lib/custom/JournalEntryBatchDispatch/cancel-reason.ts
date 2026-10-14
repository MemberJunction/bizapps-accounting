import type { IMetadataProvider } from '@memberjunction/core';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

/**
 * JournalEntryBatch.CancelReason's length, read from the entity's field metadata so the screens follow
 * the column. A Reject or Cancel reason is stored there, and the server refuses a longer one (#307).
 */
export function cancelReasonMaxLength(provider: IMetadataProvider): number {
  const max = provider.EntityByName(BATCH_ENTITY)?.Fields.find((f) => f.Name === 'CancelReason')?.MaxLength;
  if (!max) throw new Error(`No length metadata for ${BATCH_ENTITY}.CancelReason.`);
  return max;
}
