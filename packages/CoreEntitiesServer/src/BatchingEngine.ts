/**
 * BatchingEngine — the core subledger→ERP dispatch process (plan §7).
 * REWORKED 2026-07-23 for the rewritten baseline: batches are SINGLE-COMPANY (D7)
 * and the netted summary is an ORDINARY JournalEntry (EntryType='BatchSummary')
 * instead of the retired JournalEntryBatchLineItem tables (Amith's summary-JE model).
 *
 *   buildBatch(companyId, …): gather that company's Pending JEs → ONE JournalEntryBatch
 *     (one batch per company per run, D7), net their lines to consolidated summary groups
 *     (one per GLAccount × Dimension-combo, Dr/Cr netted to one side), write the summary
 *     as a BatchSummary JournalEntry (header + JournalEntryLines + dimension tags) that
 *     carries the batch's BatchID so it rides the SAME derived lock machinery as the
 *     members, set the balanced control totals + SummaryJournalEntryID (trigger 50023
 *     verifies coherence), **lock** the member JEs to Batched, and raise the approval task.
 *   approveBatch(): the human sign-off — Pending→Approved (+ApprovedAt/ApprovedByUserID).
 *     Content is frozen from here (trg_JEBatch_Immutability, 50009).
 *   sendBatch(): require approval (gate seam + Status='Approved'), flip Approved→Sent,
 *     post the summary JE's lines to the ERP (all-or-nothing per batch), and on
 *     confirmation flip Sent→Posted + the member JEs AND the summary JE Batched→GLPosted.
 *     Failure → Failed (retry + escalating alerts).
 *
 * The detail (member JournalEntryLines) stays in the subledger for drill-through; the
 * netted summary JE is what the ERP sees, dated the batch's PostingDate.
 *
 * SECURITY MODEL:
 *   - **Financial invariants are DB triggers — un-bypassable even by raw SQL / SA:** JEs must
 *     balance to lock (50001), lines must match the header company (50019), an Approved/Sent/
 *     Posted batch is immutable (50008/50009), and the summary pointer must cohere (50023).
 *   - **The CFO approval is a WORKFLOW gate, not a financial invariant** — enforced in the
 *     engine via a pluggable BatchApprovalGate (default backed by the bizapps-tasks app).
 *
 * NOT YET HERE (the §7.2 batch-rework slice, deliberately out of this pass): date-filter
 * sweeps, view-defined arbitrary batches, the one-transaction-per-batch guarantee (D10),
 * and PostingDate selection UI (defaults to today, UTC).
 *
 * CONNECTS TO:
 *   READS/WRITES: Journal Entries (members + the BatchSummary JE) · Journal Entry Lines
 *                 (+ Dimensions) · Journal Entry Batches · GL Accounts
 *   DB TRIGGERS:  trg_JEBatch_SummaryCoherence (50023) · trg_JEBatch_Immutability (50008/50009)
 *                 · trg_JournalEntry_Immutability (lock) · balanced-on-lock (50001)
 *   ENTITY:       'MJ_BizApps_Accounting: Journal Entry Batches'
 *   DOC:          plans/bizapps-accounting-master.md §7 (lifecycle + batching)
 */
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import type {
  mjBizAppsAccountingJournalEntryBatchEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingJournalEntryLineDimensionEntity,
} from '@mj-biz-apps/accounting-entities';
import { JournalEntryEntityServer } from './JournalEntryEntityServer.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

/** Cent-level tolerance — amounts are decimal(18,2), so anything under half a cent is "zero". */
const NET_TOLERANCE = 0.005;

/** The ERP targets the schema's CK_JournalEntryBatch_TargetSystem accepts. */
export type BatchTargetSystem = 'BusinessCentral' | 'NetSuite' | 'Other' | 'QuickBooks' | 'Sage' | 'Xero';

export interface DimRef { DimensionID: string; DimensionValueID: string }

/** Pure netting input: one JE line, dimension-tagged. Company = the parent JE's header CompanyID (D3). */
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
  summaryJournalEntryId: string;
  summaryLineCount: number;
  totalDebits: number;
  totalCredits: number;
  jeCount: number;
}

export interface ErpPostResult { success: boolean; externalBatchRef?: string; error?: string }

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
 * Collapse JE lines to consolidated summary groups: one per (Company × GLAccount × dimension-combo),
 * with debits netted against credits to a single side. Groups that net to ~zero drop out. In a
 * single-company batch the company key is constant — it stays in the key as a safety net so a
 * mixed-company input can never silently merge across companies. No I/O — pure + deterministic.
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
 * Build a Pending SINGLE-COMPANY batch (D7) from that company's Pending JEs: a netted BatchSummary
 * JE + locked members + the approval task. Returns null when there is nothing to batch.
 */
export async function buildBatch(
  companyId: string,
  targetSystem: BatchTargetSystem,
  batchedByUserId: string,
  contextUser: UserInfo,
  gate: BatchApprovalGate = AutoApproveGate,
): Promise<BuildBatchResult | null> {
  const jeIds = await loadPendingJEIds(companyId, contextUser);
  if (jeIds.length === 0) return null;

  const groups = netLines(await loadNettableLines(companyId, jeIds, contextUser));
  if (groups.length === 0) return null; // everything netted to zero

  const batch = await createBatchHeader(companyId, targetSystem, batchedByUserId, jeIds.length, contextUser);
  const summary = await writeSummaryJournalEntry(batch, groups, contextUser);
  const { totalDebits, totalCredits } = summaryTotals(groups);
  await setSummaryPointerAndTotals(batch, summary.ID, totalDebits, totalCredits, jeIds.length);
  await lockJournalEntries(jeIds, batch.ID, contextUser);
  await raiseApprovalTaskOrReverse(batch.ID, gate, contextUser);

  return { batchId: batch.ID, summaryJournalEntryId: summary.ID, summaryLineCount: groups.length, totalDebits, totalCredits, jeCount: jeIds.length };
}

/**
 * Raise the approval task; if the gate throws (e.g. the company has no CFO) do NOT leave a locked,
 * task-less batch stranded — with reversible preliminary locks we cancel it (unlock JEs + Cancelled)
 * and rethrow, so the caller sees the real failure and the candidate pool is intact.
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

/** The company's unbatched Pending JEs. BatchSummary JEs are excluded by EntryType (the ruled default exclusion). */
async function loadPendingJEIds(companyId: string, contextUser: UserInfo): Promise<string[]> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: `Status='Pending' AND CompanyID='${companyId}' AND EntryType<>'BatchSummary'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  return (res.Results ?? []).map(r => r.ID);
}

async function loadNettableLines(companyId: string, jeIds: string[], contextUser: UserInfo): Promise<NettableLine[]> {
  const rv = new RunView();
  const inList = jeIds.map(id => `'${id}'`).join(',');
  const lineRes = await rv.RunView<{ ID: string; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>(
    { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID IN (${inList})`, Fields: ['ID', 'GLAccountID', 'DebitAmount', 'CreditAmount'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const lines = lineRes.Results ?? [];
  const dimsByLine = await loadDimensionsByLine(lines.map(l => l.ID), contextUser);
  // The line's company IS the parent JE's header company (single-company JE, D3; trigger 50019
  // guarantees every line's GLAccount belongs to it) — and every gathered JE belongs to companyId.
  return lines.map(l => ({ companyId, glAccountId: l.GLAccountID, debit: l.DebitAmount ?? 0, credit: l.CreditAmount ?? 0, dims: dimsByLine.get(l.ID) ?? [] }));
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

/** Today as a date-only value, UTC (repo convention). PostingDate selection is a §7.2 rework item. */
function todayUTC(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

async function createBatchHeader(
  companyId: string, targetSystem: BatchTargetSystem, batchedByUserId: string, jeCount: number, contextUser: UserInfo,
): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const md = new Metadata();
  const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
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
  if (!(await batch.Save())) throw new Error(`buildBatch: batch header save failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  return batch;
}

/**
 * Write the netted summary as a BatchSummary JournalEntry: header + one JournalEntryLine per net
 * group (via the encapsulated JournalEntryEntityServer — lines save transactionally with the
 * header), then the dimension tags, then flip it to Batched (BatchID is already set, so the flip
 * is the sanctioned preliminary lock; balanced-on-lock 50001 verifies the summary foots).
 */
async function writeSummaryJournalEntry(
  batch: mjBizAppsAccountingJournalEntryBatchEntity, groups: NetGroup[], contextUser: UserInfo,
): Promise<JournalEntryEntityServer> {
  const md = new Metadata();
  const summary = await md.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, contextUser);
  summary.NewRecord();
  summary.CompanyID = batch.CompanyID;
  summary.EffectiveDate = batch.PostingDate;
  summary.EntryType = 'BatchSummary';
  summary.Status = 'Pending';
  summary.BatchID = batch.ID;
  summary.Description = `Netted summary for batch ${batch.BatchNumber}`;

  for (const g of groups) {
    const line = await summary.CreateLine(contextUser);
    line.GLAccountID = g.glAccountId;
    if (g.side === 'Debit') line.DebitAmount = g.net;
    else line.CreditAmount = -g.net;
    line.Description = `Netted from ${g.sourceLineCount} source line(s)`;
  }
  if (!(await summary.Save())) {
    throw new Error(`buildBatch: summary JE save failed: ${summary.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
  await writeSummaryDimensions(summary, groups, contextUser);

  // Preliminary lock: Pending→Batched with BatchID set (reversible while the batch stays Pending).
  summary.Status = 'Batched';
  if (!(await summary.Save())) {
    throw new Error(`buildBatch: summary JE lock (Pending→Batched) failed — the summary must foot (50001): ${summary.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
  return summary;
}

/** Tag each summary line with its group's dimension refs (JournalEntryLineDimension rows). */
async function writeSummaryDimensions(
  summary: JournalEntryEntityServer, groups: NetGroup[], contextUser: UserInfo,
): Promise<void> {
  const md = new Metadata();
  const lines = summary.Lines;
  for (let i = 0; i < groups.length; i++) {
    const line = lines[i];
    if (!line) throw new Error(`buildBatch: summary line ${i + 1} missing after save`);
    for (const d of groups[i].dims) {
      const dim = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineDimensionEntity>(JELD_ENTITY, contextUser);
      dim.NewRecord();
      dim.JournalEntryLineID = line.ID;
      dim.DimensionID = d.DimensionID;
      dim.DimensionValueID = d.DimensionValueID;
      if (!(await dim.Save())) throw new Error(`buildBatch: summary dimension save failed: ${dim.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
  }
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
  if (!(await batch.Save())) throw new Error(`buildBatch: summary-pointer/control-totals save failed (coherence 50023): ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
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
  glAccountId: string, targetSystem: BatchTargetSystem, contextUser: UserInfo,
): Promise<string> {
  const rv = new RunView();
  const glRes = await rv.RunView<{ Code: string; ExternalSystem: string | null; ExternalAccountID: string | null }>(
    { EntityName: GL_ENTITY, ExtraFilter: `ID='${glAccountId}'`, Fields: ['Code', 'ExternalSystem', 'ExternalAccountID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const gl = glRes.Results?.[0];
  if (!gl) throw new Error(`resolveExternalAccount: GL account ${glAccountId} not found`);
  if (gl.ExternalAccountID && (!gl.ExternalSystem || gl.ExternalSystem === targetSystem)) return gl.ExternalAccountID;
  return gl.Code; // the account number IS the wire identity
}

/** Lock the member JEs: Status → Batched with BatchID (CK_JournalEntry_BatchedHasBatch + the immutability triggers). */
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
 * Reverse an unapproved (Pending) batch: return its member journal entries to the candidate pool,
 * delete its BatchSummary JE, and mark it Cancelled. Valid ONLY while Status='Pending' (approval
 * makes the lock permanent — plan §7.3). This is the reject path's engine action and the
 * atomicity-safety net for a failed approval-task raise.
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
  await tearDownSummaryAndUnlock(batch, contextUser);
  batch.Status = 'Cancelled';
  if (!(await batch.Save())) throw new Error(`cancelBatch: Pending→Cancelled failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  return batch;
}

/**
 * Regenerate an OPEN (Pending) batch in place: unlock its current JEs + delete its summary JE, then
 * re-gather ALL current candidates for the batch's company (every unbatched Pending JE, incl. ones
 * added since) and rebuild the netted summary on the SAME batch record. Candidate FILTERS are the
 * §7.2 rework — for now it takes everything pending for the company.
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
  await tearDownSummaryAndUnlock(batch, contextUser);

  const jeIds = await loadPendingJEIds(batch.CompanyID, contextUser);
  const groups = netLines(await loadNettableLines(batch.CompanyID, jeIds, contextUser));
  const { totalDebits, totalCredits } = summaryTotals(groups);
  batch.TargetSystem = targetSystem;
  let summaryId = '';
  if (groups.length > 0) {
    const summary = await writeSummaryJournalEntry(batch, groups, contextUser);
    summaryId = summary.ID;
  }
  await setSummaryPointerAndTotals(batch, summaryId || null, totalDebits, totalCredits, jeIds.length);
  await lockJournalEntries(jeIds, batch.ID, contextUser);

  return { batchId: batch.ID, summaryJournalEntryId: summaryId, summaryLineCount: groups.length, totalDebits, totalCredits, jeCount: jeIds.length };
}

/**
 * Shared teardown for cancel/regenerate (batch MUST still be Pending):
 *   1. clear the batch's SummaryJournalEntryID (frees the FK on the summary JE),
 *   2. unlock every Batched JE in the batch's orbit — members AND the summary — back to
 *      Pending/BatchID NULL (the sanctioned reversible unlock while the batch is Pending),
 *   3. delete the now-Pending summary JE (dimension tags → lines → header).
 */
async function tearDownSummaryAndUnlock(batch: mjBizAppsAccountingJournalEntryBatchEntity, contextUser: UserInfo): Promise<void> {
  const summaryId = batch.SummaryJournalEntryID;
  if (summaryId) {
    batch.SummaryJournalEntryID = null;
    if (!(await batch.Save())) throw new Error(`batch teardown: clearing SummaryJournalEntryID failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
  await unlockJournalEntries(batch.ID, contextUser);
  if (summaryId) await deleteSummaryJournalEntry(summaryId, contextUser);
}

/**
 * Reverse the preliminary lock on every Batched JE in the batch (members + the summary):
 * Status Batched→Pending, BatchID→NULL. MUST run while the batch is still Pending (the
 * immutability trigger permits the unlock only then).
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

/** Delete an unlocked (Pending) BatchSummary JE: dimension tags → lines → header. */
async function deleteSummaryJournalEntry(summaryJournalEntryId: string, contextUser: UserInfo): Promise<void> {
  const rv = new RunView();
  const lineRes = await rv.RunView<mjBizAppsAccountingJournalEntryLineEntity>(
    { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${summaryJournalEntryId}'`, ResultType: 'entity_object', BypassCache: true },
    contextUser,
  );
  for (const line of lineRes.Results ?? []) {
    await deleteLineDimensions(line.ID, contextUser);
    if (!(await line.Delete())) throw new Error(`deleteSummaryJournalEntry: delete line ${line.ID} failed: ${line.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, contextUser);
  if (!(await je.Load(summaryJournalEntryId))) throw new Error(`deleteSummaryJournalEntry: summary JE ${summaryJournalEntryId} not found`);
  if (!(await je.Delete())) throw new Error(`deleteSummaryJournalEntry: delete summary JE failed: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
}

/** Delete the dimension tags on a summary JE line (FK children — must go before the line). */
async function deleteLineDimensions(lineId: string, contextUser: UserInfo): Promise<void> {
  const rv = new RunView();
  const res = await rv.RunView<mjBizAppsAccountingJournalEntryLineDimensionEntity>(
    { EntityName: JELD_ENTITY, ExtraFilter: `JournalEntryLineID='${lineId}'`, ResultType: 'entity_object', BypassCache: true },
    contextUser,
  );
  for (const d of res.Results ?? []) {
    if (!(await d.Delete())) throw new Error(`deleteLineDimensions: delete dim ${d.ID} failed: ${d.LatestResult?.CompleteMessage ?? 'unknown'}`);
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
 * Send an APPROVED batch to the ERP. Requires the approval gate + Status='Approved'; then
 * Approved→Sent, posts the summary JE's lines to the ERP (all-or-nothing), and on confirmation
 * flips Sent→Posted + the member JEs AND the summary JE Batched→GLPosted.
 */
export async function sendBatch(batchId: string, contextUser: UserInfo, options: SendBatchOptions): Promise<mjBizAppsAccountingJournalEntryBatchEntity> {
  const poster = options.poster ?? mockErpPoster;
  const md = new Metadata();
  const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, contextUser);
  if (!(await batch.Load(batchId))) throw new Error(`sendBatch: batch ${batchId} not found`);
  if (batch.Status !== 'Approved') throw new Error(`sendBatch: batch ${batchId} is ${batch.Status}, only an Approved batch can be sent`);

  await options.gate.assertApproved(batchId, contextUser); // throws if not CFO-approved

  batch.Status = 'Sent';
  batch.SentAt = new Date();
  if (!(await batch.Save())) throw new Error(`sendBatch: Approved→Sent failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);

  const summaryLines = await loadSummaryLines(batch, contextUser);
  const postResult = await poster(batch, summaryLines, contextUser);
  return postResult.success
    ? await markBatchPosted(batch, postResult.externalBatchRef ?? null, contextUser)
    : await failBatch(batch, postResult.error ?? 'ERP post failed');
}

/** The summary JE's lines — what the ERP receives. */
async function loadSummaryLines(batch: mjBizAppsAccountingJournalEntryBatchEntity, contextUser: UserInfo): Promise<mjBizAppsAccountingJournalEntryLineEntity[]> {
  if (!batch.SummaryJournalEntryID) return [];
  const rv = new RunView();
  const res = await rv.RunView<mjBizAppsAccountingJournalEntryLineEntity>(
    { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${batch.SummaryJournalEntryID}'`, OrderBy: 'LineNumber', ResultType: 'entity_object', BypassCache: true },
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

/** Every Batched JE in the batch's orbit (members + summary) → GLPosted (only GL-roundtrip fields may change on a locked JE). */
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
