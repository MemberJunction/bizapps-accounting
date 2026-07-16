/**
 * BuildBatchOperation / PreviewBatchOperation — the §8.2 Batch-workspace seam.
 *
 * `Accounting.PreviewBatch` (read-only) + `Accounting.BuildBatch` (writes). Code-only Remote
 * Operations: ONE call site works both in-process (server) and over GraphQL (the workspace UI), so
 * the workspace does not need a hand-written resolver + client pair. Same pattern as
 * `Accounting.CreateJournalEntry` / `Accounting.MaterializeDueScheduledEntries`.
 *
 * These are thin by design — every rule (the candidate filter, netting, MOD-8 out-of-order, the
 * MOD-14 transactions) lives in BatchingEngine and is unit/integration tested there. The operation's
 * only jobs are: marshal the input, pick the right engine entry point, and pass the request's
 * provider through so the writes land on the caller's transaction-capable provider.
 *
 * CONNECTS TO:
 *   ENGINE: ./BatchingEngine (previewBatch · buildBatch · buildBatchFromView · buildBatchFromExplicitIds)
 *   GATE:   ./TasksAppApprovalGate (the CFO approval task — raised in its OWN transaction, MOD-14)
 */
import { BaseRemotableOperation, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  previewBatch,
  buildBatch,
  buildBatchFromView,
  buildBatchFromExplicitIds,
  type BatchTargetSystem,
  type BuildBatchOptions,
  type BuildBatchResult,
  type BatchPreviewResult,
} from './BatchingEngine.js';
import { TasksAppApprovalGate } from './TasksAppApprovalGate.js';

/** The §8.2 criteria panel, on the wire. Dates are ISO strings; everything else is optional. */
export interface BatchCriteriaInput {
  /** ISO date or datetime. A DATE-only value is INCLUSIVE of that whole day (MOD-8). */
  Cutoff?: string | null;
  /** ISO date. Optional lower bound; omit for the standard oldest-forward flow. */
  StartDate?: string | null;
  /** Omit/empty = ALL companies (the CH-4 global sweep). */
  CompanyIDs?: string[] | null;
  /** Omit/empty = all entry types. */
  EntryTypes?: string[] | null;
}

export interface PreviewBatchInput extends BatchCriteriaInput {
  /**
   * The operator's ticked selection. Omit to preview the whole candidate pool. Supplying it is what
   * makes the summary/totals/out-of-order warning reflect the include/exclude state.
   */
  IncludedJournalEntryIDs?: string[] | null;
}

export interface BuildBatchInput extends BatchCriteriaInput {
  TargetSystem: BatchTargetSystem;
  /**
   * Source. 'Standard' = oldest-forward over the criteria (B1.1). 'View' = a saved MJ User View
   * snapshot (B1.2, requires ViewID). 'Explicit' = exactly these ids (the include/exclude build).
   */
  Source?: 'Standard' | 'View' | 'Explicit';
  /** Required when Source='View'. */
  ViewID?: string | null;
  /** Required when Source='Explicit'. */
  JournalEntryIDs?: string[] | null;
}

/** `null` when there was nothing to batch (or it all netted to zero) — NOT an error. */
export type BuildBatchOperationResult = (BuildBatchResult & { NothingToBatch: false }) | { NothingToBatch: true };

function toOptions(input: BatchCriteriaInput): BuildBatchOptions {
  return {
    cutoff: input.Cutoff ? new Date(input.Cutoff) : null,
    startDate: input.StartDate ? new Date(input.StartDate) : null,
    companyIds: input.CompanyIDs ?? null,
    entryTypes: input.EntryTypes ?? null,
  };
}

@RegisterClass(BaseRemotableOperation, 'Accounting.PreviewBatch')
export class PreviewBatchOperation extends BaseRemotableOperation<PreviewBatchInput, BatchPreviewResult> {
  public readonly OperationKey = 'Accounting.PreviewBatch';

  protected async InternalExecute(
    input: PreviewBatchInput,
    _provider: IMetadataProvider,
    user: UserInfo,
  ): Promise<BatchPreviewResult> {
    const included = input?.IncludedJournalEntryIDs?.length ? new Set(input.IncludedJournalEntryIDs) : undefined;
    return previewBatch(toOptions(input ?? {}), user, included);
  }
}

@RegisterClass(BaseRemotableOperation, 'Accounting.BuildBatch')
export class BuildBatchOperation extends BaseRemotableOperation<BuildBatchInput, BuildBatchOperationResult> {
  public readonly OperationKey = 'Accounting.BuildBatch';

  protected async InternalExecute(
    input: BuildBatchInput,
    provider: IMetadataProvider,
    user: UserInfo,
  ): Promise<BuildBatchOperationResult> {
    // The REAL tasks-backed CFO gate, constructed per call — the same thing BatchDispatchResolver
    // does. A module-level gate would be shared mutable state across requests.
    const options = toOptions(input);
    const source = input.Source ?? 'Standard';
    let result: BuildBatchResult | null;

    switch (source) {
      case 'View':
        if (!input.ViewID) throw new Error('BuildBatch: Source=View requires a ViewID.');
        result = await buildBatchFromView(input.ViewID, input.TargetSystem, user.ID, user, new TasksAppApprovalGate(), options, provider);
        break;
      case 'Explicit':
        if (!input.JournalEntryIDs?.length) throw new Error('BuildBatch: Source=Explicit requires JournalEntryIDs.');
        result = await buildBatchFromExplicitIds(input.JournalEntryIDs, input.TargetSystem, user.ID, user, new TasksAppApprovalGate(), provider);
        break;
      case 'Standard':
        result = await buildBatch(input.TargetSystem, user.ID, user, new TasksAppApprovalGate(), options, provider);
        break;
      default:
        // Total today; the default keeps it total if the union ever widens.
        throw new Error(`BuildBatch: unknown Source '${source}'.`);
    }

    // A null result means the candidate pool was empty or netted to zero. That is a legitimate
    // outcome the workspace reports ("nothing to batch"), never an error.
    if (!result) return { NothingToBatch: true };
    return { ...result, NothingToBatch: false };
  }
}

/** Tree-shaking anchors — called from the server bootstrap so `@RegisterClass` is retained. */
export function LoadBuildBatchOperations(): void {
  // intentionally empty
}
