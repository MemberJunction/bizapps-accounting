-- Every cleared finance exception, newest first: the monthly list of clearing decisions
-- (golive #320 §4). ReviewedMonth is the first day of the month the exception was cleared in,
-- in UTC; filter on it for one month's list. SourceCreatedByUser names the source record's
-- creator (the system user for a record a job created); CreatorUnresolved marks one whose
-- creator had no linked login.
SELECT
    DATEFROMPARTS(YEAR(fe.ReviewedAt), MONTH(fe.ReviewedAt), 1) AS ReviewedMonth,
    fe.CompanyID,
    fe.Company,
    fet.Code AS TypeCode,
    fe.FinanceExceptionType,
    fe.Status AS Outcome,
    fe.ReviewedAt,
    fe.ReviewedByUserID,
    fe.ReviewedByUser,
    fe.ReviewNote,
    fe.SourceCreatedByUserID,
    fe.SourceCreatedByUser,
    fe.CreatorUnresolved,
    fe.ExceptionDate,
    fe.Amount,
    fe.Summary,
    fe.SourceEntity,
    fe.SourceRecordID,
    fe.ID AS FinanceExceptionID
FROM [__mj_BizAppsAccounting].vwFinanceExceptions fe
INNER JOIN [__mj_BizAppsAccounting].FinanceExceptionType fet
    ON fet.ID = fe.FinanceExceptionTypeID
WHERE fe.Status <> N'Open'
ORDER BY
    fe.ReviewedAt DESC;
