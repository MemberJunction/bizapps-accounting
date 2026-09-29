/**
 * Abstract ERP plugin for AccountingERPEngine. One subclass per Integration.Name.
 * The base calls MJ verbs; subclasses only override what is actually different.
 */
import { RegisterClass, RequiresSubclass } from '@memberjunction/global';
import { UserInfo } from '@memberjunction/core';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';
import type { AccountingVerbResult, AccountingVerbRunner } from './AccountingVerbRunner.js';
import type { ErpPostResult, ExternalDimensionRef } from './JournalEntryBatchEngine.js';

/** One journal line as the engine sends it. */
export interface ERPJournalLine {
  /** The account number: the GL account's `Code`. */
  accountNumber: string;
  /** The ERP's own id for the account: the GL account's `ExternalAccountID`, when it is recorded for this ERP. */
  accountId?: string;
  debit?: number;
  credit?: number;
  description?: string;
  /** Dimension tags in ERP wire codes. Providers that cannot carry them ignore the field. */
  dimensions?: ExternalDimensionRef[];
}

/** One journal line as a CreateJournalEntry verb reads it: the account by number, by id, or both. */
export type ERPVerbJournalLine = Omit<ERPJournalLine, 'accountNumber'> & { accountNumber?: string };

export interface CreateERPJournalInput {
  CompanyID: string;
  EntryDate: Date;
  DocNumber?: string;
  PrivateNote?: string;
  Lines: ERPJournalLine[];
}

export interface FindERPJournalInput {
  CompanyID: string;
  /** The document number the journal was, or would be, posted under: the batch number. */
  DocNumber: string;
  /** `YYYY-MM-DD`: the batch's posting date. A provider that can look up by number alone ignores it. */
  PostingDate: string;
}

/** One posted ledger line, in the terms `CreateERPJournalInput.Lines` is sent in. */
export interface ERPPostedJournalLine {
  /** The account number, when the ERP returns one (Business Central). */
  accountNumber?: string;
  /** The ERP's own id for the account, when the ERP returns one (Business Central, QuickBooks Online). */
  accountId?: string;
  /** `YYYY-MM-DD`. */
  postingDate: string;
  debit: number;
  credit: number;
  /** The line's description as the ERP holds it, which carries the batch token (#206). */
  description: string;
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

  /**
   * True when the ERP identifies accounts only by its own id, so a GL account's `Code` is no
   * substitute for its `ExternalAccountID`. The engine then refuses a line whose account has none.
   */
  get RequiresExternalAccountID(): boolean {
    return false;
  }

  async CreateJournalEntry(input: CreateERPJournalInput, user: UserInfo): Promise<ErpPostResult> {
    const result = await this.runVerb({
      Verb: 'CreateJournalEntry',
      CompanyID: input.CompanyID,
      User: user,
      Params: {
        EntryDate: input.EntryDate.toISOString().slice(0, 10),
        DocNumber: input.DocNumber,
        PrivateNote: input.PrivateNote,
        Lines: this.verbLines(input.Lines),
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

  /** The lines in the shape this ERP's CreateJournalEntry verb reads. */
  protected verbLines(lines: ERPJournalLine[]): ERPVerbJournalLine[] {
    return lines;
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
   * An account with a BC id goes by `accountId` alone (bc-aidp-next-golive#282). The verb sends
   * `accountNumber` whenever it is present, so both would post by the number; the id is the one
   * the BC pull recorded, and does not depend on the Code matching BC's number.
   */
  protected verbLines(lines: ERPJournalLine[]): ERPVerbJournalLine[] {
    return lines.map(({ accountNumber, ...line }) => (line.accountId ? line : { ...line, accountNumber }));
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

/** QBO answers at most this many rows per query. A full page means the answer may be partial. */
const QBO_LOOKUP_MAX_RESULTS = 1000;

/** A QBO journal line as the CreateJournalEntry verb reads it: the account by QBO id. */
interface QuickBooksJournalLine extends ERPJournalLine {
  accountId: string;
}

/** A QBO journal entry under the batch's number, as the GetGLEntries verb returns it. */
interface QuickBooksJournalEntry {
  id: string;
  lines: ERPPostedJournalLine[];
}

@RegisterClass(BaseAccountingERPProvider, 'QuickBooks Online')
export class QuickBooksERPProvider extends BaseAccountingERPProvider {
  get IntegrationName(): string {
    return 'QuickBooks Online';
  }

  /** QBO accounts are referenced by QBO id only. */
  get RequiresExternalAccountID(): boolean {
    return true;
  }

  /**
   * The journal entries QBO holds under the document number on the batch's posting date. QBO's
   * GetGLEntries verb cannot filter by document number, so the lookup reads the day's journal
   * entries and keeps the ones carrying the number. A posting under the number on another day is
   * not found; the batch's posting date is frozen once it is sent, so a retry posts on the same day.
   */
  async FindJournalEntry(input: FindERPJournalInput, user: UserInfo): Promise<FindERPJournalResult> {
    const result = await this.runVerb({
      Verb: 'GetGLEntries',
      CompanyID: input.CompanyID,
      User: user,
      Params: { TransactionType: 'JournalEntry', StartDate: input.PostingDate, EndDate: input.PostingDate, MaxResults: QBO_LOOKUP_MAX_RESULTS },
    });
    if (!result.Success) {
      return { status: 'Error', error: result.Message ?? result.ResultCode ?? 'GetGLEntries failed.' };
    }
    const transactions = outputParam(result, 'Transactions');
    if (!Array.isArray(transactions)) {
      return { status: 'Error', error: 'GetGLEntries returned no Transactions output.' };
    }
    if (transactions.length >= QBO_LOOKUP_MAX_RESULTS) {
      return { status: 'Error', error: `QuickBooks Online has ${QBO_LOOKUP_MAX_RESULTS} or more journal entries on ${input.PostingDate}, more than one lookup reads.` };
    }
    return this.entriesUnder(input.DocNumber, transactions);
  }

  /** The lines of every entry carrying the number, combined: two entries under one number cannot both be this batch. */
  private entriesUnder(docNumber: string, transactions: unknown[]): FindERPJournalResult {
    const entries: QuickBooksJournalEntry[] = [];
    for (const transaction of transactions) {
      const raw = rawQBOJournalEntry(transaction);
      if (!raw) return { status: 'Error', error: 'GetGLEntries returned a journal entry without its QuickBooks Online record.' };
      if (raw.DocNumber !== docNumber) continue;
      const entry = parseQBOJournalEntry(raw);
      if (!entry) return { status: 'Error', error: `GetGLEntries returned a journal entry for document ${docNumber} without an id, date, account or amounts.` };
      entries.push(entry);
    }
    return {
      status: 'Ok',
      lines: entries.flatMap((e) => e.lines),
      externalJournalEntryBatchRef: entries.length > 0 ? entries.map((e) => e.id).join(', ') : docNumber,
    };
  }

  /**
   * The verb requires `accountId`, the QBO account id, and ignores `accountNumber`. The engine refuses
   * an account without one before calling (`RequiresExternalAccountID`), so a line reaching here without
   * it is a caller bug.
   */
  protected verbLines(lines: ERPJournalLine[]): QuickBooksJournalLine[] {
    return lines.map((line) => {
      if (!line.accountId) throw new Error(`GL account ${line.accountNumber} has no QuickBooks Online account ID.`);
      return { ...line, accountId: line.accountId };
    });
  }
}

function outputParam(result: AccountingVerbResult, name: string): unknown {
  return result.Params?.find((p) => p.Name === name)?.Value;
}

/** One BC `generalLedgerEntries` row as GetGLEntries maps it, or null when a field it needs is missing. */
function parseBCGLEntry(entry: unknown): ERPPostedJournalLine | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const row = entry as Record<string, unknown>;
  const postingDate = ToCalendarDay(row.postingDate);
  if (typeof row.accountNumber !== 'string' || !postingDate) return null;
  if (typeof row.debitAmount !== 'number' || typeof row.creditAmount !== 'number') return null;
  const description = typeof row.description === 'string' ? row.description : '';
  const accountId = typeof row.accountId === 'string' && row.accountId ? row.accountId : undefined;
  return { accountNumber: row.accountNumber, accountId, postingDate, debit: row.debitAmount, credit: row.creditAmount, description };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The QBO JournalEntry record a GetGLEntries transaction carries as `metadata`, or null. */
function rawQBOJournalEntry(transaction: unknown): Record<string, unknown> | null {
  if (!isRecord(transaction) || !isRecord(transaction.metadata)) return null;
  return transaction.metadata;
}

/** A QBO JournalEntry record's id and lines, or null when a field the match needs is missing. */
function parseQBOJournalEntry(raw: Record<string, unknown>): QuickBooksJournalEntry | null {
  const postingDate = ToCalendarDay(raw.TxnDate);
  if (typeof raw.Id !== 'string' || !postingDate || !Array.isArray(raw.Line)) return null;
  const lines: ERPPostedJournalLine[] = [];
  for (const rawLine of raw.Line) {
    const line = parseQBOJournalLine(rawLine, postingDate);
    if (!line) return null;
    lines.push(line);
  }
  return { id: raw.Id, lines };
}

/**
 * One QBO `JournalEntryLineDetail` line: QBO carries a positive amount and says which side it posts
 * to. Its `Description` is the one the line was sent with, batch token included.
 */
function parseQBOJournalLine(rawLine: unknown, postingDate: string): ERPPostedJournalLine | null {
  if (!isRecord(rawLine) || typeof rawLine.Amount !== 'number' || !isRecord(rawLine.JournalEntryLineDetail)) return null;
  const detail = rawLine.JournalEntryLineDetail;
  const accountId = isRecord(detail.AccountRef) ? detail.AccountRef.value : undefined;
  if (typeof accountId !== 'string') return null;
  const description = typeof rawLine.Description === 'string' ? rawLine.Description : '';
  if (detail.PostingType === 'Debit') return { accountId, postingDate, debit: rawLine.Amount, credit: 0, description };
  if (detail.PostingType === 'Credit') return { accountId, postingDate, debit: 0, credit: rawLine.Amount, description };
  return null;
}

export function LoadAccountingERPProviders(): void {}
