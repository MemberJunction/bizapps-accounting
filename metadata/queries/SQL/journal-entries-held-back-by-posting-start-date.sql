-- Journal entries held back by their company's PostingStartDate.
-- Every batch build, preview and sweep selects Pending, non-summary entries dated on or after the
-- company's PostingStartDate, so the entries listed here never enter a batch. One row per entry
-- line, so finance can reconcile them by account against what was booked directly in the ERP.
-- An entry with no lines yet still appears once, with the line columns empty.
SELECT
    je.CompanyID,
    je.Company,
    acp.PostingStartDate,
    je.EntryNumber,
    je.EffectiveDate,
    je.EntryType,
    je.Description AS EntryDescription,
    jel.LineNumber,
    ga.Code AS GLAccountCode,
    ga.Name AS GLAccountName,
    jel.DebitAmount,
    jel.CreditAmount,
    jel.Description AS LineDescription,
    je.ID AS JournalEntryID
FROM [__mj_BizAppsAccounting].vwJournalEntries je
INNER JOIN [__mj_BizAppsAccounting].AccountingCompanyProfile acp
    ON acp.ID = je.CompanyID
INNER JOIN [__mj_BizAppsAccounting].JournalEntryType jet
    ON jet.ID = je.EntryTypeID
LEFT JOIN [__mj_BizAppsAccounting].JournalEntryLine jel
    ON jel.JournalEntryID = je.ID
LEFT JOIN [__mj_BizAppsAccounting].GLAccount ga
    ON ga.ID = jel.GLAccountID
WHERE je.Status = N'Pending'
    AND jet.IsJournalEntryBatchSummary = 0
    AND acp.PostingStartDate IS NOT NULL
    AND je.EffectiveDate < acp.PostingStartDate
ORDER BY
    je.Company,
    je.EffectiveDate,
    je.EntryNumber,
    jel.LineNumber;
