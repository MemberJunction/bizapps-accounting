/**
 * CreateJournalEntriesOperation — the SET form of the accounting engine's callable surface.
 *
 * Amith's transaction rule ("Journal Entry / Journal Entry Line Items are created through a
 * singular call ... so that we have a proper transaction wrapper") extended to a MULTI-JE unit
 * of work: an order Confirm that books one JE per company (MOD-11/MOD-12) submits ALL of its
 * drafts here, and every header + line + dimension across every draft writes in ONE
 * TransactionGroup — all entries or none. No partial-booking state, no compensation path.
 *
 * A hand-authored, CODE-ONLY Remote Operation (no metadata row — same pattern as
 * CreateJournalEntryOperation): `@RegisterClass(BaseRemotableOperation,
 * 'Accounting.CreateJournalEntries')`. One call site everywhere:
 *   - orders-server: `new CreateJournalEntriesOperation().Execute(input, {user})` — in-process
 *   - browser / scripts: the identical op over GraphQL `ExecuteRemoteOperation`
 *
 * CONNECTS TO:
 *   ENGINE:  AccountingEngine.CreateJournalEntries (./AccountingEngine.ts)
 *   TYPES:   CreateJournalEntriesInput / Output (@mj-biz-apps/accounting-engine-base)
 *   SIBLING: CreateJournalEntryOperation (the single-draft form; shares the row-writer)
 */
import { BaseRemotableOperation, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import type { CreateJournalEntriesInput, CreateJournalEntriesOutput } from '@mj-biz-apps/accounting-engine-base';
import { AccountingEngine } from './AccountingEngine.js';

@RegisterClass(BaseRemotableOperation, 'Accounting.CreateJournalEntries')
export class CreateJournalEntriesOperation extends BaseRemotableOperation<CreateJournalEntriesInput, CreateJournalEntriesOutput> {
  public readonly OperationKey = 'Accounting.CreateJournalEntries';

  protected async InternalExecute(
    input: CreateJournalEntriesInput,
    provider: IMetadataProvider,
    user: UserInfo,
  ): Promise<CreateJournalEntriesOutput> {
    return AccountingEngine.Instance.CreateJournalEntries(input, user, provider);
  }
}

/**
 * Tree-shaking anchor — called from the app's server bootstrap so the `@RegisterClass`
 * registration is retained and the operation stays resolvable by key.
 */
export function LoadCreateJournalEntriesOperation(): void {
  // intentionally empty
}
