/**
 * BatchDispatchOperations — the batch review / approve / reject / regenerate / dispatch surface, as
 * code-only Remote Operations.
 *
 * This CONSOLIDATES what used to be a hand-written GraphQL resolver + client pair (BatchDispatchResolver
 * in @mj-biz-apps/accounting-server + BatchDispatchClient in the Angular package) onto MJ's Remote
 * Operations stack — the SAME primitive as Accounting.BuildBatch / Accounting.PreviewBatch. The point
 * (Marcelo 2026-07-21): "everything with creating, approving, regenerating, and canceling a batch must be
 * engine + transaction based … that is our stack for all custom processes where we want to enforce
 * constraints." So every batch mutation now travels ONE stack, with one call site working both
 * in-process (server) and over GraphQL (the dashboards) via `provider.RouteOperation`.
 *
 *   Accounting.RegenerateBatch       → regenerateBatch(...)   rebuild a Pending batch in place; empty→cancel+throw
 *   Accounting.DispatchBatch         → sendBatch(...)         Approved→Sent→Posted via the mock ERP poster (v1)
 *   Accounting.RecordBatchDecision   → gate.recordDecision + approveBatch | cancelBatch (in-app CFO approve/reject)
 *   Accounting.GetBatchApprovalState → gate.assertApproved probe (read-only: is this batch dispatchable?)
 *
 * BuildBatch already lives on this stack (BuildBatchOperation.ts); the dashboard's "build all pending" is
 * Accounting.BuildBatch with Source='Standard'. Every write threads the REQUEST's provider so the engine's
 * TransactionGroups land on the caller's transaction-capable provider (not the process-global default).
 *
 * CONNECTS TO:
 *   ENGINE: ./BatchingEngine (regenerateBatch · sendBatch · approveBatch · cancelBatch)
 *   GATE:   ./TasksAppApprovalGate (the real bizapps-tasks-backed CFO gate)
 */
import { BaseRemotableOperation, IMetadataProvider, RunView, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  regenerateBatch,
  approveBatch,
  cancelBatch,
  sendBatch,
  mockErpPoster,
  type BatchTargetSystem,
  type BuildBatchResult,
} from './BatchingEngine.js';
import { TasksAppApprovalGate } from './TasksAppApprovalGate.js';

const PERSON_ENTITY = 'MJ_BizApps_Common: People';

/** The in-app CFO decision outcomes. Mirrors tasks-core's TaskDecisionOutcomeCode. */
export type BatchDecisionOutcome = 'Approved' | 'ApprovedWithConditions' | 'Rejected';
const VALID_DECISIONS: ReadonlySet<string> = new Set(['Approved', 'ApprovedWithConditions', 'Rejected']);

export interface RegenerateBatchInput { BatchID: string; TargetSystem: BatchTargetSystem }
export interface DispatchBatchInput { BatchID: string }
export interface DispatchBatchOutput { Status: string; ExternalBatchRef: string | null }
export interface RecordBatchDecisionInput { BatchID: string; Decision: BatchDecisionOutcome; Notes?: string | null }
export interface RecordBatchDecisionOutput { Recorded: true }
export interface GetBatchApprovalStateInput { BatchID: string }
export interface GetBatchApprovalStateOutput { Approved: boolean; Reason?: string }

/**
 * Resolve the current MJ user's bizapps-common Person ID (Person.LinkedUserID == user.ID) so a recorded
 * decision is attributed to the right approver Person. Undefined when no Person is linked (the gate treats
 * DecidedByPersonID as optional).
 */
async function resolveCurrentPersonId(user: UserInfo): Promise<string | undefined> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string }>(
    { EntityName: PERSON_ENTITY, ExtraFilter: `LinkedUserID='${user.ID}'`, Fields: ['ID'], MaxRows: 1, ResultType: 'simple', BypassCache: true },
    user,
  );
  return res.Success ? res.Results?.[0]?.ID : undefined;
}

/**
 * Regenerate a Pending batch in place: unlock its current JEs, re-gather ALL current candidates, and
 * rebuild the netted summary on the same batch. A re-gather to NOTHING cancels the batch and throws
 * EmptyBatchError (surfaced as `{ Success:false, ErrorMessage }`) — never a silent empty batch.
 */
@RegisterClass(BaseRemotableOperation, 'Accounting.RegenerateBatch')
export class RegenerateBatchOperation extends BaseRemotableOperation<RegenerateBatchInput, BuildBatchResult> {
  public readonly OperationKey = 'Accounting.RegenerateBatch';

  protected async InternalExecute(input: RegenerateBatchInput, provider: IMetadataProvider, user: UserInfo): Promise<BuildBatchResult> {
    if (!input?.BatchID) throw new Error('RegenerateBatch: BatchID is required.');
    return regenerateBatch(input.BatchID, input.TargetSystem, user, {}, new TasksAppApprovalGate(), provider);
  }
}

/** Dispatch an Approved batch to the ERP (mock poster, v1). The gate + Status='Approved' block otherwise. */
@RegisterClass(BaseRemotableOperation, 'Accounting.DispatchBatch')
export class DispatchBatchOperation extends BaseRemotableOperation<DispatchBatchInput, DispatchBatchOutput> {
  public readonly OperationKey = 'Accounting.DispatchBatch';

  protected async InternalExecute(input: DispatchBatchInput, _provider: IMetadataProvider, user: UserInfo): Promise<DispatchBatchOutput> {
    if (!input?.BatchID) throw new Error('DispatchBatch: BatchID is required.');
    const batch = await sendBatch(input.BatchID, user, { gate: new TasksAppApprovalGate(), poster: mockErpPoster });
    return { Status: batch.Status, ExternalBatchRef: batch.ExternalBatchRef ?? null };
  }
}

/**
 * Record an in-app CFO approve/reject decision against the batch's approval Task. An approval also flips
 * the batch Pending→Approved (content freeze + dispatchable); a rejection cancels the batch (atomic) and
 * returns its journal entries to the candidate pool.
 */
@RegisterClass(BaseRemotableOperation, 'Accounting.RecordBatchDecision')
export class RecordBatchDecisionOperation extends BaseRemotableOperation<RecordBatchDecisionInput, RecordBatchDecisionOutput> {
  public readonly OperationKey = 'Accounting.RecordBatchDecision';

  protected async InternalExecute(input: RecordBatchDecisionInput, provider: IMetadataProvider, user: UserInfo): Promise<RecordBatchDecisionOutput> {
    if (!input?.BatchID) throw new Error('RecordBatchDecision: BatchID is required.');
    if (!VALID_DECISIONS.has(input.Decision)) {
      throw new Error(`RecordBatchDecision: invalid decision '${input.Decision}'. Expected Approved | ApprovedWithConditions | Rejected.`);
    }
    const personId = await resolveCurrentPersonId(user);
    await new TasksAppApprovalGate().recordDecision(input.BatchID, input.Decision, personId as string, input.Notes ?? undefined, user);

    if (input.Decision === 'Approved' || input.Decision === 'ApprovedWithConditions') {
      await approveBatch(input.BatchID, user.ID, user, provider);
    } else {
      // Rejected: reverse the (still-preliminary) lock — the batch is Cancelled (atomic) and its JEs
      // return to the candidate pool. A reject has a visible financial effect, not a dead no-op (task #12).
      await cancelBatch(input.BatchID, user, provider);
    }
    return { Recorded: true };
  }
}

/** Read-only probe: is this batch approved to dispatch? Drives the dashboard's Dispatch-button enable state. */
@RegisterClass(BaseRemotableOperation, 'Accounting.GetBatchApprovalState')
export class GetBatchApprovalStateOperation extends BaseRemotableOperation<GetBatchApprovalStateInput, GetBatchApprovalStateOutput> {
  public readonly OperationKey = 'Accounting.GetBatchApprovalState';

  protected async InternalExecute(input: GetBatchApprovalStateInput, _provider: IMetadataProvider, user: UserInfo): Promise<GetBatchApprovalStateOutput> {
    if (!input?.BatchID) throw new Error('GetBatchApprovalState: BatchID is required.');
    // assertApproved throws when not approved — turn that into a boolean for the UI.
    try {
      await new TasksAppApprovalGate().assertApproved(input.BatchID, user);
      return { Approved: true };
    } catch (notApproved) {
      return { Approved: false, Reason: notApproved instanceof Error ? notApproved.message : String(notApproved) };
    }
  }
}

/** Tree-shaking anchor — called from the app's server bootstrap so the `@RegisterClass` decorators run. */
export function LoadBatchDispatchOperations(): void {
  // intentionally empty
}
