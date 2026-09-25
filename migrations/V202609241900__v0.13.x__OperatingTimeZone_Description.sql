-- =============================================================================
-- Migration: V202609241900__v0.13.x__OperatingTimeZone_Description.sql
-- Description: #158 — restate what AccountingCompanyProfile.OperatingTimeZone is for.
-- =============================================================================
--
-- The column description said period and rev-rec boundaries are evaluated in this zone. Neither
-- is true: periods were retired (the ERP owns them), and every "today" / cutoff calculation reads
-- BizApps.BusinessTimeZone through BusinessTimeZoneEngine. The only reader is the company header
-- panel, which shows this value when it is set and the business zone when it is blank.
--
-- The entity server no longer stamps 'UTC' on a new profile, so blank is now the normal value.
-- Existing rows are not changed: a profile created while that default was live keeps 'UTC'.

EXEC sp_updateextendedproperty @name = N'MS_Description',
    @value = N'Optional IANA time-zone name (e.g. ''America/Chicago'') that overrides the business time zone (BizApps.BusinessTimeZone) for this company. Display only: timestamps are stored in UTC and "today" / cutoff calculations use the business time zone. Leave blank to inherit it.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile',
    @level2type = N'COLUMN', @level2name = N'OperatingTimeZone';












































































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


