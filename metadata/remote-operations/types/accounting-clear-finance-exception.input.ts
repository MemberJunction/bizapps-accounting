/**
 * Input for `Accounting.ClearFinanceException`.
 *
 * NO import statements — definitions are emitted verbatim.
 */
export interface AccountingClearFinanceExceptionInput {
    FinanceExceptionID: string;
    /** Reviewed: the judgement stands. Corrected: the data was fixed. Both are terminal. */
    Outcome: 'Reviewed' | 'Corrected';
    /** What the reviewer checked or changed. Required. */
    Note: string;
}
