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
 *     Content is frozen from here (trg_JournalEntryBatch_Immutability, 50009).
 *   sendJournalEntryBatch(): require approval (gate seam + Status='Approved'), flip Approved→Sent,
 *     post the summary JE's lines to the ERP (all-or-nothing per batch), and on
 *     confirmation flip Sent→Posted + the member JEs AND the summary JE Batched→GLPosted.
 *     Failure → Failed (retry + escalating alerts).
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
import { DatabaseProviderBase, IMetadataProvider, IRunViewProvider, UserInfo } from '@memberjunction/core';
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
import { UUIDsEqual } from '@memberjunction/global';
import { JournalEntryEntityServer } from './JournalEntryEntityServer.js';
import { JournalEntryBatchEntityServer } from './JournalEntryBatchEntityServer.js';
import { GetJournalEntryBatchSummaryEntryType } from './JournalEntryTypes.js';
import { sqlGuidLiteral } from './sqlLiteral.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';
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
      // companyId reaches the Standard build path from client input (input.CompanyID) — validate it as
      // a UUID before concatenation so it cannot inject predicates into the candidate query.
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

/** Today as a date-only value, UTC (repo convention). PostingDate selection is a UI-port item. */
function todayUTC(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

async function createBatchHeader(
  companyId: string, targetSystem: JournalEntryBatchTargetSystem, batchedByUserId: string, jeCount: number, contextUser: UserInfo, p: Providers,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const batch = await p.md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  batch.NewRecord();
  batch.CompanyID = companyId;
  batch.PostingDate = todayUTC();
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

// ─── cancelJournalEntryBatch / regenerateJournalEntryBatch — reverse a PRELIMINARY (unapproved) lock ──

/**
 * Reverse an unapproved (Pending) batch: return its member journal entries to the candidate pool,
 * delete its JournalEntryBatchSummary JE, and mark it Cancelled. Valid ONLY while Status='Pending' (approval
 * makes the lock permanent — plan §7.3).
 */
export async function cancelJournalEntryBatch(
  batchId: string, contextUser: UserInfo, provider: IMetadataProvider,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  // Cancel is single-aggregate work (the batch reversing ITS OWN preliminary lock), so the logic
  // lives on the entity (JournalEntryBatchEntityServer.Cancel — one transaction, encapsulated);
  // this engine function is retained as the stable call-site for the ops/resolver era callers.
  const p = resolveProviders(provider);
  const batch = await p.md.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`cancelJournalEntryBatch: batch ${batchId} not found`);
  await batch.Cancel(contextUser);
  return batch;
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
  // Separation of duties: the user who built the batch (BatchedByUserID) may never also approve it —
  // even if they are the configured CFO. The CFO-identity check lives in the gate; this is the
  // independent SoD backstop enforced on every approval path into the engine.
  if (batch.BatchedByUserID && UUIDsEqual(approvedByUserId, batch.BatchedByUserID)) {
    throw new Error(`approveJournalEntryBatch: separation-of-duties violation — the batch creator cannot approve their own batch ${batchId}.`);
  }
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
  /** The provider for this call — injected by the caller (required; no global fallback). */
  provider: IMetadataProvider;
}

/**
 * Send an APPROVED batch to the ERP. Requires the approval gate + Status='Approved'; then
 * Approved→Sent, posts the summary JE's lines to the ERP (all-or-nothing), and on confirmation
 * flips Sent→Posted + the member JEs AND the summary JE Batched→GLPosted.
 */
export async function sendJournalEntryBatch(batchId: string, contextUser: UserInfo, options: SendJournalEntryBatchOptions): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const p = resolveProviders(options.provider);
  const poster = options.poster ?? mockErpPoster;
  const batch = await p.md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`sendJournalEntryBatch: batch ${batchId} not found`);
  if (batch.Status !== 'Approved') throw new Error(`sendJournalEntryBatch: batch ${batchId} is ${batch.Status}, only an Approved batch can be sent`);

  await options.gate.assertApproved(batchId, contextUser); // throws if not CFO-approved

  batch.Status = 'Sent';
  batch.SentAt = new Date();
  if (!(await batch.Save())) throw new Error(`sendJournalEntryBatch: Approved→Sent failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);

  const summaryLines = await loadSummaryLines(batch, contextUser, p);
  const postResult = await poster(batch, summaryLines, contextUser);
  return postResult.success
    ? await markBatchPosted(batch, postResult.externalJournalEntryBatchRef ?? null, contextUser, p)
    : await failBatch(batch, postResult.error ?? 'ERP post failed');
}

/** The summary JE's lines — what the ERP receives. */
async function loadSummaryLines(batch: mjBizAppsAccountingJournalEntryBatchEntity, contextUser: UserInfo, p: Providers): Promise<mjBizAppsAccountingJournalEntryLineEntity[]> {
  if (!batch.SummaryJournalEntryID) return [];
  const res = await p.rv.RunView<mjBizAppsAccountingJournalEntryLineEntity>(
    { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${batch.SummaryJournalEntryID}'`, OrderBy: 'LineNumber', ResultType: 'entity_object', BypassCache: true },
    contextUser,
  );
  return res.Success ? res.Results : [];
}

/** Sent → Posted (the ERP confirmed posting; allowed by 50009) + flip each batched JE Batched→GLPosted. */
async function markBatchPosted(
  batch: mjBizAppsAccountingJournalEntryBatchEntity, externalJournalEntryBatchRef: string | null, contextUser: UserInfo, p: Providers,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  batch.ExternalJournalEntryBatchRef = externalJournalEntryBatchRef;
  batch.PostedAt = new Date();
  batch.Status = 'Posted';
  if (!(await batch.Save())) throw new Error(`sendJournalEntryBatch: Sent→Posted failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  await markJournalEntriesGLPosted(batch.ID, externalJournalEntryBatchRef, contextUser, p);
  return batch;
}

/** Every Batched JE in the batch's orbit (members + summary) → GLPosted (only GL-roundtrip fields may change on a locked JE). */
async function markJournalEntriesGLPosted(batchId: string, externalJournalEntryBatchRef: string | null, contextUser: UserInfo, p: Providers): Promise<void> {
  const res = await p.rv.RunView<{ ID: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: `JournalEntryBatchID='${batchId}' AND Status='Batched'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  for (const row of res.Results ?? []) {
    const je = await p.md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, contextUser);
    await je.Load(row.ID);
    je.Status = 'GLPosted';
    je.GLPostedAt = new Date();
    if (externalJournalEntryBatchRef) je.GLReferenceID = externalJournalEntryBatchRef;
    if (!(await je.Save())) throw new Error(`sendJournalEntryBatch: JE ${row.ID} Batched→GLPosted failed: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
}

/** Sent → Failed (allowed by 50009). JEs stay Batched; ErrorMessage records the cause for retry triage. */
async function failBatch(batch: mjBizAppsAccountingJournalEntryBatchEntity, error: string): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  batch.Status = 'Failed';
  batch.ErrorMessage = error;
  await batch.Save();
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
