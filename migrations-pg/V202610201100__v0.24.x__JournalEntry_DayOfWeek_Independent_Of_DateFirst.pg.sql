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


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsAccounting';
  v_target_name CONSTANT TEXT := 'vwJournalEntries';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_BizAppsAccounting"."vwJournalEntries"
AS SELECT
    g.*,
    -- Engineered features for Predictive Studio anomaly detection modeling
    -- AnomalyOutcome heuristic: Reversals or unlinked ledger adjustments represent
    -- high-risk audit flags. These signals are withheld from the training feature
    -- set (TotalDebitAmount, LineCount, EffectiveMonth, EffectiveDayOfWeek, IsWeekend)
    -- to prevent target leakage.
    CASE
        WHEN g."ReversesJournalEntryID" IS NOT NULL
          OR g."ReversedByJournalEntryID" IS NOT NULL
          OR (g."LinkedRecordID" IS NULL AND g."LinkedEntityID" IS NULL)
        THEN 'Anomalous'
        ELSE 'Normal'
    END AS "AnomalyOutcome",
    COALESCE(agg."TotalDebitAmount", 0) AS "TotalDebitAmount",
    COALESCE(agg."LineCount", 0) AS "LineCount",
    EXTRACT(MONTH FROM g."EffectiveDate") AS "EffectiveMonth",
    -- 1 = Sunday through 7 = Saturday whatever the session's DATEFIRST (#395).
    -- 1 January 1900 was a Monday.
    (EXTRACT(DAY FROM (g."EffectiveDate"::TIMESTAMPTZ - '19000101'::TIMESTAMPTZ)) + 1) % 7 + 1 AS "EffectiveDayOfWeek",
    CASE WHEN EXTRACT(DAY FROM (g."EffectiveDate"::TIMESTAMPTZ - '19000101'::TIMESTAMPTZ)) % 7 IN (5, 6) THEN 1 ELSE 0 END AS "IsWeekend",
    CASE WHEN g."LinkedRecordID" IS NOT NULL THEN 1 ELSE 0 END AS "HasLinkedRecord",
    CASE WHEN g."FileID" IS NOT NULL THEN 1 ELSE 0 END AS "HasFile"
FROM
    "__mj_BizAppsAccounting"."vwJournalEntriesGenerated" AS g
LEFT OUTER JOIN (
    SELECT
        jel."JournalEntryID",
        SUM(jel."DebitAmount") AS "TotalDebitAmount",
        COUNT(*) AS "LineCount"
    FROM "__mj_BizAppsAccounting"."JournalEntryLine" jel
    GROUP BY "jel"."JournalEntryID"
) AS "agg" ON agg."JournalEntryID" = g."ID"$vsql$;
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
