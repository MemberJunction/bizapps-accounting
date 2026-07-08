/**
 * BatchApprovalsClient — thin, strongly-typed transport for the Batch Approvals inbox's one server
 * call: RecordJEBatchDecision (BatchDispatchResolver → TasksAppApprovalGate.recordDecision — records a
 * terminal CFO decision against the batch's approval Task). Mirrors the JournalEntryConsoleClient /
 * BatchDispatchClient convention: builds the gql document, calls provider.ExecuteGQL(query, variables),
 * returns a typed { Success, ... } result (never throws). Kept LOCAL to this page rather than importing
 * BatchDispatchClient (which is not exported from the package public-api) so the inbox is self-contained.
 */
import { LogError } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';

/** The two decisions the inbox can record. Approved/ApprovedWithConditions approve; Rejected declines. */
export type BatchApprovalDecision = 'Approved' | 'Rejected';

export interface RecordJEBatchDecisionResult {
  Success: boolean;
  ErrorMessage?: string;
}

export class BatchApprovalsClient {
  private dataProvider: GraphQLDataProvider;

  constructor(dataProvider: GraphQLDataProvider) {
    this.dataProvider = dataProvider;
  }

  /** Record an approve/reject decision on the batch's approval Task (shared gate entry point). */
  public async RecordDecision(batchID: string, decision: BatchApprovalDecision, notes?: string): Promise<RecordJEBatchDecisionResult> {
    try {
      const mutation = `
        mutation RecordJEBatchDecision($batchID: ID!, $decision: String!, $notes: String) {
          RecordJEBatchDecision(batchID: $batchID, decision: $decision, notes: $notes) { Success ErrorMessage }
        }`;
      const res = await this.dataProvider.ExecuteGQL(mutation, { batchID, decision, notes: notes ?? null });
      return (res?.RecordJEBatchDecision as RecordJEBatchDecisionResult) ?? { Success: false, ErrorMessage: 'No response from server.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchApprovalsClient.RecordDecision failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }
}
