-- =============================================================================
-- Migration: V202611021900__v0.25.x__Post_GoLive_Schema_and_Metadata_Sync.sql
-- Description: Post-go-live schema hardening, lookup tables, and metadata sync:
--   1. AccountingCompanyProfile.ERPJournalCode (nullable per-company ERP journal
--      batch/template code).
--   2. JournalEntryBatch.ERPPostUnconfirmedAt (set when a Sent batch fails after
--      the ERP call was dispatched or during post-send confirmation; frozen by
--      trg_JournalEntryBatch_Immutability).
--   3. UX_IntercompanyAccountMatch_Active_Pair_Start (filtered unique index on
--      active IntercompanyAccountMatch rows per company pair and StartedAt).
--   4. TaxCategory lookup table replacing CK_TaxRate_Category.
--   5. ExternalAccountingSystem catalog table with single-default constraint
--      replacing CK_JournalEntryBatch_TargetSystem.
--   6. CodeGen output and metadata sync for entity fields, views, procedures,
--      entity actions, and action descriptions.
-- =============================================================================
SET NOCOUNT ON;
GO

-- -----------------------------------------------------------------------------
-- 1. AccountingCompanyProfile.ERPJournalCode
-- -----------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD ERPJournalCode NVARCHAR(50) NULL;
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The ERP general journal batch or template code used when posting journal entry batches for this company (e.g. Business Central journal batch code). NULL uses the ERP provider''s default (such as DEFAULT in Business Central).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'ERPJournalCode';
GO

-- -----------------------------------------------------------------------------
-- 2. JournalEntryBatch.ERPPostUnconfirmedAt and immutability rule
-- -----------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD ERPPostUnconfirmedAt DATETIMEOFFSET NULL;
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'When an ERP send failed after the HTTP post was dispatched or during post-send confirmation, so the batch may already be posted in the ERP. Blocks retry until a subsequent lookup confirms the ERP state, or the batch is cancelled with an ERP check or archived.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ERPPostUnconfirmedAt';
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JournalEntryBatch_Immutability
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- DELETE: an approved batch is never deleted, and neither is the record that one was cancelled.
    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (
        SELECT 1 FROM deleted
        WHERE Status IN ('Approved','Sent','Posted','Failed','Archived')
           OR (Status = 'Cancelled' AND ApprovedAt IS NOT NULL)
    )
    BEGIN
        THROW 50008, 'JournalEntryBatch cannot be deleted once Status is Approved, Sent, Posted, Failed, or Archived, or once it was cancelled after approval. Cancel it instead.', 1;
    END;

    -- STATUS: Cancelled releases entries, so only Pending / Approved / Failed may reach it, a batch
    -- reaches it only with its summary pointer cleared (by the same update, or by regenerate's
    -- teardown before it), and the terminal statuses never change again. Nothing moves back to
    -- Pending (a Pending batch's members can be released by any journal entry save), only a Pending
    -- batch is approved, and a Sent batch is not archived (it may still be posting in the ERP).
    -- Posted and Failed are the outcomes of a send, so only a Sent batch reaches them; -> Sent is
    -- policed by trg_JournalEntryBatch_SendOnce (50030).
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE i.Status <> d.Status
          AND (
            d.Status IN ('Posted','Cancelled','Archived')
            OR i.Status = 'Pending'
            OR (i.Status = 'Approved' AND d.Status <> 'Pending')
            OR (i.Status = 'Archived' AND d.Status NOT IN ('Pending','Approved','Failed'))
            OR (i.Status = 'Cancelled' AND d.Status NOT IN ('Pending','Approved','Failed'))
            OR (i.Status = 'Cancelled' AND i.SummaryJournalEntryID IS NOT NULL)
            OR (i.Status IN ('Posted','Failed') AND d.Status <> 'Sent')
          )
    )
    BEGIN
        THROW 50031, 'JournalEntryBatch status change refused. Posted, Cancelled and Archived are terminal; no batch returns to Pending; only a Pending batch is approved; Posted and Failed are reachable only from Sent; Archived is reachable only from Pending, Approved or Failed; Cancelled is reachable only from Pending, Approved or Failed; and a batch is cancelled only with its summary pointer cleared (JournalEntryBatchEntityServer.Cancel).', 1;
    END;

    -- AUDIT: the cancel audit and the ERP check are written only by the update that cancels the
    -- batch, so no other save can stamp a "not posted in the ERP" record on it; and SentAt, once set,
    -- is never cleared, because it is the evidence CK_JournalEntryBatch_CancelERPCheck keys on. A
    -- retry re-stamps SentAt with a new time, which is allowed.
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE (d.SentAt IS NOT NULL AND i.SentAt IS NULL)
           OR (
               NOT (i.Status = 'Cancelled' AND d.Status <> 'Cancelled')
               AND (
                   ISNULL(i.CancelReason,                  N'')                                    <> ISNULL(d.CancelReason,                  N'')                                    OR
                   (CASE WHEN i.CancelledAt IS NULL AND d.CancelledAt IS NULL THEN 0 WHEN i.CancelledAt IS NULL OR d.CancelledAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.CancelledAt, d.CancelledAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                   ISNULL(i.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') <> ISNULL(d.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') OR
                   (CASE WHEN i.ERPNotPostedConfirmedAt IS NULL AND d.ERPNotPostedConfirmedAt IS NULL THEN 0 WHEN i.ERPNotPostedConfirmedAt IS NULL OR d.ERPNotPostedConfirmedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ERPNotPostedConfirmedAt, d.ERPNotPostedConfirmedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                   ISNULL(i.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000') OR
                   ISNULL(i.ERPNotPostedBasis,             N'')                                    <> ISNULL(d.ERPNotPostedBasis,             N'')
               )
           )
    )
    BEGIN
        THROW 50032, 'JournalEntryBatch audit refused. CancelReason / CancelledAt / CancelledByUserID and ERPNotPostedConfirmedAt / ERPNotPostedConfirmedByUserID / ERPNotPostedBasis are written only by the update that cancels the batch, and SentAt is never cleared once set.', 1;
    END;

    -- CONTENT: frozen from approval on, Failed and Cancelled included. The timestamps this migration
    -- freezes compare at millisecond precision: every entity save writes each column back through a
    -- JavaScript Date, so a value written by SQL with sub-millisecond digits would otherwise read as
    -- changed on the next ordinary save.
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Approved','Sent','Posted','Failed','Archived','Cancelled')
          AND (
            i.JournalEntryBatchNumber          <> d.JournalEntryBatchNumber          OR
            i.CompanyID            <> d.CompanyID            OR
            i.PostingDate          <> d.PostingDate          OR
            -- The summary pointer is frozen, except for the one sanctioned change: an Approved or
            -- Failed batch clearing it in the same update that marks it Cancelled.
            (
                ISNULL(i.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000')
                AND NOT (
                    d.Status IN ('Approved','Failed')
                    AND i.Status = 'Cancelled'
                    AND i.SummaryJournalEntryID IS NULL
                )
            ) OR
            ISNULL(i.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') OR
            (CASE WHEN i.ApprovedAt IS NULL AND d.ApprovedAt IS NULL THEN 0 WHEN i.ApprovedAt IS NULL OR d.ApprovedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ApprovedAt, d.ApprovedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
            ISNULL(i.ApprovedByUserID,      '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ApprovedByUserID,      '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ApprovedContentHash,   N'')                                    <> ISNULL(d.ApprovedContentHash,   N'')                                    OR
            i.TargetSystem         <> d.TargetSystem         OR
            i.BatchedAt            <> d.BatchedAt            OR
            i.BatchedByUserID      <> d.BatchedByUserID      OR
            i.TotalEntries         <> d.TotalEntries         OR
            i.TotalDebits          <> d.TotalDebits          OR
            i.TotalCredits         <> d.TotalCredits         OR
            -- Once Cancelled, the cancel audit and the ERP-check attestation are the record; they freeze too.
            (
                d.Status = 'Cancelled'
                AND (
                    ISNULL(i.CancelReason,                  N'')                                    <> ISNULL(d.CancelReason,                  N'')                                    OR
                    (CASE WHEN i.CancelledAt IS NULL AND d.CancelledAt IS NULL THEN 0 WHEN i.CancelledAt IS NULL OR d.CancelledAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.CancelledAt, d.CancelledAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                    ISNULL(i.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') <> ISNULL(d.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') OR
                    (CASE WHEN i.ERPNotPostedConfirmedAt IS NULL AND d.ERPNotPostedConfirmedAt IS NULL THEN 0 WHEN i.ERPNotPostedConfirmedAt IS NULL OR d.ERPNotPostedConfirmedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ERPNotPostedConfirmedAt, d.ERPNotPostedConfirmedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                    ISNULL(i.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000')
                )
            )
          )
    )
    BEGIN
        THROW 50009, 'JournalEntryBatch is locked (Status=Approved/Sent/Posted/Failed/Archived/Cancelled). Only Status / PostedAt / the Archive audit triple / ExternalJournalEntryBatchRef / ErrorMessage may evolve; the send stamp (SentAt / SentByUserID / SendAttemptCount) changes only on a send (50030); the Cancel audit and ERP check are written only by the update that cancels the batch (50032). CompanyID, PostingDate, SummaryJournalEntryID, the approval-task pointer, ApprovedAt / ApprovedByUserID and ApprovedContentHash freeze at approval; the summary pointer may clear only as an Approved or Failed batch is Cancelled.', 1;
    END;

    -- SEAL MISMATCH: SealMismatchDetectedAt is written only by the update that records a
    -- retried batch Posted from the ERP, and once set it never changes or clears.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN deleted d ON d.ID = i.ID
        WHERE (d.ID IS NULL AND i.SealMismatchDetectedAt IS NOT NULL)
           OR (
               d.SealMismatchDetectedAt IS NOT NULL
               AND (i.SealMismatchDetectedAt IS NULL OR ABS(DATEDIFF_BIG(MICROSECOND, i.SealMismatchDetectedAt, d.SealMismatchDetectedAt)) >= 1000)
           )
           OR (
               d.ID IS NOT NULL
               AND d.SealMismatchDetectedAt IS NULL
               AND i.SealMismatchDetectedAt IS NOT NULL
               AND NOT (d.Status = 'Sent' AND i.Status = 'Posted' AND i.SendAttemptCount > 1)
           )
    )
        THROW 50034, 'JournalEntryBatch SealMismatchDetectedAt refused. It is set only by the update that records a retried batch Posted (Sent -> Posted, SendAttemptCount above 1), and once set it is never changed or cleared.', 1;

    -- ERP POST UNCONFIRMED: ERPPostUnconfirmedAt is written only when a Sent batch fails
    -- (Sent -> Failed), cleared only when a Failed batch is re-sent or cancelled, and never
    -- changed in any other update or carried on insert.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN deleted d ON d.ID = i.ID
        WHERE (d.ID IS NULL AND i.ERPPostUnconfirmedAt IS NOT NULL)
           OR (
               d.ID IS NOT NULL
               AND d.ERPPostUnconfirmedAt IS NULL
               AND i.ERPPostUnconfirmedAt IS NOT NULL
               AND NOT (d.Status = 'Sent' AND i.Status = 'Failed')
           )
           OR (
               d.ID IS NOT NULL
               AND d.ERPPostUnconfirmedAt IS NOT NULL
               AND i.ERPPostUnconfirmedAt IS NULL
               AND NOT (d.Status = 'Failed' AND i.Status IN ('Sent', 'Cancelled'))
           )
           OR (
               d.ID IS NOT NULL
               AND d.ERPPostUnconfirmedAt IS NOT NULL
               AND i.ERPPostUnconfirmedAt IS NOT NULL
               AND ABS(DATEDIFF_BIG(MICROSECOND, i.ERPPostUnconfirmedAt, d.ERPPostUnconfirmedAt)) >= 1000
               AND NOT (d.Status = 'Sent' AND i.Status = 'Failed')
           )
    )
        THROW 50040, 'JournalEntryBatch ERPPostUnconfirmedAt refused. It is set only when a Sent batch fails (Sent -> Failed), cleared only when a Failed batch is re-sent or cancelled, and never modified otherwise.', 1;
END;
GO

-- -----------------------------------------------------------------------------
-- 3. Filtered unique index on active IntercompanyAccountMatch rows
-- -----------------------------------------------------------------------------
CREATE UNIQUE NONCLUSTERED INDEX UX_IntercompanyAccountMatch_Active_Pair_Start
    ON __mj_BizAppsAccounting.IntercompanyAccountMatch (SourceCompanyID, TargetCompanyID, StartedAt)
    WHERE Status = 'Active';
GO

-- -----------------------------------------------------------------------------
-- 4. TaxCategory lookup table and TaxRate.TaxCategory FK
-- -----------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.TaxCategory (
    Code NVARCHAR(50) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_TaxCategory_IsActive DEFAULT 1,
    __mj_CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_TaxCategory___mj_CreatedAt DEFAULT GETUTCDATE(),
    __mj_UpdatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_TaxCategory___mj_UpdatedAt DEFAULT GETUTCDATE(),
    CONSTRAINT PK_TaxCategory PRIMARY KEY (Code),
    CONSTRAINT CK_TaxCategory_Code CHECK (Code <> N''),
    CONSTRAINT CK_TaxCategory_Name CHECK (Name <> N'')
);
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Lookup table of tax rate categories referenced by TaxRate.TaxCategory.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'TaxCategory';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Stable machine code (primary key) for the tax category.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxCategory', @level2type = N'COLUMN', @level2name = N'Code';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Human-readable display name for the tax category.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxCategory', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Guidance on which goods or services qualify for this tax category.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxCategory', @level2type = N'COLUMN', @level2name = N'Description';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether this tax category is active for new tax rate definitions.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxCategory', @level2type = N'COLUMN', @level2name = N'IsActive';
GO

INSERT INTO __mj_BizAppsAccounting.TaxCategory (Code, Name, Description, IsActive)
VALUES
    (N'Standard',     N'Standard',      N'Default taxable rate for general goods and services',                        1),
    (N'Reduced',      N'Reduced',       N'Lower statutory rate for qualifying goods or services',                      1),
    (N'Zero',         N'Zero',          N'Taxable at 0% (input tax credit eligible where applicable)',                 1),
    (N'Exempt',       N'Exempt',        N'Statutory tax exemption (no tax charged)',                                   1),
    (N'Custom',       N'Custom',        N'Custom or special-purpose tax rate category',                                1),
    (N'OutOfScope',   N'Out of Scope',  N'Outside the scope of the tax regime',                                        1),
    (N'Publications', N'Publications',  N'Books, periodicals, and qualifying printed/digital publications',            1),
    (N'Groceries',    N'Groceries',     N'Food and grocery items for home consumption',                                1),
    (N'DigitalGoods', N'Digital Goods', N'Electronically supplied services, SaaS, and digital downloads',              1);
GO

ALTER TABLE __mj_BizAppsAccounting.TaxRate
    DROP CONSTRAINT CK_TaxRate_Category;
GO

ALTER TABLE __mj_BizAppsAccounting.TaxRate
    ADD CONSTRAINT FK_TaxRate_TaxCategory
    FOREIGN KEY (TaxCategory) REFERENCES __mj_BizAppsAccounting.TaxCategory(Code);
GO

EXEC sp_updateextendedproperty @name = N'MS_Description',
    @value = N'Tax category code referencing TaxCategory.Code (e.g. Standard, Reduced, Zero, Exempt, OutOfScope, Publications, Groceries, DigitalGoods).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'TaxRate', @level2type = N'COLUMN', @level2name = N'TaxCategory';
GO

-- -----------------------------------------------------------------------------
-- 5. ExternalAccountingSystem catalog table and JournalEntryBatch.TargetSystem FK
-- -----------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.ExternalAccountingSystem (
    Code NVARCHAR(50) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    IsDefault BIT NOT NULL CONSTRAINT DF_ExternalAccountingSystem_IsDefault DEFAULT 0,
    IsActive BIT NOT NULL CONSTRAINT DF_ExternalAccountingSystem_IsActive DEFAULT 1,
    __mj_CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_ExternalAccountingSystem___mj_CreatedAt DEFAULT GETUTCDATE(),
    __mj_UpdatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_ExternalAccountingSystem___mj_UpdatedAt DEFAULT GETUTCDATE(),
    CONSTRAINT PK_ExternalAccountingSystem PRIMARY KEY (Code),
    CONSTRAINT CK_ExternalAccountingSystem_Code CHECK (Code <> N''),
    CONSTRAINT CK_ExternalAccountingSystem_Name CHECK (Name <> N'')
);
GO

CREATE UNIQUE NONCLUSTERED INDEX UX_ExternalAccountingSystem_SingleDefault
    ON __mj_BizAppsAccounting.ExternalAccountingSystem (IsDefault)
    WHERE IsDefault = 1;
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Catalog of external accounting / ERP systems targeted by GLAccount.ExternalSystem and JournalEntryBatch.TargetSystem.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'ExternalAccountingSystem';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Stable machine code (primary key) for the external accounting system.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ExternalAccountingSystem', @level2type = N'COLUMN', @level2name = N'Code';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Human-readable display name for the external accounting system.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ExternalAccountingSystem', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Details about the external accounting system integration.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ExternalAccountingSystem', @level2type = N'COLUMN', @level2name = N'Description';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether this system is the default target when an account has no explicit ExternalSystem set. At most one row may have IsDefault = 1.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ExternalAccountingSystem', @level2type = N'COLUMN', @level2name = N'IsDefault';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether this external accounting system is active.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ExternalAccountingSystem', @level2type = N'COLUMN', @level2name = N'IsActive';
GO

INSERT INTO __mj_BizAppsAccounting.ExternalAccountingSystem (Code, Name, Description, IsDefault, IsActive)
VALUES
    (N'BusinessCentral', N'Microsoft Dynamics 365 Business Central', N'Microsoft Dynamics 365 Business Central cloud or on-premises ERP', 1, 1),
    (N'QuickBooks',      N'Intuit QuickBooks',                       N'QuickBooks Online or QuickBooks Desktop',                          0, 1),
    (N'NetSuite',        N'Oracle NetSuite',                         N'Oracle NetSuite ERP',                                              0, 1),
    (N'Sage',            N'Sage Intacct / Sage ERP',                 N'Sage Intacct or Sage 100/300/X3 ERP',                              0, 1),
    (N'Xero',            N'Xero',                                    N'Xero cloud accounting platform',                                   0, 1),
    (N'Other',           N'Other / Custom',                          N'Other or custom external accounting system',                       0, 1);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    DROP CONSTRAINT CK_JournalEntryBatch_TargetSystem;
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD CONSTRAINT FK_JournalEntryBatch_TargetSystem
    FOREIGN KEY (TargetSystem) REFERENCES __mj_BizAppsAccounting.ExternalAccountingSystem(Code);
GO


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL generated to create new entity MJ_BizApps_Accounting: Tax Categories */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[Entity] WHERE [ID] = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' OR [Name] = 'MJ_BizApps_Accounting: Tax Categories')
BEGIN
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
         [AllowCaching],
         [TrackRecordChanges],
         [AuditRecordAccess],
         [AuditViewRuns],
         [AllowAllRowsAPI],
         [AllowCreateAPI],
         [AllowUpdateAPI],
         [AllowDeleteAPI],
         [UserViewMaxRows],
         [__mj_CreatedAt],
         [__mj_UpdatedAt]
      )
      VALUES (
         'a41908f2-7d3e-4b91-9e12-6c8f3b219044',
         'MJ_BizApps_Accounting: Tax Categories',
         'Tax Categories',
         'Lookup table of tax rate categories referenced by TaxRate.TaxCategory.',
         NULL,
         'TaxCategory',
         'vwTaxCategories',
         '${flyway:defaultSchema}',
         1,
         1,
         1,
         1,
         0,
         0,
         1,
         1,
         1,
         1,
         1000,
         GETUTCDATE(),
         GETUTCDATE()
      );
END;

/* SQL generated to add new entity MJ_BizApps_Accounting: Tax Categories to application ID: 'E609083D-D3E2-44AD-9DF3-CB833BEF381D' */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D' AND [EntityID] = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044')
BEGIN
   INSERT INTO [${mjSchema}].[ApplicationEntity]
      ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
   VALUES
      ('E609083D-D3E2-44AD-9DF3-CB833BEF381D', 'a41908f2-7d3e-4b91-9e12-6c8f3b219044', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D'), GETUTCDATE(), GETUTCDATE());
END;

/* SQL generated to add permissions for entity MJ_BizApps_Accounting: Tax Categories */
INSERT INTO [${mjSchema}].[EntityPermission]
   ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
SELECT CAST('a41908f2-7d3e-4b91-9e12-6c8f3b219044' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (
   SELECT 1 FROM [${mjSchema}].[EntityPermission]
   WHERE [EntityID] = CAST('a41908f2-7d3e-4b91-9e12-6c8f3b219044' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
);

INSERT INTO [${mjSchema}].[EntityPermission]
   ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
SELECT CAST('a41908f2-7d3e-4b91-9e12-6c8f3b219044' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (
   SELECT 1 FROM [${mjSchema}].[EntityPermission]
   WHERE [EntityID] = CAST('a41908f2-7d3e-4b91-9e12-6c8f3b219044' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
);

INSERT INTO [${mjSchema}].[EntityPermission]
   ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
SELECT CAST('a41908f2-7d3e-4b91-9e12-6c8f3b219044' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (
   SELECT 1 FROM [${mjSchema}].[EntityPermission]
   WHERE [EntityID] = CAST('a41908f2-7d3e-4b91-9e12-6c8f3b219044' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
);

/* SQL generated to create new entity MJ_BizApps_Accounting: External Accounting Systems */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[Entity] WHERE [ID] = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' OR [Name] = 'MJ_BizApps_Accounting: External Accounting Systems')
BEGIN
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
         [AllowCaching],
         [TrackRecordChanges],
         [AuditRecordAccess],
         [AuditViewRuns],
         [AllowAllRowsAPI],
         [AllowCreateAPI],
         [AllowUpdateAPI],
         [AllowDeleteAPI],
         [UserViewMaxRows],
         [__mj_CreatedAt],
         [__mj_UpdatedAt]
      )
      VALUES (
         'b82917e3-8c4f-4a82-8f23-7d9e4c328155',
         'MJ_BizApps_Accounting: External Accounting Systems',
         'External Accounting Systems',
         'Catalog of external accounting / ERP systems targeted by GLAccount.ExternalSystem and JournalEntryBatch.TargetSystem.',
         NULL,
         'ExternalAccountingSystem',
         'vwExternalAccountingSystems',
         '${flyway:defaultSchema}',
         1,
         1,
         1,
         1,
         0,
         0,
         1,
         1,
         1,
         1,
         1000,
         GETUTCDATE(),
         GETUTCDATE()
      );
END;

/* SQL generated to add new entity MJ_BizApps_Accounting: External Accounting Systems to application ID: 'E609083D-D3E2-44AD-9DF3-CB833BEF381D' */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D' AND [EntityID] = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155')
BEGIN
   INSERT INTO [${mjSchema}].[ApplicationEntity]
      ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
   VALUES
      ('E609083D-D3E2-44AD-9DF3-CB833BEF381D', 'b82917e3-8c4f-4a82-8f23-7d9e4c328155', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D'), GETUTCDATE(), GETUTCDATE());
END;

/* SQL generated to add permissions for entity MJ_BizApps_Accounting: External Accounting Systems */
INSERT INTO [${mjSchema}].[EntityPermission]
   ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
SELECT CAST('b82917e3-8c4f-4a82-8f23-7d9e4c328155' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (
   SELECT 1 FROM [${mjSchema}].[EntityPermission]
   WHERE [EntityID] = CAST('b82917e3-8c4f-4a82-8f23-7d9e4c328155' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
);

INSERT INTO [${mjSchema}].[EntityPermission]
   ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
SELECT CAST('b82917e3-8c4f-4a82-8f23-7d9e4c328155' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (
   SELECT 1 FROM [${mjSchema}].[EntityPermission]
   WHERE [EntityID] = CAST('b82917e3-8c4f-4a82-8f23-7d9e4c328155' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
);

INSERT INTO [${mjSchema}].[EntityPermission]
   ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
SELECT CAST('b82917e3-8c4f-4a82-8f23-7d9e4c328155' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (
   SELECT 1 FROM [${mjSchema}].[EntityPermission]
   WHERE [EntityID] = CAST('b82917e3-8c4f-4a82-8f23-7d9e4c328155' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
);

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert new entity fields */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b41f92a3-8c4e-4b71-9a12-7e3f5c812091' OR (EntityID = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND Name = 'ERPJournalCode')) BEGIN
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
            'b41f92a3-8c4e-4b71-9a12-7e3f5c812091',
            '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC'),
            'ERPJournalCode',
            'ERP Journal Code',
            'The ERP general journal batch or template code used when posting journal entry batches for this company (e.g. Business Central journal batch code). NULL uses the ERP provider''s default (such as DEFAULT in Business Central).',
            'nvarchar',
            100,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c72e83b4-9d5f-4c82-8b23-6f4e7d923102' OR (EntityID = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND Name = 'ERPPostUnconfirmedAt')) BEGIN
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
            'c72e83b4-9d5f-4c82-8b23-6f4e7d923102',
            '87AD37E9-62F9-4F0E-A15B-F64ADF009112', -- Entity: MJ_BizApps_Accounting: Journal Entry Batches
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '87AD37E9-62F9-4F0E-A15B-F64ADF009112'),
            'ERPPostUnconfirmedAt',
            'ERP Post Unconfirmed At',
            'When an ERP send failed after the HTTP post was dispatched or during post-send confirmation, so the batch may already be posted in the ERP. Blocks retry until a subsequent lookup confirms the ERP state, or the batch is cancelled with an ERP check or archived.',
            'datetimeoffset',
            10,
            34,
            7,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9001' OR (EntityID = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND Name = 'Code')) BEGIN
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
            'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9001',
            'a41908f2-7d3e-4b91-9e12-6c8f3b219044', -- Entity: MJ_BizApps_Accounting: Tax Categories
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'),
            'Code',
            'Code',
            'Stable machine code (primary key) for the tax category.',
            'nvarchar',
            100,
            0,
            0,
            0,
            NULL,
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            1,
            0,
            1,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9002' OR (EntityID = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND Name = 'Name')) BEGIN
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
            'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9002',
            'a41908f2-7d3e-4b91-9e12-6c8f3b219044', -- Entity: MJ_BizApps_Accounting: Tax Categories
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'),
            'Name',
            'Name',
            'Human-readable display name for the tax category.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9003' OR (EntityID = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND Name = 'Description')) BEGIN
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
            'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9003',
            'a41908f2-7d3e-4b91-9e12-6c8f3b219044', -- Entity: MJ_BizApps_Accounting: Tax Categories
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'),
            'Description',
            'Description',
            'Guidance on which goods or services qualify for this tax category.',
            'nvarchar',
            1000,
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9004' OR (EntityID = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND Name = 'IsActive')) BEGIN
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
            'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9004',
            'a41908f2-7d3e-4b91-9e12-6c8f3b219044', -- Entity: MJ_BizApps_Accounting: Tax Categories
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'),
            'IsActive',
            'Is Active',
            'Whether this tax category is active for new tax rate definitions.',
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9005' OR (EntityID = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND Name = '__mj_CreatedAt')) BEGIN
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
            'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9005',
            'a41908f2-7d3e-4b91-9e12-6c8f3b219044', -- Entity: MJ_BizApps_Accounting: Tax Categories
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9006' OR (EntityID = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND Name = '__mj_UpdatedAt')) BEGIN
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
            'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9006',
            'a41908f2-7d3e-4b91-9e12-6c8f3b219044', -- Entity: MJ_BizApps_Accounting: Tax Categories
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0001' OR (EntityID = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND Name = 'Code')) BEGIN
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
            'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0001',
            'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
            'Code',
            'Code',
            'Stable machine code (primary key) for the external accounting system.',
            'nvarchar',
            100,
            0,
            0,
            0,
            NULL,
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            1,
            0,
            1,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0002' OR (EntityID = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND Name = 'Name')) BEGIN
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
            'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0002',
            'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
            'Name',
            'Name',
            'Human-readable display name for the external accounting system.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0003' OR (EntityID = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND Name = 'Description')) BEGIN
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
            'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0003',
            'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
            'Description',
            'Description',
            'Details about the external accounting system integration.',
            'nvarchar',
            1000,
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0004' OR (EntityID = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND Name = 'IsDefault')) BEGIN
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
            'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0004',
            'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
            'IsDefault',
            'Is Default',
            'Whether this system is the default target when an account has no explicit ExternalSystem set. At most one row may have IsDefault = 1.',
            'bit',
            1,
            1,
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0005' OR (EntityID = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND Name = 'IsActive')) BEGIN
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
            'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0005',
            'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
            'IsActive',
            'Is Active',
            'Whether this external accounting system is active.',
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0006' OR (EntityID = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND Name = '__mj_CreatedAt')) BEGIN
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
            'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0006',
            'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0007' OR (EntityID = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND Name = '__mj_UpdatedAt')) BEGIN
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
            'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0007',
            'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
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

/* Update TaxRate.TaxCategory EntityField to reference MJ_BizApps_Accounting: Tax Categories */
UPDATE [${mjSchema}].[EntityField]
SET
   [RelatedEntityID] = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044',
   [RelatedEntityFieldName] = 'Code',
   [ValueListType] = 'None',
   [Description] = N'Tax category code referencing TaxCategory.Code (e.g. Standard, Reduced, Zero, Exempt, OutOfScope, Publications, Groceries, DigitalGoods).'
WHERE [ID] = 'c5cfa93d-203a-4776-a37a-8af2099038f1';

/* Create Entity Relationship: MJ_BizApps_Accounting: Tax Categories -> MJ_BizApps_Accounting: Tax Rates (One To Many via TaxCategory) */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'f33c20f4-3c4d-4e5f-8a6b-7c8d9e0f1001')
BEGIN
   INSERT INTO [${mjSchema}].[EntityRelationship]
      ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
   VALUES
      ('f33c20f4-3c4d-4e5f-8a6b-7c8d9e0f1001', 'a41908f2-7d3e-4b91-9e12-6c8f3b219044', 'C0D334F3-8491-4EDC-833F-F53F2605C9BA', 'TaxCategory', 'One To Many', 1, 1, 1, GETUTCDATE(), GETUTCDATE());
END;

/* Update the 8 vwJournalEntries view-only anomaly feature field descriptions (#314) */
UPDATE [${mjSchema}].[EntityField]
SET [Description] = N'Label derived from Status for anomaly models: Voided for Voided entries, Reversed when another entry points at this one as ReversedFromJournalEntryID, Normal for Posted entries with no reversal, NULL while Draft/Submitted/PendingApproval/Approved/Rejected.'
WHERE [ID] = '71836c90-010c-4f03-a0f2-abe0e37eda3d';

UPDATE [${mjSchema}].[EntityField]
SET [Description] = N'Sum of FunctionalDebitAmount across all JournalEntryLine rows on this entry, in the company functional currency. Zero when the entry has no lines.'
WHERE [ID] = 'b55285d4-5dd5-42e4-8395-013e87ee0ecb';

UPDATE [${mjSchema}].[EntityField]
SET [Description] = N'Total number of JournalEntryLine rows attached to this entry.'
WHERE [ID] = '2bee0bbb-bc51-4fcf-9a48-45d9e25e8734';

UPDATE [${mjSchema}].[EntityField]
SET [Description] = N'Calendar month of EffectiveDate (1 = January through 12 = December), exposed for seasonal anomaly features.'
WHERE [ID] = '0be539d7-f9ae-4ca6-b18b-9fe77f456617';

UPDATE [${mjSchema}].[EntityField]
SET [Description] = N'ISO day-of-week of EffectiveDate (1 = Monday through 7 = Sunday), independent of session DATEFIRST.'
WHERE [ID] = 'e404e4ba-43e1-4d79-ae84-0a7c00f19f3c';

UPDATE [${mjSchema}].[EntityField]
SET [Description] = N'True when EffectiveDate falls on Saturday or Sunday (ISO day-of-week 6 or 7).'
WHERE [ID] = 'dda19850-854f-4d3b-ac92-1341b56e1990';

UPDATE [${mjSchema}].[EntityField]
SET [Description] = N'True when LinkedEntityID and LinkedRecordID are both populated, indicating the entry originated from a source business document rather than a standalone manual journal.'
WHERE [ID] = '059438ff-3c74-4ab3-82ac-b08de48ef205';

UPDATE [${mjSchema}].[EntityField]
SET [Description] = N'True when FileID is populated (supporting attachment present on the entry header).'
WHERE [ID] = '3388c921-27ff-42dd-b308-65e4577df0fe';

/* Update EntityField Category metadata for new fields */
UPDATE [${mjSchema}].[EntityField] SET [Category] = N'Accounting Policy' WHERE [ID] = 'b41f92a3-8c4e-4b71-9a12-7e3f5c812091';
UPDATE [${mjSchema}].[EntityField] SET [Category] = N'ERP Dispatch' WHERE [ID] = 'c72e83b4-9d5f-4c82-8b23-6f4e7d923102';
UPDATE [${mjSchema}].[EntityField] SET [Category] = N'Tax Category Details' WHERE [EntityID] = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND [Name] IN ('Code', 'Name', 'Description', 'IsActive');
UPDATE [${mjSchema}].[EntityField] SET [Category] = N'System Metadata' WHERE [EntityID] = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND [Name] IN ('__mj_CreatedAt', '__mj_UpdatedAt');
UPDATE [${mjSchema}].[EntityField] SET [Category] = N'External System Details' WHERE [EntityID] = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND [Name] IN ('Code', 'Name', 'Description', 'IsDefault', 'IsActive');
UPDATE [${mjSchema}].[EntityField] SET [Category] = N'System Metadata' WHERE [EntityID] = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND [Name] IN ('__mj_CreatedAt', '__mj_UpdatedAt');

/* Update Run ERP Sync Action description (#423) and JournalEntryBatch EntityAction ActionFilter (#394) */
UPDATE [${mjSchema}].[Action]
SET [Description] = N'Pulls chart of accounts, dimensions, and dimension values from every credentialed Company Integration via AccountingERPEngine.SyncMasterData. When all three objects are requested for a connector-wired integration with active entity maps, delegates to MJ IntegrationEngine.RunSync; otherwise (subset Objects filter or custom provider) falls back to the direct BaseAccountingERPProvider pull. One job, all companies. Hosts disable the scheduled job rather than deleting this action.'
WHERE [ID] = 'A839FB12-5813-4B85-8022-DF8943729BA2';

UPDATE [${mjSchema}].[EntityAction]
SET [ActionFilter] = N'DidFieldChangeToValue(''Status'',''Sent'')'
WHERE [ID] = '5C44B19D-8CE3-489D-A354-507A3B67A1C9';

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Foreign Key Indexes */
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_TaxRate_TaxCategory'
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[TaxRate]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_TaxRate_TaxCategory ON [${flyway:defaultSchema}].[TaxRate] ([TaxCategory]);

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_TargetSystem'
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_TargetSystem ON [${flyway:defaultSchema}].[JournalEntryBatch] ([TargetSystem]);

/* Base View SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
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
    MJRole_ManualJournalEntryApproverRoleID.[Name] AS [ManualJournalEntryApproverRole],
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
    [${mjSchema}].[Role] AS MJRole_ManualJournalEntryApproverRoleID
  ON
    [a].[ManualJournalEntryApproverRoleID] = MJRole_ManualJournalEntryApproverRoleID.[ID]
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

/* spCreate SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
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
    @PostingStartDate date = NULL,
    @ManualJournalEntryApprovalThreshold_Clear bit = 0,
    @ManualJournalEntryApprovalThreshold decimal(19, 4) = NULL,
    @ManualJournalEntryApproverRoleID_Clear bit = 0,
    @ManualJournalEntryApproverRoleID uniqueidentifier = NULL,
    @BooksClosedThroughDate_Clear bit = 0,
    @BooksClosedThroughDate date = NULL,
    @ERPJournalCode_Clear bit = 0,
    @ERPJournalCode nvarchar(50) = NULL
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
            [ManualJournalEntryApprovalThreshold],
            [ManualJournalEntryApproverRoleID],
            [BooksClosedThroughDate],
            [ERPJournalCode],
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
            CASE WHEN @ManualJournalEntryApprovalThreshold_Clear = 1 THEN NULL ELSE ISNULL(@ManualJournalEntryApprovalThreshold, NULL) END,
            CASE WHEN @ManualJournalEntryApproverRoleID_Clear = 1 THEN NULL ELSE ISNULL(@ManualJournalEntryApproverRoleID, NULL) END,
            CASE WHEN @BooksClosedThroughDate_Clear = 1 THEN NULL ELSE ISNULL(@BooksClosedThroughDate, NULL) END,
            CASE WHEN @ERPJournalCode_Clear = 1 THEN NULL ELSE ISNULL(@ERPJournalCode, NULL) END,
            @ActualID
        )
    SELECT * FROM [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] WHERE [ID] = @ActualID
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
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
    @PostingStartDate date = NULL,
    @ManualJournalEntryApprovalThreshold_Clear bit = 0,
    @ManualJournalEntryApprovalThreshold decimal(19, 4) = NULL,
    @ManualJournalEntryApproverRoleID_Clear bit = 0,
    @ManualJournalEntryApproverRoleID uniqueidentifier = NULL,
    @BooksClosedThroughDate_Clear bit = 0,
    @BooksClosedThroughDate date = NULL,
    @ERPJournalCode_Clear bit = 0,
    @ERPJournalCode nvarchar(50) = NULL
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
        [PostingStartDate] = CASE WHEN @PostingStartDate_Clear = 1 THEN NULL ELSE ISNULL(@PostingStartDate, [PostingStartDate]) END,
        [ManualJournalEntryApprovalThreshold] = CASE WHEN @ManualJournalEntryApprovalThreshold_Clear = 1 THEN NULL ELSE ISNULL(@ManualJournalEntryApprovalThreshold, [ManualJournalEntryApprovalThreshold]) END,
        [ManualJournalEntryApproverRoleID] = CASE WHEN @ManualJournalEntryApproverRoleID_Clear = 1 THEN NULL ELSE ISNULL(@ManualJournalEntryApproverRoleID, [ManualJournalEntryApproverRoleID]) END,
        [BooksClosedThroughDate] = CASE WHEN @BooksClosedThroughDate_Clear = 1 THEN NULL ELSE ISNULL(@BooksClosedThroughDate, [BooksClosedThroughDate]) END,
        [ERPJournalCode] = CASE WHEN @ERPJournalCode_Clear = 1 THEN NULL ELSE ISNULL(@ERPJournalCode, [ERPJournalCode]) END
    WHERE
        [ID] = @ID

    IF @@ROWCOUNT = 0
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] WHERE 1=0
    ELSE
        SELECT * FROM [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] WHERE [ID] = @ID
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];
GO

/* Base View SQL for MJ_BizApps_Accounting: Journal Entry Batches */
IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntryBatches]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwJournalEntryBatches];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwJournalEntryBatches]
AS
SELECT
    j.*,
    MJCompany_CompanyID.[Name] AS [Company],
    mjBizAppsAccountingJournalEntry_SummaryJournalEntryID.[EntryNumber] AS [SummaryJournalEntry],
    MJUser_BatchedByUserID.[Name] AS [BatchedByUser],
    MJUser_ApprovedByUserID.[Name] AS [ApprovedByUser],
    mjBizAppsTasksTask_ApprovalTaskID.[Name] AS [ApprovalTask],
    MJUser_ArchivedByUserID.[Name] AS [ArchivedByUser],
    MJUser_CancelledByUserID.[Name] AS [CancelledByUser],
    MJUser_ERPNotPostedConfirmedByUserID.[Name] AS [ERPNotPostedConfirmedByUser],
    MJUser_SentByUserID.[Name] AS [SentByUser]
FROM
    [${flyway:defaultSchema}].[JournalEntryBatch] AS j
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [j].[CompanyID] = MJCompany_CompanyID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[JournalEntry] AS mjBizAppsAccountingJournalEntry_SummaryJournalEntryID
  ON
    [j].[SummaryJournalEntryID] = mjBizAppsAccountingJournalEntry_SummaryJournalEntryID.[ID]
INNER JOIN
    [${mjSchema}].[User] AS MJUser_BatchedByUserID
  ON
    [j].[BatchedByUserID] = MJUser_BatchedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ApprovedByUserID
  ON
    [j].[ApprovedByUserID] = MJUser_ApprovedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}_BizAppsTasks].[Task] AS mjBizAppsTasksTask_ApprovalTaskID
  ON
    [j].[ApprovalTaskID] = mjBizAppsTasksTask_ApprovalTaskID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ArchivedByUserID
  ON
    [j].[ArchivedByUserID] = MJUser_ArchivedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_CancelledByUserID
  ON
    [j].[CancelledByUserID] = MJUser_CancelledByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ERPNotPostedConfirmedByUserID
  ON
    [j].[ERPNotPostedConfirmedByUserID] = MJUser_ERPNotPostedConfirmedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_SentByUserID
  ON
    [j].[SentByUserID] = MJUser_SentByUserID.[ID]
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntryBatches] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntryBatches] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntryBatches] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntryBatches] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: Journal Entry Batches */
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateJournalEntryBatch]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateJournalEntryBatch];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateJournalEntryBatch]
    @ID uniqueidentifier = NULL,
    @JournalEntryBatchNumber nvarchar(40),
    @CompanyID uniqueidentifier,
    @PostingDate date,
    @SummaryJournalEntryID_Clear bit = 0,
    @SummaryJournalEntryID uniqueidentifier = NULL,
    @TargetSystem nvarchar(50),
    @BatchedAt datetimeoffset = NULL,
    @BatchedByUserID uniqueidentifier,
    @Status nvarchar(20) = NULL,
    @TotalEntries int = NULL,
    @TotalDebits decimal(18, 2) = NULL,
    @TotalCredits decimal(18, 2) = NULL,
    @ExternalJournalEntryBatchRef_Clear bit = 0,
    @ExternalJournalEntryBatchRef nvarchar(100) = NULL,
    @ApprovedAt_Clear bit = 0,
    @ApprovedAt datetimeoffset = NULL,
    @ApprovedByUserID_Clear bit = 0,
    @ApprovedByUserID uniqueidentifier = NULL,
    @SentAt_Clear bit = 0,
    @SentAt datetimeoffset = NULL,
    @PostedAt_Clear bit = 0,
    @PostedAt datetimeoffset = NULL,
    @ErrorMessage_Clear bit = 0,
    @ErrorMessage nvarchar(MAX) = NULL,
    @ApprovalTaskID_Clear bit = 0,
    @ApprovalTaskID uniqueidentifier = NULL,
    @ApprovalTaskRaisedAt_Clear bit = 0,
    @ApprovalTaskRaisedAt datetimeoffset = NULL,
    @ArchiveReason_Clear bit = 0,
    @ArchiveReason nvarchar(500) = NULL,
    @ArchivedAt_Clear bit = 0,
    @ArchivedAt datetimeoffset = NULL,
    @ArchivedByUserID_Clear bit = 0,
    @ArchivedByUserID uniqueidentifier = NULL,
    @CancelReason_Clear bit = 0,
    @CancelReason nvarchar(1000) = NULL,
    @CancelledAt_Clear bit = 0,
    @CancelledAt datetimeoffset = NULL,
    @CancelledByUserID_Clear bit = 0,
    @CancelledByUserID uniqueidentifier = NULL,
    @ERPNotPostedConfirmedAt_Clear bit = 0,
    @ERPNotPostedConfirmedAt datetimeoffset = NULL,
    @ERPNotPostedConfirmedByUserID_Clear bit = 0,
    @ERPNotPostedConfirmedByUserID uniqueidentifier = NULL,
    @ERPNotPostedBasis_Clear bit = 0,
    @ERPNotPostedBasis nvarchar(20) = NULL,
    @ApprovedContentHash_Clear bit = 0,
    @ApprovedContentHash nvarchar(64) = NULL,
    @SentByUserID_Clear bit = 0,
    @SentByUserID uniqueidentifier = NULL,
    @SendAttemptCount int = NULL,
    @SealMismatchDetectedAt_Clear bit = 0,
    @SealMismatchDetectedAt datetimeoffset = NULL,
    @ERPPostUnconfirmedAt_Clear bit = 0,
    @ERPPostUnconfirmedAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        INSERT INTO [${flyway:defaultSchema}].[JournalEntryBatch]
            (
                [ID],
                [JournalEntryBatchNumber],
                [CompanyID],
                [PostingDate],
                [SummaryJournalEntryID],
                [TargetSystem],
                [BatchedAt],
                [BatchedByUserID],
                [Status],
                [TotalEntries],
                [TotalDebits],
                [TotalCredits],
                [ExternalJournalEntryBatchRef],
                [ApprovedAt],
                [ApprovedByUserID],
                [SentAt],
                [PostedAt],
                [ErrorMessage],
                [ApprovalTaskID],
                [ApprovalTaskRaisedAt],
                [ArchiveReason],
                [ArchivedAt],
                [ArchivedByUserID],
                [CancelReason],
                [CancelledAt],
                [CancelledByUserID],
                [ERPNotPostedConfirmedAt],
                [ERPNotPostedConfirmedByUserID],
                [ERPNotPostedBasis],
                [ApprovedContentHash],
                [SentByUserID],
                [SendAttemptCount],
                [SealMismatchDetectedAt],
                [ERPPostUnconfirmedAt]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @JournalEntryBatchNumber,
                @CompanyID,
                @PostingDate,
                CASE WHEN @SummaryJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@SummaryJournalEntryID, NULL) END,
                @TargetSystem,
                ISNULL(@BatchedAt, sysdatetimeoffset()),
                @BatchedByUserID,
                ISNULL(@Status, 'Pending'),
                ISNULL(@TotalEntries, 0),
                ISNULL(@TotalDebits, 0),
                ISNULL(@TotalCredits, 0),
                CASE WHEN @ExternalJournalEntryBatchRef_Clear = 1 THEN NULL ELSE ISNULL(@ExternalJournalEntryBatchRef, NULL) END,
                CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, NULL) END,
                CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, NULL) END,
                CASE WHEN @SentAt_Clear = 1 THEN NULL ELSE ISNULL(@SentAt, NULL) END,
                CASE WHEN @PostedAt_Clear = 1 THEN NULL ELSE ISNULL(@PostedAt, NULL) END,
                CASE WHEN @ErrorMessage_Clear = 1 THEN NULL ELSE ISNULL(@ErrorMessage, NULL) END,
                CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, NULL) END,
                CASE WHEN @ApprovalTaskRaisedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskRaisedAt, NULL) END,
                CASE WHEN @ArchiveReason_Clear = 1 THEN NULL ELSE ISNULL(@ArchiveReason, NULL) END,
                CASE WHEN @ArchivedAt_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedAt, NULL) END,
                CASE WHEN @ArchivedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedByUserID, NULL) END,
                CASE WHEN @CancelReason_Clear = 1 THEN NULL ELSE ISNULL(@CancelReason, NULL) END,
                CASE WHEN @CancelledAt_Clear = 1 THEN NULL ELSE ISNULL(@CancelledAt, NULL) END,
                CASE WHEN @CancelledByUserID_Clear = 1 THEN NULL ELSE ISNULL(@CancelledByUserID, NULL) END,
                CASE WHEN @ERPNotPostedConfirmedAt_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedAt, NULL) END,
                CASE WHEN @ERPNotPostedConfirmedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedByUserID, NULL) END,
                CASE WHEN @ERPNotPostedBasis_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedBasis, NULL) END,
                CASE WHEN @ApprovedContentHash_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedContentHash, NULL) END,
                CASE WHEN @SentByUserID_Clear = 1 THEN NULL ELSE ISNULL(@SentByUserID, NULL) END,
                ISNULL(@SendAttemptCount, 0),
                CASE WHEN @SealMismatchDetectedAt_Clear = 1 THEN NULL ELSE ISNULL(@SealMismatchDetectedAt, NULL) END,
                CASE WHEN @ERPPostUnconfirmedAt_Clear = 1 THEN NULL ELSE ISNULL(@ERPPostUnconfirmedAt, NULL) END
            )
    END
    ELSE
    BEGIN
        INSERT INTO [${flyway:defaultSchema}].[JournalEntryBatch]
            (
                [JournalEntryBatchNumber],
                [CompanyID],
                [PostingDate],
                [SummaryJournalEntryID],
                [TargetSystem],
                [BatchedAt],
                [BatchedByUserID],
                [Status],
                [TotalEntries],
                [TotalDebits],
                [TotalCredits],
                [ExternalJournalEntryBatchRef],
                [ApprovedAt],
                [ApprovedByUserID],
                [SentAt],
                [PostedAt],
                [ErrorMessage],
                [ApprovalTaskID],
                [ApprovalTaskRaisedAt],
                [ArchiveReason],
                [ArchivedAt],
                [ArchivedByUserID],
                [CancelReason],
                [CancelledAt],
                [CancelledByUserID],
                [ERPNotPostedConfirmedAt],
                [ERPNotPostedConfirmedByUserID],
                [ERPNotPostedBasis],
                [ApprovedContentHash],
                [SentByUserID],
                [SendAttemptCount],
                [SealMismatchDetectedAt],
                [ERPPostUnconfirmedAt]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @JournalEntryBatchNumber,
                @CompanyID,
                @PostingDate,
                CASE WHEN @SummaryJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@SummaryJournalEntryID, NULL) END,
                @TargetSystem,
                ISNULL(@BatchedAt, sysdatetimeoffset()),
                @BatchedByUserID,
                ISNULL(@Status, 'Pending'),
                ISNULL(@TotalEntries, 0),
                ISNULL(@TotalDebits, 0),
                ISNULL(@TotalCredits, 0),
                CASE WHEN @ExternalJournalEntryBatchRef_Clear = 1 THEN NULL ELSE ISNULL(@ExternalJournalEntryBatchRef, NULL) END,
                CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, NULL) END,
                CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, NULL) END,
                CASE WHEN @SentAt_Clear = 1 THEN NULL ELSE ISNULL(@SentAt, NULL) END,
                CASE WHEN @PostedAt_Clear = 1 THEN NULL ELSE ISNULL(@PostedAt, NULL) END,
                CASE WHEN @ErrorMessage_Clear = 1 THEN NULL ELSE ISNULL(@ErrorMessage, NULL) END,
                CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, NULL) END,
                CASE WHEN @ApprovalTaskRaisedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskRaisedAt, NULL) END,
                CASE WHEN @ArchiveReason_Clear = 1 THEN NULL ELSE ISNULL(@ArchiveReason, NULL) END,
                CASE WHEN @ArchivedAt_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedAt, NULL) END,
                CASE WHEN @ArchivedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedByUserID, NULL) END,
                CASE WHEN @CancelReason_Clear = 1 THEN NULL ELSE ISNULL(@CancelReason, NULL) END,
                CASE WHEN @CancelledAt_Clear = 1 THEN NULL ELSE ISNULL(@CancelledAt, NULL) END,
                CASE WHEN @CancelledByUserID_Clear = 1 THEN NULL ELSE ISNULL(@CancelledByUserID, NULL) END,
                CASE WHEN @ERPNotPostedConfirmedAt_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedAt, NULL) END,
                CASE WHEN @ERPNotPostedConfirmedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedByUserID, NULL) END,
                CASE WHEN @ERPNotPostedBasis_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedBasis, NULL) END,
                CASE WHEN @ApprovedContentHash_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedContentHash, NULL) END,
                CASE WHEN @SentByUserID_Clear = 1 THEN NULL ELSE ISNULL(@SentByUserID, NULL) END,
                ISNULL(@SendAttemptCount, 0),
                CASE WHEN @SealMismatchDetectedAt_Clear = 1 THEN NULL ELSE ISNULL(@SealMismatchDetectedAt, NULL) END,
                CASE WHEN @ERPPostUnconfirmedAt_Clear = 1 THEN NULL ELSE ISNULL(@ERPPostUnconfirmedAt, NULL) END
            )
    END
    SELECT * FROM [${flyway:defaultSchema}].[vwJournalEntryBatches] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntryBatch] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntryBatch] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: Journal Entry Batches */
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateJournalEntryBatch]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryBatch];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryBatch]
    @ID uniqueidentifier,
    @JournalEntryBatchNumber nvarchar(40) = NULL,
    @CompanyID uniqueidentifier = NULL,
    @PostingDate date = NULL,
    @SummaryJournalEntryID_Clear bit = 0,
    @SummaryJournalEntryID uniqueidentifier = NULL,
    @TargetSystem nvarchar(50) = NULL,
    @BatchedAt datetimeoffset = NULL,
    @BatchedByUserID uniqueidentifier = NULL,
    @Status nvarchar(20) = NULL,
    @TotalEntries int = NULL,
    @TotalDebits decimal(18, 2) = NULL,
    @TotalCredits decimal(18, 2) = NULL,
    @ExternalJournalEntryBatchRef_Clear bit = 0,
    @ExternalJournalEntryBatchRef nvarchar(100) = NULL,
    @ApprovedAt_Clear bit = 0,
    @ApprovedAt datetimeoffset = NULL,
    @ApprovedByUserID_Clear bit = 0,
    @ApprovedByUserID uniqueidentifier = NULL,
    @SentAt_Clear bit = 0,
    @SentAt datetimeoffset = NULL,
    @PostedAt_Clear bit = 0,
    @PostedAt datetimeoffset = NULL,
    @ErrorMessage_Clear bit = 0,
    @ErrorMessage nvarchar(MAX) = NULL,
    @ApprovalTaskID_Clear bit = 0,
    @ApprovalTaskID uniqueidentifier = NULL,
    @ApprovalTaskRaisedAt_Clear bit = 0,
    @ApprovalTaskRaisedAt datetimeoffset = NULL,
    @ArchiveReason_Clear bit = 0,
    @ArchiveReason nvarchar(500) = NULL,
    @ArchivedAt_Clear bit = 0,
    @ArchivedAt datetimeoffset = NULL,
    @ArchivedByUserID_Clear bit = 0,
    @ArchivedByUserID uniqueidentifier = NULL,
    @CancelReason_Clear bit = 0,
    @CancelReason nvarchar(1000) = NULL,
    @CancelledAt_Clear bit = 0,
    @CancelledAt datetimeoffset = NULL,
    @CancelledByUserID_Clear bit = 0,
    @CancelledByUserID uniqueidentifier = NULL,
    @ERPNotPostedConfirmedAt_Clear bit = 0,
    @ERPNotPostedConfirmedAt datetimeoffset = NULL,
    @ERPNotPostedConfirmedByUserID_Clear bit = 0,
    @ERPNotPostedConfirmedByUserID uniqueidentifier = NULL,
    @ERPNotPostedBasis_Clear bit = 0,
    @ERPNotPostedBasis nvarchar(20) = NULL,
    @ApprovedContentHash_Clear bit = 0,
    @ApprovedContentHash nvarchar(64) = NULL,
    @SentByUserID_Clear bit = 0,
    @SentByUserID uniqueidentifier = NULL,
    @SendAttemptCount int = NULL,
    @SealMismatchDetectedAt_Clear bit = 0,
    @SealMismatchDetectedAt datetimeoffset = NULL,
    @ERPPostUnconfirmedAt_Clear bit = 0,
    @ERPPostUnconfirmedAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntryBatch]
    SET
        [JournalEntryBatchNumber] = ISNULL(@JournalEntryBatchNumber, [JournalEntryBatchNumber]),
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [PostingDate] = ISNULL(@PostingDate, [PostingDate]),
        [SummaryJournalEntryID] = CASE WHEN @SummaryJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@SummaryJournalEntryID, [SummaryJournalEntryID]) END,
        [TargetSystem] = ISNULL(@TargetSystem, [TargetSystem]),
        [BatchedAt] = ISNULL(@BatchedAt, [BatchedAt]),
        [BatchedByUserID] = ISNULL(@BatchedByUserID, [BatchedByUserID]),
        [Status] = ISNULL(@Status, [Status]),
        [TotalEntries] = ISNULL(@TotalEntries, [TotalEntries]),
        [TotalDebits] = ISNULL(@TotalDebits, [TotalDebits]),
        [TotalCredits] = ISNULL(@TotalCredits, [TotalCredits]),
        [ExternalJournalEntryBatchRef] = CASE WHEN @ExternalJournalEntryBatchRef_Clear = 1 THEN NULL ELSE ISNULL(@ExternalJournalEntryBatchRef, [ExternalJournalEntryBatchRef]) END,
        [ApprovedAt] = CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, [ApprovedAt]) END,
        [ApprovedByUserID] = CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, [ApprovedByUserID]) END,
        [SentAt] = CASE WHEN @SentAt_Clear = 1 THEN NULL ELSE ISNULL(@SentAt, [SentAt]) END,
        [PostedAt] = CASE WHEN @PostedAt_Clear = 1 THEN NULL ELSE ISNULL(@PostedAt, [PostedAt]) END,
        [ErrorMessage] = CASE WHEN @ErrorMessage_Clear = 1 THEN NULL ELSE ISNULL(@ErrorMessage, [ErrorMessage]) END,
        [ApprovalTaskID] = CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, [ApprovalTaskID]) END,
        [ApprovalTaskRaisedAt] = CASE WHEN @ApprovalTaskRaisedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskRaisedAt, [ApprovalTaskRaisedAt]) END,
        [ArchiveReason] = CASE WHEN @ArchiveReason_Clear = 1 THEN NULL ELSE ISNULL(@ArchiveReason, [ArchiveReason]) END,
        [ArchivedAt] = CASE WHEN @ArchivedAt_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedAt, [ArchivedAt]) END,
        [ArchivedByUserID] = CASE WHEN @ArchivedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedByUserID, [ArchivedByUserID]) END,
        [CancelReason] = CASE WHEN @CancelReason_Clear = 1 THEN NULL ELSE ISNULL(@CancelReason, [CancelReason]) END,
        [CancelledAt] = CASE WHEN @CancelledAt_Clear = 1 THEN NULL ELSE ISNULL(@CancelledAt, [CancelledAt]) END,
        [CancelledByUserID] = CASE WHEN @CancelledByUserID_Clear = 1 THEN NULL ELSE ISNULL(@CancelledByUserID, [CancelledByUserID]) END,
        [ERPNotPostedConfirmedAt] = CASE WHEN @ERPNotPostedConfirmedAt_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedAt, [ERPNotPostedConfirmedAt]) END,
        [ERPNotPostedConfirmedByUserID] = CASE WHEN @ERPNotPostedConfirmedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedByUserID, [ERPNotPostedConfirmedByUserID]) END,
        [ERPNotPostedBasis] = CASE WHEN @ERPNotPostedBasis_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedBasis, [ERPNotPostedBasis]) END,
        [ApprovedContentHash] = CASE WHEN @ApprovedContentHash_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedContentHash, [ApprovedContentHash]) END,
        [SentByUserID] = CASE WHEN @SentByUserID_Clear = 1 THEN NULL ELSE ISNULL(@SentByUserID, [SentByUserID]) END,
        [SendAttemptCount] = ISNULL(@SendAttemptCount, [SendAttemptCount]),
        [SealMismatchDetectedAt] = CASE WHEN @SealMismatchDetectedAt_Clear = 1 THEN NULL ELSE ISNULL(@SealMismatchDetectedAt, [SealMismatchDetectedAt]) END,
        [ERPPostUnconfirmedAt] = CASE WHEN @ERPPostUnconfirmedAt_Clear = 1 THEN NULL ELSE ISNULL(@ERPPostUnconfirmedAt, [ERPPostUnconfirmedAt]) END
    WHERE
        [ID] = @ID

    IF @@ROWCOUNT = 0
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwJournalEntryBatches] WHERE 1=0
    ELSE
        SELECT * FROM [${flyway:defaultSchema}].[vwJournalEntryBatches] WHERE [ID] = @ID
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatch] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatch] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];
GO

/* Base View and CRUD Procedures for MJ_BizApps_Accounting: Tax Categories */
IF OBJECT_ID('[${flyway:defaultSchema}].[vwTaxCategories]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwTaxCategories];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwTaxCategories]
AS
SELECT
    t.*
FROM
    [${flyway:defaultSchema}].[TaxCategory] AS t
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwTaxCategories] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateTaxCategory]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateTaxCategory];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateTaxCategory]
    @Code nvarchar(50),
    @Name nvarchar(100),
    @Description_Clear bit = 0,
    @Description nvarchar(500) = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [${flyway:defaultSchema}].[TaxCategory]
        (
            [Code],
            [Name],
            [Description],
            [IsActive]
        )
    VALUES
        (
            @Code,
            @Name,
            CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
            ISNULL(@IsActive, 1)
        )
    SELECT * FROM [${flyway:defaultSchema}].[vwTaxCategories] WHERE [Code] = @Code
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateTaxCategory] TO [cdp_Developer], [cdp_Integration];

IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateTaxCategory]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateTaxCategory];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateTaxCategory]
    @Code nvarchar(50),
    @Name nvarchar(100) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(500) = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[TaxCategory]
    SET
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive])
    WHERE
        [Code] = @Code

    IF @@ROWCOUNT = 0
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwTaxCategories] WHERE 1=0
    ELSE
        SELECT * FROM [${flyway:defaultSchema}].[vwTaxCategories] WHERE [Code] = @Code
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateTaxCategory] TO [cdp_Developer], [cdp_Integration];
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateTaxCategory]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateTaxCategory];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateTaxCategory
ON [${flyway:defaultSchema}].[TaxCategory]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[TaxCategory]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[TaxCategory] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[Code] = I.[Code];
END;
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteTaxCategory]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteTaxCategory];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteTaxCategory]
    @Code nvarchar(50)
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM [${flyway:defaultSchema}].[TaxCategory]
    WHERE [Code] = @Code

    IF @@ROWCOUNT = 0
        SELECT NULL AS [Code]
    ELSE
        SELECT @Code AS [Code]
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteTaxCategory] TO [cdp_Developer], [cdp_Integration];

/* Base View and CRUD Procedures for MJ_BizApps_Accounting: External Accounting Systems */
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

IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateExternalAccountingSystem]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateExternalAccountingSystem];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateExternalAccountingSystem]
    @Code nvarchar(50),
    @Name nvarchar(100),
    @Description_Clear bit = 0,
    @Description nvarchar(500) = NULL,
    @IsDefault bit = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [${flyway:defaultSchema}].[ExternalAccountingSystem]
        (
            [Code],
            [Name],
            [Description],
            [IsDefault],
            [IsActive]
        )
    VALUES
        (
            @Code,
            @Name,
            CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
            ISNULL(@IsDefault, 0),
            ISNULL(@IsActive, 1)
        )
    SELECT * FROM [${flyway:defaultSchema}].[vwExternalAccountingSystems] WHERE [Code] = @Code
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];

IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateExternalAccountingSystem]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateExternalAccountingSystem];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateExternalAccountingSystem]
    @Code nvarchar(50),
    @Name nvarchar(100) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(500) = NULL,
    @IsDefault bit = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[ExternalAccountingSystem]
    SET
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [IsDefault] = ISNULL(@IsDefault, [IsDefault]),
        [IsActive] = ISNULL(@IsActive, [IsActive])
    WHERE
        [Code] = @Code

    IF @@ROWCOUNT = 0
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwExternalAccountingSystems] WHERE 1=0
    ELSE
        SELECT * FROM [${flyway:defaultSchema}].[vwExternalAccountingSystems] WHERE [Code] = @Code
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];
GO

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
        _organicTable.[Code] = I.[Code];
END;
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteExternalAccountingSystem]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteExternalAccountingSystem];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteExternalAccountingSystem]
    @Code nvarchar(50)
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM [${flyway:defaultSchema}].[ExternalAccountingSystem]
    WHERE [Code] = @Code

    IF @@ROWCOUNT = 0
        SELECT NULL AS [Code]
    ELSE
        SELECT @Code AS [Code]
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];
