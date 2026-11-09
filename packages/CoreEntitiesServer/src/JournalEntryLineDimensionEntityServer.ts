/**
 * Server-side subclass of JournalEntryLineDimension: a dimension tag written ON ITS OWN — not through
 * its line's Save — is refused while its journal entry is a Pending manual entry under approval
 * (golive #353, PR #463 review). Tags are part of what an approval covers, and only the entry's own
 * Save raises its approval again; without this an approved-but-unbatched entry could be re-tagged.
 *
 * A tag saved or deleted by its line (`JournalEntryLineEntityServer` marks `SavingThroughLine`) is
 * left to the line, which applies the same guard when the line itself is written on its own.
 * Non-Pending entries are frozen by trg_JELD_Immutability.
 *
 * CONNECTS TO:
 *   GUARD:   ManualJournalEntryApprovalService.AssertStandaloneDimensionChangeAllowed
 *   CALLERS: JournalEntryLineEntityServer (marks SavingThroughLine) · direct entity saves
 */
import { BaseEntity, EntityDeleteOptions, EntitySaveOptions, IMetadataProvider } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingJournalEntryLineDimensionEntity } from '@mj-biz-apps/accounting-entities';

import { ManualJournalEntryApprovalService } from './ManualJournalEntryApproval.js';

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entry Line Dimensions')
export class JournalEntryLineDimensionEntityServer extends mjBizAppsAccountingJournalEntryLineDimensionEntity {
  /** Set by the owning line while it saves or deletes this tag; a tag written on its own leaves it false. */
  public SavingThroughLine = false;

  public override async Save(options?: EntitySaveOptions): Promise<boolean> {
    if (!this.SavingThroughLine && this.JournalEntryLineID && (!this.IsSaved || this.Dirty)) {
      await this.assertStandaloneChangeAllowed();
    }
    return super.Save(options);
  }

  public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
    if (this.IsSaved && !this.SavingThroughLine && this.JournalEntryLineID) {
      await this.assertStandaloneChangeAllowed();
    }
    return super.Delete(options);
  }

  private async assertStandaloneChangeAllowed(): Promise<void> {
    const service = new ManualJournalEntryApprovalService(this.ProviderToUse as unknown as IMetadataProvider);
    await service.AssertStandaloneDimensionChangeAllowed(this.JournalEntryLineID, this.ContextCurrentUser);
  }
}

/** Mark tags as written by their line for the duration of `write`, so the standalone guard defers to the line. */
export async function WithDimensionsSavedThroughLine<T>(dimensions: readonly BaseEntity[], write: () => Promise<T>): Promise<T> {
  const tags = dimensions.filter((d): d is JournalEntryLineDimensionEntityServer => d instanceof JournalEntryLineDimensionEntityServer);
  for (const tag of tags) tag.SavingThroughLine = true;
  try {
    return await write();
  } finally {
    for (const tag of tags) tag.SavingThroughLine = false;
  }
}

/** Tree-shaking anchor — imported by ./index.ts so the @RegisterClass registration survives bundling. */
export function LoadJournalEntryLineDimensionEntityServer(): void {
  // intentionally empty
}
