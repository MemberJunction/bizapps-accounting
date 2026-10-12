-- =============================================================================
-- Migration: V202610041000__v0.20.x__AccountingCompanyProfile_Parent_Tree.sql
-- Description: a company profile's parent may itself have a parent. Cycles
--              stay refused.
-- =============================================================================
--
-- WHY
--
-- A Division, Department or Branch keeps no books of its own: it uses the books
-- of its legal entity, found by walking ParentAccountingCompanyID up to the
-- first company of any other type (AccountingEngineBase.LegalEntityFor). That
-- legal entity can itself sit under a holding company. trg_ACP_NoChains (BA-D9)
-- allowed one hop only, so it refused the Division the moment its parent had a
-- parent, and the company structure could not be recorded.
--
-- WHAT CHANGES
--
-- trg_ACP_NoChains is re-created to refuse a CYCLE instead of a chain: a save is
-- refused when walking up from a saved profile reaches that profile again. A
-- profile pointing at itself is already refused by
-- CK_AccountingCompanyProfile_NoSelfParent. Error 50010 is kept, with a new
-- message. The trigger keeps its name, which the invariant-trigger preflight
-- (test-harnesses/server/trigger-preflight.ts) lists.
--
-- The ParentAccountingCompanyID description is rewritten to match.
--
-- No existing row changes. The old trigger allowed no chains, so no stored
-- profile has a cycle.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================
SET NOCOUNT ON;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_ACP_NoChains
ON __mj_BizAppsAccounting.AccountingCompanyProfile
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(ParentAccountingCompanyID)
        RETURN;

    DECLARE @CycleFound BIT = 0;

    -- Walk up from every saved row. Recursion stops at a root, at the starting
    -- row (the cycle), or at depth 99, inside SQL Server's default MAXRECURSION
    -- of 100. A tree deeper than 99 is not a company structure.
    WITH Ancestors AS (
        SELECT i.ID AS StartID, i.ParentAccountingCompanyID AS AncestorID, 1 AS Depth
        FROM inserted i
        WHERE i.ParentAccountingCompanyID IS NOT NULL
        UNION ALL
        SELECT a.StartID, p.ParentAccountingCompanyID, a.Depth + 1
        FROM Ancestors a
        JOIN __mj_BizAppsAccounting.AccountingCompanyProfile p ON p.ID = a.AncestorID
        WHERE p.ParentAccountingCompanyID IS NOT NULL
          AND a.AncestorID <> a.StartID
          AND a.Depth < 99
    )
    SELECT @CycleFound = 1
    FROM Ancestors
    WHERE AncestorID = StartID;

    IF @CycleFound = 1
    BEGIN
        THROW 50010, 'AccountingCompanyProfile.ParentAccountingCompanyID cannot form a cycle: walking up the parents from this profile reaches it again.', 1;
    END;
END;
GO

EXEC sp_updateextendedproperty @name = N'MS_Description',
    @value = N'The company this profile sits under. A Division, Department or Branch keeps no books of its own: it uses the books of its legal entity, the first company up this chain whose EntityType is any other type. Any other type is its own legal entity and the parent records ownership only. Parents may nest; a cycle is refused (trigger trg_ACP_NoChains).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'ParentAccountingCompanyID';
GO


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================


/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

