/**
 * Output for `Accounting.RaiseFinanceExceptions`.
 *
 * `Results` has one entry per input exception, in order, when the call succeeds. When any entry
 * names an unknown type or entity, or is malformed, the call fails with `Success: false`, `Errors`
 * names each bad index, and nothing is written.
 *
 * NO import statements — definitions are emitted verbatim.
 */
export interface AccountingRaiseFinanceExceptionResult {
    /** Position of the exception in the input list. */
    Index: number;
    /** The row raised, or the existing row with the same (TypeCode, DedupeKey). Absent when skipped. */
    FinanceExceptionID?: string;
    /** True only when this call wrote the row. */
    Created: boolean;
    /** True when the type is inactive: nothing was written. */
    Skipped?: boolean;
}

export interface AccountingRaiseFinanceExceptionsError {
    /** The input index the error belongs to; absent for a call-level error. */
    Index?: number;
    Code: string;
    Message: string;
}

export interface AccountingRaiseFinanceExceptionsOutput {
    Success: boolean;
    Results: AccountingRaiseFinanceExceptionResult[];
    Errors?: AccountingRaiseFinanceExceptionsError[];
}
