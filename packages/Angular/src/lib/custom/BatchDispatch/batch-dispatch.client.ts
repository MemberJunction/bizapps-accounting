/**
 * BatchDispatchClient — a thin, strongly-typed transport for the Block 2
 * Batch-Dispatch mutations/query exposed by `BatchDispatchResolver` in
 * `@mj-biz-apps/accounting-server`.
 *
 * Mirrors the MJ `GraphQL<Feature>Client` convention (see graphQLActionClient,
 * graphQLClusterClient). We keep it LOCAL to the app instead of editing the core
 * `@memberjunction/graphql-dataprovider` package: the helper just builds the gql
 * document, calls `provider.ExecuteGQL(query, variables)`, and returns the typed
 * result. The Angular component never sees a gql string.
 *
 * Error contract: each method catches, logs, and returns a `{ Success: false,
 * ErrorMessage }`-shaped result rather than throwing — so the UI renders a friendly
 * message without a try/catch around every call.
 */
import { LogError } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';

export interface BuildJEBatchResult {
  Success: boolean;
  BatchID?: string;
  SummaryLineCount: number;
  TotalDebits: number;
  TotalCredits: number;
  JECount: number;
  NothingToBatch: boolean;
  ErrorMessage?: string;
}

export interface DispatchJEBatchResult {
  Success: boolean;
  Status?: string;
  ExternalBatchRef?: string;
  ErrorMessage?: string;
}

export interface RecordJEBatchDecisionResult {
  Success: boolean;
  ErrorMessage?: string;
}

export interface JEBatchApprovalState {
  Success: boolean;
  Approved: boolean;
  Reason?: string;
}

/** The CFO decision outcomes the in-app control can record. */
export type BatchDecision = 'Approved' | 'ApprovedWithConditions' | 'Rejected';

export class BatchDispatchClient {
  private dataProvider: GraphQLDataProvider;

  constructor(dataProvider: GraphQLDataProvider) {
    this.dataProvider = dataProvider;
  }

  /** Build a Pending batch from a Company×Period's pending JEs (raises the CFO approval task). */
  public async BuildBatch(companyID: string, accountingPeriodID: string, targetSystem: string): Promise<BuildJEBatchResult> {
    const empty = { Success: false, SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, NothingToBatch: false };
    try {
      const mutation = `
        mutation BuildJEBatch($companyID: ID!, $accountingPeriodID: ID!, $targetSystem: String!) {
          BuildJEBatch(companyID: $companyID, accountingPeriodID: $accountingPeriodID, targetSystem: $targetSystem) {
            Success BatchID SummaryLineCount TotalDebits TotalCredits JECount NothingToBatch ErrorMessage
          }
        }`;
      const res = await this.dataProvider.ExecuteGQL(mutation, { companyID, accountingPeriodID, targetSystem });
      return (res?.BuildJEBatch as BuildJEBatchResult) ?? { ...empty, ErrorMessage: 'No response from server.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchDispatchClient.BuildBatch failed: ${msg}`);
      return { ...empty, ErrorMessage: msg };
    }
  }

  /** Dispatch a Pending, CFO-approved batch to the ERP (mock poster for v1). */
  public async DispatchBatch(batchID: string): Promise<DispatchJEBatchResult> {
    try {
      const mutation = `
        mutation DispatchJEBatch($batchID: ID!) {
          DispatchJEBatch(batchID: $batchID) { Success Status ExternalBatchRef ErrorMessage }
        }`;
      const res = await this.dataProvider.ExecuteGQL(mutation, { batchID });
      return (res?.DispatchJEBatch as DispatchJEBatchResult) ?? { Success: false, ErrorMessage: 'No response from server.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchDispatchClient.DispatchBatch failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }

  /** Record an in-app CFO approve/reject decision on the batch's approval Task. */
  public async RecordDecision(batchID: string, decision: BatchDecision, notes?: string): Promise<RecordJEBatchDecisionResult> {
    try {
      const mutation = `
        mutation RecordJEBatchDecision($batchID: ID!, $decision: String!, $notes: String) {
          RecordJEBatchDecision(batchID: $batchID, decision: $decision, notes: $notes) { Success ErrorMessage }
        }`;
      const res = await this.dataProvider.ExecuteGQL(mutation, { batchID, decision, notes: notes ?? null });
      return (res?.RecordJEBatchDecision as RecordJEBatchDecisionResult) ?? { Success: false, ErrorMessage: 'No response from server.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchDispatchClient.RecordDecision failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }

  /** Read-only: is this batch approved to dispatch? Drives the Dispatch button's enabled state. */
  public async GetApprovalState(batchID: string): Promise<JEBatchApprovalState> {
    try {
      const query = `
        query JEBatchApprovalState($batchID: ID!) {
          JEBatchApprovalState(batchID: $batchID) { Success Approved Reason }
        }`;
      const res = await this.dataProvider.ExecuteGQL(query, { batchID });
      return (res?.JEBatchApprovalState as JEBatchApprovalState) ?? { Success: false, Approved: false, Reason: 'No response from server.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchDispatchClient.GetApprovalState failed: ${msg}`);
      return { Success: false, Approved: false, Reason: msg };
    }
  }
}
