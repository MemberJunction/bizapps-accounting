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


-- ===================== DDL: Tables, PKs, Indexes =====================

-- -----------------------------------------------------------------------------
-- 1. AccountingCompanyProfile.ERPJournalCode
-- -----------------------------------------------------------------------------
ALTER TABLE "__mj_BizAppsAccounting"."AccountingCompanyProfile"
 ADD COLUMN IF NOT EXISTS "ERPJournalCode" VARCHAR(50) NULL;

-- -----------------------------------------------------------------------------
-- 2. JournalEntryBatch.ERPPostUnconfirmedAt and immutability rule
-- -----------------------------------------------------------------------------
ALTER TABLE "__mj_BizAppsAccounting"."JournalEntryBatch"
 ADD COLUMN IF NOT EXISTS "ERPPostUnconfirmedAt" TIMESTAMPTZ NULL;

-- -----------------------------------------------------------------------------
-- 3. Filtered unique index on active IntercompanyAccountMatch rows
-- -----------------------------------------------------------------------------
CREATE UNIQUE  INDEX IF NOT EXISTS UX_IntercompanyAccountMatch_Active_Pair_Start
    ON "__mj_BizAppsAccounting"."IntercompanyAccountMatch" ("SourceCompanyID", "TargetCompanyID", "StartedAt")
    WHERE "Status" = 'Active';

-- -----------------------------------------------------------------------------
-- 4. TaxCategory lookup table and TaxRate.TaxCategory FK
-- -----------------------------------------------------------------------------
CREATE TABLE "__mj_BizAppsAccounting"."TaxCategory" (
 "Code" VARCHAR(50) NOT NULL,
 "Name" VARCHAR(100) NOT NULL,
 "Description" VARCHAR(500) NULL,
 "IsActive" BOOLEAN NOT NULL CONSTRAINT DF_TaxCategory_IsActive DEFAULT TRUE,
 "__mj_CreatedAt" TIMESTAMPTZ NOT NULL CONSTRAINT DF_TaxCategory___mj_CreatedAt DEFAULT NOW(),
 "__mj_UpdatedAt" TIMESTAMPTZ NOT NULL CONSTRAINT DF_TaxCategory___mj_UpdatedAt DEFAULT NOW(),
 CONSTRAINT PK_TaxCategory PRIMARY KEY ("Code"),
 CONSTRAINT CK_TaxCategory_Code CHECK ("Code" <> ''),
 CONSTRAINT CK_TaxCategory_Name CHECK ("Name" <> '')
);

ALTER TABLE "__mj_BizAppsAccounting"."TaxRate"
    DROP CONSTRAINT "CK_TaxRate_Category";

-- -----------------------------------------------------------------------------
-- 5. ExternalAccountingSystem catalog table and JournalEntryBatch.TargetSystem FK
-- -----------------------------------------------------------------------------
CREATE TABLE "__mj_BizAppsAccounting"."ExternalAccountingSystem" (
 "Code" VARCHAR(50) NOT NULL,
 "Name" VARCHAR(100) NOT NULL,
 "Description" VARCHAR(500) NULL,
 "IsDefault" BOOLEAN NOT NULL CONSTRAINT DF_ExternalAccountingSystem_IsDefault DEFAULT FALSE,
 "IsActive" BOOLEAN NOT NULL CONSTRAINT DF_ExternalAccountingSystem_IsActive DEFAULT TRUE,
 "__mj_CreatedAt" TIMESTAMPTZ NOT NULL CONSTRAINT DF_ExternalAccountingSystem___mj_CreatedAt DEFAULT NOW(),
 "__mj_UpdatedAt" TIMESTAMPTZ NOT NULL CONSTRAINT DF_ExternalAccountingSystem___mj_UpdatedAt DEFAULT NOW(),
 CONSTRAINT PK_ExternalAccountingSystem PRIMARY KEY ("Code"),
 CONSTRAINT CK_ExternalAccountingSystem_Code CHECK ("Code" <> ''),
 CONSTRAINT CK_ExternalAccountingSystem_Name CHECK ("Name" <> '')
);

CREATE UNIQUE  INDEX IF NOT EXISTS UX_ExternalAccountingSystem_SingleDefault
    ON "__mj_BizAppsAccounting"."ExternalAccountingSystem" ("IsDefault")
    WHERE "IsDefault" = TRUE;

ALTER TABLE "__mj_BizAppsAccounting"."JournalEntryBatch"
    DROP CONSTRAINT "CK_JournalEntryBatch_TargetSystem";

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_TaxRate_TaxCategory" ON "__mj_BizAppsAccounting"."TaxRate" ("TaxCategory");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntryBatch_TargetSystem" ON "__mj_BizAppsAccounting"."JournalEntryBatch" ("TargetSystem");


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsAccounting';
  v_target_name CONSTANT TEXT := 'vwAccountingCompanyProfiles';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles"
AS SELECT
    a.*,
    ${mjSchema}_isa_p1."Name",
    ${mjSchema}_isa_p1."Description",
    ${mjSchema}_isa_p1."Website",
    ${mjSchema}_isa_p1."LogoURL",
    ${mjSchema}_isa_p1."Domain",
    mjBizAppsAccountingCurrency_FunctionalCurrencyCode."Name" AS "FunctionalCurrencyCode_Virtual",
    mjBizAppsAccountingCurrency_ReportingCurrencyCode."Name" AS "ReportingCurrencyCode_Virtual",
    "MJUser_ApprovalCFOUserID"."Name" AS "ApprovalCFOUser",
    "MJRole_ManualJournalEntryApproverRoleID"."Name" AS "ManualJournalEntryApproverRole",
    ${mjSchema}_rgc."Latitude" AS "${mjSchema}_Latitude",
    ${mjSchema}_rgc."Longitude" AS "${mjSchema}_Longitude",
    hier_ParentAccountingCompanyID."RootID" AS "RootParentAccountingCompanyID",
    hier_ParentAccountingCompanyID."Depth" AS "ParentAccountingCompanyIDDepth",
    hier_ParentAccountingCompanyID."Path" AS "ParentAccountingCompanyIDPath",
    hier_ParentAccountingCompanyID."IsLeaf" AS "ParentAccountingCompanyIDIsLeaf",
    hier_ParentAccountingCompanyID."ChildCount" AS "ParentAccountingCompanyIDChildCount"
FROM
    "__mj_BizAppsAccounting"."AccountingCompanyProfile" AS a
INNER JOIN
    "${mjSchema}"."Company" AS ${mjSchema}_isa_p1
  ON
    a."ID" = ${mjSchema}_isa_p1."ID"
INNER JOIN
    "__mj_BizAppsAccounting"."Currency" AS "mjBizAppsAccountingCurrency_FunctionalCurrencyCode"
  ON
    a."FunctionalCurrencyCode" = mjBizAppsAccountingCurrency_FunctionalCurrencyCode."Code"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."Currency" AS "mjBizAppsAccountingCurrency_ReportingCurrencyCode"
  ON
    a."ReportingCurrencyCode" = mjBizAppsAccountingCurrency_ReportingCurrencyCode."Code"
LEFT OUTER JOIN
    "${mjSchema}"."User" AS "MJUser_ApprovalCFOUserID"
  ON
    a."ApprovalCFOUserID" = "MJUser_ApprovalCFOUserID"."ID"
LEFT OUTER JOIN
    "${mjSchema}"."Role" AS "MJRole_ManualJournalEntryApproverRoleID"
  ON
    a."ManualJournalEntryApproverRoleID" = "MJRole_ManualJournalEntryApproverRoleID"."ID"
LEFT OUTER JOIN
    "${mjSchema}"."vwRecordGeoCodes" AS ${mjSchema}_rgc
  ON
    ${mjSchema}_rgc."EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC'
    AND ${mjSchema}_rgc."RecordID" = CAST(a."ID" AS VARCHAR(450))
    AND ${mjSchema}_rgc."LocationType" = 'Primary'
LEFT JOIN LATERAL (SELECT * FROM "__mj_BizAppsAccounting"."fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta"(a."ID", a."ParentAccountingCompanyID")) AS "hier_ParentAccountingCompanyID"
    ON TRUE$vsql$;
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

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsAccounting';
  v_target_name CONSTANT TEXT := 'vwJournalEntryBatches';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_BizAppsAccounting"."vwJournalEntryBatches"
AS SELECT
    j.*,
    "MJCompany_CompanyID"."Name" AS "Company",
    mjBizAppsAccountingJournalEntry_SummaryJournalEntryID."EntryNumber" AS "SummaryJournalEntry",
    "MJUser_BatchedByUserID"."Name" AS "BatchedByUser",
    "MJUser_ApprovedByUserID"."Name" AS "ApprovedByUser",
    mjBizAppsTasksTask_ApprovalTaskID."Name" AS "ApprovalTask",
    "MJUser_ArchivedByUserID"."Name" AS "ArchivedByUser",
    "MJUser_CancelledByUserID"."Name" AS "CancelledByUser",
    "MJUser_ERPNotPostedConfirmedByUserID"."Name" AS "ERPNotPostedConfirmedByUser",
    "MJUser_SentByUserID"."Name" AS "SentByUser"
FROM
    "__mj_BizAppsAccounting"."JournalEntryBatch" AS j
INNER JOIN
    "${mjSchema}"."Company" AS "MJCompany_CompanyID"
  ON
    j."CompanyID" = "MJCompany_CompanyID"."ID"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."JournalEntry" AS "mjBizAppsAccountingJournalEntry_SummaryJournalEntryID"
  ON
    j."SummaryJournalEntryID" = mjBizAppsAccountingJournalEntry_SummaryJournalEntryID."ID"
INNER JOIN
    "${mjSchema}"."User" AS "MJUser_BatchedByUserID"
  ON
    j."BatchedByUserID" = "MJUser_BatchedByUserID"."ID"
LEFT OUTER JOIN
    "${mjSchema}"."User" AS "MJUser_ApprovedByUserID"
  ON
    j."ApprovedByUserID" = "MJUser_ApprovedByUserID"."ID"
LEFT OUTER JOIN
    "${mjSchema}_BizAppsTasks"."Task" AS "mjBizAppsTasksTask_ApprovalTaskID"
  ON
    j."ApprovalTaskID" = mjBizAppsTasksTask_ApprovalTaskID."ID"
LEFT OUTER JOIN
    "${mjSchema}"."User" AS "MJUser_ArchivedByUserID"
  ON
    j."ArchivedByUserID" = "MJUser_ArchivedByUserID"."ID"
LEFT OUTER JOIN
    "${mjSchema}"."User" AS "MJUser_CancelledByUserID"
  ON
    j."CancelledByUserID" = "MJUser_CancelledByUserID"."ID"
LEFT OUTER JOIN
    "${mjSchema}"."User" AS "MJUser_ERPNotPostedConfirmedByUserID"
  ON
    j."ERPNotPostedConfirmedByUserID" = "MJUser_ERPNotPostedConfirmedByUserID"."ID"
LEFT OUTER JOIN
    "${mjSchema}"."User" AS "MJUser_SentByUserID"
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

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsAccounting';
  v_target_name CONSTANT TEXT := 'vwTaxCategories';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_BizAppsAccounting"."vwTaxCategories"
AS SELECT
    t.*
FROM
    "__mj_BizAppsAccounting"."TaxCategory" AS t$vsql$;
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

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsAccounting';
  v_target_name CONSTANT TEXT := 'vwExternalAccountingSystems';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_BizAppsAccounting"."vwExternalAccountingSystems"
AS SELECT
    e.*
FROM
    "__mj_BizAppsAccounting"."ExternalAccountingSystem" AS e$vsql$;
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
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spCreateAccountingCompanyProfile]
--     @ID UUID = NULL,
--     @EntityType VARCHAR(30) = NULL,
--     @LegalStructureType_Clear bit = 0,
--     @LegalStru...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spUpdateAccountingCompanyProfile]
--     @ID UUID,
--     @EntityType VARCHAR(30) = NULL,
--     @LegalStructureType_Clear bit = 0,
--     @LegalStructureTy...

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
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spCreateTaxCategory]
--     @Code VARCHAR(50),
--     @Name VARCHAR(100),
--     @Description_Clear bit = 0,
--     @Description VARCHAR(500) = NULL,
--     @IsActive bi...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spUpdateTaxCategory]
--     @Code VARCHAR(50),
--     @Name VARCHAR(100) = NULL,
--     @Description_Clear bit = 0,
--     @Description VARCHAR(500) = NULL,
--     @IsAc...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spDeleteTaxCategory]
--     @Code VARCHAR(50)
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     DELETE FROM [__mj_BizAppsAccounting].[TaxCategory]
--     WHERE [Code] = @Code
-- 
--    ...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spCreateExternalAccountingSystem]
--     @Code VARCHAR(50),
--     @Name VARCHAR(100),
--     @Description_Clear bit = 0,
--     @Description VARCHAR(500) = NULL,
--    ...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spUpdateExternalAccountingSystem]
--     @Code VARCHAR(50),
--     @Name VARCHAR(100) = NULL,
--     @Description_Clear bit = 0,
--     @Description VARCHAR(500) = NU...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spDeleteExternalAccountingSystem]
--     @Code VARCHAR(50)
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     DELETE FROM [__mj_BizAppsAccounting].[ExternalAccountingSystem]
--    ...


-- ===================== Triggers =====================

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsAccounting].trgUpdateTaxCategory
ON "__mj_BizAppsAccounting"."TaxCategory"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizAppsAccounting"."TaxCategor

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsAccounting".trgUpdateExternalAccountingSystem
ON "__mj_BizAppsAccounting"."ExternalAccountingSystem"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [__mj_BizA


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

INSERT INTO "__mj_BizAppsAccounting"."TaxCategory" ("Code", "Name", "Description", "IsActive")
VALUES
    ('Standard',     'Standard',      'Default taxable rate for general goods and services',                        1),
    ('Reduced',      'Reduced',       'Lower statutory rate for qualifying goods or services',                      1),
    ('Zero',         'Zero',          'Taxable at 0% (input tax credit eligible where applicable)',                 1),
    ('Exempt',       'Exempt',        'Statutory tax exemption (no tax charged)',                                   1),
    ('Custom',       'Custom',        'Custom or special-purpose tax rate category',                                1),
    ('OutOfScope',   'Out of Scope',  'Outside the scope of the tax regime',                                        1),
    ('Publications', 'Publications',  'Books, periodicals, and qualifying printed/digital publications',            1),
    ('Groceries',    'Groceries',     'Food and grocery items for home consumption',                                1),
    ('DigitalGoods', 'Digital Goods', 'Electronically supplied services, SaaS, and digital downloads',              1);

INSERT INTO "__mj_BizAppsAccounting"."ExternalAccountingSystem" ("Code", "Name", "Description", "IsDefault", "IsActive")
VALUES
    ('BusinessCentral', 'Microsoft Dynamics 365 Business Central', 'Microsoft Dynamics 365 Business Central cloud or on-premises ERP', 1, 1),
    ('QuickBooks',      'Intuit QuickBooks',                       'QuickBooks Online or QuickBooks Desktop',                          0, 1),
    ('NetSuite',        'Oracle NetSuite',                         'Oracle NetSuite ERP',                                              0, 1),
    ('Sage',            'Sage Intacct / Sage ERP',                 'Sage Intacct or Sage 100/300/X3 ERP',                              0, 1),
    ('Xero',            'Xero',                                    'Xero cloud accounting platform',                                   0, 1),
    ('Other',           'Other / Custom',                          'Other or custom external accounting system',                       0, 1);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."Entity" WHERE "ID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' OR "Name" = 'MJ_BizApps_Accounting: Tax Categories'
    ) THEN
        INSERT INTO "${mjSchema}"."Entity" (
        "ID",
        "Name",
        "DisplayName",
        "Description",
        "NameSuffix",
        "BaseTable",
        "BaseView",
        "SchemaName",
        "IncludeInAPI",
        "AllowUserSearchAPI",
        "AllowCaching",
        "TrackRecordChanges",
        "AuditRecordAccess",
        "AuditViewRuns",
        "AllowAllRowsAPI",
        "AllowCreateAPI",
        "AllowUpdateAPI",
        "AllowDeleteAPI",
        "UserViewMaxRows",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES (
        'a41908f2-7d3e-4b91-9e12-6c8f3b219044',
        'MJ_BizApps_Accounting: Tax Categories',
        'Tax Categories',
        'Lookup table of tax rate categories referenced by TaxRate.TaxCategory.',
        NULL,
        'TaxCategory',
        'vwTaxCategories',
        '__mj_BizAppsAccounting',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."ApplicationEntity" WHERE "ApplicationID" = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D' AND "EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'
    ) THEN
        INSERT INTO "${mjSchema}"."ApplicationEntity"
        ("ApplicationID", "EntityID", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES
        ('E609083D-D3E2-44AD-9DF3-CB833BEF381D', 'a41908f2-7d3e-4b91-9e12-6c8f3b219044', (SELECT COALESCE(MAX("Sequence"),0)+1 FROM "${mjSchema}"."ApplicationEntity" WHERE "ApplicationID" = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D'), NOW(), NOW());
    END IF;
END $$;

INSERT INTO "${mjSchema}"."EntityPermission"
   ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
SELECT CAST('a41908f2-7d3e-4b91-9e12-6c8f3b219044' AS UUID), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 0, 0, 0, NOW(), NOW()
WHERE NOT EXISTS (
   SELECT 1 FROM "${mjSchema}"."EntityPermission"
   WHERE "EntityID" = CAST('a41908f2-7d3e-4b91-9e12-6c8f3b219044' AS UUID) AND "RoleID" = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
);

INSERT INTO "${mjSchema}"."EntityPermission"
   ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
SELECT CAST('a41908f2-7d3e-4b91-9e12-6c8f3b219044' AS UUID), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 1, 1, 1, NOW(), NOW()
WHERE NOT EXISTS (
   SELECT 1 FROM "${mjSchema}"."EntityPermission"
   WHERE "EntityID" = CAST('a41908f2-7d3e-4b91-9e12-6c8f3b219044' AS UUID) AND "RoleID" = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
);

INSERT INTO "${mjSchema}"."EntityPermission"
   ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
SELECT CAST('a41908f2-7d3e-4b91-9e12-6c8f3b219044' AS UUID), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 1, 1, 1, NOW(), NOW()
WHERE NOT EXISTS (
   SELECT 1 FROM "${mjSchema}"."EntityPermission"
   WHERE "EntityID" = CAST('a41908f2-7d3e-4b91-9e12-6c8f3b219044' AS UUID) AND "RoleID" = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
);

/* SQL generated to create new entity MJ_BizApps_Accounting: External Accounting Systems */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."Entity" WHERE "ID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' OR "Name" = 'MJ_BizApps_Accounting: External Accounting Systems'
    ) THEN
        INSERT INTO "${mjSchema}"."Entity" (
        "ID",
        "Name",
        "DisplayName",
        "Description",
        "NameSuffix",
        "BaseTable",
        "BaseView",
        "SchemaName",
        "IncludeInAPI",
        "AllowUserSearchAPI",
        "AllowCaching",
        "TrackRecordChanges",
        "AuditRecordAccess",
        "AuditViewRuns",
        "AllowAllRowsAPI",
        "AllowCreateAPI",
        "AllowUpdateAPI",
        "AllowDeleteAPI",
        "UserViewMaxRows",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES (
        'b82917e3-8c4f-4a82-8f23-7d9e4c328155',
        'MJ_BizApps_Accounting: External Accounting Systems',
        'External Accounting Systems',
        'Catalog of external accounting / ERP systems targeted by GLAccount.ExternalSystem and JournalEntryBatch.TargetSystem.',
        NULL,
        'ExternalAccountingSystem',
        'vwExternalAccountingSystems',
        '__mj_BizAppsAccounting',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."ApplicationEntity" WHERE "ApplicationID" = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D' AND "EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'
    ) THEN
        INSERT INTO "${mjSchema}"."ApplicationEntity"
        ("ApplicationID", "EntityID", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES
        ('E609083D-D3E2-44AD-9DF3-CB833BEF381D', 'b82917e3-8c4f-4a82-8f23-7d9e4c328155', (SELECT COALESCE(MAX("Sequence"),0)+1 FROM "${mjSchema}"."ApplicationEntity" WHERE "ApplicationID" = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D'), NOW(), NOW());
    END IF;
END $$;

INSERT INTO "${mjSchema}"."EntityPermission"
   ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
SELECT CAST('b82917e3-8c4f-4a82-8f23-7d9e4c328155' AS UUID), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 0, 0, 0, NOW(), NOW()
WHERE NOT EXISTS (
   SELECT 1 FROM "${mjSchema}"."EntityPermission"
   WHERE "EntityID" = CAST('b82917e3-8c4f-4a82-8f23-7d9e4c328155' AS UUID) AND "RoleID" = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
);

INSERT INTO "${mjSchema}"."EntityPermission"
   ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
SELECT CAST('b82917e3-8c4f-4a82-8f23-7d9e4c328155' AS UUID), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 1, 1, 1, NOW(), NOW()
WHERE NOT EXISTS (
   SELECT 1 FROM "${mjSchema}"."EntityPermission"
   WHERE "EntityID" = CAST('b82917e3-8c4f-4a82-8f23-7d9e4c328155' AS UUID) AND "RoleID" = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
);

INSERT INTO "${mjSchema}"."EntityPermission"
   ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
SELECT CAST('b82917e3-8c4f-4a82-8f23-7d9e4c328155' AS UUID), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 1, 1, 1, NOW(), NOW()
WHERE NOT EXISTS (
   SELECT 1 FROM "${mjSchema}"."EntityPermission"
   WHERE "EntityID" = CAST('b82917e3-8c4f-4a82-8f23-7d9e4c328155' AS UUID) AND "RoleID" = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
);

/* SQL text to update existing entities from schema */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'b41f92a3-8c4e-4b71-9a12-7e3f5c812091' OR ("EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND "Name" = 'ERPJournalCode')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'b41f92a3-8c4e-4b71-9a12-7e3f5c812091',
        '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Company" "Profiles"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC'),
        'ERPJournalCode',
        'ERP Journal Code',
        'The ERP general journal batch or template code used when posting journal entry batches for this company (e.g. Business Central journal batch code). NULL uses the ERP provider''s default (such as DEFAULT in Business Central).',
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'c72e83b4-9d5f-4c82-8b23-6f4e7d923102' OR ("EntityID" = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND "Name" = 'ERPPostUnconfirmedAt')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'c72e83b4-9d5f-4c82-8b23-6f4e7d923102',
        '87AD37E9-62F9-4F0E-A15B-F64ADF009112', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entry" "Batches"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = '87AD37E9-62F9-4F0E-A15B-F64ADF009112'),
        'ERPPostUnconfirmedAt',
        'ERP Post Unconfirmed At',
        'When an ERP send failed after the HTTP post was dispatched or during post-send confirmation, so the batch may already be posted in the ERP. Blocks retry until a subsequent lookup confirms the ERP state, or the batch is cancelled with an ERP check or archived.',
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9001' OR ("EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND "Name" = 'Code')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9001',
        'a41908f2-7d3e-4b91-9e12-6c8f3b219044', -- "Entity": "MJ_BizApps_Accounting": "Tax" "Categories"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'),
        'Code',
        'Code',
        'Stable machine code (primary key) for the tax category.',
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9002' OR ("EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND "Name" = 'Name')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9002',
        'a41908f2-7d3e-4b91-9e12-6c8f3b219044', -- "Entity": "MJ_BizApps_Accounting": "Tax" "Categories"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'),
        'Name',
        'Name',
        'Human-readable display name for the tax category.',
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9003' OR ("EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND "Name" = 'Description')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9003',
        'a41908f2-7d3e-4b91-9e12-6c8f3b219044', -- "Entity": "MJ_BizApps_Accounting": "Tax" "Categories"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'),
        'Description',
        'Description',
        'Guidance on which goods or services qualify for this tax category.',
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9004' OR ("EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND "Name" = 'IsActive')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9004',
        'a41908f2-7d3e-4b91-9e12-6c8f3b219044', -- "Entity": "MJ_BizApps_Accounting": "Tax" "Categories"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'),
        'IsActive',
        'Is Active',
        'Whether this tax category is active for new tax rate definitions.',
        'BOOLEAN',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9005' OR ("EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND "Name" = '__mj_CreatedAt')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9005',
        'a41908f2-7d3e-4b91-9e12-6c8f3b219044', -- "Entity": "MJ_BizApps_Accounting": "Tax" "Categories"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'),
        '__mj_CreatedAt',
        'Created At',
        NULL,
        'TIMESTAMPTZ',
        10,
        34,
        7,
        0,
        'NOW()',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9006' OR ("EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND "Name" = '__mj_UpdatedAt')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'd11a08f2-1a2b-4c3d-8e4f-5a6b7c8d9006',
        'a41908f2-7d3e-4b91-9e12-6c8f3b219044', -- "Entity": "MJ_BizApps_Accounting": "Tax" "Categories"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044'),
        '__mj_UpdatedAt',
        'Updated At',
        NULL,
        'TIMESTAMPTZ',
        10,
        34,
        7,
        0,
        'NOW()',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0001' OR ("EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND "Name" = 'Code')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0001',
        'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- "Entity": "MJ_BizApps_Accounting": "External" "Accounting" "Systems"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
        'Code',
        'Code',
        'Stable machine code (primary key) for the external accounting system.',
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0002' OR ("EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND "Name" = 'Name')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0002',
        'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- "Entity": "MJ_BizApps_Accounting": "External" "Accounting" "Systems"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
        'Name',
        'Name',
        'Human-readable display name for the external accounting system.',
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0003' OR ("EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND "Name" = 'Description')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0003',
        'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- "Entity": "MJ_BizApps_Accounting": "External" "Accounting" "Systems"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
        'Description',
        'Description',
        'Details about the external accounting system integration.',
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0004' OR ("EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND "Name" = 'IsDefault')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0004',
        'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- "Entity": "MJ_BizApps_Accounting": "External" "Accounting" "Systems"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
        'IsDefault',
        'Is Default',
        'Whether this system is the default target when an account has no explicit ExternalSystem set. At most one row may have IsDefault = 1.',
        'BOOLEAN',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0005' OR ("EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND "Name" = 'IsActive')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0005',
        'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- "Entity": "MJ_BizApps_Accounting": "External" "Accounting" "Systems"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
        'IsActive',
        'Is Active',
        'Whether this external accounting system is active.',
        'BOOLEAN',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0006' OR ("EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND "Name" = '__mj_CreatedAt')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0006',
        'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- "Entity": "MJ_BizApps_Accounting": "External" "Accounting" "Systems"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
        '__mj_CreatedAt',
        'Created At',
        NULL,
        'TIMESTAMPTZ',
        10,
        34,
        7,
        0,
        'NOW()',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityField" WHERE "ID" = 'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0007' OR ("EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND "Name" = '__mj_UpdatedAt')
    ) THEN
        INSERT INTO "${mjSchema}"."EntityField"
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
        'e22b19e3-2b3c-4d4e-9f5a-6b7c8d9e0007',
        'b82917e3-8c4f-4a82-8f23-7d9e4c328155', -- "Entity": "MJ_BizApps_Accounting": "External" "Accounting" "Systems"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "${mjSchema}"."EntityField" WHERE "EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155'),
        '__mj_UpdatedAt',
        'Updated At',
        NULL,
        'TIMESTAMPTZ',
        10,
        34,
        7,
        0,
        'NOW()',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

UPDATE "${mjSchema}"."EntityField"
SET
   "RelatedEntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044',
   "RelatedEntityFieldName" = 'Code',
   "ValueListType" = 'None',
   "Description" = 'Tax category code referencing TaxCategory.Code (e.g. Standard, Reduced, Zero, Exempt, OutOfScope, Publications, Groceries, DigitalGoods).'
WHERE "ID" = 'c5cfa93d-203a-4776-a37a-8af2099038f1';

/* Create Entity Relationship: MJ_BizApps_Accounting: Tax Categories -> MJ_BizApps_Accounting: Tax Rates (One To Many via TaxCategory) */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "${mjSchema}"."EntityRelationship" WHERE "ID" = 'f33c20f4-3c4d-4e5f-8a6b-7c8d9e0f1001'
    ) THEN
        INSERT INTO "${mjSchema}"."EntityRelationship"
        ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES
        ('f33c20f4-3c4d-4e5f-8a6b-7c8d9e0f1001', 'a41908f2-7d3e-4b91-9e12-6c8f3b219044', 'C0D334F3-8491-4EDC-833F-F53F2605C9BA', 'TaxCategory', 'One To Many', 1, 1, 1, NOW(), NOW());
    END IF;
END $$;

UPDATE "${mjSchema}"."EntityField"
SET "Description" = 'Label derived from Status for anomaly models: Voided for Voided entries, Reversed when another entry points at this one as ReversedFromJournalEntryID, Normal for Posted entries with no reversal, NULL while Draft/Submitted/PendingApproval/Approved/Rejected.'
WHERE "ID" = '71836c90-010c-4f03-a0f2-abe0e37eda3d';

UPDATE "${mjSchema}"."EntityField"
SET "Description" = 'Sum of FunctionalDebitAmount across all JournalEntryLine rows on this entry, in the company functional currency. Zero when the entry has no lines.'
WHERE "ID" = 'b55285d4-5dd5-42e4-8395-013e87ee0ecb';

UPDATE "${mjSchema}"."EntityField"
SET "Description" = 'Total number of JournalEntryLine rows attached to this entry.'
WHERE "ID" = '2bee0bbb-bc51-4fcf-9a48-45d9e25e8734';

UPDATE "${mjSchema}"."EntityField"
SET "Description" = 'Calendar month of EffectiveDate (1 = January through 12 = December), exposed for seasonal anomaly features.'
WHERE "ID" = '0be539d7-f9ae-4ca6-b18b-9fe77f456617';

UPDATE "${mjSchema}"."EntityField"
SET "Description" = 'ISO day-of-week of EffectiveDate (1 = Monday through 7 = Sunday), independent of session DATEFIRST.'
WHERE "ID" = 'e404e4ba-43e1-4d79-ae84-0a7c00f19f3c';

UPDATE "${mjSchema}"."EntityField"
SET "Description" = 'True when EffectiveDate falls on Saturday or Sunday (ISO day-of-week 6 or 7).'
WHERE "ID" = 'dda19850-854f-4d3b-ac92-1341b56e1990';

UPDATE "${mjSchema}"."EntityField"
SET "Description" = 'True when LinkedEntityID and LinkedRecordID are both populated, indicating the entry originated from a source business document rather than a standalone manual journal.'
WHERE "ID" = '059438ff-3c74-4ab3-82ac-b08de48ef205';

UPDATE "${mjSchema}"."EntityField"
SET "Description" = 'True when FileID is populated (supporting attachment present on the entry header).'
WHERE "ID" = '3388c921-27ff-42dd-b308-65e4577df0fe';

/* Update EntityField Category metadata for new fields */

UPDATE "${mjSchema}"."EntityField" SET "Category" = 'Accounting Policy' WHERE "ID" = 'b41f92a3-8c4e-4b71-9a12-7e3f5c812091';

UPDATE "${mjSchema}"."EntityField" SET "Category" = 'ERP Dispatch' WHERE "ID" = 'c72e83b4-9d5f-4c82-8b23-6f4e7d923102';

UPDATE "${mjSchema}"."EntityField" SET "Category" = 'Tax Category Details' WHERE "EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND "Name" IN ('Code', 'Name', 'Description', 'IsActive');

UPDATE "${mjSchema}"."EntityField" SET "Category" = 'System Metadata' WHERE "EntityID" = 'a41908f2-7d3e-4b91-9e12-6c8f3b219044' AND "Name" IN ('__mj_CreatedAt', '__mj_UpdatedAt');

UPDATE "${mjSchema}"."EntityField" SET "Category" = 'External System Details' WHERE "EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND "Name" IN ('Code', 'Name', 'Description', 'IsDefault', 'IsActive');

UPDATE "${mjSchema}"."EntityField" SET "Category" = 'System Metadata' WHERE "EntityID" = 'b82917e3-8c4f-4a82-8f23-7d9e4c328155' AND "Name" IN ('__mj_CreatedAt', '__mj_UpdatedAt');

/* Update Run ERP Sync Action description (#423) and JournalEntryBatch EntityAction ActionFilter (#394) */

UPDATE "${mjSchema}"."Action"
SET "Description" = 'Pulls chart of accounts, dimensions, and dimension values from every credentialed Company Integration via AccountingERPEngine.SyncMasterData. When all three objects are requested for a connector-wired integration with active entity maps, delegates to MJ IntegrationEngine.RunSync; otherwise (subset Objects filter or custom provider) falls back to the direct BaseAccountingERPProvider pull. One job, all companies. Hosts disable the scheduled job rather than deleting this action.'
WHERE "ID" = 'A839FB12-5813-4B85-8022-DF8943729BA2';

UPDATE "${mjSchema}"."EntityAction"
SET "ActionFilter" = 'DidFieldChangeToValue(''Status'',''Sent'')'
WHERE "ID" = '5C44B19D-8CE3-489D-A354-507A3B67A1C9';

/* SQL text to update existing entity fields from schema */


-- ===================== FK & CHECK Constraints =====================


-- Flush any pending deferred trigger events from prior DML so DDL below can proceed.
SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE "__mj_BizAppsAccounting"."TaxRate"
 ADD CONSTRAINT "FK_TaxRate_TaxCategory"
    FOREIGN KEY ("TaxCategory") REFERENCES "__mj_BizAppsAccounting"."TaxCategory"("Code") DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "__mj_BizAppsAccounting"."JournalEntryBatch"
 ADD CONSTRAINT "FK_JournalEntryBatch_TargetSystem"
    FOREIGN KEY ("TargetSystem") REFERENCES "__mj_BizAppsAccounting"."ExternalAccountingSystem"("Code") DEFERRABLE INITIALLY DEFERRED;


-- ===================== Grants =====================

DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate SQL for MJ_BizApps_Accounting: Accounting Company Profiles */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spUpdate SQL for MJ_BizApps_Accounting: Accounting Company Profiles */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwJournalEntryBatches" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwJournalEntryBatches" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwJournalEntryBatches" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON "__mj_BizAppsAccounting"."vwJournalEntryBatches" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate SQL for MJ_BizApps_Accounting: Journal Entry Batches */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntryBatch" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntryBatch" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntryBatch" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spUpdate SQL for MJ_BizApps_Accounting: Journal Entry Batches */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntryBatch" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntryBatch" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntryBatch" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON "__mj_BizAppsAccounting"."vwTaxCategories" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateTaxCategory" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateTaxCategory" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteTaxCategory" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View and CRUD Procedures for MJ_BizApps_Accounting: External Accounting Systems */

DO $$ BEGIN GRANT SELECT ON "__mj_BizAppsAccounting"."vwExternalAccountingSystems" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateExternalAccountingSystem" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateExternalAccountingSystem" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteExternalAccountingSystem" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
-- ===================== Comments =====================

COMMENT ON COLUMN "__mj_BizAppsAccounting"."AccountingCompanyProfile"."ERPJournalCode" IS 'The ERP general journal batch or template code used when posting journal entry batches for this company (e.g. Business Central journal batch code). NULL uses the ERP provider''s default (such as DEFAULT in Business Central).';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."JournalEntryBatch"."ERPPostUnconfirmedAt" IS 'When an ERP send failed after the HTTP post was dispatched or during post-send confirmation, so the batch may already be posted in the ERP. Blocks retry until a subsequent lookup confirms the ERP state, or the batch is cancelled with an ERP check or archived.';

COMMENT ON TABLE "__mj_BizAppsAccounting"."TaxCategory" IS 'Lookup table of tax rate categories referenced by TaxRate.TaxCategory.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."TaxCategory"."Code" IS 'Stable machine code (primary key) for the tax category.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."TaxCategory"."Name" IS 'Human-readable display name for the tax category.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."TaxCategory"."Description" IS 'Guidance on which goods or services qualify for this tax category.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."TaxCategory"."IsActive" IS 'Whether this tax category is active for new tax rate definitions.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."TaxRate"."TaxCategory" IS 'Tax category code referencing TaxCategory.Code (e.g. Standard, Reduced, Zero, Exempt, OutOfScope, Publications, Groceries, DigitalGoods).';

COMMENT ON TABLE "__mj_BizAppsAccounting"."ExternalAccountingSystem" IS 'Catalog of external accounting / ERP systems targeted by GLAccount.ExternalSystem and JournalEntryBatch.TargetSystem.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."ExternalAccountingSystem"."Code" IS 'Stable machine code (primary key) for the external accounting system.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."ExternalAccountingSystem"."Name" IS 'Human-readable display name for the external accounting system.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."ExternalAccountingSystem"."Description" IS 'Details about the external accounting system integration.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."ExternalAccountingSystem"."IsDefault" IS 'Whether this system is the default target when an account has no explicit ExternalSystem set. At most one row may have IsDefault = 1.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."ExternalAccountingSystem"."IsActive" IS 'Whether this external accounting system is active.';


-- ===================== Other =====================

-- NOTE: unrecognized batch type (UNKNOWN) — passed through as-is
CREATE OR ALTER TRIGGER "__mj_BizAppsAccounting".trg_JournalEntryBatch_Immutability
ON "__mj_BizAppsAccounting"."JournalEntryBatch"
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
    -- SKIPPED: SQL Server IF EXISTS check

    -- AUDIT: the cancel audit and the ERP check are written only by the update that cancels the
    -- batch, so no other save can stamp a "not posted in the ERP" record on it; and SentAt, once set,
    -- is never cleared, because it is the evidence CK_JournalEntryBatch_CancelERPCheck keys on. A
    -- retry re-stamps SentAt with a new time, which is allowed.
    -- SKIPPED: SQL Server IF EXISTS check

    -- CONTENT: frozen from approval on, Failed and Cancelled included. The timestamps this migration
    -- freezes compare at millisecond precision: every entity save writes each column back through a
    -- JavaScript Date, so a value written by SQL with sub-millisecond digits would otherwise read as
    -- changed on the next ordinary save.
    -- SKIPPED: SQL Server IF EXISTS check

    -- SEAL MISMATCH: SealMismatchDetectedAt is written only by the update that records a
    -- retried batch Posted from the ERP, and once set it never changes or clears.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN deleted d ON d."ID" = i."ID"
        WHERE (d."ID" IS NULL AND i."SealMismatchDetectedAt" IS NOT NULL)
           OR (
               d."SealMismatchDetectedAt" IS NOT NULL
               AND (i."SealMismatchDetectedAt" IS NULL OR ABS(DATEDIFF_BIG(MICROSECOND, i."SealMismatchDetectedAt", d."SealMismatchDetectedAt")) >= 1000)
           )
           OR (
               d."ID" IS NOT NULL
               AND d."SealMismatchDetectedAt" IS NULL
               AND i."SealMismatchDetectedAt" IS NOT NULL
               AND NOT (d."Status" = 'Sent' AND i."Status" = 'Posted' AND i."SendAttemptCount" > 1)
           )
    )
        THROW 50034, 'JournalEntryBatch SealMismatchDetectedAt refused. It is set only by the update that records a retried batch Posted (Sent -> Posted, SendAttemptCount above 1), and once set it is never changed or cleared.', 1;

    -- ERP POST UNCONFIRMED: ERPPostUnconfirmedAt is written only when a Sent batch fails
    -- (Sent -> Failed), cleared only when a Failed batch is re-sent or cancelled, and never
    -- changed in any other update or carried on insert.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN deleted d ON d."ID" = i."ID"
        WHERE (d."ID" IS NULL AND i."ERPPostUnconfirmedAt" IS NOT NULL)
           OR (
               d."ID" IS NOT NULL
               AND d."ERPPostUnconfirmedAt" IS NULL
               AND i."ERPPostUnconfirmedAt" IS NOT NULL
               AND NOT (d."Status" = 'Sent' AND i."Status" = 'Failed')
           )
           OR (
               d."ID" IS NOT NULL
               AND d."ERPPostUnconfirmedAt" IS NOT NULL
               AND i."ERPPostUnconfirmedAt" IS NULL
               AND NOT (d."Status" = 'Failed' AND i."Status" IN ('Sent', 'Cancelled'))
           )
           OR (
               d."ID" IS NOT NULL
               AND d."ERPPostUnconfirmedAt" IS NOT NULL
               AND i."ERPPostUnconfirmedAt" IS NOT NULL
               AND ABS(DATEDIFF_BIG(MICROSECOND, i."ERPPostUnconfirmedAt", d."ERPPostUnconfirmedAt")) >= 1000
               AND NOT (d."Status" = 'Sent' AND i."Status" = 'Failed')
           )
    )
        THROW 50040, 'JournalEntryBatch ERPPostUnconfirmedAt refused. It is set only when a Sent batch fails (Sent -> Failed), cleared only when a Failed batch is re-sent or cancelled, and never modified otherwise.', 1;
END;

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL generated to create new entity MJ_BizApps_Accounting: Tax Categories */
