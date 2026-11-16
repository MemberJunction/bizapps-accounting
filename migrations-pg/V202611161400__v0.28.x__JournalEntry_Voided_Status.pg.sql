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

-- =============================================================================
-- Migration: V202611161400__v0.28.x__JournalEntry_Voided_Status.sql
-- Description: golive #378 — a terminal `Voided` journal entry status, so an
--              entry that never left the subledger can be cancelled in place
--              instead of offset by a mirror entry.
-- =============================================================================
--
-- WHY
--
-- D15 staged a deferred line's recognition as real forward-dated entries and
-- never edited or deleted a staged entry: a return or cancellation wrote a
-- mirror entry for every month still to come. A one-year subscription returned
-- in its first month left eleven pairs that net to zero, each pair correct only
-- if both halves land in the same batch, and each one more line for finance to
-- review at month-end (golive #378, #474).
--
-- The rule now: an entry that is still Pending, in no batch, has reached
-- nothing outside this ledger, so it can be voided. A Batched or GL-posted
-- entry is still corrected only by a reversing entry.
--
-- WHAT CHANGES
--
-- JournalEntry.Status gains `Voided`: terminal, reached only from Pending, never
-- in a batch. Three nullable columns record who voided the entry, when and why,
-- the same audit triple a cancelled or archived batch carries. They are required
-- on a Voided entry and empty on every other.
--
-- A Voided entry is frozen: no column of it and none of its lines or line
-- dimensions may change, and it cannot be deleted, so the record of what was
-- staged and why it was voided survives. Every reader that sums or batches
-- entries selects Pending, Batched or GLPosted by name, so a Voided entry drops
-- out of batch builds, the ERP send and balances without a filter of its own;
-- CK_JournalEntry_VoidedHasNoBatch keeps one out of a batch at the database.
--
-- Existing rows are Pending, Batched or GLPosted with the new columns NULL, so
-- every constraint below holds on them as added.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The two constraints that name the status list
-- -----------------------------------------------------------------------------
-- Two statements, not one: T-SQL and PostgreSQL spell a multi-constraint DROP differently, and two
-- single drops convert as they are.
ALTER TABLE "__mj_BizAppsAccounting"."JournalEntry" DROP CONSTRAINT "CK_JournalEntry_Status";

ALTER TABLE "__mj_BizAppsAccounting"."JournalEntry" DROP CONSTRAINT "CK_JournalEntry_BatchedHasJournalEntryBatch";

-- -----------------------------------------------------------------------------
-- 2. The void audit triple and the widened status list, in one statement
-- -----------------------------------------------------------------------------
-- VoidReason is VARCHAR(1000), as JournalEntryBatch.CancelReason is. A Voided
-- entry needs all three; any other entry has none, so a void cannot be half
-- recorded and a live entry cannot carry a stale reason.
-- -----------------------------------------------------------------------------
ALTER TABLE "__mj_BizAppsAccounting"."JournalEntry"
 ADD COLUMN IF NOT EXISTS "VoidReason"      VARCHAR(1000)   NULL,
 ADD COLUMN IF NOT EXISTS "VoidedAt"        TIMESTAMPTZ   NULL,
 ADD COLUMN IF NOT EXISTS "VoidedByUserID"  UUID NULL
        CONSTRAINT "FK_JournalEntry_VoidedBy" REFERENCES __mj."User"("ID"),
 ADD CONSTRAINT "CK_JournalEntry_Status"
        CHECK ("Status" IN ('Pending','Batched','GLPosted','Voided')) NOT VALID,
 ADD CONSTRAINT "CK_JournalEntry_BatchedHasJournalEntryBatch"
        CHECK ("Status" IN ('Pending','Voided') OR "JournalEntryBatchID" IS NOT NULL) NOT VALID,
 ADD CONSTRAINT "CK_JournalEntry_VoidedHasNoBatch"
        CHECK ("Status" <> 'Voided' OR "JournalEntryBatchID" IS NULL) NOT VALID,
 ADD CONSTRAINT "CK_JournalEntry_VoidAudit" CHECK (
        ("Status" = 'Voided'
            AND "VoidReason" IS NOT NULL
            AND LENGTH(TRIM("VoidReason")) > 0
            AND "VoidedAt" IS NOT NULL
            AND "VoidedByUserID" IS NOT NULL)
        OR
        ("Status" <> 'Voided'
            AND "VoidReason" IS NULL
            AND "VoidedAt" IS NULL
            AND "VoidedByUserID" IS NULL)
    ) NOT VALID;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_FunctionalCu_98e9c0ae" ON "__mj_BizAppsAccounting"."AccountingCompanyProfile" ("FunctionalCurrencyCode");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ReportingCurrencyCode" ON "__mj_BizAppsAccounting"."AccountingCompanyProfile" ("ReportingCurrencyCode");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ParentAccoun_010bb056" ON "__mj_BizAppsAccounting"."AccountingCompanyProfile" ("ParentAccountingCompanyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ApprovalCFOUserID" ON "__mj_BizAppsAccounting"."AccountingCompanyProfile" ("ApprovalCFOUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ManualJourna_ac02941c" ON "__mj_BizAppsAccounting"."AccountingCompanyProfile" ("ManualJournalEntryApproverRoleID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_CompanyID" ON "__mj_BizAppsAccounting"."JournalEntry" ("CompanyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_EntryTypeID" ON "__mj_BizAppsAccounting"."JournalEntry" ("EntryTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_LinkedEntityID" ON "__mj_BizAppsAccounting"."JournalEntry" ("LinkedEntityID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ReversesJournalEntryID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ReversesJournalEntryID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ReversedByJournalEntryID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ReversedByJournalEntryID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_JournalEntryBatchID" ON "__mj_BizAppsAccounting"."JournalEntry" ("JournalEntryBatchID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_FileID" ON "__mj_BizAppsAccounting"."JournalEntry" ("FileID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalRequestedByUserID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ApprovalRequestedByUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalTaskID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ApprovalTaskID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ApprovedByUserID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ApprovedByUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_VoidedByUserID" ON "__mj_BizAppsAccounting"."JournalEntry" ("VoidedByUserID");


-- ===================== Helper Functions (fn*) =====================

CREATE FUNCTION "__mj_BizAppsAccounting"."fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta"
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
            "__mj_BizAppsAccounting"."AccountingCompanyProfile"
        WHERE
            "ID" = p_RecordID

        UNION ALL

        SELECT
            p."ID",
            p."ParentAccountingCompanyID",
            c."Depth" + 1 AS "Depth",
            CAST('/' || CAST(p."ID" AS VARCHAR(36)) || c."Path" AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."AccountingCompanyProfile" p
        INNER JOIN
            CTE_Ancestors c ON p."ID" = c."ParentAccountingCompanyID"
        WHERE
            c."Depth" < 100
    )
    SELECT         a."ID" AS "RootID",
        (SELECT MAX("Depth") FROM CTE_Ancestors) AS "Depth",
        (SELECT "Path" FROM CTE_Ancestors ORDER BY "Depth" DESC
LIMIT 1) AS "Path",
        CAST(CASE WHEN EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."AccountingCompanyProfile" WHERE "ParentAccountingCompanyID" = p_RecordID) THEN 0 ELSE 1 END AS BOOLEAN) AS "IsLeaf",
        (SELECT COUNT(1) FROM "__mj_BizAppsAccounting"."AccountingCompanyProfile" WHERE "ParentAccountingCompanyID" = p_RecordID) AS "ChildCount"
    FROM
        CTE_Ancestors a
    WHERE
        a."ParentAccountingCompanyID" IS NULL OR p_ParentID IS NULL
    ORDER BY
        a."Depth" DESC

LIMIT 1);

CREATE FUNCTION "__mj_BizAppsAccounting"."fnAccountingCompanyProfileParentAccountingCompanyID_GetDescendants"
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
            "__mj_BizAppsAccounting"."AccountingCompanyProfile"
        WHERE
            "ID" = p_RootID

        UNION ALL

        SELECT
            c."ID",
            c."ParentAccountingCompanyID",
            p."RelativeDepth" || 1 AS "RelativeDepth",
            CAST(p."Path" || CAST(c."ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."AccountingCompanyProfile" c
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
        CAST(CASE WHEN EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."AccountingCompanyProfile" WHERE "ParentAccountingCompanyID" = d."ID") THEN 0 ELSE 1 END AS BOOLEAN) AS "IsLeaf",
        (SELECT COUNT(1) FROM "__mj_BizAppsAccounting"."AccountingCompanyProfile" WHERE "ParentAccountingCompanyID" = d."ID") AS "ChildCount"
    FROM
        CTE_Descendants d
);

CREATE FUNCTION "__mj_BizAppsAccounting"."fnAccountingCompanyProfileParentAccountingCompanyID_GetAncestors"
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
            "__mj_BizAppsAccounting"."AccountingCompanyProfile"
        WHERE
            "ID" = p_RecordID

        UNION ALL

        SELECT
            p."ID",
            p."ParentAccountingCompanyID",
            c."LevelUp" + 1 AS "LevelUp",
            CAST('/' || CAST(p."ID" AS VARCHAR(36)) || c."Path" AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."AccountingCompanyProfile" p
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

CREATE FUNCTION "__mj_BizAppsAccounting"."fnAccountingCompanyProfileParentAccountingCompanyID_GetRootID"
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
            "__mj_BizAppsAccounting"."AccountingCompanyProfile"
        WHERE
            "ID" = COALESCE(p_ParentID, p_RecordID)

        UNION ALL

        SELECT
            c."ID",
            c."ParentAccountingCompanyID",
            c."ID" AS "RootParentID",
            p."Depth" + 1 AS "Depth"
        FROM
            "__mj_BizAppsAccounting"."AccountingCompanyProfile" c
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

CREATE FUNCTION "__mj_BizAppsAccounting"."fnJournalEntryReversesJournalEntryID_GetHierarchyMeta"
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
            "ReversesJournalEntryID",
            0 AS "Depth",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry"
        WHERE
            "ID" = p_RecordID

        UNION ALL

        SELECT
            p."ID",
            p."ReversesJournalEntryID",
            c."Depth" + 1 AS "Depth",
            CAST('/' || CAST(p."ID" AS VARCHAR(36)) || c."Path" AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry" p
        INNER JOIN
            CTE_Ancestors c ON p."ID" = c."ReversesJournalEntryID"
        WHERE
            c."Depth" < 100
    )
    SELECT         a."ID" AS "RootID",
        (SELECT MAX("Depth") FROM CTE_Ancestors) AS "Depth",
        (SELECT "Path" FROM CTE_Ancestors ORDER BY "Depth" DESC
LIMIT 1) AS "Path",
        CAST(CASE WHEN EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."JournalEntry" WHERE "ReversesJournalEntryID" = p_RecordID) THEN 0 ELSE 1 END AS BOOLEAN) AS "IsLeaf",
        (SELECT COUNT(1) FROM "__mj_BizAppsAccounting"."JournalEntry" WHERE "ReversesJournalEntryID" = p_RecordID) AS "ChildCount"
    FROM
        CTE_Ancestors a
    WHERE
        a."ReversesJournalEntryID" IS NULL OR p_ParentID IS NULL
    ORDER BY
        a."Depth" DESC

LIMIT 1);

CREATE FUNCTION "__mj_BizAppsAccounting"."fnJournalEntryReversesJournalEntryID_GetDescendants"
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
            "ReversesJournalEntryID",
            0 AS "RelativeDepth",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry"
        WHERE
            "ID" = p_RootID

        UNION ALL

        SELECT
            c."ID",
            c."ReversesJournalEntryID",
            p."RelativeDepth" || 1 AS "RelativeDepth",
            CAST(p."Path" || CAST(c."ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry" c
        INNER JOIN
            CTE_Descendants p ON c."ReversesJournalEntryID" = p."ID"
        WHERE
            (p_MaxDepth IS NULL OR p."RelativeDepth" < p_MaxDepth)
            AND p."RelativeDepth" < 100
    )
    SELECT
        d."ID" AS "ID",
        d."RelativeDepth" AS "Depth",
        d."Path",
        CAST(CASE WHEN EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."JournalEntry" WHERE "ReversesJournalEntryID" = d."ID") THEN 0 ELSE 1 END AS BOOLEAN) AS "IsLeaf",
        (SELECT COUNT(1) FROM "__mj_BizAppsAccounting"."JournalEntry" WHERE "ReversesJournalEntryID" = d."ID") AS "ChildCount"
    FROM
        CTE_Descendants d
);

CREATE FUNCTION "__mj_BizAppsAccounting"."fnJournalEntryReversesJournalEntryID_GetAncestors"
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
            "ReversesJournalEntryID",
            0 AS "LevelUp",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry"
        WHERE
            "ID" = p_RecordID

        UNION ALL

        SELECT
            p."ID",
            p."ReversesJournalEntryID",
            c."LevelUp" + 1 AS "LevelUp",
            CAST('/' || CAST(p."ID" AS VARCHAR(36)) || c."Path" AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry" p
        INNER JOIN
            CTE_Ancestors c ON p."ID" = c."ReversesJournalEntryID"
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

CREATE FUNCTION "__mj_BizAppsAccounting"."fnJournalEntryReversesJournalEntryID_GetRootID"
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
            "ReversesJournalEntryID",
            "ID" AS "RootParentID",
            0 AS "Depth"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry"
        WHERE
            "ID" = COALESCE(p_ParentID, p_RecordID)

        UNION ALL

        SELECT
            c."ID",
            c."ReversesJournalEntryID",
            c."ID" AS "RootParentID",
            p."Depth" + 1 AS "Depth"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry" c
        INNER JOIN
            CTE_RootParent p ON c."ID" = p."ReversesJournalEntryID"
        WHERE
            p."Depth" < 100
    )
    SELECT         "RootParentID" AS RootID
    FROM
        CTE_RootParent
    WHERE
        "ReversesJournalEntryID" IS NULL
    ORDER BY
        "RootParentID"

LIMIT 1);

CREATE FUNCTION "__mj_BizAppsAccounting"."fnJournalEntryReversedByJournalEntryID_GetHierarchyMeta"
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
            "ReversedByJournalEntryID",
            0 AS "Depth",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry"
        WHERE
            "ID" = p_RecordID

        UNION ALL

        SELECT
            p."ID",
            p."ReversedByJournalEntryID",
            c."Depth" + 1 AS "Depth",
            CAST('/' || CAST(p."ID" AS VARCHAR(36)) || c."Path" AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry" p
        INNER JOIN
            CTE_Ancestors c ON p."ID" = c."ReversedByJournalEntryID"
        WHERE
            c."Depth" < 100
    )
    SELECT         a."ID" AS "RootID",
        (SELECT MAX("Depth") FROM CTE_Ancestors) AS "Depth",
        (SELECT "Path" FROM CTE_Ancestors ORDER BY "Depth" DESC
LIMIT 1) AS "Path",
        CAST(CASE WHEN EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."JournalEntry" WHERE "ReversedByJournalEntryID" = p_RecordID) THEN 0 ELSE 1 END AS BOOLEAN) AS "IsLeaf",
        (SELECT COUNT(1) FROM "__mj_BizAppsAccounting"."JournalEntry" WHERE "ReversedByJournalEntryID" = p_RecordID) AS "ChildCount"
    FROM
        CTE_Ancestors a
    WHERE
        a."ReversedByJournalEntryID" IS NULL OR p_ParentID IS NULL
    ORDER BY
        a."Depth" DESC

LIMIT 1);

CREATE FUNCTION "__mj_BizAppsAccounting"."fnJournalEntryReversedByJournalEntryID_GetDescendants"
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
            "ReversedByJournalEntryID",
            0 AS "RelativeDepth",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry"
        WHERE
            "ID" = p_RootID

        UNION ALL

        SELECT
            c."ID",
            c."ReversedByJournalEntryID",
            p."RelativeDepth" || 1 AS "RelativeDepth",
            CAST(p."Path" || CAST(c."ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry" c
        INNER JOIN
            CTE_Descendants p ON c."ReversedByJournalEntryID" = p."ID"
        WHERE
            (p_MaxDepth IS NULL OR p."RelativeDepth" < p_MaxDepth)
            AND p."RelativeDepth" < 100
    )
    SELECT
        d."ID" AS "ID",
        d."RelativeDepth" AS "Depth",
        d."Path",
        CAST(CASE WHEN EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."JournalEntry" WHERE "ReversedByJournalEntryID" = d."ID") THEN 0 ELSE 1 END AS BOOLEAN) AS "IsLeaf",
        (SELECT COUNT(1) FROM "__mj_BizAppsAccounting"."JournalEntry" WHERE "ReversedByJournalEntryID" = d."ID") AS "ChildCount"
    FROM
        CTE_Descendants d
);

CREATE FUNCTION "__mj_BizAppsAccounting"."fnJournalEntryReversedByJournalEntryID_GetAncestors"
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
            "ReversedByJournalEntryID",
            0 AS "LevelUp",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry"
        WHERE
            "ID" = p_RecordID

        UNION ALL

        SELECT
            p."ID",
            p."ReversedByJournalEntryID",
            c."LevelUp" + 1 AS "LevelUp",
            CAST('/' || CAST(p."ID" AS VARCHAR(36)) || c."Path" AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry" p
        INNER JOIN
            CTE_Ancestors c ON p."ID" = c."ReversedByJournalEntryID"
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

CREATE FUNCTION "__mj_BizAppsAccounting"."fnJournalEntryReversedByJournalEntryID_GetRootID"
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
            "ReversedByJournalEntryID",
            "ID" AS "RootParentID",
            0 AS "Depth"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry"
        WHERE
            "ID" = COALESCE(p_ParentID, p_RecordID)

        UNION ALL

        SELECT
            c."ID",
            c."ReversedByJournalEntryID",
            c."ID" AS "RootParentID",
            p."Depth" + 1 AS "Depth"
        FROM
            "__mj_BizAppsAccounting"."JournalEntry" c
        INNER JOIN
            CTE_RootParent p ON c."ID" = p."ReversedByJournalEntryID"
        WHERE
            p."Depth" < 100
    )
    SELECT         "RootParentID" AS RootID
    FROM
        CTE_RootParent
    WHERE
        "ReversedByJournalEntryID" IS NULL
    ORDER BY
        "RootParentID"

LIMIT 1);


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsAccounting';
  v_target_name CONSTANT TEXT := 'vwAccountingCompanyProfiles';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles"
AS SELECT
    a.*,
    __mj_isa_p1."Name",
    __mj_isa_p1."Description",
    __mj_isa_p1."Website",
    __mj_isa_p1."LogoURL",
    __mj_isa_p1."Domain",
    "mjBizAppsAccountingCurrency_FunctionalCurrencyCode"."Name" AS "FunctionalCurrencyCode_Virtual",
    "mjBizAppsAccountingCurrency_ReportingCurrencyCode"."Name" AS "ReportingCurrencyCode_Virtual",
    "MJUser_ApprovalCFOUserID"."Name" AS "ApprovalCFOUser",
    "MJRole_ManualJournalEntryApproverRoleID"."Name" AS "ManualJournalEntryApproverRole",
    __mj_rgc."Latitude" AS "__mj_Latitude",
    __mj_rgc."Longitude" AS "__mj_Longitude",
    "hier_ParentAccountingCompanyID"."RootID" AS "RootParentAccountingCompanyID",
    "hier_ParentAccountingCompanyID"."Depth" AS "ParentAccountingCompanyIDDepth",
    "hier_ParentAccountingCompanyID"."Path" AS "ParentAccountingCompanyIDPath",
    "hier_ParentAccountingCompanyID"."IsLeaf" AS "ParentAccountingCompanyIDIsLeaf",
    "hier_ParentAccountingCompanyID"."ChildCount" AS "ParentAccountingCompanyIDChildCount"
FROM
    "__mj_BizAppsAccounting"."AccountingCompanyProfile" AS a
INNER JOIN
    ${mjSchema}."Company" AS __mj_isa_p1
  ON
    a."ID" = __mj_isa_p1."ID"
INNER JOIN
    "__mj_BizAppsAccounting"."Currency" AS "mjBizAppsAccountingCurrency_FunctionalCurrencyCode"
  ON
    a."FunctionalCurrencyCode" = "mjBizAppsAccountingCurrency_FunctionalCurrencyCode"."Code"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."Currency" AS "mjBizAppsAccountingCurrency_ReportingCurrencyCode"
  ON
    a."ReportingCurrencyCode" = "mjBizAppsAccountingCurrency_ReportingCurrencyCode"."Code"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ApprovalCFOUserID"
  ON
    a."ApprovalCFOUserID" = "MJUser_ApprovalCFOUserID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."Role" AS "MJRole_ManualJournalEntryApproverRoleID"
  ON
    a."ManualJournalEntryApproverRoleID" = "MJRole_ManualJournalEntryApproverRoleID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."vwRecordGeoCodes" AS __mj_rgc
  ON
    __mj_rgc."EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC'
    AND __mj_rgc."RecordID" = CAST(a."ID" AS VARCHAR(450))
    AND __mj_rgc."LocationType" = 'Primary'
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
  v_target_name CONSTANT TEXT := 'vwJournalEntriesGenerated';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_BizAppsAccounting"."vwJournalEntriesGenerated"
AS SELECT
    j.*,
    "MJCompany_CompanyID"."Name" AS "Company",
    "mjBizAppsAccountingJournalEntryType_EntryTypeID"."Name" AS "EntryType",
    "MJEntity_LinkedEntityID"."Name" AS "LinkedEntity",
    "mjBizAppsAccountingJournalEntry_ReversesJournalEntryID"."EntryNumber" AS "ReversesJournalEntry",
    "mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID"."EntryNumber" AS "ReversedByJournalEntry",
    "mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID"."JournalEntryBatchNumber" AS "JournalEntryBatch",
    "MJFile_FileID"."Name" AS "File",
    "MJUser_ApprovalRequestedByUserID"."Name" AS "ApprovalRequestedByUser",
    "mjBizAppsTasksTask_ApprovalTaskID"."Name" AS "ApprovalTask",
    "MJUser_ApprovedByUserID"."Name" AS "ApprovedByUser",
    "MJUser_VoidedByUserID"."Name" AS "VoidedByUser",
    "hier_ReversesJournalEntryID"."RootID" AS "RootReversesJournalEntryID",
    "hier_ReversesJournalEntryID"."Depth" AS "ReversesJournalEntryIDDepth",
    "hier_ReversesJournalEntryID"."Path" AS "ReversesJournalEntryIDPath",
    "hier_ReversesJournalEntryID"."IsLeaf" AS "ReversesJournalEntryIDIsLeaf",
    "hier_ReversesJournalEntryID"."ChildCount" AS "ReversesJournalEntryIDChildCount",
    "hier_ReversedByJournalEntryID"."RootID" AS "RootReversedByJournalEntryID",
    "hier_ReversedByJournalEntryID"."Depth" AS "ReversedByJournalEntryIDDepth",
    "hier_ReversedByJournalEntryID"."Path" AS "ReversedByJournalEntryIDPath",
    "hier_ReversedByJournalEntryID"."IsLeaf" AS "ReversedByJournalEntryIDIsLeaf",
    "hier_ReversedByJournalEntryID"."ChildCount" AS "ReversedByJournalEntryIDChildCount"
FROM
    "__mj_BizAppsAccounting"."JournalEntry" AS j
INNER JOIN
    ${mjSchema}."Company" AS "MJCompany_CompanyID"
  ON
    j."CompanyID" = "MJCompany_CompanyID"."ID"
INNER JOIN
    "__mj_BizAppsAccounting"."JournalEntryType" AS "mjBizAppsAccountingJournalEntryType_EntryTypeID"
  ON
    j."EntryTypeID" = "mjBizAppsAccountingJournalEntryType_EntryTypeID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."Entity" AS "MJEntity_LinkedEntityID"
  ON
    j."LinkedEntityID" = "MJEntity_LinkedEntityID"."ID"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."JournalEntry" AS "mjBizAppsAccountingJournalEntry_ReversesJournalEntryID"
  ON
    j."ReversesJournalEntryID" = "mjBizAppsAccountingJournalEntry_ReversesJournalEntryID"."ID"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."JournalEntry" AS "mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID"
  ON
    j."ReversedByJournalEntryID" = "mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID"."ID"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."JournalEntryBatch" AS "mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID"
  ON
    j."JournalEntryBatchID" = "mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."File" AS "MJFile_FileID"
  ON
    j."FileID" = "MJFile_FileID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ApprovalRequestedByUserID"
  ON
    j."ApprovalRequestedByUserID" = "MJUser_ApprovalRequestedByUserID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsTasks."Task" AS "mjBizAppsTasksTask_ApprovalTaskID"
  ON
    j."ApprovalTaskID" = "mjBizAppsTasksTask_ApprovalTaskID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ApprovedByUserID"
  ON
    j."ApprovedByUserID" = "MJUser_ApprovedByUserID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_VoidedByUserID"
  ON
    j."VoidedByUserID" = "MJUser_VoidedByUserID"."ID"
LEFT JOIN LATERAL (SELECT * FROM "__mj_BizAppsAccounting"."fnJournalEntryReversesJournalEntryID_GetHierarchyMeta"(j."ID", j."ReversesJournalEntryID")) AS "hier_ReversesJournalEntryID"
    ON TRUE
LEFT JOIN LATERAL (SELECT * FROM "__mj_BizAppsAccounting"."fnJournalEntryReversedByJournalEntryID_GetHierarchyMeta"(j."ID", j."ReversedByJournalEntryID")) AS "hier_ReversedByJournalEntryID"
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

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spCreateJournalEntry]
--     @ID UUID = NULL,
--     @EntryNumber VARCHAR(40),
--     @CompanyID UUID,
--     @EffectiveDate date,
--     @EntryTyp...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spUpdateJournalEntry]
--     @ID UUID,
--     @EntryNumber VARCHAR(40) = NULL,
--     @CompanyID UUID = NULL,
--     @EffectiveDate date = NULL,...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spDeleteJournalEntry]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsAccounting].[JournalEntry]
--     WHERE
--       ...


-- ===================== Triggers =====================

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsAccounting].trgUpdateAccountingCompanyProfile
ON "__mj_BizAppsAccounting"."AccountingCompanyProfile"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizA

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsAccounting".trgUpdateJournalEntry
ON "__mj_BizAppsAccounting"."JournalEntry"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizAppsAccounting".[JournalE


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

UPDATE ${mjSchema}."EntityField"
                         SET "Configuration" = '{"Hierarchy":{"IsHierarchy":true}}'
                         WHERE "ID" = '1942E506-B262-4583-BBD9-51B18A56A743' AND ("Configuration" IS NULL OR "Configuration" = '');

/* Seed Hierarchy.IsHierarchy on legacy self-referencing FK MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryID */

UPDATE ${mjSchema}."EntityField"
                         SET "Configuration" = '{"Hierarchy":{"IsHierarchy":true}}'
                         WHERE "ID" = 'AB87731D-1323-4D32-8C24-87AB12084818' AND ("Configuration" IS NULL OR "Configuration" = '');

/* SQL text to insert 3 new entity field(s) */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '48bdcb03-2370-4356-a20c-f69608c95bd2' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'VoidReason')
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
        '48bdcb03-2370-4356-a20c-f69608c95bd2',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'VoidReason',
        'Void Reason',
        'Why this entry was voided instead of posted. Required when Status = Voided and empty otherwise (CK_JournalEntry_VoidAudit).',
        'TEXT',
        2000,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '354b20ae-46fb-43e1-abb4-f0007aaad72a' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'VoidedAt')
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
        '354b20ae-46fb-43e1-abb4-f0007aaad72a',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'VoidedAt',
        'Voided At',
        'When the entry was voided. Required when Status = Voided and empty otherwise.',
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'e949992b-21ee-4af0-ba7f-81ba82e304fa' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'VoidedByUserID')
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
        'e949992b-21ee-4af0-ba7f-81ba82e304fa',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'VoidedByUserID',
        'Voided By User ID',
        'User who voided the entry. Required when Status = Voided and empty otherwise.',
        'UUID',
        16,
        0,
        0,
        1,
        NULL,
        0,
        1,
        0,
        0,
        'E1238F34-2837-EF11-86D4-6045BDEE16E6',
        'ID',
        0,
        0,
        1,
        0,
        0,
        0,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

UPDATE ${mjSchema}."EntityField"
                  SET "IsVirtual" = TRUE,
                      "Type"='TEXT',
                      "Length"=100,
                      "Precision"=0,
                      "Scale"=0,
                      "AllowsNull" = FALSE,
                      "AllowUpdateAPI" = TRUE,
                      "IncludeRelatedEntityNameFieldInBaseView" = FALSE,
                      "RelatedEntityID"=NULL,
                      "RelatedEntityFieldName"=NULL,
                      "RelatedEntityDisplayType"='Dropdown'
                  WHERE "ID"='B79E7941-2AA9-4761-BEB7-9ABF2A98C0AD';

/* Update IS-A parent field Description on MJ_BizApps_Accounting: Accounting Company Profiles */

UPDATE ${mjSchema}."EntityField"
                  SET "IsVirtual" = TRUE,
                      "Type"='TEXT',
                      "Length"=400,
                      "Precision"=0,
                      "Scale"=0,
                      "AllowsNull" = FALSE,
                      "AllowUpdateAPI" = TRUE,
                      "IncludeRelatedEntityNameFieldInBaseView" = FALSE,
                      "RelatedEntityID"=NULL,
                      "RelatedEntityFieldName"=NULL,
                      "RelatedEntityDisplayType"='Dropdown'
                  WHERE "ID"='2F99FAB0-EE99-4A33-825A-A5158528FC23';

/* Update IS-A parent field Website on MJ_BizApps_Accounting: Accounting Company Profiles */

UPDATE ${mjSchema}."EntityField"
                  SET "IsVirtual" = TRUE,
                      "Type"='TEXT',
                      "Length"=200,
                      "Precision"=0,
                      "Scale"=0,
                      "AllowsNull" = TRUE,
                      "AllowUpdateAPI" = TRUE,
                      "IncludeRelatedEntityNameFieldInBaseView" = FALSE,
                      "RelatedEntityID"=NULL,
                      "RelatedEntityFieldName"=NULL,
                      "RelatedEntityDisplayType"='Dropdown'
                  WHERE "ID"='FF935548-2816-4B2C-AEC8-A06DFC349CFE';

/* Update IS-A parent field LogoURL on MJ_BizApps_Accounting: Accounting Company Profiles */

UPDATE ${mjSchema}."EntityField"
                  SET "IsVirtual" = TRUE,
                      "Type"='TEXT',
                      "Length"=1000,
                      "Precision"=0,
                      "Scale"=0,
                      "AllowsNull" = TRUE,
                      "AllowUpdateAPI" = TRUE,
                      "IncludeRelatedEntityNameFieldInBaseView" = FALSE,
                      "RelatedEntityID"=NULL,
                      "RelatedEntityFieldName"=NULL,
                      "RelatedEntityDisplayType"='Dropdown'
                  WHERE "ID"='AF88A4E4-6383-42E5-82F2-F3E7E7E9D009';

/* Update IS-A parent field Domain on MJ_BizApps_Accounting: Accounting Company Profiles */

UPDATE ${mjSchema}."EntityField"
                  SET "IsVirtual" = TRUE,
                      "Type"='TEXT',
                      "Length"=510,
                      "Precision"=0,
                      "Scale"=0,
                      "AllowsNull" = TRUE,
                      "AllowUpdateAPI" = TRUE,
                      "IncludeRelatedEntityNameFieldInBaseView" = FALSE,
                      "RelatedEntityID"=NULL,
                      "RelatedEntityFieldName"=NULL,
                      "RelatedEntityDisplayType"='Dropdown'
                  WHERE "ID"='D7D7E52E-22C9-401B-AF67-43559CB5C4DB';

/* Update entity timestamp for MJ_BizApps_Accounting: Accounting Company Profiles after IS-A field sync */

UPDATE ${mjSchema}."Entity" SET "__mj_UpdatedAt"=NOW() WHERE "ID"='3E551198-AB66-478E-BEB6-C34EDBE242EC';

/* SQL text to set default column width where needed */

INSERT INTO ${mjSchema}."EntityFieldValue"
                                       ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
                                    VALUES
                                       ('4b9ea148-3028-4605-abea-f741ba2d4f2a', 'E5F8375D-12F9-4D6C-9502-080082D84921', 4, 'Voided', 'Voided', NOW(), NOW());

/* Deterministic search-flag hygiene — clear AllowUserSearchAPI */

UPDATE ${mjSchema}."Entity"
         SET "AllowUserSearchAPI" = FALSE
         WHERE "ID" IN (
            SELECT e."ID"
            FROM ${mjSchema}."Entity" e
            WHERE e."AllowUserSearchAPI" = TRUE
              AND e."AutoUpdateAllowUserSearchAPI" = TRUE
              AND e."VirtualEntity" = FALSE
              AND COALESCE(e."FullTextSearchEnabled", 0) = 0
              AND e."SchemaName" NOT IN ('${mjSchema}','__mj_BizAppsCommon','__mj_BizAppsTasks','sys')
              AND NOT EXISTS (
               SELECT 1 FROM ${mjSchema}."EntityField" f2
               WHERE f2."EntityID" = e."ID"
                 AND f2."IncludeInUserSearchAPI" = TRUE
            )
         );


/* Heal EntityRelationship EntityKeyField from '' to Code (non-PK join column) */

UPDATE ${mjSchema}."EntityRelationship"
      SET "EntityKeyField" = 'Code',
          "__mj_UpdatedAt" = NOW()
      WHERE "ID" = '216658DB-99C3-417B-8CAE-81F083876B8E';


/* Heal EntityRelationship EntityKeyField from '' to Code (non-PK join column) */

UPDATE ${mjSchema}."EntityRelationship"
      SET "EntityKeyField" = 'Code',
          "__mj_UpdatedAt" = NOW()
      WHERE "ID" = '6A948F11-F00D-4A30-9FB0-675EEFD39667';

/* Heal EntityRelationship EntityKeyField from '' to Code (non-PK join column) */

UPDATE ${mjSchema}."EntityRelationship"
      SET "EntityKeyField" = 'Code',
          "__mj_UpdatedAt" = NOW()
      WHERE "ID" = 'D4A6D51A-8406-4C23-A5F3-3EBC5DEBD111';

/* Heal EntityRelationship EntityKeyField from '' to Code (non-PK join column) */

UPDATE ${mjSchema}."EntityRelationship"
      SET "EntityKeyField" = 'Code',
          "__mj_UpdatedAt" = NOW()
      WHERE "ID" = 'B60EDD8C-C56F-4AD0-84A9-9A9792E578F9';

/* Heal EntityRelationship EntityKeyField from '' to Code (non-PK join column) */

UPDATE ${mjSchema}."EntityRelationship"
      SET "EntityKeyField" = 'Code',
          "__mj_UpdatedAt" = NOW()
      WHERE "ID" = '40F08B08-D8AD-4A06-8B30-4D4775AA4274';

/* Heal EntityRelationship EntityKeyField from '' to Code (non-PK join column) */

UPDATE ${mjSchema}."EntityRelationship"
      SET "EntityKeyField" = 'Code',
          "__mj_UpdatedAt" = NOW()
      WHERE "ID" = '5F5962F2-60AC-4416-8F91-AC77876DEF13';


/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Accounting: Journal Entries (One To Many via VoidedByUserID) */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = '9aea0603-7de9-4f11-b1cd-81e01330f448' OR ("EntityID" = 'E1238F34-2837-EF11-86D4-6045BDEE16E6' AND "RelatedEntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "RelatedEntityJoinField" = 'VoidedByUserID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('9aea0603-7de9-4f11-b1cd-81e01330f448', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', 'VoidedByUserID', 'One To Many', 1, 1, 147, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'ef54ea22-9601-43ed-b8a8-c2cf140a2e0f' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'VoidedByUser')
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
        'ef54ea22-9601-43ed-b8a8-c2cf140a2e0f',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'VoidedByUser',
        'Voided By User',
        NULL,
        'TEXT',
        200,
        0,
        0,
        1,
        NULL,
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '61e3d297-b9e9-4914-a991-6639c39d0d88' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'RootReversesJournalEntryID')
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
        '61e3d297-b9e9-4914-a991-6639c39d0d88',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'RootReversesJournalEntryID',
        'Root Reverses Journal Entry ID',
        NULL,
        'UUID',
        16,
        0,
        0,
        1,
        NULL,
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'dae91fa5-7060-46b2-9642-755fcdbedd13' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ReversesJournalEntryIDDepth')
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
        'dae91fa5-7060-46b2-9642-755fcdbedd13',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ReversesJournalEntryIDDepth',
        'Reverses Journal Entry ID Depth',
        NULL,
        'INTEGER',
        4,
        10,
        0,
        1,
        NULL,
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '2fa501cc-0c0f-4187-b84e-d4937b891e54' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ReversesJournalEntryIDPath')
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
        '2fa501cc-0c0f-4187-b84e-d4937b891e54',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ReversesJournalEntryIDPath',
        'Reverses Journal Entry ID Path',
        NULL,
        'TEXT',
        -1,
        0,
        0,
        1,
        NULL,
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'a815f2e4-e233-47e7-a7b4-f4d4211325b0' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ReversesJournalEntryIDIsLeaf')
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
        'a815f2e4-e233-47e7-a7b4-f4d4211325b0',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ReversesJournalEntryIDIsLeaf',
        'Reverses Journal Entry ID Is Leaf',
        NULL,
        'BOOLEAN',
        1,
        1,
        0,
        1,
        NULL,
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'cf142b1e-b93c-45de-8b5e-44387ae1d1e1' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ReversesJournalEntryIDChildCount')
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
        'cf142b1e-b93c-45de-8b5e-44387ae1d1e1',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ReversesJournalEntryIDChildCount',
        'Reverses Journal Entry ID Child Count',
        NULL,
        'INTEGER',
        4,
        10,
        0,
        1,
        NULL,
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '2698ffb6-9938-47d7-8314-95160e32ac56' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'RootReversedByJournalEntryID')
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
        '2698ffb6-9938-47d7-8314-95160e32ac56',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'RootReversedByJournalEntryID',
        'Root Reversed By Journal Entry ID',
        NULL,
        'UUID',
        16,
        0,
        0,
        1,
        NULL,
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '705aaac3-8a2d-4e4e-8023-0a1fb20d8a06' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ReversedByJournalEntryIDDepth')
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
        '705aaac3-8a2d-4e4e-8023-0a1fb20d8a06',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ReversedByJournalEntryIDDepth',
        'Reversed By Journal Entry ID Depth',
        NULL,
        'INTEGER',
        4,
        10,
        0,
        1,
        NULL,
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '1ba96cdb-e63d-43f0-a78c-6853c6023aac' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ReversedByJournalEntryIDPath')
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
        '1ba96cdb-e63d-43f0-a78c-6853c6023aac',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ReversedByJournalEntryIDPath',
        'Reversed By Journal Entry ID Path',
        NULL,
        'TEXT',
        -1,
        0,
        0,
        1,
        NULL,
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '35ef52c5-7ac4-42b9-9b8d-70c02d150c97' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ReversedByJournalEntryIDIsLeaf')
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
        '35ef52c5-7ac4-42b9-9b8d-70c02d150c97',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ReversedByJournalEntryIDIsLeaf',
        'Reversed By Journal Entry ID Is Leaf',
        NULL,
        'BOOLEAN',
        1,
        1,
        0,
        1,
        NULL,
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '09ba9f31-95f1-4bb2-bdb4-b8a1eb2863b3' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ReversedByJournalEntryIDChildCount')
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
        '09ba9f31-95f1-4bb2-bdb4-b8a1eb2863b3',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ReversedByJournalEntryIDChildCount',
        'Reversed By Journal Entry ID Child Count',
        NULL,
        'INTEGER',
        4,
        10,
        0,
        1,
        NULL,
        0,
        0,
        1,
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

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Classification',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '48BDCB03-2370-4356-A20C-F69608C95BD2';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.VoidedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Classification',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '354B20AE-46FB-43E1-ABB4-F0007AAAD72A';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.VoidedByUserID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Classification',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Voided By User'
WHERE 
   "ID" = 'E949992B-21EE-4AF0-BA7F-81BA82E304FA';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ApprovalRequestedByUser

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Approval',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'FCD8C833-8CBA-4A3A-814D-F9B678C9CD05';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ApprovalTask

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Approval',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'DA9DD1EB-2FA2-4F99-801D-91775F8B1F12';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ApprovedByUser

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Approval',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '2EDE0581-5BE1-4235-9D74-4EC4811BC9F2';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.VoidedByUser

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Classification',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'EF54EA22-9601-43ED-B8A8-C2CF140A2E0F';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.RootReversesJournalEntryID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Reversal Tracking',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Root Reverses Journal Entry'
WHERE 
   "ID" = '61E3D297-B9E9-4914-A991-6639C39D0D88';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryIDDepth

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Reversal Tracking',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Reverses Journal Entry Depth'
WHERE 
   "ID" = 'DAE91FA5-7060-46B2-9642-755FCDBEDD13';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryIDPath

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Reversal Tracking',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Reverses Journal Entry Path'
WHERE 
   "ID" = '2FA501CC-0C0F-4187-B84E-D4937B891E54';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryIDIsLeaf

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Reversal Tracking',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Reverses Journal Entry Is Leaf'
WHERE 
   "ID" = 'A815F2E4-E233-47E7-A7B4-F4D4211325B0';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryIDChildCount

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Reversal Tracking',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Reverses Journal Entry Child Count'
WHERE 
   "ID" = 'CF142B1E-B93C-45DE-8B5E-44387AE1D1E1';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.RootReversedByJournalEntryID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Reversal Tracking',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Root Reversed By Journal Entry'
WHERE 
   "ID" = '2698FFB6-9938-47D7-8314-95160E32AC56';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryIDDepth

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Reversal Tracking',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Reversed By Journal Entry Depth'
WHERE 
   "ID" = '705AAAC3-8A2D-4E4E-8023-0A1FB20D8A06';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryIDPath

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Reversal Tracking',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Reversed By Journal Entry Path'
WHERE 
   "ID" = '1BA96CDB-E63D-43F0-A78C-6853C6023AAC';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryIDIsLeaf

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Reversal Tracking',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Reversed By Journal Entry Is Leaf'
WHERE 
   "ID" = '35EF52C5-7AC4-42B9-9B8D-70C02D150C97';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryIDChildCount

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Reversal Tracking',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Reversed By Journal Entry Child Count'
WHERE 
   "ID" = '09BA9F31-95F1-4BB2-BDB4-B8A1EB2863B3';

/* Refresh custom base views for modified entities so schema changes are picked up */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'D3A4DB04-71B4-48BC-84A1-8D6E29A5D4F1'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('7c70c025-ae4d-4005-8521-be572c9a9ade', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([ManualJournalEntryApprovalThreshold] IS NULL OR [ManualJournalEntryApprovalThreshold]>=(0))', 'public ValidateManualJournalEntryApprovalThresholdNonNegative(result: ValidationResult) {
        if (this.ManualJournalEntryApprovalThreshold != null && this.ManualJournalEntryApprovalThreshold < 0) {
        result.Errors.push(new ValidationErrorInfo(
        "ManualJournalEntryApprovalThreshold",
        "Manual journal entry approval threshold must be greater than or equal to 0.",
        this.ManualJournalEntryApprovalThreshold,
        ValidationErrorType.Failure
        ));
        }
        }', 'Manual journal entry approval threshold cannot be negative; it must be zero or greater if specified.', 'ValidateManualJournalEntryApprovalThresholdNonNegative', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', 'D3A4DB04-71B4-48BC-84A1-8D6E29A5D4F1');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ValidateApprovalDetails'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('1aed9cdf-4046-4160-ae01-2287b621b488', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([ApprovedAt] IS NULL AND [ApprovedByUserID] IS NULL OR [ApprovedAt] IS NOT NULL AND [ApprovedByUserID] IS NOT NULL AND [ApprovalLevel] IS NOT NULL)', 'public ValidateApprovalDetails(result: ValidationResult): void {
        const hasApprovedAt = this.ApprovedAt != null;
        const hasApprovedByUserID = this.ApprovedByUserID != null;
        const hasApprovalLevel = this.ApprovalLevel != null && this.ApprovalLevel.trim().length > 0;
        
        const isUnapproved = !hasApprovedAt && !hasApprovedByUserID;
        const isFullyApproved = hasApprovedAt && hasApprovedByUserID && hasApprovalLevel;
        
        if (!isUnapproved && !isFullyApproved) {
        result.Errors.push(new ValidationErrorInfo(
        "ApprovedAt",
        "When approving an entry, approval timestamp, approving user, and approval level must all be specified. If not approved, approval timestamp and approving user must be blank.",
        this.ApprovedAt,
        ValidationErrorType.Failure
        ));
        }
        }', 'Ensures that approval details are complete: approval date, approving user, and approval level must all be provided together when an entry is approved, or all remain empty if not approved.', 'ValidateApprovalDetails', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ValidateApprovalLevelAndRequestedByUserID'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('306b35c1-fd5a-450a-bb61-ed328f1a817a', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([ApprovalLevel] IS NULL AND [ApprovalRequestedByUserID] IS NULL OR [ApprovalLevel] IS NOT NULL AND [ApprovalRequestedByUserID] IS NOT NULL)', 'public ValidateApprovalLevelAndRequestedByUserID(result: ValidationResult) {
        const hasApprovalLevel = this.ApprovalLevel != null && this.ApprovalLevel.trim().length > 0;
        const hasRequestedByUser = this.ApprovalRequestedByUserID != null;
        
        if ((hasApprovalLevel && !hasRequestedByUser) || (!hasApprovalLevel && hasRequestedByUser)) {
        result.Errors.push(new ValidationErrorInfo(
        "ApprovalLevel",
        "Approval level and the user requesting approval must both be provided together, or both be left blank.",
        this.ApprovalLevel,
        ValidationErrorType.Failure
        ));
        }
        }', 'Approval level and requesting user must either both be provided or both be empty, ensuring that approval requirements always record who requested the approval.', 'ValidateApprovalLevelAndRequestedByUserID', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ValidateApprovalLevelBatchAndApprovedAt'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('45d9bf52-c385-40a9-8ded-b30c702b2482', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([ApprovalLevel] IS NULL OR [ApprovedAt] IS NOT NULL OR [JournalEntryBatchID] IS NULL)', 'public ValidateApprovalLevelBatchAndApprovedAt(result: ValidationResult) {
        if (this.ApprovalLevel != null && this.JournalEntryBatchID != null && this.ApprovedAt == null) {
        result.Errors.push(new ValidationErrorInfo(
        "ApprovedAt",
        "An approval date is required for batched journal entries that have an approval level specified.",
        this.ApprovedAt,
        ValidationErrorType.Failure
        ));
        }
        }', 'Journal entries that are assigned to a batch and have an approval level specified must have an approval date recorded.', 'ValidateApprovalLevelBatchAndApprovedAt', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ValidateJournalEntryBatchIDForStatus'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('764af510-5520-4fa5-8620-f11954f22b8c', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([Status]=''Voided'' OR [Status]=''Pending'' OR [JournalEntryBatchID] IS NOT NULL)', 'public ValidateJournalEntryBatchIDForStatus(result: ValidationResult) {
        if (this.Status !== ''Voided'' && this.Status !== ''Pending'' && this.JournalEntryBatchID == null) {
        result.Errors.push(new ValidationErrorInfo(
        "JournalEntryBatchID",
        "Journal Entry Batch is required unless the entry status is Pending or Voided.",
        this.JournalEntryBatchID,
        ValidationErrorType.Failure
        ));
        }
        }', 'Journal entries must belong to a journal entry batch unless their status is Pending or Voided.', 'ValidateJournalEntryBatchIDForStatus', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ValidateStatusAndJournalEntryBatchID'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('bfc533b1-32eb-40ba-9483-89b26afcab5b', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([Status]<>''Voided'' OR [JournalEntryBatchID] IS NULL)', 'public ValidateStatusAndJournalEntryBatchID(result: ValidationResult) {
        if (this.Status === ''Voided'' && this.JournalEntryBatchID != null) {
        result.Errors.push(new ValidationErrorInfo(
        "JournalEntryBatchID",
        "A voided journal entry cannot be associated with a journal entry batch.",
        this.JournalEntryBatchID,
        ValidationErrorType.Failure
        ));
        }
        }', 'Voided journal entries cannot be assigned to a journal entry batch.', 'ValidateStatusAndJournalEntryBatchID', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ValidateVoidFieldsForStatus'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('8a4b0d81-2722-4997-b5ce-e49bb1be9480', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([Status]=''Voided'' AND [VoidReason] IS NOT NULL AND LENGTH(Trim([VoidReason]))>(0) AND [VoidedAt] IS NOT NULL AND [VoidedByUserID] IS NOT NULL OR [Status]<>''Voided'' AND [VoidReason] IS NULL AND [VoidedAt] IS NULL AND [VoidedByUserID] IS NULL)', 'public ValidateVoidFieldsForStatus(result: ValidationResult) {
        const isVoided = this.Status === ''Voided'';
        const hasVoidReason = this.VoidReason != null && this.VoidReason.trim().length > 0;
        const hasVoidedAt = this.VoidedAt != null;
        const hasVoidedBy = this.VoidedByUserID != null;
        
        if (isVoided) {
        if (!hasVoidReason || !hasVoidedAt || !hasVoidedBy) {
        result.Errors.push(new ValidationErrorInfo(
        "Status",
        "Voided entries must specify a void reason, date voided, and the user who voided the record.",
        this.Status,
        ValidationErrorType.Failure
        ));
        }
        } else {
        if (this.VoidReason != null || hasVoidedAt || hasVoidedBy) {
        result.Errors.push(new ValidationErrorInfo(
        "Status",
        "Entries that are not voided cannot have a void reason, voided date, or voided by user.",
        this.Status,
        ValidationErrorType.Failure
        ));
        }
        }
        }', 'Voided records must include a void reason, voided date, and the user who voided the record, while non-voided records must have all void-related fields left blank.', 'ValidateVoidFieldsForStatus', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762');
    END IF;
END $$;


-- ===================== Grants =====================

DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: Permissions for vwAccountingCompanyProfiles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Index for Foreign Keys for JournalEntry */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key CompanyID in table JournalEntry;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Accounting: Journal Entries */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spUpdate SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: spUpdateJournalEntry
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR JournalEntry
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: spDeleteJournalEntry
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR JournalEntry
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Accounting: Journal Entries */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to delete unneeded entity fields */


-- ===================== Comments =====================

COMMENT ON COLUMN "__mj_BizAppsAccounting"."JournalEntry"."Status" IS 'Lifecycle state: Pending | Batched | GLPosted | Voided (BA-D6). Locked after Batched; only GLPosted transition and GL-roundtrip fields may change. Voided is terminal and reached only from Pending in no batch: the entry never reaches a batch, the ERP or a balance, and it and its lines are frozen.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."JournalEntry"."VoidReason" IS 'Why this entry was voided instead of posted. Required when Status = Voided and empty otherwise (CK_JournalEntry_VoidAudit).';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."JournalEntry"."VoidedAt" IS 'When the entry was voided. Required when Status = Voided and empty otherwise.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."JournalEntry"."VoidedByUserID" IS 'User who voided the entry. Required when Status = Voided and empty otherwise.';


-- ===================== Other =====================

-- SKIPPED: triggers (auto-conversion not supported). The converter does not recognize
-- CREATE OR ALTER TRIGGER and passed these three through as-is; they are commented out here as
-- the converter comments out every other T-SQL trigger. PostgreSQL has none of the JournalEntry
-- immutability triggers they sit beside, so there the void rules rest on the CHECK constraints
-- above (status list, audit triple, no batch) and on JournalEntryEntityServer.
-- -- NOTE: unrecognized batch type (UNKNOWN) — passed through as-is
-- -- -----------------------------------------------------------------------------
-- -- 3. Only Pending → Voided, and a Voided entry is frozen
-- -- -----------------------------------------------------------------------------
-- -- trg_JournalEntry_Immutability refuses a locked entry's content changes but
-- -- not its move to a status it does not know, so Batched or GLPosted → Voided is
-- -- refused here. A new trigger rather than a fourth re-creation of that one: the
-- -- rules are about one status, and the existing trigger stays as reviewed.
-- -- THROW only, never ROLLBACK first (V202610011000).
-- -- -----------------------------------------------------------------------------
-- CREATE OR ALTER TRIGGER "__mj_BizAppsAccounting".trg_JournalEntry_VoidRules
-- ON "__mj_BizAppsAccounting"."JournalEntry"
-- AFTER INSERT, UPDATE, DELETE
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--
--     -- An entry is created Pending; Voided is reached only by voiding a Pending one.
--     -- SKIPPED: SQL Server IF EXISTS check
--
--     -- SKIPPED: SQL Server IF EXISTS check
--
--     -- A Voided entry never changes again: not its status, not its audit, not its content. Every
--     -- column but the bookkeeping ones is compared, so trgUpdateJournalEntry's own __mj_UpdatedAt
--     -- stamp (a nested update of the same row) and a Predictive Studio score still go through.
--     -- SKIPPED: SQL Server IF EXISTS check
--
--     IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted WHERE Status = 'Voided')
--     BEGIN
--         THROW 50042, 'A Voided journal entry cannot be deleted: it is the record of what was staged and why it was voided.', 1;
--     END;
-- END;
--
-- -- NOTE: unrecognized batch type (UNKNOWN) — passed through as-is
-- CREATE OR ALTER TRIGGER "__mj_BizAppsAccounting".trg_JEL_VoidedFrozen
-- ON "__mj_BizAppsAccounting"."JournalEntryLine"
-- AFTER INSERT, UPDATE, DELETE
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     -- SKIPPED: SQL Server IF EXISTS check
-- END;
--
-- -- NOTE: unrecognized batch type (UNKNOWN) — passed through as-is
-- CREATE OR ALTER TRIGGER "__mj_BizAppsAccounting".trg_JELD_VoidedFrozen
-- ON "__mj_BizAppsAccounting"."JournalEntryLineDimension"
-- AFTER INSERT, UPDATE, DELETE
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     -- SKIPPED: SQL Server IF EXISTS check
-- END;

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to update existing entities from schema */

/* spUpdate Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

/* Base View Permissions SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: Permissions for vwJournalEntries
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

/* spUpdate Permissions for MJ_BizApps_Accounting: Journal Entries */
