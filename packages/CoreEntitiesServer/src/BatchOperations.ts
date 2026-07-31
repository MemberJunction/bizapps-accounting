/**
 * BatchOperations — the batch build / review / approve / reject / regenerate / dispatch surface,
 * as code-only Remote Operations.
 *
 * This CONSOLIDATES what used to be a hand-written GraphQL resolver + client pair
 * (BatchDispatchResolver in @mj-biz-apps/accounting-server + BatchDispatchClient in the Angular
 * package) onto MJ's Remote Operations stack — the same primitive as
 * Accounting.CreateJournalEntry/CreateJournalEntries. The ruling (Marcelo 2026-07-21, reaffirmed
 * with the four-surface doctrine 2026-07-28): "everything with creating, approving, regenerating,
 * and canceling a batch must be engine + transaction based … that is our stack for all custom
 * processes where we want to enforce constraints." Every batch action runs the batching engine
 * server-side, so remote ops (the 4th client surface) are the sanctioned way to invoke them from
 * the UI; one call site works both in-process and over GraphQL via `RouteOperation`.
 *
 *   Accounting.BuildBatch            → buildBatch(...)      one single-company batch (D7), or the
 *                                                            all-pending sweep when CompanyID is omitted
 *   Accounting.RegenerateBatch       → regenerateBatch(...) rebuild a Pending batch in place; empty → cancel + throw
 *   Accounting.DispatchBatch         → sendBatch(...)       Approved→Sent→Posted via the mock ERP poster (v1)
 *   Accounting.RecordBatchDecision   → gate.recordDecision + approveBatch | cancelBatch (in-app CFO approve/reject)
 *   Accounting.GetBatchApprovalState → gate.assertApproved probe (read-only: is this batch dispatchable?)
 *
 * These are thin by design — every rule (netting, the one-transaction build incl. the approval
 * Task + ApprovalTaskID stamp (D10 rev. 2026-07-29), the CFO precondition, EmptyBatchError) lives
 * in BatchingEngine/TasksAppApprovalGate and is tested there. The operation's only jobs are:
 * marshal the input, pick the right engine entry point, and pass the request's provider through so
 * writes land on the caller's transaction-capable provider.
 *
 * CONNECTS TO:
 *   ENGINE: ./BatchingEngine (buildBatch · regenerateBatch · sendBatch · approveBatch · cancelBatch)
 *   GATE:   ./TasksAppApprovalGate (the bizapps-tasks-backed CFO gate; provider-injected)
 */
import { BaseRemotableOperation, IMetadataProvider, IRunViewProvider, RunView, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  buildBatch,
  buildBatchFromExplicitIds,
  buildBatchFromView,
  previewBatch,
  regenerateBatch,
  sendBatch,
  approveBatch,
  cancelBatch,
  pendingCompanies,
  mockErpPoster,
  EmptyBatchError,
  type BatchTargetSystem,
  type BuildBatchResult,
  type BuildBatchOptions,
  type BatchPreviewResult,
} from './BatchingEngine.js';
import { TasksAppApprovalGate } from './TasksAppApprovalGate.js';
import type { TaskDecisionOutcomeCode } from '@mj-biz-apps/tasks-core';

const PERSON_ENTITY = 'MJ_BizApps_Common: People';

// ─── Accounting.PreviewBatch + Accounting.BuildBatch ─────────────────────────

/** The workspace criteria panel, on the wire. Dates are ISO strings; everything else optional. */
export interface BatchCriteriaInput {
  /** ISO date or datetime. A DATE-only value is INCLUSIVE of that whole day. */
  Cutoff?: string | null;
  /** ISO date. Optional lower bound; omit for the standard oldest-forward flow. */
  StartDate?: string | null;
  /** Omit/empty = all companies (each still builds its OWN single-company batch, D7). */
  CompanyIDs?: string[] | null;
  /** JournalEntryType CODES (issue #24 vocabulary). Omit/empty = all non-summary types. */
  EntryTypeCodes?: string[] | null;
}

function toOptions(input: BatchCriteriaInput | undefined): BuildBatchOptions {
  return {
    cutoff: input?.Cutoff ? new Date(input.Cutoff) : null,
    startDate: input?.StartDate ? new Date(input.StartDate) : null,
    companyIds: input?.CompanyIDs?.length ? input.CompanyIDs : null,
    entryTypeCodes: input?.EntryTypeCodes?.length ? input.EntryTypeCodes : null,
  };
}

export interface PreviewBatchInput extends BatchCriteriaInput {
  /**
   * The operator's ticked selection. Omit to preview the whole candidate pool. Supplying it is
   * what makes the summary/totals/out-of-order warning reflect the include/exclude state.
   */
  IncludedJournalEntryIDs?: string[] | null;
}

/**
 * Read-only preview of what a build would produce — Amith's canonical remote-op example
 * (2026-07-28): an in-memory server computation invoked from the UI. Runs the SAME filter/order/
 * netting machinery as the build, so it cannot drift from what the build actually does.
 */
@RegisterClass(BaseRemotableOperation, 'Accounting.PreviewBatch')
export class PreviewBatchOperation extends BaseRemotableOperation<PreviewBatchInput, BatchPreviewResult> {
  public readonly OperationKey = 'Accounting.PreviewBatch';

  protected async InternalExecute(input: PreviewBatchInput, provider: IMetadataProvider, user: UserInfo): Promise<BatchPreviewResult> {
    const included = input?.IncludedJournalEntryIDs?.length ? new Set(input.IncludedJournalEntryIDs) : undefined;
    return previewBatch(toOptions(input), user, provider, included);
  }
}

export interface BuildBatchInput extends BatchCriteriaInput {
  TargetSystem: BatchTargetSystem;
  /**
   * Source. 'Standard' (default) = the criteria-driven sweep — one single-company batch per
   * company with candidates (an explicit CompanyID narrows it to that company, loudly). 'View' =
   * a saved MJ User View snapshot (requires ViewID). 'Explicit' = exactly these ids (the
   * workspace's include/exclude build; requires JournalEntryIDs).
   */
  Source?: 'Standard' | 'View' | 'Explicit';
  /**
   * Standard-source narrowing: build ONE batch for this company (EmptyBatchError surfaces loudly).
   * Omit for the sweep.
   */
  CompanyID?: string | null;
  /** Required when Source='View'. */
  ViewID?: string | null;
  /** Required when Source='Explicit'. */
  JournalEntryIDs?: string[] | null;
}

export interface BuildBatchOutput {
  /** One entry per batch built (any source can build several — one per company, D7). */
  Batches: BuildBatchResult[];
  /** True when the sweep found no company with anything to batch (a sweep over nothing is not an error). */
  NothingToBatch: boolean;
}

@RegisterClass(BaseRemotableOperation, 'Accounting.BuildBatch')
export class BuildBatchOperation extends BaseRemotableOperation<BuildBatchInput, BuildBatchOutput> {
  public readonly OperationKey = 'Accounting.BuildBatch';

  protected async InternalExecute(input: BuildBatchInput, provider: IMetadataProvider, user: UserInfo): Promise<BuildBatchOutput> {
    if (!input?.TargetSystem) throw new Error('BuildBatch: TargetSystem is required.');
    const gate = new TasksAppApprovalGate(provider);
    const options = toOptions(input);
    const source = input.Source ?? 'Standard';

    switch (source) {
      case 'View': {
        if (!input.ViewID) throw new Error('BuildBatch: Source=View requires a ViewID.');
        const batches = await buildBatchFromView(input.ViewID, input.TargetSystem, user.ID, user, provider, gate, options);
        return { Batches: batches, NothingToBatch: false };
      }
      case 'Explicit': {
        if (!input.JournalEntryIDs?.length) throw new Error('BuildBatch: Source=Explicit requires JournalEntryIDs.');
        const batches = await buildBatchFromExplicitIds(input.JournalEntryIDs, input.TargetSystem, user.ID, user, provider, gate);
        return { Batches: batches, NothingToBatch: false };
      }
      case 'Standard': {
        if (input.CompanyID) {
          // Explicit company: EmptyBatchError propagates — the caller asked for THIS build and
          // must hear loudly that there was nothing to batch.
          const result = await buildBatch(input.CompanyID, input.TargetSystem, user.ID, user, provider, gate, options);
          return { Batches: [result], NothingToBatch: false };
        }
        // Sweep: one batch per company with candidates; a company that nets to zero is skipped.
        const batches: BuildBatchResult[] = [];
        for (const companyId of await pendingCompanies(user, provider, options)) {
          try {
            batches.push(await buildBatch(companyId, input.TargetSystem, user.ID, user, provider, gate, options));
          } catch (e) {
            if (e instanceof EmptyBatchError) continue;
            throw e;
          }
        }
        return { Batches: batches, NothingToBatch: batches.length === 0 };
      }
      default:
        // Total today; the default keeps it total if the union ever widens.
        throw new Error(`BuildBatch: unknown Source '${source}'.`);
    }
  }
}

// ─── Accounting.RegenerateBatch ──────────────────────────────────────────────

export interface RegenerateBatchInput { BatchID: string; TargetSystem: BatchTargetSystem }

@RegisterClass(BaseRemotableOperation, 'Accounting.RegenerateBatch')
export class RegenerateBatchOperation extends BaseRemotableOperation<RegenerateBatchInput, BuildBatchResult> {
  public readonly OperationKey = 'Accounting.RegenerateBatch';

  protected async InternalExecute(input: RegenerateBatchInput, provider: IMetadataProvider, user: UserInfo): Promise<BuildBatchResult> {
    if (!input?.BatchID) throw new Error('RegenerateBatch: BatchID is required.');
    if (!input?.TargetSystem) throw new Error('RegenerateBatch: TargetSystem is required.');
    // A re-gather to NOTHING cancels the batch and throws EmptyBatchError (surfaced to the caller
    // as a failed operation with that message) — never a silent empty batch.
    return regenerateBatch(input.BatchID, input.TargetSystem, user, provider);
  }
}

// ─── Accounting.DispatchBatch ────────────────────────────────────────────────

export interface DispatchBatchInput { BatchID: string }
export interface DispatchBatchOutput { Status: string; ExternalBatchRef: string | null }

/** Dispatch an Approved batch to the ERP (mock poster, v1). The gate + Status='Approved' block otherwise. */
@RegisterClass(BaseRemotableOperation, 'Accounting.DispatchBatch')
export class DispatchBatchOperation extends BaseRemotableOperation<DispatchBatchInput, DispatchBatchOutput> {
  public readonly OperationKey = 'Accounting.DispatchBatch';

  protected async InternalExecute(input: DispatchBatchInput, provider: IMetadataProvider, user: UserInfo): Promise<DispatchBatchOutput> {
    if (!input?.BatchID) throw new Error('DispatchBatch: BatchID is required.');
    const batch = await sendBatch(input.BatchID, user, { gate: new TasksAppApprovalGate(provider), poster: mockErpPoster, provider });
    return { Status: batch.Status, ExternalBatchRef: batch.ExternalBatchRef ?? null };
  }
}

// ─── Accounting.RecordBatchDecision ──────────────────────────────────────────

/** The in-app CFO decision outcomes. Mirrors tasks-core's TaskDecisionOutcomeCode. */
export type BatchDecisionOutcome = 'Approved' | 'ApprovedWithConditions' | 'Rejected';
const VALID_DECISIONS: ReadonlySet<string> = new Set(['Approved', 'ApprovedWithConditions', 'Rejected']);

export interface RecordBatchDecisionInput { BatchID: string; Decision: BatchDecisionOutcome; Notes?: string | null }
export interface RecordBatchDecisionOutput { Recorded: true }

/**
 * Record an in-app CFO approve/reject decision against the batch's approval Task. An approval also
 * flips the batch Pending→Approved (content freeze + dispatchable); a rejection cancels the batch
 * and returns its journal entries to the candidate pool (a reject has a visible financial effect,
 * not a dead no-op).
 */
@RegisterClass(BaseRemotableOperation, 'Accounting.RecordBatchDecision')
export class RecordBatchDecisionOperation extends BaseRemotableOperation<RecordBatchDecisionInput, RecordBatchDecisionOutput> {
  public readonly OperationKey = 'Accounting.RecordBatchDecision';

  protected async InternalExecute(input: RecordBatchDecisionInput, provider: IMetadataProvider, user: UserInfo): Promise<RecordBatchDecisionOutput> {
    if (!input?.BatchID) throw new Error('RecordBatchDecision: BatchID is required.');
    if (!VALID_DECISIONS.has(input?.Decision)) {
      throw new Error(`RecordBatchDecision: invalid decision '${input?.Decision}'. Expected Approved | ApprovedWithConditions | Rejected.`);
    }
    const personId = await this.resolveCurrentPersonId(user, provider);
    await new TasksAppApprovalGate(provider).recordDecision(
      input.BatchID, input.Decision as TaskDecisionOutcomeCode, personId, input.Notes ?? undefined, user);

    if (input.Decision === 'Approved' || input.Decision === 'ApprovedWithConditions') {
      await approveBatch(input.BatchID, user.ID, user, provider);
    } else {
      await cancelBatch(input.BatchID, user, provider);
    }
    return { Recorded: true };
  }

  /**
   * The current MJ user's bizapps-common Person ID (Person.LinkedUserID == user.ID), so the recorded
   * decision is attributed to the right approver Person. Undefined when no Person is linked (the
   * gate's RecordDecision treats DecidedByPersonID as optional).
   */
  private async resolveCurrentPersonId(user: UserInfo, provider: IMetadataProvider): Promise<string | undefined> {
    const rv = new RunView(provider as unknown as IRunViewProvider);
    const res = await rv.RunView<{ ID: string }>(
      { EntityName: PERSON_ENTITY, ExtraFilter: `LinkedUserID='${user.ID}'`, Fields: ['ID'], MaxRows: 1, ResultType: 'simple', BypassCache: true },
      user,
    );
    return res.Success ? res.Results?.[0]?.ID : undefined;
  }
}

// ─── Accounting.GetBatchApprovalState ────────────────────────────────────────

export interface GetBatchApprovalStateInput { BatchID: string }
export interface GetBatchApprovalStateOutput { Approved: boolean; Reason?: string }

/** Read-only probe: is this batch approved to dispatch? Drives the UI's Dispatch-button enable state. */
@RegisterClass(BaseRemotableOperation, 'Accounting.GetBatchApprovalState')
export class GetBatchApprovalStateOperation extends BaseRemotableOperation<GetBatchApprovalStateInput, GetBatchApprovalStateOutput> {
  public readonly OperationKey = 'Accounting.GetBatchApprovalState';

  protected async InternalExecute(input: GetBatchApprovalStateInput, provider: IMetadataProvider, user: UserInfo): Promise<GetBatchApprovalStateOutput> {
    if (!input?.BatchID) throw new Error('GetBatchApprovalState: BatchID is required.');
    // assertApproved throws when not approved — turn that into a boolean for the UI.
    try {
      await new TasksAppApprovalGate(provider).assertApproved(input.BatchID, user);
      return { Approved: true };
    } catch (notApproved) {
      return { Approved: false, Reason: notApproved instanceof Error ? notApproved.message : String(notApproved) };
    }
  }
}

/**
 * Tree-shaking anchor — called from the app's server bootstrap so the `@RegisterClass`
 * registrations are retained and the operations stay resolvable by key.
 */
export function LoadBatchOperations(): void {
  // intentionally empty
}
