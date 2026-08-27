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


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- Captured 2026-08-27 from CodeGen after BA-D34 (GLAccountRole.Cardinality + BankAccount).
-- =============================================================================

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 2 new entity field(s) */
UPDATE [${mjSchema}].[EntityField]
         SET [Sequence] = [Sequence] + 100000
       WHERE [EntityID] = '9B8662E6-89AC-480E-89BD-3A64EBD7F611'
         AND [Sequence] < 100000;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '32d0346a-36e0-4157-a776-e428bb4b98c7' OR (EntityID = '9B8662E6-89AC-480E-89BD-3A64EBD7F611' AND Name = 'Cardinality')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '32d0346a-36e0-4157-a776-e428bb4b98c7',
            '9B8662E6-89AC-480E-89BD-3A64EBD7F611', -- Entity: MJ_BizApps_Accounting: GL Account Roles
            8,
            'Cardinality',
            'Cardinality',
            'How many Active GLAccountLinks this role may resolve to for one record and company. One (default, every pre-existing role including Cash): the BA-D32 tie guard applies and ResolveLinkedAccount returns a single account, latest StartedAt winning among overlapping links. Many: the tie guard does not apply and ResolveLinkedAccount REFUSES the role rather than returning an arbitrary account — callers use ResolveLinkedAccounts and get every Active link whose window covers AsOf. Separating the two is what lets a company hold N bank accounts for a cash position without disturbing where payments post.',
            'nvarchar',
            20,
            0,
            0,
            0,
            'One',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert entity field value with ID 2a8b1640-cc60-436c-8b39-987e25d35af2 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('2a8b1640-cc60-436c-8b39-987e25d35af2', '32D0346A-36E0-4157-A776-E428BB4B98C7', 1, 'Many', 'Many', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 39fd0a27-388e-463a-b729-11e7d482a172 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('39fd0a27-388e-463a-b729-11e7d482a172', '32D0346A-36E0-4157-A776-E428BB4B98C7', 2, 'One', 'One', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 32D0346A-36E0-4157-A776-E428BB4B98C7 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='32D0346A-36E0-4157-A776-E428BB4B98C7';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for GLAccountRole */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Account Roles
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

/* Base View SQL for MJ_BizApps_Accounting: GL Account Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Account Roles
-- Item: vwGLAccountRoles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: GL Account Roles
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  GLAccountRole
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwGLAccountRoles]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwGLAccountRoles];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwGLAccountRoles]
AS
SELECT
    g.*
FROM
    [${flyway:defaultSchema}].[GLAccountRole] AS g
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwGLAccountRoles] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: GL Account Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Account Roles
-- Item: Permissions for vwGLAccountRoles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwGLAccountRoles] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: GL Account Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Account Roles
-- Item: spCreateGLAccountRole
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR GLAccountRole
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateGLAccountRole]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateGLAccountRole];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateGLAccountRole]
    @ID uniqueidentifier = NULL,
    @Name nvarchar(100),
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @Status nvarchar(10) = NULL,
    @Sequence int = NULL,
    @Cardinality nvarchar(10) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[GLAccountRole]
            (
                [ID],
                [Name],
                [Description],
                [Status],
                [Sequence],
                [Cardinality]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                ISNULL(@Status, 'Active'),
                ISNULL(@Sequence, 0),
                ISNULL(@Cardinality, 'One')
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[GLAccountRole]
            (
                [Name],
                [Description],
                [Status],
                [Sequence],
                [Cardinality]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                ISNULL(@Status, 'Active'),
                ISNULL(@Sequence, 0),
                ISNULL(@Cardinality, 'One')
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwGLAccountRoles] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccountRole] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: GL Account Roles */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccountRole] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: GL Account Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Account Roles
-- Item: spUpdateGLAccountRole
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR GLAccountRole
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateGLAccountRole]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccountRole];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccountRole]
    @ID uniqueidentifier,
    @Name nvarchar(100) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @Status nvarchar(10) = NULL,
    @Sequence int = NULL,
    @Cardinality nvarchar(10) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[GLAccountRole]
    SET
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [Status] = ISNULL(@Status, [Status]),
        [Sequence] = ISNULL(@Sequence, [Sequence]),
        [Cardinality] = ISNULL(@Cardinality, [Cardinality])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwGLAccountRoles] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwGLAccountRoles]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccountRole] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the GLAccountRole table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateGLAccountRole]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateGLAccountRole];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateGLAccountRole
ON [${flyway:defaultSchema}].[GLAccountRole]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[GLAccountRole]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[GLAccountRole] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: GL Account Roles */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccountRole] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: GL Account Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Account Roles
-- Item: spDeleteGLAccountRole
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR GLAccountRole
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteGLAccountRole]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteGLAccountRole];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteGLAccountRole]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[GLAccountRole]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccountRole] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: GL Account Roles */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccountRole] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: vwJournalEntries
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: Journal Entries
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  JournalEntry
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntries]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwJournalEntries];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwJournalEntries]
AS
SELECT
    j.*,
    MJCompany_CompanyID.[Name] AS [Company],
    mjBizAppsAccountingJournalEntryType_EntryTypeID.[Name] AS [EntryType],
    MJEntity_LinkedEntityID.[Name] AS [LinkedEntity],
    mjBizAppsAccountingJournalEntry_ReversesJournalEntryID.[EntryNumber] AS [ReversesJournalEntry],
    mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID.[EntryNumber] AS [ReversedByJournalEntry],
    mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID.[JournalEntryBatchNumber] AS [JournalEntryBatch],
    MJFile_FileID.[Name] AS [File]
FROM
    [${flyway:defaultSchema}].[JournalEntry] AS j
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [j].[CompanyID] = MJCompany_CompanyID.[ID]
INNER JOIN
    [${flyway:defaultSchema}].[JournalEntryType] AS mjBizAppsAccountingJournalEntryType_EntryTypeID
  ON
    [j].[EntryTypeID] = mjBizAppsAccountingJournalEntryType_EntryTypeID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[Entity] AS MJEntity_LinkedEntityID
  ON
    [j].[LinkedEntityID] = MJEntity_LinkedEntityID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[JournalEntry] AS mjBizAppsAccountingJournalEntry_ReversesJournalEntryID
  ON
    [j].[ReversesJournalEntryID] = mjBizAppsAccountingJournalEntry_ReversesJournalEntryID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[JournalEntry] AS mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID
  ON
    [j].[ReversedByJournalEntryID] = mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[JournalEntryBatch] AS mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID
  ON
    [j].[JournalEntryBatchID] = mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[File] AS MJFile_FileID
  ON
    [j].[FileID] = MJFile_FileID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: Permissions for vwJournalEntries
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: spCreateJournalEntry
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR JournalEntry
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateJournalEntry]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateJournalEntry];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateJournalEntry]
    @ID uniqueidentifier = NULL,
    @EntryNumber nvarchar(40),
    @CompanyID uniqueidentifier,
    @EffectiveDate date,
    @EntryTypeID uniqueidentifier,
    @Status nvarchar(20) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @LinkedEntityID_Clear bit = 0,
    @LinkedEntityID uniqueidentifier = NULL,
    @LinkedRecordID_Clear bit = 0,
    @LinkedRecordID nvarchar(400) = NULL,
    @ReversesJournalEntryID_Clear bit = 0,
    @ReversesJournalEntryID uniqueidentifier = NULL,
    @ReversedByJournalEntryID_Clear bit = 0,
    @ReversedByJournalEntryID uniqueidentifier = NULL,
    @JournalEntryBatchID_Clear bit = 0,
    @JournalEntryBatchID uniqueidentifier = NULL,
    @GLPostedAt_Clear bit = 0,
    @GLPostedAt datetimeoffset = NULL,
    @GLReferenceID_Clear bit = 0,
    @GLReferenceID nvarchar(100) = NULL,
    @FileID_Clear bit = 0,
    @FileID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[JournalEntry]
            (
                [ID],
                [EntryNumber],
                [CompanyID],
                [EffectiveDate],
                [EntryTypeID],
                [Status],
                [Description],
                [LinkedEntityID],
                [LinkedRecordID],
                [ReversesJournalEntryID],
                [ReversedByJournalEntryID],
                [JournalEntryBatchID],
                [GLPostedAt],
                [GLReferenceID],
                [FileID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @EntryNumber,
                @CompanyID,
                @EffectiveDate,
                @EntryTypeID,
                ISNULL(@Status, 'Pending'),
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @LinkedEntityID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedEntityID, NULL) END,
                CASE WHEN @LinkedRecordID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedRecordID, NULL) END,
                CASE WHEN @ReversesJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversesJournalEntryID, NULL) END,
                CASE WHEN @ReversedByJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversedByJournalEntryID, NULL) END,
                CASE WHEN @JournalEntryBatchID_Clear = 1 THEN NULL ELSE ISNULL(@JournalEntryBatchID, NULL) END,
                CASE WHEN @GLPostedAt_Clear = 1 THEN NULL ELSE ISNULL(@GLPostedAt, NULL) END,
                CASE WHEN @GLReferenceID_Clear = 1 THEN NULL ELSE ISNULL(@GLReferenceID, NULL) END,
                CASE WHEN @FileID_Clear = 1 THEN NULL ELSE ISNULL(@FileID, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[JournalEntry]
            (
                [EntryNumber],
                [CompanyID],
                [EffectiveDate],
                [EntryTypeID],
                [Status],
                [Description],
                [LinkedEntityID],
                [LinkedRecordID],
                [ReversesJournalEntryID],
                [ReversedByJournalEntryID],
                [JournalEntryBatchID],
                [GLPostedAt],
                [GLReferenceID],
                [FileID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @EntryNumber,
                @CompanyID,
                @EffectiveDate,
                @EntryTypeID,
                ISNULL(@Status, 'Pending'),
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @LinkedEntityID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedEntityID, NULL) END,
                CASE WHEN @LinkedRecordID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedRecordID, NULL) END,
                CASE WHEN @ReversesJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversesJournalEntryID, NULL) END,
                CASE WHEN @ReversedByJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversedByJournalEntryID, NULL) END,
                CASE WHEN @JournalEntryBatchID_Clear = 1 THEN NULL ELSE ISNULL(@JournalEntryBatchID, NULL) END,
                CASE WHEN @GLPostedAt_Clear = 1 THEN NULL ELSE ISNULL(@GLPostedAt, NULL) END,
                CASE WHEN @GLReferenceID_Clear = 1 THEN NULL ELSE ISNULL(@GLReferenceID, NULL) END,
                CASE WHEN @FileID_Clear = 1 THEN NULL ELSE ISNULL(@FileID, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwJournalEntries] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Journal Entries */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: spUpdateJournalEntry
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR JournalEntry
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateJournalEntry]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntry];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntry]
    @ID uniqueidentifier,
    @EntryNumber nvarchar(40) = NULL,
    @CompanyID uniqueidentifier = NULL,
    @EffectiveDate date = NULL,
    @EntryTypeID uniqueidentifier = NULL,
    @Status nvarchar(20) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @LinkedEntityID_Clear bit = 0,
    @LinkedEntityID uniqueidentifier = NULL,
    @LinkedRecordID_Clear bit = 0,
    @LinkedRecordID nvarchar(400) = NULL,
    @ReversesJournalEntryID_Clear bit = 0,
    @ReversesJournalEntryID uniqueidentifier = NULL,
    @ReversedByJournalEntryID_Clear bit = 0,
    @ReversedByJournalEntryID uniqueidentifier = NULL,
    @JournalEntryBatchID_Clear bit = 0,
    @JournalEntryBatchID uniqueidentifier = NULL,
    @GLPostedAt_Clear bit = 0,
    @GLPostedAt datetimeoffset = NULL,
    @GLReferenceID_Clear bit = 0,
    @GLReferenceID nvarchar(100) = NULL,
    @FileID_Clear bit = 0,
    @FileID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntry]
    SET
        [EntryNumber] = ISNULL(@EntryNumber, [EntryNumber]),
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [EffectiveDate] = ISNULL(@EffectiveDate, [EffectiveDate]),
        [EntryTypeID] = ISNULL(@EntryTypeID, [EntryTypeID]),
        [Status] = ISNULL(@Status, [Status]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [LinkedEntityID] = CASE WHEN @LinkedEntityID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedEntityID, [LinkedEntityID]) END,
        [LinkedRecordID] = CASE WHEN @LinkedRecordID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedRecordID, [LinkedRecordID]) END,
        [ReversesJournalEntryID] = CASE WHEN @ReversesJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversesJournalEntryID, [ReversesJournalEntryID]) END,
        [ReversedByJournalEntryID] = CASE WHEN @ReversedByJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversedByJournalEntryID, [ReversedByJournalEntryID]) END,
        [JournalEntryBatchID] = CASE WHEN @JournalEntryBatchID_Clear = 1 THEN NULL ELSE ISNULL(@JournalEntryBatchID, [JournalEntryBatchID]) END,
        [GLPostedAt] = CASE WHEN @GLPostedAt_Clear = 1 THEN NULL ELSE ISNULL(@GLPostedAt, [GLPostedAt]) END,
        [GLReferenceID] = CASE WHEN @GLReferenceID_Clear = 1 THEN NULL ELSE ISNULL(@GLReferenceID, [GLReferenceID]) END,
        [FileID] = CASE WHEN @FileID_Clear = 1 THEN NULL ELSE ISNULL(@FileID, [FileID]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwJournalEntries] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwJournalEntries]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntry] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the JournalEntry table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateJournalEntry]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateJournalEntry];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateJournalEntry
ON [${flyway:defaultSchema}].[JournalEntry]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntry]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[JournalEntry] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: Journal Entries */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: spDeleteJournalEntry
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR JournalEntry
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteJournalEntry]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteJournalEntry];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteJournalEntry]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[JournalEntry]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Journal Entries */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (1 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='', @EntityIDs='9B8662E6-89AC-480E-89BD-3A64EBD7F611', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to update existing entity fields from schema (1 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='9B8662E6-89AC-480E-89BD-3A64EBD7F611', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '32D0346A-36E0-4157-A776-E428BB4B98C7'
               AND AutoUpdateDefaultInView = 1;

/* Set categories for 8 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: GL Account Roles.ID 
UPDATE [${mjSchema}].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'B852099A-CE90-40F1-8EDB-CE4D8F546F1F' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: GL Account Roles.Name 
UPDATE [${mjSchema}].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '10DFBF09-841F-4D7D-AF73-3C48582BC521' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: GL Account Roles.Description 
UPDATE [${mjSchema}].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '09E33C67-A998-4482-9A1E-CA2ED4B605EF' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: GL Account Roles.Status 
UPDATE [${mjSchema}].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'C1B34C98-EBDB-47F5-A83D-48160897DA71' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: GL Account Roles.Sequence 
UPDATE [${mjSchema}].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'CAF68C16-B0FA-426B-A318-794E04B1D87F' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: GL Account Roles.Cardinality 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Role Configuration',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '32D0346A-36E0-4157-A776-E428BB4B98C7' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: GL Account Roles.__mj_CreatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'F1EBCCA6-2B2B-4605-BEB5-FFE782E4E98C' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: GL Account Roles.__mj_UpdatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'C1605A04-9BFA-4D18-BBA7-BEBF099C4868' AND AutoUpdateCategory = 1;

/* Generated Validation Functions for MJ_BizApps_Accounting: Accounting Company Profiles */
-- CHECK constraint for MJ_BizApps_Accounting: Accounting Company Profiles: Field: FiscalYearStartMonth was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
INSERT INTO [${mjSchema}].[GeneratedCode] ([CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
                      VALUES ((SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), 'C43229F6-4CC8-4838-9D04-03419A2DA191', GETUTCDATE(), 'TypeScript', 'Approved', '([FiscalYearStartMonth]>=(1) AND [FiscalYearStartMonth]<=(12))', 'public ValidateFiscalYearStartMonthRange(result: ValidationResult) {
	if (this.FiscalYearStartMonth != null && (this.FiscalYearStartMonth < 1 || this.FiscalYearStartMonth > 12)) {
		result.Errors.push(new ValidationErrorInfo(
			"FiscalYearStartMonth",
			"Fiscal year start month must be a valid calendar month between 1 and 12.",
			this.FiscalYearStartMonth,
			ValidationErrorType.Failure
		));
	}
}', 'The fiscal year start month must be a valid calendar month between 1 (January) and 12 (December).', 'ValidateFiscalYearStartMonthRange', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '25D07118-5DE8-45DC-9432-CE751F43E346');

            -- CHECK constraint for MJ_BizApps_Accounting: Accounting Company Profiles @ Table Level was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
INSERT INTO [${mjSchema}].[GeneratedCode] ([CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
                      VALUES ((SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), 'C43229F6-4CC8-4838-9D04-03419A2DA191', GETUTCDATE(), 'TypeScript', 'Approved', '([ParentAccountingCompanyID] IS NULL OR [ParentAccountingCompanyID]<>[ID])', 'public ValidateParentAccountingCompanyIDNotSelfReferencing(result: ValidationResult) {
	if (this.ParentAccountingCompanyID != null && this.ParentAccountingCompanyID === this.ID) {
		result.Errors.push(new ValidationErrorInfo(
			"ParentAccountingCompanyID",
			"A company cannot be its own parent company.",
			this.ParentAccountingCompanyID,
			ValidationErrorType.Failure
		));
	}
}', 'A company cannot be set as its own parent company. This prevents circular parent-child relationships in the accounting company hierarchy.', 'ValidateParentAccountingCompanyIDNotSelfReferencing', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', '3E551198-AB66-478E-BEB6-C34EDBE242EC');

/* Generated Validation Functions for MJ_BizApps_Accounting: Journal Entry Batch Sequences */
-- CHECK constraint for MJ_BizApps_Accounting: Journal Entry Batch Sequences: Field: ID was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
INSERT INTO [${mjSchema}].[GeneratedCode] ([CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
                      VALUES ((SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), 'C43229F6-4CC8-4838-9D04-03419A2DA191', GETUTCDATE(), 'TypeScript', 'Approved', '([ID]=(1))', 'public ValidateIdEqualsOne(result: ValidationResult) {
	if (this.ID !== 1) {
		result.Errors.push(new ValidationErrorInfo(
			"ID",
			"The ID must be exactly 1 to maintain a single-row configuration.",
			this.ID,
			ValidationErrorType.Failure
		));
	}
}', 'The ID of this record must be exactly 1. This ensures that only a single configuration or sequence record exists in the system.', 'ValidateIdEqualsOne', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', 'D4B655BA-1A60-49D0-B6EB-72ED2A45D5A1');

/* Generated Validation Functions for MJ_BizApps_Accounting: Tax Rates */
-- CHECK constraint for MJ_BizApps_Accounting: Tax Rates: Field: Rate was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
INSERT INTO [${mjSchema}].[GeneratedCode] ([CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
                      VALUES ((SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), 'C43229F6-4CC8-4838-9D04-03419A2DA191', GETUTCDATE(), 'TypeScript', 'Approved', '([Rate]>=(0) AND [Rate]<=(1))', 'public ValidateRateRange(result: ValidationResult) {
	if (this.Rate != null && (this.Rate < 0 || this.Rate > 1)) {
		result.Errors.push(new ValidationErrorInfo(
			"Rate",
			"The tax rate must be a value between 0 and 1 (inclusive).",
			this.Rate,
			ValidationErrorType.Failure
		));
	}
}', 'The tax rate must be a decimal value between 0 and 1 (inclusive), representing a percentage from 0% to 100%.', 'ValidateRateRange', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '7671750E-58A5-4C12-99B7-66FDC3009003');


