/**
 * The PURE CreateJournalEntry draft pipeline — stages 1-5 of the engine's 7-stage flow
 * (plan §2.2 / CH-11 + AM-4), implemented as side-effect-free functions over caller-supplied
 * lookups so they are fully unit-testable AND browser-safe (Orders' client UX can pre-validate
 * a draft with the same code the server enforces).
 *
 *   1. validateDraftShape   — ≥2 lines, ≥1 debit + ≥1 credit, exactly one side > 0 per line,
 *                             valid EffectiveDate + EntryType → MALFORMED_DRAFT
 *   2. validateAccounts     — every GLAccountID exists → ACCOUNT_UNKNOWN; active → ACCOUNT_INACTIVE
 *   3. validateDimensions   — every DimensionID/DimensionValueID pre-exists and the value belongs
 *                             to the dimension (validate-only, NEVER auto-create — CH-12)
 *                             → DIMENSION_UNKNOWN / DIMENSION_VALUE_UNKNOWN
 *   4. normalizeLines       — merge same-side lines with identical (GLAccountID, dimension set);
 *                             debits ordered before credits; LineNumber assigned 1..n
 *   5. checkDraftBalance    — Σdebits = Σcredits for the WHOLE entry AND within EACH company
 *                             (company = the line's GLAccount.CompanyID — AM-4) → UNBALANCED
 *
 * Stage 6 (the atomic write) is server-only and lives in AccountingEngine
 * (@mj-biz-apps/accounting-core-entities-server) — it consumes this pipeline's NormalizedLine[].
 *
 * CONNECTS TO:
 *   TYPES:   ./contract.ts
 *   CALLERS: AccountingEngine.CreateJournalEntry (server) · Orders client pre-validation
 *   DB FLOOR: trg_JournalEntry_BalancedOnLock 50001/50019 re-enforce balance at lock time
 *   DOC:     plans/accounting-engine-plan.md §2.2
 */
import { mjBizAppsAccountingJournalEntrySchema } from '@mj-biz-apps/accounting-entities';
import type {
  JournalEntryDraft,
  JournalEntryLineDraft,
  JEValidationError,
} from './contract.js';

/** Matches the DB triggers' rounding tolerance (trg_JournalEntry_BalancedOnLock, 50001/50019). */
export const BALANCE_TOLERANCE = 0.005;

/** What the pipeline needs to know about a GL account (supplied by the engine cache or a test fake). */
export interface AccountLookup {
  ID: string;
  CompanyID: string;
  IsActive: boolean;
}

/** Caller-supplied lookups — the engine backs these with its caches; unit tests use plain Maps. */
export interface PipelineLookups {
  /** Resolve a GL account by ID (case-insensitive on the UUID). Undefined = unknown account. */
  accountByID: (glAccountId: string) => AccountLookup | undefined;
  /** Does a Dimension with this ID exist? */
  dimensionExists: (dimensionId: string) => boolean;
  /** Does this DimensionValue exist AND belong to this Dimension? */
  dimensionValueBelongs: (dimensionId: string, dimensionValueId: string) => boolean;
}

/** A consolidated, write-ready line (stage-4 output). */
export interface NormalizedLine {
  LineNumber: number;
  GLAccountID: string;
  /** The line's company — derived from GLAccount.CompanyID (CH-2). */
  CompanyID: string;
  DebitAmount: number | null;
  CreditAmount: number | null;
  Description: string | null;
  Dimensions: { DimensionID: string; DimensionValueID: string }[];
  /** 0-based indexes of the draft lines merged into this one (for error/lineage reporting). */
  SourceLineIndexes: number[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const uuidKey = (id: string): string => (id ?? '').trim().toLowerCase();

// ─── Stage 1 — shape ─────────────────────────────────────────────────────────

export function validateDraftShape(draft: JournalEntryDraft): JEValidationError[] {
  const errors: JEValidationError[] = [];
  if (!draft || !Array.isArray(draft.Lines)) {
    return [{ Code: 'MALFORMED_DRAFT', Message: 'draft must carry a Lines array' }];
  }
  if (draft.Lines.length < 2) {
    errors.push({ Code: 'MALFORMED_DRAFT', Message: 'a journal entry needs at least two lines (double-entry)' });
  }
  const effective = new Date(draft.EffectiveDate ?? '');
  if (!draft.EffectiveDate || Number.isNaN(effective.getTime())) {
    errors.push({ Code: 'MALFORMED_DRAFT', Message: `EffectiveDate '${draft.EffectiveDate}' is not a valid ISO date` });
  }
  // EntryType against the generated Zod union — tracks the DB CHECK via CodeGen (rule 2c).
  const entryType = mjBizAppsAccountingJournalEntrySchema.shape.EntryType.safeParse(draft.EntryType);
  if (!entryType.success) {
    errors.push({ Code: 'MALFORMED_DRAFT', Message: `EntryType '${String(draft.EntryType)}' is not a valid journal-entry type` });
  }
  let debits = 0;
  let credits = 0;
  draft.Lines.forEach((line, i) => {
    const hasDebit = line.DebitAmount != null;
    const hasCredit = line.CreditAmount != null;
    if (hasDebit === hasCredit) {
      errors.push({ Code: 'MALFORMED_DRAFT', LineIndex: i, Message: 'each line must carry exactly one of DebitAmount / CreditAmount' });
      return;
    }
    const amount = hasDebit ? line.DebitAmount! : line.CreditAmount!;
    if (!(typeof amount === 'number' && Number.isFinite(amount) && amount > 0)) {
      errors.push({ Code: 'MALFORMED_DRAFT', LineIndex: i, Message: `line amount must be a finite number > 0, got ${String(amount)}` });
      return;
    }
    if (!line.GLAccountID || typeof line.GLAccountID !== 'string') {
      errors.push({ Code: 'MALFORMED_DRAFT', LineIndex: i, Message: 'line is missing its GLAccountID' });
      return;
    }
    if (hasDebit) debits++;
    else credits++;
  });
  if (draft.Lines.length >= 2 && (debits === 0 || credits === 0)) {
    errors.push({ Code: 'MALFORMED_DRAFT', Message: 'a journal entry needs at least one debit AND one credit line' });
  }
  return errors;
}

// ─── Stage 2 — accounts ──────────────────────────────────────────────────────

export function validateAccounts(draft: JournalEntryDraft, lookups: PipelineLookups): JEValidationError[] {
  const errors: JEValidationError[] = [];
  draft.Lines.forEach((line, i) => {
    const account = lookups.accountByID(line.GLAccountID);
    if (!account) {
      errors.push({ Code: 'ACCOUNT_UNKNOWN', LineIndex: i, Message: `GL account '${line.GLAccountID}' does not exist` });
    } else if (!account.IsActive) {
      errors.push({ Code: 'ACCOUNT_INACTIVE', LineIndex: i, Message: `GL account '${line.GLAccountID}' is inactive` });
    }
  });
  return errors;
}

// ─── Stage 3 — dimensions (validate-only, never auto-create — CH-12) ─────────

export function validateDimensions(draft: JournalEntryDraft, lookups: PipelineLookups): JEValidationError[] {
  const errors: JEValidationError[] = [];
  draft.Lines.forEach((line, i) => {
    for (const dim of line.Dimensions ?? []) {
      if (!lookups.dimensionExists(dim.DimensionID)) {
        errors.push({ Code: 'DIMENSION_UNKNOWN', LineIndex: i, Message: `dimension '${dim.DimensionID}' does not exist` });
      } else if (!lookups.dimensionValueBelongs(dim.DimensionID, dim.DimensionValueID)) {
        errors.push({ Code: 'DIMENSION_VALUE_UNKNOWN', LineIndex: i, Message: `dimension value '${dim.DimensionValueID}' does not exist under dimension '${dim.DimensionID}'` });
      }
    }
  });
  return errors;
}

// ─── Stage 4 — grouping + normalization ──────────────────────────────────────

/** Stable merge key: side + account + the SORTED dimension pair set. */
function mergeKey(side: 'D' | 'C', glAccountId: string, dims: { DimensionID: string; DimensionValueID: string }[]): string {
  const dimKey = dims
    .map(d => `${uuidKey(d.DimensionID)}:${uuidKey(d.DimensionValueID)}`)
    .sort()
    .join('|');
  return `${side}#${uuidKey(glAccountId)}#${dimKey}`;
}

/**
 * Merge same-side lines with identical (GLAccountID, dimension set); order debits before credits
 * (then by first appearance); assign LineNumber 1..n. Descriptions/OrderLineIDs: first non-empty
 * of the merged set (lineage note: a merge across different order lines keeps the first).
 * Requires stages 1-3 to have passed (accounts resolvable — CompanyID comes from the lookup).
 */
export function normalizeLines(draft: JournalEntryDraft, lookups: PipelineLookups): NormalizedLine[] {
  interface Bucket { line: NormalizedLine; order: number }
  const buckets = new Map<string, Bucket>();
  draft.Lines.forEach((line, i) => {
    const side: 'D' | 'C' = line.DebitAmount != null ? 'D' : 'C';
    const amount = round2(side === 'D' ? line.DebitAmount! : line.CreditAmount!);
    const dims = (line.Dimensions ?? []).map(d => ({ DimensionID: d.DimensionID, DimensionValueID: d.DimensionValueID }));
    const key = mergeKey(side, line.GLAccountID, dims);
    const existing = buckets.get(key);
    if (existing) {
      if (side === 'D') existing.line.DebitAmount = round2((existing.line.DebitAmount ?? 0) + amount);
      else existing.line.CreditAmount = round2((existing.line.CreditAmount ?? 0) + amount);
      existing.line.Description = existing.line.Description ?? line.Description ?? null;
      existing.line.SourceLineIndexes.push(i);
      return;
    }
    const account = lookups.accountByID(line.GLAccountID);
    buckets.set(key, {
      order: buckets.size,
      line: {
        LineNumber: 0, // assigned below after ordering
        GLAccountID: line.GLAccountID,
        CompanyID: account?.CompanyID ?? '',
        DebitAmount: side === 'D' ? amount : null,
        CreditAmount: side === 'C' ? amount : null,
        Description: line.Description ?? null,
        Dimensions: dims,
        SourceLineIndexes: [i],
      },
    });
  });
  const ordered = [...buckets.values()]
    .sort((a, b) => {
      const aSide = a.line.DebitAmount != null ? 0 : 1;
      const bSide = b.line.DebitAmount != null ? 0 : 1;
      return aSide !== bSide ? aSide - bSide : a.order - b.order;
    })
    .map(b => b.line);
  ordered.forEach((l, i) => { l.LineNumber = i + 1; });
  return ordered;
}

// ─── Stage 5 — balance (overall + per company — AM-4) ────────────────────────

export function checkDraftBalance(normalized: NormalizedLine[]): JEValidationError[] {
  const errors: JEValidationError[] = [];
  const overall = { debits: 0, credits: 0 };
  const byCompany = new Map<string, { debits: number; credits: number }>();
  for (const line of normalized) {
    const companyKey = uuidKey(line.CompanyID);
    const acc = byCompany.get(companyKey) ?? { debits: 0, credits: 0 };
    acc.debits += line.DebitAmount ?? 0;
    acc.credits += line.CreditAmount ?? 0;
    byCompany.set(companyKey, acc);
    overall.debits += line.DebitAmount ?? 0;
    overall.credits += line.CreditAmount ?? 0;
  }
  if (Math.abs(overall.debits - overall.credits) > BALANCE_TOLERANCE) {
    errors.push({ Code: 'UNBALANCED', Message: `entry is unbalanced: Sum(Debits)=${overall.debits.toFixed(2)} != Sum(Credits)=${overall.credits.toFixed(2)}` });
  }
  for (const [companyId, sums] of byCompany) {
    if (Math.abs(sums.debits - sums.credits) > BALANCE_TOLERANCE) {
      errors.push({ Code: 'UNBALANCED', Message: `entry is unbalanced within company ${companyId}: Sum(Debits)=${sums.debits.toFixed(2)} != Sum(Credits)=${sums.credits.toFixed(2)} (AM-4)` });
    }
  }
  return errors;
}

// ─── Composition — stages 1-5 ────────────────────────────────────────────────

export interface DraftPipelineOutcome {
  errors: JEValidationError[];
  /** Present (and non-empty) only when errors is empty. */
  normalized: NormalizedLine[];
}

/**
 * Run stages 1-5. Fails fast per stage (shape errors stop account checks, etc.) so callers get
 * the earliest-stage, most-actionable error set rather than a cascade of follow-on noise.
 */
export function runDraftPipeline(draft: JournalEntryDraft, lookups: PipelineLookups): DraftPipelineOutcome {
  const shape = validateDraftShape(draft);
  if (shape.length > 0) return { errors: shape, normalized: [] };
  const accounts = validateAccounts(draft, lookups);
  if (accounts.length > 0) return { errors: accounts, normalized: [] };
  const dims = validateDimensions(draft, lookups);
  if (dims.length > 0) return { errors: dims, normalized: [] };
  const normalized = normalizeLines(draft, lookups);
  const balance = checkDraftBalance(normalized);
  if (balance.length > 0) return { errors: balance, normalized: [] };
  return { errors: [], normalized };
}
