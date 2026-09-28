/**
 * Input for `Accounting.RaiseFinanceExceptions`.
 *
 * NO import statements — definitions are emitted verbatim.
 */
export interface AccountingFinanceExceptionToRaise {
    /** A `FinanceExceptionType.Code`. Unknown codes fail the whole call. */
    TypeCode: string;
    /** MJ entity name of the source record (e.g. `MJ_BizApps_Orders: Order Lines`), resolved to SourceEntityID. */
    SourceEntityName: string;
    /** Primary key of the source record. */
    SourceRecordID: string;
    /** The company whose books are affected. */
    CompanyID: string;
    /** The amount at stake, or null when the detector cannot state one. */
    Amount?: number | null;
    /** The business day the exception belongs to, `YYYY-MM-DD`. Its month is the close it blocks. */
    ExceptionDate: string;
    /** Plain description of what was found in the data. */
    Summary: string;
    /** The detector's identity for this occurrence. Raising the same (TypeCode, DedupeKey) again returns the existing row unchanged. */
    DedupeKey: string;
    /** The login whose judgement is under review; that user may not clear the exception. */
    SourceCreatedByUserID?: string | null;
    /** True when a creator exists but has no linked login, so separation of duties cannot be checked. */
    CreatorUnresolved?: boolean;
}

export interface AccountingRaiseFinanceExceptionsInput {
    Exceptions: AccountingFinanceExceptionToRaise[];
}
