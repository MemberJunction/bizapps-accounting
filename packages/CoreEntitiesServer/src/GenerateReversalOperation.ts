/**
 * GenerateReversalOperation — 'Accounting.GenerateJournalEntryReversal' as a code-only Remote
 * Operation. Replaces the hand-written JournalEntryResolver (four-surface doctrine, Amith
 * 2026-07-28: an action that runs entity/engine logic server-side travels the remote-op stack).
 *
 * Thin by design: the business logic — a NEW Pending JE with Dr/Cr swapped, dimension tags +
 * counterparty carried, typed Code='Reversal', back-referenced both ways, the no-double-reverse /
 * no-reverse-a-reversal guards — lives in `JournalEntryEntityServer.GenerateReversal` and is
 * tested there (live specs L4/L14/L15). This op only loads the JE via the metadata system (which
 * returns the registered server subclass) and maps the result.
 *
 * CONNECTS TO:
 *   ENTITY:  ./JournalEntryEntityServer (GenerateReversal — W6)
 *   CLIENTS: JournalEntryClient / JournalEntryConsoleClient (Angular, via RouteOperation)
 */
import { BaseRemotableOperation, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { JournalEntryEntityServer } from './JournalEntryEntityServer.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

export interface GenerateReversalInput {
  JournalEntryID: string;
  Reason: string;
}

export interface GenerateReversalOutput {
  /** The new reversal JE's ID (a Pending JE with Dr/Cr swapped). */
  ReversalJournalEntryID: string;
  /** The new reversal JE's EntryNumber, for the UI to show + link to. */
  ReversalEntryNumber: string;
}

@RegisterClass(BaseRemotableOperation, 'Accounting.GenerateJournalEntryReversal')
export class GenerateReversalOperation extends BaseRemotableOperation<GenerateReversalInput, GenerateReversalOutput> {
  public readonly OperationKey = 'Accounting.GenerateJournalEntryReversal';

  protected async InternalExecute(input: GenerateReversalInput, provider: IMetadataProvider, user: UserInfo): Promise<GenerateReversalOutput> {
    if (!input?.JournalEntryID) throw new Error('GenerateJournalEntryReversal: JournalEntryID is required.');
    if (!input?.Reason?.trim()) throw new Error('GenerateJournalEntryReversal: a reason is required.');

    const je = await provider.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, user);
    if (!(await je.Load(input.JournalEntryID))) {
      throw new Error(`Journal Entry ${input.JournalEntryID} not found.`);
    }
    const reversal = await je.GenerateReversal(input.Reason, user);
    return { ReversalJournalEntryID: reversal.ID, ReversalEntryNumber: reversal.EntryNumber };
  }
}

/** Tree-shaking anchor — called from the app's server bootstrap so the registration is retained. */
export function LoadGenerateReversalOperation(): void {
  // intentionally empty
}
