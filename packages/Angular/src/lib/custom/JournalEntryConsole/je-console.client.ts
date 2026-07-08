/**
 * JournalEntryConsoleClient — thin, strongly-typed transport for the Journal Entry Console's one
 * server call: GenerateJournalEntryReversal (JournalEntryResolver → JournalEntryEntityServer.generateReversal,
 * W6). Mirrors the BatchDispatchClient convention: builds the gql document, calls
 * provider.ExecuteGQL(query, variables), returns a typed { Success, ... } result (never throws).
 */
import { LogError } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';

export interface GenerateReversalResult {
  Success: boolean;
  ReversalJournalEntryID?: string;
  ReversalEntryNumber?: string;
  ErrorMessage?: string;
}

export class JournalEntryConsoleClient {
  private dataProvider: GraphQLDataProvider;

  constructor(dataProvider: GraphQLDataProvider) {
    this.dataProvider = dataProvider;
  }

  /** Generate a balanced reversing JE (new Pending row, Dr/Cr swapped, back-referenced both ways). */
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
      LogError(`JournalEntryConsoleClient.GenerateReversal failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }
}
