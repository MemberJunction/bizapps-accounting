/**
 * BatchingEngine — Block 2 headline (S1 dispatch). The core subledger→ERP process.
 *
 *   buildBatch(): group a Company×Period's Pending JEs → a JournalEntryBatch, build the consolidated
 *     SUMMARY lines (one per GLAccount × Dimension-combo, Dr/Cr **netted** to one side per §C5), resolve
 *     each line's ERP account (ChartOfAccountsMapping override → GLAccount inline → HARD-FAIL if unmapped,
 *     per §5.5), set the balanced control totals, **lock** the JEs to Batched, and raise the approval task.
 *   sendBatch(): require CFO approval (gate seam), post the summary to the ERP (mock poster for now), and
 *     flip Pending→Sent — trg_JEBatch_SummaryReconciles (50014) verifies the summary foots to the control
 *     totals at that transition. On ERP ack, flip Sent→Acknowledged and the JEs Batched→GLPosted.
 *
 * The detail (JournalEntryLine) stays in the subledger for drill-through; the netted summary is what BC sees.
 *
 * SECURITY MODEL (what this report proves through testing):
 *   - **Financial invariants are DB triggers — un-bypassable even by raw SQL / SA:** the summary must foot
 *     to the control totals (50014), a Sent/Acknowledged batch is immutable (50008/50009), no JE may post
 *     into a Closed period (50007), and an unmapped GL account hard-fails the build (§5.5, app-level).
 *   - **The CFO approval is a WORKFLOW gate, not a financial invariant** — it is enforced in the engine via
 *     a pluggable BatchApprovalGate (default backed by the bizapps-tasks app). By nature it is app-level,
 *     not a DB trigger; the financial guarantees above are what the raw-SQL bypass tests exercise.
 *
 * CONNECTS TO:
 *   READS/WRITES: Journal Entries (lock) · Journal Entry Lines (+ Dimensions) · Journal Entry Batches
 *                 · Journal Entry Batch Line Items (+ Dimensions) · GL Accounts · ChartOfAccountsMapping
 *   DB TRIGGERS:  trg_JEBatch_SummaryReconciles (50014) · trg_JEBatch_Immutability (50008/50009)
 *                 · trg_JournalEntry_PeriodClose (50007) · trg_JournalEntry_Immutability (lock)
 *   ENTITY:       'MJ_BizApps_Accounting: Journal Entry Batches'
 *   DOC:          docs/ARCHITECTURE.md (batching) · plan §C5 (netting) · §5.5 (GL-account resolution)
 */
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import type {
  mjBizAppsAccountingJournalEntryBatchEntity,
  mjBizAppsAccountingJournalEntryBatchLineItemEntity,
  mjBizAppsAccountingJournalEntryBatchLineDimensionEntity,
  mjBizAppsAccountingJournalEntryEntity,
} from '@mj-biz-apps/accounting-entities';
import { applyIntercompanyNetting } from './IntercompanyBalancingService.js';

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

/** Pure netting input: one JE line, dimension-tagged. */
export interface NettableLine { glAccountId: string; debit: number; credit: number; dims: DimRef[] }

/** Pure netting output: one consolidated summary group (Dr/Cr collapsed to a single side). */
export interface NetGroup {
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
}

export interface ErpPostResult { success: boolean; externalBatchRef?: string; error?: string }

/** ERP-post seam. The real BusinessCentral poster builds on business-central-base.action.ts; this mock
 *  lets the whole dispatch flow run + be tested without a live BC tenant. */
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

/** Test/seed gate — always approved. Real deployments use the bizapps-tasks-backed gate (AccountingService). */
export const AutoApproveGate: BatchApprovalGate = { async assertApproved() { /* always approved */ } };

// ─── Pure netting (unit-tested without a DB) ─────────────────────────────────

/**
 * Collapse JE lines to consolidated summary groups: one per (GLAccount × dimension-combo), with debits
 * netted against credits to a single side. Groups that net to ~zero drop out. No I/O — pure + deterministic.
 */
export function netLines(lines: NettableLine[]): NetGroup[] {
  const map = new Map<string, { glAccountId: string; dims: DimRef[]; dimKey: string; debit: number; credit: number; sourceLineCount: number }>();
  for (const line of lines) {
    const dims = [...line.dims].sort((a, b) => a.DimensionID.localeCompare(b.DimensionID));
    const dimKey = dims.map(d => `${d.DimensionID}:${d.DimensionValueID}`).join('|');
    const key = `${line.glAccountId}#${dimKey}`;
    let g = map.get(key);
    if (!g) { g = { glAccountId: line.glAccountId, dims, dimKey, debit: 0, credit: 0, sourceLineCount: 0 }; map.set(key, g); }
    g.debit += line.debit;
    g.credit += line.credit;
    g.sourceLineCount += 1;
  }
  const groups: NetGroup[] = [];
  for (const g of map.values()) {
    const net = Math.round((g.debit - g.credit) * 100) / 100;
    if (Math.abs(net) <= NET_TOLERANCE) continue; // nets to zero — no summary line
    groups.push({ glAccountId: g.glAccountId, dims: g.dims, dimKey: g.dimKey, net, side: net > 0 ? 'Debit' : 'Credit', sourceLineCount: g.sourceLineCount });
  }
  return groups;
}

// ─── buildBatch ──────────────────────────────────────────────────────────────

/**
 * Build a Pending batch from a Company×Period's Pending JEs: netted summary lines + locked JEs + approval task.
 * Throws on an unmapped GL account (the §5.5 hard-fail). Returns null when there is nothing to batch.
 */
export async function buildBatch(
  companyId: string,
  accountingPeriodId: string,
  targetSystem: BatchTargetSystem,
  batchedByUserId: string,
  contextUser: UserInfo,
  gate: BatchApprovalGate = AutoApproveGate,
): Promise<BuildBatchResult | null> {
  const jeIds = await loadPendingJEIds(companyId, accountingPeriodId, contextUser);
  if (jeIds.length === 0) return null;

  // Account×dim net groups (BA-D26), then fold each intercompany company-pair's gross
  // Due-To/Due-From groups into a single bilateral net group (§C1 "gross preserved, net shipped").
  const groups = await applyIntercompanyNetting(netLines(await loadNettableLines(jeIds, contextUser)), companyId, contextUser);
  if (groups.length === 0) return null; // everything netted to zero

  const batch = await createBatchHeader(companyId, accountingPeriodId, targetSystem, batchedByUserId, jeIds.length, contextUser);
  const { totalDebits, totalCredits } = await writeSummaryLines(batch.ID, companyId, targetSystem, groups, contextUser);
  await setControlTotals(batch, totalDebits, totalCredits);
  await lockJournalEntries(jeIds, batch.ID, contextUser);
  if (gate.onBatchBuilt) await gate.onBatchBuilt(batch.ID, contextUser);

  return { batchId: batch.ID, summaryLineCount: groups.length, totalDebits, totalCredits, jeCount: jeIds.length };
}

async function loadPendingJEIds(companyId: string, accountingPeriodId: string, contextUser: UserInfo): Promise<string[]> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: `CompanyID='${companyId}' AND AccountingPeriodID='${accountingPeriodId}' AND Status='Pending'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  return (res.Results ?? []).map(r => r.ID);
}

async function loadNettableLines(jeIds: string[], contextUser: UserInfo): Promise<NettableLine[]> {
  const rv = new RunView();
  const inList = jeIds.map(id => `'${id}'`).join(',');
  const lineRes = await rv.RunView<{ ID: string; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>(
    { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID IN (${inList})`, Fields: ['ID', 'GLAccountID', 'DebitAmount', 'CreditAmount'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const lines = lineRes.Results ?? [];
  const dimsByLine = await loadDimensionsByLine(lines.map(l => l.ID), contextUser);
  return lines.map(l => ({ glAccountId: l.GLAccountID, debit: l.DebitAmount ?? 0, credit: l.CreditAmount ?? 0, dims: dimsByLine.get(l.ID) ?? [] }));
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
  companyId: string, accountingPeriodId: string, targetSystem: BatchTargetSystem, batchedByUserId: string, jeCount: number, contextUser: UserInfo,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const md = new Metadata();
  const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  batch.NewRecord();
  batch.CompanyID = companyId;
  batch.AccountingPeriodID = accountingPeriodId;
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

/** Write one netted JournalEntryBatchLineItem (+ dimension tags) per group; resolve + require the ERP account. */
async function writeSummaryLines(
  batchId: string, companyId: string, targetSystem: BatchTargetSystem, groups: NetGroup[], contextUser: UserInfo,
): Promise<{ totalDebits: number; totalCredits: number }> {
  const md = new Metadata();
  let totalDebits = 0, totalCredits = 0, lineNo = 0;
  for (const g of groups) {
    const externalAccountId = await resolveExternalAccount(g.glAccountId, companyId, targetSystem, contextUser);
    if (externalAccountId === null) {
      throw new Error(`buildBatch: GL account ${g.glAccountId} has no ERP mapping for ${targetSystem} (unmapped-GL hard-fail, §5.5). Map it before batching.`);
    }
    lineNo += 1;
    const li = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchLineItemEntity>(JEBLI_ENTITY, contextUser);
    li.NewRecord();
    li.BatchID = batchId;
    li.CompanyID = companyId;
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
 * Resolve a local GL account to its ERP account for `targetSystem` (§5.5 precedence):
 * an effective, approved ChartOfAccountsMapping wins; else the inline GLAccount.ExternalAccountID (when its
 * ExternalSystem matches or is unset); else null → caller hard-fails. Strictly 1:1.
 */
export async function resolveExternalAccount(
  glAccountId: string, companyId: string, targetSystem: BatchTargetSystem, contextUser: UserInfo,
): Promise<string | null> {
  const rv = new RunView();
  const today = new Date().toISOString().slice(0, 10);
  const mapRes = await rv.RunView<{ ExternalAccountID: string }>(
    { EntityName: COA_MAP_ENTITY,
      ExtraFilter: `InternalGLAccountID='${glAccountId}' AND CompanyID='${companyId}' AND ExternalSystem='${targetSystem}' AND ApprovedByUserID IS NOT NULL AND EffectiveFrom <= '${today}' AND (EffectiveTo IS NULL OR EffectiveTo >= '${today}')`,
      Fields: ['ExternalAccountID'], OrderBy: 'EffectiveFrom DESC', MaxRows: 1, ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  if (mapRes.Success && mapRes.Results.length > 0) return mapRes.Results[0].ExternalAccountID;

  const glRes = await rv.RunView<{ ExternalSystem: string | null; ExternalAccountID: string | null }>(
    { EntityName: GL_ENTITY, ExtraFilter: `ID='${glAccountId}'`, Fields: ['ExternalSystem', 'ExternalAccountID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const gl = glRes.Results?.[0];
  if (gl?.ExternalAccountID && (!gl.ExternalSystem || gl.ExternalSystem === targetSystem)) return gl.ExternalAccountID;
  return null;
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

// ─── sendBatch ─────────────────────────────────────────────────────────────

export interface SendBatchOptions { gate: BatchApprovalGate; poster?: ErpPoster }

/**
 * Send an approved batch to the ERP. Requires the approval gate to pass; then Pending→Sent (50014 verifies
 * the summary foots), posts to the ERP, and on ack flips Sent→Acknowledged + the JEs Batched→GLPosted.
 */
export async function sendBatch(batchId: string, contextUser: UserInfo, options: SendBatchOptions): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const poster = options.poster ?? mockErpPoster;
  const md = new Metadata();
  const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`sendBatch: batch ${batchId} not found`);
  if (batch.Status !== 'Pending') throw new Error(`sendBatch: batch ${batchId} is ${batch.Status}, only a Pending batch can be sent`);

  await options.gate.assertApproved(batchId, contextUser); // throws if not CFO-approved

  // Pending → Sent: trg_JEBatch_SummaryReconciles (50014) verifies the summary foots to the control totals.
  batch.Status = 'Sent';
  batch.SentAt = new Date();
  if (!(await batch.Save())) throw new Error(`sendBatch: Pending→Sent failed (summary must foot — 50014): ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);

  const summaryLines = await loadSummaryLines(batchId, contextUser);
  const postResult = await poster(batch, summaryLines, contextUser);
  return postResult.success
    ? await acknowledgeBatch(batch, postResult.externalBatchRef ?? null, contextUser)
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

/** Sent → Acknowledged (allowed by 50009) + flip each batched JE Batched→GLPosted. */
async function acknowledgeBatch(
  batch: mjBizAppsAccountingJournalEntryBatchEntity, externalBatchRef: string | null, contextUser: UserInfo,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  batch.ExternalBatchRef = externalBatchRef;
  batch.AcknowledgedAt = new Date();
  batch.Status = 'Acknowledged';
  if (!(await batch.Save())) throw new Error(`sendBatch: Sent→Acknowledged failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
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
