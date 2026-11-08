/**
 * Output for `Accounting.ClearFinanceException`.
 *
 * NO import statements — definitions are emitted verbatim.
 */
export interface AccountingClearFinanceExceptionError {
    Code: string;
    Message: string;
}

export interface AccountingClearFinanceExceptionOutput {
    Success: boolean;
    /** The exception's status after the call: the outcome on success, the unchanged status on a refusal that read it. */
    Status?: string;
    Errors?: AccountingClearFinanceExceptionError[];
}
