/**
 * BatchDispatchResolver — the thin GraphQL boundary for the Block 2 JE-Batch
 * review/dispatch + CFO-approve UI (Explorer "Batch Dispatch" dashboard).
 *
 * Per the MJ Transport-Layer guide (engine → resolver → client → thin UI), ALL
 * business logic lives in `@mj-biz-apps/accounting-core-entities-server`
 * (`buildBatch` / `sendBatch` / `TasksAppApprovalGate`). This resolver only:
 *   1. extracts the per-request user (`ResolverBase.GetUserFromPayload`),
 *   2. delegates to the engine,
 *   3. maps the engine result to a GraphQL `@ObjectType`.
 *
 * Three mutations + one query:
 *   - BuildJEBatch       → buildBatch(...)            (pending JEs → a Pending batch + approval task)
 *   - DispatchJEBatch    → sendBatch(...)             (gate.assertApproved → mock ERP post → Acknowledged)
 *   - RecordJEBatchDecision → gate.recordDecision(...) (in-app CFO approve / reject)
 *   - JEBatchApprovalState → gate.assertApproved probe (read-only "is this batch approved to send?")
 *
 * The gate is `TasksAppApprovalGate` (the REAL bizapps-tasks-backed CFO gate) for
 * build/dispatch/decision; the ERP poster is the v1 mock (`mockErpPoster`) — a real
 * Business Central connection is a separate follow-up.
 */
// All TypeGraphQL decorators are re-exported through @memberjunction/server (it does
// `export * from 'type-graphql'`), matching the generated resolvers — type-graphql is not
// a direct dependency of this package, so we import the decorators from the server barrel.
import {
  Resolver, Mutation, Query, Arg, Ctx, ObjectType, Field, ID, Int, Float,
  AppContext, ResolverBase,
} from '@memberjunction/server';
import { LogError, RunView, UserInfo } from '@memberjunction/core';
import {
  buildBatch,
  sendBatch,
  mockErpPoster,
  TasksAppApprovalGate,
  type BatchTargetSystem,
} from '@mj-biz-apps/accounting-core-entities-server';

const PERSON_ENTITY = 'MJ_BizApps_Common: People';

/** Decision outcomes the in-app CFO control can record. Mirrors tasks-core's TaskDecisionOutcomeCode. */
type BatchDecisionOutcome = 'Approved' | 'ApprovedWithConditions' | 'Rejected';
const VALID_DECISIONS: ReadonlySet<string> = new Set(['Approved', 'ApprovedWithConditions', 'Rejected']);

@ObjectType()
export class BuildJEBatchResult {
  @Field() Success: boolean;
  /** Null when there was nothing pending to batch (engine returned null). */
  @Field(() => ID, { nullable: true }) BatchID?: string;
  @Field(() => Int) SummaryLineCount: number;
  @Field(() => Float) TotalDebits: number;
  @Field(() => Float) TotalCredits: number;
  @Field(() => Int) JECount: number;
  /** True when the engine found nothing to batch (no pending JEs / all netted to zero). */
  @Field() NothingToBatch: boolean;
  @Field({ nullable: true }) ErrorMessage?: string;
}

@ObjectType()
export class DispatchJEBatchResult {
  @Field() Success: boolean;
  @Field({ nullable: true }) Status?: string;
  @Field({ nullable: true }) ExternalBatchRef?: string;
  @Field({ nullable: true }) ErrorMessage?: string;
}

@ObjectType()
export class RecordJEBatchDecisionResult {
  @Field() Success: boolean;
  @Field({ nullable: true }) ErrorMessage?: string;
}

@ObjectType()
export class JEBatchApprovalState {
  @Field() Success: boolean;
  /** True when the batch's approval Task carries a terminal Approved/ApprovedWithConditions decision. */
  @Field() Approved: boolean;
  /** Human-readable reason when not approved (no task, no decision, etc.). */
  @Field({ nullable: true }) Reason?: string;
}

@Resolver()
export class BatchDispatchResolver extends ResolverBase {
  /** Build a Pending batch from a Company×Period's pending JEs (raises the CFO approval task via the gate). */
  @Mutation(() => BuildJEBatchResult)
  async BuildJEBatch(
    @Arg('companyID', () => ID) companyID: string,
    @Arg('accountingPeriodID', () => ID) accountingPeriodID: string,
    @Arg('targetSystem', () => String) targetSystem: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<BuildJEBatchResult> {
    const empty = { Success: false, SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, NothingToBatch: false };
    try {
      const user = this.GetUserFromPayload(userPayload);
      if (!user) return { ...empty, ErrorMessage: 'No authenticated user.' };

      const result = await buildBatch(
        companyID,
        accountingPeriodID,
        targetSystem as BatchTargetSystem,
        user.ID,
        user,
        new TasksAppApprovalGate(),
      );
      if (!result) return { ...empty, Success: true, NothingToBatch: true };

      return {
        Success: true,
        NothingToBatch: false,
        BatchID: result.batchId,
        SummaryLineCount: result.summaryLineCount,
        TotalDebits: result.totalDebits,
        TotalCredits: result.totalCredits,
        JECount: result.jeCount,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BuildJEBatch failed: ${msg}`);
      return { ...empty, ErrorMessage: msg };
    }
  }

  /** Dispatch a Pending, CFO-approved batch to the ERP (mock poster for v1). Gate blocks if not approved. */
  @Mutation(() => DispatchJEBatchResult)
  async DispatchJEBatch(
    @Arg('batchID', () => ID) batchID: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<DispatchJEBatchResult> {
    try {
      const user = this.GetUserFromPayload(userPayload);
      if (!user) return { Success: false, ErrorMessage: 'No authenticated user.' };

      const batch = await sendBatch(batchID, user, { gate: new TasksAppApprovalGate(), poster: mockErpPoster });
      return { Success: true, Status: batch.Status, ExternalBatchRef: batch.ExternalBatchRef ?? undefined };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`DispatchJEBatch failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }

  /** Record an in-app CFO approve/reject decision against the batch's approval Task (the gate-backed seam). */
  @Mutation(() => RecordJEBatchDecisionResult)
  async RecordJEBatchDecision(
    @Arg('batchID', () => ID) batchID: string,
    @Arg('decision', () => String) decision: string,
    @Arg('notes', () => String, { nullable: true }) notes: string | undefined,
    @Ctx() { userPayload }: AppContext,
  ): Promise<RecordJEBatchDecisionResult> {
    try {
      const user = this.GetUserFromPayload(userPayload);
      if (!user) return { Success: false, ErrorMessage: 'No authenticated user.' };
      if (!VALID_DECISIONS.has(decision)) {
        return { Success: false, ErrorMessage: `Invalid decision '${decision}'. Expected Approved | ApprovedWithConditions | Rejected.` };
      }

      const personId = await this.resolveCurrentPersonId(user);
      await new TasksAppApprovalGate().recordDecision(batchID, decision as BatchDecisionOutcome, personId, notes, user);
      return { Success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`RecordJEBatchDecision failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }

  /** Read-only probe: is this batch approved to dispatch? Drives the UI's enable/disable of the Dispatch button. */
  @Query(() => JEBatchApprovalState)
  async JEBatchApprovalState(
    @Arg('batchID', () => ID) batchID: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<JEBatchApprovalState> {
    try {
      const user = this.GetUserFromPayload(userPayload);
      if (!user) return { Success: false, Approved: false, Reason: 'No authenticated user.' };

      // assertApproved throws when not approved — turn that into a boolean for the UI.
      try {
        await new TasksAppApprovalGate().assertApproved(batchID, user);
        return { Success: true, Approved: true };
      } catch (notApproved) {
        const reason = notApproved instanceof Error ? notApproved.message : String(notApproved);
        return { Success: true, Approved: false, Reason: reason };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`JEBatchApprovalState failed: ${msg}`);
      return { Success: false, Approved: false, Reason: msg };
    }
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  /**
   * Resolve the current MJ user's bizapps-common Person ID (Person.LinkedUserID == user.ID), so the
   * recorded decision is attributed to the right approver Person. Returns undefined when no Person is
   * linked (the gate / TaskOrchestrationService.RecordDecision treats DecidedByPersonID as optional).
   */
  private async resolveCurrentPersonId(user: UserInfo): Promise<string | undefined> {
    const rv = new RunView();
    const res = await rv.RunView<{ ID: string }>(
      { EntityName: PERSON_ENTITY, ExtraFilter: `LinkedUserID='${user.ID}'`, Fields: ['ID'], MaxRows: 1, ResultType: 'simple', BypassCache: true },
      user,
    );
    return res.Success ? res.Results?.[0]?.ID : undefined;
  }
}
