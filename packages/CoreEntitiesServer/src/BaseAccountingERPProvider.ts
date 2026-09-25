/**
 * Abstract ERP plugin for AccountingERPEngine. One subclass per Integration.Name.
 * The base calls MJ verbs; subclasses only override what is actually different.
 */
import { RegisterClass, RequiresSubclass } from '@memberjunction/global';
import { UserInfo } from '@memberjunction/core';
import type { AccountingVerbResult, AccountingVerbRunner } from './AccountingVerbRunner.js';
import type { ErpPostResult, ExternalDimensionRef } from './JournalEntryBatchEngine.js';

export interface CreateERPJournalInput {
  CompanyID: string;
  EntryDate: Date;
  DocNumber?: string;
  PrivateNote?: string;
  Lines: Array<{
    accountNumber: string;
    debit?: number;
    credit?: number;
    description?: string;
    /** Dimension tags in ERP wire codes. Providers that cannot carry them ignore the field. */
    dimensions?: ExternalDimensionRef[];
  }>;
}

export interface FindERPJournalInput {
  CompanyID: string;
  /** The document number the journal was, or would be, posted under: the batch number. */
  DocNumber: string;
}

/** One posted ledger line, in the terms `CreateERPJournalInput.Lines` is sent in. */
export interface ERPPostedJournalLine {
  accountNumber: string;
  /** `YYYY-MM-DD`. */
  postingDate: string;
  debit: number;
  credit: number;
}

/**
 * What the ERP holds under a document number (#182).
 *   · `Unavailable` — this ERP offers no lookup.
 *   · `Error`       — the lookup ran and could not answer.
 *   · `Ok`          — the lines posted under the number; empty when nothing has posted.
 */
export type FindERPJournalResult =
  | { status: 'Unavailable' }
  | { status: 'Error'; error: string }
  | { status: 'Ok'; lines: ERPPostedJournalLine[]; externalJournalEntryBatchRef: string };

@RequiresSubclass()
export abstract class BaseAccountingERPProvider {
  /** Must match MJ: Integrations.Name (e.g. 'QuickBooks Online'). */
  abstract get IntegrationName(): string;

  constructor(protected readonly runVerb: AccountingVerbRunner) {}

  async CreateJournalEntry(input: CreateERPJournalInput, user: UserInfo): Promise<ErpPostResult> {
    const result = await this.runVerb({
      Verb: 'CreateJournalEntry',
      CompanyID: input.CompanyID,
      User: user,
      Params: {
        EntryDate: input.EntryDate.toISOString().slice(0, 10),
        DocNumber: input.DocNumber,
        PrivateNote: input.PrivateNote,
        Lines: input.Lines,
      },
    });
    if (!result.Success) {
      return { success: false, error: result.Message ?? result.ResultCode };
    }
    return { success: true, externalJournalEntryBatchRef: this.externalRefOf(result, input) };
  }

  /**
   * The lines the ERP has posted under `input.DocNumber`, read before a send so a journal the ERP
   * already holds is never posted twice. The base offers no lookup; a provider that can answer
   * overrides this.
   */
  async FindJournalEntry(_input: FindERPJournalInput, _user: UserInfo): Promise<FindERPJournalResult> {
    return { status: 'Unavailable' };
  }

  /** The reference a successful post is recorded under: the ERP's own id for the journal entry. */
  protected externalRefOf(result: AccountingVerbResult, _input: CreateERPJournalInput): string | undefined {
    const id = outputParam(result, 'JournalEntryID');
    return id != null ? String(id) : undefined;
  }
}

/** Upper bound on the ledger lines one lookup reads. Reaching it means the answer may be partial. */
const BC_LOOKUP_MAX_RESULTS = 5000;

@RegisterClass(BaseAccountingERPProvider, 'Microsoft Dynamics 365 Business Central')
export class BusinessCentralERPProvider extends BaseAccountingERPProvider {
  get IntegrationName(): string {
    return 'Microsoft Dynamics 365 Business Central';
  }

  /**
   * The G/L entries posted under the document number. Deliberately not filtered by date: a posting
   * under this batch's number on another date still carries this batch's number, and the engine
   * reports it as a mismatch instead of letting the send post a second one.
   */
  async FindJournalEntry(input: FindERPJournalInput, user: UserInfo): Promise<FindERPJournalResult> {
    // The verb writes the number into an OData string literal without escaping it.
    if (input.DocNumber.includes("'")) {
      return { status: 'Error', error: `document number ${input.DocNumber} cannot be looked up: it contains a quote.` };
    }
    const result = await this.runVerb({
      Verb: 'GetGLEntries',
      CompanyID: input.CompanyID,
      User: user,
      Params: { DocumentNumber: input.DocNumber, MaxResults: BC_LOOKUP_MAX_RESULTS },
    });
    if (!result.Success) {
      return { status: 'Error', error: result.Message ?? result.ResultCode ?? 'GetGLEntries failed.' };
    }
    const entries = outputParam(result, 'GLEntries');
    if (!Array.isArray(entries)) {
      return { status: 'Error', error: 'GetGLEntries returned no GLEntries output.' };
    }
    if (entries.length >= BC_LOOKUP_MAX_RESULTS) {
      return { status: 'Error', error: `document ${input.DocNumber} has ${BC_LOOKUP_MAX_RESULTS} or more G/L entries, more than one lookup reads.` };
    }
    const lines: ERPPostedJournalLine[] = [];
    for (const entry of entries) {
      const line = parseBCGLEntry(entry);
      if (!line) return { status: 'Error', error: `GetGLEntries returned an entry for document ${input.DocNumber} without an account, date or amounts.` };
      lines.push(line);
    }
    return { status: 'Ok', lines, externalJournalEntryBatchRef: input.DocNumber };
  }

  /**
   * The BC document number. The verb's `JournalEntryID` output is the id of the general journal the
   * lines were written into, the same for every batch posted through that journal. The document
   * number is what the posted G/L entries carry, and how they are found in BC.
   */
  protected externalRefOf(result: AccountingVerbResult, input: CreateERPJournalInput): string | undefined {
    const docNumber = outputParam(result, 'DocNumber');
    if (typeof docNumber === 'string' && docNumber) return docNumber;
    return input.DocNumber || undefined;
  }
}

@RegisterClass(BaseAccountingERPProvider, 'QuickBooks Online')
export class QuickBooksERPProvider extends BaseAccountingERPProvider {
  get IntegrationName(): string {
    return 'QuickBooks Online';
  }
}

function outputParam(result: AccountingVerbResult, name: string): unknown {
  return result.Params?.find((p) => p.Name === name)?.Value;
}

/** One BC `generalLedgerEntries` row as GetGLEntries maps it, or null when a field it needs is missing. */
function parseBCGLEntry(entry: unknown): ERPPostedJournalLine | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const row = entry as Record<string, unknown>;
  const postingDate = dateOnly(row.postingDate);
  if (typeof row.accountNumber !== 'string' || !postingDate) return null;
  if (typeof row.debitAmount !== 'number' || typeof row.creditAmount !== 'number') return null;
  return { accountNumber: row.accountNumber, postingDate, debit: row.debitAmount, credit: row.creditAmount };
}

function dateOnly(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return null;
}

export function LoadAccountingERPProviders(): void {}
