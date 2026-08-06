/**
 * JournalEntryBatchOperations — the batch build / review / approve / reject / regenerate / dispatch surface,
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
 *   Accounting.BuildJournalEntryBatch            → buildJournalEntryBatch(...)      one single-company batch (D7), or the
 *                                                            all-pending sweep when CompanyID is omitted
 *   Accounting.RegenerateJournalEntryBatch       → regenerateJournalEntryBatch(...) rebuild a Pending batch in place; empty → cancel + throw
 *   Accounting.DispatchJournalEntryBatch         → sendJournalEntryBatch(...)       Approved→Sent→Posted via the mock ERP poster (v1)
 *   Accounting.RecordJournalEntryBatchDecision   → gate.recordDecision + approveJournalEntryBatch | cancelJournalEntryBatch (in-app CFO approve/reject)
 *   Accounting.GetJournalEntryBatchApprovalState → gate.assertApproved probe (read-only: is this batch dispatchable?)
 *
 * These are thin by design — every rule (netting, the one-transaction build incl. the approval
 * Task + ApprovalTaskID stamp (D10 rev. 2026-07-29), the CFO precondition, EmptyJournalEntryBatchError) lives
 * in JournalEntryBatchEngine/TasksAppApprovalGate and is tested there. The operation's only jobs are:
 * marshal the input, pick the right engine entry point, and pass the request's provider through so
 * writes land on the caller's transaction-capable provider.
 *
 * CONNECTS TO:
 *   ENGINE: ./JournalEntryBatchEngine (buildJournalEntryBatch · regenerateJournalEntryBatch · sendJournalEntryBatch · approveJournalEntryBatch · cancelJournalEntryBatch)
 *   GATE:   ./TasksAppApprovalGate (the bizapps-tasks-backed CFO gate; provider-injected)
 */
import { BaseRemotableOperation, IMetadataProvider, IRunViewProvider, RunView, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  buildJournalEntryBatch,
  buildJournalEntryBatchFromExplicitIds,
  buildJournalEntryBatchFromView,
  previewBatch,
  regenerateJournalEntryBatch,
  sendJournalEntryBatch,
  approveJournalEntryBatch,
  cancelJournalEntryBatch,
  pendingCompanies,
  mockErpPoster,
  EmptyJournalEntryBatchError,
  type JournalEntryBatchTargetSystem,
  type BuildJournalEntryBatchResult,
  type BuildJournalEntryBatchOptions,
  type JournalEntryBatchPreviewResult,
} from './JournalEntryBatchEngine.js';
import { TasksAppApprovalGate } from './TasksAppApprovalGate.js';
import {
  IsApprovalOutcome,
  IsTaskDecisionOutcomeCode,
  TaskDecisionOutcomeCodes,
  type TaskDecisionOutcomeCode,
} from '@mj-biz-apps/tasks-core';

const PERSON_ENTITY = 'MJ_BizApps_Common: People';

// ─── Accounting.PreviewJournalEntryBatch + Accounting.BuildJournalEntryBatch ─────────────────────────

/** The workspace criteria panel, on the wire. Dates are ISO strings; everything else optional. */
export interface JournalEntryBatchCriteriaInput {
  /** ISO date or datetime. A DATE-only value is INCLUSIVE of that whole day. */
  Cutoff?: string | null;
  /** ISO date. Optional lower bound; omit for the standard oldest-forward flow. */
  StartDate?: string | null;
  /** Omit/empty = all companies (each still builds its OWN single-company batch, D7). */
  CompanyIDs?: string[] | null;
  /** JournalEntryType CODES (issue #24 vocabulary). Omit/empty = all non-summary types. */
  EntryTypeCodes?: string[] | null;
}

function toOptions(input: JournalEntryBatchCriteriaInput | undefined): BuildJournalEntryBatchOptions {
  return {
    cutoff: input?.Cutoff ? new Date(input.Cutoff) : null,
    startDate: input?.StartDate ? new Date(input.StartDate) : null,
    companyIds: input?.CompanyIDs?.length ? input.CompanyIDs : null,
    entryTypeCodes: input?.EntryTypeCodes?.length ? input.EntryTypeCodes : null,
  };
}

export interface PreviewJournalEntryBatchInput extends JournalEntryBatchCriteriaInput {
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
@RegisterClass(BaseRemotableOperation, 'Accounting.PreviewJournalEntryBatch')
export class PreviewJournalEntryBatchOperation extends BaseRemotableOperation<PreviewJournalEntryBatchInput, JournalEntryBatchPreviewResult> {
  public readonly OperationKey = 'Accounting.PreviewJournalEntryBatch';

  protected async InternalExecute(input: PreviewJournalEntryBatchInput, provider: IMetadataProvider, user: UserInfo): Promise<JournalEntryBatchPreviewResult> {
    const included = input?.IncludedJournalEntryIDs?.length ? new Set(input.IncludedJournalEntryIDs) : undefined;
    return previewBatch(toOptions(input), user, provider, included);
  }
}

export interface BuildJournalEntryBatchInput extends JournalEntryBatchCriteriaInput {
  TargetSystem: JournalEntryBatchTargetSystem;
  /**
   * Source. 'Standard' (default) = the criteria-driven sweep — one single-company batch per
   * company with candidates (an explicit CompanyID narrows it to that company, loudly). 'View' =
   * a saved MJ User View snapshot (requires ViewID). 'Explicit' = exactly these ids (the
   * workspace's include/exclude build; requires JournalEntryIDs).
   */
  Source?: 'Standard' | 'View' | 'Explicit';
  /**
   * Standard-source narrowing: build ONE batch for this company (EmptyJournalEntryBatchError surfaces loudly).
   * Omit for the sweep.
   */
  CompanyID?: string | null;
  /** Required when Source='View'. */
  ViewID?: string | null;
  /** Required when Source='Explicit'. */
  JournalEntryIDs?: string[] | null;
}

export interface BuildJournalEntryBatchOutput {
  /** One entry per batch built (any source can build several — one per company, D7). */
  Batches: BuildJournalEntryBatchResult[];
  /** True when the sweep found no company with anything to batch (a sweep over nothing is not an error). */
  NothingToBatch: boolean;
}

@RegisterClass(BaseRemotableOperation, 'Accounting.BuildJournalEntryBatch')
export class BuildJournalEntryBatchOperation extends BaseRemotableOperation<BuildJournalEntryBatchInput, BuildJournalEntryBatchOutput> {
  public readonly OperationKey = 'Accounting.BuildJournalEntryBatch';

  protected async InternalExecute(input: BuildJournalEntryBatchInput, provider: IMetadataProvider, user: UserInfo): Promise<BuildJournalEntryBatchOutput> {
    if (!input?.TargetSystem) throw new Error('BuildJournalEntryBatch: TargetSystem is required.');
    const gate = new TasksAppApprovalGate(provider);
    const options = toOptions(input);
    const source = input.Source ?? 'Standard';

    switch (source) {
      case 'View': {
        if (!input.ViewID) throw new Error('BuildJournalEntryBatch: Source=View requires a ViewID.');
        const batches = await buildJournalEntryBatchFromView(input.ViewID, input.TargetSystem, user.ID, user, provider, gate, options);
        return { Batches: batches, NothingToBatch: false };
      }
      case 'Explicit': {
        if (!input.JournalEntryIDs?.length) throw new Error('BuildJournalEntryBatch: Source=Explicit requires JournalEntryIDs.');
        const batches = await buildJournalEntryBatchFromExplicitIds(input.JournalEntryIDs, input.TargetSystem, user.ID, user, provider, gate);
        return { Batches: batches, NothingToBatch: false };
      }
      case 'Standard': {
        if (input.CompanyID) {
          // Explicit company: EmptyJournalEntryBatchError propagates — the caller asked for THIS build and
          // must hear loudly that there was nothing to batch.
          const result = await buildJournalEntryBatch(input.CompanyID, input.TargetSystem, user.ID, user, provider, gate, options);
          return { Batches: [result], NothingToBatch: false };
        }
        // Sweep: one batch per company with candidates; a company that nets to zero is skipped.
        const batches: BuildJournalEntryBatchResult[] = [];
        for (const companyId of await pendingCompanies(user, provider, options)) {
          try {
            batches.push(await buildJournalEntryBatch(companyId, input.TargetSystem, user.ID, user, provider, gate, options));
          } catch (e) {
            if (e instanceof EmptyJournalEntryBatchError) continue;
            throw e;
          }
        }
        return { Batches: batches, NothingToBatch: batches.length === 0 };
      }
      default:
        // Total today; the default keeps it total if the union ever widens.
        throw new Error(`BuildJournalEntryBatch: unknown Source '${source}'.`);
    }
  }
}

// ─── Accounting.RegenerateJournalEntryBatch ──────────────────────────────────────────────

export interface RegenerateJournalEntryBatchInput { JournalEntryBatchID: string; TargetSystem: JournalEntryBatchTargetSystem }

@RegisterClass(BaseRemotableOperation, 'Accounting.RegenerateJournalEntryBatch')
export class RegenerateJournalEntryBatchOperation extends BaseRemotableOperation<RegenerateJournalEntryBatchInput, BuildJournalEntryBatchResult> {
  public readonly OperationKey = 'Accounting.RegenerateJournalEntryBatch';

  protected async InternalExecute(input: RegenerateJournalEntryBatchInput, provider: IMetadataProvider, user: UserInfo): Promise<BuildJournalEntryBatchResult> {
    if (!input?.JournalEntryBatchID) throw new Error('RegenerateJournalEntryBatch: JournalEntryBatchID is required.');
    if (!input?.TargetSystem) throw new Error('RegenerateJournalEntryBatch: TargetSystem is required.');
    // A re-gather to NOTHING cancels the batch and throws EmptyJournalEntryBatchError (surfaced to the caller
    // as a failed operation with that message) — never a silent empty batch.
    return regenerateJournalEntryBatch(input.JournalEntryBatchID, input.TargetSystem, user, provider);
  }
}

// ─── Accounting.DispatchJournalEntryBatch ────────────────────────────────────────────────

export interface DispatchJournalEntryBatchInput { JournalEntryBatchID: string }
export interface DispatchJournalEntryBatchOutput { Status: string; ExternalJournalEntryBatchRef: string | null }

/** Dispatch an Approved batch to the ERP (mock poster, v1). The gate + Status='Approved' block otherwise. */
@RegisterClass(BaseRemotableOperation, 'Accounting.DispatchJournalEntryBatch')
export class DispatchJournalEntryBatchOperation extends BaseRemotableOperation<DispatchJournalEntryBatchInput, DispatchJournalEntryBatchOutput> {
  public readonly OperationKey = 'Accounting.DispatchJournalEntryBatch';

  protected async InternalExecute(input: DispatchJournalEntryBatchInput, provider: IMetadataProvider, user: UserInfo): Promise<DispatchJournalEntryBatchOutput> {
    if (!input?.JournalEntryBatchID) throw new Error('DispatchJournalEntryBatch: JournalEntryBatchID is required.');
    const batch = await sendJournalEntryBatch(input.JournalEntryBatchID, user, { gate: new TasksAppApprovalGate(provider), poster: mockErpPoster, provider });
    return { Status: batch.Status, ExternalJournalEntryBatchRef: batch.ExternalJournalEntryBatchRef ?? null };
  }
}

// ─── Accounting.RecordJournalEntryBatchDecision ──────────────────────────────────────────

/**
 * The in-app CFO decision outcomes — tasks-core's set, not a copy of it.
 *
 * This was an independently-declared union plus a hand-written `Set` of the same three literals.
 * Both compiled cleanly against a widened `TaskDecisionOutcomeCode`, so an outcome added in
 * bizapps-tasks would have been rejected here as invalid while every type still checked.
 */
export type JournalEntryBatchDecisionOutcome = TaskDecisionOutcomeCode;

export interface RecordJournalEntryBatchDecisionInput { JournalEntryBatchID: string; Decision: JournalEntryBatchDecisionOutcome; Notes?: string | null }
export interface RecordJournalEntryBatchDecisionOutput { Recorded: true }

/**
 * Record an in-app CFO approve/reject decision against the batch's approval Task. An approval also
 * flips the batch Pending→Approved (content freeze + dispatchable); a rejection cancels the batch
 * and returns its journal entries to the candidate pool (a reject has a visible financial effect,
 * not a dead no-op).
 */
@RegisterClass(BaseRemotableOperation, 'Accounting.RecordJournalEntryBatchDecision')
export class RecordJournalEntryBatchDecisionOperation extends BaseRemotableOperation<RecordJournalEntryBatchDecisionInput, RecordJournalEntryBatchDecisionOutput> {
  public readonly OperationKey = 'Accounting.RecordJournalEntryBatchDecision';

  protected async InternalExecute(input: RecordJournalEntryBatchDecisionInput, provider: IMetadataProvider, user: UserInfo): Promise<RecordJournalEntryBatchDecisionOutput> {
    if (!input?.JournalEntryBatchID) throw new Error('RecordBatchDecision: JournalEntryBatchID is required.');
    if (!IsTaskDecisionOutcomeCode(input?.Decision)) {
      throw new Error(`RecordBatchDecision: invalid decision '${input?.Decision}'. Expected ${TaskDecisionOutcomeCodes.join(' | ')}.`);
    }
    const personId = await this.resolveCurrentPersonId(user, provider);
    await new TasksAppApprovalGate(provider).recordDecision(
      input.JournalEntryBatchID, input.Decision, personId, input.Notes ?? undefined, user);

    // Ask tasks what the outcome MEANS rather than re-deciding it here from literals.
    if (IsApprovalOutcome(input.Decision)) {
      await approveJournalEntryBatch(input.JournalEntryBatchID, user.ID, user, provider);
    } else {
      await cancelJournalEntryBatch(input.JournalEntryBatchID, user, provider);
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

// ─── Accounting.GetJournalEntryBatchApprovalState ────────────────────────────────────────

export interface GetJournalEntryBatchApprovalStateInput { JournalEntryBatchID: string }
export interface GetJournalEntryBatchApprovalStateOutput { Approved: boolean; Reason?: string }

/** Read-only probe: is this batch approved to dispatch? Drives the UI's Dispatch-button enable state. */
@RegisterClass(BaseRemotableOperation, 'Accounting.GetJournalEntryBatchApprovalState')
export class GetJournalEntryBatchApprovalStateOperation extends BaseRemotableOperation<GetJournalEntryBatchApprovalStateInput, GetJournalEntryBatchApprovalStateOutput> {
  public readonly OperationKey = 'Accounting.GetJournalEntryBatchApprovalState';

  protected async InternalExecute(input: GetJournalEntryBatchApprovalStateInput, provider: IMetadataProvider, user: UserInfo): Promise<GetJournalEntryBatchApprovalStateOutput> {
    if (!input?.JournalEntryBatchID) throw new Error('GetBatchApprovalState: JournalEntryBatchID is required.');
    // assertApproved throws when not approved — turn that into a boolean for the UI.
    try {
      await new TasksAppApprovalGate(provider).assertApproved(input.JournalEntryBatchID, user);
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
export function LoadJournalEntryBatchOperations(): void {
  // intentionally empty
}
