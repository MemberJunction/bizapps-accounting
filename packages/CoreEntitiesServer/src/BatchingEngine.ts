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
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
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
  onBatchBuilt?(batchId: string, contextUser: UserInfo): Promise<void>;
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
): Promise<BuildBatchResult | null> {
  const jeIds = await loadPendingJEIds(contextUser, options);
  return buildBatchFromIds(jeIds, targetSystem, batchedByUserId, contextUser, gate);
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
): Promise<BuildBatchResult | null> {
  if (jeIds.length === 0) return null;
  const groups = netLines(await loadNettableLines(jeIds, contextUser));
  if (groups.length === 0) return null; // everything netted to zero

  const batch = await createBatchHeader(targetSystem, batchedByUserId, jeIds.length, contextUser);
  const { totalDebits, totalCredits } = await writeSummaryLines(batch.ID, targetSystem, groups, contextUser);
  await setControlTotals(batch, totalDebits, totalCredits);
  await lockJournalEntries(jeIds, batch.ID, contextUser);
  await raiseApprovalTaskOrReverse(batch.ID, gate, contextUser);

  const companyCount = new Set(groups.map(g => g.companyId)).size;
  return { batchId: batch.ID, summaryLineCount: groups.length, totalDebits, totalCredits, jeCount: jeIds.length, companyCount };
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
 * Raise the approval task; if the gate throws (e.g. a company has no CFO) do NOT leave a locked, task-less
 * batch stranded — with reversible preliminary locks we cancel it (unlock JEs + Cancelled) and rethrow, so
 * the caller sees the real failure and the candidate pool is intact. (Fixes the Q5 orphan-batch atomicity gap.)
 */
async function raiseApprovalTaskOrReverse(batchId: string, gate: BatchApprovalGate, contextUser: UserInfo): Promise<void> {
  if (!gate.onBatchBuilt) return;
  try {
    await gate.onBatchBuilt(batchId, contextUser);
  } catch (e) {
    await cancelBatch(batchId, contextUser);
    throw e;
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

/** Build the `Status='Pending'` + date-window ExtraFilter (inclusive date-only cutoff per MOD-8). */
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
  return clauses.join(' AND ');
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

async function createBatchHeader(
  targetSystem: BatchTargetSystem, batchedByUserId: string, jeCount: number, contextUser: UserInfo,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const md = new Metadata();
  const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  batch.NewRecord();
  batch.TargetSystem = targetSystem;
  batch.BatchedAt = new Date();
  batch.BatchedByUserID = batchedByUserId;
  batch.Status = 'Pending';
  batch.TotalEntries = jeCount;
  batch.TotalDebits = 0;
  batch.TotalCredits = 0;
  if (!(await batch.Save())) throw new Error(`buildBatch: batch header save failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  return batch;
}

/** Write one netted JournalEntryBatchLineItem (+ dimension tags) per group; resolve the ERP account number. */
async function writeSummaryLines(
  batchId: string, targetSystem: BatchTargetSystem, groups: NetGroup[], contextUser: UserInfo,
): Promise<{ totalDebits: number; totalCredits: number }> {
  const md = new Metadata();
  let totalDebits = 0, totalCredits = 0, lineNo = 0;
  for (const g of groups) {
    const externalAccountId = await resolveExternalAccount(g.glAccountId, g.companyId, targetSystem, contextUser);
    lineNo += 1;
    const li = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchLineItemEntity>(JEBLI_ENTITY, contextUser);
    li.NewRecord();
    li.BatchID = batchId;
    li.CompanyID = g.companyId;
    li.GLAccountID = g.glAccountId;
    li.LineNumber = lineNo;
    li.SourceLineCount = g.sourceLineCount;
    li.ExternalAccountID = externalAccountId;
    if (g.side === 'Debit') { li.DebitAmount = g.net; totalDebits += g.net; }
    else { li.CreditAmount = -g.net; totalCredits += -g.net; }
    if (!(await li.Save())) throw new Error(`buildBatch: summary line save failed: ${li.LatestResult?.CompleteMessage ?? 'unknown'}`);
    await writeSummaryDimensions(li.ID, g.dims, contextUser);
  }
  return { totalDebits: Math.round(totalDebits * 100) / 100, totalCredits: Math.round(totalCredits * 100) / 100 };
}

async function writeSummaryDimensions(batchLineItemId: string, dims: DimRef[], contextUser: UserInfo): Promise<void> {
  const md = new Metadata();
  for (const d of dims) {
    const dim = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchLineDimensionEntity>(JEBLD_ENTITY, contextUser);
    dim.NewRecord();
    dim.JournalEntryBatchLineItemID = batchLineItemId;
    dim.DimensionID = d.DimensionID;
    dim.DimensionValueID = d.DimensionValueID;
    if (!(await dim.Save())) throw new Error(`buildBatch: summary dimension save failed: ${dim.LatestResult?.CompleteMessage ?? 'unknown'}`);
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

async function setControlTotals(batch: mjBizAppsAccountingJournalEntryBatchEntity, totalDebits: number, totalCredits: number): Promise<void> {
  batch.TotalDebits = totalDebits;
  batch.TotalCredits = totalCredits;
  if (!(await batch.Save())) throw new Error(`buildBatch: control-totals save failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
}

/** Lock the JEs: Status → Batched with BatchID (CK_JournalEntry_BatchedHasBatch + the immutability triggers). */
async function lockJournalEntries(jeIds: string[], batchId: string, contextUser: UserInfo): Promise<void> {
  const md = new Metadata();
  for (const jeId of jeIds) {
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, contextUser);
    await je.Load(jeId);
    je.BatchID = batchId;
    je.Status = 'Batched';
    if (!(await je.Save())) throw new Error(`buildBatch: failed to lock JE ${jeId}: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
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
  batchId: string, targetSystem: BatchTargetSystem, contextUser: UserInfo,
): Promise<BuildBatchResult> {
  const md = new Metadata();
  const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`regenerateBatch: batch ${batchId} not found`);
  if (batch.Status !== 'Pending') {
    throw new Error(`regenerateBatch: batch ${batchId} is ${batch.Status}; only a Pending batch can be regenerated`);
  }
  await unlockJournalEntries(batchId, contextUser);
  await clearSummaryLines(batchId, contextUser);

  const jeIds = await loadPendingJEIds(contextUser);
  const groups = netLines(await loadNettableLines(jeIds, contextUser));
  const { totalDebits, totalCredits } = await writeSummaryLines(batch.ID, targetSystem, groups, contextUser);
  batch.TargetSystem = targetSystem;
  batch.TotalEntries = jeIds.length;
  await setControlTotals(batch, totalDebits, totalCredits);
  await lockJournalEntries(jeIds, batch.ID, contextUser);

  const companyCount = new Set(groups.map(g => g.companyId)).size;
  return { batchId: batch.ID, summaryLineCount: groups.length, totalDebits, totalCredits, jeCount: jeIds.length, companyCount };
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
