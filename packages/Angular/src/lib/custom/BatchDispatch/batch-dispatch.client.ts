/**
 * BatchDispatchClient — a thin, strongly-typed wrapper over the batch Remote Operations
 * (`Accounting.BuildBatch` / `Accounting.RegenerateBatch` / `Accounting.DispatchBatch` /
 * `Accounting.RecordBatchDecision` / `Accounting.GetBatchApprovalState`).
 *
 * Deliberately NOT a hand-written GraphQL client (the old shape, which talked to the deleted
 * BatchDispatchResolver): batch actions run the batching engine server-side, so they travel MJ's
 * Remote Operations stack — `provider.RouteOperation(key, input)` marshals them over the generic
 * ExecuteRemoteOperation mutation. This file exists only to give components typed inputs and the
 * legacy result shapes they already bind to; it holds NO logic (four-surface doctrine, Amith
 * 2026-07-28: the UI calls remote ops + prebuilt queries — nothing else).
 *
 * Error contract (unchanged): each method catches/logs and returns a `{ Success: false,
 * ErrorMessage }`-shaped result rather than throwing — the UI renders a friendly message without
 * try/catch around every call.
 */
import { LogError } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';

// ─── Wire shapes of the Remote Operation outputs (kept local — the ops live in the server-only
// @mj-biz-apps/accounting-core-entities-server package, which the browser cannot import) ─────────

/** One built batch, as `Accounting.BuildBatch`/`RegenerateBatch` return it. */
interface BuildBatchResultWire {
  batchId: string;
  summaryJournalEntryId: string;
  summaryLineCount: number;
  totalDebits: number;
  totalCredits: number;
  jeCount: number;
  approvalTaskId: string | null;
}

interface BuildBatchOutputWire {
  Batches: BuildBatchResultWire[];
  NothingToBatch: boolean;
}

interface DispatchBatchOutputWire { Status: string; ExternalBatchRef: string | null }
interface GetBatchApprovalStateOutputWire { Approved: boolean; Reason?: string }
interface RecordBatchDecisionOutputWire { Recorded: true }

// ─── The legacy result shapes the dashboard components bind to (unchanged public API) ────────────

export interface BuildJEBatchResult {
  Success: boolean;
  BatchID?: string;
  SummaryLineCount: number;
  TotalDebits: number;
  TotalCredits: number;
  JECount: number;
  CompanyCount: number;
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

  /**
   * Build Pending single-company batches from ALL pending JEs (one batch per company with
   * candidates; each build raises + stamps its CFO approval task in the same transaction).
   */
  public async BuildBatch(targetSystem: string): Promise<BuildJEBatchResult> {
    const empty = { Success: false, SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, CompanyCount: 0, NothingToBatch: false };
    try {
      const res = await this.dataProvider.RouteOperation<{ TargetSystem: string }, BuildBatchOutputWire>(
        'Accounting.BuildBatch', { TargetSystem: targetSystem });
      if (!res.Success || !res.Output) return { ...empty, ErrorMessage: res.ErrorMessage ?? 'No response from server.' };
      return this.toBuildResult(res.Output.Batches, res.Output.NothingToBatch);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchDispatchClient.BuildBatch failed: ${msg}`);
      return { ...empty, ErrorMessage: msg };
    }
  }

  /**
   * Regenerate an OPEN (Pending) batch: unlock its current JEs, re-gather ALL current candidates
   * (everything unbatched Pending, incl. any added since), and rebuild the summary on the same
   * batch. Only Pending batches; a re-gather to nothing cancels the batch (surfaced as an error).
   */
  public async RegenerateBatch(batchID: string, targetSystem: string): Promise<BuildJEBatchResult> {
    const empty = { Success: false, SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, CompanyCount: 0, NothingToBatch: false };
    try {
      const res = await this.dataProvider.RouteOperation<{ BatchID: string; TargetSystem: string }, BuildBatchResultWire>(
        'Accounting.RegenerateBatch', { BatchID: batchID, TargetSystem: targetSystem });
      if (!res.Success || !res.Output) return { ...empty, ErrorMessage: res.ErrorMessage ?? 'No response from server.' };
      return this.toBuildResult([res.Output], false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchDispatchClient.RegenerateBatch failed: ${msg}`);
      return { ...empty, ErrorMessage: msg };
    }
  }

  /** Dispatch an Approved batch to the ERP (mock poster for v1). */
  public async DispatchBatch(batchID: string): Promise<DispatchJEBatchResult> {
    try {
      const res = await this.dataProvider.RouteOperation<{ BatchID: string }, DispatchBatchOutputWire>(
        'Accounting.DispatchBatch', { BatchID: batchID });
      if (!res.Success || !res.Output) return { Success: false, ErrorMessage: res.ErrorMessage ?? 'No response from server.' };
      return { Success: true, Status: res.Output.Status, ExternalBatchRef: res.Output.ExternalBatchRef ?? undefined };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchDispatchClient.DispatchBatch failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }

  /** Record an in-app CFO approve/reject decision on the batch's approval Task. */
  public async RecordDecision(batchID: string, decision: BatchDecision, notes?: string): Promise<RecordJEBatchDecisionResult> {
    try {
      const res = await this.dataProvider.RouteOperation<{ BatchID: string; Decision: BatchDecision; Notes: string | null }, RecordBatchDecisionOutputWire>(
        'Accounting.RecordBatchDecision', { BatchID: batchID, Decision: decision, Notes: notes ?? null });
      if (!res.Success) return { Success: false, ErrorMessage: res.ErrorMessage ?? 'No response from server.' };
      return { Success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchDispatchClient.RecordDecision failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }

  /** Read-only: is this batch approved to dispatch? Drives the Dispatch button's enabled state. */
  public async GetApprovalState(batchID: string): Promise<JEBatchApprovalState> {
    try {
      const res = await this.dataProvider.RouteOperation<{ BatchID: string }, GetBatchApprovalStateOutputWire>(
        'Accounting.GetBatchApprovalState', { BatchID: batchID });
      if (!res.Success || !res.Output) return { Success: false, Approved: false, Reason: res.ErrorMessage ?? 'No response from server.' };
      return { Success: true, Approved: res.Output.Approved, Reason: res.Output.Reason };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchDispatchClient.GetApprovalState failed: ${msg}`);
      return { Success: false, Approved: false, Reason: msg };
    }
  }

  /** Collapse one-or-many per-company build results into the legacy aggregate shape. */
  private toBuildResult(batches: BuildBatchResultWire[], nothingToBatch: boolean): BuildJEBatchResult {
    return {
      Success: true,
      NothingToBatch: nothingToBatch,
      BatchID: batches.length === 1 ? batches[0].batchId : undefined,
      SummaryLineCount: batches.reduce((s, b) => s + b.summaryLineCount, 0),
      TotalDebits: batches.reduce((s, b) => s + b.totalDebits, 0),
      TotalCredits: batches.reduce((s, b) => s + b.totalCredits, 0),
      JECount: batches.reduce((s, b) => s + b.jeCount, 0),
      CompanyCount: batches.length,
    };
  }
}
