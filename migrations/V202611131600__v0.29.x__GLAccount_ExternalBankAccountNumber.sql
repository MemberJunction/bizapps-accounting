-- =============================================================================
-- Migration: V202611131600__v0.29.x__GLAccount_ExternalBankAccountNumber.sql
-- Description: a GL account can name the Business Central bank account it sits
--              behind, so batches post its lines to that bank account.
-- DETERMINISTIC, NOT IDEMPOTENT: runs once, after V202611121300.
-- =============================================================================
--
-- WHY
--
-- A batch sends every line to Business Central as a "G/L Account" line. In BC,
-- a cash G/L account such as 11101 usually sits behind a bank account: finance
-- enters cash against the bank account, and BC posts the G/L entry through the
-- bank account's posting group, writing a bank ledger entry on the way. A G/L
-- line skips the bank ledger, so those payments never reach bank
-- reconciliation. Where finance has turned Direct Posting off on the G/L
-- account, BC refuses the line outright and the batch fails ("Direct Posting
-- must be equal to 'Yes' in G/L Account").
--
-- WHAT CHANGES
--
-- GLAccount.ExternalBankAccountNumber (NVARCHAR(20), nullable): the No. of the
-- Business Central bank account this GL account sits behind. When set, a batch
-- sends this account's lines as "Bank Account" lines with that No.; BC then
-- posts the G/L entry to the bank's posting-group account. 20 characters is
-- BC's Code[20] for a bank account No. Only Business Central reads it.
--
-- EXISTING DATA
--
-- No row changes. Every account reads NULL and keeps posting as a G/L line
-- until finance sets a bank account number.
-- =============================================================================

ALTER TABLE __mj_BizAppsAccounting.GLAccount
    ADD ExternalBankAccountNumber NVARCHAR(20) NULL;
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The No. of the Business Central bank account this GL account sits behind. When set, a journal entry batch sends this account''s lines to Business Central as Bank Account lines with this No., so they post through the bank ledger and the bank''s posting group. NULL posts them as G/L Account lines. Business Central only; asset accounts only.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'ExternalBankAccountNumber';
GO

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7079a8d4-1616-4cad-94fd-e60deee37a61' OR (EntityID = '690BE4C8-C8F2-4067-B48B-57C0671B05A5' AND Name = 'ExternalBankAccountNumber')) BEGIN
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
            '7079a8d4-1616-4cad-94fd-e60deee37a61',
            '690BE4C8-C8F2-4067-B48B-57C0671B05A5', -- Entity: MJ_BizApps_Accounting: GL Accounts
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '690BE4C8-C8F2-4067-B48B-57C0671B05A5'),
            'ExternalBankAccountNumber',
            'External Bank Account Number',
            'The No. of the Business Central bank account this GL account sits behind. When set, a journal entry batch sends this account''s lines to Business Central as Bank Account lines with this No., so they post through the bank ledger and the bank''s posting group. NULL posts them as G/L Account lines. Business Central only; asset accounts only.',
            'nvarchar',
            40,
            0,
            0,
            1,
            NULL,
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

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for GLAccount */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key CompanyID in table GLAccount
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_GLAccount_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[GLAccount]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_GLAccount_CompanyID ON [${flyway:defaultSchema}].[GLAccount] ([CompanyID]);

-- Index for foreign key ParentGLAccountID in table GLAccount
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_GLAccount_ParentGLAccountID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[GLAccount]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_GLAccount_ParentGLAccountID ON [${flyway:defaultSchema}].[GLAccount] ([ParentGLAccountID]);

-- Index for foreign key CurrencyCode in table GLAccount
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_GLAccount_CurrencyCode' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[GLAccount]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_GLAccount_CurrencyCode ON [${flyway:defaultSchema}].[GLAccount] ([CurrencyCode]);

/* Hierarchy Metadata Function SQL for MJ_BizApps_Accounting: GL Accounts.ParentGLAccountID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: fnGLAccountParentGLAccountID_GetHierarchyMeta
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- HIERARCHY METADATA FUNCTION FOR: [GLAccount].[ParentGLAccountID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetHierarchyMeta]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetHierarchyMeta];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetHierarchyMeta]
(
    @RecordID uniqueidentifier,
    @ParentID uniqueidentifier
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Ancestors AS (
        SELECT
            [ID],
            [ParentGLAccountID],
            0 AS [Depth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[GLAccount]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentGLAccountID],
            c.[Depth] + 1 AS [Depth],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[GLAccount] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ParentGLAccountID]
        WHERE
            c.[Depth] < 100
    )
    SELECT TOP 1
        a.[ID] AS [RootID],
        (SELECT MAX([Depth]) FROM CTE_Ancestors) AS [Depth],
        (SELECT TOP 1 [Path] FROM CTE_Ancestors ORDER BY [Depth] DESC) AS [Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[GLAccount] WHERE [ParentGLAccountID] = @RecordID) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[GLAccount] WHERE [ParentGLAccountID] = @RecordID) AS [ChildCount]
    FROM
        CTE_Ancestors a
    WHERE
        a.[ParentGLAccountID] IS NULL OR @ParentID IS NULL
    ORDER BY
        a.[Depth] DESC
);
GO

/* Descendants Traversal Function SQL for MJ_BizApps_Accounting: GL Accounts.ParentGLAccountID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: fnGLAccountParentGLAccountID_GetDescendants
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- DESCENDANTS FUNCTION FOR: [GLAccount].[ParentGLAccountID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetDescendants]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetDescendants];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetDescendants]
(
    @RootID uniqueidentifier,
    @MaxDepth INT = NULL
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Descendants AS (
        SELECT
            [ID],
            [ParentGLAccountID],
            0 AS [RelativeDepth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[GLAccount]
        WHERE
            [ID] = @RootID

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentGLAccountID],
            p.[RelativeDepth] + 1 AS [RelativeDepth],
            CAST(p.[Path] + CAST(c.[ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[GLAccount] c
        INNER JOIN
            CTE_Descendants p ON c.[ParentGLAccountID] = p.[ID]
        WHERE
            (@MaxDepth IS NULL OR p.[RelativeDepth] < @MaxDepth)
            AND p.[RelativeDepth] < 100
    )
    SELECT
        d.[ID] AS [ID],
        d.[RelativeDepth] AS [Depth],
        d.[Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[GLAccount] WHERE [ParentGLAccountID] = d.[ID]) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[GLAccount] WHERE [ParentGLAccountID] = d.[ID]) AS [ChildCount]
    FROM
        CTE_Descendants d
);
GO

/* Ancestors Traversal Function SQL for MJ_BizApps_Accounting: GL Accounts.ParentGLAccountID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: fnGLAccountParentGLAccountID_GetAncestors
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ANCESTORS FUNCTION FOR: [GLAccount].[ParentGLAccountID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetAncestors]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetAncestors];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetAncestors]
(
    @RecordID uniqueidentifier
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Ancestors AS (
        SELECT
            [ID],
            [ParentGLAccountID],
            0 AS [LevelUp],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[GLAccount]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentGLAccountID],
            c.[LevelUp] + 1 AS [LevelUp],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[GLAccount] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ParentGLAccountID]
        WHERE
            c.[LevelUp] < 100
    )
    SELECT
        a.[ID] AS [ID],
        a.[LevelUp],
        a.[Path]
    FROM
        CTE_Ancestors a
);
GO

/* Root ID Function SQL for MJ_BizApps_Accounting: GL Accounts.ParentGLAccountID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: fnGLAccountParentGLAccountID_GetRootID
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ROOT ID FUNCTION FOR: [GLAccount].[ParentGLAccountID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetRootID]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetRootID];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetRootID]
(
    @RecordID uniqueidentifier,
    @ParentID uniqueidentifier
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_RootParent AS (
        SELECT
            [ID],
            [ParentGLAccountID],
            [ID] AS [RootParentID],
            0 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[GLAccount]
        WHERE
            [ID] = COALESCE(@ParentID, @RecordID)

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentGLAccountID],
            c.[ID] AS [RootParentID],
            p.[Depth] + 1 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[GLAccount] c
        INNER JOIN
            CTE_RootParent p ON c.[ID] = p.[ParentGLAccountID]
        WHERE
            p.[Depth] < 100
    )
    SELECT TOP 1
        [RootParentID] AS RootID
    FROM
        CTE_RootParent
    WHERE
        [ParentGLAccountID] IS NULL
    ORDER BY
        [RootParentID]
);
GO

/* Base View SQL for MJ_BizApps_Accounting: GL Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: vwGLAccounts
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: GL Accounts
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  GLAccount
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwGLAccounts]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwGLAccounts];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwGLAccounts]
AS
SELECT
    g.*,
    MJCompany_CompanyID.[Name] AS [Company],
    mjBizAppsAccountingGLAccount_ParentGLAccountID.[Name] AS [ParentGLAccount],
    mjBizAppsAccountingCurrency_CurrencyCode.[Name] AS [CurrencyCode_Virtual],
    hier_ParentGLAccountID.RootID AS [RootParentGLAccountID],
    hier_ParentGLAccountID.Depth AS [ParentGLAccountIDDepth],
    hier_ParentGLAccountID.Path AS [ParentGLAccountIDPath],
    hier_ParentGLAccountID.IsLeaf AS [ParentGLAccountIDIsLeaf],
    hier_ParentGLAccountID.ChildCount AS [ParentGLAccountIDChildCount]
FROM
    [${flyway:defaultSchema}].[GLAccount] AS g
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [g].[CompanyID] = MJCompany_CompanyID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[GLAccount] AS mjBizAppsAccountingGLAccount_ParentGLAccountID
  ON
    [g].[ParentGLAccountID] = mjBizAppsAccountingGLAccount_ParentGLAccountID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[Currency] AS mjBizAppsAccountingCurrency_CurrencyCode
  ON
    [g].[CurrencyCode] = mjBizAppsAccountingCurrency_CurrencyCode.[Code]
OUTER APPLY
    [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetHierarchyMeta]([g].[ID], [g].[ParentGLAccountID]) AS hier_ParentGLAccountID
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: GL Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: Permissions for vwGLAccounts
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

REVOKE SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: GL Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: spCreateGLAccount
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR GLAccount
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateGLAccount]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateGLAccount];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateGLAccount]
    @ID uniqueidentifier = NULL,
    @CompanyID uniqueidentifier,
    @Code nvarchar(40),
    @Name nvarchar(200),
    @AccountType nvarchar(15),
    @ParentGLAccountID_Clear bit = 0,
    @ParentGLAccountID uniqueidentifier = NULL,
    @CurrencyCode_Clear bit = 0,
    @CurrencyCode char(3) = NULL,
    @ExternalSystem_Clear bit = 0,
    @ExternalSystem nvarchar(50) = NULL,
    @ExternalAccountID_Clear bit = 0,
    @ExternalAccountID nvarchar(100) = NULL,
    @IsActive bit = NULL,
    @IsSystemSeeded bit = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @IsControlAccount bit = NULL,
    @ExternalBankAccountNumber_Clear bit = 0,
    @ExternalBankAccountNumber nvarchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[GLAccount]
            (
                [ID],
                [CompanyID],
                [Code],
                [Name],
                [AccountType],
                [ParentGLAccountID],
                [CurrencyCode],
                [ExternalSystem],
                [ExternalAccountID],
                [IsActive],
                [IsSystemSeeded],
                [Description],
                [IsControlAccount],
                [ExternalBankAccountNumber]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @CompanyID,
                @Code,
                @Name,
                @AccountType,
                CASE WHEN @ParentGLAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ParentGLAccountID, NULL) END,
                CASE WHEN @CurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyCode, NULL) END,
                CASE WHEN @ExternalSystem_Clear = 1 THEN NULL ELSE ISNULL(@ExternalSystem, NULL) END,
                CASE WHEN @ExternalAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ExternalAccountID, NULL) END,
                ISNULL(@IsActive, 1),
                ISNULL(@IsSystemSeeded, 0),
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                ISNULL(@IsControlAccount, 0),
                CASE WHEN @ExternalBankAccountNumber_Clear = 1 THEN NULL ELSE ISNULL(@ExternalBankAccountNumber, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[GLAccount]
            (
                [CompanyID],
                [Code],
                [Name],
                [AccountType],
                [ParentGLAccountID],
                [CurrencyCode],
                [ExternalSystem],
                [ExternalAccountID],
                [IsActive],
                [IsSystemSeeded],
                [Description],
                [IsControlAccount],
                [ExternalBankAccountNumber]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @CompanyID,
                @Code,
                @Name,
                @AccountType,
                CASE WHEN @ParentGLAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ParentGLAccountID, NULL) END,
                CASE WHEN @CurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyCode, NULL) END,
                CASE WHEN @ExternalSystem_Clear = 1 THEN NULL ELSE ISNULL(@ExternalSystem, NULL) END,
                CASE WHEN @ExternalAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ExternalAccountID, NULL) END,
                ISNULL(@IsActive, 1),
                ISNULL(@IsSystemSeeded, 0),
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                ISNULL(@IsControlAccount, 0),
                CASE WHEN @ExternalBankAccountNumber_Clear = 1 THEN NULL ELSE ISNULL(@ExternalBankAccountNumber, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwGLAccounts] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: GL Accounts */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: GL Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: spUpdateGLAccount
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR GLAccount
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateGLAccount]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccount];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccount]
    @ID uniqueidentifier,
    @CompanyID uniqueidentifier = NULL,
    @Code nvarchar(40) = NULL,
    @Name nvarchar(200) = NULL,
    @AccountType nvarchar(15) = NULL,
    @ParentGLAccountID_Clear bit = 0,
    @ParentGLAccountID uniqueidentifier = NULL,
    @CurrencyCode_Clear bit = 0,
    @CurrencyCode char(3) = NULL,
    @ExternalSystem_Clear bit = 0,
    @ExternalSystem nvarchar(50) = NULL,
    @ExternalAccountID_Clear bit = 0,
    @ExternalAccountID nvarchar(100) = NULL,
    @IsActive bit = NULL,
    @IsSystemSeeded bit = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @IsControlAccount bit = NULL,
    @ExternalBankAccountNumber_Clear bit = 0,
    @ExternalBankAccountNumber nvarchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[GLAccount]
    SET
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [AccountType] = ISNULL(@AccountType, [AccountType]),
        [ParentGLAccountID] = CASE WHEN @ParentGLAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ParentGLAccountID, [ParentGLAccountID]) END,
        [CurrencyCode] = CASE WHEN @CurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyCode, [CurrencyCode]) END,
        [ExternalSystem] = CASE WHEN @ExternalSystem_Clear = 1 THEN NULL ELSE ISNULL(@ExternalSystem, [ExternalSystem]) END,
        [ExternalAccountID] = CASE WHEN @ExternalAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ExternalAccountID, [ExternalAccountID]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [IsSystemSeeded] = ISNULL(@IsSystemSeeded, [IsSystemSeeded]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [IsControlAccount] = ISNULL(@IsControlAccount, [IsControlAccount]),
        [ExternalBankAccountNumber] = CASE WHEN @ExternalBankAccountNumber_Clear = 1 THEN NULL ELSE ISNULL(@ExternalBankAccountNumber, [ExternalBankAccountNumber]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwGLAccounts] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwGLAccounts]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the GLAccount table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateGLAccount]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateGLAccount];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateGLAccount
ON [${flyway:defaultSchema}].[GLAccount]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[GLAccount]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[GLAccount] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: GL Accounts */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: GL Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: spDeleteGLAccount
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR GLAccount
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteGLAccount]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteGLAccount];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteGLAccount]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[GLAccount]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: GL Accounts */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] TO [cdp_Developer], [cdp_Integration];

/* Set categories for 1 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: GL Accounts.ExternalBankAccountNumber 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Integration Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '7079A8D4-1616-4CAD-94FD-E60DEEE37A61';

