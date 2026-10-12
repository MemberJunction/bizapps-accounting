/**
 * Abstract ERP plugin for AccountingERPEngine. One subclass per Integration.Name.
 * The base calls MJ verbs; subclasses only override what is actually different.
 */
import { RegisterClass, RequiresSubclass } from '@memberjunction/global';
import { LogError, LogStatus, UserInfo } from '@memberjunction/core';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';
import type { AccountingVerbResult, AccountingVerbRunner } from './AccountingVerbRunner.js';
import type { ErpPostResult, ExternalDimensionRef } from './JournalEntryBatchEngine.js';

/** One journal line as the engine sends it. */
export interface ERPJournalLine {
  /** The ERP's identity for the account: the GL account's `ExternalAccountID`, or its `Code`. */
  accountNumber: string;
  debit?: number;
  credit?: number;
  description?: string;
  /** Dimension tags in ERP wire codes. Providers that cannot carry them ignore the field. */
  dimensions?: ExternalDimensionRef[];
}

export interface CreateERPJournalInput {
  CompanyID: string;
  /**
   * The Company Integration the engine chose to post through (#256). Sent to the verb as
   * `CompanyIntegrationID`, so the verb uses exactly that connection (MemberJunction/MJ#4867)
   * instead of resolving one of its own from `CompanyID`.
   */
  CompanyIntegrationID: string;
  EntryDate: Date;
  DocNumber?: string;
  PrivateNote?: string;
  Lines: ERPJournalLine[];
  /** How to find the posting if the ERP renumbers it (#205). */
  RenumberedSearch?: RenumberedJournalSearch;
}

/**
 * What still identifies a posting after the ERP gave it a document number of its own (#205): the
 * batch token every line carries, on one account the batch sends to. The posting date narrows it.
 */
export interface RenumberedJournalSearch {
  /** The batch token, as it appears in each line's description. */
  Token: string;
  /** An account the batch sends a line to, which narrows the search. */
  AccountNumber: string;
}

export interface FindERPJournalInput {
  CompanyID: string;
  /**
   * The Company Integration the engine chose, the same one the post goes through (#256). Sent to
   * the lookup verb as `CompanyIntegrationID`.
   */
  CompanyIntegrationID: string;
  /** The document number the journal was, or would be, posted under: the batch number. */
  DocNumber: string;
  /** `YYYY-MM-DD`: the batch's posting date. A provider that can look up by number alone ignores it. */
  PostingDate: string;
  /** Searched, on `PostingDate`, when nothing has posted under `DocNumber`. */
  RenumberedSearch?: RenumberedJournalSearch;
}

/** One posted ledger line, in the terms `CreateERPJournalInput.Lines` is sent in. */
export interface ERPPostedJournalLine {
  accountNumber: string;
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
 *   · `Ok`          — the lines posted under the number; empty when nothing has posted. The ref is
 *                     the document they posted under, the ERP's own number when it renumbered (#205).
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
    const result = await this.runConnectionVerb('CreateJournalEntry', input, user, {
      EntryDate: input.EntryDate.toISOString().slice(0, 10),
      DocNumber: input.DocNumber,
      PrivateNote: input.PrivateNote,
      Lines: this.verbLines(input.Lines),
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

  /**
   * Run a verb against the connection the engine chose: `CompanyID` plus a `CompanyIntegrationID`
   * param (#256, MemberJunction/MJ#4867). Every verb call a provider makes goes through here, so the
   * lookup and the post cannot reach different connections. The connection is added last, so a
   * verb param of the same name cannot override it.
   */
  protected async runConnectionVerb(
    verb: string,
    connection: { CompanyID: string; CompanyIntegrationID: string },
    user: UserInfo,
    params: Record<string, unknown>,
  ): Promise<AccountingVerbResult> {
    return this.runVerb({
      Verb: verb,
      CompanyID: connection.CompanyID,
      User: user,
      Params: { ...params, CompanyIntegrationID: connection.CompanyIntegrationID },
    });
  }

  /** The lines in the shape this ERP's CreateJournalEntry verb reads. */
  protected verbLines(lines: ERPJournalLine[]): ERPJournalLine[] {
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
   * Posts the journal, then reads it back for the document number BC posted it under: a journal batch
   * with a Posting No. Series renumbers the document at posting (#205). The readback never turns the
   * post into a failure, since BC has accepted the journal. A readback that fails says why in
   * `readbackError`, and the engine raises it as a finance exception on the batch.
   */
  async CreateJournalEntry(input: CreateERPJournalInput, user: UserInfo): Promise<ErpPostResult> {
    const posted = await super.CreateJournalEntry(input, user);
    const sentAs = posted.externalJournalEntryBatchRef;
    if (!posted.success || !sentAs || !input.RenumberedSearch) return posted;
    try {
      const found = await this.FindJournalEntry({
        CompanyID: input.CompanyID,
        CompanyIntegrationID: input.CompanyIntegrationID,
        DocNumber: sentAs,
        // The day the post just sent, from the same UTC parts.
        PostingDate: input.EntryDate.toISOString().slice(0, 10),
        RenumberedSearch: input.RenumberedSearch,
      }, user);
      if (found.status === 'Ok' && found.lines.length > 0) return { ...posted, externalJournalEntryBatchRef: found.externalJournalEntryBatchRef };
      const why = found.status === 'Error' ? found.error : `no G/L entries carry document ${sentAs} or token ${input.RenumberedSearch.Token}.`;
      return this.unreadPost(posted, sentAs, why);
    } catch (e) {
      LogError(`BusinessCentralERPProvider: journal ${sentAs} posted, but reading it back threw.`, null, e);
      return this.unreadPost(posted, sentAs, `reading it back threw: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** The post as sent, marked as one that could not be read back. */
  private unreadPost(posted: ErpPostResult, sentAs: string, why: string): ErpPostResult {
    LogError(`BusinessCentralERPProvider: journal ${sentAs} posted, but reading it back failed: ${why} It is recorded under ${sentAs}.`);
    return { ...posted, readbackError: why };
  }

  /**
   * The G/L entries posted under the document number. Deliberately not filtered by date: a posting
   * under this batch's number on another date still carries this batch's number, and the engine
   * reports it as a mismatch instead of letting the send post a second one.
   *
   * When nothing has posted under the number, the posting may carry a number BC assigned (#205). It is
   * then found by the batch token on the posting date, and read in full under BC's number. That
   * search is filtered by date: a renumbered posting on another date is not found.
   */
  async FindJournalEntry(input: FindERPJournalInput, user: UserInfo): Promise<FindERPJournalResult> {
    const byNumber = await this.entriesUnderDocument(input, input.DocNumber, user);
    if (byNumber.status !== 'Ok' || byNumber.lines.length > 0 || !input.RenumberedSearch) return byNumber;
    const renumbered = await this.renumberedDocument(input, input.PostingDate, input.RenumberedSearch, user);
    if (renumbered.status === 'Error') return renumbered;
    if (renumbered.status === 'None') return byNumber;
    LogStatus(`BusinessCentralERPProvider: document ${input.DocNumber} posted in BC as ${renumbered.docNumber}; its journal batch renumbers at posting.`);
    return this.entriesUnderDocument(input, renumbered.docNumber, user);
  }

  /**
   * The document BC posted the batch's token under, on the posting date and account. More than one
   * document carrying the token is an error, not a guess.
   */
  private async renumberedDocument(
    connection: { CompanyID: string; CompanyIntegrationID: string }, postingDate: string, search: RenumberedJournalSearch, user: UserInfo,
  ): Promise<{ status: 'Error'; error: string } | { status: 'None' } | { status: 'Found'; docNumber: string }> {
    // The verb writes the account number into an OData string literal without escaping it.
    if (search.AccountNumber.includes("'")) {
      return { status: 'Error', error: `account ${search.AccountNumber} cannot be searched: it contains a quote.` };
    }
    const read = await this.readGLEntries(connection, user, {
      StartDate: postingDate, EndDate: postingDate, AccountNumber: search.AccountNumber,
    }, `account ${search.AccountNumber} on ${postingDate}`);
    if (read.status === 'Error') return read;
    const token = search.Token.toLowerCase();
    const docNumbers = new Set<string>();
    for (const entry of read.entries) {
      const row = entry as Record<string, unknown>;
      if (typeof row.description !== 'string' || !row.description.toLowerCase().includes(token)) continue;
      if (typeof row.documentNumber !== 'string' || !row.documentNumber) {
        return { status: 'Error', error: `a G/L entry carrying token ${search.Token} has no document number.` };
      }
      docNumbers.add(row.documentNumber);
    }
    if (docNumbers.size === 0) return { status: 'None' };
    if (docNumbers.size > 1) {
      return { status: 'Error', error: `token ${search.Token} is on G/L entries of ${docNumbers.size} documents: ${[...docNumbers].join(', ')}.` };
    }
    return { status: 'Found', docNumber: [...docNumbers][0] };
  }

  private async entriesUnderDocument(connection: { CompanyID: string; CompanyIntegrationID: string }, docNumber: string, user: UserInfo): Promise<FindERPJournalResult> {
    // The verb writes the number into an OData string literal without escaping it.
    if (docNumber.includes("'")) {
      return { status: 'Error', error: `document number ${docNumber} cannot be looked up: it contains a quote.` };
    }
    const read = await this.readGLEntries(connection, user, { DocumentNumber: docNumber }, `document ${docNumber}`);
    if (read.status === 'Error') return read;
    const lines: ERPPostedJournalLine[] = [];
    for (const entry of read.entries) {
      const line = parseBCGLEntry(entry);
      if (!line) return { status: 'Error', error: `GetGLEntries returned an entry for document ${docNumber} without an account, date or amounts.` };
      lines.push(line);
    }
    return { status: 'Ok', lines, externalJournalEntryBatchRef: docNumber };
  }

  /** The raw GetGLEntries rows for `filter`. `subject` names what was read, for the errors. */
  private async readGLEntries(
    connection: { CompanyID: string; CompanyIntegrationID: string }, user: UserInfo, filter: Record<string, string>, subject: string,
  ): Promise<{ status: 'Error'; error: string } | { status: 'Ok'; entries: unknown[] }> {
    const result = await this.runConnectionVerb('GetGLEntries', connection, user, { ...filter, MaxResults: BC_LOOKUP_MAX_RESULTS });
    if (!result.Success) {
      return { status: 'Error', error: result.Message ?? result.ResultCode ?? 'GetGLEntries failed.' };
    }
    const entries = outputParam(result, 'GLEntries');
    if (!Array.isArray(entries)) {
      return { status: 'Error', error: 'GetGLEntries returned no GLEntries output.' };
    }
    if (entries.length >= BC_LOOKUP_MAX_RESULTS) {
      return { status: 'Error', error: `${subject} has ${BC_LOOKUP_MAX_RESULTS} or more G/L entries, more than one lookup reads.` };
    }
    return { status: 'Ok', entries };
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
    const result = await this.runConnectionVerb('GetGLEntries', input, user, {
      TransactionType: 'JournalEntry',
      StartDate: input.PostingDate,
      EndDate: input.PostingDate,
      MaxResults: QBO_LOOKUP_MAX_RESULTS,
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

  /** The verb requires `accountId`, the QBO account id, which is what `accountNumber` carries for QBO. */
  protected verbLines(lines: ERPJournalLine[]): QuickBooksJournalLine[] {
    return lines.map((line) => ({ ...line, accountId: line.accountNumber }));
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
  return { accountNumber: row.accountNumber, postingDate, debit: row.debitAmount, credit: row.creditAmount, description };
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
  if (detail.PostingType === 'Debit') return { accountNumber: accountId, postingDate, debit: rawLine.Amount, credit: 0, description };
  if (detail.PostingType === 'Credit') return { accountNumber: accountId, postingDate, debit: 0, credit: rawLine.Amount, description };
  return null;
}

export function LoadAccountingERPProviders(): void {}
