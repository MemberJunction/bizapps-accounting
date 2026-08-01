import type { CreateJournalEntryInput, JournalEntryLineDraft } from './contract.js';
import { isBalanced } from './je-rules.js';

/**
 * The pure state + rules behind the JE workspace's line editor (§8.1).
 *
 * Extracted from the component per the tier-1 boundary doctrine: the money math, the one-side-only
 * rule, the balance check and the draft→contract mapping are total, synchronous functions with no
 * Angular and no DB, so they get exhaustively unit-tested here and the shell around them stays at
 * tier 4.
 *
 * These checks MIRROR the engine's guards (`AccountingEngine.CreateJournalEntry` → pipeline.ts) —
 * they do not replace them. The server is the authority (and the balanced-JE DB trigger 50001 is the
 * un-bypassable backstop); this exists so the operator sees "Dr ≠ Cr" while typing instead of after
 * a round-trip.
 *
 * CONNECTS TO:
 *   CONTRACT: ./contract (CreateJournalEntryInput / JournalEntryLineDraft)
 *   SHARED:   ./je-rules (isBalanced — one cent-tolerance rule for the whole app)
 */

/** One editable row. Amounts stay as RAW TEXT so a half-typed "8." survives a change-detection pass. */
export interface JEDraftLine {
  /** Stable identity for `@for` tracking — rows reorder/delete, so an index would misbind inputs. */
  Key: string;
  GLAccountID: string | null;
  Debit: string;
  Credit: string;
  Description: string;
  /** DimensionID → DimensionValueID. Only pre-existing values are ever sent (CH-12: never auto-create). */
  DimensionValueIDs: Record<string, string | null>;
}

export interface JEDraftState {
  /**
   * Scopes the account picker ONLY — it is deliberately NOT sent.
   *
   * `JournalEntryDraft` carries no CompanyID: the engine derives the company from the lines'
   * GLAccount.CompanyID and rejects a cross-company draft with MULTI_COMPANY_DRAFT (MOD-12). Sending
   * a company would create a second source of truth that could disagree with the accounts.
   */
  CompanyID: string | null;
  /** `yyyy-mm-dd`, as typed. UTC-safe: a DATE has no zone (repo convention: store UTC). */
  EffectiveDate: string;
  Description: string;
  Lines: JEDraftLine[];
  /** Set once submitted — the tab becomes a read-only record of the created entry. */
  CreatedEntryNumber?: string;
}

export function newDraftLine(key: string): JEDraftLine {
  return { Key: key, GLAccountID: null, Debit: '', Credit: '', Description: '', DimensionValueIDs: {} };
}

/**
 * Parse a money input. Blank → 0 (an untouched side is not an error). Anything non-numeric → NaN,
 * which `lineIssue` reports rather than silently coercing to 0 — a typo must never book as zero.
 */
export function parseMoney(text: string): number {
  const t = (text ?? '').trim();
  if (t === '') return 0;
  return Number(t.replace(/,/g, ''));
}

/** A row the operator has not touched — ignored entirely rather than reported as invalid. */
export function isLineEmpty(line: JEDraftLine): boolean {
  return !line.GLAccountID && parseMoney(line.Debit) === 0 && parseMoney(line.Credit) === 0 && !line.Description.trim();
}

export function draftTotals(lines: JEDraftLine[]): { Debits: number; Credits: number } {
  let Debits = 0;
  let Credits = 0;
  for (const l of lines) {
    if (isLineEmpty(l)) continue;
    const d = parseMoney(l.Debit);
    const c = parseMoney(l.Credit);
    if (Number.isFinite(d)) Debits += d;
    if (Number.isFinite(c)) Credits += c;
  }
  return { Debits, Credits };
}

/**
 * Why this line can't be submitted, or null. Mirrors the engine's per-line rules: an account, and
 * exactly ONE side strictly greater than zero.
 */
export function lineIssue(line: JEDraftLine): string | null {
  if (isLineEmpty(line)) return null;
  const d = parseMoney(line.Debit);
  const c = parseMoney(line.Credit);
  if (!Number.isFinite(d) || !Number.isFinite(c)) return 'Amounts must be numbers.';
  if (d < 0 || c < 0) return 'Amounts cannot be negative — use the other column instead.';
  if (!line.GLAccountID) return 'Pick an account.';
  if (d > 0 && c > 0) return 'A line is either a debit or a credit, not both.';
  if (d === 0 && c === 0) return 'Enter a debit or a credit.';
  return null;
}

/** Every issue blocking submission, in reading order. Empty ⇒ the draft is submittable. */
export function draftIssues(state: JEDraftState): string[] {
  const issues: string[] = [];
  const live = state.Lines.filter((l) => !isLineEmpty(l));

  if (!state.EffectiveDate) issues.push('Pick an entry date.');
  if (live.length < 2) issues.push('A journal entry needs at least two lines.');

  for (const [i, l] of live.entries()) {
    const issue = lineIssue(l);
    if (issue) issues.push(`Line ${i + 1}: ${issue}`);
  }

  // Only assert balance once the lines themselves are sound — otherwise a single typo reports twice.
  if (live.length >= 2 && !live.some((l) => lineIssue(l))) {
    const { Debits, Credits } = draftTotals(state.Lines);
    if (!isBalanced(Debits, Credits)) {
      issues.push(`Debits (${Debits.toFixed(2)}) must equal credits (${Credits.toFixed(2)}).`);
    }
  }
  return issues;
}

/**
 * Map the editor state onto the engine contract.
 *
 * Drops empty rows, sends only the side that carries an amount (the contract's optional
 * Debit/CreditAmount means "absent", not "zero"), and passes only dimension pairs the operator
 * actually chose.
 */
export function toCreateInput(state: JEDraftState): CreateJournalEntryInput {
  const Lines: JournalEntryLineDraft[] = state.Lines.filter((l) => !isLineEmpty(l)).map((l) => {
    const debit = parseMoney(l.Debit);
    const credit = parseMoney(l.Credit);
    const dimensions = Object.entries(l.DimensionValueIDs)
      .filter((entry): entry is [string, string] => !!entry[1])
      .map(([DimensionID, DimensionValueID]) => ({ DimensionID, DimensionValueID }));

    const line: JournalEntryLineDraft = { GLAccountID: l.GLAccountID as string };
    if (debit > 0) line.DebitAmount = debit;
    if (credit > 0) line.CreditAmount = credit;
    if (l.Description.trim()) line.Description = l.Description.trim();
    if (dimensions.length) line.Dimensions = dimensions;
    return line;
  });

  const input: CreateJournalEntryInput = {
    EffectiveDate: state.EffectiveDate,
    // The workspace is the MANUAL-entry home (§8.1). A single literal into the generated union is
    // fine; what rule 2c forbids is restating the union itself.
    EntryType: 'Manual',
    Lines,
  };
  if (state.Description.trim()) input.Description = state.Description.trim();
  return input;
}
