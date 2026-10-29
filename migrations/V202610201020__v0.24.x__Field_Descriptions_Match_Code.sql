-- =============================================================================
-- Migration: V202610201020__v0.24.x__Field_Descriptions_Match_Code.sql
-- Description: three column descriptions rewritten to say what the code does
--              (#352).
-- =============================================================================
--
-- WHY
--
-- MJ shows a column's description as field help and hands it to AI features,
-- so a stale one tells users and agents the wrong thing. Three had drifted from
-- the code:
--
--   JournalEntryBatch.JournalEntryBatchNumber
--       said 'BATCH-{CompanyCode}-{seq:000000}'. spAssignNextJournalEntryBatchNumber
--       returns 'BATCH-{seq:000000}' from one global sequence; there is no
--       company segment (D-SEQ 2026-07-06).
--   FinanceException.DedupeKey
--       said a repeat raise "returns the existing row unchanged". A repeat raise
--       of an Open row whose creator has changed updates SourceCreatedByUserID,
--       CreatorUnresolved and Summary (refreshCreator in
--       packages/CoreEntitiesServer/src/FinanceExceptions.ts).
--   GLAccount.IsSystemSeeded
--       named spSeedDefaultChartOfAccounts, which was removed. The starter chart
--       is seeded by AccountingCompanyProfileEntityServer.SeedDefaultChartOfAccounts().
--
-- WHAT CHANGES
--
-- Only the three MS_Description extended properties, and through the CodeGen
-- block below, the matching EntityField.Description rows (all three fields have
-- AutoUpdateDescription = 1). No table, view, procedure or row of app data
-- changes.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================
SET NOCOUNT ON;
GO

EXEC sp_updateextendedproperty @name = N'MS_Description',
    @value = N'Gap-free batch number assigned by spAssignNextJournalEntryBatchNumber. Format ''BATCH-{seq:000000}'': one global sequence shared by every company, with no company segment.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'JournalEntryBatchNumber';
GO

EXEC sp_updateextendedproperty @name = N'MS_Description',
    @value = N'The detector''s identity for this occurrence (e.g. the source record ID, or record ID and month). Unique per type: raising the same key again returns the existing row. If that row is still Open and the repeat raise carries a different creator, its SourceCreatedByUserID, CreatorUnresolved and Summary are updated to match; nothing else changes, and Reviewed or Corrected rows are never touched.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'DedupeKey';
GO

EXEC sp_updateextendedproperty @name = N'MS_Description',
    @value = N'TRUE if the account was created by the starter-chart seed, AccountingCompanyProfileEntityServer.SeedDefaultChartOfAccounts(). Lets reports distinguish platform-shipped accounts from deployment customizations.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'IsSystemSeeded';
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

