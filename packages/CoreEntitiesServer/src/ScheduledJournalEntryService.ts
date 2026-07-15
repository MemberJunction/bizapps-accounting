/**
 * ScheduledJournalEntryService — Block 4 (S3). Scheduled/recurring JE schedule CREATION.
 *
 *   createScheduledEntries(): lay down a straight-line schedule — N ScheduledJournalEntry rows (one per
 *     period, sequence i of N) each with a balanced Dr/Cr line pair, summing EXACTLY to the total (the
 *     rounding remainder is spread cent-by-cent, never lost). This is how a rev-rec waterfall / prepaid
 *     amortization / depreciation schedule is recorded ahead of time.
 *
 *   ℹ The DATE-driven MATERIALIZER is REINSTATED per MOD-11 (2026-07-13, supersedes the AM-6
 *     retirement): recognition fires BY DATE, not by period close. It lives in
 *     ./MaterializationService (materializeDueScheduledEntries) + the B3.2 op; this service owns
 *     schedule CREATION (B3.1). Producers persist forward-dated schedules at booking-lock (MOD-11).
 *
 * Per §C1 the *origin* of a schedule is usually upstream (Orders/Contracts) — Accounting RECEIVES the rows;
 * createScheduledEntries() is the Accounting-side helper for accruals it owns + for seeding.
 *
 * CONNECTS TO:
 *   READS/WRITES: Scheduled Journal Entries (+ Line Items + Line Dimensions)
 *   ENTITY:       'MJ_BizApps_Accounting: Scheduled Journal Entries'
 *   DOC:          docs/lifecycle-hooks.md (S3) · docs/ARCHITECTURE.md · plan §C1
 */
import { IMetadataProvider, LogError, Metadata, UserInfo } from '@memberjunction/core';
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

// ─── The ATOMIC set operation ('Accounting.CreateScheduledJournalEntries', B3.1 / MOD-5) ─────
// Amith's transaction rule extended to scheduled JEs: the whole schedule (N dated SJE rows + their
// balanced line pairs, plus any supersede marks) writes in ONE TransactionGroup — all or nothing.
// Per MOD-11 the producer (orders F4) calls this at booking-lock with every entry's recognition DATE.

export interface ScheduledJournalEntriesInput {
  CompanyID: string;
  EntryType: ScheduledEntryType;
  CurrencyCode: string;
  TotalAmount: number;
  DebitGLAccountID: string;
  CreditGLAccountID: string;
  /** ISO recognition dates, one per installment (MOD-11 — 12 for an annual sub, 1 for an event). */
  RecognitionDates: string[];
  Description?: string;
  SubscriptionID?: string | null;
  OrderID?: string | null;
  OrderLineID?: string | null;
  /** On a recompute (renewal/amendment): SJE ids to mark Superseded — never touches materialized (Generated) rows. */
  SupersedeScheduledEntryIDs?: string[];
}

export interface ScheduleValidationError {
  Code: 'MALFORMED_SCHEDULE' | 'INTERNAL_ERROR';
  Message: string;
}

export interface ScheduledJournalEntriesResult {
  Success: boolean;
  ScheduledEntryIDs?: string[];
  Errors?: ScheduleValidationError[];
}

/** Structural validation (balanced pairs + amounts-sum-to-total hold BY CONSTRUCTION downstream). */
function validateScheduleInput(input: ScheduledJournalEntriesInput): ScheduleValidationError[] {
  const errs: ScheduleValidationError[] = [];
  const bad = (m: string) => errs.push({ Code: 'MALFORMED_SCHEDULE', Message: m });
  if (!input.CompanyID) bad('CompanyID is required.');
  if (!(input.RecognitionDates?.length > 0)) bad('At least one recognition date is required.');
  if (!(input.TotalAmount >= 0)) bad(`TotalAmount must be >= 0, got ${input.TotalAmount}.`);
  if (!input.DebitGLAccountID || !input.CreditGLAccountID) bad('Both a debit and a credit GL account are required.');
  if (input.DebitGLAccountID && input.DebitGLAccountID === input.CreditGLAccountID) bad('The debit and credit accounts must differ.');
  if ((input.RecognitionDates ?? []).some(d => Number.isNaN(new Date(d).getTime()))) bad('One or more recognition dates are invalid.');
  return errs;
}

/**
 * Persist a whole schedule atomically (B3.1). Validates, computes the straight-line installments
 * (rounding remainder spread, sums EXACTLY to total), queues the N dated SJE rows + their balanced
 * Dr/Cr line pairs — and any supersede marks — onto ONE TransactionGroup, and submits once. Never
 * throws for logical failures; returns the typed result. Supersede skips already-materialized rows.
 */
export async function createScheduledJournalEntriesAtomic(
  input: ScheduledJournalEntriesInput,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<ScheduledJournalEntriesResult> {
  try {
    const errors = validateScheduleInput(input);
    if (errors.length) return { Success: false, Errors: errors };

    const amounts = computeStraightLineSchedule(input.TotalAmount, input.RecognitionDates.length);
    const tg = await provider.CreateTransactionGroup();
    const ids: string[] = [];
    for (let i = 0; i < input.RecognitionDates.length; i++) {
      const sje = await provider.GetEntityObject<mjBizAppsAccountingScheduledJournalEntryEntity>(SJE_ENTITY, contextUser);
      sje.NewRecord();
      sje.CompanyID = input.CompanyID;
      sje.EntryType = input.EntryType;
      sje.Status = 'Scheduled';
      sje.ScheduleSequence = i + 1;
      sje.ScheduleCount = input.RecognitionDates.length;
      sje.ScheduledEffectiveDate = new Date(input.RecognitionDates[i]);
      sje.CurrencyCode = input.CurrencyCode;
      sje.TotalAmount = amounts[i];
      sje.Description = input.Description ?? null;
      if (input.SubscriptionID) sje.SubscriptionID = input.SubscriptionID;
      if (input.OrderID) sje.OrderID = input.OrderID;
      if (input.OrderLineID) sje.OrderLineID = input.OrderLineID;
      sje.TransactionGroup = tg;
      if (!(await sje.Save())) return failAtomic('SJE header failed to queue', sje.LatestResult?.CompleteMessage);
      await queueScheduledLinePair(sje.ID, input.DebitGLAccountID, input.CreditGLAccountID, amounts[i], tg, contextUser, provider);
      ids.push(sje.ID);
    }
    const supersedeErr = await queueSupersedes(input.SupersedeScheduledEntryIDs ?? [], ids[0], tg, contextUser, provider);
    if (supersedeErr) return { Success: false, Errors: [supersedeErr] };

    if (!(await tg.Submit())) {
      return { Success: false, Errors: [{ Code: 'INTERNAL_ERROR', Message: 'atomic schedule write rolled back' }] };
    }
    return { Success: true, ScheduledEntryIDs: ids };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    LogError(`createScheduledJournalEntriesAtomic failed: ${msg}`);
    return { Success: false, Errors: [{ Code: 'INTERNAL_ERROR', Message: msg }] };
  }
}

function failAtomic(stage: string, detail: string | undefined): ScheduledJournalEntriesResult {
  return { Success: false, Errors: [{ Code: 'INTERNAL_ERROR', Message: `${stage}: ${detail ?? 'unknown error'}` }] };
}

/** Queue a balanced Dr/Cr line pair for one SJE onto the caller's TransactionGroup. */
async function queueScheduledLinePair(
  sjeId: string,
  debitGL: string,
  creditGL: string,
  amount: number,
  tg: Awaited<ReturnType<IMetadataProvider['CreateTransactionGroup']>>,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<void> {
  const sides = [
    { lineNo: 1, gl: debitGL, debit: amount as number | null, credit: null as number | null },
    { lineNo: 2, gl: creditGL, debit: null as number | null, credit: amount as number | null },
  ];
  for (const s of sides) {
    const li = await provider.GetEntityObject<mjBizAppsAccountingScheduledJournalEntryLineItemEntity>(SJELI_ENTITY, contextUser);
    li.NewRecord();
    li.ScheduledJournalEntryID = sjeId;
    li.LineNumber = s.lineNo;
    li.GLAccountID = s.gl;
    li.DebitAmount = s.debit;
    li.CreditAmount = s.credit;
    li.TransactionGroup = tg;
    if (!(await li.Save())) throw new Error(`scheduled line ${s.lineNo} failed to queue: ${li.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
}

/** Mark prior SJEs Superseded (recompute) — ONLY still-Scheduled rows; never a materialized (Generated) one. */
async function queueSupersedes(
  supersedeIds: string[],
  supersededByHeadId: string,
  tg: Awaited<ReturnType<IMetadataProvider['CreateTransactionGroup']>>,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<ScheduleValidationError | null> {
  for (const id of supersedeIds) {
    const old = await provider.GetEntityObject<mjBizAppsAccountingScheduledJournalEntryEntity>(SJE_ENTITY, contextUser);
    if (!(await old.Load(id))) continue; // gone — nothing to supersede
    if (old.Status !== 'Scheduled') continue; // never touch materialized/cancelled rows (§4.6)
    old.Status = 'Superseded';
    old.SupersededByScheduledJournalEntryID = supersededByHeadId;
    old.TransactionGroup = tg;
    if (!(await old.Save())) return { Code: 'INTERNAL_ERROR', Message: `supersede of ${id} failed to queue: ${old.LatestResult?.CompleteMessage ?? 'unknown'}` };
  }
  return null;
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
