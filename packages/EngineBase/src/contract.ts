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
