import { LogError, Metadata, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { BaseAction } from '@memberjunction/actions';
import { RegisterClass } from '@memberjunction/global';
import {
  approveJournalEntryBatch,
  buildJournalEntryBatch,
  createAccountingERPPoster,
  failJournalEntryBatch,
  pendingCompanies,
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
 *   - AutoPost (unattended, A-US5/A-US6): build → approve → dispatch to the ERP in one run, behind
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
    const built = await buildAll(user, provider, gate, targetSystem, options);
    const dispatched = autoPost ? await dispatchAll(built, user, provider) : new Map<string, DispatchOutcome>();

    return summarize(params, built, dispatched, autoPost);
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

// ─── Build ───────────────────────────────────────────────────────────────────────────────

async function buildAll(
  user: UserInfo,
  provider: IMetadataProvider,
  gate: JournalEntryBatchApprovalGate,
  targetSystem: JournalEntryBatchTargetSystem,
  options: BuildJournalEntryBatchOptions,
): Promise<BuildJournalEntryBatchResult[]> {
  const companies = await pendingCompanies(user, provider, options);
  const built: BuildJournalEntryBatchResult[] = [];
  for (const companyId of companies) {
    try {
      built.push(await buildJournalEntryBatch(companyId, targetSystem, user.ID, user, provider, gate, options));
    } catch (e) {
      if (e instanceof EmptyJournalEntryBatchError) continue; // a company whose candidates all netted to zero
      throw e;
    }
  }
  return built;
}

// ─── Dispatch (AutoPost only) ────────────────────────────────────────────────────────────

interface DispatchOutcome { status: string; error: string | null }

/** One batch per company, each independent: a failure marks that batch and the sweep carries on. */
async function dispatchAll(
  built: BuildJournalEntryBatchResult[], user: UserInfo, provider: IMetadataProvider,
): Promise<Map<string, DispatchOutcome>> {
  const outcomes = new Map<string, DispatchOutcome>();
  for (const batch of built) {
    outcomes.set(batch.batchId, await dispatchOne(batch.batchId, user, provider));
  }
  return outcomes;
}

/**
 * Build → Approved → Sent → Posted for one batch. `ApprovedByUserID` is stamped with the context
 * user, which in a scheduled run IS the MJ System user the scheduler resolves — the waiver removes
 * the approval STEP, not the audit trail, so this is never null (Craig, AIDP-1).
 */
async function dispatchOne(batchId: string, user: UserInfo, provider: IMetadataProvider): Promise<DispatchOutcome> {
  try {
    await approveJournalEntryBatch(batchId, user.ID, user, provider);
    const batch = await sendJournalEntryBatch(batchId, user, {
      gate: AutoApproveGate,
      poster: createAccountingERPPoster(provider),
      provider,
    });
    return { status: batch.Status, error: batch.ErrorMessage ?? null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    LogError(`Accounting.BuildJournalEntryBatches: dispatch of batch ${batchId} failed: ${message}`);
    await markFailed(batchId, message, user, provider);
    return { status: 'Failed', error: message };
  }
}

/** Best-effort, and loud when it cannot: the run must continue to the next company either way. */
async function markFailed(batchId: string, error: string, user: UserInfo, provider: IMetadataProvider): Promise<void> {
  try {
    await failJournalEntryBatch(batchId, error, user, provider);
  } catch (e) {
    LogError(`Accounting.BuildJournalEntryBatches: could not mark batch ${batchId} Failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── Result ──────────────────────────────────────────────────────────────────────────────

function summarize(
  params: RunActionParams,
  built: BuildJournalEntryBatchResult[],
  dispatched: Map<string, DispatchOutcome>,
  autoPost: boolean,
): ActionResultSimple {
  const batchesParam = params.Params.find(p => p.Name === 'Batches');
  if (batchesParam) {
    batchesParam.Value = JSON.stringify(built.map(b => ({ ...b, dispatch: dispatched.get(b.batchId) ?? null })));
  }
  const countParam = params.Params.find(p => p.Name === 'BatchCount');
  if (countParam) countParam.Value = built.length;

  if (built.length === 0) {
    return { Success: true, Message: 'No candidate journal entries found to batch.', ResultCode: 'NO_BATCHES' };
  }

  const totals = `Dr ${sum(built, b => b.totalDebits).toFixed(2)}, Cr ${sum(built, b => b.totalCredits).toFixed(2)}`;
  const summary = `Built ${built.length} batch(es) containing ${sum(built, b => b.jeCount)} journal entries (${totals}).`;
  if (!autoPost) return { Success: true, Message: `${summary} Awaiting approval.`, ResultCode: 'SUCCESS' };

  const failures = [...dispatched.entries()].filter(([, o]) => o.status !== 'Posted');
  if (failures.length === 0) {
    return { Success: true, Message: `${summary} All dispatched to the ERP.`, ResultCode: 'SUCCESS' };
  }
  const detail = failures.map(([batchId, o]) => `${batchId} (${o.status}: ${o.error ?? 'no detail'})`).join('; ');
  return {
    Success: false,
    Message: `${summary} ${failures.length} of ${built.length} batch(es) failed to dispatch: ${detail}`,
    ResultCode: 'DISPATCH_FAILED',
  };
}

const sum = (batches: BuildJournalEntryBatchResult[], pick: (b: BuildJournalEntryBatchResult) => number): number =>
  batches.reduce((total, b) => total + pick(b), 0);
