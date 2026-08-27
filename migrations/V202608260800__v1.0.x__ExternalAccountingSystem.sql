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
-- ORDERING: stamped 2026-08-26 rather than 08-14 so every migration this branch adds lands
-- AFTER the ones already on next (latest: V202608252220__CodeGen_Scoped_SQL_Objects). An
-- earlier stamp interleaves our changes into next's applied history, which is invisible to
-- any database that already migrated past that point.


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










































