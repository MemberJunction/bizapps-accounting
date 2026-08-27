-- =============================================================================
-- Migration: V202608271852__v0.1.x__GLAccountRole_Cardinality.sql
-- Description: BA-D34 — GLAccountRole.Cardinality (One | Many) + the BankAccount role
-- =============================================================================
--
-- Design: plans/fpna-cash-bank-accounts.md · Decision BA-D34
-- Companion: bizapps-fpna#3 (CashBalance reads what this migration enables)
--
-- WHY
--
-- FP&A opening cash is a rollup of EVERY bank / cash GL account a company holds,
-- not the single account Orders posts a receipt into. Those are two different
-- questions and they need two roles with different cardinality:
--
--   "Where does a receipt POST?"      -> Cash         One    Orders / payments
--   "What IS cash, for a position?"   -> BankAccount  Many   FP&A CashBalance
--
-- A company with operating, payroll and money-market accounts cannot hang all
-- three on Cash without either breaking the BA-D32 tie guard or making payment
-- capture pick an arbitrary bank. A guessed single bank still balances, which is
-- exactly the invisibility BA-D27 / BA-D28 exist to prevent.
--
-- NO BEHAVIOR CHANGE FOR ORDERS. Every existing role is backfilled to 'One', so
-- the tie guard and ResolveLinkedAccount behave exactly as before. 'Many' is
-- opt-in and today only BankAccount uses it.
--
-- WHAT THIS MIGRATION DOES *NOT* DO — the engine work is a separate commit:
--   * GLAccountLinkEntityServer.checkNoAmbiguousTie must return early when the
--     role's Cardinality = 'Many' (the tie guard is meaningless for a Many role).
--   * AccountingEngineBase.ResolveLinkedAccount must raise a typed error
--     (ROLE_NOT_SINGULAR) for a Many role rather than return an arbitrary row.
--   * ResolveLinkedAccounts(role, record, asOf, forCompanyID) -> GLAccount[].
--   * An integration check: a company with two BankAccount links and one Cash
--     link — Cash resolves to the settlement account, BankAccount resolves to
--     both, posting still uses Cash.
-- Until those land, the column is inert: nothing reads Cardinality, and the tie
-- guard would still (wrongly) fire on a second BankAccount link. Adding the
-- column first is deliberate — it lets the engine work compile against a real
-- schema instead of shipping both halves in one unreviewable change.
--
-- IDEMPOTENT. Safe to re-run and safe on a database that already carries data.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Cardinality column
-- -----------------------------------------------------------------------------
-- NOT NULL with a default, so existing rows are backfilled to 'One' by the ADD
-- itself. The explicit UPDATE below covers a database where the column was added
-- without the default by some earlier hand-repair.
-- -----------------------------------------------------------------------------
IF COL_LENGTH('__mj_BizAppsAccounting.GLAccountRole', 'Cardinality') IS NULL
BEGIN
    ALTER TABLE __mj_BizAppsAccounting.GLAccountRole
        ADD Cardinality NVARCHAR(10) NOT NULL
            CONSTRAINT DF_GLAccountRole_Cardinality DEFAULT 'One';
END
GO

UPDATE __mj_BizAppsAccounting.GLAccountRole
    SET Cardinality = 'One'
    WHERE Cardinality IS NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_GLAccountRole_Cardinality'
      AND parent_object_id = OBJECT_ID('__mj_BizAppsAccounting.GLAccountRole')
)
BEGIN
    ALTER TABLE __mj_BizAppsAccounting.GLAccountRole
        ADD CONSTRAINT CK_GLAccountRole_Cardinality
            CHECK (Cardinality IN ('One', 'Many'));
END
GO


-- -----------------------------------------------------------------------------
-- 2. Extended property — CodeGen reads MS_Description to document the field
-- -----------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.extended_properties ep
    JOIN sys.objects o ON o.object_id = ep.major_id
    JOIN sys.columns c ON c.object_id = o.object_id AND c.column_id = ep.minor_id
    WHERE ep.name = 'MS_Description'
      AND o.object_id = OBJECT_ID('__mj_BizAppsAccounting.GLAccountRole')
      AND c.name = 'Cardinality'
)
BEGIN
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'How many Active GLAccountLinks this role may resolve to for one record and company. One (default, every pre-existing role including Cash): the BA-D32 tie guard applies and ResolveLinkedAccount returns a single account, latest StartedAt winning among overlapping links. Many: the tie guard does not apply and ResolveLinkedAccount REFUSES the role rather than returning an arbitrary account — callers use ResolveLinkedAccounts and get every Active link whose window covers AsOf. Separating the two is what lets a company hold N bank accounts for a cash position without disturbing where payments post.',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
        @level1type = N'TABLE',  @level1name = N'GLAccountRole',
        @level2type = N'COLUMN', @level2name = N'Cardinality';
END
GO


-- -----------------------------------------------------------------------------
-- 3. The BankAccount role
-- -----------------------------------------------------------------------------
-- Hardcoded UUID, matching the nine roles already seeded from
-- metadata/gl-account-roles. Sequence 15 places it next to Cash (10).
--
-- Seeded here rather than left to metadata sync because migrations are the only
-- thing that reaches a host: `mj app install` runs migrations and never
-- `mj sync push`. metadata/gl-account-roles carries the same row as the dev
-- source of truth, and a later regenerated Metadata_Sync will find it present
-- and no-op.
-- -----------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM __mj_BizAppsAccounting.GLAccountRole
    WHERE ID = '069B34E1-90C5-4275-A79A-F9EF71BE472F' OR Name = 'BankAccount'
)
BEGIN
    INSERT INTO __mj_BizAppsAccounting.GLAccountRole
        (ID, Name, Description, Status, Sequence, Cardinality)
    VALUES
        (
            '069B34E1-90C5-4275-A79A-F9EF71BE472F',
            'BankAccount',
            'Cash / bank GL account that counts toward the company''s cash position. Many per company, date-effective. NOT used for payment posting — that is role Cash, which stays singular. Read by FP&A to build CashBalance as the sum of a company''s Active BankAccount links at a point in time.',
            'Active',
            15,
            'Many'
        );
END
GO
