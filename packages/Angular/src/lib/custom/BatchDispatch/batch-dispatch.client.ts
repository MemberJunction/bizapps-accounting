/**
 * BatchDispatchClient — a thin, strongly-typed wrapper over the batch **Remote Operations**
 * (`Accounting.BuildBatch` / `RegenerateBatch` / `DispatchBatch` / `RecordBatchDecision` /
 * `GetBatchApprovalState`).
 *
 * MIGRATED 2026-07-21 (Marcelo): these used to be a hand-written GraphQL resolver (`BatchDispatchResolver`)
 * + gql documents here. Every batch mutation now travels MJ's **Remote Operations** stack — the same
 * primitive as the §8.2 workspace's `batch-workspace.client.ts` — so build/regenerate/approve/reject/
 * dispatch all enforce their constraints through ONE stack ("that is our stack for all custom processes
 * where we want to enforce constraints"). The component call sites and result shapes are UNCHANGED; only
 * the transport under them moved from a bespoke resolver to `provider.RouteOperation(key, input)`.
 *
 * Error contract (unchanged): each method catches/maps a failed RemoteOpResult into a
 * `{ Success: false, ErrorMessage }`-shaped result rather than throwing — so the UI renders a friendly
 * message without a try/catch around every call. An empty/zero-net build or a regenerate-to-nothing now
 * arrives here as `Success:false` + the engine's message (the engine throws EmptyBatchError), not a
 * silent NothingToBatch success.
 */
import { IRemoteOperationProvider, LogError } from '@memberjunction/core';

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

/** The camelCase build result the `Accounting.BuildBatch` / `RegenerateBatch` operations return. */
interface BuildBatchOpOutput {
  batchId: string;
  summaryLineCount: number;
  totalDebits: number;
  totalCredits: number;
  jeCount: number;
  companyCount: number;
  approvalTaskRaised: boolean;
}

export class BatchDispatchClient {
  private provider: IRemoteOperationProvider;

  constructor(provider: IRemoteOperationProvider) {
    this.provider = provider;
  }

  /** Map a build/regenerate op Output onto the component-facing PascalCase result. */
  private toBuildResult(o: BuildBatchOpOutput): BuildJEBatchResult {
    return {
      Success: true,
      NothingToBatch: false,
      BatchID: o.batchId,
      SummaryLineCount: o.summaryLineCount,
      TotalDebits: o.totalDebits,
      TotalCredits: o.totalCredits,
      JECount: o.jeCount,
      CompanyCount: o.companyCount,
    };
  }

  /**
   * Build ONE Pending multi-company batch from pending JEs (Source='Standard'; raises the CFO task).
   * `companyIds` narrows the sweep to those companies — the dashboard omits it (build ALL pending);
   * scoped callers (e.g. tests running amid demo data) pass the companies they own.
   */
  public async BuildBatch(targetSystem: string, companyIds?: string[]): Promise<BuildJEBatchResult> {
    const empty = { Success: false, SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, CompanyCount: 0, NothingToBatch: false };
    try {
      const res = await this.provider.RouteOperation<Record<string, unknown>, BuildBatchOpOutput>(
        'Accounting.BuildBatch', { TargetSystem: targetSystem, Source: 'Standard', CompanyIDs: companyIds?.length ? companyIds : null },
      );
      if (!res.Success || !res.Output) return { ...empty, ErrorMessage: res.ErrorMessage ?? 'Nothing to batch.' };
      return this.toBuildResult(res.Output);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchDispatchClient.BuildBatch failed: ${msg}`);
      return { ...empty, ErrorMessage: msg };
    }
  }

  /**
   * Regenerate an OPEN (Pending) batch: unlock its current JEs, re-gather ALL current candidates, and
   * rebuild the summary on the same batch. A regenerate that finds nothing cancels the batch and
   * arrives here as `Success:false` with the engine's message.
   */
  public async RegenerateBatch(batchID: string, targetSystem: string): Promise<BuildJEBatchResult> {
    const empty = { Success: false, SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, CompanyCount: 0, NothingToBatch: false };
    try {
      const res = await this.provider.RouteOperation<Record<string, unknown>, BuildBatchOpOutput>(
        'Accounting.RegenerateBatch', { BatchID: batchID, TargetSystem: targetSystem },
      );
      if (!res.Success || !res.Output) return { ...empty, ErrorMessage: res.ErrorMessage ?? 'Regenerate produced no batch.' };
      return this.toBuildResult(res.Output);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchDispatchClient.RegenerateBatch failed: ${msg}`);
      return { ...empty, ErrorMessage: msg };
    }
  }

  /** Dispatch an Approved batch to the ERP (mock poster for v1). */
  public async DispatchBatch(batchID: string): Promise<DispatchJEBatchResult> {
    try {
      const res = await this.provider.RouteOperation<Record<string, unknown>, { Status: string; ExternalBatchRef: string | null }>(
        'Accounting.DispatchBatch', { BatchID: batchID },
      );
      if (!res.Success || !res.Output) return { Success: false, ErrorMessage: res.ErrorMessage ?? 'Dispatch failed.' };
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
      const res = await this.provider.RouteOperation<Record<string, unknown>, { Recorded: boolean }>(
        'Accounting.RecordBatchDecision', { BatchID: batchID, Decision: decision, Notes: notes ?? null },
      );
      if (!res.Success) return { Success: false, ErrorMessage: res.ErrorMessage ?? 'Failed to record the decision.' };
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
      const res = await this.provider.RouteOperation<Record<string, unknown>, { Approved: boolean; Reason?: string }>(
        'Accounting.GetBatchApprovalState', { BatchID: batchID },
      );
      if (!res.Success || !res.Output) return { Success: false, Approved: false, Reason: res.ErrorMessage ?? 'No response from server.' };
      return { Success: true, Approved: res.Output.Approved, Reason: res.Output.Reason };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BatchDispatchClient.GetApprovalState failed: ${msg}`);
      return { Success: false, Approved: false, Reason: msg };
    }
  }
}
