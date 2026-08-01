/**
 * JournalEntryClient — thin typed wrapper over the 'Accounting.GenerateJournalEntryReversal'
 * Remote Operation (→ JournalEntryEntityServer.GenerateReversal). No hand-rolled gql: batch/JE
 * actions travel the remote-op stack via `provider.RouteOperation` (four-surface doctrine,
 * Amith 2026-07-28). No logic here — typed inputs + the legacy result shape the form binds to.
 */
import { LogError } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';

export interface GenerateReversalResult {
  Success: boolean;
  ReversalJournalEntryID?: string;
  ReversalEntryNumber?: string;
  ErrorMessage?: string;
}

interface GenerateReversalOutputWire { ReversalJournalEntryID: string; ReversalEntryNumber: string }

export class JournalEntryClient {
  private dataProvider: GraphQLDataProvider;

  constructor(dataProvider: GraphQLDataProvider) {
    this.dataProvider = dataProvider;
  }

  /** Generate a reversal JE (a new Pending entry, Dr/Cr swapped) for a posted/batched JE. */
  public async GenerateReversal(journalEntryID: string, reason: string): Promise<GenerateReversalResult> {
    try {
      const res = await this.dataProvider.RouteOperation<{ JournalEntryID: string; Reason: string }, GenerateReversalOutputWire>(
        'Accounting.GenerateJournalEntryReversal', { JournalEntryID: journalEntryID, Reason: reason });
      if (!res.Success || !res.Output) return { Success: false, ErrorMessage: res.ErrorMessage ?? 'No response from server.' };
      return { Success: true, ReversalJournalEntryID: res.Output.ReversalJournalEntryID, ReversalEntryNumber: res.Output.ReversalEntryNumber };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`JournalEntryClient.GenerateReversal failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }
}
