-- =============================================================================
-- Migration: V202610021240__v0.20.x__AccountingCompanyProfile_PostingStartDate.sql
-- Description: a per-company posting start date. Journal entries dated before
--              it never enter a posting batch.
-- =============================================================================
--
-- WHY
--
-- A company can hold Pending journal entries that must never be posted to the
-- ERP: entries dated before the company began posting from this ledger, e.g.
-- history brought in at cutover that the ERP already holds. The batch
-- candidate pool is every Pending entry, so a sweep with no lower bound would
-- batch them. The per-call startDate option bounds one run; nothing bounded
-- every run for a company.
--
-- WHAT CHANGES
--
-- AccountingCompanyProfile.PostingStartDate (DATE, nullable). The batch
-- engine's candidate filter excludes an entry whose EffectiveDate is before its
-- own company's PostingStartDate, on every build, preview and scheduled sweep.
-- NULL means no floor. Existing profiles read NULL, so nothing changes until a
-- date is set.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================

ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD PostingStartDate DATE NULL;
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The first EffectiveDate this company posts to the ERP. Journal entries dated before it never enter a posting batch (for example, history brought in at cutover that the ERP already holds). NULL means no floor: every Pending entry is a candidate.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'PostingStartDate';
GO


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================


/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4cd570a0-9be5-4036-863b-fda304697691' OR (EntityID = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND Name = 'PostingStartDate')) BEGIN
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
            '4cd570a0-9be5-4036-863b-fda304697691',
            '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC'),
            'PostingStartDate',
            'Posting Start Date',
            'The first EffectiveDate this company posts to the ERP. Journal entries dated before it never enter a posting batch (for example, history brought in at cutover that the ERP already holds). NULL means no floor: every Pending entry is a candidate.',
            'date',
            3,
            10,
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

/* Index for Foreign Keys for AccountingCompanyProfile */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key FunctionalCurrencyCode in table AccountingCompanyProfile
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_FunctionalCurrencyCode' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[AccountingCompanyProfile]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_FunctionalCurrencyCode ON [${flyway:defaultSchema}].[AccountingCompanyProfile] ([FunctionalCurrencyCode]);

-- Index for foreign key ReportingCurrencyCode in table AccountingCompanyProfile
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ReportingCurrencyCode' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[AccountingCompanyProfile]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ReportingCurrencyCode ON [${flyway:defaultSchema}].[AccountingCompanyProfile] ([ReportingCurrencyCode]);

-- Index for foreign key ParentAccountingCompanyID in table AccountingCompanyProfile
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ParentAccountingCompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[AccountingCompanyProfile]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ParentAccountingCompanyID ON [${flyway:defaultSchema}].[AccountingCompanyProfile] ([ParentAccountingCompanyID]);

-- Index for foreign key ApprovalCFOUserID in table AccountingCompanyProfile
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ApprovalCFOUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[AccountingCompanyProfile]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ApprovalCFOUserID ON [${flyway:defaultSchema}].[AccountingCompanyProfile] ([ApprovalCFOUserID]);

/* Hierarchy Metadata Function SQL for MJ_BizApps_Accounting: Accounting Company Profiles.ParentAccountingCompanyID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- HIERARCHY METADATA FUNCTION FOR: [AccountingCompanyProfile].[ParentAccountingCompanyID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta]
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
            [ParentAccountingCompanyID],
            0 AS [Depth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentAccountingCompanyID],
            c.[Depth] + 1 AS [Depth],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ParentAccountingCompanyID]
        WHERE
            c.[Depth] < 100
    )
    SELECT TOP 1
        a.[ID] AS [RootID],
        (SELECT MAX([Depth]) FROM CTE_Ancestors) AS [Depth],
        (SELECT TOP 1 [Path] FROM CTE_Ancestors ORDER BY [Depth] DESC) AS [Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[AccountingCompanyProfile] WHERE [ParentAccountingCompanyID] = @RecordID) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[AccountingCompanyProfile] WHERE [ParentAccountingCompanyID] = @RecordID) AS [ChildCount]
    FROM
        CTE_Ancestors a
    WHERE
        a.[ParentAccountingCompanyID] IS NULL OR @ParentID IS NULL
    ORDER BY
        a.[Depth] DESC
);
GO

/* Descendants Traversal Function SQL for MJ_BizApps_Accounting: Accounting Company Profiles.ParentAccountingCompanyID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: fnAccountingCompanyProfileParentAccountingCompanyID_GetDescendants
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- DESCENDANTS FUNCTION FOR: [AccountingCompanyProfile].[ParentAccountingCompanyID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetDescendants]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetDescendants];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetDescendants]
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
            [ParentAccountingCompanyID],
            0 AS [RelativeDepth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile]
        WHERE
            [ID] = @RootID

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentAccountingCompanyID],
            p.[RelativeDepth] + 1 AS [RelativeDepth],
            CAST(p.[Path] + CAST(c.[ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile] c
        INNER JOIN
            CTE_Descendants p ON c.[ParentAccountingCompanyID] = p.[ID]
        WHERE
            (@MaxDepth IS NULL OR p.[RelativeDepth] < @MaxDepth)
            AND p.[RelativeDepth] < 100
    )
    SELECT
        d.[ID] AS [ID],
        d.[RelativeDepth] AS [Depth],
        d.[Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[AccountingCompanyProfile] WHERE [ParentAccountingCompanyID] = d.[ID]) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[AccountingCompanyProfile] WHERE [ParentAccountingCompanyID] = d.[ID]) AS [ChildCount]
    FROM
        CTE_Descendants d
);
GO

/* Ancestors Traversal Function SQL for MJ_BizApps_Accounting: Accounting Company Profiles.ParentAccountingCompanyID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: fnAccountingCompanyProfileParentAccountingCompanyID_GetAncestors
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ANCESTORS FUNCTION FOR: [AccountingCompanyProfile].[ParentAccountingCompanyID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetAncestors]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetAncestors];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetAncestors]
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
            [ParentAccountingCompanyID],
            0 AS [LevelUp],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentAccountingCompanyID],
            c.[LevelUp] + 1 AS [LevelUp],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ParentAccountingCompanyID]
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

/* Root ID Function SQL for MJ_BizApps_Accounting: Accounting Company Profiles.ParentAccountingCompanyID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: fnAccountingCompanyProfileParentAccountingCompanyID_GetRootID
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ROOT ID FUNCTION FOR: [AccountingCompanyProfile].[ParentAccountingCompanyID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetRootID]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetRootID];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetRootID]
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
            [ParentAccountingCompanyID],
            [ID] AS [RootParentID],
            0 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile]
        WHERE
            [ID] = COALESCE(@ParentID, @RecordID)

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentAccountingCompanyID],
            c.[ID] AS [RootParentID],
            p.[Depth] + 1 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile] c
        INNER JOIN
            CTE_RootParent p ON c.[ID] = p.[ParentAccountingCompanyID]
        WHERE
            p.[Depth] < 100
    )
    SELECT TOP 1
        [RootParentID] AS RootID
    FROM
        CTE_RootParent
    WHERE
        [ParentAccountingCompanyID] IS NULL
    ORDER BY
        [RootParentID]
);
GO

/* Base View SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: vwAccountingCompanyProfiles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: Accounting Company Profiles
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  AccountingCompanyProfile
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwAccountingCompanyProfiles]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwAccountingCompanyProfiles];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwAccountingCompanyProfiles]
AS
SELECT
    a.*,
    ${mjSchema}_isa_p1.[Name],
    ${mjSchema}_isa_p1.[Description],
    ${mjSchema}_isa_p1.[Website],
    ${mjSchema}_isa_p1.[LogoURL],
    ${mjSchema}_isa_p1.[Domain],
    mjBizAppsAccountingCurrency_FunctionalCurrencyCode.[Name] AS [FunctionalCurrencyCode_Virtual],
    mjBizAppsAccountingCurrency_ReportingCurrencyCode.[Name] AS [ReportingCurrencyCode_Virtual],
    MJUser_ApprovalCFOUserID.[Name] AS [ApprovalCFOUser],
    ${mjSchema}_rgc.[Latitude] AS [${mjSchema}_Latitude],
    ${mjSchema}_rgc.[Longitude] AS [${mjSchema}_Longitude],
    hier_ParentAccountingCompanyID.RootID AS [RootParentAccountingCompanyID],
    hier_ParentAccountingCompanyID.Depth AS [ParentAccountingCompanyIDDepth],
    hier_ParentAccountingCompanyID.Path AS [ParentAccountingCompanyIDPath],
    hier_ParentAccountingCompanyID.IsLeaf AS [ParentAccountingCompanyIDIsLeaf],
    hier_ParentAccountingCompanyID.ChildCount AS [ParentAccountingCompanyIDChildCount]
FROM
    [${flyway:defaultSchema}].[AccountingCompanyProfile] AS a
INNER JOIN
    [${mjSchema}].[Company] AS ${mjSchema}_isa_p1
  ON
    [a].[ID] = ${mjSchema}_isa_p1.[ID]
INNER JOIN
    [${flyway:defaultSchema}].[Currency] AS mjBizAppsAccountingCurrency_FunctionalCurrencyCode
  ON
    [a].[FunctionalCurrencyCode] = mjBizAppsAccountingCurrency_FunctionalCurrencyCode.[Code]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[Currency] AS mjBizAppsAccountingCurrency_ReportingCurrencyCode
  ON
    [a].[ReportingCurrencyCode] = mjBizAppsAccountingCurrency_ReportingCurrencyCode.[Code]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ApprovalCFOUserID
  ON
    [a].[ApprovalCFOUserID] = MJUser_ApprovalCFOUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[vwRecordGeoCodes] AS ${mjSchema}_rgc
  ON
    ${mjSchema}_rgc.[EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC'
    AND ${mjSchema}_rgc.[RecordID] = CAST([a].[ID] AS NVARCHAR(450))
    AND ${mjSchema}_rgc.[LocationType] = 'Primary'
OUTER APPLY
    [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta]([a].[ID], [a].[ParentAccountingCompanyID]) AS hier_ParentAccountingCompanyID
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: Permissions for vwAccountingCompanyProfiles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

REVOKE SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: spCreateAccountingCompanyProfile
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR AccountingCompanyProfile
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateAccountingCompanyProfile]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile]
    @ID uniqueidentifier = NULL,
    @EntityType nvarchar(30) = NULL,
    @LegalStructureType_Clear bit = 0,
    @LegalStructureType nvarchar(30) = NULL,
    @IncorporationDate_Clear bit = 0,
    @IncorporationDate date = NULL,
    @JurisdictionCountry_Clear bit = 0,
    @JurisdictionCountry char(2) = NULL,
    @JurisdictionRegion_Clear bit = 0,
    @JurisdictionRegion nvarchar(50) = NULL,
    @FederalTaxID_Clear bit = 0,
    @FederalTaxID nvarchar(40) = NULL,
    @OperatingTimeZone_Clear bit = 0,
    @OperatingTimeZone nvarchar(60) = NULL,
    @CompanyCode nvarchar(20),
    @FunctionalCurrencyCode char(3),
    @ReportingCurrencyCode_Clear bit = 0,
    @ReportingCurrencyCode char(3) = NULL,
    @FiscalYearStartMonth tinyint = NULL,
    @FiscalYearStartDay tinyint = NULL,
    @ParentAccountingCompanyID_Clear bit = 0,
    @ParentAccountingCompanyID uniqueidentifier = NULL,
    @ApprovalCFOUserID_Clear bit = 0,
    @ApprovalCFOUserID uniqueidentifier = NULL,
    @IsActive bit = NULL,
    @PostingStartDate_Clear bit = 0,
    @PostingStartDate date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ActualID UNIQUEIDENTIFIER = ISNULL(@ID, NEWID())
    INSERT INTO
    [${flyway:defaultSchema}].[AccountingCompanyProfile]
        (
            [EntityType],
                [LegalStructureType],
                [IncorporationDate],
                [JurisdictionCountry],
                [JurisdictionRegion],
                [FederalTaxID],
                [OperatingTimeZone],
                [CompanyCode],
                [FunctionalCurrencyCode],
                [ReportingCurrencyCode],
                [FiscalYearStartMonth],
                [FiscalYearStartDay],
                [ParentAccountingCompanyID],
                [ApprovalCFOUserID],
                [IsActive],
                [PostingStartDate],
                [ID]
        )
    VALUES
        (
            ISNULL(@EntityType, 'Subsidiary'),
                CASE WHEN @LegalStructureType_Clear = 1 THEN NULL ELSE ISNULL(@LegalStructureType, NULL) END,
                CASE WHEN @IncorporationDate_Clear = 1 THEN NULL ELSE ISNULL(@IncorporationDate, NULL) END,
                CASE WHEN @JurisdictionCountry_Clear = 1 THEN NULL ELSE ISNULL(@JurisdictionCountry, NULL) END,
                CASE WHEN @JurisdictionRegion_Clear = 1 THEN NULL ELSE ISNULL(@JurisdictionRegion, NULL) END,
                CASE WHEN @FederalTaxID_Clear = 1 THEN NULL ELSE ISNULL(@FederalTaxID, NULL) END,
                CASE WHEN @OperatingTimeZone_Clear = 1 THEN NULL ELSE ISNULL(@OperatingTimeZone, NULL) END,
                @CompanyCode,
                @FunctionalCurrencyCode,
                CASE WHEN @ReportingCurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@ReportingCurrencyCode, NULL) END,
                ISNULL(@FiscalYearStartMonth, 1),
                ISNULL(@FiscalYearStartDay, 1),
                CASE WHEN @ParentAccountingCompanyID_Clear = 1 THEN NULL ELSE ISNULL(@ParentAccountingCompanyID, NULL) END,
                CASE WHEN @ApprovalCFOUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalCFOUserID, NULL) END,
                ISNULL(@IsActive, 1),
                CASE WHEN @PostingStartDate_Clear = 1 THEN NULL ELSE ISNULL(@PostingStartDate, NULL) END,
                @ActualID
        )
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] WHERE [ID] = @ActualID
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: spUpdateAccountingCompanyProfile
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR AccountingCompanyProfile
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile]
    @ID uniqueidentifier,
    @EntityType nvarchar(30) = NULL,
    @LegalStructureType_Clear bit = 0,
    @LegalStructureType nvarchar(30) = NULL,
    @IncorporationDate_Clear bit = 0,
    @IncorporationDate date = NULL,
    @JurisdictionCountry_Clear bit = 0,
    @JurisdictionCountry char(2) = NULL,
    @JurisdictionRegion_Clear bit = 0,
    @JurisdictionRegion nvarchar(50) = NULL,
    @FederalTaxID_Clear bit = 0,
    @FederalTaxID nvarchar(40) = NULL,
    @OperatingTimeZone_Clear bit = 0,
    @OperatingTimeZone nvarchar(60) = NULL,
    @CompanyCode nvarchar(20) = NULL,
    @FunctionalCurrencyCode char(3) = NULL,
    @ReportingCurrencyCode_Clear bit = 0,
    @ReportingCurrencyCode char(3) = NULL,
    @FiscalYearStartMonth tinyint = NULL,
    @FiscalYearStartDay tinyint = NULL,
    @ParentAccountingCompanyID_Clear bit = 0,
    @ParentAccountingCompanyID uniqueidentifier = NULL,
    @ApprovalCFOUserID_Clear bit = 0,
    @ApprovalCFOUserID uniqueidentifier = NULL,
    @IsActive bit = NULL,
    @PostingStartDate_Clear bit = 0,
    @PostingStartDate date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[AccountingCompanyProfile]
    SET
        [EntityType] = ISNULL(@EntityType, [EntityType]),
        [LegalStructureType] = CASE WHEN @LegalStructureType_Clear = 1 THEN NULL ELSE ISNULL(@LegalStructureType, [LegalStructureType]) END,
        [IncorporationDate] = CASE WHEN @IncorporationDate_Clear = 1 THEN NULL ELSE ISNULL(@IncorporationDate, [IncorporationDate]) END,
        [JurisdictionCountry] = CASE WHEN @JurisdictionCountry_Clear = 1 THEN NULL ELSE ISNULL(@JurisdictionCountry, [JurisdictionCountry]) END,
        [JurisdictionRegion] = CASE WHEN @JurisdictionRegion_Clear = 1 THEN NULL ELSE ISNULL(@JurisdictionRegion, [JurisdictionRegion]) END,
        [FederalTaxID] = CASE WHEN @FederalTaxID_Clear = 1 THEN NULL ELSE ISNULL(@FederalTaxID, [FederalTaxID]) END,
        [OperatingTimeZone] = CASE WHEN @OperatingTimeZone_Clear = 1 THEN NULL ELSE ISNULL(@OperatingTimeZone, [OperatingTimeZone]) END,
        [CompanyCode] = ISNULL(@CompanyCode, [CompanyCode]),
        [FunctionalCurrencyCode] = ISNULL(@FunctionalCurrencyCode, [FunctionalCurrencyCode]),
        [ReportingCurrencyCode] = CASE WHEN @ReportingCurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@ReportingCurrencyCode, [ReportingCurrencyCode]) END,
        [FiscalYearStartMonth] = ISNULL(@FiscalYearStartMonth, [FiscalYearStartMonth]),
        [FiscalYearStartDay] = ISNULL(@FiscalYearStartDay, [FiscalYearStartDay]),
        [ParentAccountingCompanyID] = CASE WHEN @ParentAccountingCompanyID_Clear = 1 THEN NULL ELSE ISNULL(@ParentAccountingCompanyID, [ParentAccountingCompanyID]) END,
        [ApprovalCFOUserID] = CASE WHEN @ApprovalCFOUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalCFOUserID, [ApprovalCFOUserID]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [PostingStartDate] = CASE WHEN @PostingStartDate_Clear = 1 THEN NULL ELSE ISNULL(@PostingStartDate, [PostingStartDate]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwAccountingCompanyProfiles]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the AccountingCompanyProfile table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateAccountingCompanyProfile]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateAccountingCompanyProfile];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateAccountingCompanyProfile
ON [${flyway:defaultSchema}].[AccountingCompanyProfile]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[AccountingCompanyProfile]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[AccountingCompanyProfile] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: spDeleteAccountingCompanyProfile
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR AccountingCompanyProfile
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[AccountingCompanyProfile]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (1 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='', @EntityIDs='3E551198-AB66-478E-BEB6-C34EDBE242EC', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to update existing entity fields from schema (1 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='3E551198-AB66-478E-BEB6-C34EDBE242EC', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

