/**
 * @fileoverview The shapes the journal-entry widgets render.
 *
 * These are **view models**, not entities. A presentational widget that took a
 * `mjBizAppsAccountingJournalEntryLineEntity` could only ever be tested by standing up the MJ
 * metadata system; one that takes {@link JELineView} is tested with an object literal. That is
 * the whole point of layer 1.
 *
 * Value-list types are still derived from the generated entity (never hand-copied), so a CHECK
 * constraint widened by CodeGen widens these too.
 *
 * @module @mj-biz-apps/accounting-ng-widgets
 */

import type { JEStatus, JEType } from '@mj-biz-apps/accounting-engine-base';

export type { JEStatus, JEType };

/** One dimension tag on a line, already resolved to display names. */
export interface JEDimensionTag {
  Dimension: string;
  DimensionValue: string;
}

/** One journal-entry line, flattened for display. */
export interface JELineView {
  /** Stable identity for `@for` tracking. */
  ID: string;
  LineNumber: number;
  /** `GLAccount.Code` — the number an accountant scans for. `'—'` when unresolved. */
  AccountCode: string;
  /** `GLAccount.Name`, falling back to the view's denormalized label. */
  AccountName: string;
  /** Present so a host can offer a drill-through; the widget only emits the intent. */
  GLAccountID: string | null;
  Debit: number;
  Credit: number;
  Description: string | null;
  Dimensions: JEDimensionTag[];
}

/**
 * The journal-entry header, flattened for display.
 *
 * Structurally compatible with the fields the JE view returns, so a host that already has the
 * row can bind it directly rather than re-reading.
 */
export interface JEHeaderView {
  ID: string;
  EntryNumber: string;
  EntryType: JEType;
  Status: JEStatus;
  EffectiveDate: Date | string | null;
  Description: string | null;
  CompanyID: string | null;
  Company: string | null;
  /**
   * The record that caused this entry, as a polymorphic pair: the MJ entity NAME
   * (`LinkedEntity`, denormalized by the view) and the row id. An order-booking entry links to
   * an Order; a payment entry to a Payment. Modelling it generically is why this widget does not
   * need to know that Orders exist.
   */
  LinkedEntity: string | null;
  LinkedEntityID: string | null;
  LinkedRecordID: string | null;
  BatchID: string | null;
  ReversedByJournalEntryID: string | null;
  ReversesJournalEntryID: string | null;
  GLPostedAt: Date | string | null;
  GLReferenceID: string | null;
}

/** Entry numbers for the entries either side of this one in a reversal chain, plus its batch. */
export interface JELineageView {
  BatchNumber: string | null;
  /** The entry that reverses this one, if it has been reversed. */
  ReversalEntryNumber: string | null;
  /** The entry this one reverses, if it is itself a reversal. */
  ReversesEntryNumber: string | null;
}

/** One step in the JE status timeline. */
export interface JETimelineStep {
  Key: JEStatus;
  Label: string;
  Icon: string;
  /** The entry has reached at least this step. */
  Done: boolean;
  /** The entry is exactly here. */
  Current: boolean;
}

/**
 * Rank of each status along the Pending → Batched → GLPosted progression.
 *
 * Exported because it is the ordering itself, not an implementation detail: anything that
 * needs to ask "is this entry at or past X?" should use this rather than restate the order.
 */
export const JE_STATUS_ORDER: Record<JEStatus, number> = {
  Pending: 0,
  Batched: 1,
  GLPosted: 2,
};

const TIMELINE_LABELS: ReadonlyArray<{ Key: JEStatus; Label: string; Icon: string }> = [
  { Key: 'Pending', Label: 'Pending', Icon: 'fa-solid fa-pen' },
  { Key: 'Batched', Label: 'Batched', Icon: 'fa-solid fa-layer-group' },
  { Key: 'GLPosted', Label: 'GL Posted', Icon: 'fa-solid fa-circle-check' },
];

/**
 * Build the timeline for a status. Pure and total — a status CodeGen adds later that is not in
 * {@link JE_STATUS_ORDER} yields an all-pending timeline rather than throwing, because a
 * ledger screen that crashes on an unfamiliar status is worse than one that under-reports.
 */
export function buildJETimeline(status: JEStatus): JETimelineStep[] {
  const reached = JE_STATUS_ORDER[status] ?? 0;
  return TIMELINE_LABELS.map((step) => ({
    ...step,
    Done: reached >= JE_STATUS_ORDER[step.Key],
    Current: status === step.Key,
  }));
}

/** Sum of the debit column. A JE stores no header total — the lines ARE the total. */
export function sumDebits(lines: readonly JELineView[]): number {
  return lines.reduce((total, line) => total + (line.Debit || 0), 0);
}

/** Sum of the credit column. */
export function sumCredits(lines: readonly JELineView[]): number {
  return lines.reduce((total, line) => total + (line.Credit || 0), 0);
}
