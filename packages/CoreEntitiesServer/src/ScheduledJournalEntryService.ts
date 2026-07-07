/**
 * ScheduledJournalEntryService — Block 4 (S3). Scheduled/recurring JE schedule CREATION.
 *
 *   createScheduledEntries(): lay down a straight-line schedule — N ScheduledJournalEntry rows (one per
 *     period, sequence i of N) each with a balanced Dr/Cr line pair, summing EXACTLY to the total (the
 *     rounding remainder is spread cent-by-cent, never lost). This is how a rev-rec waterfall / prepaid
 *     amortization / depreciation schedule is recorded ahead of time.
 *
 *   ⚠ The MATERIALIZER (materializeDueScheduledEntries) was RETIRED 2026-07-06 (AM-6): there is no
 *     period-close materialization — periods are removed; DOMAIN entity servers (e.g. a future
 *     SubscriptionEntityServer) generate the real Pending JournalEntry when a scheduled row comes due.
 *     Robert to walk through the pattern; do not reintroduce a central materializer here.
 *
 * Per §C1 the *origin* of a schedule is usually upstream (Orders/Contracts) — Accounting RECEIVES the rows;
 * createScheduledEntries() is the Accounting-side helper for accruals it owns + for seeding.
 *
 * CONNECTS TO:
 *   READS/WRITES: Scheduled Journal Entries (+ Line Items + Line Dimensions)
 *   ENTITY:       'MJ_BizApps_Accounting: Scheduled Journal Entries'
 *   DOC:          docs/lifecycle-hooks.md (S3) · docs/ARCHITECTURE.md · plan §C1
 */
import { Metadata, UserInfo } from '@memberjunction/core';
import type {
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingScheduledJournalEntryEntity,
  mjBizAppsAccountingScheduledJournalEntryLineItemEntity,
} from '@mj-biz-apps/accounting-entities';

const SJE_ENTITY = 'MJ_BizApps_Accounting: Scheduled Journal Entries';
const SJELI_ENTITY = 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Items';

// Rule 2c: derive the value-list unions from the generated entities — they track the CHECK
// constraints via CodeGen, so a widened enum surfaces here as a compile error, not silent drift.
export type ScheduledEntryType = mjBizAppsAccountingScheduledJournalEntryEntity['EntryType'];
export type JournalEntryType = mjBizAppsAccountingJournalEntryEntity['EntryType'];

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

export interface SchedulePeriod { effectiveDate: Date }
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
