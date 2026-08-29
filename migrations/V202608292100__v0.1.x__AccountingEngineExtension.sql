-- =============================================================================
-- Migration: V202608292100__v0.1.x__AccountingEngineExtension.sql
-- Description: Accounting engine extension registry + Configuration JSON bag
-- =============================================================================
--
-- Design: plans/erp-provider-layer.md (Rev 2)
-- Wave: MJ verbs → this table + AccountingERPEngine → FP&A ImportBankAccountBalances
--
-- WHY
--
-- AccountingERPEngine invokes other Open Apps around engine verbs (SyncMasterData,
-- PostJournalBatch, later others). ClassFactory finds the implementation
-- (BaseAccountingEngineExtension subclass). This table is the host-visible
-- registry: enable/disable without a rebuild, run order, optional company scope,
-- and a JSON Configuration bag.
--
-- Hook participation is NOT columns and NOT Configuration. It lives on the class:
-- getters (RunAfterSyncMasterData, …) default false; Before/After methods are
-- no-ops the subclass overrides. Adding a hook does not require a migration.
--
-- Accounting does NOT seed any extension. FP&A (and later payroll, expense)
-- inserts its own row. Accounting does not know CashBalance.
--
-- ERP provider plugins are NOT rows here. They remain @RegisterClass on
-- BaseAccountingERPProvider.
--
-- Deterministic new-object V. No IF OBJECT_ID / IF NOT EXISTS / IF COL_LENGTH.
-- No __mj_CreatedAt / __mj_UpdatedAt (CodeGen). No FK indexes (CodeGen).
-- =============================================================================


CREATE TABLE __mj_BizAppsAccounting.AccountingEngineExtension (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(80) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    DriverClass NVARCHAR(255) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Active',
    Sequence INT NOT NULL DEFAULT 0,
    CompanyID UNIQUEIDENTIFIER NULL,
    Configuration NVARCHAR(MAX) NULL,
    CONSTRAINT PK_AccountingEngineExtension PRIMARY KEY (ID),
    CONSTRAINT UQ_AccountingEngineExtension_Code UNIQUE (Code),
    CONSTRAINT CK_AccountingEngineExtension_Status CHECK (Status IN ('Active', 'Disabled')),
    CONSTRAINT CK_AccountingEngineExtension_Configuration CHECK (
        Configuration IS NULL OR ISJSON(Configuration) = 1
    ),
    CONSTRAINT FK_AccountingEngineExtension_Company
        FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID)
);
GO


EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Registry of extensions the Accounting engine invokes around its verbs (sync, post, later others). Other Open Apps insert a row and @RegisterClass a BaseAccountingEngineExtension. Status lets a host disable without a rebuild. Configuration is a JSON bag (IAccountingEngineExtensionConfiguration) for host-tunable parameters. Hook participation is on the class (getters + Before/After overrides), not columns. Empty in this app — consumers seed their own rows. Not the ERP provider plugin list.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'AccountingEngineExtension';

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unique identifier.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'AccountingEngineExtension',
    @level2type = N'COLUMN', @level2name = N'ID';

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Stable engine key, unique. Must match the subclass Code getter. Example: ImportBankAccountBalances.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'AccountingEngineExtension',
    @level2type = N'COLUMN', @level2name = N'Code';

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display name in Explorer and the accounting dashboard.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'AccountingEngineExtension',
    @level2type = N'COLUMN', @level2name = N'Name';

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What this extension does, which app owns it, and what it writes (its own tables, never accounting''s).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'AccountingEngineExtension',
    @level2type = N'COLUMN', @level2name = N'Description';

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'ClassFactory key for the @RegisterClass subclass of BaseAccountingEngineExtension. Must be loaded in the host (MJAPI) or the engine logs and skips.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'AccountingEngineExtension',
    @level2type = N'COLUMN', @level2name = N'DriverClass';

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Active = engine instantiates this extension and honors its class getters. Disabled = skip without a rebuild.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'AccountingEngineExtension',
    @level2type = N'COLUMN', @level2name = N'Status';

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Run order among Active extensions at the same verb. Lower first. Ties break on Code.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'AccountingEngineExtension',
    @level2type = N'COLUMN', @level2name = N'Sequence';

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'NULL = run for every company in the engine call. Set = run only for that Company. One row per Code; subset-of-companies is a later child table if a host needs it.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'AccountingEngineExtension',
    @level2type = N'COLUMN', @level2name = N'CompanyID';

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Host-tunable JSON bag (IAccountingEngineExtensionConfiguration): AsOf, Objects, ContinueOnError, plus extension-specific keys. NOT hook flags — those are class getters. NULL = class/engine defaults. ISJSON-enforced.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'AccountingEngineExtension',
    @level2type = N'COLUMN', @level2name = N'Configuration';
GO


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- Captured 2026-08-29 from CodeGen after AccountingEngineExtension.
-- =============================================================================


/* SQL generated to create new entity MJ_BizApps_Accounting: Accounting Engine Extensions */

      INSERT INTO [${mjSchema}].[Entity] (
         [ID],
         [Name],
         [DisplayName],
         [Description],
         [NameSuffix],
         [BaseTable],
         [BaseView],
         [SchemaName],
         [IncludeInAPI],
         [AllowUserSearchAPI],
         [AllowCaching]
         , [TrackRecordChanges]
         , [AuditRecordAccess]
         , [AuditViewRuns]
         , [AllowAllRowsAPI]
         , [AllowCreateAPI]
         , [AllowUpdateAPI]
         , [AllowDeleteAPI]
         , [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         '17b0dc00-2fbb-475e-8da7-388570dadf0e',
         'MJ_BizApps_Accounting: Accounting Engine Extensions',
         'Accounting Engine Extensions',
         'Registry of extensions the Accounting engine invokes around its verbs (sync, post, later others). Other Open Apps insert a row and @RegisterClass a BaseAccountingEngineExtension. Status lets a host disable without a rebuild. Configuration is a JSON bag (IAccountingEngineExtensionConfiguration) for host-tunable parameters. Hook participation is on the class (getters + Before/After overrides), not columns. Empty in this app — consumers seed their own rows. Not the ERP provider plugin list.',
         NULL,
         'AccountingEngineExtension',
         'vwAccountingEngineExtensions',
         '${flyway:defaultSchema}',
         1,
         1,
         0
         , 1
         , 0
         , 0
         , 0
         , 1
         , 1
         , 1
         , 1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add new entity MJ_BizApps_Accounting: Accounting Engine Extensions to application ID: 'E609083D-D3E2-44AD-9DF3-CB833BEF381D' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('E609083D-D3E2-44AD-9DF3-CB833BEF381D', '17b0dc00-2fbb-475e-8da7-388570dadf0e', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: Accounting Engine Extensions for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                                                   ([EntityID], [RoleID], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                                   ('17b0dc00-2fbb-475e-8da7-388570dadf0e', 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: Accounting Engine Extensions for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                                                   ([EntityID], [RoleID], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                                   ('17b0dc00-2fbb-475e-8da7-388570dadf0e', 'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: Accounting Engine Extensions for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                                                   ([EntityID], [RoleID], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                                   ('17b0dc00-2fbb-475e-8da7-388570dadf0e', 'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE());

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.AccountingEngineExtension */
ALTER TABLE [${flyway:defaultSchema}].[AccountingEngineExtension] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.AccountingEngineExtension */
UPDATE [${flyway:defaultSchema}].[AccountingEngineExtension] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.AccountingEngineExtension */
ALTER TABLE [${flyway:defaultSchema}].[AccountingEngineExtension] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.AccountingEngineExtension */
ALTER TABLE [${flyway:defaultSchema}].[AccountingEngineExtension] ADD CONSTRAINT [DF___mj_BizAppsAccounting_AccountingEngineExtension___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.AccountingEngineExtension */
ALTER TABLE [${flyway:defaultSchema}].[AccountingEngineExtension] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.AccountingEngineExtension */
UPDATE [${flyway:defaultSchema}].[AccountingEngineExtension] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.AccountingEngineExtension */
ALTER TABLE [${flyway:defaultSchema}].[AccountingEngineExtension] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.AccountingEngineExtension */
ALTER TABLE [${flyway:defaultSchema}].[AccountingEngineExtension] ADD CONSTRAINT [DF___mj_BizAppsAccounting_AccountingEngineExtension___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to insert 12 new entity field(s) */
UPDATE [${mjSchema}].[EntityField]
         SET [Sequence] = [Sequence] + 100000
       WHERE [EntityID] = '17B0DC00-2FBB-475E-8DA7-388570DADF0E'
         AND [Sequence] < 100000;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f4372536-200f-49f7-954a-f495feeacb5c' OR (EntityID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND Name = 'ID')) BEGIN
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
            'f4372536-200f-49f7-954a-f495feeacb5c',
            '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
            1,
            'ID',
            'ID',
            'Unique identifier.',
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            'newsequentialid()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            1,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6519585a-a6f5-443b-8ab4-87805a40359f' OR (EntityID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND Name = 'Code')) BEGIN
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
            '6519585a-a6f5-443b-8ab4-87805a40359f',
            '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
            2,
            'Code',
            'Code',
            'Stable engine key, unique. Must match the subclass Code getter. Example: ImportBankAccountBalances.',
            'nvarchar',
            160,
            0,
            0,
            0,
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
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '70fa6917-b008-4459-b343-6e6a6309dab1' OR (EntityID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND Name = 'Name')) BEGIN
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
            '70fa6917-b008-4459-b343-6e6a6309dab1',
            '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
            3,
            'Name',
            'Name',
            'Display name in Explorer and the accounting dashboard.',
            'nvarchar',
            400,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            1,
            1,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5ca64999-88c8-4692-9e95-5242ffc66a84' OR (EntityID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND Name = 'Description')) BEGIN
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
            '5ca64999-88c8-4692-9e95-5242ffc66a84',
            '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
            4,
            'Description',
            'Description',
            'What this extension does, which app owns it, and what it writes (its own tables, never accounting''s).',
            'nvarchar',
            -1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'bd6f55de-2597-494a-8ef9-c8332e65bb9b' OR (EntityID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND Name = 'DriverClass')) BEGIN
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
            'bd6f55de-2597-494a-8ef9-c8332e65bb9b',
            '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
            5,
            'DriverClass',
            'Driver Class',
            'ClassFactory key for the @RegisterClass subclass of BaseAccountingEngineExtension. Must be loaded in the host (MJAPI) or the engine logs and skips.',
            'nvarchar',
            510,
            0,
            0,
            0,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'bb7064ac-415c-40aa-bc20-f10018bb2962' OR (EntityID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND Name = 'Status')) BEGIN
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
            'bb7064ac-415c-40aa-bc20-f10018bb2962',
            '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
            6,
            'Status',
            'Status',
            'Active = engine instantiates this extension and honors its class getters. Disabled = skip without a rebuild.',
            'nvarchar',
            40,
            0,
            0,
            0,
            'Active',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4f7f0861-0469-470c-9261-32043e345293' OR (EntityID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND Name = 'Sequence')) BEGIN
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
            '4f7f0861-0469-470c-9261-32043e345293',
            '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
            7,
            'Sequence',
            'Sequence',
            'Run order among Active extensions at the same verb. Lower first. Ties break on Code.',
            'int',
            4,
            10,
            0,
            0,
            '(0)',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '9945123e-730c-45ad-9f80-c01caacf45cb' OR (EntityID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND Name = 'CompanyID')) BEGIN
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
            '9945123e-730c-45ad-9f80-c01caacf45cb',
            '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
            8,
            'CompanyID',
            'Company ID',
            'NULL = run for every company in the engine call. Set = run only for that Company. One row per Code; subset-of-companies is a later child table if a host needs it.',
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            'D4238F34-2837-EF11-86D4-6045BDEE16E6',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e823d31f-b6ba-4858-8527-e42297b73645' OR (EntityID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND Name = 'Configuration')) BEGIN
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
            'e823d31f-b6ba-4858-8527-e42297b73645',
            '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
            9,
            'Configuration',
            'Configuration',
            'Host-tunable JSON bag (IAccountingEngineExtensionConfiguration): AsOf, Objects, ContinueOnError, plus extension-specific keys. NOT hook flags — those are class getters. NULL = class/engine defaults. ISJSON-enforced.',
            'nvarchar',
            -1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ee75ffcf-332b-4882-b46d-be60a6604ed4' OR (EntityID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND Name = '__mj_CreatedAt')) BEGIN
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
            'ee75ffcf-332b-4882-b46d-be60a6604ed4',
            '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
            10,
            '__mj_CreatedAt',
            'Created At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'eaeff513-4801-4324-8f8c-41dbf3138b4a' OR (EntityID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND Name = '__mj_UpdatedAt')) BEGIN
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
            'eaeff513-4801-4324-8f8c-41dbf3138b4a',
            '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
            11,
            '__mj_UpdatedAt',
            'Updated At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
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

/* SQL text to insert entity field value with ID 2bf0b09f-58e6-4488-a09a-0c89d2164aed */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('2bf0b09f-58e6-4488-a09a-0c89d2164aed', 'BB7064AC-415C-40AA-BC20-F10018BB2962', 1, 'Active', 'Active', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 8ee91a93-0b34-414c-9a3f-7737abd4c38f */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('8ee91a93-0b34-414c-9a3f-7737abd4c38f', 'BB7064AC-415C-40AA-BC20-F10018BB2962', 2, 'Disabled', 'Disabled', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID BB7064AC-415C-40AA-BC20-F10018BB2962 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='BB7064AC-415C-40AA-BC20-F10018BB2962';


/* Create Entity Relationship: MJ: Companies -> MJ_BizApps_Accounting: Accounting Engine Extensions (One To Many via CompanyID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'a0f37470-5f99-48b4-b5d6-1062c9caa2d2'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('a0f37470-5f99-48b4-b5d6-1062c9caa2d2', 'D4238F34-2837-EF11-86D4-6045BDEE16E6', '17B0DC00-2FBB-475E-8DA7-388570DADF0E', 'CompanyID', 'One To Many', 1, 1, 43, GETUTCDATE(), GETUTCDATE())
   END;

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for AccountingEngineExtension */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key CompanyID in table AccountingEngineExtension
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_AccountingEngineExtension_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[AccountingEngineExtension]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_AccountingEngineExtension_CompanyID ON [${flyway:defaultSchema}].[AccountingEngineExtension] ([CompanyID]);

/* SQL text to update entity field related entity name field map for entity field ID 9945123E-730C-45AD-9F80-C01CAACF45CB */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='9945123E-730C-45AD-9F80-C01CAACF45CB', @RelatedEntityNameFieldMap='Company';

/* Base View SQL for MJ_BizApps_Accounting: Accounting Engine Extensions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
-- Item: vwAccountingEngineExtensions
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: Accounting Engine Extensions
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  AccountingEngineExtension
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwAccountingEngineExtensions]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwAccountingEngineExtensions];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwAccountingEngineExtensions]
AS
SELECT
    a.*,
    MJCompany_CompanyID.[Name] AS [Company]
FROM
    [${flyway:defaultSchema}].[AccountingEngineExtension] AS a
LEFT OUTER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [a].[CompanyID] = MJCompany_CompanyID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwAccountingEngineExtensions] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: Accounting Engine Extensions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
-- Item: Permissions for vwAccountingEngineExtensions
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwAccountingEngineExtensions] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: Accounting Engine Extensions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
-- Item: spCreateAccountingEngineExtension
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR AccountingEngineExtension
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateAccountingEngineExtension]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateAccountingEngineExtension];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateAccountingEngineExtension]
    @ID uniqueidentifier = NULL,
    @Code nvarchar(80),
    @Name nvarchar(200),
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @DriverClass nvarchar(255),
    @Status nvarchar(20) = NULL,
    @Sequence int = NULL,
    @CompanyID_Clear bit = 0,
    @CompanyID uniqueidentifier = NULL,
    @Configuration_Clear bit = 0,
    @Configuration nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[AccountingEngineExtension]
            (
                [ID],
                [Code],
                [Name],
                [Description],
                [DriverClass],
                [Status],
                [Sequence],
                [CompanyID],
                [Configuration]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @Code,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @DriverClass,
                ISNULL(@Status, 'Active'),
                ISNULL(@Sequence, 0),
                CASE WHEN @CompanyID_Clear = 1 THEN NULL ELSE ISNULL(@CompanyID, NULL) END,
                CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[AccountingEngineExtension]
            (
                [Code],
                [Name],
                [Description],
                [DriverClass],
                [Status],
                [Sequence],
                [CompanyID],
                [Configuration]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @Code,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @DriverClass,
                ISNULL(@Status, 'Active'),
                ISNULL(@Sequence, 0),
                CASE WHEN @CompanyID_Clear = 1 THEN NULL ELSE ISNULL(@CompanyID, NULL) END,
                CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwAccountingEngineExtensions] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingEngineExtension] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Accounting Engine Extensions */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingEngineExtension] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: Accounting Engine Extensions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
-- Item: spUpdateAccountingEngineExtension
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR AccountingEngineExtension
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateAccountingEngineExtension]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateAccountingEngineExtension];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateAccountingEngineExtension]
    @ID uniqueidentifier,
    @Code nvarchar(80) = NULL,
    @Name nvarchar(200) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @DriverClass nvarchar(255) = NULL,
    @Status nvarchar(20) = NULL,
    @Sequence int = NULL,
    @CompanyID_Clear bit = 0,
    @CompanyID uniqueidentifier = NULL,
    @Configuration_Clear bit = 0,
    @Configuration nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[AccountingEngineExtension]
    SET
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [DriverClass] = ISNULL(@DriverClass, [DriverClass]),
        [Status] = ISNULL(@Status, [Status]),
        [Sequence] = ISNULL(@Sequence, [Sequence]),
        [CompanyID] = CASE WHEN @CompanyID_Clear = 1 THEN NULL ELSE ISNULL(@CompanyID, [CompanyID]) END,
        [Configuration] = CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, [Configuration]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwAccountingEngineExtensions] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwAccountingEngineExtensions]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingEngineExtension] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the AccountingEngineExtension table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateAccountingEngineExtension]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateAccountingEngineExtension];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateAccountingEngineExtension
ON [${flyway:defaultSchema}].[AccountingEngineExtension]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[AccountingEngineExtension]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[AccountingEngineExtension] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: Accounting Engine Extensions */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingEngineExtension] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: Accounting Engine Extensions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
-- Item: spDeleteAccountingEngineExtension
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR AccountingEngineExtension
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteAccountingEngineExtension]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteAccountingEngineExtension];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteAccountingEngineExtension]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[AccountingEngineExtension]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingEngineExtension] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Accounting Engine Extensions */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingEngineExtension] TO [cdp_Developer], [cdp_Integration];

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
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='', @EntityIDs='17B0DC00-2FBB-475E-8DA7-388570DADF0E', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 2 new entity field(s) */
UPDATE [${mjSchema}].[EntityField]
         SET [Sequence] = [Sequence] + 100000
       WHERE [EntityID] = '17B0DC00-2FBB-475E-8DA7-388570DADF0E'
         AND [Sequence] < 100000;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd6a10416-c4b4-444f-8e5d-fd8725daea65' OR (EntityID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND Name = 'Company')) BEGIN
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
            'd6a10416-c4b4-444f-8e5d-fd8725daea65',
            '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
            12,
            'Company',
            'Company',
            NULL,
            'nvarchar',
            100,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
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

/* SQL text to update existing entity fields from schema (1 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='17B0DC00-2FBB-475E-8DA7-388570DADF0E', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '6519585A-A6F5-443B-8AB4-87805A40359F'
               AND AutoUpdateDefaultInView = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = 'BB7064AC-415C-40AA-BC20-F10018BB2962'
               AND AutoUpdateDefaultInView = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '4F7F0861-0469-470C-9261-32043E345293'
               AND AutoUpdateDefaultInView = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = 'D6A10416-C4B4-444F-8E5D-FD8725DAEA65'
               AND AutoUpdateDefaultInView = 1;

            UPDATE [${mjSchema}].[Entity]
            SET AllowUserSearchAPI = 0
            WHERE ID = '17B0DC00-2FBB-475E-8DA7-388570DADF0E'
            AND AutoUpdateAllowUserSearchAPI = 1;

/* Set categories for 12 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.ID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'F4372536-200F-49F7-954A-F495FEEACB5C' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Code 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Extension Definition',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '6519585A-A6F5-443B-8AB4-87805A40359F' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Name 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Extension Definition',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '70FA6917-B008-4459-B343-6E6A6309DAB1' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Description 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Extension Definition',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '5CA64999-88C8-4692-9E95-5242FFC66A84' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.DriverClass 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Extension Definition',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'BD6F55DE-2597-494A-8EF9-C8332E65BB9B' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Status 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Operational Settings',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'BB7064AC-415C-40AA-BC20-F10018BB2962' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Sequence 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Operational Settings',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '4F7F0861-0469-470C-9261-32043E345293' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.CompanyID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Operational Settings',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '9945123E-730C-45AD-9F80-C01CAACF45CB' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Company 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Operational Settings',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'D6A10416-C4B4-444F-8E5D-FD8725DAEA65' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Configuration 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Configuration',
   GeneratedFormSection = 'Category',
   ExtendedType = 'Code',
   CodeType = 'Other'
WHERE 
   ID = 'E823D31F-B6BA-4858-8527-E42297B73645' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.__mj_CreatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'EE75FFCF-332B-4882-B46D-BE60A6604ED4' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.__mj_UpdatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'EAEFF513-4801-4324-8F8C-41DBF3138B4A' AND AutoUpdateCategory = 1;

/* Set entity icon to fa fa-plug */

               UPDATE [${mjSchema}].[Entity]
               SET [Icon] = 'fa fa-plug', [__mj_UpdatedAt] = GETUTCDATE()
               WHERE [ID] = '17B0DC00-2FBB-475E-8DA7-388570DADF0E';

/* Insert FieldCategoryInfo setting for entity */

               INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('e0b5b704-568f-4632-972a-821632e17f23', '17B0DC00-2FBB-475E-8DA7-388570DADF0E', 'FieldCategoryInfo', '{"Extension Definition":{"icon":"fa fa-info-circle","description":"Core identity and implementation details for the accounting extension"},"Operational Settings":{"icon":"fa fa-sliders-h","description":"Runtime controls including status, execution order, and scope"},"Configuration":{"icon":"fa fa-cog","description":"Host-tunable parameters and JSON configuration settings"},"System Metadata":{"icon":"fa fa-database","description":"System-managed audit and tracking fields"}}', GETUTCDATE(), GETUTCDATE());

/* Insert FieldCategoryIcons setting (legacy) */

               INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('a3549112-d85f-4e7a-abaa-645aa009406c', '17B0DC00-2FBB-475E-8DA7-388570DADF0E', 'FieldCategoryIcons', '{"Extension Definition":"fa fa-info-circle","Operational Settings":"fa fa-sliders-h","Configuration":"fa fa-cog","System Metadata":"fa fa-database"}', GETUTCDATE(), GETUTCDATE());

/* Set DefaultForNewUser=false for NEW entity (category: supporting, confidence: high) */

         UPDATE [${mjSchema}].[ApplicationEntity]
         SET [DefaultForNewUser] = 0, [__mj_UpdatedAt] = GETUTCDATE()
         WHERE [EntityID] = '17B0DC00-2FBB-475E-8DA7-388570DADF0E';

/* Generated Validation Functions for MJ_BizApps_Accounting: Accounting Engine Extensions */
-- CHECK constraint for MJ_BizApps_Accounting: Accounting Engine Extensions: Field: Configuration was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
INSERT INTO [${mjSchema}].[GeneratedCode] ([CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
                      VALUES ((SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), 'C43229F6-4CC8-4838-9D04-03419A2DA191', GETUTCDATE(), 'TypeScript', 'Approved', '([Configuration] IS NULL OR isjson([Configuration])=(1))', 'public ValidateConfigurationIsJson(result: ValidationResult) {
    if (this.Configuration != null && this.Configuration.trim() !== "") {
        try {
            JSON.parse(this.Configuration);
        } catch (e) {
            result.Errors.push(new ValidationErrorInfo(
                "Configuration",
                "The Configuration field must be a valid JSON string.",
                this.Configuration,
                ValidationErrorType.Failure
            ));
        }
    }
}', 'The configuration settings, if provided, must be in a valid JSON format to ensure they can be correctly parsed and processed by the system.', 'ValidateConfigurationIsJson', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', 'E823D31F-B6BA-4858-8527-E42297B73645');


