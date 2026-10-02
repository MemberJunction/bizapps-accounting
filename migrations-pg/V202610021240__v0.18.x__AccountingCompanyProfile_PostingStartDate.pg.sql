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

-- =============================================================================
-- Migration: V202610021240__v0.18.x__AccountingCompanyProfile_PostingStartDate.sql
-- Description: a per-company posting start date. Journal entries dated before
--              it never enter a posting batch.
-- =============================================================================
--
-- WHY
--
-- A company can hold Pending journal entries that must never be posted to the
-- ERP: entries dated before the company began posting from this ledger, e.g.
-- history brought in at cutover that the ERP already holds. The batch
-- candidate pool is every Pending entry, so a sweep with no lower bound would
-- batch them. The per-call startDate option bounds one run; nothing bounded
-- every run for a company.
--
-- WHAT CHANGES
--
-- AccountingCompanyProfile.PostingStartDate (DATE, nullable). The batch
-- engine's candidate filter excludes an entry whose EffectiveDate is before its
-- own company's PostingStartDate, on every build, preview and scheduled sweep.
-- NULL means no floor. Existing profiles read NULL, so nothing changes until a
-- date is set.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================

ALTER TABLE __mj_BizAppsAccounting."AccountingCompanyProfile"
 ADD COLUMN IF NOT EXISTS "PostingStartDate" DATE NULL;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_FunctionalCu_98e9c0ae" ON __mj_BizAppsAccounting."AccountingCompanyProfile" ("FunctionalCurrencyCode");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ReportingCurrencyCode" ON __mj_BizAppsAccounting."AccountingCompanyProfile" ("ReportingCurrencyCode");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ParentAccoun_010bb056" ON __mj_BizAppsAccounting."AccountingCompanyProfile" ("ParentAccountingCompanyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ApprovalCFOUserID" ON __mj_BizAppsAccounting."AccountingCompanyProfile" ("ApprovalCFOUserID");


-- ===================== Helper Functions (fn*) =====================

CREATE FUNCTION __mj_BizAppsAccounting."fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta"
(
    p_RecordID UUID,
    p_ParentID UUID
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Ancestors AS (
        SELECT
            "ID",
            "ParentAccountingCompanyID",
            0 AS "Depth",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            __mj_BizAppsAccounting."AccountingCompanyProfile"
        WHERE
            "ID" = p_RecordID

        UNION ALL

        SELECT
            p."ID",
            p."ParentAccountingCompanyID",
            c."Depth" + 1 AS "Depth",
            CAST('/' || CAST(p."ID" AS VARCHAR(36)) || c."Path" AS TEXT) AS "Path"
        FROM
            __mj_BizAppsAccounting."AccountingCompanyProfile" p
        INNER JOIN
            CTE_Ancestors c ON p."ID" = c."ParentAccountingCompanyID"
        WHERE
            c."Depth" < 100
    )
    SELECT         a."ID" AS "RootID",
        (SELECT MAX("Depth") FROM CTE_Ancestors) AS "Depth",
        (SELECT "Path" FROM CTE_Ancestors ORDER BY "Depth" DESC
LIMIT 1) AS "Path",
        CAST(CASE WHEN EXISTS (SELECT 1 FROM __mj_BizAppsAccounting."AccountingCompanyProfile" WHERE "ParentAccountingCompanyID" = p_RecordID) THEN 0 ELSE 1 END AS BOOLEAN) AS "IsLeaf",
        (SELECT COUNT(1) FROM __mj_BizAppsAccounting."AccountingCompanyProfile" WHERE "ParentAccountingCompanyID" = p_RecordID) AS "ChildCount"
    FROM
        CTE_Ancestors a
    WHERE
        a."ParentAccountingCompanyID" IS NULL OR p_ParentID IS NULL
    ORDER BY
        a."Depth" DESC

LIMIT 1);

CREATE FUNCTION __mj_BizAppsAccounting."fnAccountingCompanyProfileParentAccountingCompanyID_GetDescendants"
(
    p_RootID UUID,
    p_MaxDepth INTEGER = NULL
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Descendants AS (
        SELECT
            "ID",
            "ParentAccountingCompanyID",
            0 AS "RelativeDepth",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            __mj_BizAppsAccounting."AccountingCompanyProfile"
        WHERE
            "ID" = p_RootID

        UNION ALL

        SELECT
            c."ID",
            c."ParentAccountingCompanyID",
            p."RelativeDepth" || 1 AS "RelativeDepth",
            CAST(p."Path" || CAST(c."ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            __mj_BizAppsAccounting."AccountingCompanyProfile" c
        INNER JOIN
            CTE_Descendants p ON c."ParentAccountingCompanyID" = p."ID"
        WHERE
            (p_MaxDepth IS NULL OR p."RelativeDepth" < p_MaxDepth)
            AND p."RelativeDepth" < 100
    )
    SELECT
        d."ID" AS "ID",
        d."RelativeDepth" AS "Depth",
        d."Path",
        CAST(CASE WHEN EXISTS (SELECT 1 FROM __mj_BizAppsAccounting."AccountingCompanyProfile" WHERE "ParentAccountingCompanyID" = d."ID") THEN 0 ELSE 1 END AS BOOLEAN) AS "IsLeaf",
        (SELECT COUNT(1) FROM __mj_BizAppsAccounting."AccountingCompanyProfile" WHERE "ParentAccountingCompanyID" = d."ID") AS "ChildCount"
    FROM
        CTE_Descendants d
);

CREATE FUNCTION __mj_BizAppsAccounting."fnAccountingCompanyProfileParentAccountingCompanyID_GetAncestors"
(
    p_RecordID UUID
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Ancestors AS (
        SELECT
            "ID",
            "ParentAccountingCompanyID",
            0 AS "LevelUp",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            __mj_BizAppsAccounting."AccountingCompanyProfile"
        WHERE
            "ID" = p_RecordID

        UNION ALL

        SELECT
            p."ID",
            p."ParentAccountingCompanyID",
            c."LevelUp" + 1 AS "LevelUp",
            CAST('/' || CAST(p."ID" AS VARCHAR(36)) || c."Path" AS TEXT) AS "Path"
        FROM
            __mj_BizAppsAccounting."AccountingCompanyProfile" p
        INNER JOIN
            CTE_Ancestors c ON p."ID" = c."ParentAccountingCompanyID"
        WHERE
            c."LevelUp" < 100
    )
    SELECT
        a."ID" AS "ID",
        a."LevelUp",
        a."Path"
    FROM
        CTE_Ancestors a
);

CREATE FUNCTION __mj_BizAppsAccounting."fnAccountingCompanyProfileParentAccountingCompanyID_GetRootID"
(
    p_RecordID UUID,
    p_ParentID UUID
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_RootParent AS (
        SELECT
            "ID",
            "ParentAccountingCompanyID",
            "ID" AS "RootParentID",
            0 AS "Depth"
        FROM
            __mj_BizAppsAccounting."AccountingCompanyProfile"
        WHERE
            "ID" = COALESCE(p_ParentID, p_RecordID)

        UNION ALL

        SELECT
            c."ID",
            c."ParentAccountingCompanyID",
            c."ID" AS "RootParentID",
            p."Depth" + 1 AS "Depth"
        FROM
            __mj_BizAppsAccounting."AccountingCompanyProfile" c
        INNER JOIN
            CTE_RootParent p ON c."ID" = p."ParentAccountingCompanyID"
        WHERE
            p."Depth" < 100
    )
    SELECT         "RootParentID" AS RootID
    FROM
        CTE_RootParent
    WHERE
        "ParentAccountingCompanyID" IS NULL
    ORDER BY
        "RootParentID"

LIMIT 1);


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsAccounting';
  v_target_name CONSTANT TEXT := 'vwAccountingCompanyProfiles';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsAccounting."vwAccountingCompanyProfiles"
AS SELECT
    a.*,
    ${mjSchema}_isa_p1."Name",
    ${mjSchema}_isa_p1."Description",
    ${mjSchema}_isa_p1."Website",
    ${mjSchema}_isa_p1."LogoURL",
    ${mjSchema}_isa_p1."Domain",
    "mjBizAppsAccountingCurrency_FunctionalCurrencyCode"."Name" AS "FunctionalCurrencyCode_Virtual",
    "mjBizAppsAccountingCurrency_ReportingCurrencyCode"."Name" AS "ReportingCurrencyCode_Virtual",
    "MJUser_ApprovalCFOUserID"."Name" AS "ApprovalCFOUser",
    ${mjSchema}_rgc."Latitude" AS "${mjSchema}_Latitude",
    ${mjSchema}_rgc."Longitude" AS "${mjSchema}_Longitude",
    "hier_ParentAccountingCompanyID"."RootID" AS "RootParentAccountingCompanyID",
    "hier_ParentAccountingCompanyID"."Depth" AS "ParentAccountingCompanyIDDepth",
    "hier_ParentAccountingCompanyID"."Path" AS "ParentAccountingCompanyIDPath",
    "hier_ParentAccountingCompanyID"."IsLeaf" AS "ParentAccountingCompanyIDIsLeaf",
    "hier_ParentAccountingCompanyID"."ChildCount" AS "ParentAccountingCompanyIDChildCount"
FROM
    __mj_BizAppsAccounting."AccountingCompanyProfile" AS a
INNER JOIN
    ${mjSchema}."Company" AS ${mjSchema}_isa_p1
  ON
    a."ID" = ${mjSchema}_isa_p1."ID"
INNER JOIN
    __mj_BizAppsAccounting."Currency" AS "mjBizAppsAccountingCurrency_FunctionalCurrencyCode"
  ON
    a."FunctionalCurrencyCode" = "mjBizAppsAccountingCurrency_FunctionalCurrencyCode"."Code"
LEFT OUTER JOIN
    __mj_BizAppsAccounting."Currency" AS "mjBizAppsAccountingCurrency_ReportingCurrencyCode"
  ON
    a."ReportingCurrencyCode" = "mjBizAppsAccountingCurrency_ReportingCurrencyCode"."Code"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ApprovalCFOUserID"
  ON
    a."ApprovalCFOUserID" = "MJUser_ApprovalCFOUserID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."vwRecordGeoCodes" AS ${mjSchema}_rgc
  ON
    ${mjSchema}_rgc."EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC'
    AND ${mjSchema}_rgc."RecordID" = CAST(a."ID" AS VARCHAR(450))
    AND ${mjSchema}_rgc."LocationType" = 'Primary'
LEFT JOIN LATERAL (SELECT * FROM __mj_BizAppsAccounting."fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta"(a."ID", a."ParentAccountingCompanyID")) AS "hier_ParentAccountingCompanyID"
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
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spDeleteAccountingCompanyProfile]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsAccounting].[AccountingCompanyP...


-- ===================== Triggers =====================

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsAccounting].trgUpdateAccountingCompanyProfile
ON "__mj_BizAppsAccounting"."AccountingCompanyProfile"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [__mj_BizA


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '4cd570a0-9be5-4036-863b-fda304697691' OR ("EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND "Name" = 'PostingStartDate')
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
        '4cd570a0-9be5-4036-863b-fda304697691',
        '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Company" "Profiles"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC'),
        'PostingStartDate',
        'Posting Start Date',
        'The first EffectiveDate this company posts to the ERP. Journal entries dated before it never enter a posting batch (for example, history brought in at cutover that the ERP already holds). NULL means no floor: every Pending entry is a candidate.',
        'date',
        3,
        10,
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


-- ===================== Grants =====================

DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsAccounting."vwAccountingCompanyProfiles" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsAccounting."vwAccountingCompanyProfiles" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsAccounting."vwAccountingCompanyProfiles" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_BizAppsAccounting."vwAccountingCompanyProfiles" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: Permissions for vwAccountingCompanyProfiles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsAccounting."vwAccountingCompanyProfiles" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsAccounting."vwAccountingCompanyProfiles" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsAccounting."vwAccountingCompanyProfiles" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_BizAppsAccounting."vwAccountingCompanyProfiles" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: spCreateAccountingCompanyProfile
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR AccountingCompanyProfile
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spUpdate SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: spUpdateAccountingCompanyProfile
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR AccountingCompanyProfile
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: spDeleteAccountingCompanyProfile
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR AccountingCompanyProfile
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to delete unneeded entity fields (1 scoped entities) */


-- ===================== Comments =====================

COMMENT ON COLUMN __mj_BizAppsAccounting."AccountingCompanyProfile"."PostingStartDate" IS 'The first EffectiveDate this company posts to the ERP. Journal entries dated before it never enter a posting batch (for example, history brought in at cutover that the ERP already holds). NULL means no floor: every Pending entry is a candidate.';


-- ===================== Other =====================

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================


/* SQL text to update existing entities from schema */

/* spUpdate Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */
