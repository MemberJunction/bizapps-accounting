import { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';

/** Value-list unions derived from the generated entity (rule 2c — never hand-copied). */
export type JEStatus = mjBizAppsAccountingJournalEntryEntity['Status'];
export type JEType = mjBizAppsAccountingJournalEntryEntity['EntryType'];

/**
 * Client-side JE rules — the pure seams behind the JE surfaces (tier-1 boundary).
 *
 * These MIRROR server guards; they do not replace them. The server is the authority (the DB
 * triggers + `JournalEntryEntityServer` enforce these regardless of what the UI offers). Their job
 * here is to stop the UI offering a verb the server will reject — a disabled button beats a failed
 * mutation. Extracted so the mirroring is unit-testable and reviewable against the server rule,
 * instead of buried in a component.
 */

/** The fields any reversal decision depends on. Structural, so any row shape can be passed. */
export interface ReversalCandidate {
  ReversedByJournalEntryID: string | null;
  ReversesJournalEntryID: string | null;
  EntryType: JEType;
}

/**
 * Can this entry be reversed?
 *
 * Mirrors `JournalEntryEntityServer.generateReversal`'s guard:
 *  - never reverse twice (already has a reversal pointing back at it),
 *  - never reverse a reversal — by EITHER signal: the back-pointer (`ReversesJournalEntryID`) or
 *    the type. Both are checked because they are set independently, and a reversal chain is how
 *    you get an infinite Dr/Cr loop.
 *
 * Note it is deliberately status-INDEPENDENT: a Batched/GLPosted entry is still reversible (that
 * is the whole point of a reversal — you cannot delete posted history, you offset it).
 */
export function canReverse(entry: ReversalCandidate): boolean {
  if (entry.ReversedByJournalEntryID) return false;
  if (entry.ReversesJournalEntryID) return false;
  if (entry.EntryType === 'Reversal') return false;
  return true;
}

/** Why the reverse verb is unavailable — shown as the disabled button's tooltip. */
export function reversalBlockedReason(entry: ReversalCandidate): string | null {
  if (entry.ReversedByJournalEntryID) return 'This entry has already been reversed.';
  if (entry.ReversesJournalEntryID || entry.EntryType === 'Reversal') return 'A reversal entry cannot itself be reversed.';
  return null;
}

/**
 * The set of entries C.8 is DESIGNED to hold behind the CFO gate: a Manual entry still Pending.
 *
 * ⚠ The gate is NOT ENFORCED TODAY — do not let the UI claim otherwise. `JournalEntry.Status` has
 * only three values (`Pending | Batched | GLPosted`); there is no `Approved` state, and the server's
 * candidate filter (`pendingCandidateFilter`, JournalEntryBatchEngine.ts) selects on `Status='Pending'` with
 * no entry-type exclusion. So a Manual Pending entry IS batchable right now, and any copy saying
 * "cannot be batched until approved" is false.
 *
 * C.8's shape is still open — held as "lean yes" pending Robert (plans/QUESTIONS.md#q6 (3)) — which
 * is why this predicate identifies the set without asserting a control over it. Callers should
 * surface it as "awaiting review, gate not yet in force", not as a block.
 */
export function awaitsApproval(entry: { Status: JEStatus; EntryType: JEType }): boolean {
  return entry.EntryType === 'Manual' && entry.Status === 'Pending';
}

/** Dr must equal Cr. Money is compared at cent tolerance — never with `===` on floats. */
export function isBalanced(totalDebits: number, totalCredits: number): boolean {
  return Math.abs(totalDebits - totalCredits) < 0.005;
}

/** mj-stat-badge variant for a ledger status. */
export function statusVariant(status: JEStatus): 'success' | 'info' | 'warning' | 'default' {
  switch (status) {
    case 'GLPosted':
      return 'success';
    case 'Batched':
      return 'info';
    case 'Pending':
      return 'warning';
    default:
      // Total by construction today; `default` keeps this exhaustive if CodeGen widens the CHECK.
      return 'default';
  }
}
