/**
 * The Accounting.CreateJournalEntry CONTRACT — the typed draft every caller (Orders today,
 * Payments/Subscriptions later, browsers, scripts) submits, and the typed result they get back.
 *
 * Lives in the browser-safe EngineBase package (plan §2.3) so consumers import the types with
 * ZERO server dependencies. The server engine (`AccountingEngine` in
 * `@mj-biz-apps/accounting-core-entities-server`) and the remotable op both use these exact types.
 *
 * Notes: the draft carries NO CompanyID field — the engine derives the (single) company from the
 * lines' GLAccount.CompanyID and stamps JournalEntry.CompanyID (plan D3: journal entries are
 * single-company). A draft whose lines resolve to MORE than one company is rejected with
 * MULTI_COMPANY_DRAFT — callers split per company upstream (orders books one JE per order line).
 * NO period fields; NO FX fields in v1 (deferred).
 *
 * CONNECTS TO:
 *   PIPELINE:  ./pipeline.ts (the pure validation/normalization stages over this contract)
 *   SERVER:    AccountingEngine.CreateJournalEntry · CreateJournalEntryOperation ('Accounting.CreateJournalEntry')
 *   DOC:       plans/accounting-engine-plan.md §3
 */
/** One requested debit-or-credit line. Exactly one side, strictly > 0. */
export interface JournalEntryLineDraft {
  /** The resolved GL account UUID (Orders resolves codes/links to IDs before calling — S2). */
  GLAccountID: string;
  DebitAmount?: number;
  CreditAmount?: number;
  Description?: string;
  /** The customer/counterparty this line's receivable-or-payable belongs to (AR-by-customer).
   *  Set on the AR line by order booking + payment capture; carried by reversals. Soft-optional —
   *  omitted for lines with no counterparty (revenue, cash, tax). FK to bizapps-common Organization. */
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
  /**
   * The JournalEntryType CODE (issue #24, BA-D29) — e.g. 'Manual', 'OrderBooking'. Resolved to
   * EntryTypeID against the JournalEntryType lookup at validation time (ENTRY_TYPE_UNKNOWN /
   * ENTRY_TYPE_INACTIVE). The former closed enum is gone: consuming apps seed their own type
   * rows, so this is an open string validated against live reference data, not a TS union.
   */
  EntryType: string;
  Description?: string;
  /**
   * Polymorphic origin pair (plan D25): the single causal source record for this JE.
   * LinkedEntityID = the __mj Entity of the source (OrderLine, Payment, ...); LinkedRecordID =
   * that record's primary key. Set BOTH or NEITHER (CK_JournalEntry_LinkedPair; NULL/NULL = manual).
   */
  LinkedEntityID?: string;
  LinkedRecordID?: string;
  Lines: JournalEntryLineDraft[];
}

export type JEErrorCode =
  | 'MALFORMED_DRAFT'
  | 'ENTRY_TYPE_UNKNOWN'
  | 'ENTRY_TYPE_INACTIVE'
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
  /** 0-based index into `Drafts` when the error is draft-scoped (the SET op). */
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

// ─── The SET op ('Accounting.CreateJournalEntries') — a MULTI-JE unit of work ──
// An order Confirm books ONE JE PER ORDER LINE (orders D10) and submits ALL of its drafts in
// one call: every draft validates first (draft-scoped errors carry DraftIndex), then every JE
// writes inside ONE provider transaction — all entries or none. A caller composing a larger
// unit of work (order row + JE set) opens a transaction on ITS provider before calling; the
// engine's transaction nests (savepoints), so one outer commit covers everything.

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
