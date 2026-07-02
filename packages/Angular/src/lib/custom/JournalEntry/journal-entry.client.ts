/**
 * JournalEntryClient — thin transport for the JE actions the custom form invokes.
 * v1: GenerateJournalEntryReversal (→ JournalEntryResolver.GenerateJournalEntryReversal →
 * JournalEntryEntityServer.generateReversal). Mirrors the stage-1 BatchDispatchClient convention.
 */
import { LogError } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';

export interface GenerateReversalResult {
  Success: boolean;
  ReversalJournalEntryID?: string;
  ReversalEntryNumber?: string;
  ErrorMessage?: string;
}

export class JournalEntryClient {
  private dataProvider: GraphQLDataProvider;

  constructor(dataProvider: GraphQLDataProvider) {
    this.dataProvider = dataProvider;
  }

  /** Generate a reversal JE (a new Pending entry, Dr/Cr swapped) for a posted/batched JE. */
  public async GenerateReversal(journalEntryID: string, reason: string): Promise<GenerateReversalResult> {
    try {
      const mutation = `
        mutation GenerateJournalEntryReversal($journalEntryID: ID!, $reason: String!) {
          GenerateJournalEntryReversal(journalEntryID: $journalEntryID, reason: $reason) {
            Success ReversalJournalEntryID ReversalEntryNumber ErrorMessage
          }
        }`;
      const res = await this.dataProvider.ExecuteGQL(mutation, { journalEntryID, reason });
      return (res?.GenerateJournalEntryReversal as GenerateReversalResult) ?? { Success: false, ErrorMessage: 'No response from server.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`JournalEntryClient.GenerateReversal failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }
}
