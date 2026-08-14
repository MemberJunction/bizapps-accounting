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
--   3. Converts JournalEntryBatch.TargetSystem (NVARCHAR + CK enum) into an
--      ExternalAccountingSystemID FK: add column → backfill by name → THROW if any
--      row is unmapped (never guess) → NOT NULL + FK → drop the CK + old column.
--   4. Restates trg_JournalEntryBatch_Immutability via CREATE OR ALTER with the
--      FK column in the frozen-compare set (the baseline is append-only history;
--      a baseline edit would be invisible to every existing database).
--
-- ORDERING MATTERS
--   The backfill UPDATE passes the OLD trigger because the new column is not in
--   its frozen-compare list. The trigger swap happens BEFORE the old column drops
--   (the old trigger references TargetSystem and would break otherwise).
--
-- IDEMPOTENCY
--   Safe on a database at any prior state of this file. Steps that reference the
--   TargetSystem column run as dynamic SQL guarded by COL_LENGTH — T-SQL compiles
--   static column references even inside dead IF branches, so a re-run after the
--   column drop would otherwise fail at compile time.
--
-- Generated SQL (vwJournalEntryBatches, spCreate/spUpdate, EntityField metadata)
-- is NOT hand-edited here: CodeGen regenerates it against the new schema and the
-- capture step appends it below.
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
        @value = N'Catalog of external ERP/GL destinations a JournalEntryBatch can dispatch to. Maps each system to its adapter DriverClass (resolved via ClassFactory) and, when connector-backed, to the __mj.Integration record by name. Seeded with BusinessCentral and Mock; add a row + a registered adapter class to support a new ERP — no engine changes.',
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
            'Posts journal entry batches to Business Central general journals via the connector-business-central Open App (staged journalLines, then the Microsoft.NAV.post bound action as the atomic commit).',
            'BusinessCentralAccountingSystemAdapter', 'business-central', 1);
GO
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.ExternalAccountingSystem WHERE ID = '8C94EFAE-BC38-4F44-BB5E-620B33F9BE96')
    INSERT INTO __mj_BizAppsAccounting.ExternalAccountingSystem (ID, Name, DisplayName, Description, DriverClass, IntegrationName, IsActive)
    VALUES ('8C94EFAE-BC38-4F44-BB5E-620B33F9BE96', 'Mock', 'Mock (testing)',
            'Test destination: always succeeds with a MOCK- reference and touches no external system. Selecting it is an explicit choice — real systems fail loudly when unconfigured; nothing ever falls back to Mock.',
            'MockAccountingSystemAdapter', NULL, 1);
GO

-- 3 ── FK swap on JournalEntryBatch ───────────────────────────────────────────
IF COL_LENGTH('__mj_BizAppsAccounting.JournalEntryBatch', 'ExternalAccountingSystemID') IS NULL
    ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch ADD ExternalAccountingSystemID UNIQUEIDENTIFIER NULL;
GO

-- backfill by name + loud failure on unmapped rows (dynamic: TargetSystem may already be gone)
IF COL_LENGTH('__mj_BizAppsAccounting.JournalEntryBatch', 'TargetSystem') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
        UPDATE b SET ExternalAccountingSystemID = eas.ID
        FROM __mj_BizAppsAccounting.JournalEntryBatch b
        JOIN __mj_BizAppsAccounting.ExternalAccountingSystem eas ON eas.Name = b.TargetSystem
        WHERE b.ExternalAccountingSystemID IS NULL;

        IF EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.JournalEntryBatch WHERE ExternalAccountingSystemID IS NULL)
        BEGIN
            DECLARE @missing NVARCHAR(200) = (SELECT TOP 1 TargetSystem FROM __mj_BizAppsAccounting.JournalEntryBatch WHERE ExternalAccountingSystemID IS NULL);
            THROW 50030, N''ExternalAccountingSystem migration: JournalEntryBatch rows exist whose TargetSystem has no ExternalAccountingSystem row (first: %s). Seed the missing system, then re-run.'', 1;
        END;';
END;
GO

IF COL_LENGTH('__mj_BizAppsAccounting.JournalEntryBatch', 'ExternalAccountingSystemID') IS NOT NULL
   AND COLUMNPROPERTY(OBJECT_ID('__mj_BizAppsAccounting.JournalEntryBatch'), 'ExternalAccountingSystemID', 'AllowsNull') = 1
    ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch ALTER COLUMN ExternalAccountingSystemID UNIQUEIDENTIFIER NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_JournalEntryBatch_ExternalAccountingSystem')
    ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
        ADD CONSTRAINT FK_JournalEntryBatch_ExternalAccountingSystem
        FOREIGN KEY (ExternalAccountingSystemID) REFERENCES __mj_BizAppsAccounting.ExternalAccountingSystem (ID);
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id WHERE ep.major_id = OBJECT_ID('__mj_BizAppsAccounting.JournalEntryBatch') AND c.name = 'ExternalAccountingSystemID' AND ep.name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'The external accounting system (ERP/GL) this batch dispatches to. Replaces the retired TargetSystem enum column (V202608142100); frozen once the batch is Approved (immutability trigger).',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ExternalAccountingSystemID';
GO

-- 4 ── restate the immutability trigger with the FK in the frozen set ─────────
CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JournalEntryBatch_Immutability
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted WHERE Status IN ('Approved','Sent','Posted'))
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50008, 'JournalEntryBatch cannot be deleted once Status is Approved, Sent, or Posted. Cancel it instead.', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Approved','Sent','Posted')
          AND (
            i.JournalEntryBatchNumber          <> d.JournalEntryBatchNumber          OR
            i.CompanyID            <> d.CompanyID            OR
            i.PostingDate          <> d.PostingDate          OR
            ISNULL(i.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') OR
            i.ExternalAccountingSystemID       <> d.ExternalAccountingSystemID       OR
            i.BatchedAt            <> d.BatchedAt            OR
            i.BatchedByUserID      <> d.BatchedByUserID      OR
            i.TotalEntries         <> d.TotalEntries         OR
            i.TotalDebits          <> d.TotalDebits          OR
            i.TotalCredits         <> d.TotalCredits
          )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50009, 'JournalEntryBatch is locked (Status=Approved/Sent/Posted). Only Status / ApprovedAt / ApprovedByUserID / SentAt / PostedAt / ExternalJournalEntryBatchRef / ErrorMessage may evolve (CompanyID, PostingDate, SummaryJournalEntryID, ExternalAccountingSystemID, and the approval-task pointer freeze at approval).', 1;
    END;
END;
GO

-- 5 ── retire the enum column (trigger above no longer references it) ─────────
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_JournalEntryBatch_TargetSystem')
    ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch DROP CONSTRAINT CK_JournalEntryBatch_TargetSystem;
GO
IF COL_LENGTH('__mj_BizAppsAccounting.JournalEntryBatch', 'TargetSystem') IS NOT NULL
    ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch DROP COLUMN TargetSystem;
GO
