-- ============================================================================
-- MemberJunction PostgreSQL Migration
-- Converted from SQL Server using TypeScript conversion pipeline
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schema
--
-- The schema name is quoted so it keeps its case. `mj migrate --schema` (Skyway) and the Open App
-- installer create the schema quoted, and MJ quotes it in runtime SQL. Unquoted, PostgreSQL folds it
-- to __mj_bizappsaccounting, a different and empty schema. The converter emits it unquoted, so the
-- quotes are added after conversion (see migrations-pg/README.md).
CREATE SCHEMA IF NOT EXISTS "__mj_BizAppsAccounting";
SET search_path TO "__mj_BizAppsAccounting", public;

-- Ensure backslashes in string literals are treated literally (not as escape sequences)
SET standard_conforming_strings = on;

-- NOTE: Earlier converter versions made INTEGER to BOOLEAN cast implicit by
-- modifying the system catalog so SS-style INSERT INTO bool_col VALUES (1)
-- would work. That modification required pg_catalog write privileges, which
-- managed PG (RDS, Aurora, Cloud SQL, Azure) does not grant. As of v5.30 all
-- bulk INSERTs are emitted with native TRUE/FALSE values directly, so the
-- cast modification is no longer needed. Removed to support managed-PG
-- installs out of the box.


-- ===================== Comments =====================

COMMENT ON COLUMN "__mj_BizAppsAccounting"."JournalEntryBatch"."JournalEntryBatchNumber" IS 'Gap-free batch number assigned by spAssignNextJournalEntryBatchNumber. Format ''BATCH-{seq:000000}'': one global sequence shared by every company, with no company segment.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."FinanceException"."DedupeKey" IS 'The detector''s identity for this occurrence (e.g. the source record ID, or record ID and month). Unique per type: raising the same key again returns the existing row. If that row is still Open and the repeat raise carries a different creator, its SourceCreatedByUserID, CreatorUnresolved and Summary are updated to match; nothing else changes, and Reviewed or Corrected rows are never touched.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."GLAccount"."IsSystemSeeded" IS 'TRUE if the account was created by the starter-chart seed, AccountingCompanyProfileEntityServer.SeedDefaultChartOfAccounts(). Lets reports distinguish platform-shipped accounts from deployment customizations.';


-- ===================== Other =====================

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to update existing entities from schema */
