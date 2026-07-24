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
 * Three mutations + one query (single-company batches, plan D7):
 *   - BuildJEBatch       → buildBatch(companyId, ...) per company with pending JEs (one Pending
 *                          single-company batch + approval task each; one run sweeps all companies)
 *   - DispatchJEBatch    → sendBatch(...)             (requires Status=Approved + gate → mock ERP post → Posted)
 *   - RecordJEBatchDecision → gate.recordDecision(...) (in-app CFO approve / reject; an approval also flips
 *                              the batch Pending→Approved via approveBatch so it becomes dispatchable)
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
  approveBatch,
  sendBatch,
  cancelBatch,
  regenerateBatch,
  mockErpPoster,
  TasksAppApprovalGate,
  type BatchTargetSystem,
} from '@mj-biz-apps/accounting-core-entities-server';

const PERSON_ENTITY = 'MJ_BizApps_Common: People';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/** Decision outcomes the in-app CFO control can record. Mirrors tasks-core's TaskDecisionOutcomeCode. */
type BatchDecisionOutcome = 'Approved' | 'ApprovedWithConditions' | 'Rejected';
const VALID_DECISIONS: ReadonlySet<string> = new Set(['Approved', 'ApprovedWithConditions', 'Rejected']);

@ObjectType()
export class BuildJEBatchResult {
  @Field() Success: boolean;
  /** The built batch (regenerate / single-company builds). Null when nothing was batched or several batches were built. */
  @Field(() => ID, { nullable: true }) BatchID?: string;
  /** Every batch built this run — one per company with pending JEs (batches are single-company, D7). */
  @Field(() => [ID]) BatchIDs: string[];
  @Field(() => Int) SummaryLineCount: number;
  @Field(() => Float) TotalDebits: number;
  @Field(() => Float) TotalCredits: number;
  @Field(() => Int) JECount: number;
  /** Number of companies a batch was built for this run (batches are single-company, D7). */
  @Field(() => Int) CompanyCount: number;
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
  /** Build one Pending SINGLE-COMPANY batch per company with pending JEs (raises each CFO approval task via the gate). */
  @Mutation(() => BuildJEBatchResult)
  async BuildJEBatch(
    @Arg('targetSystem', () => String) targetSystem: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<BuildJEBatchResult> {
    const empty = { Success: false, BatchIDs: [], SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, CompanyCount: 0, NothingToBatch: false };
    try {
      const user = this.GetUserFromPayload(userPayload);
      if (!user) return { ...empty, ErrorMessage: 'No authenticated user.' };

      const companyIds = await this.companiesWithPendingJEs(user);
      const results = [];
      for (const companyId of companyIds) {
        const result = await buildBatch(
          companyId,
          targetSystem as BatchTargetSystem,
          user.ID,
          user,
          new TasksAppApprovalGate(),
        );
        if (result) results.push(result);
      }
      if (results.length === 0) return { ...empty, Success: true, NothingToBatch: true };

      return {
        Success: true,
        NothingToBatch: false,
        BatchID: results.length === 1 ? results[0].batchId : undefined,
        BatchIDs: results.map(r => r.batchId),
        SummaryLineCount: results.reduce((s, r) => s + r.summaryLineCount, 0),
        TotalDebits: results.reduce((s, r) => s + r.totalDebits, 0),
        TotalCredits: results.reduce((s, r) => s + r.totalCredits, 0),
        JECount: results.reduce((s, r) => s + r.jeCount, 0),
        CompanyCount: results.length,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`BuildJEBatch failed: ${msg}`);
      return { ...empty, ErrorMessage: msg };
    }
  }

  /** Distinct companies that currently have unbatched Pending JEs (BatchSummary JEs excluded by EntryType). */
  private async companiesWithPendingJEs(user: UserInfo): Promise<string[]> {
    const rv = new RunView();
    const res = await rv.RunView<{ CompanyID: string }>(
      { EntityName: JE_ENTITY, ExtraFilter: `Status='Pending' AND EntryType<>'BatchSummary'`, Fields: ['CompanyID'], ResultType: 'simple', BypassCache: true },
      user,
    );
    return [...new Set((res.Results ?? []).map(r => r.CompanyID))];
  }

  /** Dispatch an Approved batch to the ERP (mock poster for v1). Gate + Status=Approved block otherwise. */
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
      // An approval decision also flips the batch Pending→Approved (content freeze + dispatchable state).
      if (decision === 'Approved' || decision === 'ApprovedWithConditions') {
        await approveBatch(batchID, user.ID, user);
      }
      // A rejection REVERSES the (still-preliminary) lock: the batch is Cancelled and its journal entries
      // return to the candidate pool (task #12 — reject now has a visible financial effect, not a dead no-op).
      if (decision === 'Rejected') {
        await cancelBatch(batchID, user);
      }
      return { Success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`RecordJEBatchDecision failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }

  /**
   * Regenerate an OPEN (Pending) batch in place: unlock its current JEs, re-gather ALL current candidates
   * (everything unbatched Pending, incl. any added since), and rebuild the netted summary on the same batch.
   * Only a Pending batch can be regenerated (approval makes the lock permanent).
   */
  @Mutation(() => BuildJEBatchResult)
  async RegenerateJEBatch(
    @Arg('batchID', () => ID) batchID: string,
    @Arg('targetSystem', () => String) targetSystem: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<BuildJEBatchResult> {
    const empty = { Success: false, BatchIDs: [], SummaryLineCount: 0, TotalDebits: 0, TotalCredits: 0, JECount: 0, CompanyCount: 0, NothingToBatch: false };
    try {
      const user = this.GetUserFromPayload(userPayload);
      if (!user) return { ...empty, ErrorMessage: 'No authenticated user.' };

      const result = await regenerateBatch(batchID, targetSystem as BatchTargetSystem, user);
      return {
        Success: true,
        NothingToBatch: result.jeCount === 0,
        BatchID: result.batchId,
        BatchIDs: [result.batchId],
        SummaryLineCount: result.summaryLineCount,
        TotalDebits: result.totalDebits,
        TotalCredits: result.totalCredits,
        JECount: result.jeCount,
        CompanyCount: 1,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`RegenerateJEBatch failed: ${msg}`);
      return { ...empty, ErrorMessage: msg };
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
