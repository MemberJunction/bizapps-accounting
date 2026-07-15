/**
 * CreateScheduledJournalEntriesOperation — the atomic scheduled-JE set op (B3.1, MOD-5/MOD-11).
 *
 * Mirrors CreateJournalEntry(ies): a hand-authored, CODE-ONLY Remote Operation
 * (`@RegisterClass(BaseRemotableOperation, 'Accounting.CreateScheduledJournalEntries')`) callable
 * in-process AND over GraphQL. Persists a whole rev-rec / amortization schedule — N dated
 * ScheduledJournalEntry rows + balanced line pairs + any supersede marks — in ONE TransactionGroup.
 * Orders F4 calls this at booking-lock (each entry carrying its recognition DATE).
 *
 * CONNECTS TO:
 *   SERVICE: ./ScheduledJournalEntryService (createScheduledJournalEntriesAtomic)
 */
import { BaseRemotableOperation, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  createScheduledJournalEntriesAtomic,
  type ScheduledJournalEntriesInput,
  type ScheduledJournalEntriesResult,
} from './ScheduledJournalEntryService.js';

@RegisterClass(BaseRemotableOperation, 'Accounting.CreateScheduledJournalEntries')
export class CreateScheduledJournalEntriesOperation extends BaseRemotableOperation<ScheduledJournalEntriesInput, ScheduledJournalEntriesResult> {
  public readonly OperationKey = 'Accounting.CreateScheduledJournalEntries';

  protected async InternalExecute(
    input: ScheduledJournalEntriesInput,
    provider: IMetadataProvider,
    user: UserInfo,
  ): Promise<ScheduledJournalEntriesResult> {
    return createScheduledJournalEntriesAtomic(input, user, provider);
  }
}

/** Tree-shaking anchor — called from the server bootstrap so `@RegisterClass` is retained. */
export function LoadCreateScheduledJournalEntriesOperation(): void {
  // intentionally empty
}
