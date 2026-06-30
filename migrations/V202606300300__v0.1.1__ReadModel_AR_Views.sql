-- =============================================================================
-- Block 6 — Read-model views for Skip-generated reports / dashboards.
--
-- These are REPORTING views (prefix `vw_` with an underscore, to distinguish them from CodeGen's
-- per-entity `vw<Entity>` base views). They read the AR subledger's own committed data; downstream
-- reporting (Skip, dashboards) queries them directly. Idempotent (CREATE OR ALTER), additive-only.
--
-- DELIVERED (fully supported by the subledger's own data):
--   vw_TrialBalance_AR      — per Company × GLAccount debit/credit/net over committed JEs
--   vw_JEAuditTrail         — flattened JE + line + account + period + batch for drill-through
--   vw_ARtoGLRecon          — per Company × Period entry-status reconciliation (pending→batched→posted)
--   vw_DimensionPL          — revenue/expense netted by analytical dimension value
--   vw_BatchDispatchStatus  — batch lifecycle + control totals + summary-line count
--   vw_ScheduledJESummary   — scheduled-JE rollup by company / entry-type / status
--
-- DEFERRED (depend on data this subledger does not own yet — documented, not stubbed):
--   vw_AROpenByCustomer / vw_ARAging  — need customer + invoice-level AR (upstream Orders, §C1)
--   vw_SalesTaxLiability              — needs the tax engine's accrued balances (Block 7+)
--   vw_FxExposure                     — FX is computed upstream/Payments (W5 retired, §C1)
--   vw_IntercompanyFlow               — intercompany engine deferred (Block 3 schema only)
--   vw_DefRevRollforward              — needs opening balances (AccountBalance materialization, AD-12 deferred)
-- =============================================================================

CREATE OR ALTER VIEW __mj_BizAppsAccounting.vw_TrialBalance_AR AS
SELECT
    je.CompanyID,
    c.Name                                                        AS CompanyName,
    gl.ID                                                           AS GLAccountID,
    gl.Code                                                         AS GLAccountCode,
    gl.Name                                                         AS GLAccountName,
    gl.AccountType,
    SUM(ISNULL(jel.DebitAmount, 0))                                 AS TotalDebits,
    SUM(ISNULL(jel.CreditAmount, 0))                                AS TotalCredits,
    SUM(ISNULL(jel.DebitAmount, 0)) - SUM(ISNULL(jel.CreditAmount, 0)) AS NetBalance,
    COUNT(DISTINCT je.ID)                                           AS EntryCount
FROM __mj_BizAppsAccounting.JournalEntry je
JOIN __mj_BizAppsAccounting.JournalEntryLine jel ON jel.JournalEntryID = je.ID
JOIN __mj_BizAppsAccounting.GLAccount gl ON gl.ID = jel.GLAccountID
LEFT JOIN __mj.Company c ON c.ID = je.CompanyID
WHERE je.Status IN ('Batched', 'GLPosted')   -- committed to the ledger (excludes still-editable Pending)
GROUP BY je.CompanyID, c.Name, gl.ID, gl.Code, gl.Name, gl.AccountType;
GO

CREATE OR ALTER VIEW __mj_BizAppsAccounting.vw_JEAuditTrail AS
SELECT
    je.ID                  AS JournalEntryID,
    je.EntryNumber,
    je.CompanyID,
    c.Name               AS CompanyName,
    je.EntryType,
    je.Status,
    je.EffectiveDate,
    ap.FiscalYear,
    ap.PeriodType,
    ap.PeriodStart,
    ap.PeriodEnd,
    jel.LineNumber,
    gl.Code                AS GLAccountCode,
    gl.Name                AS GLAccountName,
    gl.AccountType,
    jel.DebitAmount,
    jel.CreditAmount,
    jel.Description        AS LineDescription,
    je.BatchID,
    b.BatchNumber,
    je.GLReferenceID,
    je.GLPostedAt,
    je.ScheduledJournalEntryID
FROM __mj_BizAppsAccounting.JournalEntry je
JOIN __mj_BizAppsAccounting.JournalEntryLine jel ON jel.JournalEntryID = je.ID
JOIN __mj_BizAppsAccounting.GLAccount gl ON gl.ID = jel.GLAccountID
JOIN __mj_BizAppsAccounting.AccountingPeriod ap ON ap.ID = je.AccountingPeriodID
LEFT JOIN __mj_BizAppsAccounting.JournalEntryBatch b ON b.ID = je.BatchID
LEFT JOIN __mj.Company c ON c.ID = je.CompanyID;
GO

CREATE OR ALTER VIEW __mj_BizAppsAccounting.vw_ARtoGLRecon AS
SELECT
    je.CompanyID,
    c.Name                                                  AS CompanyName,
    je.AccountingPeriodID,
    ap.FiscalYear,
    ap.PeriodType,
    ap.PeriodStart,
    SUM(CASE WHEN je.Status = 'Pending'  THEN 1 ELSE 0 END)   AS PendingEntries,
    SUM(CASE WHEN je.Status = 'Batched'  THEN 1 ELSE 0 END)   AS BatchedEntries,
    SUM(CASE WHEN je.Status = 'GLPosted' THEN 1 ELSE 0 END)   AS GLPostedEntries,
    COUNT(*)                                                  AS TotalEntries
FROM __mj_BizAppsAccounting.JournalEntry je
JOIN __mj_BizAppsAccounting.AccountingPeriod ap ON ap.ID = je.AccountingPeriodID
LEFT JOIN __mj.Company c ON c.ID = je.CompanyID
GROUP BY je.CompanyID, c.Name, je.AccountingPeriodID, ap.FiscalYear, ap.PeriodType, ap.PeriodStart;
GO

CREATE OR ALTER VIEW __mj_BizAppsAccounting.vw_DimensionPL AS
SELECT
    je.CompanyID,
    c.Name                                                          AS CompanyName,
    d.ID                                                              AS DimensionID,
    d.Code                                                            AS DimensionCode,
    d.Name                                                            AS DimensionName,
    dv.ID                                                             AS DimensionValueID,
    dv.Code                                                           AS DimensionValueCode,
    dv.Name                                                           AS DimensionValueName,
    gl.AccountType,
    SUM(ISNULL(jel.CreditAmount, 0) - ISNULL(jel.DebitAmount, 0))     AS NetAmount,  -- revenue is credit-positive
    SUM(ISNULL(jel.DebitAmount, 0))                                   AS TotalDebits,
    SUM(ISNULL(jel.CreditAmount, 0))                                  AS TotalCredits
FROM __mj_BizAppsAccounting.JournalEntryLine jel
JOIN __mj_BizAppsAccounting.JournalEntry je ON je.ID = jel.JournalEntryID
JOIN __mj_BizAppsAccounting.GLAccount gl ON gl.ID = jel.GLAccountID
JOIN __mj_BizAppsAccounting.JournalEntryLineDimension jeld ON jeld.JournalEntryLineID = jel.ID
JOIN __mj_BizAppsAccounting.Dimension d ON d.ID = jeld.DimensionID
JOIN __mj_BizAppsAccounting.DimensionValue dv ON dv.ID = jeld.DimensionValueID
LEFT JOIN __mj.Company c ON c.ID = je.CompanyID
WHERE gl.AccountType IN ('Revenue', 'Expense', 'ContraRevenue', 'ContraExpense')
  AND je.Status IN ('Batched', 'GLPosted')
GROUP BY je.CompanyID, c.Name, d.ID, d.Code, d.Name, dv.ID, dv.Code, dv.Name, gl.AccountType;
GO

CREATE OR ALTER VIEW __mj_BizAppsAccounting.vw_BatchDispatchStatus AS
SELECT
    b.ID                AS BatchID,
    b.BatchNumber,
    b.CompanyID,
    c.Name            AS CompanyName,
    b.AccountingPeriodID,
    ap.FiscalYear,
    ap.PeriodType,
    b.TargetSystem,
    b.Status,
    b.TotalEntries,
    b.TotalDebits,
    b.TotalCredits,
    b.ExternalBatchRef,
    b.BatchedAt,
    b.SentAt,
    b.AcknowledgedAt,
    (SELECT COUNT(*) FROM __mj_BizAppsAccounting.JournalEntryBatchLineItem li WHERE li.BatchID = b.ID) AS SummaryLineCount
FROM __mj_BizAppsAccounting.JournalEntryBatch b
JOIN __mj_BizAppsAccounting.AccountingPeriod ap ON ap.ID = b.AccountingPeriodID
LEFT JOIN __mj.Company c ON c.ID = b.CompanyID;
GO

CREATE OR ALTER VIEW __mj_BizAppsAccounting.vw_ScheduledJESummary AS
SELECT
    sje.CompanyID,
    c.Name                              AS CompanyName,
    sje.EntryType,
    sje.Status,
    COUNT(*)                              AS EntryCount,
    SUM(sje.TotalAmount)                  AS TotalAmount,
    MIN(sje.ScheduledEffectiveDate)       AS EarliestEffectiveDate,
    MAX(sje.ScheduledEffectiveDate)       AS LatestEffectiveDate
FROM __mj_BizAppsAccounting.ScheduledJournalEntry sje
LEFT JOIN __mj.Company c ON c.ID = sje.CompanyID
GROUP BY sje.CompanyID, c.Name, sje.EntryType, sje.Status;
GO
