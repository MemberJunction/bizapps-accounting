/**
 * CreateJournalEntryOperation — the callable surface of the accounting engine (plan §2.3, A5).
 *
 * A hand-authored, CODE-ONLY Remote Operation (no metadata row — passes the metadata gate per
 * guides/REMOTE_OPERATIONS_GUIDE.md): `@RegisterClass(BaseRemotableOperation,
 * 'Accounting.CreateJournalEntry')`. One call site everywhere:
 *   - orders-server: `new CreateJournalEntryOperation().Execute(input, {provider, user})` — in-process
 *   - browser / scripts: the identical op over GraphQL `ExecuteRemoteOperation`
 *
 * Input/output types live in the browser-safe @mj-biz-apps/accounting-engine-base package so
 * callers import them with zero server deps. Logical failures live INSIDE the output
 * (`Output.Success === false` with typed `Errors[]`); the RemoteOpResult wrapper only reports
 * transport/authorization/execution faults.
 *
 * CONNECTS TO:
 *   ENGINE:  AccountingEngine.CreateJournalEntry (./AccountingEngine.ts)
 *   TYPES:   CreateJournalEntryInput / Output (@mj-biz-apps/accounting-engine-base)
 *   DOC:     plans/accounting-engine-plan.md §2.3
 */
import { BaseRemotableOperation, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import type { CreateJournalEntryInput, CreateJournalEntryOutput } from '@mj-biz-apps/accounting-engine-base';
import { AccountingEngine } from './AccountingEngine.js';

@RegisterClass(BaseRemotableOperation, 'Accounting.CreateJournalEntry')
export class CreateJournalEntryOperation extends BaseRemotableOperation<CreateJournalEntryInput, CreateJournalEntryOutput> {
  public readonly OperationKey = 'Accounting.CreateJournalEntry';

  protected async InternalExecute(
    input: CreateJournalEntryInput,
    provider: IMetadataProvider,
    user: UserInfo,
  ): Promise<CreateJournalEntryOutput> {
    return AccountingEngine.Instance.CreateJournalEntry(input, user, provider);
  }
}

/**
 * Tree-shaking anchor — called from the app's server bootstrap so the `@RegisterClass`
 * registration is retained and the operation stays resolvable by key.
 */
export function LoadCreateJournalEntryOperation(): void {
  // intentionally empty
}
