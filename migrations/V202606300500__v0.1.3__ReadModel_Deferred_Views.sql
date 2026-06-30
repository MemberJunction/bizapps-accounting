-- =============================================================================
-- Block 6 (completion) — the previously-deferred read-model views.
--
-- The first read-model migration (V202606300300) shipped 6 views and listed 5 as DEFERRED.
-- On review the subledger's own committed schema DOES support all of them now — the earlier
-- "deferred" note was over-cautious. This migration delivers them. Reporting views (`vw_`
-- prefix, distinct from CodeGen's per-entity `vw<Entity>`); idempotent (CREATE OR ALTER),
-- additive-only; they are NOT entities (no CodeGen). Balances are computed ON DEMAND from
-- JournalEntryLine (per AD-12: AccountBalance* materialization is deferred to post-v1).
--
-- DELIVERED HERE:
--   vw_SalesTaxLiability  — accrued vs remitted tax per Company × Authority × Jurisdiction × Period
--   vw_IntercompanyFlow   — all legs of an intercompany flow, reassembled by JournalEntry.IntercompanyFlowID
--   vw_DefRevRollforward  — deferred-revenue opening/additions/releases/closing per Company × Period
--   vw_AROpenByCustomer   — open AR balance per customer (JournalEntryLine.CounterpartyOrganizationID)
--   vw_ARAging            — open AR bucketed by age per customer
--
-- ACCOUNT IDENTIFICATION: the AR / Deferred-Revenue / Sales-Tax control accounts are resolved via
-- AccountingCompanyProfile.{AROpenGLAccountID, DeferredRevenueGLAccountID, SalesTaxPayableGLAccountID}
-- (NOT by hardcoded code), so a company that re-points its control account stays correct.
--
-- KNOWN v1 LIMITATIONS (test/extend when the upstream systems land — Orders/Payments, Block 7+):
--   * AR aging uses JournalEntry.EffectiveDate as the age basis (JournalEntry has no invoice DueDate;
--     that is an upstream Orders concept). Precise invoice-level (open-item / FIFO settlement) aging
--     requires upstream invoice + payment-application data — NOT modeled in the subledger yet.
--   * vw_AROpenByCustomer / vw_ARAging are populated only once AR lines carry CounterpartyOrganizationID
--     (Orders/Payments emit these; the demo seed exercises them). They are correct + testable now.
--   * vw_IntercompanyFlow shows whatever IntercompanyFlowID-tagged legs exist; the net+batch ENGINE
--     (Block 3) is what produces them at scale. The view is read-only and independent of that engine.
--   * vw_SalesTaxLiability reads TaxLiability accrued/remitted balances; the tax CALCULATION provider
--     is Block 7 (tail). The view is correct against whatever TaxLiability rows exist.
-- =============================================================================

---------------------------------------------------------------------------
-- vw_SalesTaxLiability — accrued vs remitted sales-tax liability
---------------------------------------------------------------------------
CREATE OR ALTER VIEW __mj_BizAppsAccounting.vw_SalesTaxLiability AS
SELECT
    tl.CompanyID,
    c.Name                                         AS CompanyName,
    tl.TaxAuthorityID,
    ta.Code                                        AS AuthorityCode,
    ta.Name                                        AS AuthorityName,
    tl.TaxJurisdictionID,
    tj.Code                                        AS JurisdictionCode,
    tj.Name                                        AS JurisdictionName,
    tl.AccountingPeriodID,
    ap.FiscalYear,
    ap.PeriodType,
    ap.PeriodStart,
    ap.PeriodEnd,
    tl.AccruedAmount,
    tl.RemittedAmount,
    tl.AccruedAmount - tl.RemittedAmount           AS OutstandingLiability,
    tl.Status,
    tl.DueDate,
    tl.FilingFrequency
FROM __mj_BizAppsAccounting.TaxLiability tl
JOIN __mj_BizAppsAccounting.TaxAuthority ta    ON ta.ID = tl.TaxAuthorityID
JOIN __mj_BizAppsAccounting.TaxJurisdiction tj ON tj.ID = tl.TaxJurisdictionID
JOIN __mj_BizAppsAccounting.AccountingPeriod ap ON ap.ID = tl.AccountingPeriodID
LEFT JOIN __mj.Company c ON c.ID = tl.CompanyID;
GO

---------------------------------------------------------------------------
-- vw_IntercompanyFlow — reassemble every leg of a flow by IntercompanyFlowID
---------------------------------------------------------------------------
CREATE OR ALTER VIEW __mj_BizAppsAccounting.vw_IntercompanyFlow AS
SELECT
    je.IntercompanyFlowID,
    je.CompanyID,
    c.Name                                         AS CompanyName,
    je.ID                                          AS JournalEntryID,
    je.EntryNumber,
    je.EntryType,
    je.Status,
    je.EffectiveDate,
    jel.LineNumber,
    jel.CounterpartyOrganizationID,
    o.Name                                         AS CounterpartyName,
    gl.Code                                        AS GLAccountCode,
    gl.Name                                        AS GLAccountName,
    gl.AccountType,
    jel.DebitAmount,
    jel.CreditAmount,
    jel.Description                                AS LineDescription
FROM __mj_BizAppsAccounting.JournalEntry je
JOIN __mj_BizAppsAccounting.JournalEntryLine jel ON jel.JournalEntryID = je.ID
JOIN __mj_BizAppsAccounting.GLAccount gl         ON gl.ID = jel.GLAccountID
LEFT JOIN __mj_BizAppsCommon.Organization o      ON o.ID = jel.CounterpartyOrganizationID
LEFT JOIN __mj.Company c                          ON c.ID = je.CompanyID
WHERE je.IntercompanyFlowID IS NOT NULL;
GO

---------------------------------------------------------------------------
-- vw_DefRevRollforward — deferred-revenue rollforward (opening/additions/releases/closing)
--   Deferred Revenue is a liability (credit-normal): additions = credits (revenue deferred),
--   releases = debits (revenue recognized). Opening/closing are cumulative, computed on demand
--   from JournalEntryLine via window functions (AD-12 — no materialized balances).
--   Assumes JEs post to non-overlapping periods (normal month-grain posting).
---------------------------------------------------------------------------
CREATE OR ALTER VIEW __mj_BizAppsAccounting.vw_DefRevRollforward AS
WITH defrev AS (
    SELECT
        je.CompanyID,
        je.AccountingPeriodID,
        SUM(ISNULL(jel.CreditAmount, 0)) AS Additions,   -- revenue deferred (credit)
        SUM(ISNULL(jel.DebitAmount, 0))  AS Releases      -- revenue recognized (debit)
    FROM __mj_BizAppsAccounting.JournalEntry je
    JOIN __mj_BizAppsAccounting.JournalEntryLine jel ON jel.JournalEntryID = je.ID
    JOIN __mj_BizAppsAccounting.AccountingCompanyProfile acp ON acp.ID = je.CompanyID
    WHERE jel.GLAccountID = acp.DeferredRevenueGLAccountID
      AND je.Status IN ('Batched', 'GLPosted')
    GROUP BY je.CompanyID, je.AccountingPeriodID
)
SELECT
    d.CompanyID,
    c.Name                                         AS CompanyName,
    d.AccountingPeriodID,
    ap.FiscalYear,
    ap.PeriodType,
    ap.PeriodStart,
    ap.PeriodEnd,
    ISNULL(SUM(d.Additions - d.Releases) OVER (
        PARTITION BY d.CompanyID ORDER BY ap.PeriodStart
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)  AS OpeningBalance,
    d.Additions,
    d.Releases,
    d.Additions - d.Releases                       AS NetChange,
    SUM(d.Additions - d.Releases) OVER (
        PARTITION BY d.CompanyID ORDER BY ap.PeriodStart
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)      AS ClosingBalance
FROM defrev d
JOIN __mj_BizAppsAccounting.AccountingPeriod ap ON ap.ID = d.AccountingPeriodID
LEFT JOIN __mj.Company c ON c.ID = d.CompanyID;
GO

---------------------------------------------------------------------------
-- vw_AROpenByCustomer — open AR balance per customer Organization
--   AR is an asset (debit-normal): open balance = SUM(Dr) - SUM(Cr) on the AR control account.
---------------------------------------------------------------------------
CREATE OR ALTER VIEW __mj_BizAppsAccounting.vw_AROpenByCustomer AS
SELECT
    je.CompanyID,
    c.Name                                                            AS CompanyName,
    jel.CounterpartyOrganizationID                                    AS CustomerOrganizationID,
    o.Name                                                            AS CustomerName,
    SUM(ISNULL(jel.DebitAmount, 0) - ISNULL(jel.CreditAmount, 0))      AS OpenBalance,
    SUM(ISNULL(jel.DebitAmount, 0))                                    AS TotalCharges,
    SUM(ISNULL(jel.CreditAmount, 0))                                   AS TotalPayments,
    COUNT(DISTINCT je.ID)                                              AS EntryCount
FROM __mj_BizAppsAccounting.JournalEntry je
JOIN __mj_BizAppsAccounting.JournalEntryLine jel ON jel.JournalEntryID = je.ID
JOIN __mj_BizAppsAccounting.AccountingCompanyProfile acp ON acp.ID = je.CompanyID
LEFT JOIN __mj_BizAppsCommon.Organization o ON o.ID = jel.CounterpartyOrganizationID
LEFT JOIN __mj.Company c ON c.ID = je.CompanyID
WHERE jel.GLAccountID = acp.AROpenGLAccountID
  AND je.Status IN ('Batched', 'GLPosted')
GROUP BY je.CompanyID, c.Name, jel.CounterpartyOrganizationID, o.Name
HAVING SUM(ISNULL(jel.DebitAmount, 0) - ISNULL(jel.CreditAmount, 0)) <> 0;
GO

---------------------------------------------------------------------------
-- vw_ARAging — open AR per customer bucketed by age (EffectiveDate basis, as of now/UTC)
---------------------------------------------------------------------------
CREATE OR ALTER VIEW __mj_BizAppsAccounting.vw_ARAging AS
WITH ar AS (
    SELECT
        je.CompanyID,
        jel.CounterpartyOrganizationID                            AS CustomerOrganizationID,
        DATEDIFF(DAY, je.EffectiveDate, CAST(SYSUTCDATETIME() AS DATE)) AS AgeDays,
        (ISNULL(jel.DebitAmount, 0) - ISNULL(jel.CreditAmount, 0)) AS NetAmount
    FROM __mj_BizAppsAccounting.JournalEntry je
    JOIN __mj_BizAppsAccounting.JournalEntryLine jel ON jel.JournalEntryID = je.ID
    JOIN __mj_BizAppsAccounting.AccountingCompanyProfile acp ON acp.ID = je.CompanyID
    WHERE jel.GLAccountID = acp.AROpenGLAccountID
      AND je.Status IN ('Batched', 'GLPosted')
)
SELECT
    ar.CompanyID,
    c.Name                                                                       AS CompanyName,
    ar.CustomerOrganizationID,
    o.Name                                                                       AS CustomerName,
    SUM(CASE WHEN ar.AgeDays <= 30                       THEN ar.NetAmount ELSE 0 END) AS Current_0_30,
    SUM(CASE WHEN ar.AgeDays BETWEEN 31 AND 60           THEN ar.NetAmount ELSE 0 END) AS Days_31_60,
    SUM(CASE WHEN ar.AgeDays BETWEEN 61 AND 90           THEN ar.NetAmount ELSE 0 END) AS Days_61_90,
    SUM(CASE WHEN ar.AgeDays > 90                        THEN ar.NetAmount ELSE 0 END) AS Days_Over_90,
    SUM(ar.NetAmount)                                                            AS TotalOpen
FROM ar
LEFT JOIN __mj_BizAppsCommon.Organization o ON o.ID = ar.CustomerOrganizationID
LEFT JOIN __mj.Company c ON c.ID = ar.CompanyID
GROUP BY ar.CompanyID, c.Name, ar.CustomerOrganizationID, o.Name
HAVING SUM(ar.NetAmount) <> 0;
GO
