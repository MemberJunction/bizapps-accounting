-- =============================================================================
-- V202608142100 — ExternalAccountingSystem: metadata-driven ERP dispatch catalog
-- =============================================================================
-- Plan: plans/external-accounting-system-dispatch.md (approved 2026-08-14).
--
-- WHAT THIS DOES
--   1. Creates __mj_BizAppsAccounting.ExternalAccountingSystem — one row per ERP
--      destination, carrying the DriverClass (MJ house pattern: the metadata row
--      maps the domain concept to the adapter class; ClassFactory instantiates by
--      the class's own name). IntegrationName bridges to __mj.Integration by NAME
--      (the Integration row is minted by the connector app's own migration, so an
--      ID coupling across apps would be brittle).
--   2. Seeds BusinessCentral + Mock (hardcoded UUIDs, house rule).
--
-- WHAT THIS DELIBERATELY DOES NOT DO (Marcelo 2026-08-14)
--   JournalEntryBatch.TargetSystem is left UNTOUCHED. Dispatch routing is decided
--   by the JE lines' GL accounts' external system (GLAccount.ExternalSystem
--   matched to ExternalAccountingSystem.Name), not by a batch-level FK; the
--   dispatch op resolves the batch's TargetSystem string against the catalog's
--   Name at run time. A batch↔catalog FK can ride a future migration if the
--   split-summary work makes the link structural. (An earlier draft of THIS
--   migration did the FK swap + trigger restate — undone before merge; see the
--   branch history.)
--
-- Generated SQL (entity registration metadata for the new table) is NOT
-- hand-edited here: CodeGen's capture appends it below.
-- =============================================================================

-- 1 ── the catalog table ──────────────────────────────────────────────────────
IF OBJECT_ID('__mj_BizAppsAccounting.ExternalAccountingSystem', 'U') IS NULL
BEGIN
    CREATE TABLE __mj_BizAppsAccounting.ExternalAccountingSystem (
        ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        Name NVARCHAR(50) NOT NULL,
        DisplayName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        DriverClass NVARCHAR(255) NOT NULL,
        IntegrationName NVARCHAR(100) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CONSTRAINT PK_ExternalAccountingSystem PRIMARY KEY (ID),
        CONSTRAINT UQ_ExternalAccountingSystem_Name UNIQUE (Name)
    );
END;
GO

-- extended properties (guarded — re-runnable)
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('__mj_BizAppsAccounting.ExternalAccountingSystem') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Catalog of external ERP/GL destinations journal entries dispatch to. Maps each system to its adapter DriverClass (resolved via ClassFactory) and, when connector-backed, to the __mj.Integration record by name. Seeded with BusinessCentral and Mock; add a row + a registered adapter class to support a new ERP — no engine changes.',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ExternalAccountingSystem';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id WHERE ep.major_id = OBJECT_ID('__mj_BizAppsAccounting.ExternalAccountingSystem') AND c.name = 'DriverClass' AND ep.name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Class name of the BaseExternalAccountingSystemAdapter subclass that handles this system (ClassFactory key — the class''s own name, e.g. BusinessCentralAccountingSystemAdapter).',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ExternalAccountingSystem', @level2type = N'COLUMN', @level2name = N'DriverClass';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id WHERE ep.major_id = OBJECT_ID('__mj_BizAppsAccounting.ExternalAccountingSystem') AND c.name = 'IntegrationName' AND ep.name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Name of the __mj.Integration record backing this system (e.g. business-central), resolved at runtime — NULL for systems with no connector (Mock). By name, not ID: the Integration row is minted by the connector app''s own migration.',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ExternalAccountingSystem', @level2type = N'COLUMN', @level2name = N'IntegrationName';
GO

-- 2 ── seeds (hardcoded UUIDs) ────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.ExternalAccountingSystem WHERE ID = '8E415536-595B-46A7-9F42-8778626DAAB6')
    INSERT INTO __mj_BizAppsAccounting.ExternalAccountingSystem (ID, Name, DisplayName, Description, DriverClass, IntegrationName, IsActive)
    VALUES ('8E415536-595B-46A7-9F42-8778626DAAB6', 'BusinessCentral', 'Microsoft Dynamics 365 Business Central',
            'Posts journal entries to Business Central general journals via the connector-business-central Open App (staged journalLines, then the Microsoft.NAV.post bound action as the atomic commit).',
            'BusinessCentralAccountingSystemAdapter', 'business-central', 1);
GO
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.ExternalAccountingSystem WHERE ID = '8C94EFAE-BC38-4F44-BB5E-620B33F9BE96')
    INSERT INTO __mj_BizAppsAccounting.ExternalAccountingSystem (ID, Name, DisplayName, Description, DriverClass, IntegrationName, IsActive)
    VALUES ('8C94EFAE-BC38-4F44-BB5E-620B33F9BE96', 'Mock', 'Mock (testing)',
            'Test destination: always succeeds with a MOCK- reference and touches no external system. Selecting it is an explicit choice — real systems fail loudly when unconfigured; nothing ever falls back to Mock.',
            'MockAccountingSystemAdapter', NULL, 1);
GO























































-- CodeGen Output
/* SQL generated to create new entity MJ_BizApps_Accounting: External Accounting Systems */

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
         '9b281018-10a1-455e-bd76-05bf71b5578f',
         'MJ_BizApps_Accounting: External Accounting Systems',
         'External Accounting Systems',
         'Catalog of external ERP/GL destinations journal entries dispatch to. Maps each system to its adapter DriverClass (resolved via ClassFactory) and, when connector-backed, to the ${mjSchema}.Integration record by name. Seeded with BusinessCentral and Mock; add a row + a registered adapter class to support a new ERP — no engine changes.',
         NULL,
         'ExternalAccountingSystem',
         'vwExternalAccountingSystems',
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

/* SQL generated to add new entity MJ_BizApps_Accounting: External Accounting Systems to application ID: 'E609083D-D3E2-44AD-9DF3-CB833BEF381D' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('E609083D-D3E2-44AD-9DF3-CB833BEF381D', '9b281018-10a1-455e-bd76-05bf71b5578f', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: External Accounting Systems for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                                                   ([EntityID], [RoleID], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                                   ('9b281018-10a1-455e-bd76-05bf71b5578f', 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: External Accounting Systems for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                                                   ([EntityID], [RoleID], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                                   ('9b281018-10a1-455e-bd76-05bf71b5578f', 'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: External Accounting Systems for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                                                   ([EntityID], [RoleID], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                                   ('9b281018-10a1-455e-bd76-05bf71b5578f', 'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE());

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ExternalAccountingSystem */
ALTER TABLE [${flyway:defaultSchema}].[ExternalAccountingSystem] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ExternalAccountingSystem */
UPDATE [${flyway:defaultSchema}].[ExternalAccountingSystem] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ExternalAccountingSystem */
ALTER TABLE [${flyway:defaultSchema}].[ExternalAccountingSystem] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ExternalAccountingSystem */
ALTER TABLE [${flyway:defaultSchema}].[ExternalAccountingSystem] ADD CONSTRAINT [DF___mj_BizAppsAccounting_ExternalAccountingSystem___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ExternalAccountingSystem */
ALTER TABLE [${flyway:defaultSchema}].[ExternalAccountingSystem] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ExternalAccountingSystem */
UPDATE [${flyway:defaultSchema}].[ExternalAccountingSystem] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ExternalAccountingSystem */
ALTER TABLE [${flyway:defaultSchema}].[ExternalAccountingSystem] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ExternalAccountingSystem */
ALTER TABLE [${flyway:defaultSchema}].[ExternalAccountingSystem] ADD CONSTRAINT [DF___mj_BizAppsAccounting_ExternalAccountingSystem___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to insert 9 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'bbac5b3e-fe3c-4db2-92eb-5c9b7dfea9b1' OR (EntityID = '9B281018-10A1-455E-BD76-05BF71B5578F' AND Name = 'ID')) BEGIN
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
            'bbac5b3e-fe3c-4db2-92eb-5c9b7dfea9b1',
            '9B281018-10A1-455E-BD76-05BF71B5578F', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100001,
            'ID',
            'ID',
            NULL,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a2c6a5ea-c8ab-4df1-941d-085d0c2547df' OR (EntityID = '9B281018-10A1-455E-BD76-05BF71B5578F' AND Name = 'Name')) BEGIN
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
            'a2c6a5ea-c8ab-4df1-941d-085d0c2547df',
            '9B281018-10A1-455E-BD76-05BF71B5578F', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100002,
            'Name',
            'Name',
            NULL,
            'nvarchar',
            100,
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
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f9006fb8-c4c2-4cda-8689-c4f1ea9f2ea2' OR (EntityID = '9B281018-10A1-455E-BD76-05BF71B5578F' AND Name = 'DisplayName')) BEGIN
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
            'f9006fb8-c4c2-4cda-8689-c4f1ea9f2ea2',
            '9B281018-10A1-455E-BD76-05BF71B5578F', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100003,
            'DisplayName',
            'Display Name',
            NULL,
            'nvarchar',
            200,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'dabaa808-c057-46f2-9124-d9e8128ef727' OR (EntityID = '9B281018-10A1-455E-BD76-05BF71B5578F' AND Name = 'Description')) BEGIN
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
            'dabaa808-c057-46f2-9124-d9e8128ef727',
            '9B281018-10A1-455E-BD76-05BF71B5578F', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100004,
            'Description',
            'Description',
            NULL,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6f844e05-cd3a-4ee9-b68d-15ab95bcbbb4' OR (EntityID = '9B281018-10A1-455E-BD76-05BF71B5578F' AND Name = 'DriverClass')) BEGIN
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
            '6f844e05-cd3a-4ee9-b68d-15ab95bcbbb4',
            '9B281018-10A1-455E-BD76-05BF71B5578F', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100005,
            'DriverClass',
            'Driver Class',
            'Class name of the BaseExternalAccountingSystemAdapter subclass that handles this system (ClassFactory key — the class''s own name, e.g. BusinessCentralAccountingSystemAdapter).',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '23a3db7e-6c65-49fa-b4d6-6fc2cb6eca1a' OR (EntityID = '9B281018-10A1-455E-BD76-05BF71B5578F' AND Name = 'IntegrationName')) BEGIN
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
            '23a3db7e-6c65-49fa-b4d6-6fc2cb6eca1a',
            '9B281018-10A1-455E-BD76-05BF71B5578F', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100006,
            'IntegrationName',
            'Integration Name',
            'Name of the ${mjSchema}.Integration record backing this system (e.g. business-central), resolved at runtime — NULL for systems with no connector (Mock). By name, not ID: the Integration row is minted by the connector app''s own migration.',
            'nvarchar',
            200,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8a1dddf8-fe6f-4c31-bc79-c5fb487a5eac' OR (EntityID = '9B281018-10A1-455E-BD76-05BF71B5578F' AND Name = 'IsActive')) BEGIN
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
            '8a1dddf8-fe6f-4c31-bc79-c5fb487a5eac',
            '9B281018-10A1-455E-BD76-05BF71B5578F', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100007,
            'IsActive',
            'Is Active',
            NULL,
            'bit',
            1,
            1,
            0,
            0,
            '(1)',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '091200ec-c35e-43af-8086-da9510a65a9c' OR (EntityID = '9B281018-10A1-455E-BD76-05BF71B5578F' AND Name = '__mj_CreatedAt')) BEGIN
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
            '091200ec-c35e-43af-8086-da9510a65a9c',
            '9B281018-10A1-455E-BD76-05BF71B5578F', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100008,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '06f21295-96f5-464d-adc4-c1397140e869' OR (EntityID = '9B281018-10A1-455E-BD76-05BF71B5578F' AND Name = '__mj_UpdatedAt')) BEGIN
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
            '06f21295-96f5-464d-adc4-c1397140e869',
            '9B281018-10A1-455E-BD76-05BF71B5578F', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100009,
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
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* Index for Foreign Keys for ExternalAccountingSystem */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: External Accounting Systems
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

/* Base View SQL for MJ_BizApps_Accounting: External Accounting Systems */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: External Accounting Systems
-- Item: vwExternalAccountingSystems
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: External Accounting Systems
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  ExternalAccountingSystem
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwExternalAccountingSystems]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwExternalAccountingSystems];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwExternalAccountingSystems]
AS
SELECT
    e.*
FROM
    [${flyway:defaultSchema}].[ExternalAccountingSystem] AS e
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwExternalAccountingSystems] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: External Accounting Systems */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: External Accounting Systems
-- Item: Permissions for vwExternalAccountingSystems
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwExternalAccountingSystems] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: External Accounting Systems */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: External Accounting Systems
-- Item: spCreateExternalAccountingSystem
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR ExternalAccountingSystem
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateExternalAccountingSystem]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateExternalAccountingSystem];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateExternalAccountingSystem]
    @ID uniqueidentifier = NULL,
    @Name nvarchar(50),
    @DisplayName nvarchar(100),
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @DriverClass nvarchar(255),
    @IntegrationName_Clear bit = 0,
    @IntegrationName nvarchar(100) = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[ExternalAccountingSystem]
            (
                [ID],
                [Name],
                [DisplayName],
                [Description],
                [DriverClass],
                [IntegrationName],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @Name,
                @DisplayName,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @DriverClass,
                CASE WHEN @IntegrationName_Clear = 1 THEN NULL ELSE ISNULL(@IntegrationName, NULL) END,
                ISNULL(@IsActive, 1)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[ExternalAccountingSystem]
            (
                [Name],
                [DisplayName],
                [Description],
                [DriverClass],
                [IntegrationName],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @Name,
                @DisplayName,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @DriverClass,
                CASE WHEN @IntegrationName_Clear = 1 THEN NULL ELSE ISNULL(@IntegrationName, NULL) END,
                ISNULL(@IsActive, 1)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwExternalAccountingSystems] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: External Accounting Systems */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: External Accounting Systems */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: External Accounting Systems
-- Item: spUpdateExternalAccountingSystem
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR ExternalAccountingSystem
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateExternalAccountingSystem]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateExternalAccountingSystem];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateExternalAccountingSystem]
    @ID uniqueidentifier,
    @Name nvarchar(50) = NULL,
    @DisplayName nvarchar(100) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @DriverClass nvarchar(255) = NULL,
    @IntegrationName_Clear bit = 0,
    @IntegrationName nvarchar(100) = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[ExternalAccountingSystem]
    SET
        [Name] = ISNULL(@Name, [Name]),
        [DisplayName] = ISNULL(@DisplayName, [DisplayName]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [DriverClass] = ISNULL(@DriverClass, [DriverClass]),
        [IntegrationName] = CASE WHEN @IntegrationName_Clear = 1 THEN NULL ELSE ISNULL(@IntegrationName, [IntegrationName]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwExternalAccountingSystems] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwExternalAccountingSystems]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the ExternalAccountingSystem table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateExternalAccountingSystem]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateExternalAccountingSystem];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateExternalAccountingSystem
ON [${flyway:defaultSchema}].[ExternalAccountingSystem]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[ExternalAccountingSystem]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[ExternalAccountingSystem] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: External Accounting Systems */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: External Accounting Systems */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: External Accounting Systems
-- Item: spDeleteExternalAccountingSystem
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR ExternalAccountingSystem
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteExternalAccountingSystem]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteExternalAccountingSystem];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteExternalAccountingSystem]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[ExternalAccountingSystem]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: External Accounting Systems */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = 'F9006FB8-C4C2-4CDA-8689-C4F1EA9F2EA2'
               AND AutoUpdateDefaultInView = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '8A1DDDF8-FE6F-4C31-BC79-C5FB487A5EAC'
               AND AutoUpdateDefaultInView = 1;

            UPDATE [${mjSchema}].[Entity]
            SET AllowUserSearchAPI = 0
            WHERE ID = '9B281018-10A1-455E-BD76-05BF71B5578F'
            AND AutoUpdateAllowUserSearchAPI = 1;

/* Set categories for 9 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.ID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'BBAC5B3E-FE3C-4DB2-92EB-5C9B7DFEA9B1' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.Name 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Configuration',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'A2C6A5EA-C8AB-4DF1-941D-085D0C2547DF' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.DisplayName 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Configuration',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'F9006FB8-C4C2-4CDA-8689-C4F1EA9F2EA2' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.Description 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Configuration',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'DABAA808-C057-46F2-9124-D9E8128EF727' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.DriverClass 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Integration Details',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '6F844E05-CD3A-4EE9-B68D-15AB95BCBBB4' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.IntegrationName 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Integration Details',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '23A3DB7E-6C65-49FA-B4D6-6FC2CB6ECA1A' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.IsActive 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Configuration',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '8A1DDDF8-FE6F-4C31-BC79-C5FB487A5EAC' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.__mj_CreatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '091200EC-C35E-43AF-8086-DA9510A65A9C' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.__mj_UpdatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '06F21295-96F5-464D-ADC4-C1397140E869' AND AutoUpdateCategory = 1;

/* Set entity icon to fa fa-plug */

               UPDATE [${mjSchema}].[Entity]
               SET [Icon] = 'fa fa-plug', [__mj_UpdatedAt] = GETUTCDATE()
               WHERE [ID] = '9B281018-10A1-455E-BD76-05BF71B5578F';

/* Insert FieldCategoryInfo setting for entity */

               INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('9c020e4a-21ca-4c75-8979-526ce1f863a8', '9B281018-10A1-455E-BD76-05BF71B5578F', 'FieldCategoryInfo', '{"System Configuration":{"icon":"fa fa-cogs","description":"General settings and identification for the accounting system"},"Integration Details":{"icon":"fa fa-project-diagram","description":"Technical configuration for adapter classes and integration mapping"},"System Metadata":{"icon":"fa fa-database","description":"System-managed audit and tracking fields"}}', GETUTCDATE(), GETUTCDATE());

/* Insert FieldCategoryIcons setting (legacy) */

               INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('1d7d00df-b2de-4e2e-b139-baebd2a72837', '9B281018-10A1-455E-BD76-05BF71B5578F', 'FieldCategoryIcons', '{"System Configuration":"fa fa-cogs","Integration Details":"fa fa-project-diagram","System Metadata":"fa fa-database"}', GETUTCDATE(), GETUTCDATE());

/* Set DefaultForNewUser=false for NEW entity (category: reference, confidence: high) */

         UPDATE [${mjSchema}].[ApplicationEntity]
         SET [DefaultForNewUser] = 0, [__mj_UpdatedAt] = GETUTCDATE()
         WHERE [EntityID] = '9B281018-10A1-455E-BD76-05BF71B5578F';

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = 'FE87F5F4-32B6-4F61-9960-7DDBF523B051'
               AND AutoUpdateDefaultInView = 1;

-- CodeGen Output — Run #2 (regenerated after `mj sync push` applied metadata config)
/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to delete unneeded entity fields */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '286D3C31-D01A-465C-8C42-DFAB6CFB3C7C'
               AND AutoUpdateDefaultInView = 1;

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET IncludeInUserSearchAPI = 1
               WHERE ID = 'E190AC94-4152-429A-B003-675E4AF6F6BC'
               AND AutoUpdateIncludeInUserSearchAPI = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET UserSearchPredicateAPI = 'Exact'
               WHERE ID = 'E190AC94-4152-429A-B003-675E4AF6F6BC'
               AND AutoUpdateUserSearchPredicate = 1;

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '23A3DB7E-6C65-49FA-B4D6-6FC2CB6ECA1A'
               AND AutoUpdateDefaultInView = 1;

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET IncludeInUserSearchAPI = 1
               WHERE ID = '7833C44B-3083-4409-8335-ED07E7A43083'
               AND AutoUpdateIncludeInUserSearchAPI = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET UserSearchPredicateAPI = 'BeginsWith'
               WHERE ID = 'DA2C3C1C-3906-462E-812A-AA314A54A51C'
               AND AutoUpdateUserSearchPredicate = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET UserSearchPredicateAPI = 'Exact'
               WHERE ID = '7833C44B-3083-4409-8335-ED07E7A43083'
               AND AutoUpdateUserSearchPredicate = 1;

            UPDATE [${mjSchema}].[Entity]
            SET AllowUserSearchAPI = 1
            WHERE ID = 'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0'
            AND AutoUpdateAllowUserSearchAPI = 1;

