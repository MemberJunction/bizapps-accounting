/**
 * The Accounting.CreateJournalEntry CONTRACT — the typed draft every caller (Orders today,
 * Payments/Subscriptions later, browsers, scripts) submits, and the typed result they get back.
 *
 * Lives in the browser-safe EngineBase package (plan §2.3) so consumers import the types with
 * ZERO server dependencies. The server engine (`AccountingEngine` in
 * `@mj-biz-apps/accounting-core-entities-server`) and the remotable op both use these exact types.
 *
 * Notes: the draft carries NO CompanyID field — the engine derives the (single) company from the
 * lines' GLAccount.CompanyID and stamps JournalEntry.CompanyID. A draft spanning more than one
 * company is rejected with MULTI_COMPANY_DRAFT (MOD-12: JEs are single-company; callers split per
 * company upstream — orders MOD-11). NO period fields (MOD-1); NO FX fields in v1 (deferred).
 *
 * CONNECTS TO:
 *   PIPELINE:  ./pipeline.ts (the pure validation/normalization stages over this contract)
 *   SERVER:    AccountingEngine.CreateJournalEntry · CreateJournalEntryOperation ('Accounting.CreateJournalEntry')
 *   DOC:       plans/accounting-engine-plan.md §3
 */
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';

/** One requested debit-or-credit line. Exactly one side, strictly > 0. */
export interface JournalEntryLineDraft {
  /** The resolved GL account UUID (Orders resolves codes/links to IDs before calling — S2). */
  GLAccountID: string;
  DebitAmount?: number;
  CreditAmount?: number;
  Description?: string;
  /** Lineage soft ref to the originating order line (nullable FK on JournalEntryLine). */
  OrderLineID?: string;
  /** The customer/counterparty this line's receivable-or-payable belongs to (AR-by-customer,
   *  vw_AROpenByCustomer). Set on the AR line by order booking + payment capture. Soft ref. */
  CounterpartyOrganizationID?: string;
  /** Pre-existing dimension/value pairs — validate-only, NEVER auto-created (CH-12). */
  Dimensions?: JournalEntryLineDimensionDraft[];
}

export interface JournalEntryLineDimensionDraft {
  DimensionID: string;
  DimensionValueID: string;
}

/** The full journal-entry request. */
export interface JournalEntryDraft {
  /** ISO date (or datetime) the entry takes effect. */
  EffectiveDate: string;
  /** Derived from the generated entity union (rule 2c) — never hand-copied. */
  EntryType: mjBizAppsAccountingJournalEntryEntity['EntryType'];
  Description?: string;
  /** Lineage soft ref to the originating order (nullable FK on JournalEntry). */
  OrderID?: string;
  Lines: JournalEntryLineDraft[];
}

export type JEErrorCode =
  | 'MALFORMED_DRAFT'
  | 'ACCOUNT_UNKNOWN'
  | 'ACCOUNT_INACTIVE'
  | 'DIMENSION_UNKNOWN'
  | 'DIMENSION_VALUE_UNKNOWN'
  | 'UNBALANCED'
  | 'MULTI_COMPANY_DRAFT'
  | 'INTERNAL_ERROR';

export interface JEValidationError {
  Code: JEErrorCode;
  /** 0-based index into `draft.Lines` when the error is line-scoped. */
  LineIndex?: number;
  /** 0-based index into a SET's `Drafts` when the error is draft-scoped ('Accounting.CreateJournalEntries'). */
  DraftIndex?: number;
  Message: string;
}

export interface CreateJournalEntryResult {
  Success: boolean;
  JournalEntryID?: string;
  EntryNumber?: string;
  LineCount?: number;
  Errors?: JEValidationError[];
}

/** Remote-operation I/O aliases ('Accounting.CreateJournalEntry'). */
export type CreateJournalEntryInput = JournalEntryDraft;
export type CreateJournalEntryOutput = CreateJournalEntryResult;

// ─── The SET operation ('Accounting.CreateJournalEntries') ───────────────────
// Amith's transaction rule: JEs + lines must be created through a single engine call so the
// write has a proper transaction wrapper. The set form extends that to a MULTI-JE unit of work
// (e.g. an order Confirm booking one JE per company, MOD-11/MOD-12): ALL drafts validate first,
// then ALL rows (every header + line + dimension across every draft) write in ONE TransactionGroup —
// all entries or none. There is no partial-booking state and no compensation path.

/** The full set request: one draft per (single-company) journal entry. */
export interface CreateJournalEntriesInput {
  Drafts: JournalEntryDraft[];
}

export interface CreateJournalEntriesResult {
  Success: boolean;
  /** Per-draft results, same order as `Drafts` — present only when Success (all-or-nothing). */
  Results?: CreateJournalEntryResult[];
  /** Validation/write errors; draft-scoped entries carry `DraftIndex`. */
  Errors?: JEValidationError[];
}

export type CreateJournalEntriesOutput = CreateJournalEntriesResult;

// ─── The QUEUE-ONTO-CALLER'S-TG seam (orders F1.2b — Confirm UNIT OF WORK) ─────
// `AccountingEngine.QueueJournalEntries(input, tg, ...)` validates the whole draft set and queues
// every header + line + dimension onto a TransactionGroup the CALLER owns — WITHOUT submitting.
// This lets a caller (orders `Orders.ConfirmOrder`) compose the order-row save + the JE set into
// ONE unit of work: one Submit commits order + all JEs, or nothing. Same validation as the set op;
// the difference is purely who owns Submit. Server-only (the TG is a live server object) — the
// method signature lives on `AccountingEngine`; only this plain result shape is contract-level.

/** One JE queued (not yet committed) by `QueueJournalEntries`. Its ID is minted at NewRecord, so
 *  it is available to the caller pre-Submit for lineage; EntryNumber is set by the W2 hook. */
export interface QueuedJournalEntry {
  JournalEntryID: string;
  EntryNumber?: string;
  LineCount: number;
}

export interface QueueJournalEntriesResult {
  Success: boolean;
  /** Queued entries, same order as `Drafts` — present only when Success (validation passed + queued). */
  Queued?: QueuedJournalEntry[];
  /** Validation/queue errors; draft-scoped entries carry `DraftIndex`. */
  Errors?: JEValidationError[];
}
