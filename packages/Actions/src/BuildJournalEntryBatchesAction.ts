import { LogError, Metadata, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { BaseAction } from '@memberjunction/actions';
import { RegisterClass } from '@memberjunction/global';
import {
  approveJournalEntryBatch,
  buildJournalEntryBatch,
  createAccountingERPPoster,
  pendingCompanies,
  recordDispatchFailure,
  sendJournalEntryBatch,
  AutoApproveGate,
  EmptyJournalEntryBatchError,
  TasksAppApprovalGate,
  type BuildJournalEntryBatchResult,
  type JournalEntryBatchApprovalGate,
  type JournalEntryBatchTargetSystem,
  type BuildJournalEntryBatchOptions,
} from '@mj-biz-apps/accounting-core-entities-server';

/**
 * Action: Accounting.BuildJournalEntryBatches
 *
 * Builds single-company GL posting batches from pending candidate journal entries.
 * Netted per (Company, GLAccount, Dimensions) and transactionally locked.
 *
 * Two modes:
 *   - DEFAULT (attended, A-US7): build only, behind the bizapps-tasks CFO approval gate. Batches
 *     land `Pending` and wait for a human decision. Nothing about this path changed.
 *   - AutoPost (unattended, A-US5/A-US6): build → approve → dispatch to the ERP per company, behind
 *     `AutoApproveGate` per the scheduled-posting approval waiver. Requires an explicit
 *     `EntryTypeCodes` include-list — see {@link assertAutoPostPolicy}.
 *
 * `CutoffMode` exists because scheduled-job action params are Static or SQL-Statement only, with no
 * relative-date value type, and the driver's SQL path returns a row set and swallows errors as
 * `null` — a null cutoff means NO date clause, which would post today's entries. So the relative
 * cutoff is resolved here, in TypeScript, at run time.
 */
@RegisterClass(BaseAction, 'Accounting.BuildJournalEntryBatches')
export class BuildJournalEntryBatchesAction extends BaseAction {
  protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
    const provider = Metadata.Provider;
    if (!provider) {
      throw new Error('Accounting.BuildJournalEntryBatches: Metadata.Provider is not initialized');
    }
    const user = params.ContextUser;
    const targetSystem = readParam<JournalEntryBatchTargetSystem>(params, 'TargetSystem') ?? 'BusinessCentral';
    const autoPost = isTrue(readParam<boolean | string>(params, 'AutoPost'));
    const options = readBatchOptions(params);
    if (autoPost) assertAutoPostPolicy(options);

    const gate: JournalEntryBatchApprovalGate = autoPost ? AutoApproveGate : new TasksAppApprovalGate(provider);
    const outcomes = await sweep({ user, provider, gate, targetSystem, options, autoPost });

    return summarize(params, outcomes, autoPost);
  }
}

// ─── Inputs ──────────────────────────────────────────────────────────────────────────────

function readParam<T>(params: RunActionParams, name: string): T | undefined {
  const value = params.Params.find(p => p.Name === name)?.Value;
  return (value ?? undefined) as T | undefined;
}

/** A scheduled-job Static param arrives JSON-parsed when it can be, and as a raw string when it
 *  cannot — so an admin who typed `True` gets the same answer as the shipped `true`. */
const isTrue = (value: boolean | string | undefined): boolean =>
  value === true || (typeof value === 'string' && value.toLowerCase() === 'true');

function readBatchOptions(params: RunActionParams): BuildJournalEntryBatchOptions {
  const startDate = readParam<string>(params, 'StartDate');
  const entryTypeCodes = readParam<string[]>(params, 'EntryTypeCodes');
  const excludeEntryTypeCodes = readParam<string[]>(params, 'ExcludeEntryTypeCodes');
  const companyIds = readParam<string[]>(params, 'CompanyIDs');

  return {
    cutoff: resolveCutoff(readParam<string>(params, 'Cutoff'), readParam<string>(params, 'CutoffMode'), new Date()),
    startDate: startDate ? new Date(startDate) : null,
    companyIds: companyIds?.length ? companyIds : null,
    entryTypeCodes: entryTypeCodes?.length ? entryTypeCodes : null,
    excludeEntryTypeCodes: excludeEntryTypeCodes?.length ? excludeEntryTypeCodes : null,
  };
}

/**
 * The cutoff handed to `pendingCandidateFilter`, which turns a midnight-UTC cutoff into
 * `EffectiveDate < cutoff + 1 day` — the cutoff DAY is INCLUDED. So "strictly before the run date"
 * is YESTERDAY, and "strictly before the 1st of this month" is the LAST DAY OF THE PRIOR MONTH.
 * An explicit `Cutoff` always wins, so the manual/on-demand path is unaffected.
 */
export function resolveCutoff(explicitCutoff: string | undefined, mode: string | undefined, now: Date): Date | null {
  if (explicitCutoff) return new Date(explicitCutoff);
  if (!mode) return null;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (mode === 'PriorDay') return new Date(Date.UTC(year, month, now.getUTCDate() - 1));
  if (mode === 'PriorMonth') return new Date(Date.UTC(year, month, 0)); // day 0 = last day of the prior month
  throw new Error(`Accounting.BuildJournalEntryBatches: unknown CutoffMode '${mode}' — expected 'PriorDay' or 'PriorMonth'.`);
}

/**
 * Auto-posting is INCLUDE-LIST ONLY, by policy (Craig, AIDP-1). A blacklist would silently
 * auto-post any JournalEntryType added later; a financial control has to default the other way, so
 * a new entry type requires approval until an admin names it here.
 */
function assertAutoPostPolicy(options: BuildJournalEntryBatchOptions): void {
  if (!options.entryTypeCodes?.length) {
    throw new Error('Accounting.BuildJournalEntryBatches: AutoPost requires an explicit EntryTypeCodes include-list — auto-posting is include-list only, so an entry type never posts unattended unless it is named.');
  }
  if (options.excludeEntryTypeCodes?.length) {
    throw new Error('Accounting.BuildJournalEntryBatches: AutoPost does not accept ExcludeEntryTypeCodes — the auto-post policy is an include-list, not a blacklist. Name the types that may post in EntryTypeCodes.');
  }
}

// ─── The sweep ───────────────────────────────────────────────────────────────────────────

/** One company's result. `status` is the batch's real end state, or BUILD_FAILED if none exists. */
interface CompanyOutcome {
  companyId: string;
  batch: BuildJournalEntryBatchResult | null;
  status: string;
  error: string | null;
  /**
   * Whether a human has to look at this. NOT derivable from `status`: a batch that reached `Posted`
   * and then threw on the member `Batched → GLPosted` flip reads as Posted but has journal entries
   * stranded in `Batched`, and a run that reported itself clean would bury them.
   */
  needsAttention: boolean;
}

const BUILD_FAILED = 'BuildFailed';

interface SweepContext {
  user: UserInfo;
  provider: IMetadataProvider;
  gate: JournalEntryBatchApprovalGate;
  targetSystem: JournalEntryBatchTargetSystem;
  options: BuildJournalEntryBatchOptions;
  autoPost: boolean;
}

/**
 * One batch per company (D7), each company independent under AutoPost.
 *
 * A build failure aborts the ATTENDED run, as it always has — those batches carry approval Tasks, so
 * they are visible and a human can act on them. It must NOT abort an UNATTENDED run: `AutoApproveGate`
 * raises no Task, so every batch already built in this sweep would be stranded `Pending` with no Task,
 * where nothing can approve it, dispatch it (the manual op needs a Task), or re-sweep it (its entries
 * are `Batched`, so the next night skips them). Dispatching each company as it is built keeps that
 * window to the single company that failed.
 */
async function sweep(ctx: SweepContext): Promise<CompanyOutcome[]> {
  const companies = await pendingCompanies(ctx.user, ctx.provider, ctx.options);
  const outcomes: CompanyOutcome[] = [];

  for (const companyId of companies) {
    try {
      const batch = await buildJournalEntryBatch(
        companyId, ctx.targetSystem, ctx.user.ID, ctx.user, ctx.provider, ctx.gate, ctx.options,
      );
      // dispatchOne resolves its own failures into an outcome, so nothing below throws from here.
      outcomes.push(ctx.autoPost
        ? await dispatchOne(companyId, batch, ctx.user, ctx.provider)
        : { companyId, batch, status: 'Pending', error: null, needsAttention: false });
    } catch (e) {
      if (e instanceof EmptyJournalEntryBatchError) continue; // this company's candidates netted to zero
      if (!ctx.autoPost) throw e;
      const message = e instanceof Error ? e.message : String(e);
      LogError(`Accounting.BuildJournalEntryBatches: build for company ${companyId} failed: ${message}`);
      outcomes.push({ companyId, batch: null, status: BUILD_FAILED, error: message, needsAttention: true });
    }
  }
  return outcomes;
}

// ─── Dispatch (AutoPost only) ────────────────────────────────────────────────────────────

/**
 * Build → Approved → Sent → Posted for one batch. `ApprovedByUserID` is stamped with the context
 * user, which in a scheduled run IS the MJ System user the scheduler resolves — the waiver removes
 * the approval STEP, not the audit trail, so this is never null (Craig, AIDP-1).
 */
async function dispatchOne(
  companyId: string, batch: BuildJournalEntryBatchResult, user: UserInfo, provider: IMetadataProvider,
): Promise<CompanyOutcome> {
  try {
    await approveJournalEntryBatch(batch.batchId, user.ID, user, provider);
    const sent = await sendJournalEntryBatch(batch.batchId, user, {
      gate: AutoApproveGate,
      poster: createAccountingERPPoster(provider),
      provider,
    });
    return { companyId, batch, status: sent.Status, error: sent.ErrorMessage ?? null, needsAttention: sent.Status !== 'Posted' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    LogError(`Accounting.BuildJournalEntryBatches: dispatch of batch ${batch.batchId} failed: ${message}`);
    // Every route through triage began with a throw, so every one of them needs a human — including
    // the `Posted` one, where the ERP has the journal but the member JE flip did not finish.
    return { companyId, batch, needsAttention: true, ...(await triage(batch.batchId, message, user, provider)) };
  }
}

/**
 * Report the batch's REAL state after a dispatch throw, never the one we hoped for. `Failed` is
 * reachable only from `Sent`, so a throw that landed the batch elsewhere must be described, not
 * overwritten — see `recordDispatchFailure`.
 */
async function triage(
  batchId: string, message: string, user: UserInfo, provider: IMetadataProvider,
): Promise<{ status: string; error: string }> {
  try {
    const { status, marked } = await recordDispatchFailure(batchId, message, user, provider);
    if (marked) return { status, error: message };
    if (status === 'Posted') {
      // The ERP took this journal. Only the member Batched→GLPosted flip is incomplete, and the
      // repair is to finish that flip — NOT to post again.
      const warning = `ALREADY POSTED TO THE ERP — DO NOT RE-POST. The batch reached the ERP and only the member Batched→GLPosted flip is incomplete: ${message}`;
      LogError(`Accounting.BuildJournalEntryBatches: batch ${batchId} ${warning}`);
      return { status, error: warning };
    }
    return { status, error: `Batch left ${status} and NOT marked Failed (only a Sent batch may be): ${message}` };
  } catch (e) {
    const failure = e instanceof Error ? e.message : String(e);
    LogError(`Accounting.BuildJournalEntryBatches: could not record the dispatch failure for batch ${batchId}: ${failure}`);
    return { status: 'Unknown', error: `${message} (and recording that failure also failed: ${failure})` };
  }
}

// ─── Result ──────────────────────────────────────────────────────────────────────────────

function summarize(params: RunActionParams, outcomes: CompanyOutcome[], autoPost: boolean): ActionResultSimple {
  const built = outcomes.filter(o => o.batch !== null);
  const batchesParam = params.Params.find(p => p.Name === 'Batches');
  if (batchesParam) batchesParam.Value = JSON.stringify(outcomes);
  const countParam = params.Params.find(p => p.Name === 'BatchCount');
  if (countParam) countParam.Value = built.length;

  // Nothing to do is a clean run. Nothing BUILT is not, if a company failed trying.
  if (outcomes.length === 0) {
    return { Success: true, Message: 'No candidate journal entries found to batch.', ResultCode: 'NO_BATCHES' };
  }

  const totals = `Dr ${sum(built, b => b.totalDebits).toFixed(2)}, Cr ${sum(built, b => b.totalCredits).toFixed(2)}`;
  const summary = `Built ${built.length} batch(es) containing ${sum(built, b => b.jeCount)} journal entries (${totals}).`;
  if (!autoPost) return { Success: true, Message: `${summary} Awaiting approval.`, ResultCode: 'SUCCESS' };

  const problems = outcomes.filter(o => o.needsAttention);
  if (problems.length === 0) {
    return { Success: true, Message: `${summary} All dispatched to the ERP.`, ResultCode: 'SUCCESS' };
  }
  const detail = problems
    .map(o => `${o.batch?.batchId ?? `company ${o.companyId}`} (${o.status}: ${o.error ?? 'no detail'})`)
    .join('; ');
  return {
    Success: false,
    Message: `${summary} ${problems.length} of ${outcomes.length} company(ies) did not post: ${detail}`,
    ResultCode: 'POST_INCOMPLETE',
  };
}

const sum = (outcomes: CompanyOutcome[], pick: (b: BuildJournalEntryBatchResult) => number): number =>
  outcomes.reduce((total, o) => total + (o.batch ? pick(o.batch) : 0), 0);
