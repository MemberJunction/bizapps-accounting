-- =============================================================================
-- Check: Division, Department and Branch profiles that own active GL accounts.
-- READ-ONLY. Every statement is a SELECT; nothing is written.
-- =============================================================================
--
-- WHY
--
-- A Division, Department or Branch keeps no books of its own: its entries use the
-- accounts of its legal entity, the first company above it of any other type. An
-- active GL account owned by such a company is never resolved for new entries, and
-- an entry that does land on it is booked under a company that may have no ERP
-- connection.
--
-- The application refuses that state when it is created: an active account on such
-- a company, and a profile becoming one of those types while its company owns active
-- accounts. Rows saved before those checks shipped are not re-validated, so this
-- query finds them. What to do with each row: docs/parent-books-account-owners-check.md.
--
-- OUTPUT
--
-- One row per offending profile. No rows: nothing to do.
--   ActiveAccounts         active GL accounts the company owns
--   ActiveAccountCodes     their codes
--   PendingEntryLines      lines on those accounts in entries not yet batched
--   UnpostedEntryLines     lines on those accounts in entries batched but not posted to the GL
--   ActiveAccountLinks     Active GL account links that point at those accounts
--
-- Run with sqlcmd (-b stops on error), e.g.
--   sqlcmd -S <host>,<port> -d <database> -U <user> -P <password> -C -b -W -s "|" \
--          -i scripts/check-parent-books-account-owners.sql
-- =============================================================================
SET NOCOUNT ON;

WITH OwnedActiveAccounts AS (
    SELECT p.ID AS CompanyID, a.ID AS GLAccountID, a.Code
    FROM __mj_BizAppsAccounting.AccountingCompanyProfile p
    JOIN __mj_BizAppsAccounting.GLAccount a
        ON a.CompanyID = p.ID
       AND a.IsActive = 1
    WHERE p.EntityType IN (N'Division', N'Department', N'Branch')
),
AccountCounts AS (
    SELECT CompanyID,
           COUNT(*) AS ActiveAccounts,
           STRING_AGG(CAST(Code AS NVARCHAR(MAX)), N', ') WITHIN GROUP (ORDER BY Code) AS ActiveAccountCodes
    FROM OwnedActiveAccounts
    GROUP BY CompanyID
),
LineCounts AS (
    SELECT o.CompanyID,
           SUM(CASE WHEN je.Status = N'Pending' THEN 1 ELSE 0 END) AS PendingEntryLines,
           SUM(CASE WHEN je.Status = N'Batched' THEN 1 ELSE 0 END) AS UnpostedEntryLines
    FROM OwnedActiveAccounts o
    JOIN __mj_BizAppsAccounting.JournalEntryLine l ON l.GLAccountID = o.GLAccountID
    JOIN __mj_BizAppsAccounting.JournalEntry je ON je.ID = l.JournalEntryID
    GROUP BY o.CompanyID
),
LinkCounts AS (
    SELECT o.CompanyID, COUNT(*) AS ActiveAccountLinks
    FROM OwnedActiveAccounts o
    JOIN __mj_BizAppsAccounting.GLAccountLink k
        ON k.GLAccountID = o.GLAccountID
       AND k.Status = N'Active'
    GROUP BY o.CompanyID
)
SELECT
    p.ID AS CompanyID,
    c.Name AS Company,
    p.CompanyCode,
    p.EntityType,
    p.ParentAccountingCompanyID,
    parent.Name AS ParentCompany,
    ac.ActiveAccounts,
    ac.ActiveAccountCodes,
    ISNULL(lc.PendingEntryLines, 0) AS PendingEntryLines,
    ISNULL(lc.UnpostedEntryLines, 0) AS UnpostedEntryLines,
    ISNULL(kc.ActiveAccountLinks, 0) AS ActiveAccountLinks
FROM AccountCounts ac
JOIN __mj_BizAppsAccounting.AccountingCompanyProfile p ON p.ID = ac.CompanyID
JOIN __mj.Company c ON c.ID = p.ID
LEFT JOIN __mj.Company parent ON parent.ID = p.ParentAccountingCompanyID
LEFT JOIN LineCounts lc ON lc.CompanyID = ac.CompanyID
LEFT JOIN LinkCounts kc ON kc.CompanyID = ac.CompanyID
ORDER BY c.Name;
