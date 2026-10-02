-- ============================================================================
-- MemberJunction PostgreSQL Migration
-- Converted from SQL Server using TypeScript conversion pipeline
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schema
--
-- The schema name is emitted UNQUOTED, so PostgreSQL folds it to lowercase. That is deliberate and
-- self-consistent: everything downstream in a converted migration refers to it unquoted too, so
-- both definition and lookup land on the same folded name.
--
-- DOWNSTREAM NOTE for the build engineer: a PostgreSQL database that was populated by an EARLIER
-- converter — one that emitted a quoted, case-preserved name — already holds that mixed-case
-- schema: for a target named MySchema_Name, the quoted "MySchema_Name". Re-converting against
-- that database creates a SECOND, empty schema myschema_name rather than reusing the existing
-- one, because IF NOT EXISTS compares the folded name and finds no match. The repo's own committed
-- migrations-pg files are unaffected (the only quoted CREATE SCHEMAs there are the four pg_dump
-- baselines, which this path does not produce), so this is an open-app / downstream concern, not
-- one for this repo's Flyway history.
CREATE SCHEMA IF NOT EXISTS __mj_BizAppsAccounting;
SET search_path TO __mj_BizAppsAccounting, public;

-- Ensure backslashes in string literals are treated literally (not as escape sequences)
SET standard_conforming_strings = on;

-- NOTE: Earlier converter versions made INTEGER to BOOLEAN cast implicit by
-- modifying the system catalog so SS-style INSERT INTO bool_col VALUES (1)
-- would work. That modification required pg_catalog write privileges, which
-- managed PG (RDS, Aurora, Cloud SQL, Azure) does not grant. As of v5.30 all
-- bulk INSERTs are emitted with native TRUE/FALSE values directly, so the
-- cast modification is no longer needed. Removed to support managed-PG
-- installs out of the box.


-- ===================== DDL: Tables, PKs, Indexes =====================

-- -----------------------------------------------------------------------------
-- 2. When a retry adopted the ERP's posting over a broken seal
-- -----------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting."JournalEntryBatch"
 ADD COLUMN IF NOT EXISTS "SealMismatchDetectedAt" TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntryBatch_CompanyID" ON __mj_BizAppsAccounting."JournalEntryBatch" ("CompanyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntryBatch_SummaryJournalEntryID" ON __mj_BizAppsAccounting."JournalEntryBatch" ("SummaryJournalEntryID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntryBatch_BatchedByUserID" ON __mj_BizAppsAccounting."JournalEntryBatch" ("BatchedByUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntryBatch_ApprovedByUserID" ON __mj_BizAppsAccounting."JournalEntryBatch" ("ApprovedByUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntryBatch_ApprovalTaskID" ON __mj_BizAppsAccounting."JournalEntryBatch" ("ApprovalTaskID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntryBatch_ArchivedByUserID" ON __mj_BizAppsAccounting."JournalEntryBatch" ("ArchivedByUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntryBatch_CancelledByUserID" ON __mj_BizAppsAccounting."JournalEntryBatch" ("CancelledByUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntryBatch_ERPNotPostedConfirm_c6068293" ON __mj_BizAppsAccounting."JournalEntryBatch" ("ERPNotPostedConfirmedByUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntryBatch_SentByUserID" ON __mj_BizAppsAccounting."JournalEntryBatch" ("SentByUserID");


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsAccounting';
  v_target_name CONSTANT TEXT := 'vwJournalEntryBatches';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsAccounting."vwJournalEntryBatches"
AS SELECT
    j.*,
    "MJCompany_CompanyID"."Name" AS "Company",
    "mjBizAppsAccountingJournalEntry_SummaryJournalEntryID"."EntryNumber" AS "SummaryJournalEntry",
    "MJUser_BatchedByUserID"."Name" AS "BatchedByUser",
    "MJUser_ApprovedByUserID"."Name" AS "ApprovedByUser",
    "mjBizAppsTasksTask_ApprovalTaskID"."Name" AS "ApprovalTask",
    "MJUser_ArchivedByUserID"."Name" AS "ArchivedByUser",
    "MJUser_CancelledByUserID"."Name" AS "CancelledByUser",
    "MJUser_ERPNotPostedConfirmedByUserID"."Name" AS "ERPNotPostedConfirmedByUser",
    "MJUser_SentByUserID"."Name" AS "SentByUser"
FROM
    __mj_BizAppsAccounting."JournalEntryBatch" AS j
INNER JOIN
    ${mjSchema}."Company" AS "MJCompany_CompanyID"
  ON
    j."CompanyID" = "MJCompany_CompanyID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsAccounting."JournalEntry" AS "mjBizAppsAccountingJournalEntry_SummaryJournalEntryID"
  ON
    j."SummaryJournalEntryID" = "mjBizAppsAccountingJournalEntry_SummaryJournalEntryID"."ID"
INNER JOIN
    ${mjSchema}."User" AS "MJUser_BatchedByUserID"
  ON
    j."BatchedByUserID" = "MJUser_BatchedByUserID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ApprovedByUserID"
  ON
    j."ApprovedByUserID" = "MJUser_ApprovedByUserID"."ID"
LEFT OUTER JOIN
    ${mjSchema}_BizAppsTasks."Task" AS "mjBizAppsTasksTask_ApprovalTaskID"
  ON
    j."ApprovalTaskID" = "mjBizAppsTasksTask_ApprovalTaskID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ArchivedByUserID"
  ON
    j."ArchivedByUserID" = "MJUser_ArchivedByUserID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_CancelledByUserID"
  ON
    j."CancelledByUserID" = "MJUser_CancelledByUserID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ERPNotPostedConfirmedByUserID"
  ON
    j."ERPNotPostedConfirmedByUserID" = "MJUser_ERPNotPostedConfirmedByUserID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_SentByUserID"
  ON
    j."SentByUserID" = "MJUser_SentByUserID"."ID"$vsql$;
  v_target_oid OID;
  v_dep RECORD;
  v_captured JSONB[] := ARRAY[]::JSONB[];
  v_n INTEGER;
BEGIN
  EXECUTE vsql;
EXCEPTION WHEN invalid_table_definition THEN
  -- Column list changed; need CASCADE. Preserve dependent views first.
  SELECT c.oid INTO v_target_oid
  FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = v_target_schema AND c.relname = v_target_name AND c.relkind = 'v';
  IF v_target_oid IS NOT NULL THEN
    FOR v_dep IN
      WITH RECURSIVE deps AS (
        SELECT c.oid, c.relname AS name, n.nspname AS schema, 1 AS depth
        FROM pg_rewrite r
        JOIN pg_depend d ON d.objid = r.oid
        JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE d.refobjid = v_target_oid AND d.deptype = 'n'
          AND c.oid <> v_target_oid AND c.relkind = 'v'
        UNION
        SELECT c.oid, c.relname, n.nspname, p.depth + 1
        FROM deps p
        JOIN pg_rewrite r ON TRUE
        JOIN pg_depend d ON d.objid = r.oid AND d.refobjid = p.oid
        JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relkind = 'v' AND c.oid <> p.oid
      )
      SELECT oid, name, schema, MAX(depth) AS max_depth,
             pg_catalog.pg_get_viewdef(oid, true) AS viewdef
      FROM deps GROUP BY oid, name, schema
      ORDER BY MAX(depth) ASC
    LOOP
      v_captured := v_captured || jsonb_build_object(
        'schema', v_dep.schema, 'name', v_dep.name, 'def', v_dep.viewdef);
    END LOOP;
  END IF;
  EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', v_target_schema, v_target_name);
  EXECUTE vsql;
  IF v_captured IS NOT NULL AND array_length(v_captured, 1) > 0 THEN
    FOR v_n IN 1..array_length(v_captured, 1) LOOP
      BEGIN
        EXECUTE format('CREATE VIEW %I.%I AS %s',
          v_captured[v_n]->>'schema', v_captured[v_n]->>'name', v_captured[v_n]->>'def');
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Could not restore dependent view %.%: %',
          v_captured[v_n]->>'schema', v_captured[v_n]->>'name', SQLERRM;
      END;
    END LOOP;
  END IF;
END;
$do$;


-- ===================== Stored Procedures (sp*) =====================

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spCreateJournalEntryBatch]
--     @ID UUID = NULL,
--     @JournalEntryBatchNumber VARCHAR(40),
--     @CompanyID UUID,
--     @PostingDate date...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spUpdateJournalEntryBatch]
--     @ID UUID,
--     @JournalEntryBatchNumber VARCHAR(40) = NULL,
--     @CompanyID UUID = NULL,
--     @PostingDa...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spDeleteJournalEntryBatch]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsAccounting].[JournalEntryBatch]
--     WH...


-- ===================== Triggers =====================

-- SKIPPED: trigger (auto-conversion not supported)
-- -- =============================================================================
-- Migration: V202610021230__v0.18.x__JournalEntryLineDimension_Immutability_SealMismatch.sql
-- Description: #216 — di

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsAccounting].trgUpdateJournalEntryBatch
ON "__mj_BizAppsAccounting"."JournalEntryBatch"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizAppsAccounting"


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '1a8d15cf-9bd7-4334-8e2b-9406143e3c49' OR ("EntityID" = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND "Name" = 'SealMismatchDetectedAt')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        '1a8d15cf-9bd7-4334-8e2b-9406143e3c49',
        '87AD37E9-62F9-4F0E-A15B-F64ADF009112', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entry" "Batches"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '87AD37E9-62F9-4F0E-A15B-F64ADF009112'),
        'SealMismatchDetectedAt',
        'Seal Mismatch Detected At',
        'When a retry of this Failed batch found its journal already in the ERP and recorded it Posted, with no second post, although the batch no longer matched its approved-content seal (a summary line''s dimension tags changed after approval). The local tags then differ from what the ERP holds; review them. NULL when the seal matched or the batch was never adopted this way.',
        'TIMESTAMPTZ',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;


-- ===================== Grants =====================

DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsAccounting."vwJournalEntryBatches" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsAccounting."vwJournalEntryBatches" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsAccounting."vwJournalEntryBatches" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_BizAppsAccounting."vwJournalEntryBatches" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Accounting: Journal Entry Batches */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entry Batches
-- Item: Permissions for vwJournalEntryBatches
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsAccounting."vwJournalEntryBatches" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsAccounting."vwJournalEntryBatches" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsAccounting."vwJournalEntryBatches" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_BizAppsAccounting."vwJournalEntryBatches" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate SQL for MJ_BizApps_Accounting: Journal Entry Batches */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entry Batches
-- Item: spCreateJournalEntryBatch
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR JournalEntryBatch
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateJournalEntryBatch" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateJournalEntryBatch" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateJournalEntryBatch" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Accounting: Journal Entry Batches */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateJournalEntryBatch" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateJournalEntryBatch" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateJournalEntryBatch" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spUpdate SQL for MJ_BizApps_Accounting: Journal Entry Batches */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entry Batches
-- Item: spUpdateJournalEntryBatch
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR JournalEntryBatch
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateJournalEntryBatch" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateJournalEntryBatch" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateJournalEntryBatch" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateJournalEntryBatch" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateJournalEntryBatch" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateJournalEntryBatch" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete SQL for MJ_BizApps_Accounting: Journal Entry Batches */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entry Batches
-- Item: spDeleteJournalEntryBatch
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR JournalEntryBatch
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteJournalEntryBatch" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteJournalEntryBatch" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteJournalEntryBatch" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Accounting: Journal Entry Batches */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteJournalEntryBatch" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteJournalEntryBatch" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteJournalEntryBatch" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to delete unneeded entity fields (1 scoped entities) */


-- ===================== Comments =====================

COMMENT ON COLUMN __mj_BizAppsAccounting."JournalEntryBatch"."SealMismatchDetectedAt" IS 'When a retry of this Failed batch found its journal already in the ERP and recorded it Posted, with no second post, although the batch no longer matched its approved-content seal (a summary line''s dimension tags changed after approval). The local tags then differ from what the ERP holds; review them. NULL when the seal matched or the batch was never adopted this way.';


-- ===================== Other =====================

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================


/* SQL text to update existing entities from schema */

/* spUpdate Permissions for MJ_BizApps_Accounting: Journal Entry Batches */
