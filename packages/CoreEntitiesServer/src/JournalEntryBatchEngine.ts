/**
 * JournalEntryBatchEngine — the core subledger→ERP dispatch process (plan §7).
 * REWORKED 2026-07-23 for the rewritten baseline: batches are SINGLE-COMPANY (D7)
 * and the netted summary is an ORDINARY JournalEntry (typed with the IsJournalEntryBatchSummary-flagged
 * JournalEntryType — issue #24) instead of the retired JournalEntryBatchLineItem tables
 * (Amith's summary-JE model).
 *
 *   buildJournalEntryBatch(companyId, …): gather that company's Pending JEs → ONE JournalEntryBatch
 *     (one batch per company per run, D7), net their lines to consolidated summary groups
 *     (one per GLAccount × Dimension-combo, Dr/Cr netted to one side), write the summary
 *     as a JournalEntryBatchSummary JournalEntry (header + JournalEntryLines + dimension tags) that
 *     carries the batch's JournalEntryBatchID so it rides the SAME derived lock machinery as the
 *     members, set the balanced control totals + SummaryJournalEntryID (trigger 50023
 *     verifies coherence), **lock** the member JEs to Batched, and raise the approval task.
 *   approveJournalEntryBatch(): the human sign-off — Pending→Approved (+ApprovedAt/ApprovedByUserID).
 *     Content is frozen from here (trg_JournalEntryBatch_Immutability, 50009), Failed included,
 *     and the approval writes ApprovedContentHash, the seal dispatch compares against (#183).
 *   sendJournalEntryBatch(): require approval (gate seam + Status='Approved', or 'Failed' for a
 *     retry), look the batch number up in the ERP, flip →Sent, post the summary JE's lines to the ERP
 *     (all-or-nothing per batch), and on confirmation flip Sent→Posted + the member JEs AND the
 *     summary JE Batched→GLPosted. Failure → Failed; an operator retries by sending again (#145). A
 *     retry the ERP already holds is recorded Posted with no second post; the operator confirms the
 *     batch did not post only when the lookup cannot settle it (#182).
 *   cancelJournalEntryBatch(): Pending | Approved | Failed → Cancelled, releasing the member JEs to
 *     the candidate pool (#183: a reason from Approved/Failed). From Failed the ERP is looked up first
 *     (#207): a posting it holds refuses the cancel, and the operator confirms only when it cannot say.
 *   resumeJournalEntryBatchPosting(): finish a Posted batch's Batched→GLPosted flip, no ERP call.
 *   findStrandedJournalEntries(): the entries Failed / partly-flipped Posted batches hold.
 *
 * The detail (member JournalEntryLines) stays in the subledger for drill-through; the
 * netted summary JE is what the ERP sees, dated the batch's PostingDate.
 *
 * PROVIDER: these are module functions with no provider of their own, so the correct
 * IMetadataProvider is INJECTED — required on every public entry point, no global
 * fallback (the system uses the right provider through correct retrieval or injection
 * only). Resolvers pass the per-request provider (GetReadWriteProvider); entities
 * created through it carry it for their own saves.
 *
 * SECURITY MODEL:
 *   - **Financial invariants are DB triggers — un-bypassable even by raw SQL / SA:** JEs must
 *     balance to lock (50001), lines must match the header company (50019), an Approved/Sent/
 *     Posted batch is immutable (50008/50009), and the summary pointer must cohere (50023).
 *   - **The CFO approval is a WORKFLOW gate, not a financial invariant** — enforced in the
 *     engine via a pluggable JournalEntryBatchApprovalGate (default backed by the bizapps-tasks app).
 *
 * THE §7.2 BATCH-REWORK SLICE LANDED 2026-07-29 (S-D of the donor port): criteria-driven
 * candidate filtering (cutoff/startDate/companies/type-codes — pendingCandidateFilter),
 * explicit-ID builds (buildJournalEntryBatchFromExplicitIds — re-verifies Pending, one batch per company),
 * view-defined batches (buildJournalEntryBatchFromView — snapshot + classify + loud rejects), and the
 * read-only previewBatch that runs the SAME filter/order/netting as the build. The
 * one-transaction-per-batch guarantee (D10 rev. 2026-07-29) is here too: build + summary +
 * locks + approval task + ApprovalTaskID stamp commit all-or-none in one provider transaction.
 * Still not here: PostingDate selection UI (defaults to today, UTC — a UI-port item).
 *
 * CONNECTS TO:
 *   READS/WRITES: Journal Entries (members + the JournalEntryBatchSummary JE) · Journal Entry Lines
 *                 (+ Dimensions) · Journal Entry Batches · GL Accounts
 *   DB TRIGGERS:  trg_JournalEntryBatch_SummaryCoherence (50023) · trg_JournalEntryBatch_Immutability (50008/50009)
 *                 · trg_JournalEntry_Immutability (lock) · balanced-on-lock (50001)
 *   ENTITY:       'MJ_BizApps_Accounting: Journal Entry Batches'
 *   DOC:          plans/bizapps-accounting-master.md §7 (lifecycle + batching)
 */
import { DatabaseProviderBase, IMetadataProvider, IRunViewProvider, LogError, LogStatus, UserInfo } from '@memberjunction/core';
import type {
  mjBizAppsAccountingJournalEntryBatchEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';
import {
  NetLines,
  type DimRef,
  type NetGroup,
  type NettableLine,
} from '@mj-biz-apps/accounting-engine-base';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';
import { JournalEntryEntityServer } from './JournalEntryEntityServer.js';
import { JournalEntryBatchEntityServer, type ERPNotPostedBasis, type JournalEntryBatchCancelOptions } from './JournalEntryBatchEntityServer.js';
import { GetJournalEntryBatchSummaryEntryType } from './JournalEntryTypes.js';
import { sqlGuidLiteral } from './SqlGuards.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';
const DIM_ENTITY = 'MJ_BizApps_Accounting: Dimensions';
const DIMVAL_ENTITY = 'MJ_BizApps_Accounting: Dimension Values';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const JET_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Types';

/** The ERP targets the schema's CK_JournalEntryBatch_TargetSystem accepts. */
export type JournalEntryBatchTargetSystem = 'BusinessCentral' | 'NetSuite' | 'Other' | 'QuickBooks' | 'Sage' | 'Xero';

/** The injected provider viewed through both interfaces one engine call needs. */
interface Providers { md: IMetadataProvider; rv: IRunViewProvider }

function resolveProviders(provider: IMetadataProvider): Providers {
  if (!provider) throw new Error('JournalEntryBatchEngine: an IMetadataProvider must be injected — there is no global fallback');
  return { md: provider, rv: provider as unknown as IRunViewProvider };
}

export type { DimRef, NettableLine, NetGroup };

/**
 * @deprecated Import {@link NetLines} from `@mj-biz-apps/accounting-engine-base`.
 * Kept so existing server callers (`previewBatch`, harnesses) keep compiling.
 */
export function netLines(lines: NettableLine[]): NetGroup[] {
  return NetLines(lines);
}

export interface BuildJournalEntryBatchResult {
  batchId: string;
  summaryJournalEntryId: string;
  summaryLineCount: number;
  totalDebits: number;
  totalCredits: number;
  jeCount: number;
  /** The approval Task raised + stamped in the build transaction; null when the gate raises none. */
  approvalTaskId: string | null;
}

export interface ErpPostResult { success: boolean; externalJournalEntryBatchRef?: string; error?: string }

/** ERP-post seam. The REAL poster posts the summary JE's lines by account NUMBER
 *  (resolve via resolveExternalAccount at dispatch time), all-or-nothing per batch.
 *  This mock lets the whole dispatch flow run + be tested without a live ERP tenant. */
export type ErpPoster = (
  batch: mjBizAppsAccountingJournalEntryBatchEntity,
  summaryLines: mjBizAppsAccountingJournalEntryLineEntity[],
  contextUser: UserInfo,
) => Promise<ErpPostResult>;

export const mockErpPoster: ErpPoster = async (batch) => ({
  success: true,
  externalJournalEntryBatchRef: `MOCK-${batch.JournalEntryBatchNumber}`,
});

/**
 * What the ERP holds under the batch's number, read before every send so a journal the ERP already
 * holds is never posted twice (#182).
 *   · `NotFound`    — nothing has posted under the number: send.
 *   · `Found`       — a posting that matches the batch on date, account and amount, line for line:
 *                     it IS this batch, so record it Posted instead of sending it again.
 *   · `Mismatch`    — something posted under the number that is not this batch as it stands.
 *   · `Error`       — the lookup ran and could not answer.
 *   · `Unavailable` — the target ERP offers no lookup.
 */
export type ErpJournalLookupResult =
  | { status: 'NotFound' }
  | { status: 'Found'; externalJournalEntryBatchRef: string }
  | { status: 'Mismatch'; detail: string }
  | { status: 'Error'; error: string }
  | { status: 'Unavailable' };

/** ERP-lookup seam, the pre-flight partner of {@link ErpPoster}. */
export type ErpJournalLookup = (
  batch: mjBizAppsAccountingJournalEntryBatchEntity,
  summaryLines: mjBizAppsAccountingJournalEntryLineEntity[],
  contextUser: UserInfo,
) => Promise<ErpJournalLookupResult>;

/** The lookup when none is supplied: the check cannot be made, which is what the mock poster's ERP offers. */
export const unavailableErpLookup: ErpJournalLookup = async () => ({ status: 'Unavailable' });

/** CFO-approval workflow gate. `assertApproved` throws when the batch hasn't been approved to send. */
export interface JournalEntryBatchApprovalGate {
  /**
   * PRECONDITION, run BEFORE any write: throw if the company could never get an approver (e.g. no
   * configured CFO). A batch nobody could approve is dead on arrival — fail fast, before a batch
   * exists, rather than build-then-roll-back (D10 rev. 2026-07-29).
   */
  assertCanRaise?(companyId: string, contextUser: UserInfo): Promise<void>;
  /**
   * Raise the approval Task for a just-built batch and return the Task's ID (null for gates that
   * raise no task). Runs INSIDE the batch-build transaction — its writes commit or roll back with
   * the batch, and the returned ID is stamped onto `JournalEntryBatch.ApprovalTaskID` in the same
   * transaction (one transaction for the whole process — D10 rev. 2026-07-29).
   */
  onBatchBuilt?(batchId: string, contextUser: UserInfo): Promise<string | null>;
  assertApproved(batchId: string, contextUser: UserInfo): Promise<void>;
}

/** Test/seed gate — always approved. Real deployments use the bizapps-tasks-backed gate. */
export const AutoApproveGate: JournalEntryBatchApprovalGate = { async assertApproved() { /* always approved */ } };

/**
 * Thrown when a build finds nothing to batch (no candidate JEs, or every group netted to zero so
 * no summary line would be produced). A batch with no summary line is never persisted (Marcelo
 * 2026-07-21) — the empty case is a loud, explicit outcome, not a silent null.
 */
export class EmptyJournalEntryBatchError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'EmptyJournalEntryBatchError';
  }
}

// ─── buildJournalEntryBatch ──────────────────────────────────────────────────────────────

/**
 * Build a Pending SINGLE-COMPANY batch (D7) from that company's Pending JEs: a netted JournalEntryBatchSummary
 * JE + locked members + the approval task, in ONE transaction (D10 rev. 2026-07-29).
 *
 * Flow: reads + pure work first (candidates, netting, totals, the gate's CFO precondition — all
 * before a single row is written), then one provider transaction wraps EVERY write: batch header →
 * summary JE → pointer/control totals → member JE locks → the approval Task (the gate's writes
 * nest on the same provider/connection, so its verify-read sees the uncommitted Task) → the
 * `ApprovalTaskID`/`ApprovalTaskRaisedAt` stamp. Any failure rolls the whole build back — there is
 * no half-built batch and no build-then-cancel compensation path.
 *
 * Throws `EmptyJournalEntryBatchError` when there is nothing to batch (no candidates, or all groups net to
 * zero) — a batch with no summary line is never persisted.
 */
export async function buildJournalEntryBatch(
  companyId: string,
  targetSystem: JournalEntryBatchTargetSystem,
  batchedByUserId: string,
  contextUser: UserInfo,
  provider: IMetadataProvider,
  gate: JournalEntryBatchApprovalGate = AutoApproveGate,
  options: BuildJournalEntryBatchOptions = {},
): Promise<BuildJournalEntryBatchResult> {
  const p = resolveProviders(provider);
  const jeIds = await loadPendingJEIds(companyId, contextUser, p, options);
  if (jeIds.length === 0) {
    throw new EmptyJournalEntryBatchError(`Nothing to batch: company ${companyId} has no unbatched Pending journal entries matching the criteria.`);
  }
  return buildJournalEntryBatchCore(companyId, jeIds, targetSystem, batchedByUserId, contextUser, provider, gate);
}

/**
 * Build a batch from a SPECIFIC (already-vetted) set of Pending JE IDs belonging to ONE company —
 * the shared one-transaction core of the oldest-forward buildJournalEntryBatch, the explicit-ID build, and the
 * view build. Throws EmptyJournalEntryBatchError when the set nets to zero — a batch with no summary line is
 * never persisted (Marcelo 2026-07-21); the empty case is a loud, explicit outcome, not a silent null.
 */
async function buildJournalEntryBatchCore(
  companyId: string,
  jeIds: string[],
  targetSystem: JournalEntryBatchTargetSystem,
  batchedByUserId: string,
  contextUser: UserInfo,
  provider: IMetadataProvider,
  gate: JournalEntryBatchApprovalGate,
): Promise<BuildJournalEntryBatchResult> {
  const p = resolveProviders(provider);
  const groups = NetLines(await loadNettableLines(companyId, jeIds, contextUser, p));
  if (groups.length === 0) {
    throw new EmptyJournalEntryBatchError(`Nothing to batch: company ${companyId}'s selected entries net to zero — no summary line would be produced.`);
  }
  const { totalDebits, totalCredits } = summaryTotals(groups);

  // Precondition BEFORE any write: a batch nobody could approve must never be built.
  if (gate.assertCanRaise) await gate.assertCanRaise(companyId, contextUser);

  const dbProvider = provider as unknown as DatabaseProviderBase;
  await dbProvider.BeginTransaction();
  try {
    const batch = await createBatchHeader(companyId, targetSystem, batchedByUserId, jeIds.length, contextUser, p);
    const summary = await writeSummaryJournalEntry(batch, groups, contextUser, p);
    await setSummaryPointerAndTotals(batch, summary.ID, totalDebits, totalCredits, jeIds.length);
    await lockJournalEntries(jeIds, batch.ID, contextUser, p);

    let approvalTaskId: string | null = null;
    if (gate.onBatchBuilt) {
      approvalTaskId = await gate.onBatchBuilt(batch.ID, contextUser);
      if (approvalTaskId) {
        batch.ApprovalTaskID = approvalTaskId;
        batch.ApprovalTaskRaisedAt = new Date();
        if (!(await batch.Save())) {
          throw new Error(`buildJournalEntryBatch: ApprovalTaskID stamp failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
        }
      }
    }

    await dbProvider.CommitTransaction();
    return { batchId: batch.ID, summaryJournalEntryId: summary.ID, summaryLineCount: groups.length, totalDebits, totalCredits, jeCount: jeIds.length, approvalTaskId };
  } catch (e) {
    try { await dbProvider.RollbackTransaction(); } catch { /* rollback best-effort */ }
    throw e;
  }
}

/**
 * Distinct companies that currently have unbatched Pending JEs (summary JEs excluded via their
 * type's IsJournalEntryBatchSummary flag). Drives the "build all pending" sweep: one single-company batch per
 * company returned (D7). Exported for the Accounting.BuildJournalEntryBatch remote op.
 */
export async function pendingCompanies(contextUser: UserInfo, provider: IMetadataProvider, options: BuildJournalEntryBatchOptions = {}): Promise<string[]> {
  const p = resolveProviders(provider);
  const res = await p.rv.RunView<{ CompanyID: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: await pendingCandidateFilter(options, contextUser, p), Fields: ['CompanyID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  return [...new Set((res.Results ?? []).map(r => r.CompanyID))];
}

// ─── Criteria (the §7.2 batch-workspace panel) ───────────────────────────────

/**
 * Options for the criteria-driven candidate pool. Candidates are always unbatched Pending JEs
 * (summary JEs excluded via IsJournalEntryBatchSummary), gathered oldest-first; `cutoff` restricts to entries
 * on/before a date so an operator can batch "everything up to the end of the month".
 */
export interface BuildJournalEntryBatchOptions {
  /** Upper bound. A DATE-only cutoff (midnight UTC) is INCLUSIVE of that whole day
   *  (EffectiveDate < cutoff + 1 day); a datetime cutoff is exact (EffectiveDate <= cutoff). */
  cutoff?: Date | null;
  /** Optional lower bound (EffectiveDate >= startDate); omit for the standard oldest-forward flow. */
  startDate?: Date | null;
  /** Restrict the candidate pool to these companies. Omit/empty = all companies. (Builds are
   *  per-company either way, D7 — this narrows which companies participate in a sweep/preview.) */
  companyIds?: string[] | null;
  /** Restrict to these JournalEntryType CODES (e.g. 'Manual','OrderBooking'). Omit/empty = all
   *  non-summary types. Codes, not IDs — the UI filter speaks codes (issue #24 lookup). */
  entryTypeCodes?: string[] | null;
  /** Exclude these JournalEntryType CODES (e.g. 'RevenueRecognition'). Omit/empty = no exclusions. */
  excludeEntryTypeCodes?: string[] | null;
}

/** Build the Pending + non-summary + date-window + scope ExtraFilter (inclusive date-only cutoff). */
export async function pendingCandidateFilter(options: BuildJournalEntryBatchOptions, contextUser: UserInfo, p: Providers): Promise<string> {
  const summaryType = await GetJournalEntryBatchSummaryEntryType(contextUser, p.md);
  const clauses = [`Status='Pending'`, `EntryTypeID<>'${summaryType.ID}'`];
  if (options.startDate) clauses.push(`EffectiveDate >= '${isoDate(options.startDate)}'`);
  if (options.cutoff) {
    if (isMidnightUTC(options.cutoff)) {
      clauses.push(`EffectiveDate < '${isoDate(addDaysUTC(options.cutoff, 1))}'`); // inclusive whole day
    } else {
      clauses.push(`EffectiveDate <= '${options.cutoff.toISOString()}'`); // exact datetime
    }
  }
  // Empty/omitted scope = NO clause (all companies / all types) — never `IN ()`, which is a SQL
  // syntax error AND would silently mean "nothing".
  if (options.companyIds?.length) {
    clauses.push(`CompanyID IN (${options.companyIds.map(sqlGuid).join(',')})`);
  }
  if (options.entryTypeCodes?.length) {
    const typeIds = await resolveEntryTypeIds(options.entryTypeCodes, contextUser, p);
    clauses.push(`EntryTypeID IN (${typeIds.map(sqlGuid).join(',')})`);
  }
  if (options.excludeEntryTypeCodes?.length) {
    const excludeTypeIds = await resolveEntryTypeIds(options.excludeEntryTypeCodes, contextUser, p);
    clauses.push(`EntryTypeID NOT IN (${excludeTypeIds.map(sqlGuid).join(',')})`);
  }
  return clauses.join(' AND ');
}

/** Resolve JournalEntryType CODES to IDs for the criteria filter — unknown codes fail loudly. */
async function resolveEntryTypeIds(codes: string[], contextUser: UserInfo, p: Providers): Promise<string[]> {
  const inList = codes.map(sqlText).join(',');
  const res = await p.rv.RunView<{ ID: string; Code: string }>(
    { EntityName: JET_ENTITY, ExtraFilter: `Code IN (${inList})`, Fields: ['ID', 'Code'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const rows = res.Results ?? [];
  const found = new Set(rows.map(r => r.Code));
  const missing = codes.filter(c => !found.has(c));
  if (missing.length > 0) throw new Error(`buildJournalEntryBatch: unknown JournalEntryType code(s) in criteria: ${missing.join(', ')}`);
  return rows.map(r => r.ID);
}

/**
 * A GUID literal, validated rather than escaped: these ids reach us from a UI filter, and this
 * string is concatenated into a SQL predicate. Anything that is not a plain UUID is rejected
 * outright — there is no legitimate value that needs escaping here, so refusing beats quoting.
 * (The validator itself is the shared SqlGuards helper — one implementation package-wide.)
 */
function sqlGuid(id: string): string {
  return sqlGuidLiteral(id, 'buildJournalEntryBatch: invalid id in criteria');
}

/** A quoted T-SQL string literal (single quotes doubled) for code values. */
function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const isMidnightUTC = (d: Date): boolean =>
  d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
const isoDate = (d: Date): string => new Date(d).toISOString().slice(0, 10);
const addDaysUTC = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
};

// ─── Explicit-ID + view builds (the workspace's include/exclude + B1.2) ──────

/** Thrown when a view/selection contains entries that are not batchable (loud, names offenders). */
export class JournalEntryBatchFromViewError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'JournalEntryBatchFromViewError';
  }
}

/**
 * Build from EXACTLY these JE ids — the include/exclude build behind the workspace preview. The
 * ids are re-verified as still-Pending inside this call (the world can change between preview and
 * click — a stale selection is a loud "refresh and rebuild", never silently-written stale data),
 * then grouped by their header CompanyID and built ONE single-company batch per company (D7).
 */
export async function buildJournalEntryBatchFromExplicitIds(
  jeIds: string[],
  targetSystem: JournalEntryBatchTargetSystem,
  batchedByUserId: string,
  contextUser: UserInfo,
  provider: IMetadataProvider,
  gate: JournalEntryBatchApprovalGate = AutoApproveGate,
): Promise<BuildJournalEntryBatchResult[]> {
  if (jeIds.length === 0) throw new EmptyJournalEntryBatchError('Nothing to batch: no journal entries were selected.');
  const p = resolveProviders(provider);
  const inList = jeIds.map(sqlGuid).join(',');
  const res = await p.rv.RunView<{ ID: string; Status: string; CompanyID: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: `ID IN (${inList})`, Fields: ['ID', 'Status', 'CompanyID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  if (!res.Success) throw new Error(`buildJournalEntryBatchFromExplicitIds: could not validate the selection: ${res.ErrorMessage ?? 'unknown'}`);
  const rows = res.Results ?? [];
  const byId = new Map(rows.map(r => [r.ID.toLowerCase(), r]));
  const stale = jeIds.filter(id => byId.get(id.toLowerCase())?.Status !== 'Pending');
  if (stale.length > 0) {
    throw new JournalEntryBatchFromViewError(
      `buildJournalEntryBatchFromExplicitIds: ${stale.length} selected entr${stale.length === 1 ? 'y is' : 'ies are'} no longer Pending ` +
      `(batched or posted since the preview): ${stale.join(', ')}. Refresh the preview and rebuild.`,
    );
  }
  const byCompany = new Map<string, string[]>();
  for (const id of jeIds) {
    const companyId = byId.get(id.toLowerCase())!.CompanyID;
    const list = byCompany.get(companyId) ?? [];
    list.push(id);
    byCompany.set(companyId, list);
  }
  const results: BuildJournalEntryBatchResult[] = [];
  for (const [companyId, ids] of byCompany) {
    results.push(await buildJournalEntryBatchCore(companyId, ids, targetSystem, batchedByUserId, contextUser, provider, gate));
  }
  return results;
}

/**
 * Batch-from-VIEW (SNAPSHOT model): resolve an MJ User View of Journal Entries to a concrete
 * JE-ID snapshot, classify each (Pending → batchable; GLPosted/Batched → excluded by the
 * default-on filters, else a LOUD reject naming offenders — never a silent drop), narrow to the
 * date window, then build per company via the explicit path. The snapshot is fixed at build time.
 */
export interface BuildJournalEntryBatchFromViewOptions extends BuildJournalEntryBatchOptions {
  /** Default TRUE — a GLPosted entry in the view is excluded (overlap-safe). When false, a loud reject. */
  excludePosted?: boolean;
  /** Default TRUE — an already-Batched/locked entry in the view is excluded. When false, a loud reject. */
  excludeLocked?: boolean;
}

export async function buildJournalEntryBatchFromView(
  viewId: string,
  targetSystem: JournalEntryBatchTargetSystem,
  batchedByUserId: string,
  contextUser: UserInfo,
  provider: IMetadataProvider,
  gate: JournalEntryBatchApprovalGate = AutoApproveGate,
  options: BuildJournalEntryBatchFromViewOptions = {},
): Promise<BuildJournalEntryBatchResult[]> {
  const p = resolveProviders(provider);
  const viewRes = await p.rv.RunView<{ ID: string; Status: string }>(
    { ViewID: viewId, Fields: ['ID', 'Status'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  if (!viewRes.Success) throw new JournalEntryBatchFromViewError(`Batch-from-view: could not resolve view ${viewId}: ${viewRes.ErrorMessage ?? 'unknown'}`);
  const { pending, rejected, excluded } = classifyViewEntries(viewRes.Results ?? [], options);
  if (rejected.length > 0) {
    throw new JournalEntryBatchFromViewError(
      `Batch-from-view: ${rejected.length} entr${rejected.length === 1 ? 'y is' : 'ies are'} not batchable: ${rejected.join(', ')}. ` +
      `Adjust the view or enable the exclude-posted/exclude-locked filters to allow overlap.`,
    );
  }
  if (excluded.length > 0) {
    console.warn(`buildJournalEntryBatchFromView: excluded ${excluded.length} non-Pending entr${excluded.length === 1 ? 'y' : 'ies'} (overlap-safe): ${excluded.join(', ')}`);
  }
  if (pending.length === 0) throw new EmptyJournalEntryBatchError('Batch-from-view: the view resolves to no batchable Pending entries.');
  let inWindow = pending;
  if (options.cutoff || options.startDate) {
    const winRes = await p.rv.RunView<{ ID: string }>(
      { EntityName: JE_ENTITY, ExtraFilter: `ID IN (${pending.map(sqlGuid).join(',')}) AND ${await pendingCandidateFilter(options, contextUser, p)}`, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
      contextUser,
    );
    inWindow = (winRes.Results ?? []).map(r => r.ID);
    if (inWindow.length === 0) throw new EmptyJournalEntryBatchError('Batch-from-view: no view entries fall inside the date window.');
  }
  return buildJournalEntryBatchFromExplicitIds(inWindow, targetSystem, batchedByUserId, contextUser, provider, gate);
}

/**
 * PURE classification of a view's JE rows: Pending → batchable; GLPosted/Batched → excluded when
 * the (default-on) filter allows overlap, else a loud reject; any other status → always reject.
 * Deterministic + no I/O so it is unit-testable without a live view.
 */
export function classifyViewEntries(
  rows: Array<{ ID: string; Status: string }>,
  options: { excludePosted?: boolean; excludeLocked?: boolean } = {},
): { pending: string[]; rejected: string[]; excluded: string[] } {
  const excludePosted = options.excludePosted ?? true;
  const excludeLocked = options.excludeLocked ?? true;
  const pending: string[] = [];
  const rejected: string[] = [];
  const excluded: string[] = [];
  for (const r of rows) {
    if (r.Status === 'Pending') pending.push(r.ID);
    else if (r.Status === 'GLPosted') (excludePosted ? excluded : rejected).push(`${r.ID} (posted)`);
    else if (r.Status === 'Batched') (excludeLocked ? excluded : rejected).push(`${r.ID} (locked)`);
    else rejected.push(`${r.ID} (${r.Status})`);
  }
  return { pending, rejected, excluded };
}

// ─── candidate/line loading + batch write helpers ────────────────────────────

async function loadPendingJEIds(companyId: string, contextUser: UserInfo, p: Providers, options: BuildJournalEntryBatchOptions = {}): Promise<string[]> {
  const res = await p.rv.RunView<{ ID: string }>(
    {
      EntityName: JE_ENTITY,
      ExtraFilter: `CompanyID=${sqlGuid(companyId)} AND ${await pendingCandidateFilter(options, contextUser, p)}`,
      OrderBy: 'EffectiveDate ASC, EntryNumber ASC', // oldest-first — the order a build takes them in
      Fields: ['ID'],
      ResultType: 'simple',
      BypassCache: true,
    },
    contextUser,
  );
  return (res.Results ?? []).map(r => r.ID);
}

async function loadNettableLines(companyId: string, jeIds: string[], contextUser: UserInfo, p: Providers): Promise<NettableLine[]> {
  const inList = jeIds.map(id => `'${id}'`).join(',');
  const lineRes = await p.rv.RunView<{ ID: string; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>(
    { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID IN (${inList})`, Fields: ['ID', 'GLAccountID', 'DebitAmount', 'CreditAmount'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const lines = lineRes.Results ?? [];
  const dimsByLine = await loadDimensionsByLine(lines.map(l => l.ID), contextUser, p);
  // The line's company IS the parent JE's header company (single-company JE, D3; trigger 50019
  // guarantees every line's GLAccount belongs to it) — and every gathered JE belongs to companyId.
  return lines.map(l => ({ companyId, glAccountId: l.GLAccountID, debit: l.DebitAmount ?? 0, credit: l.CreditAmount ?? 0, dims: dimsByLine.get(l.ID) ?? [] }));
}

async function loadDimensionsByLine(lineIds: string[], contextUser: UserInfo, p: Providers): Promise<Map<string, DimRef[]>> {
  const byLine = new Map<string, DimRef[]>();
  if (lineIds.length === 0) return byLine;
  const inList = lineIds.map(id => `'${id}'`).join(',');
  const res = await p.rv.RunView<{ JournalEntryLineID: string; DimensionID: string; DimensionValueID: string }>(
    { EntityName: JELD_ENTITY, ExtraFilter: `JournalEntryLineID IN (${inList})`, Fields: ['JournalEntryLineID', 'DimensionID', 'DimensionValueID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  for (const d of res.Results ?? []) {
    const arr = byLine.get(d.JournalEntryLineID) ?? [];
    arr.push({ DimensionID: d.DimensionID, DimensionValueID: d.DimensionValueID });
    byLine.set(d.JournalEntryLineID, arr);
  }
  return byLine;
}

/**
 * Today as a date-only value in the BUSINESS zone, UTC midnight of that day. PostingDate selection
 * is a UI-port item. Exported (not module-private) so the pinned business-day-semantics test in
 * `__tests__/JournalEntryBatchEngine.test.ts` can call it directly without a full provider mock.
 */
export function todayBusiness(): Date {
  return BusinessTimeZoneEngine.Instance.TodayAsDate();
}

async function createBatchHeader(
  companyId: string, targetSystem: JournalEntryBatchTargetSystem, batchedByUserId: string, jeCount: number, contextUser: UserInfo, p: Providers,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  await BusinessTimeZoneEngine.Instance.Config(false, contextUser, p.md);
  const batch = await p.md.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, contextUser);
  batch.NewRecord();
  // The one sanctioned create. Everything else that saves a new batch — Explorer's generic New
  // form included — is refused by the entity's create guard (#193).
  batch.MarkBuiltByBatchingProcess();
  batch.CompanyID = companyId;
  batch.PostingDate = todayBusiness();
  batch.TargetSystem = targetSystem;
  batch.BatchedAt = new Date();
  batch.BatchedByUserID = batchedByUserId;
  batch.Status = 'Pending';
  batch.TotalEntries = jeCount;
  batch.TotalDebits = 0;
  batch.TotalCredits = 0;
  if (!(await batch.Save())) throw new Error(`buildJournalEntryBatch: batch header save failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  return batch;
}

/**
 * Write the netted summary as a JournalEntryBatchSummary JournalEntry: header + one JournalEntryLine per net
 * group with its dimension tags — assembled in memory and persisted in ONE transactional Save()
 * via the encapsulated JournalEntryEntityServer — then flip it to Batched (JournalEntryBatchID is already
 * set, so the flip is the sanctioned preliminary lock; balanced-on-lock 50001 verifies footing).
 */
async function writeSummaryJournalEntry(
  batch: mjBizAppsAccountingJournalEntryBatchEntity, groups: NetGroup[], contextUser: UserInfo, p: Providers,
): Promise<JournalEntryEntityServer> {
  const summary = await p.md.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, contextUser);
  summary.NewRecord();
  summary.CompanyID = batch.CompanyID;
  summary.EffectiveDate = batch.PostingDate;
  summary.EntryTypeID = (await GetJournalEntryBatchSummaryEntryType(contextUser, p.md)).ID;
  summary.Status = 'Pending';
  summary.JournalEntryBatchID = batch.ID;
  summary.Description = `Netted summary for batch ${batch.JournalEntryBatchNumber}`;

  for (const g of groups) {
    const line = await summary.CreateLine(contextUser);
    line.GLAccountID = g.glAccountId;
    if (g.side === 'Debit') line.DebitAmount = g.net;
    else line.CreditAmount = -g.net;
    line.Description = `Netted from ${g.sourceLineCount} source line(s)`;
    for (const d of g.dims) {
      const dim = await line.CreateDimension(contextUser);
      dim.DimensionID = d.DimensionID;
      dim.DimensionValueID = d.DimensionValueID;
    }
  }
  if (!(await summary.Save())) {
    throw new Error(`buildJournalEntryBatch: summary JE save failed: ${summary.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }

  // Preliminary lock: Pending→Batched with JournalEntryBatchID set (reversible while the batch stays Pending).
  summary.Status = 'Batched';
  if (!(await summary.Save())) {
    throw new Error(`buildJournalEntryBatch: summary JE lock (Pending→Batched) failed — the summary must foot (50001): ${summary.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
  return summary;
}

function summaryTotals(groups: NetGroup[]): { totalDebits: number; totalCredits: number } {
  let totalDebits = 0, totalCredits = 0;
  for (const g of groups) {
    if (g.side === 'Debit') totalDebits += g.net;
    else totalCredits += -g.net;
  }
  return { totalDebits: Math.round(totalDebits * 100) / 100, totalCredits: Math.round(totalCredits * 100) / 100 };
}

/** Point the batch at its summary JE + record the balanced control totals (trigger 50023 verifies coherence). */
async function setSummaryPointerAndTotals(
  batch: mjBizAppsAccountingJournalEntryBatchEntity, summaryJournalEntryId: string | null,
  totalDebits: number, totalCredits: number, jeCount: number,
): Promise<void> {
  batch.SummaryJournalEntryID = summaryJournalEntryId;
  batch.TotalDebits = totalDebits;
  batch.TotalCredits = totalCredits;
  batch.TotalEntries = jeCount;
  if (!(await batch.Save())) throw new Error(`buildJournalEntryBatch: summary-pointer/control-totals save failed (coherence 50023): ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
}

/**
 * Resolve a local GL account to the identifier the ERP receives — the ACCOUNT NUMBER wire format
 * ("the ERP knows nothing of our IDs"). Precedence: the inline GLAccount.ExternalAccountID (when
 * its ExternalSystem matches or is unset) → the account's own Code (the account number — the
 * default; per-company charts mirror the ERP's numbers, so resolution never fails).
 * ⚠ OPEN with Amith: whether dispatch snapshots this resolution or re-resolves at post time
 * (the retired batch-line-item snapshot column has no successor yet).
 */
export async function resolveExternalAccount(
  glAccountId: string, targetSystem: JournalEntryBatchTargetSystem, contextUser: UserInfo, provider: IMetadataProvider,
): Promise<string> {
  const p = resolveProviders(provider);
  const glRes = await p.rv.RunView<{ Code: string; ExternalSystem: string | null; ExternalAccountID: string | null }>(
    { EntityName: GL_ENTITY, ExtraFilter: `ID='${glAccountId}'`, Fields: ['Code', 'ExternalSystem', 'ExternalAccountID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const gl = glRes.Results?.[0];
  if (!gl) throw new Error(`resolveExternalAccount: GL account ${glAccountId} not found`);
  if (gl.ExternalAccountID && (!gl.ExternalSystem || gl.ExternalSystem === targetSystem)) return gl.ExternalAccountID;
  return gl.Code; // the account number IS the wire identity
}

/**
 * A dimension tag in ERP wire format: the dimension's code and the chosen value's code
 * ("the ERP knows nothing of our IDs" — the same rule `resolveExternalAccount` follows).
 */
export interface ExternalDimensionRef {
  code: string;
  valueCode: string;
}

/**
 * Resolve the dimension tags on a set of journal entry lines into ERP wire codes, keyed by
 * JournalEntryLineID. Lines with no tags are simply absent from the map.
 *
 * Unlike GLAccount — which carries ExternalSystem/ExternalAccountID and so can hold a per-ERP
 * override — Dimension and DimensionValue have only Code. The pull sync writes the ERP's own code
 * into that column, so Code IS the wire identity and there is nothing to override. A tag whose
 * Dimension or DimensionValue has no code is an error rather than a silent omission: dropping it
 * would post an untagged line, which is exactly the failure this resolution exists to prevent.
 */
export async function resolveExternalDimensions(
  lineIds: string[], contextUser: UserInfo, provider: IMetadataProvider,
): Promise<Map<string, ExternalDimensionRef[]>> {
  const p = resolveProviders(provider);
  const tagsByLine = await loadDimensionsByLine(lineIds, contextUser, p);
  const tags = [...tagsByLine.values()].flat();
  const [dimensionCodes, valueCodes] = await Promise.all([
    loadCodesById(DIM_ENTITY, unique(tags.map(t => t.DimensionID)), contextUser, p),
    loadCodesById(DIMVAL_ENTITY, unique(tags.map(t => t.DimensionValueID)), contextUser, p),
  ]);

  const byLine = new Map<string, ExternalDimensionRef[]>();
  for (const [lineId, lineTags] of tagsByLine) {
    byLine.set(lineId, lineTags.map(t => toExternalDimensionRef(t, dimensionCodes, valueCodes)));
  }
  return byLine;
}

function toExternalDimensionRef(
  tag: DimRef, dimensionCodes: Map<string, string>, valueCodes: Map<string, string>,
): ExternalDimensionRef {
  const code = dimensionCodes.get(tag.DimensionID);
  const valueCode = valueCodes.get(tag.DimensionValueID);
  if (!code) throw new Error(`resolveExternalDimensions: dimension ${tag.DimensionID} has no code`);
  if (!valueCode) throw new Error(`resolveExternalDimensions: dimension value ${tag.DimensionValueID} has no code`);
  return { code, valueCode };
}

/** Code lookup for a Code-bearing master-data entity, by ID. */
async function loadCodesById(
  entityName: string, ids: string[], contextUser: UserInfo, p: Providers,
): Promise<Map<string, string>> {
  const byId = new Map<string, string>();
  if (ids.length === 0) return byId;
  const inList = ids.map(id => sqlGuidLiteral(id, `resolveExternalDimensions: invalid id for ${entityName}`)).join(',');
  const res = await p.rv.RunView<{ ID: string; Code: string }>(
    { EntityName: entityName, ExtraFilter: `ID IN (${inList})`, Fields: ['ID', 'Code'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  for (const row of res.Results ?? []) {
    if (row.Code) byId.set(row.ID, row.Code);
  }
  return byId;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** Lock the member JEs: Status → Batched with JournalEntryBatchID (CK_JournalEntry_BatchedHasJournalEntryBatch + the immutability triggers). */
async function lockJournalEntries(jeIds: string[], batchId: string, contextUser: UserInfo, p: Providers): Promise<void> {
  for (const jeId of jeIds) {
    const je = await p.md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, contextUser);
    await je.Load(jeId);
    je.JournalEntryBatchID = batchId;
    je.Status = 'Batched';
    if (!(await je.Save())) throw new Error(`buildJournalEntryBatch: failed to lock JE ${jeId}: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
}

// ─── cancelJournalEntryBatch / regenerateJournalEntryBatch — reverse a batch's lock ──

/**
 * Who may cancel a batch past approval, and where that cancel is recorded (#183). Implemented by
 * TasksAppApprovalGate: the company's CFO or the batch's recorded approver, with the cancel written
 * to the approval Task.
 */
export interface JournalEntryBatchCancelGate {
  assertMayCancelApproved(batchId: string, contextUser: UserInfo): Promise<void>;
  recordCancellation(batchId: string, cancellation: RecordedCancellation, contextUser: UserInfo): Promise<void>;
}

/** What a cancel past approval records on the approval Task. */
export interface RecordedCancellation {
  reason: string;
  /**
   * The status the batch was cancelled FROM. Passed in, not re-read: the recording runs inside the
   * cancel's transaction, after the batch was saved Cancelled, so a reload would say Cancelled.
   */
  fromStatus: string;
  /** For a Failed batch, how "not posted in the ERP" was established (#207). */
  erpCheck?: string;
}

/** How a Failed cancel's ERP check came out, when it lets the cancel go ahead. */
interface FailedCancelErpCheck {
  basis: ERPNotPostedBasis;
  /** For the approval Task comment. */
  description: string;
}

/** {@link cancelJournalEntryBatch}'s options: the entity's, plus the gate a cancel past approval requires. */
export interface CancelJournalEntryBatchOptions extends Omit<JournalEntryBatchCancelOptions, 'onCancelled'> {
  /** Required to cancel an Approved or Failed batch; a Pending cancel (a CFO rejection, already gated) needs none. */
  gate?: JournalEntryBatchCancelGate;
  /**
   * The ERP lookup a Failed cancel runs first (#207). Omitted, the ERP counts as offering none, so a
   * Failed cancel needs the operator's confirmation — the behaviour before the lookup existed.
   */
  lookup?: ErpJournalLookup;
}

/**
 * Cancel a Pending, Approved or Failed batch: mark it Cancelled, return its member journal entries
 * to the candidate pool and delete its JournalEntryBatchSummary JE. From Approved or Failed (#183)
 * the caller must be allowed to cancel (`options.gate`) and `options.reason` is required; the cancel
 * is recorded on the approval Task in the same transaction. A Pending cancel (a CFO rejection, gated
 * by recordDecision) needs none of it.
 *
 * From Failed the ERP is checked first (#207), because a Failed batch may already have posted and a
 * cancel releases its entries to be batched again under a NEW number that no later lookup can
 * connect to this journal. See {@link checkFailedBatchBeforeCancel}.
 */
export async function cancelJournalEntryBatch(
  batchId: string, contextUser: UserInfo, provider: IMetadataProvider, options: CancelJournalEntryBatchOptions = {},
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  // The mechanics are single-aggregate (the batch reversing ITS OWN lock) and live on the entity
  // (JournalEntryBatchEntityServer.Cancel — one transaction). Authorizing a cancel past approval and
  // recording it on the Task reach other aggregates, so they are composed here.
  const p = resolveProviders(provider);
  const batch = await p.md.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`cancelJournalEntryBatch: batch ${batchId} not found`);
  const { gate, ...cancelOptions } = options;
  if (batch.Status === 'Pending') {
    await batch.Cancel(contextUser, cancelOptions);
    return batch;
  }
  if (!gate) {
    throw new Error(`cancelJournalEntryBatch: batch ${batch.JournalEntryBatchNumber ?? batchId} is ${batch.Status}; cancelling past approval needs the approval gate to authorize and record it.`);
  }
  await gate.assertMayCancelApproved(batch.ID, contextUser);
  const { lookup, ...entityOptions } = cancelOptions;
  const fromStatus = batch.Status;
  // Authorized first, so an unauthorized caller learns nothing from the ERP.
  const erpCheck = fromStatus === 'Failed'
    ? await checkFailedBatchBeforeCancel(batch, contextUser, p, lookup ?? unavailableErpLookup, entityOptions.confirmNotAlreadyPostedInERP === true)
    : undefined;
  await batch.Cancel(contextUser, {
    ...entityOptions,
    // A lookup that found nothing IS the ERP check; the entity persists it, and on what basis, either way.
    ...(erpCheck ? { confirmNotAlreadyPostedInERP: true, erpNotPostedBasis: erpCheck.basis } : {}),
    onCancelled: () => gate.recordCancellation(batch.ID, { reason: entityOptions.reason ?? '', fromStatus, erpCheck: erpCheck?.description }, contextUser),
  });
  return batch;
}

/**
 * The ERP check a Failed cancel runs before anything is written (#207). Returns how "not posted" was
 * established, for the approval Task; throws when the cancel must not go ahead:
 *   · a matching posting → the batch DID post. Refused, with no override: cancelling would post its
 *                          entries a second time. A retry records it Posted without sending again.
 *   · nothing posted     → proceed; the lookup is the check.
 *   · a posting that differs, a failed lookup, or no lookup → refused with
 *                          {@link ErpPostingUnconfirmedError} unless the operator confirmed.
 */
async function checkFailedBatchBeforeCancel(
  batch: mjBizAppsAccountingJournalEntryBatchEntity, contextUser: UserInfo, p: Providers, lookup: ErpJournalLookup, confirmed: boolean,
): Promise<FailedCancelErpCheck> {
  const doc = batch.JournalEntryBatchNumber ?? batch.ID;
  const summaryLines = await loadSummaryLines(batch, contextUser, p);
  const found = await lookupOrError(lookup, batch, summaryLines, contextUser, 'cancelJournalEntryBatch');
  if (found.status === 'Found') {
    throw new Error(
      `cancelJournalEntryBatch: the ERP already holds document ${doc} (${found.externalJournalEntryBatchRef}) and it matches this batch, so the batch posted. ` +
      'Cancelling would release its entries to post again under a new number. Retry it from Dispatch status instead: the retry records it Posted without sending it again.',
    );
  }
  if (found.status === 'NotFound') return { basis: 'ERPLookup', description: `The ERP lookup found nothing posted under document ${doc}.` };
  const refusal = cancelRefusal(found, doc);
  if (!confirmed) throw new ErpPostingUnconfirmedError(refusal.kind, refusal.reason, 'cancelJournalEntryBatch');
  return { basis: 'UserAttested', description: `The canceller confirmed document ${doc} had not posted; the ERP lookup could not settle it (${refusal.kind}).` };
}

/** Why a Failed cancel needs the operator's word: the lookup ran and could not say "not posted". */
function cancelRefusal(
  found: Exclude<ErpJournalLookupResult, { status: 'Found' } | { status: 'NotFound' }>, doc: string,
): { kind: ErpPostingUnconfirmedKind; reason: string } {
  const confirmHint = `Confirm in the ERP that document ${doc} has not posted, then cancel with that confirmation; otherwise its entries post again in the next batch.`;
  switch (found.status) {
    case 'Unavailable':
      return { kind: 'Unavailable', reason: `batch ${doc} is Failed and may already be in the ERP, which offers no lookup to check. ${confirmHint}` };
    case 'Error':
      return { kind: 'Error', reason: `could not check the ERP for document ${doc} before cancelling: ${found.error} Try again once the ERP answers, or: ${confirmHint}` };
    case 'Mismatch':
      return {
        kind: 'Mismatch',
        reason: `the ERP already holds document ${doc}, and it does not match this batch: ${found.detail} ` +
          'That is most likely this batch, changed by the ERP (tax or VAT entries it added) or by an account mapping change, in which case it has posted and cancelling would post its entries again. ' +
          `Reconcile it in the ERP instead. Only if that posting is not this batch: ${confirmHint}`,
      };
  }
}

/**
 * Regenerate an OPEN (Pending) batch in place: unlock its current JEs + delete its summary JE, then
 * re-gather ALL current candidates for the batch's company (every unbatched Pending JE, incl. ones
 * added since) and rebuild the netted summary on the SAME batch record.
 */
export async function regenerateJournalEntryBatch(
  batchId: string, targetSystem: JournalEntryBatchTargetSystem, contextUser: UserInfo, provider: IMetadataProvider,
): Promise<BuildJournalEntryBatchResult> {
  const p = resolveProviders(provider);
  const batch = await p.md.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`regenerateJournalEntryBatch: batch ${batchId} not found`);
  if (batch.Status !== 'Pending') {
    throw new Error(`regenerateJournalEntryBatch: batch ${batchId} is ${batch.Status}; only a Pending batch can be regenerated`);
  }

  // ONE transaction (D10 rev. 2026-07-29): teardown + re-gather + rebuild commit all-or-none.
  // Candidates are gathered AFTER teardown (inside the transaction) so the batch's own returning
  // members are part of the pool. The approval Task from the original build stays with the batch.
  const dbProvider = provider as unknown as DatabaseProviderBase;
  await dbProvider.BeginTransaction();
  try {
    await batch.TearDownSummaryAndUnlock(contextUser);

    const jeIds = await loadPendingJEIds(batch.CompanyID, contextUser, p);
    const groups = NetLines(await loadNettableLines(batch.CompanyID, jeIds, contextUser, p));
    if (groups.length === 0) {
      // Nothing to rebuild — a batch with no summary line is never persisted (Marcelo 2026-07-21):
      // keep the teardown (members back to the pool), mark the batch Cancelled, and say so loudly.
      batch.Status = 'Cancelled';
      if (!(await batch.Save())) throw new Error(`regenerateJournalEntryBatch: empty-cancel failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
      await dbProvider.CommitTransaction();
      throw new EmptyJournalEntryBatchError(`regenerateJournalEntryBatch: no candidates remain for company ${batch.CompanyID} — batch ${batch.JournalEntryBatchNumber} cancelled (a batch with no summary line is never persisted).`);
    }

    const { totalDebits, totalCredits } = summaryTotals(groups);
    batch.TargetSystem = targetSystem;
    const summary = await writeSummaryJournalEntry(batch, groups, contextUser, p);
    await setSummaryPointerAndTotals(batch, summary.ID, totalDebits, totalCredits, jeIds.length);
    await lockJournalEntries(jeIds, batch.ID, contextUser, p);

    await dbProvider.CommitTransaction();
    return { batchId: batch.ID, summaryJournalEntryId: summary.ID, summaryLineCount: groups.length, totalDebits, totalCredits, jeCount: jeIds.length, approvalTaskId: batch.ApprovalTaskID ?? null };
  } catch (e) {
    // EmptyJournalEntryBatchError above is thrown AFTER its commit — never roll that back.
    if (!(e instanceof EmptyJournalEntryBatchError)) {
      try { await dbProvider.RollbackTransaction(); } catch { /* rollback best-effort */ }
    }
    throw e;
  }
}

// ─── approveJournalEntryBatch ────────────────────────────────────────────────────────────

/** The human sign-off: Pending → Approved (+audit). Content freezes here (trg_JournalEntryBatch_Immutability). */
export async function approveJournalEntryBatch(
  batchId: string, approvedByUserId: string, contextUser: UserInfo, provider: IMetadataProvider,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const p = resolveProviders(provider);
  const batch = await p.md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`approveJournalEntryBatch: batch ${batchId} not found`);
  if (batch.Status !== 'Pending') throw new Error(`approveJournalEntryBatch: batch ${batchId} is ${batch.Status}, only a Pending batch can be approved`);
  batch.Status = 'Approved';
  batch.ApprovedAt = new Date();
  batch.ApprovedByUserID = approvedByUserId;
  if (!(await batch.Save())) throw new Error(`approveJournalEntryBatch: Pending→Approved failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  return batch;
}

// ─── sendJournalEntryBatch ─────────────────────────────────────────────────────────────

export interface SendJournalEntryBatchOptions {
  gate: JournalEntryBatchApprovalGate;
  poster?: ErpPoster;
  /**
   * Reads what the ERP holds under the batch's number before the send. Defaults to
   * {@link unavailableErpLookup}; a caller wiring a real `poster` wires its partner lookup with it.
   */
  lookup?: ErpJournalLookup;
  /** The provider for this call — injected by the caller (required; no global fallback). */
  provider: IMetadataProvider;
  /**
   * The operator has checked the ERP and this batch's number has NOT posted there. Needed only when
   * the pre-flight lookup cannot settle it: the ERP offers no lookup and the batch is a `Failed`
   * retry, the lookup failed, or the ERP holds something under the number that does not match. It
   * never overrides a matching posting, which is recorded as this batch's.
   */
  confirmNotAlreadyPostedInERP?: boolean;
}

/**
 * Why a pre-flight lookup could not settle whether the ERP already holds a batch:
 *   · `Unavailable` — the ERP offers no lookup.
 *   · `Error`       — the lookup ran and could not answer.
 *   · `Mismatch`    — the ERP holds something under the number that differs from the batch. It may be
 *                     this very batch, changed by the ERP (tax or VAT entries it added) or by a mapping
 *                     change since it posted, so an operator must treat it more carefully than the others.
 */
export type ErpPostingUnconfirmedKind = 'Unavailable' | 'Error' | 'Mismatch';

/**
 * A Failed retry or cancel refused because the ERP lookup could not settle whether the ERP already
 * holds the batch. `Kind` and `Reason` say why, for an operator deciding whether to go ahead with
 * `confirmNotAlreadyPostedInERP`. The batch is untouched: still Failed, nothing written.
 */
export class ErpPostingUnconfirmedError extends Error {
  constructor(
    public readonly Kind: ErpPostingUnconfirmedKind,
    public readonly Reason: string,
    operation: 'sendJournalEntryBatch' | 'cancelJournalEntryBatch' = 'sendJournalEntryBatch',
  ) {
    super(`${operation}: ${Reason}`);
    this.name = 'ErpPostingUnconfirmedError';
  }
}

/**
 * The statuses a send may start from. `Failed` is a RETRY (#145): the batch was approved before its
 * first send, and the gate and the coherence check below re-run on every send, so a retry reuses
 * that approval rather than asking for a second one. `Failed → Sent` is already an edge of
 * JournalEntryBatchEntityServer's LEGAL_TRANSITIONS; without this, nothing could reach it and a
 * Failed batch held its entries at `Batched` for good.
 */
const SENDABLE_FROM: ReadonlyArray<string> = ['Approved', 'Failed'];

/**
 * Send an APPROVED batch to the ERP, or retry a FAILED one. Requires the approval gate + a sendable
 * status; then re-runs the approval-time coherence check (member set + control-total footing), asks
 * the ERP what it holds under the batch's number, then →Sent, posts the summary JE's lines to the
 * ERP (all-or-nothing), and on confirmation flips Sent→Posted + the member JEs AND the summary JE
 * Batched→GLPosted.
 *
 * **The coherence check compares against the approval.** Besides footing, member count and the
 * summary entry's date and company, it recomputes the batch's content hash and compares it with the
 * `ApprovedContentHash` written at approval (#183), so a batch whose header, summary or member set
 * changed after approval is refused. trg_JournalEntryBatch_Immutability also freezes Approved and
 * Failed content, so the seal is the second line of defence, not the first. A batch approved before
 * the seal existed has no hash and gets the other checks only.
 *
 * **Every send checks the ERP first (#182).** `Failed` does not prove the ERP rejected the journal:
 * the poster can succeed with the response lost, or succeed and then have the Sent→Posted save fail,
 * and both are recorded as Failed. So before posting, the lookup reads what the ERP holds under the
 * batch's number:
 *   · nothing                → post.
 *   · a matching posting     → on a Failed retry, the ERP already has this batch: record it Posted
 *                              with no second post. On a first send the batch has never reached the
 *                              ERP, so the match is another journal under the same number (another
 *                              environment, a reused number): refuse, and leave the batch Approved.
 *                              No confirmation overrides either outcome.
 *   · a posting that differs → refuse, unless `confirmNotAlreadyPostedInERP`.
 *   · the lookup failed      → refuse, unless `confirmNotAlreadyPostedInERP`.
 *   · no lookup for this ERP → a first send posts; a Failed retry needs `confirmNotAlreadyPostedInERP`.
 * A refused Failed retry throws {@link ErpPostingUnconfirmedError} and stays Failed. Any other refused
 * first send goes Sent→Failed with the reason, so it surfaces as a stranded batch to retry rather
 * than sitting at Approved unseen. The matched first send is the exception: marked Failed, its retry
 * would find the same match and record it Posted.
 */
export async function sendJournalEntryBatch(batchId: string, contextUser: UserInfo, options: SendJournalEntryBatchOptions): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const p = resolveProviders(options.provider);
  const poster = options.poster ?? mockErpPoster;
  const batch = await p.md.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`sendJournalEntryBatch: batch ${batchId} not found`);
  const fromStatus = batch.Status;
  if (!SENDABLE_FROM.includes(fromStatus)) {
    throw new Error(`sendJournalEntryBatch: batch ${batchId} is ${fromStatus}, only an Approved batch can be sent or a Failed batch retried`);
  }

  await options.gate.assertApproved(batchId, contextUser); // throws if not CFO-approved

  // Re-run the approval-time checks and the seal comparison against the database, right before
  // the flip to Sent.
  const drift = await batch.CheckControlTotalCoherence(contextUser);
  if (drift.length > 0) {
    throw new Error(
      `sendJournalEntryBatch: batch ${batch.JournalEntryBatchNumber ?? batchId} no longer matches its approved content — refusing to dispatch. ${drift.join(' ')}`,
    );
  }

  // Before the →Sent save: a throw here must leave the batch where it was, not stranded at Sent.
  const summaryLines = await loadSummaryLines(batch, contextUser, p);
  const preflight = await lookupOrError(options.lookup ?? unavailableErpLookup, batch, summaryLines, contextUser);
  if (preflight.status === 'Found' && fromStatus !== 'Failed') throw new Error(`sendJournalEntryBatch: ${numberCollision(batch, preflight.externalJournalEntryBatchRef)}`);
  const refusal = preflightRefusal(preflight, batch, fromStatus, options.confirmNotAlreadyPostedInERP === true);
  if (refusal && fromStatus === 'Failed') throw new ErpPostingUnconfirmedError(refusal.kind, refusal.reason);

  batch.Status = 'Sent';
  batch.SentAt = new Date();
  if (!(await batch.Save())) throw new Error(`sendJournalEntryBatch: ${fromStatus}→Sent failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);

  if (refusal) return await failBatch(batch, refusal.reason);
  if (preflight.status === 'Found') {
    LogStatus(`sendJournalEntryBatch: the ERP already holds batch ${batch.JournalEntryBatchNumber ?? batch.ID} as ${preflight.externalJournalEntryBatchRef}; recording it Posted without sending it again.`);
    return await markBatchPosted(batch, preflight.externalJournalEntryBatchRef, contextUser, p);
  }

  const postResult = await postOrFail(poster, batch, summaryLines, contextUser);
  return postResult.success
    ? await markBatchPosted(batch, postResult.externalJournalEntryBatchRef ?? null, contextUser, p)
    : await failBatch(batch, postResult.error ?? 'ERP post failed');
}

/** Run the lookup, turning a THROW into `Error` so it refuses the send like any other failed lookup. */
async function lookupOrError(
  lookup: ErpJournalLookup, batch: mjBizAppsAccountingJournalEntryBatchEntity, summaryLines: mjBizAppsAccountingJournalEntryLineEntity[], contextUser: UserInfo,
  operation: 'sendJournalEntryBatch' | 'cancelJournalEntryBatch' = 'sendJournalEntryBatch',
): Promise<ErpJournalLookupResult> {
  try {
    return await lookup(batch, summaryLines, contextUser);
  } catch (err) {
    LogError(`${operation}: ERP lookup threw for batch ${batch.JournalEntryBatchNumber ?? batch.ID}`, null, err);
    return { status: 'Error', error: err instanceof Error ? err.message : String(err) };
  }
}

/** A first send whose number the ERP already holds, matching line for line: not this batch, which never reached the ERP. */
function numberCollision(batch: mjBizAppsAccountingJournalEntryBatchEntity, externalRef: string): string {
  const doc = batch.JournalEntryBatchNumber ?? batch.ID;
  return `the ERP already holds a posting under document ${doc} (${externalRef}) that matches this batch, but this batch has never been sent. ` +
    'It is another journal under the same number, from another environment or a reused number. Refusing to send it or to record it Posted; ' +
    'the batch stays Approved. Resolve the collision in the ERP, or archive this batch from Batch approvals.';
}

/** Why the pre-flight lookup stops this send, or null when it may go ahead. See {@link sendJournalEntryBatch}. */
function preflightRefusal(
  preflight: ErpJournalLookupResult, batch: mjBizAppsAccountingJournalEntryBatchEntity, fromStatus: string, confirmed: boolean,
): { kind: ErpPostingUnconfirmedKind; reason: string } | null {
  if (confirmed) return null;
  const doc = batch.JournalEntryBatchNumber ?? batch.ID;
  const confirmHint = `Confirm in the ERP that document ${doc} has not posted, then retry with that confirmation.`;
  switch (preflight.status) {
    case 'NotFound':
    case 'Found':
      return null;
    case 'Unavailable':
      return fromStatus === 'Failed'
        ? { kind: 'Unavailable', reason: `batch ${doc} is Failed, and a Failed batch may already be in the ERP, which offers no lookup to check. ${confirmHint}` }
        : null;
    case 'Error':
      return { kind: 'Error', reason: `could not check the ERP for document ${doc} before sending: ${preflight.error} Retry once the ERP answers, or: ${confirmHint}` };
    case 'Mismatch':
      return {
        kind: 'Mismatch',
        reason: `the ERP already holds document ${doc}, and it does not match this batch: ${preflight.detail} ` +
          'It may still be this batch, changed by the ERP (tax or VAT entries it added) or by an account mapping change since it posted. ' +
          `Only if that posting is not this batch: ${confirmHint}`,
      };
  }
}

/**
 * Run the poster, turning a THROW into `{success:false}` so the batch is marked Failed instead of
 * left at Sent, where no operator action can reach it. A poster throws before its ERP call or after
 * that call has failed, so Failed is accurate; where it is not (a lost response), the next send's
 * lookup finds the posting.
 */
async function postOrFail(
  poster: ErpPoster, batch: mjBizAppsAccountingJournalEntryBatchEntity, summaryLines: mjBizAppsAccountingJournalEntryLineEntity[], contextUser: UserInfo,
): Promise<ErpPostResult> {
  try {
    return await poster(batch, summaryLines, contextUser);
  } catch (err) {
    // The message lands in ErrorMessage; log the error itself so its stack is not lost.
    LogError(`sendJournalEntryBatch: poster threw for batch ${batch.JournalEntryBatchNumber ?? batch.ID}`, null, err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** The summary JE's lines — what the ERP receives. */
async function loadSummaryLines(batch: mjBizAppsAccountingJournalEntryBatchEntity, contextUser: UserInfo, p: Providers): Promise<mjBizAppsAccountingJournalEntryLineEntity[]> {
  if (!batch.SummaryJournalEntryID) return [];
  const res = await p.rv.RunView<mjBizAppsAccountingJournalEntryLineEntity>(
    { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${batch.SummaryJournalEntryID}'`, OrderBy: 'LineNumber', ResultType: 'entity_object', BypassCache: true },
    contextUser,
  );
  // Loud on failure: an empty result here would send the ERP an empty journal.
  if (!res.Success) throw new Error(`loadSummaryLines: summary JE lines for batch ${batch.ID} failed to load: ${res.ErrorMessage ?? 'unknown'}`);
  return res.Results ?? [];
}

/**
 * Sent → Posted (the ERP confirmed posting; allowed by 50009) + flip each batched JE Batched→GLPosted.
 * Clears ErrorMessage: on a successful retry it still holds the earlier attempt's failure, and a
 * Posted batch carrying an error reads as a batch that did not post.
 */
async function markBatchPosted(
  batch: mjBizAppsAccountingJournalEntryBatchEntity, externalJournalEntryBatchRef: string | null, contextUser: UserInfo, p: Providers,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  batch.ExternalJournalEntryBatchRef = externalJournalEntryBatchRef;
  batch.PostedAt = new Date();
  batch.ErrorMessage = null;
  batch.Status = 'Posted';
  if (!(await batch.Save())) throw new Error(`sendJournalEntryBatch: Sent→Posted failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  await markJournalEntriesGLPosted(batch, contextUser, p);
  return batch;
}

/**
 * Every Batched JE in the batch's orbit (members + summary) → GLPosted (only GL-roundtrip fields may
 * change on a locked JE). Stamps the BATCH's PostedAt and ERP reference, so an entry finished later
 * by {@link resumeJournalEntryBatchPosting} carries the same values as the ones flipped at dispatch.
 * Selects only what is still Batched, so running it again over a partial flip finishes the rest.
 * Returns how many entries it flipped.
 */
async function markJournalEntriesGLPosted(batch: mjBizAppsAccountingJournalEntryBatchEntity, contextUser: UserInfo, p: Providers): Promise<number> {
  const res = await p.rv.RunView<{ ID: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: `JournalEntryBatchID=${sqlGuid(batch.ID)} AND Status='Batched'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  // Loud on failure: an empty result here would report the flip complete with every entry still Batched.
  if (!res.Success) throw new Error(`markJournalEntriesGLPosted: member scan for batch ${batch.ID} failed: ${res.ErrorMessage ?? 'unknown'}`);
  const rows = res.Results ?? [];
  for (const row of rows) {
    const je = await p.md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, contextUser);
    if (!(await je.Load(row.ID))) throw new Error(`markJournalEntriesGLPosted: JE ${row.ID} not found`);
    je.Status = 'GLPosted';
    je.GLPostedAt = batch.PostedAt ?? new Date();
    if (batch.ExternalJournalEntryBatchRef) je.GLReferenceID = batch.ExternalJournalEntryBatchRef;
    if (!(await je.Save())) throw new Error(`sendJournalEntryBatch: JE ${row.ID} Batched→GLPosted failed: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
  return rows.length;
}

// ─── resumeJournalEntryBatchPosting — finish an incomplete Batched→GLPosted flip ─────────────

/** What a resume did: the batch (still Posted) and how many entries it moved to GLPosted. */
export interface ResumeJournalEntryBatchPostingResult {
  batch: mjBizAppsAccountingJournalEntryBatchEntity;
  journalEntriesPosted: number;
}

/**
 * Finish the member `Batched → GLPosted` flip of a batch the ERP has already accepted (#145, stuck
 * state 2). `markBatchPosted` saves the batch Posted BEFORE it flips the entries — deliberately, since
 * the ERP holds the journal at that point — so a flip that throws partway leaves a Posted batch with
 * some entries still Batched. `Posted` is terminal, and a re-send would duplicate the ERP journal, so
 * this is the only way forward: it makes NO ERP call and only runs the remaining flips.
 *
 * Safe to run on a Posted batch whose flip completed — it finds nothing Batched and returns 0.
 */
export async function resumeJournalEntryBatchPosting(
  batchId: string, contextUser: UserInfo, provider: IMetadataProvider,
): Promise<ResumeJournalEntryBatchPostingResult> {
  const p = resolveProviders(provider);
  const batch = await p.md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`resumeJournalEntryBatchPosting: batch ${batchId} not found`);
  if (batch.Status !== 'Posted') {
    throw new Error(
      `resumeJournalEntryBatchPosting: batch ${batch.JournalEntryBatchNumber ?? batchId} is ${batch.Status}; only a Posted batch has a GL-posting flip to finish` +
      (batch.Status === 'Failed' ? ' — a Failed batch is retried by dispatching it again.' : '.'),
    );
  }
  const journalEntriesPosted = await markJournalEntriesGLPosted(batch, contextUser, p);
  return { batch, journalEntriesPosted };
}

// ─── findStrandedJournalEntries — entries locked in a batch that will not move them on its own ─

/**
 * How a stranded batch is recovered: dispatch it again, or finish its GL-posting flip. A `Retry`
 * batch may instead be cancelled (#183), which releases its entries to the next build — the choice
 * when its content, not the ERP, is what is wrong.
 */
export type StrandedJournalEntryRecovery = 'Retry' | 'ResumePosting';

/**
 * One batch holding journal entries at `Batched` that no scheduled run or build will pick up. Keep in
 * sync with `StrandedJournalEntryBatchWire` in the Angular dispatch client, which duplicates this shape.
 */
export interface StrandedJournalEntryBatch {
  batchId: string;
  batchNumber: string | null;
  batchStatus: 'Failed' | 'Posted';
  /** Member entries still `Batched` — the batch's own summary entry is not counted. */
  journalEntryCount: number;
  recovery: StrandedJournalEntryRecovery;
}

/** The two batch states that hold entries at `Batched` with nothing scheduled to release them. */
const STRANDING_STATUSES: ReadonlyArray<{ status: 'Failed' | 'Posted'; recovery: StrandedJournalEntryRecovery }> = [
  { status: 'Failed', recovery: 'Retry' },
  { status: 'Posted', recovery: 'ResumePosting' },
];

/**
 * Every batch holding member entries at `Batched` that will stay there until someone acts (#145):
 * a `Failed` batch (retry it) and a `Posted` batch with an incomplete flip (resume it). Both are
 * invisible otherwise — a build or scheduled run gathers `Status='Pending'` only, so these entries
 * silently drop out of every sweep, and a Posted batch reads as fully successful.
 *
 * Deliberately excludes `Archived` (entries locked on purpose — that is what archiving means) and
 * `Sent` (in flight: its outcome is Posted or Failed).
 */
export async function findStrandedJournalEntries(contextUser: UserInfo, provider: IMetadataProvider): Promise<StrandedJournalEntryBatch[]> {
  const p = resolveProviders(provider);
  const summaryType = await GetJournalEntryBatchSummaryEntryType(contextUser, p.md);
  const results = await p.rv.RunViews<{ JournalEntryBatchID: string; JournalEntryBatch: string | null }>(
    STRANDING_STATUSES.map(({ status }) => ({
      EntityName: JE_ENTITY,
      ExtraFilter:
        `Status='Batched' AND EntryTypeID<>${sqlGuid(summaryType.ID)} AND JournalEntryBatchID IN ` +
        `(SELECT ID FROM __mj_BizAppsAccounting.JournalEntryBatch WHERE Status='${status}')`,
      Fields: ['JournalEntryBatchID', 'JournalEntryBatch'],
      ResultType: 'simple',
      BypassCache: true,
    })),
    contextUser,
  );
  return STRANDING_STATUSES.flatMap(({ status, recovery }, i) => {
    const res = results[i];
    if (!res?.Success) throw new Error(`findStrandedJournalEntries: ${status} scan failed: ${res?.ErrorMessage ?? 'unknown'}`);
    return groupByBatch(res.Results ?? []).map(g => ({ ...g, batchStatus: status, recovery }));
  });
}

/** Collapse one row per stranded entry into one count per batch. */
function groupByBatch(rows: Array<{ JournalEntryBatchID: string; JournalEntryBatch: string | null }>): Array<Pick<StrandedJournalEntryBatch, 'batchId' | 'batchNumber' | 'journalEntryCount'>> {
  const byBatch = new Map<string, Pick<StrandedJournalEntryBatch, 'batchId' | 'batchNumber' | 'journalEntryCount'>>();
  for (const row of rows) {
    const entry = byBatch.get(row.JournalEntryBatchID) ?? { batchId: row.JournalEntryBatchID, batchNumber: row.JournalEntryBatch, journalEntryCount: 0 };
    entry.journalEntryCount++;
    byBatch.set(row.JournalEntryBatchID, entry);
  }
  return [...byBatch.values()];
}

/** What a batch actually is after a dispatch throw, and whether this call moved it to Failed. */
export interface DispatchFailureRecord { status: string; marked: boolean }

/**
 * Triage a batch whose dispatch THREW, and report what is actually true of it.
 *
 * `sendJournalEntryBatch` converts a poster that returns `{success:false}` or throws into `Failed`
 * itself. Any save inside the send path that THROWS instead leaves the batch wherever it got to, and
 * `Failed` is reachable from exactly ONE of those states: `JournalEntryBatchEntityServer`'s
 * LEGAL_TRANSITIONS allows `Sent → Failed` and neither `Pending → Failed`, `Approved → Failed` nor
 * `Posted → Failed`. Asserting `Failed` from the others is not merely rejected, it is dangerous:
 *
 *   · `Sent`   → mark `Failed` with the cause. Members stay `Batched` for retry triage. The only
 *                state this function writes.
 *   · `Posted` → LEAVE IT. The ERP has already accepted this journal and only the member
 *                `Batched → GLPosted` flip is incomplete. Reporting it as `Failed` would invite a
 *                re-post and a DUPLICATE ERP journal — the worst outcome available here.
 *   · `Pending` / `Approved` → nothing to mark. Either can be cancelled, but `Approved` only by
 *                its approver or the company's CFO with a reason (#183), so it needs a human either
 *                way. Say which it is instead of recording a failure that never happened.
 *
 * Deliberately does NOT route through `failBatch`, so the send path's own semantics are untouched.
 */
export async function recordDispatchFailure(
  batchId: string, error: string, contextUser: UserInfo, provider: IMetadataProvider,
): Promise<DispatchFailureRecord> {
  const p = resolveProviders(provider);
  const batch = await p.md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`recordDispatchFailure: batch ${batchId} not found`);
  if (batch.Status !== 'Sent') return { status: batch.Status, marked: false };

  batch.Status = 'Failed';
  batch.ErrorMessage = error;
  // Check the save. A rejected Save leaves the in-memory field set, so reading `batch.Status` back
  // would report a `Failed` that never reached the database.
  if (!(await batch.Save())) {
    throw new Error(`recordDispatchFailure: marking batch ${batchId} Failed did not save: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
  return { status: 'Failed', marked: true };
}

/** Sent → Failed (allowed by 50009). JEs stay Batched; ErrorMessage records the cause for retry triage. */
async function failBatch(batch: mjBizAppsAccountingJournalEntryBatchEntity, error: string): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  batch.Status = 'Failed';
  batch.ErrorMessage = error;
  if (!(await batch.Save())) {
    // The failure record ITSELF failed to persist — the batch is stuck at 'Sent' in the database
    // with no ErrorMessage. Log loudly (the original ERP error is in `error`) so retry triage can
    // find it; the returned in-memory entity still carries the Failed state for the caller.
    LogError(`sendJournalEntryBatch: could not mark batch ${batch.JournalEntryBatchNumber ?? batch.ID} as Failed (ERP error was: ${error}): ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
  return batch;
}

// ─── Batch preview (the workspace's read-only mirror of the build) ──────────

/** One candidate journal entry in the batch-workspace preview. */
export interface JournalEntryBatchPreviewEntry {
  ID: string;
  EntryNumber: string;
  EffectiveDate: Date;
  /** The JournalEntryType CODE (issue #24 lookup — the UI filter/display vocabulary). */
  EntryTypeCode: string;
  CompanyID: string;
  Description: string | null;
  /** Σ debits on the entry — the money column the preview grid shows. */
  Amount: number;
}

/** One row of the preview's "affected accounts" summary. */
export interface AffectedAccount {
  GLAccountID: string;
  Code: string;
  Name: string;
  CompanyIDs: string[];
  Debit: number;
  Credit: number;
}

export interface JournalEntryBatchPreviewResult {
  /** Candidates matching the criteria, OLDEST-FIRST (the order a build would take them in). */
  Candidates: JournalEntryBatchPreviewEntry[];
  /** The netted summary the included selection would produce. */
  AffectedAccounts: AffectedAccount[];
  TotalDebits: number;
  TotalCredits: number;
  /** Per-company subtotals for the workspace footer (a sweep builds one batch per company, D7). */
  PerCompany: Array<{ CompanyID: string; Debit: number; Credit: number }>;
  /**
   * How many entries OLDER than the newest included one were excluded. >0 means later entries
   * would batch ahead of older ones — allowed, but the workspace must SAY so.
   */
  OutOfOrderSkipCount: number;
}

/**
 * Out-of-order detection — pure, so it is unit-tested rather than inferred from a screenshot.
 * The candidate pool is gathered oldest-first. If the operator excludes an entry OLDER than the
 * newest entry they kept, that older entry gets left behind while a later one batches — the
 * "allowed, but visible" case. Excluding entries from the END of the pool is NOT out-of-order.
 */
export function outOfOrderSkipCount(
  candidatesOldestFirst: Array<{ ID: string }>,
  includedIds: ReadonlySet<string>,
): number {
  let newestIncluded = -1;
  for (let i = 0; i < candidatesOldestFirst.length; i++) {
    if (includedIds.has(candidatesOldestFirst[i].ID)) newestIncluded = i;
  }
  if (newestIncluded < 0) return 0; // nothing included — nothing jumps the queue
  let skipped = 0;
  for (let i = 0; i < newestIncluded; i++) {
    if (!includedIds.has(candidatesOldestFirst[i].ID)) skipped++;
  }
  return skipped;
}

/** Per-company Dr/Cr subtotals over the netted groups — pure. */
export function perCompanySubtotals(groups: NetGroup[]): Array<{ CompanyID: string; Debit: number; Credit: number }> {
  const byCompany = new Map<string, { CompanyID: string; Debit: number; Credit: number }>();
  for (const g of groups) {
    const row = byCompany.get(g.companyId) ?? { CompanyID: g.companyId, Debit: 0, Credit: 0 };
    if (g.side === 'Debit') row.Debit = Math.round((row.Debit + g.net) * 100) / 100;
    else row.Credit = Math.round((row.Credit - g.net) * 100) / 100;
    byCompany.set(g.companyId, row);
  }
  return [...byCompany.values()];
}

/**
 * Preview what a build WOULD produce for the given criteria — read-only, no writes.
 *
 * Powers the batch workspace: the candidate grid, the affected-accounts summary, the live Dr = Cr
 * footer, and the out-of-order warning. Runs the SAME `pendingCandidateFilter`, the same
 * oldest-first order, and the same `NetLines` the build runs, so the preview cannot drift from
 * what the build actually does — a preview computed a different way is a lie waiting to happen.
 * The build then reuses the operator's SELECTION (ids → buildJournalEntryBatchFromExplicitIds), never the
 * computed artifacts: it re-verifies + re-nets inside the write transaction.
 *
 * @param includedIds when supplied, the netted summary reflects only these (the include/exclude
 *   preview). Omit to preview the whole candidate pool.
 */
export async function previewBatch(
  options: BuildJournalEntryBatchOptions,
  contextUser: UserInfo,
  provider: IMetadataProvider,
  includedIds?: ReadonlySet<string>,
): Promise<JournalEntryBatchPreviewResult> {
  const p = resolveProviders(provider);
  const res = await p.rv.RunView<{ ID: string; EntryNumber: string; EffectiveDate: string; EntryTypeID: string; CompanyID: string; Description: string | null }>(
    {
      EntityName: JE_ENTITY,
      ExtraFilter: await pendingCandidateFilter(options, contextUser, p),
      OrderBy: 'EffectiveDate ASC, EntryNumber ASC', // the same oldest-first order the build uses
      Fields: ['ID', 'EntryNumber', 'EffectiveDate', 'EntryTypeID', 'CompanyID', 'Description'],
      ResultType: 'simple',
      BypassCache: true,
    },
    contextUser,
  );
  if (!res.Success) throw new Error(`previewBatch: could not load candidates: ${res.ErrorMessage ?? 'unknown'}`);
  const rows = res.Results ?? [];
  const included = includedIds ?? new Set(rows.map(r => r.ID));
  const includedRows = rows.filter(r => included.has(r.ID));

  // Type CODES for the grid (ID → Code map, one read).
  const typeRes = await p.rv.RunView<{ ID: string; Code: string }>(
    { EntityName: JET_ENTITY, Fields: ['ID', 'Code'], ResultType: 'simple' }, contextUser);
  const codeByTypeId = new Map((typeRes.Results ?? []).map(t => [t.ID.toLowerCase(), t.Code]));

  // Net exactly what a build of the INCLUDED set would net (grouped per company like the build).
  const lines = includedRows.length > 0 ? await loadNettableLinesUnscoped(includedRows.map(r => r.ID), contextUser, p) : [];
  const groups = NetLines(lines);
  const { totalDebits, totalCredits } = summaryTotals(groups);

  // Σ debits per entry — the preview grid's money column.
  const amountByJE = new Map<string, number>();
  if (includedRows.length > 0) {
    const lineRes = await p.rv.RunView<{ JournalEntryID: string; DebitAmount: number | null }>(
      { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID IN (${includedRows.map(r => `'${r.ID}'`).join(',')})`, Fields: ['JournalEntryID', 'DebitAmount'], ResultType: 'simple', BypassCache: true },
      contextUser,
    );
    for (const l of lineRes.Results ?? []) {
      amountByJE.set(l.JournalEntryID, Math.round(((amountByJE.get(l.JournalEntryID) ?? 0) + (l.DebitAmount ?? 0)) * 100) / 100);
    }
  }

  return {
    Candidates: rows.map(r => ({
      ID: r.ID,
      EntryNumber: r.EntryNumber,
      EffectiveDate: new Date(r.EffectiveDate),
      EntryTypeCode: codeByTypeId.get(r.EntryTypeID?.toLowerCase()) ?? '',
      CompanyID: r.CompanyID,
      Description: r.Description,
      Amount: amountByJE.get(r.ID) ?? 0,
    })),
    AffectedAccounts: await summarizeAffectedAccounts(groups, contextUser, p),
    TotalDebits: totalDebits,
    TotalCredits: totalCredits,
    PerCompany: perCompanySubtotals(groups),
    OutOfOrderSkipCount: outOfOrderSkipCount(rows, included),
  };
}

/** Line loading for a MIXED-company id set (preview only — the build stays per company). */
async function loadNettableLinesUnscoped(jeIds: string[], contextUser: UserInfo, p: Providers): Promise<NettableLine[]> {
  const inList = jeIds.map(id => `'${id}'`).join(',');
  const jeRes = await p.rv.RunView<{ ID: string; CompanyID: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: `ID IN (${inList})`, Fields: ['ID', 'CompanyID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const companyByJE = new Map((jeRes.Results ?? []).map(j => [j.ID.toLowerCase(), j.CompanyID]));
  const lineRes = await p.rv.RunView<{ ID: string; JournalEntryID: string; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>(
    { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID IN (${inList})`, Fields: ['ID', 'JournalEntryID', 'GLAccountID', 'DebitAmount', 'CreditAmount'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const lines = lineRes.Results ?? [];
  const dimsByLine = await loadDimensionsByLine(lines.map(l => l.ID), contextUser, p);
  return lines.map(l => ({
    companyId: companyByJE.get(l.JournalEntryID.toLowerCase()) ?? '',
    glAccountId: l.GLAccountID,
    debit: l.DebitAmount ?? 0,
    credit: l.CreditAmount ?? 0,
    dims: dimsByLine.get(l.ID) ?? [],
  }));
}

/** The affected-accounts summary rows (account code/name resolved in one read). */
async function summarizeAffectedAccounts(groups: NetGroup[], contextUser: UserInfo, p: Providers): Promise<AffectedAccount[]> {
  if (groups.length === 0) return [];
  const glIds = [...new Set(groups.map(g => g.glAccountId))];
  const glRes = await p.rv.RunView<{ ID: string; Code: string; Name: string }>(
    { EntityName: GL_ENTITY, ExtraFilter: `ID IN (${glIds.map(id => `'${id}'`).join(',')})`, Fields: ['ID', 'Code', 'Name'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const glById = new Map((glRes.Results ?? []).map(g => [g.ID.toLowerCase(), g]));
  const byAccount = new Map<string, AffectedAccount>();
  for (const g of groups) {
    const key = g.glAccountId.toLowerCase();
    const gl = glById.get(key);
    const row = byAccount.get(key) ?? { GLAccountID: g.glAccountId, Code: gl?.Code ?? '', Name: gl?.Name ?? '', CompanyIDs: [], Debit: 0, Credit: 0 };
    if (!row.CompanyIDs.includes(g.companyId)) row.CompanyIDs.push(g.companyId);
    if (g.side === 'Debit') row.Debit = Math.round((row.Debit + g.net) * 100) / 100;
    else row.Credit = Math.round((row.Credit - g.net) * 100) / 100;
    byAccount.set(key, row);
  }
  return [...byAccount.values()];
}
