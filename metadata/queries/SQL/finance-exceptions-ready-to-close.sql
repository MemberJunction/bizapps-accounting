-- Month-end readiness from the finance exception list.
-- One row per company and month (the first day of the ExceptionDate's month) that has any
-- exception. A month is ready to close when it has no Open exceptions: IsReadyToClose = 1,
-- or no row at all.
SELECT
    fe.CompanyID,
    fe.Company,
    DATEFROMPARTS(YEAR(fe.ExceptionDate), MONTH(fe.ExceptionDate), 1) AS ExceptionMonth,
    SUM(CASE WHEN fe.Status = N'Open' THEN 1 ELSE 0 END) AS OpenCount,
    SUM(CASE WHEN fe.Status = N'Open' THEN ISNULL(fe.Amount, 0) ELSE 0 END) AS OpenAmount,
    SUM(CASE WHEN fe.Status <> N'Open' THEN 1 ELSE 0 END) AS ClearedCount,
    CAST(CASE WHEN SUM(CASE WHEN fe.Status = N'Open' THEN 1 ELSE 0 END) = 0 THEN 1 ELSE 0 END AS BIT) AS IsReadyToClose
FROM [__mj_BizAppsAccounting].vwFinanceExceptions fe
GROUP BY
    fe.CompanyID,
    fe.Company,
    DATEFROMPARTS(YEAR(fe.ExceptionDate), MONTH(fe.ExceptionDate), 1)
ORDER BY
    ExceptionMonth DESC,
    fe.Company;
