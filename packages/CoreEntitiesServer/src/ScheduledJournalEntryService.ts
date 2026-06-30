/**
 * ScheduledJournalEntryService — Block 4 (S3). Scheduled/recurring JE schedules + their materialization.
 *
 *   createScheduledEntries(): lay down a straight-line schedule — N ScheduledJournalEntry rows (one per
 *     period, sequence i of N) each with a balanced Dr/Cr line pair, summing EXACTLY to the total (the
 *     rounding remainder is spread cent-by-cent, never lost). This is how a rev-rec waterfall / prepaid
 *     amortization / depreciation schedule is recorded ahead of time.
 *   materializeDueScheduledEntries(): the S3 scheduled action — turn every DUE `Scheduled` row
 *     (ScheduledEffectiveDate ≤ asOf) into a real Pending JournalEntry (lines + dimensions copied, EntryType
 *     mapped to the JE vocabulary), back-reference it, and flip the row to `Generated`. Idempotent: a
 *     `Generated` row is never materialized twice (CK_SJE_GeneratedCoherence enforces the one-JE link).
 *
 * Per §C1 the *origin* of a schedule is usually upstream (Orders/Contracts) — Accounting RECEIVES the rows;
 * createScheduledEntries() is the Accounting-side helper for period-end accruals it owns + for seeding.
 *
 * CONNECTS TO:
 *   READS/WRITES: Scheduled Journal Entries (+ Line Items + Line Dimensions) · Journal Entries (+ Lines + Dims)
 *   HOOKS:        the materialized JE saves through JournalEntryEntityServer → W2 numbering, W4 closed-period routing
 *   GATES:        a `Scheduled` row in a period blocks that period's close (W7 validateCloseable) until materialized
 *   ENTITY:       'MJ_BizApps_Accounting: Scheduled Journal Entries'
 *   DOC:          docs/lifecycle-hooks.md (S3) · docs/ARCHITECTURE.md · plan §C1
 */
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import type {
  mjBizAppsAccountingScheduledJournalEntryEntity,
  mjBizAppsAccountingScheduledJournalEntryLineItemEntity,
  mjBizAppsAccountingScheduledJournalEntryLineDimensionEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingJournalEntryLineDimensionEntity,
} from '@mj-biz-apps/accounting-entities';

const SJE_ENTITY = 'MJ_BizApps_Accounting: Scheduled Journal Entries';
const SJELI_ENTITY = 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Items';
const SJELD_ENTITY = 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Dimensions';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';

export type ScheduledEntryType = 'DeferredRevenueRelease' | 'DepreciationAccrual' | 'Manual' | 'PeriodEndAccrual' | 'PrepaidAmortization' | 'RevenueRecognition';
export type JournalEntryType = 'Adjustment' | 'CommissionAccrual' | 'FXRevaluation' | 'IntercompanyFlow' | 'Manual' | 'OpeningBalance' | 'OrderBooking' | 'PartnerRevShare' | 'PaymentReceipt' | 'PeriodEndAccrual' | 'Refund' | 'RevenueRecognition' | 'Reversal' | 'TaxRemittance' | 'WaterfallDistribution' | 'Writeoff';

// ─── Pure helpers (unit-tested without a DB) ─────────────────────────────────

/**
 * Map a ScheduledJournalEntry.EntryType to a valid JournalEntry.EntryType (the SJE enum is NOT a subset of
 * the JE enum). Releasing deferred revenue IS revenue recognition; amortization/depreciation are period-end accruals.
 */
export function mapScheduledEntryType(sjeType: ScheduledEntryType): JournalEntryType {
  switch (sjeType) {
    case 'RevenueRecognition':
    case 'DeferredRevenueRelease':
      return 'RevenueRecognition';
    case 'PrepaidAmortization':
    case 'DepreciationAccrual':
    case 'PeriodEndAccrual':
      return 'PeriodEndAccrual';
    case 'Manual':
      return 'Manual';
  }
}

/**
 * Split `total` into `count` straight-line installments (decimal(18,2)). The rounding remainder is distributed
 * one cent at a time across the earliest periods, so every installment is within a cent of the rest and the
 * installments sum to EXACTLY `total` — no penny created or lost.
 */
export function computeStraightLineSchedule(total: number, count: number): number[] {
  if (!Number.isInteger(count) || count <= 0) throw new Error(`schedule count must be a positive integer, got ${count}`);
  if (total < 0) throw new Error(`schedule total must be >= 0, got ${total}`);
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count; // 0..count-1 leftover cents
  const cents = Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
  return cents.map(c => c / 100);
}

// ─── Schedule creation ───────────────────────────────────────────────────────

export interface SchedulePeriod { accountingPeriodId: string; effectiveDate: Date }
export interface CreateScheduleSpec {
  companyId: string;
  entryType: ScheduledEntryType;
  currencyCode: string;
  totalAmount: number;
  /** the GL account debited each installment (e.g. Deferred Revenue for a rev-rec release). */
  debitGLAccountId: string;
  /** the GL account credited each installment (e.g. Revenue). */
  creditGLAccountId: string;
  /** one entry per installment; length defines the schedule count + ordering. */
  periods: SchedulePeriod[];
  description?: string;
  subscriptionId?: string | null;
}

/** Create the N Scheduled rows (+ a balanced Dr/Cr line pair each) for a straight-line schedule. Returns the SJE ids. */
export async function createScheduledEntries(spec: CreateScheduleSpec, contextUser: UserInfo): Promise<string[]> {
  const count = spec.periods.length;
  if (count === 0) throw new Error('createScheduledEntries: at least one period is required');
  const amounts = computeStraightLineSchedule(spec.totalAmount, count);
  const md = new Metadata();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const sje = await md.GetEntityObject<mjBizAppsAccountingScheduledJournalEntryEntity>(SJE_ENTITY, contextUser);
    sje.NewRecord();
    sje.CompanyID = spec.companyId;
    sje.EntryType = spec.entryType;
    sje.Status = 'Scheduled';
    sje.ScheduleSequence = i + 1;
    sje.ScheduleCount = count;
    sje.ScheduledEffectiveDate = spec.periods[i].effectiveDate;
    sje.TargetAccountingPeriodID = spec.periods[i].accountingPeriodId;
    sje.CurrencyCode = spec.currencyCode;
    sje.TotalAmount = amounts[i];
    sje.Description = spec.description ?? null;
    if (spec.subscriptionId) sje.SubscriptionID = spec.subscriptionId;
    if (!(await sje.Save())) throw new Error(`createScheduledEntries: SJE ${i + 1}/${count} save failed: ${sje.LatestResult?.CompleteMessage ?? 'unknown'}`);
    await createScheduledLinePair(sje.ID, spec.debitGLAccountId, spec.creditGLAccountId, amounts[i], contextUser);
    ids.push(sje.ID);
  }
  return ids;
}

async function createScheduledLinePair(sjeId: string, debitGL: string, creditGL: string, amount: number, contextUser: UserInfo): Promise<void> {
  const md = new Metadata();
  const sides: Array<{ lineNo: number; gl: string; debit: number | null; credit: number | null }> = [
    { lineNo: 1, gl: debitGL, debit: amount, credit: null },
    { lineNo: 2, gl: creditGL, debit: null, credit: amount },
  ];
  for (const s of sides) {
    const li = await md.GetEntityObject<mjBizAppsAccountingScheduledJournalEntryLineItemEntity>(SJELI_ENTITY, contextUser);
    li.NewRecord();
    li.ScheduledJournalEntryID = sjeId;
    li.LineNumber = s.lineNo;
    li.GLAccountID = s.gl;
    li.DebitAmount = s.debit;
    li.CreditAmount = s.credit;
    if (!(await li.Save())) throw new Error(`createScheduledEntries: line ${s.lineNo} save failed: ${li.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
}

// ─── S3 materializer ───────────────────────────────────────────────────────

export interface MaterializeResult { materialized: number; journalEntryIds: string[] }

/** Materialize every DUE Scheduled row (ScheduledEffectiveDate ≤ asOf) for a company into Pending JEs. */
export async function materializeDueScheduledEntries(companyId: string, asOf: Date, contextUser: UserInfo): Promise<MaterializeResult> {
  const due = await loadDueScheduledEntries(companyId, asOf, contextUser);
  const journalEntryIds: string[] = [];
  for (const sjeId of due) journalEntryIds.push(await materializeOne(sjeId, contextUser));
  return { materialized: journalEntryIds.length, journalEntryIds };
}

async function loadDueScheduledEntries(companyId: string, asOf: Date, contextUser: UserInfo): Promise<string[]> {
  const rv = new RunView();
  const asOfStr = asOf.toISOString().slice(0, 10);
  const res = await rv.RunView<{ ID: string }>(
    { EntityName: SJE_ENTITY, ExtraFilter: `CompanyID='${companyId}' AND Status='Scheduled' AND ScheduledEffectiveDate <= '${asOfStr}'`, Fields: ['ID'], OrderBy: 'ScheduledEffectiveDate ASC, ScheduleSequence ASC', ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  return (res.Results ?? []).map(r => r.ID);
}

/** Materialize one Scheduled row → a Pending JE; flip the row to Generated. Returns the new JE id. */
async function materializeOne(sjeId: string, contextUser: UserInfo): Promise<string> {
  const md = new Metadata();
  const sje = await md.GetEntityObject<mjBizAppsAccountingScheduledJournalEntryEntity>(SJE_ENTITY, contextUser);
  if (!(await sje.Load(sjeId))) throw new Error(`materialize: scheduled entry ${sjeId} not found`);
  if (!sje.TargetAccountingPeriodID) throw new Error(`materialize: scheduled entry ${sjeId} has no TargetAccountingPeriodID (cannot resolve a period)`);

  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, contextUser);
  je.NewRecord();
  je.CompanyID = sje.CompanyID;
  je.AccountingPeriodID = sje.TargetAccountingPeriodID;
  je.EffectiveDate = sje.ScheduledEffectiveDate;
  je.EntryType = mapScheduledEntryType(sje.EntryType);
  je.Status = 'Pending';
  je.ScheduledJournalEntryID = sje.ID;
  je.Description = sje.Description ?? `Materialized from scheduled entry ${sje.ScheduleSequence}/${sje.ScheduleCount}`;
  if (!(await je.Save())) throw new Error(`materialize: JE save failed for SJE ${sjeId}: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);

  await copyScheduledLines(sje.ID, je.ID, contextUser);
  await markScheduledGenerated(sje, je.ID);
  return je.ID;
}

/** Copy the scheduled line items (+ their dimension tags) onto the materialized JE. */
async function copyScheduledLines(sjeId: string, jeId: string, contextUser: UserInfo): Promise<void> {
  const rv = new RunView();
  const lineRes = await rv.RunView<{ ID: string; LineNumber: number; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null; Description: string | null }>(
    { EntityName: SJELI_ENTITY, ExtraFilter: `ScheduledJournalEntryID='${sjeId}'`, OrderBy: 'LineNumber ASC', Fields: ['ID', 'LineNumber', 'GLAccountID', 'DebitAmount', 'CreditAmount', 'Description'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const md = new Metadata();
  for (const sl of lineRes.Results ?? []) {
    const line = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, contextUser);
    line.NewRecord();
    line.JournalEntryID = jeId;
    line.LineNumber = sl.LineNumber;
    line.GLAccountID = sl.GLAccountID;
    line.DebitAmount = sl.DebitAmount;
    line.CreditAmount = sl.CreditAmount;
    line.Description = sl.Description;
    if (!(await line.Save())) throw new Error(`materialize: JE line ${sl.LineNumber} save failed: ${line.LatestResult?.CompleteMessage ?? 'unknown'}`);
    await copyScheduledLineDimensions(sl.ID, line.ID, contextUser);
  }
}

async function copyScheduledLineDimensions(scheduledLineItemId: string, jeLineId: string, contextUser: UserInfo): Promise<void> {
  const rv = new RunView();
  const dimRes = await rv.RunView<{ DimensionID: string; DimensionValueID: string }>(
    { EntityName: SJELD_ENTITY, ExtraFilter: `ScheduledJournalEntryLineItemID='${scheduledLineItemId}'`, Fields: ['DimensionID', 'DimensionValueID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const md = new Metadata();
  for (const d of dimRes.Results ?? []) {
    const dim = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineDimensionEntity>(JELD_ENTITY, contextUser);
    dim.NewRecord();
    dim.JournalEntryLineID = jeLineId;
    dim.DimensionID = d.DimensionID;
    dim.DimensionValueID = d.DimensionValueID;
    if (!(await dim.Save())) throw new Error(`materialize: JE line dimension save failed: ${dim.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
}

async function markScheduledGenerated(sje: mjBizAppsAccountingScheduledJournalEntryEntity, jeId: string): Promise<void> {
  sje.Status = 'Generated';
  sje.GeneratedJournalEntryID = jeId;
  sje.GeneratedAt = new Date();
  if (!(await sje.Save())) throw new Error(`materialize: failed to flip SJE ${sje.ID} to Generated: ${sje.LatestResult?.CompleteMessage ?? 'unknown'}`);
}
