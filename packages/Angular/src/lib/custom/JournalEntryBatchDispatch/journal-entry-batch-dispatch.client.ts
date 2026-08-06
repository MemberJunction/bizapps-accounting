/**
 * JournalEntryBatchDispatchClient — a thin, strongly-typed wrapper over the batch Remote Operations
 * (`Accounting.BuildJournalEntryBatch` / `Accounting.RegenerateJournalEntryBatch` / `Accounting.DispatchJournalEntryBatch` /
 * `Accounting.RecordJournalEntryBatchDecision` / `Accounting.GetJournalEntryBatchApprovalState`).
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

/** One built batch, as `Accounting.BuildJournalEntryBatch`/`RegenerateJournalEntryBatch` return it. */
interface BuildJournalEntryBatchResultWire {
  batchId: string;
  summaryJournalEntryId: string;
  summaryLineCount: number;
  totalDebits: number;
  totalCredits: number;
  jeCount: number;
  approvalTaskId: string | null;
}

interface BuildJournalEntryBatchOutputWire {
  Batches: BuildJournalEntryBatchResultWire[];
  NothingToBatch: boolean;
}

interface DispatchJournalEntryBatchOutputWire { Status: string; ExternalJournalEntryBatchRef: string | null }
interface GetJournalEntryBatchApprovalStateOutputWire { Approved: boolean; Reason?: string }
interface RecordJournalEntryBatchDecisionOutputWire { Recorded: true }

// ─── The legacy result shapes the dashboard components bind to (unchanged public API) ────────────

export interface BuildJournalEntryBatchResult {
  Success: boolean;
  JournalEntryBatchID?: string;
  SummaryLineCount: number;
  TotalDebits: number;
  TotalCredits: number;
  JECount: number;
  CompanyCount: number;
  NothingToBatch: boolean;
  ErrorMessage?: string;
}

export interface DispatchJournalEntryBatchResult {
  Success: boolean;
  Status?: string;
  ExternalJournalEntryBatchRef?: string;
  ErrorMessage?: string;
}

export interface RecordJournalEntryBatchDecisionResult {
  Success: boolean;
  ErrorMessage?: string;
}

export interface JournalEntryBatchApprovalState {
  Success: boolean;
  Approved: boolean;
  Reason?: string;
}

/** The CFO decision outcomes the in-app control can record. */
export type JournalEntryBatchDecision = 'Approved' | 'ApprovedWithConditions' | 'Rejected';

export class JournalEntryBatchDispatchClient {
  private dataProvider: GraphQLDataProvider;

  constructor(dataProvider: GraphQLDataProvider) {
    this.dataProvider = dataProvider;
  }

  /**
   * Build Pending single-company batches from ALL pending JEs (one batch per company with
   * candidates; each build raises + stamps its CFO approval task in the same transaction).
   */
  public async BuildJournalEntryBatch(targetSystem: string): Promise<BuildJournalEntryBatchResult> {
    const empty = { Success: false, SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, CompanyCount: 0, NothingToBatch: false };
    try {
      const res = await this.dataProvider.RouteOperation<{ TargetSystem: string }, BuildJournalEntryBatchOutputWire>(
        'Accounting.BuildJournalEntryBatch', { TargetSystem: targetSystem });
      if (!res.Success || !res.Output) return { ...empty, ErrorMessage: res.ErrorMessage ?? 'No response from server.' };
      return this.toBuildResult(res.Output.Batches, res.Output.NothingToBatch);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`JournalEntryBatchDispatchClient.BuildJournalEntryBatch failed: ${msg}`);
      return { ...empty, ErrorMessage: msg };
    }
  }

  /**
   * Regenerate an OPEN (Pending) batch: unlock its current JEs, re-gather ALL current candidates
   * (everything unbatched Pending, incl. any added since), and rebuild the summary on the same
   * batch. Only Pending batches; a re-gather to nothing cancels the batch (surfaced as an error).
   */
  public async RegenerateJournalEntryBatch(batchID: string, targetSystem: string): Promise<BuildJournalEntryBatchResult> {
    const empty = { Success: false, SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, CompanyCount: 0, NothingToBatch: false };
    try {
      const res = await this.dataProvider.RouteOperation<{ JournalEntryBatchID: string; TargetSystem: string }, BuildJournalEntryBatchResultWire>(
        'Accounting.RegenerateJournalEntryBatch', { JournalEntryBatchID: batchID, TargetSystem: targetSystem });
      if (!res.Success || !res.Output) return { ...empty, ErrorMessage: res.ErrorMessage ?? 'No response from server.' };
      return this.toBuildResult([res.Output], false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`JournalEntryBatchDispatchClient.RegenerateJournalEntryBatch failed: ${msg}`);
      return { ...empty, ErrorMessage: msg };
    }
  }

  /** Dispatch an Approved batch to the ERP (mock poster for v1). */
  public async DispatchJournalEntryBatch(batchID: string): Promise<DispatchJournalEntryBatchResult> {
    try {
      const res = await this.dataProvider.RouteOperation<{ JournalEntryBatchID: string }, DispatchJournalEntryBatchOutputWire>(
        'Accounting.DispatchJournalEntryBatch', { JournalEntryBatchID: batchID });
      if (!res.Success || !res.Output) return { Success: false, ErrorMessage: res.ErrorMessage ?? 'No response from server.' };
      return { Success: true, Status: res.Output.Status, ExternalJournalEntryBatchRef: res.Output.ExternalJournalEntryBatchRef ?? undefined };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`JournalEntryBatchDispatchClient.DispatchJournalEntryBatch failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }

  /** Record an in-app CFO approve/reject decision on the batch's approval Task. */
  public async RecordDecision(batchID: string, decision: JournalEntryBatchDecision, notes?: string): Promise<RecordJournalEntryBatchDecisionResult> {
    try {
      const res = await this.dataProvider.RouteOperation<{ JournalEntryBatchID: string; Decision: JournalEntryBatchDecision; Notes: string | null }, RecordJournalEntryBatchDecisionOutputWire>(
        'Accounting.RecordJournalEntryBatchDecision', { JournalEntryBatchID: batchID, Decision: decision, Notes: notes ?? null });
      if (!res.Success) return { Success: false, ErrorMessage: res.ErrorMessage ?? 'No response from server.' };
      return { Success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`JournalEntryBatchDispatchClient.RecordDecision failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }

  /** Read-only: is this batch approved to dispatch? Drives the Dispatch button's enabled state. */
  public async GetApprovalState(batchID: string): Promise<JournalEntryBatchApprovalState> {
    try {
      const res = await this.dataProvider.RouteOperation<{ JournalEntryBatchID: string }, GetJournalEntryBatchApprovalStateOutputWire>(
        'Accounting.GetJournalEntryBatchApprovalState', { JournalEntryBatchID: batchID });
      if (!res.Success || !res.Output) return { Success: false, Approved: false, Reason: res.ErrorMessage ?? 'No response from server.' };
      return { Success: true, Approved: res.Output.Approved, Reason: res.Output.Reason };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`JournalEntryBatchDispatchClient.GetApprovalState failed: ${msg}`);
      return { Success: false, Approved: false, Reason: msg };
    }
  }

  /** Collapse one-or-many per-company build results into the legacy aggregate shape. */
  private toBuildResult(batches: BuildJournalEntryBatchResultWire[], nothingToBatch: boolean): BuildJournalEntryBatchResult {
    return {
      Success: true,
      NothingToBatch: nothingToBatch,
      JournalEntryBatchID: batches.length === 1 ? batches[0].batchId : undefined,
      SummaryLineCount: batches.reduce((s, b) => s + b.summaryLineCount, 0),
      TotalDebits: batches.reduce((s, b) => s + b.totalDebits, 0),
      TotalCredits: batches.reduce((s, b) => s + b.totalCredits, 0),
      JECount: batches.reduce((s, b) => s + b.jeCount, 0),
      CompanyCount: batches.length,
    };
  }
}
