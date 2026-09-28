/**
 * Output for `Accounting.GetFinanceExceptionTypes`.
 *
 * A detector reads its thresholds here. A code that is missing from `Types`, or present with
 * `IsActive: false`, means the detector skips and logs — it never falls back to defaults of its own.
 *
 * NO import statements — definitions are emitted verbatim.
 */
export interface AccountingFinanceExceptionTypeSetting {
    /** The type's stable code, e.g. `PROGRESS_JUDGMENT_CALL`. */
    Code: string;
    IsActive: boolean;
    /** The type's `Configuration` JSON, parsed. `{}` when the type has no thresholds. */
    Configuration: Record<string, unknown>;
}

export interface AccountingGetFinanceExceptionTypesError {
    Code: string;
    Message: string;
}

export interface AccountingGetFinanceExceptionTypesOutput {
    Success: boolean;
    /** One entry per type found. A requested code with no type is simply absent. */
    Types: AccountingFinanceExceptionTypeSetting[];
    Errors?: AccountingGetFinanceExceptionTypesError[];
}
