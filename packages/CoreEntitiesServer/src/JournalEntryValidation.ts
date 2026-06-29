/**
 * F1 — validateJournalEntry: a post-time guard a caller (e.g. AccountingService, Block 2) runs
 * before locking/batching a JE. Checks balance, two-line minimum, period-open, and GL-active.
 * Read-only — returns findings; never mutates. The hard guarantees still live in DB triggers
 * (balanced-on-lock, period-close); this surfaces a clean, aggregated error earlier.
 *
 * CONNECTS TO:
 *   CALLED BY:  AccountingService.postJournalEntry (Block 2) · block1-runtime harness
 *   READS:      Journal Entries · Journal Entry Lines · Accounting Periods · GL Accounts
 *   ENTITY:     'MJ_BizApps_Accounting: Journal Entries'
 *   DOC:        docs/ARCHITECTURE.md#je-lifecycle
 */
import { RunView, UserInfo } from '@memberjunction/core';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

const BALANCE_TOLERANCE = 0.005; // matches trg_JournalEntry_BalancedOnLock

export interface JournalEntryValidationResult {
  valid: boolean;
  errors: string[];
}

interface JERow { ID: string; AccountingPeriodID: string; }
interface LineRow { GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null; }

export async function validateJournalEntry(
  journalEntryId: string,
  contextUser: UserInfo,
): Promise<JournalEntryValidationResult> {
  const rv = new RunView();
  const [jeRes, lineRes] = await rv.RunViews([
    { EntityName: JE_ENTITY, ExtraFilter: `ID='${journalEntryId}'`, Fields: ['ID', 'AccountingPeriodID'], ResultType: 'simple' },
    { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${journalEntryId}'`, Fields: ['GLAccountID', 'DebitAmount', 'CreditAmount'], ResultType: 'simple' },
  ], contextUser);

  if (!jeRes.Success || (jeRes.Results?.length ?? 0) === 0) {
    return { valid: false, errors: [`JournalEntry ${journalEntryId} not found`] };
  }
  const je = jeRes.Results[0] as JERow;
  const lines = (lineRes.Results ?? []) as LineRow[];

  const errors: string[] = [
    ...checkBalance(lines),
    ...(await checkPeriodOpen(rv, je.AccountingPeriodID, contextUser)),
    ...(await checkGLAccountsActive(rv, lines, contextUser)),
  ];
  return { valid: errors.length === 0, errors };
}

export interface BalanceLine { DebitAmount: number | null; CreditAmount: number | null; }

/** Pure, exported for unit testing: balance + two-line-minimum checks. */
export function checkBalance(lines: BalanceLine[]): string[] {
  const errors: string[] = [];
  if (lines.length < 2) {
    errors.push('a journal entry must have at least two lines (double-entry)');
  }
  const debits = lines.reduce((s, l) => s + (l.DebitAmount ?? 0), 0);
  const credits = lines.reduce((s, l) => s + (l.CreditAmount ?? 0), 0);
  if (Math.abs(debits - credits) > BALANCE_TOLERANCE) {
    errors.push(`unbalanced: Sum(Debits)=${debits.toFixed(2)} != Sum(Credits)=${credits.toFixed(2)}`);
  }
  return errors;
}

async function checkPeriodOpen(rv: RunView, periodId: string, user: UserInfo): Promise<string[]> {
  const res = await rv.RunView<{ Status: string }>(
    { EntityName: PERIOD_ENTITY, ExtraFilter: `ID='${periodId}'`, Fields: ['Status'], ResultType: 'simple' }, user);
  const status = res.Results?.[0]?.Status;
  if (status !== 'Open' && status !== 'Reopened') {
    return [`accounting period is not open (status=${status ?? 'unknown'})`];
  }
  return [];
}

async function checkGLAccountsActive(rv: RunView, lines: LineRow[], user: UserInfo): Promise<string[]> {
  const glIds = [...new Set(lines.map(l => l.GLAccountID).filter(Boolean))];
  if (glIds.length === 0) return [];
  const inList = glIds.map(id => `'${id}'`).join(',');
  const res = await rv.RunView<{ ID: string; IsActive: boolean }>(
    { EntityName: GL_ENTITY, ExtraFilter: `ID IN (${inList})`, Fields: ['ID', 'IsActive'], ResultType: 'simple' }, user);
  return (res.Results ?? []).filter(gl => !gl.IsActive).map(gl => `GL account ${gl.ID} is inactive`);
}
