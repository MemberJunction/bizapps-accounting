/**
 * Field descriptions that make a claim about code must match that code (#352). MJ shows a field's
 * description as help text and hands it to AI features, so a stale one teaches users and agents the
 * wrong format or the wrong behavior. The description read here is the generated entity schema's
 * copy, which CodeGen takes verbatim from the column's MS_Description. No DB: the numbering
 * procedure is read from the migration that last defines it.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mjBizAppsAccountingFinanceExceptionSchema,
  mjBizAppsAccountingGLAccountSchema,
  mjBizAppsAccountingJournalEntryBatchSchema,
} from '@mj-biz-apps/accounting-entities';
import { AccountingCompanyProfileEntityServer } from '../AccountingCompanyProfileEntityServer.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../migrations');

/** The text after "Description:" in a generated schema field's describe() block. */
function descriptionOf(described: string | undefined): string {
  const match = /\* \* Description: ([\s\S]*)$/.exec(described ?? '');
  if (!match) throw new Error(`No Description line in: ${described}`);
  return match[1].trim();
}

/** Body of spAssignNextJournalEntryBatchNumber as the newest migration that (re)creates it leaves it. */
function batchNumberProcedureBody(): string {
  const createPattern = /CREATE (?:OR ALTER )?PROCEDURE\s+\S*spAssignNextJournalEntryBatchNumber\b[\s\S]*?\nGO\b/;
  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  const bodies = files.map(f => createPattern.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))?.[0]).filter(Boolean);
  if (bodies.length === 0) throw new Error('No migration creates spAssignNextJournalEntryBatchNumber');
  return bodies[bodies.length - 1] as string;
}

describe('field descriptions match the code they describe (#352)', () => {
  it('JournalEntryBatchNumber states the format spAssignNextJournalEntryBatchNumber emits', () => {
    const body = batchNumberProcedureBody();
    // The procedure builds 'BATCH-' + a six-digit sequence from one global counter, nothing else.
    expect(body).toMatch(/@JournalEntryBatchNumber = N'BATCH-' \+ RIGHT\(N'000000' \+ CAST\(@NextSeq AS NVARCHAR\(6\)\), 6\);/);

    const description = descriptionOf(mjBizAppsAccountingJournalEntryBatchSchema.shape.JournalEntryBatchNumber.description);
    expect(description).toContain(`'BATCH-{seq:000000}'`);
    expect(description).not.toContain('CompanyCode');
  });

  it('DedupeKey says a repeat raise refreshes an Open row instead of leaving it unchanged', () => {
    const description = descriptionOf(mjBizAppsAccountingFinanceExceptionSchema.shape.DedupeKey.description);
    expect(description).not.toMatch(/unchanged/i);
    expect(description).toContain('Open');
    // The three columns refreshCreator writes on a repeat raise (FinanceExceptions.ts).
    for (const column of ['SourceCreatedByUserID', 'CreatorUnresolved', 'Summary']) {
      expect(description).toContain(column);
    }
  });

  it('IsSystemSeeded names the routine that seeds the starter chart, and that routine exists', () => {
    const description = descriptionOf(mjBizAppsAccountingGLAccountSchema.shape.IsSystemSeeded.description);
    expect(description).not.toContain('spSeedDefaultChartOfAccounts');
    expect(description).toContain('AccountingCompanyProfileEntityServer.SeedDefaultChartOfAccounts()');
    expect(typeof AccountingCompanyProfileEntityServer.prototype.SeedDefaultChartOfAccounts).toBe('function');
  });
});
