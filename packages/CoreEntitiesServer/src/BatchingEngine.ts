/**
 * BatchingEngine — Block 2 headline (S1 dispatch). The core subledger→ERP process.
 * REWORKED 2026-07-06 for the engine-meeting rulings (CH-3/CH-4/AM-4): batches are MULTI-COMPANY.
 *
 *   buildBatch(): gather ALL Pending JEs → ONE JournalEntryBatch (no company/period scope — an order's
 *     JEs land in exactly one batch, ¶44), build the consolidated SUMMARY lines (one per
 *     Company × GLAccount × Dimension-combo — company comes from each line's GLAccount.CompanyID —
 *     Dr/Cr **netted** to one side per §C5), resolve each line's ERP account NUMBER (AM-4 wire format:
 *     ChartOfAccountsMapping override → GLAccount.ExternalAccountID → GLAccount.Code), set the balanced
 *     control totals, **lock** the JEs to Batched, and raise the approval task.
 *   approveBatch(): the human sign-off — Pending→Approved (+ApprovedAt/ApprovedByUserID). Content is
 *     frozen from here (trg_JEBatch_Immutability).
 *   sendBatch(): require approval (gate seam + Status='Approved'), flip Approved→Sent —
 *     trg_JEBatch_SummaryReconciles (50014 overall + 50023 PER COMPANY, AM-4) verifies the summary
 *     foots — post to the ERP (the poster splits by company: ONE summary JE per company, all-or-nothing,
 *     ¶151-153), and on confirmation flip Sent→Posted + the JEs Batched→GLPosted. Failure → Failed
 *     (retry + escalating alerts).
 *
 * ⚠ OQ-F (Robert): whether the flat per-line CompanyID grouping suffices or a batch-group element is
 *   needed. Current shape = flat line items carrying CompanyID; the per-company split happens at send.
 *
 * The detail (JournalEntryLine) stays in the subledger for drill-through; the netted summary is what BC sees.
 *
 * SECURITY MODEL:
 *   - **Financial invariants are DB triggers — un-bypassable even by raw SQL / SA:** the summary must foot
 *     to the control totals overall (50014) AND within each company (50023), an Approved/Sent/Posted batch
 *     is immutable (50008/50009), and JEs must balance overall (50001) + per company (50019) to lock.
 *   - **The CFO approval is a WORKFLOW gate, not a financial invariant** — enforced in the engine via a
 *     pluggable BatchApprovalGate (default backed by the bizapps-tasks app).
 *
 * CONNECTS TO:
 *   READS/WRITES: Journal Entries (lock) · Journal Entry Lines (+ Dimensions) · Journal Entry Batches
 *                 · Journal Entry Batch Line Items (+ Dimensions) · GL Accounts · ChartOfAccountsMapping
 *   DB TRIGGERS:  trg_JEBatch_SummaryReconciles (50014/50023) · trg_JEBatch_Immutability (50008/50009)
 *                 · trg_JournalEntry_Immutability (lock) · balanced-on-lock (50001/50019)
 *   ENTITY:       'MJ_BizApps_Accounting: Journal Entry Batches'
 *   DOC:          docs/ARCHITECTURE.md (batching) · plan §C5 (netting) · accounting-engine-plan.md §4.7
 */
import { Metadata, RunView, UserInfo, LogError, type IMetadataProvider } from '@memberjunction/core';
import type {
  mjBizAppsAccountingJournalEntryBatchEntity,
  mjBizAppsAccountingJournalEntryBatchLineItemEntity,
  mjBizAppsAccountingJournalEntryBatchLineDimensionEntity,
  mjBizAppsAccountingJournalEntryEntity,
} from '@mj-biz-apps/accounting-entities';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JEBLI_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batch Line Items';
const JEBLD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batch Line Dimensions';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const COA_MAP_ENTITY = 'MJ_BizApps_Accounting: Chart Of Accounts Mappings';

/** Cent-level tolerance — amounts are decimal(18,2), so anything under half a cent is "zero". */
const NET_TOLERANCE = 0.005;

/** The ERP targets the schema's CK_JournalEntryBatch_TargetSystem accepts. */
export type BatchTargetSystem = 'BusinessCentral' | 'NetSuite' | 'Other' | 'QuickBooks' | 'Sage' | 'Xero';

export interface DimRef { DimensionID: string; DimensionValueID: string }

/** Pure netting input: one JE line, dimension-tagged. Company = the line's GLAccount.CompanyID (CH-2). */
export interface NettableLine { companyId: string; glAccountId: string; debit: number; credit: number; dims: DimRef[] }

/** Pure netting output: one consolidated summary group (Dr/Cr collapsed to a single side). */
export interface NetGroup {
  companyId: string;
  glAccountId: string;
  dims: DimRef[];
  dimKey: string;
  /** signed net = Σdebits − Σcredits; >0 → debit side, <0 → credit side. */
  net: number;
  side: 'Debit' | 'Credit';
  sourceLineCount: number;
}

export interface BuildBatchResult {
  batchId: string;
  summaryLineCount: number;
  totalDebits: number;
  totalCredits: number;
  jeCount: number;
  companyCount: number;
  /**
   * MOD-14: did the SEPARATE approval-task transaction succeed? The batch is committed and valid
   * either way — `false` means the batch carries no ApprovalTaskID yet and needs a retry, NOT that
   * the build failed. Callers surface it; they must not treat it as an error.
   */
  approvalTaskRaised: boolean;
}

export interface ErpPostResult { success: boolean; externalBatchRef?: string; error?: string }

/** ERP-post seam. The REAL poster must split the summary lines BY COMPANY and post one summary JE per
 *  company, by account NUMBER, all-or-nothing per batch (AM-4, ¶151-153). This mock lets the whole
 *  dispatch flow run + be tested without a live BC tenant. */
export type ErpPoster = (
  batch: mjBizAppsAccountingJournalEntryBatchEntity,
  lines: mjBizAppsAccountingJournalEntryBatchLineItemEntity[],
  contextUser: UserInfo,
) => Promise<ErpPostResult>;

export const mockErpPoster: ErpPoster = async (batch) => ({
  success: true,
  externalBatchRef: `MOCK-${batch.BatchNumber}`,
});

/** CFO-approval workflow gate. `assertApproved` throws when the batch hasn't been approved to send. */
export interface BatchApprovalGate {
  /**
   * Raise the approval task for a freshly-built batch and RETURN ITS ID.
   *
   * MOD-14: the id is what the accounting-owned task transaction stamps onto
   * `JournalEntryBatch.ApprovalTaskID`, so "does this batch have a task?" is a column check rather
   * than a cross-schema join through Task Links. Return null if the gate raises no task.
   *
   * Contract note: throwing here NO LONGER cancels the batch — the batch is already committed by
   * then. A throw is logged and leaves ApprovalTaskID NULL (retryable).
   */
  onBatchBuilt?(batchId: string, contextUser: UserInfo): Promise<string | null>;
  assertApproved(batchId: string, contextUser: UserInfo): Promise<void>;
}

/** Test/seed gate — always approved. Real deployments use the bizapps-tasks-backed gate. */
export const AutoApproveGate: BatchApprovalGate = { async assertApproved() { /* always approved */ } };

// ─── Pure netting (unit-tested without a DB) ─────────────────────────────────

/**
 * Collapse JE lines to consolidated summary groups: one per (Company × GLAccount × dimension-combo), with
 * debits netted against credits to a single side. Groups that net to ~zero drop out. No I/O — pure + deterministic.
 */
export function netLines(lines: NettableLine[]): NetGroup[] {
  const map = new Map<string, { companyId: string; glAccountId: string; dims: DimRef[]; dimKey: string; debit: number; credit: number; sourceLineCount: number }>();
  for (const line of lines) {
    const dims = [...line.dims].sort((a, b) => a.DimensionID.localeCompare(b.DimensionID));
    const dimKey = dims.map(d => `${d.DimensionID}:${d.DimensionValueID}`).join('|');
    const key = `${line.companyId}#${line.glAccountId}#${dimKey}`;
    let g = map.get(key);
    if (!g) { g = { companyId: line.companyId, glAccountId: line.glAccountId, dims, dimKey, debit: 0, credit: 0, sourceLineCount: 0 }; map.set(key, g); }
    g.debit += line.debit;
    g.credit += line.credit;
    g.sourceLineCount += 1;
  }
  const groups: NetGroup[] = [];
  for (const g of map.values()) {
    const net = Math.round((g.debit - g.credit) * 100) / 100;
    if (Math.abs(net) <= NET_TOLERANCE) continue; // nets to zero — no summary line
    groups.push({ companyId: g.companyId, glAccountId: g.glAccountId, dims: g.dims, dimKey: g.dimKey, net, side: net > 0 ? 'Debit' : 'Credit', sourceLineCount: g.sourceLineCount });
  }
  return groups;
}

// ─── buildBatch ──────────────────────────────────────────────────────────────

/**
 * Build a Pending MULTI-COMPANY batch from ALL Pending JEs: netted per-company summary lines + locked JEs
 * + approval task. Returns null when there is nothing to batch.
 */
export async function buildBatch(
  targetSystem: BatchTargetSystem,
  batchedByUserId: string,
  contextUser: UserInfo,
  gate: BatchApprovalGate = AutoApproveGate,
  options: BuildBatchOptions = {},
  provider: IMetadataProvider = Metadata.Provider,
): Promise<BuildBatchResult | null> {
  const jeIds = await loadPendingJEIds(contextUser, options);
  return buildBatchFromIds(jeIds, targetSystem, batchedByUserId, contextUser, gate, provider);
}

/**
 * Build from an EXPLICIT, caller-vetted set of JE ids — the §8.2 Batch-workspace include/exclude
 * path (the operator un-ticks entries in the preview and builds exactly what is left).
 *
 * The ids are re-validated as Pending here rather than trusted: the preview is a snapshot, and an
 * entry can be batched by someone else between preview and build. Anything no longer Pending is a
 * LOUD reject — never a silent drop — mirroring buildBatchFromView's posture (B1.2).
 */
export async function buildBatchFromExplicitIds(
  jeIds: string[],
  targetSystem: BatchTargetSystem,
  batchedByUserId: string,
  contextUser: UserInfo,
  gate: BatchApprovalGate = AutoApproveGate,
  provider: IMetadataProvider = Metadata.Provider,
): Promise<BuildBatchResult | null> {
  if (jeIds.length === 0) return null;
  const stale = await findNonPending(jeIds, contextUser);
  if (stale.length > 0) {
    throw new BatchFromViewError(
      `buildBatchFromExplicitIds: ${stale.length} selected entr${stale.length === 1 ? 'y is' : 'ies are'} no longer Pending ` +
      `(batched or posted since the preview): ${stale.join(', ')}. Refresh the preview and rebuild.`,
    );
  }
  return buildBatchFromIds(jeIds, targetSystem, batchedByUserId, contextUser, gate, provider);
}

/** The subset of `jeIds` that is no longer Pending (or no longer exists). */
async function findNonPending(jeIds: string[], contextUser: UserInfo): Promise<string[]> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string; Status: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: `ID IN (${jeIds.map(sqlGuid).join(',')})`, Fields: ['ID', 'Status'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  if (!res.Success) throw new Error(`buildBatchFromExplicitIds: could not validate the selection: ${res.ErrorMessage ?? 'unknown'}`);
  const byId = new Map((res.Results ?? []).map(r => [r.ID.toLowerCase(), r.Status]));
  return jeIds.filter(id => byId.get(id.toLowerCase()) !== 'Pending');
}

/**
 * Build a batch from a SPECIFIC (already-vetted) set of Pending JE IDs — the shared core of the
 * oldest-forward buildBatch (B1.1) and the view-driven buildBatchFromView (B1.2). Returns null when
 * the set is empty or nets to zero.
 */
async function buildBatchFromIds(
  jeIds: string[],
  targetSystem: BatchTargetSystem,
  batchedByUserId: string,
  contextUser: UserInfo,
  gate: BatchApprovalGate,
  provider: IMetadataProvider = Metadata.Provider,
): Promise<BuildBatchResult | null> {
  if (jeIds.length === 0) return null;
  const groups = netLines(await loadNettableLines(jeIds, contextUser));
  if (groups.length === 0) return null; // everything netted to zero

  // ── Reads + pure work FIRST, outside the transaction ───────────────────────
  // resolveExternalAccount hits the DB per group; doing it inside the TransactionGroup would hold
  // the transaction open across N round-trips for no reason. Totals are pure — computing them here
  // is what lets the header carry its control totals on the FIRST write (the old code saved the
  // header, wrote lines, then saved the header AGAIN just to set totals).
  const externalAccounts = await resolveExternalAccounts(groups, targetSystem, contextUser);
  const { totalDebits, totalCredits } = computeControlTotals(groups);

  // ── ONE transaction: header + summary lines + dimensions + JE locks ────────
  // MOD-14 (Marcelo 2026-07-16). Previously these were ~12 sequential Save()s with no transaction:
  // a failure partway left a batch header, summary lines, control totals, and only SOME of the JEs
  // locked to it — a half-built batch. Now it is all-or-none.
  const tg = await provider.CreateTransactionGroup();

  const batch = await queueBatchHeader(
    { targetSystem, batchedByUserId, jeCount: jeIds.length, totalDebits, totalCredits },
    tg, contextUser, provider,
  );
  await queueSummaryLines(batch.ID, groups, externalAccounts, tg, contextUser, provider);
  await queueJournalEntryLocks(jeIds, batch.ID, tg, contextUser, provider);

  if (!(await tg.Submit())) {
    const detail = batch.LatestResult?.CompleteMessage ?? 'transaction group rolled back';
    LogError(`buildBatch: atomic batch write rolled back: ${detail}`);
    throw new Error(`buildBatch: atomic batch write rolled back: ${detail}`);
  }

  // ── SEPARATE transaction: raise the approval task + stamp the pointer ──────
  // MOD-14: batch creation is NOT gated on task success. A failure here leaves a VALID, committed
  // batch with ApprovalTaskID = NULL — a detectable, retryable state — instead of destroying it
  // (the old raiseApprovalTaskOrReverse cancelled the whole batch). See Q28.
  const approvalTaskRaised = await raiseApprovalTaskAndStamp(batch.ID, gate, contextUser, provider);

  const companyCount = new Set(groups.map(g => g.companyId)).size;
  return {
    batchId: batch.ID, summaryLineCount: groups.length, totalDebits, totalCredits,
    jeCount: jeIds.length, companyCount, approvalTaskRaised,
  };
}

/** Net debits/credits across the groups — pure, so the header can carry totals on its first write. */
export function computeControlTotals(groups: NetGroup[]): { totalDebits: number; totalCredits: number } {
  let totalDebits = 0, totalCredits = 0;
  for (const g of groups) {
    if (g.side === 'Debit') totalDebits += g.net;
    else totalCredits += -g.net;
  }
  return { totalDebits: Math.round(totalDebits * 100) / 100, totalCredits: Math.round(totalCredits * 100) / 100 };
}

/** Resolve every group's ERP account up front (reads), keyed by group index. */
async function resolveExternalAccounts(
  groups: NetGroup[], targetSystem: BatchTargetSystem, contextUser: UserInfo,
): Promise<string[]> {
  const out: string[] = [];
  for (const g of groups) out.push(await resolveExternalAccount(g.glAccountId, g.companyId, targetSystem, contextUser));
  return out;
}

/** Raised by buildBatchFromView when the view contains entries that cannot be batched (loud reject). */
export class BatchFromViewError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'BatchFromViewError';
  }
}

export interface BuildBatchFromViewOptions extends BuildBatchOptions {
  /** Default TRUE — a GLPosted entry in the view is excluded (overlap-safe). When false, it's a loud reject. */
  excludePosted?: boolean;
  /** Default TRUE — an already-Batched/locked entry in the view is excluded. When false, it's a loud reject. */
  excludeLocked?: boolean;
}

/**
 * Batch-from-VIEW (B1.2, MOD-8 · Marcelo Q-d, SNAPSHOT model): resolve an MJ User View of Journal
 * Entries to a concrete JE-ID snapshot, then classify each. Pending entries are batchable; GLPosted
 * ("posted") and Batched ("locked") entries are EXCLUDED by default (the default-on toggles let an
 * accountant deliberately allow time-frame overlap without re-grabbing settled entries). Toggling a
 * filter OFF turns a matching entry into a LOUD REJECT (BatchFromViewError names the offenders) —
 * never a silent drop; excluded entries are logged. The snapshot is fixed at build time (re-resolve
 * is a separate, permissioned action, never automatic).
 */
export async function buildBatchFromView(
  viewId: string,
  targetSystem: BatchTargetSystem,
  batchedByUserId: string,
  contextUser: UserInfo,
  gate: BatchApprovalGate = AutoApproveGate,
  options: BuildBatchFromViewOptions = {},
): Promise<BuildBatchResult | null> {
  const rows = await resolveViewJEStatuses(viewId, contextUser);
  const { pending, rejected, excluded } = classifyViewEntries(rows, options);
  if (rejected.length > 0) {
    throw new BatchFromViewError(
      `Batch-from-view: ${rejected.length} entr${rejected.length === 1 ? 'y is' : 'ies are'} not batchable: ${rejected.join(', ')}. ` +
        `Adjust the view or enable the exclude-posted/exclude-locked filters to allow overlap.`,
    );
  }
  if (excluded.length > 0) {
    console.warn(`buildBatchFromView: excluded ${excluded.length} non-Pending entr${excluded.length === 1 ? 'y' : 'ies'} (overlap-safe): ${excluded.join(', ')}`);
  }
  const inWindow = options.cutoff || options.startDate ? await filterIdsByWindow(pending, options, contextUser) : pending;
  return buildBatchFromIds(inWindow, targetSystem, batchedByUserId, contextUser, gate);
}

/**
 * PURE classification of a view's JE rows (B1.2 · Marcelo Q-d): Pending → batchable; GLPosted/Batched
 * → excluded when the (default-on) filter allows overlap, else a loud reject; any other status → always
 * reject. Deterministic + no I/O so it is unit-testable without a live view.
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

/** Resolve a saved User View to its JE rows (ID + Status snapshot). */
async function resolveViewJEStatuses(viewId: string, contextUser: UserInfo): Promise<Array<{ ID: string; Status: string }>> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string; Status: string }>({ ViewID: viewId, Fields: ['ID', 'Status'], ResultType: 'simple', BypassCache: true }, contextUser);
  if (!res.Success) throw new BatchFromViewError(`Batch-from-view: could not resolve view ${viewId}: ${res.ErrorMessage ?? 'unknown'}`);
  return res.Results ?? [];
}

/** Narrow a snapshot of Pending IDs to the date window (shares the B1.1 cutoff semantics). */
async function filterIdsByWindow(jeIds: string[], options: BuildBatchOptions, contextUser: UserInfo): Promise<string[]> {
  if (jeIds.length === 0) return jeIds;
  const inList = jeIds.map(id => `'${id}'`).join(',');
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: `ID IN (${inList}) AND ${pendingCandidateFilter(options)}`, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  return (res.Results ?? []).map(r => r.ID);
}

/**
 * TRANSACTION 2 (MOD-14) — raise the CFO approval Task AND stamp the batch pointer, together.
 *
 * Marcelo's ruling (2026-07-16): the task-raise is a SEPARATE action in its OWN transaction, and
 * **batch creation is NOT gated on it**. The old `raiseApprovalTaskOrReverse` did the opposite — it
 * called `cancelBatch()` and rethrew, destroying a perfectly valid batch because a downstream tasks
 * app hiccuped.
 *
 * The stamp and the Task commit atomically WITH EACH OTHER, so `ApprovalTaskID` can never point at a
 * Task that does not exist, nor a Task exist unpointed. When this fails, the batch stands and
 * `ApprovalTaskID IS NULL` — the detectable, retryable state the column exists for (Q28.1: retry is
 * manual + visible for now).
 *
 * Accounting owns this transaction because bizapps-tasks is a dependency OF accounting.
 *
 * @returns true when a task was raised + stamped; false when it failed (batch still valid) or when
 *          the gate raises no task at all (e.g. AutoApproveGate in tests/seeds).
 */
async function raiseApprovalTaskAndStamp(
  batchId: string,
  gate: BatchApprovalGate,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<boolean> {
  if (!gate.onBatchBuilt) return false; // no task to raise (AutoApproveGate) — not a failure

  try {
    const taskId = await gate.onBatchBuilt(batchId, contextUser);
    // A gate that raises a task but cannot tell us its id leaves nothing to stamp. Report rather
    // than throw: the batch is valid, and this is exactly the retryable state.
    if (!taskId) {
      LogError(`buildBatch: approval task raised for batch ${batchId} but the gate returned no task id — batch left unstamped (retryable).`);
      return false;
    }

    const batch = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
    if (!(await batch.Load(batchId))) throw new Error(`batch ${batchId} not found while stamping the approval task`);
    batch.ApprovalTaskID = taskId;
    batch.ApprovalTaskRaisedAt = new Date();
    if (!(await batch.Save())) throw new Error(batch.LatestResult?.CompleteMessage ?? 'stamp save failed');
    return true;
  } catch (e) {
    // Deliberately swallowed: MOD-14 — the batch is committed and valid; a task failure must not
    // fail the build. Loud in the log, visible as ApprovalTaskID IS NULL, retryable.
    const detail = e instanceof Error ? e.message : String(e);
    LogError(`buildBatch: approval-task transaction failed for batch ${batchId} (batch is VALID and committed; ApprovalTaskID left NULL for retry): ${detail}`);
    return false;
  }
}

/**
 * Options for the OLDEST-FORWARD cutoff batching (B1.1, MOD-8). The candidate pool is always
 * Status='Pending' (which inherently excludes GLPosted + already-Batched/locked entries), gathered
 * oldest-first; `cutoff` restricts to entries on/before a date so an operator can batch "everything
 * up to the end of the month". Overlapping windows are safe because a batched entry leaves the
 * Pending pool. See B1.2 (buildBatchFromView) for the view-driven variant.
 */
export interface BuildBatchOptions {
  /** Upper bound. A DATE-only cutoff (midnight UTC) is INCLUSIVE of that whole day
   *  (EffectiveDate < cutoff + 1 day); a datetime cutoff is exact (EffectiveDate <= cutoff). */
  cutoff?: Date | null;
  /** Optional lower bound (EffectiveDate >= startDate); omit for the standard oldest-forward flow. */
  startDate?: Date | null;
  /**
   * Restrict the candidate pool to these companies. Omit/empty = ALL companies (the GLOBAL sweep of
   * CH-4 — batches are multi-company by design). Added for the §8.2 Batch-workspace criteria panel.
   *
   * NOTE this narrows the CANDIDATE POOL only; it does not change the per-company netting or the
   * per-company balance invariant (50019/50023), which still apply to whatever is selected.
   */
  companyIds?: string[] | null;
  /**
   * Restrict the candidate pool to these `JournalEntry.EntryType` values. Omit/empty = all types.
   * Typed as `string[]` rather than the generated union because the caller is a UI filter fed from
   * entity metadata (the CHECK-derived value list), not a compile-time literal.
   */
  entryTypes?: string[] | null;
}

/** Candidate = every unbatched Pending JE within the date window, oldest-first (B1.1). */
async function loadPendingJEIds(contextUser: UserInfo, options: BuildBatchOptions = {}): Promise<string[]> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string }>(
    {
      EntityName: JE_ENTITY,
      ExtraFilter: pendingCandidateFilter(options),
      OrderBy: 'EffectiveDate ASC, EntryNumber ASC',
      Fields: ['ID'],
      ResultType: 'simple',
      BypassCache: true,
    },
    contextUser,
  );
  return (res.Results ?? []).map(r => r.ID);
}

/** Build the `Status='Pending'` + date-window + scope ExtraFilter (inclusive date-only cutoff per MOD-8). */
export function pendingCandidateFilter(options: BuildBatchOptions): string {
  const clauses = [`Status='Pending'`];
  if (options.startDate) clauses.push(`EffectiveDate >= '${isoDate(options.startDate)}'`);
  if (options.cutoff) {
    if (isMidnightUTC(options.cutoff)) {
      clauses.push(`EffectiveDate < '${isoDate(addDaysUTC(options.cutoff, 1))}'`); // inclusive whole day
    } else {
      clauses.push(`EffectiveDate <= '${options.cutoff.toISOString()}'`); // exact datetime
    }
  }
  // Scope narrowing (§8.2 criteria panel). Empty/omitted means NO clause — i.e. all companies /
  // all types — never `IN ()`, which is a SQL syntax error AND would silently mean "nothing".
  if (options.companyIds?.length) {
    clauses.push(`CompanyID IN (${options.companyIds.map(sqlGuid).join(',')})`);
  }
  if (options.entryTypes?.length) {
    clauses.push(`EntryType IN (${options.entryTypes.map(sqlText).join(',')})`);
  }
  return clauses.join(' AND ');
}

/**
 * A GUID literal, validated rather than escaped: these ids reach us from a UI filter, and this string
 * is concatenated into a SQL predicate. Anything that is not a plain UUID is rejected outright —
 * there is no legitimate value that needs escaping here, so refusing is safer than quoting.
 */
function sqlGuid(id: string): string {
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) throw new Error(`buildBatch: invalid company id in criteria: ${id}`);
  return `'${id}'`;
}

/** A quoted T-SQL string literal (single quotes doubled) for value-list members like EntryType. */
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

async function loadNettableLines(jeIds: string[], contextUser: UserInfo): Promise<NettableLine[]> {
  const rv = new RunView();
  const inList = jeIds.map(id => `'${id}'`).join(',');
  const lineRes = await rv.RunView<{ ID: string; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>(
    { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID IN (${inList})`, Fields: ['ID', 'GLAccountID', 'DebitAmount', 'CreditAmount'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const lines = lineRes.Results ?? [];
  const [dimsByLine, companyByGL] = await Promise.all([
    loadDimensionsByLine(lines.map(l => l.ID), contextUser),
    loadCompanyByGLAccount([...new Set(lines.map(l => l.GLAccountID))], contextUser),
  ]);
  return lines.map(l => {
    const companyId = companyByGL.get(l.GLAccountID);
    if (!companyId) throw new Error(`buildBatch: GL account ${l.GLAccountID} not found while resolving line companies`);
    return { companyId, glAccountId: l.GLAccountID, debit: l.DebitAmount ?? 0, credit: l.CreditAmount ?? 0, dims: dimsByLine.get(l.ID) ?? [] };
  });
}

/**
 * Queue the batch header onto the transaction group. Carries its control totals on the FIRST write —
 * the old code saved the header, wrote the lines, then saved the header a SECOND time just to set
 * totals. Totals are pure (computeControlTotals), so that round-trip was never necessary.
 */
async function queueBatchHeader(
  h: { targetSystem: BatchTargetSystem; batchedByUserId: string; jeCount: number; totalDebits: number; totalCredits: number },
  tg: Awaited<ReturnType<IMetadataProvider['CreateTransactionGroup']>>,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const batch = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  batch.NewRecord();
  batch.TargetSystem = h.targetSystem;
  batch.BatchedAt = new Date();
  batch.BatchedByUserID = h.batchedByUserId;
  batch.Status = 'Pending';
  batch.TotalEntries = h.jeCount;
  batch.TotalDebits = h.totalDebits;
  batch.TotalCredits = h.totalCredits;
  batch.TransactionGroup = tg;
  // With a TransactionGroup, Save() QUEUES the row (it does not commit) and batch.ID is available
  // immediately — which is what lets the summary lines + JE locks below chain their FKs to it.
  if (!(await batch.Save())) throw new Error(`buildBatch: batch header failed to queue: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  return batch;
}

async function loadDimensionsByLine(lineIds: string[], contextUser: UserInfo): Promise<Map<string, DimRef[]>> {
  const byLine = new Map<string, DimRef[]>();
  if (lineIds.length === 0) return byLine;
  const rv = new RunView();
  const inList = lineIds.map(id => `'${id}'`).join(',');
  const res = await rv.RunView<{ JournalEntryLineID: string; DimensionID: string; DimensionValueID: string }>(
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

/** A line's company is implicit via its GLAccount.CompanyID (CH-2 — JEs have no header company). */
async function loadCompanyByGLAccount(glAccountIds: string[], contextUser: UserInfo): Promise<Map<string, string>> {
  const byGL = new Map<string, string>();
  if (glAccountIds.length === 0) return byGL;
  const rv = new RunView();
  const inList = glAccountIds.map(id => `'${id}'`).join(',');
  const res = await rv.RunView<{ ID: string; CompanyID: string }>(
    { EntityName: GL_ENTITY, ExtraFilter: `ID IN (${inList})`, Fields: ['ID', 'CompanyID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  for (const g of res.Results ?? []) byGL.set(g.ID, g.CompanyID);
  return byGL;
}

/** Queue one netted JournalEntryBatchLineItem (+ its dimension tags) per group onto the transaction. */
async function queueSummaryLines(
  batchId: string,
  groups: NetGroup[],
  externalAccounts: string[],
  tg: Awaited<ReturnType<IMetadataProvider['CreateTransactionGroup']>>,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<void> {
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const li = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryBatchLineItemEntity>(JEBLI_ENTITY, contextUser);
    li.NewRecord();
    li.BatchID = batchId;
    li.CompanyID = g.companyId;
    li.GLAccountID = g.glAccountId;
    li.LineNumber = i + 1;
    li.SourceLineCount = g.sourceLineCount;
    li.ExternalAccountID = externalAccounts[i];
    if (g.side === 'Debit') li.DebitAmount = g.net;
    else li.CreditAmount = -g.net;
    li.TransactionGroup = tg;
    if (!(await li.Save())) throw new Error(`buildBatch: summary line failed to queue: ${li.LatestResult?.CompleteMessage ?? 'unknown'}`);
    await queueSummaryDimensions(li.ID, g.dims, tg, contextUser, provider);
  }
}

async function queueSummaryDimensions(
  batchLineItemId: string,
  dims: DimRef[],
  tg: Awaited<ReturnType<IMetadataProvider['CreateTransactionGroup']>>,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<void> {
  for (const d of dims) {
    const dim = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryBatchLineDimensionEntity>(JEBLD_ENTITY, contextUser);
    dim.NewRecord();
    dim.JournalEntryBatchLineItemID = batchLineItemId;
    dim.DimensionID = d.DimensionID;
    dim.DimensionValueID = d.DimensionValueID;
    dim.TransactionGroup = tg;
    if (!(await dim.Save())) throw new Error(`buildBatch: summary dimension failed to queue: ${dim.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
}

/**
 * Resolve a local GL account to the identifier the ERP receives — the ACCOUNT NUMBER wire format (AM-4;
 * "BC knows nothing of our IDs"). Precedence: an effective, approved ChartOfAccountsMapping override →
 * the inline GLAccount.ExternalAccountID (when its ExternalSystem matches or is unset) → the account's
 * own Code (the account number — the AM-4 default; per-company charts mirror the ERP's numbers).
 * (The old §5.5 unmapped-GL hard-fail is retired: Code is always present, so resolution never fails.)
 */
export async function resolveExternalAccount(
  glAccountId: string, companyId: string, targetSystem: BatchTargetSystem, contextUser: UserInfo,
): Promise<string> {
  const rv = new RunView();
  const today = new Date().toISOString().slice(0, 10);
  const mapRes = await rv.RunView<{ ExternalAccountID: string }>(
    { EntityName: COA_MAP_ENTITY,
      ExtraFilter: `InternalGLAccountID='${glAccountId}' AND CompanyID='${companyId}' AND ExternalSystem='${targetSystem}' AND ApprovedByUserID IS NOT NULL AND EffectiveFrom <= '${today}' AND (EffectiveTo IS NULL OR EffectiveTo >= '${today}')`,
      Fields: ['ExternalAccountID'], OrderBy: 'EffectiveFrom DESC', MaxRows: 1, ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  if (mapRes.Success && mapRes.Results.length > 0) return mapRes.Results[0].ExternalAccountID;

  const glRes = await rv.RunView<{ Code: string; ExternalSystem: string | null; ExternalAccountID: string | null }>(
    { EntityName: GL_ENTITY, ExtraFilter: `ID='${glAccountId}'`, Fields: ['Code', 'ExternalSystem', 'ExternalAccountID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const gl = glRes.Results?.[0];
  if (!gl) throw new Error(`resolveExternalAccount: GL account ${glAccountId} not found`);
  if (gl.ExternalAccountID && (!gl.ExternalSystem || gl.ExternalSystem === targetSystem)) return gl.ExternalAccountID;
  return gl.Code; // AM-4: the account number IS the wire identity
}


/**
 * Queue the JE locks (Status → Batched + BatchID) onto the transaction.
 *
 * This is the step that most needed a transaction: it is one Save PER JE, so a 20-entry batch was 20
 * independent commits. A failure at entry 7 previously left 6 JEs locked to a batch and 14 loose —
 * the half-built batch MOD-14 exists to make impossible.
 *
 * The Load() per JE is a read (the trigger set requires the full row to validate the transition);
 * only the Save queues.
 */
async function queueJournalEntryLocks(
  jeIds: string[],
  batchId: string,
  tg: Awaited<ReturnType<IMetadataProvider['CreateTransactionGroup']>>,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<void> {
  for (const jeId of jeIds) {
    const je = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, contextUser);
    if (!(await je.Load(jeId))) throw new Error(`buildBatch: JE ${jeId} not found while locking`);
    je.BatchID = batchId;
    je.Status = 'Batched';
    je.TransactionGroup = tg;
    if (!(await je.Save())) throw new Error(`buildBatch: failed to queue lock for JE ${jeId}: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
}

// ─── cancelBatch / regenerateBatch — reverse a PRELIMINARY (unapproved) lock ──

/**
 * Reverse an unapproved (Pending) batch: return its journal entries to the candidate pool, clear its summary,
 * and mark it Cancelled. Valid ONLY while Status='Pending' (approval makes the lock permanent — plan §6). This
 * is the reject path's engine action (task #12) and the atomicity-safety net for a failed approval-task raise.
 */
export async function cancelBatch(
  batchId: string, contextUser: UserInfo,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const md = new Metadata();
  const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`cancelBatch: batch ${batchId} not found`);
  if (batch.Status !== 'Pending') {
    throw new Error(`cancelBatch: batch ${batchId} is ${batch.Status}; only a Pending (unapproved) batch can be cancelled/reversed`);
  }
  // Order matters: unlock the JEs while the batch is still Pending — the immutability trigger permits the
  // Batched→Pending reversal only when the owning batch's status is Pending.
  await unlockJournalEntries(batchId, contextUser);
  await clearSummaryLines(batchId, contextUser);
  batch.Status = 'Cancelled';
  if (!(await batch.Save())) throw new Error(`cancelBatch: Pending→Cancelled failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  return batch;
}

/**
 * Regenerate an OPEN (Pending) batch in place: unlock its current JEs + clear its summary, then re-gather ALL
 * current candidates (every unbatched Pending JE, incl. ones added since) and rebuild the netted summary on the
 * SAME batch record. Candidate FILTERS are a future enhancement (plan §13) — for now it takes everything pending.
 */
export async function regenerateBatch(
  batchId: string,
  targetSystem: BatchTargetSystem,
  contextUser: UserInfo,
  options: BuildBatchOptions = {},
  gate: BatchApprovalGate = AutoApproveGate,
  provider: IMetadataProvider = Metadata.Provider,
): Promise<BuildBatchResult> {
  const batch = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`regenerateBatch: batch ${batchId} not found`);
  if (batch.Status !== 'Pending') {
    throw new Error(`regenerateBatch: batch ${batchId} is ${batch.Status}; only a Pending batch can be regenerated`);
  }

  // The teardown (unlock + clear summary) stays OUTSIDE the rebuild transaction on purpose: it must
  // be visible to the re-gather below, which re-reads the candidate pool those unlocked JEs return to.
  await unlockJournalEntries(batchId, contextUser);
  await clearSummaryLines(batchId, contextUser);

  const jeIds = await loadPendingJEIds(contextUser, options);
  const groups = netLines(await loadNettableLines(jeIds, contextUser));
  const externalAccounts = await resolveExternalAccounts(groups, targetSystem, contextUser);
  const { totalDebits, totalCredits } = computeControlTotals(groups);

  // ONE transaction for the rebuild (MOD-14) — same posture as buildBatchFromIds.
  const tg = await provider.CreateTransactionGroup();
  batch.TargetSystem = targetSystem;
  batch.TotalEntries = jeIds.length;
  batch.TotalDebits = totalDebits;
  batch.TotalCredits = totalCredits;
  batch.TransactionGroup = tg;
  if (!(await batch.Save())) throw new Error(`regenerateBatch: header failed to queue: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  await queueSummaryLines(batch.ID, groups, externalAccounts, tg, contextUser, provider);
  await queueJournalEntryLocks(jeIds, batch.ID, tg, contextUser, provider);
  if (!(await tg.Submit())) {
    const detail = batch.LatestResult?.CompleteMessage ?? 'transaction group rolled back';
    LogError(`regenerateBatch: atomic rebuild rolled back: ${detail}`);
    throw new Error(`regenerateBatch: atomic rebuild rolled back: ${detail}`);
  }

  // Q28.3 — WORKING ASSUMPTION: regenerate re-raises the task and re-stamps. Rationale: the batch's
  // CONTENT changed, so a CFO who already saw the old contents should be asked again rather than have
  // an old approval silently carry over to different numbers. Flip this if Marcelo rules otherwise.
  const approvalTaskRaised = await raiseApprovalTaskAndStamp(batch.ID, gate, contextUser, provider);

  const companyCount = new Set(groups.map(g => g.companyId)).size;
  return {
    batchId: batch.ID, summaryLineCount: groups.length, totalDebits, totalCredits,
    jeCount: jeIds.length, companyCount, approvalTaskRaised,
  };
}

/**
 * Reverse the preliminary lock on every Batched JE in the batch: Status Batched→Pending, BatchID→NULL.
 * MUST run while the batch is still Pending (the reworked immutability trigger permits the unlock only then).
 */
async function unlockJournalEntries(batchId: string, contextUser: UserInfo): Promise<void> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: `BatchID='${batchId}' AND Status='Batched'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const md = new Metadata();
  for (const row of res.Results ?? []) {
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, contextUser);
    await je.Load(row.ID);
    je.Status = 'Pending';
    je.BatchID = null;
    if (!(await je.Save())) throw new Error(`unlockJournalEntries: JE ${row.ID} Batched→Pending failed: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
}

/** Delete a Pending batch's summary line items (+ their dimension tags). Allowed while the batch isn't Approved. */
async function clearSummaryLines(batchId: string, contextUser: UserInfo): Promise<void> {
  const rv = new RunView();
  const res = await rv.RunView<mjBizAppsAccountingJournalEntryBatchLineItemEntity>(
    { EntityName: JEBLI_ENTITY, ExtraFilter: `BatchID='${batchId}'`, ResultType: 'entity_object', BypassCache: true },
    contextUser,
  );
  for (const li of res.Results ?? []) {
    await clearLineDimensions(li.ID, contextUser);
    if (!(await li.Delete())) throw new Error(`clearSummaryLines: delete line ${li.ID} failed: ${li.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
}

/** Delete the dimension tags on a batch summary line (FK children — must go before the line item). */
async function clearLineDimensions(batchLineItemId: string, contextUser: UserInfo): Promise<void> {
  const rv = new RunView();
  const res = await rv.RunView<mjBizAppsAccountingJournalEntryBatchLineDimensionEntity>(
    { EntityName: JEBLD_ENTITY, ExtraFilter: `JournalEntryBatchLineItemID='${batchLineItemId}'`, ResultType: 'entity_object', BypassCache: true },
    contextUser,
  );
  for (const d of res.Results ?? []) {
    if (!(await d.Delete())) throw new Error(`clearLineDimensions: delete dim ${d.ID} failed: ${d.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
}

// ─── approveBatch ────────────────────────────────────────────────────────────

/** The human sign-off: Pending → Approved (+audit). Content freezes here (trg_JEBatch_Immutability). */
export async function approveBatch(
  batchId: string, approvedByUserId: string, contextUser: UserInfo,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const md = new Metadata();
  const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`approveBatch: batch ${batchId} not found`);
  if (batch.Status !== 'Pending') throw new Error(`approveBatch: batch ${batchId} is ${batch.Status}, only a Pending batch can be approved`);
  batch.Status = 'Approved';
  batch.ApprovedAt = new Date();
  batch.ApprovedByUserID = approvedByUserId;
  if (!(await batch.Save())) throw new Error(`approveBatch: Pending→Approved failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  return batch;
}

// ─── sendBatch ─────────────────────────────────────────────────────────────

export interface SendBatchOptions { gate: BatchApprovalGate; poster?: ErpPoster }

/**
 * Send an APPROVED batch to the ERP. Requires the approval gate + Status='Approved'; then Approved→Sent
 * (50014/50023 verify the summary foots overall AND per company), posts to the ERP (one summary JE per
 * company, all-or-nothing), and on confirmation flips Sent→Posted + the JEs Batched→GLPosted.
 */
export async function sendBatch(batchId: string, contextUser: UserInfo, options: SendBatchOptions): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const poster = options.poster ?? mockErpPoster;
  const md = new Metadata();
  const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`sendBatch: batch ${batchId} not found`);
  if (batch.Status !== 'Approved') throw new Error(`sendBatch: batch ${batchId} is ${batch.Status}, only an Approved batch can be sent`);

  await options.gate.assertApproved(batchId, contextUser); // throws if not CFO-approved

  // Approved → Sent: trg_JEBatch_SummaryReconciles verifies the summary foots (50014) + per company (50023).
  batch.Status = 'Sent';
  batch.SentAt = new Date();
  if (!(await batch.Save())) throw new Error(`sendBatch: Approved→Sent failed (summary must foot — 50014/50023): ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);

  const summaryLines = await loadSummaryLines(batchId, contextUser);
  const postResult = await poster(batch, summaryLines, contextUser);
  return postResult.success
    ? await markBatchPosted(batch, postResult.externalBatchRef ?? null, contextUser)
    : await failBatch(batch, postResult.error ?? 'ERP post failed');
}

async function loadSummaryLines(batchId: string, contextUser: UserInfo): Promise<mjBizAppsAccountingJournalEntryBatchLineItemEntity[]> {
  const rv = new RunView();
  const res = await rv.RunView<mjBizAppsAccountingJournalEntryBatchLineItemEntity>(
    { EntityName: JEBLI_ENTITY, ExtraFilter: `BatchID='${batchId}'`, OrderBy: 'LineNumber', ResultType: 'entity_object', BypassCache: true },
    contextUser,
  );
  return res.Success ? res.Results : [];
}

/** Sent → Posted (the ERP confirmed posting; allowed by 50009) + flip each batched JE Batched→GLPosted. */
async function markBatchPosted(
  batch: mjBizAppsAccountingJournalEntryBatchEntity, externalBatchRef: string | null, contextUser: UserInfo,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  batch.ExternalBatchRef = externalBatchRef;
  batch.PostedAt = new Date();
  batch.Status = 'Posted';
  if (!(await batch.Save())) throw new Error(`sendBatch: Sent→Posted failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  await markJournalEntriesGLPosted(batch.ID, externalBatchRef, contextUser);
  return batch;
}

/** JE Batched → GLPosted (only GLPostedAt/GLReferenceID/Status may change on a locked JE). */
async function markJournalEntriesGLPosted(batchId: string, externalBatchRef: string | null, contextUser: UserInfo): Promise<void> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: `BatchID='${batchId}' AND Status='Batched'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const md = new Metadata();
  for (const row of res.Results ?? []) {
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, contextUser);
    await je.Load(row.ID);
    je.Status = 'GLPosted';
    je.GLPostedAt = new Date();
    if (externalBatchRef) je.GLReferenceID = externalBatchRef;
    if (!(await je.Save())) throw new Error(`sendBatch: JE ${row.ID} Batched→GLPosted failed: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
}

/** Sent → Failed (allowed by 50009). JEs stay Batched; ErrorMessage records the cause for retry triage. */
async function failBatch(batch: mjBizAppsAccountingJournalEntryBatchEntity, error: string): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  batch.Status = 'Failed';
  batch.ErrorMessage = error;
  await batch.Save();
  return batch;
}
