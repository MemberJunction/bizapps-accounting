/**
 * F1 — validateJournalEntry: a post-time guard a caller (e.g. BatchingEngine, the accounting
 * engine) runs before locking/batching a JE. Checks balance (overall AND per company — AM-4),
 * two-line minimum, and GL-active. Read-only — returns findings; never mutates. The hard
 * guarantees still live in DB triggers (50001 overall / 50019 per-company balanced-on-lock);
 * this surfaces a clean, aggregated error earlier.
 *
 * (The period-open check was RETIRED 2026-07-06 with the AccountingPeriod removal — the ERP
 *  owns periods. Engine-meeting ruling CH-1.)
 *
 * CONNECTS TO:
 *   CALLED BY:  BatchingEngine (Block 2) · block1-runtime harness
 *   READS:      Journal Entries · Journal Entry Lines · GL Accounts
 *   ENTITY:     'MJ_BizApps_Accounting: Journal Entries'
 *   DOC:        docs/ARCHITECTURE.md#je-lifecycle
 */
import { RunView, UserInfo } from '@memberjunction/core';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

const BALANCE_TOLERANCE = 0.005; // matches trg_JournalEntry_BalancedOnLock (50001/50019)

export interface JournalEntryValidationResult {
  valid: boolean;
  errors: string[];
}

interface LineRow { GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null; }
interface GLRow { ID: string; CompanyID: string; IsActive: boolean; }

export async function validateJournalEntry(
  journalEntryId: string,
  contextUser: UserInfo,
): Promise<JournalEntryValidationResult> {
  const rv = new RunView();
  const [jeRes, lineRes] = await rv.RunViews([
    { EntityName: JE_ENTITY, ExtraFilter: `ID='${journalEntryId}'`, Fields: ['ID'], ResultType: 'simple' },
    { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${journalEntryId}'`, Fields: ['GLAccountID', 'DebitAmount', 'CreditAmount'], ResultType: 'simple' },
  ], contextUser);

  if (!jeRes.Success || (jeRes.Results?.length ?? 0) === 0) {
    return { valid: false, errors: [`JournalEntry ${journalEntryId} not found`] };
  }
  const lines = (lineRes.Results ?? []) as LineRow[];
  const glAccounts = await loadLineGLAccounts(rv, lines, contextUser);

  const errors: string[] = [
    ...checkBalance(lines),
    ...checkPerCompanyBalance(lines, new Map(glAccounts.map(gl => [gl.ID.toLowerCase(), gl.CompanyID]))),
    ...glAccounts.filter(gl => !gl.IsActive).map(gl => `GL account ${gl.ID} is inactive`),
  ];
  return { valid: errors.length === 0, errors };
}

export interface BalanceLine { DebitAmount: number | null; CreditAmount: number | null; }
export interface CompanyBalanceLine extends BalanceLine { GLAccountID: string; }

/** Pure, exported for unit testing: overall balance + two-line-minimum checks. */
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

/**
 * Pure, exported for unit testing: AM-4 per-company balance — debits must equal credits
 * WITHIN each company (company = the line's GLAccount.CompanyID, passed in as a map).
 * Mirrors trg_JournalEntry_BalancedOnLock's 50019 branch.
 */
export function checkPerCompanyBalance(
  lines: CompanyBalanceLine[],
  companyByGLAccount: ReadonlyMap<string, string>,
): string[] {
  const byCompany = new Map<string, { debits: number; credits: number }>();
  for (const l of lines) {
    const companyId = companyByGLAccount.get(l.GLAccountID?.toLowerCase() ?? '') ?? 'unknown';
    const acc = byCompany.get(companyId) ?? { debits: 0, credits: 0 };
    acc.debits += l.DebitAmount ?? 0;
    acc.credits += l.CreditAmount ?? 0;
    byCompany.set(companyId, acc);
  }
  const errors: string[] = [];
  for (const [companyId, { debits, credits }] of byCompany) {
    if (Math.abs(debits - credits) > BALANCE_TOLERANCE) {
      errors.push(`unbalanced within company ${companyId}: Sum(Debits)=${debits.toFixed(2)} != Sum(Credits)=${credits.toFixed(2)} (AM-4)`);
    }
  }
  return errors;
}

async function loadLineGLAccounts(rv: RunView, lines: LineRow[], user: UserInfo): Promise<GLRow[]> {
  const glIds = [...new Set(lines.map(l => l.GLAccountID).filter(Boolean))];
  if (glIds.length === 0) return [];
  const inList = glIds.map(id => `'${id}'`).join(',');
  const res = await rv.RunView<GLRow>(
    { EntityName: GL_ENTITY, ExtraFilter: `ID IN (${inList})`, Fields: ['ID', 'CompanyID', 'IsActive'], ResultType: 'simple' }, user);
  return res.Results ?? [];
}
