import type { IMetadataProvider } from '@memberjunction/core';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

/**
 * JournalEntryBatch.CancelReason's length, read from the entity's field metadata so the screens follow
 * the column. A Reject or Cancel reason is stored there, and the server refuses a longer one (#307).
 */
export function cancelReasonMaxLength(provider: IMetadataProvider): number {
  return reasonFieldMaxLength(provider, 'CancelReason');
}

/** JournalEntryBatch.ArchiveReason's length, read the same way: an Archive reason is stored there. */
export function archiveReasonMaxLength(provider: IMetadataProvider): number {
  return reasonFieldMaxLength(provider, 'ArchiveReason');
}

function reasonFieldMaxLength(provider: IMetadataProvider, field: 'CancelReason' | 'ArchiveReason'): number {
  const max = provider.EntityByName(BATCH_ENTITY)?.Fields.find((f) => f.Name === field)?.MaxLength;
  if (!max) throw new Error(`No length metadata for ${BATCH_ENTITY}.${field}.`);
  return max;
}
