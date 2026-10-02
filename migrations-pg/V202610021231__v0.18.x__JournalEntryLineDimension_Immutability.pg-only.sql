-- =============================================================================
-- Migration: V202610021231__v0.18.x__JournalEntryLineDimension_Immutability.pg-only.sql
-- Description: #216 — PostgreSQL twin of trg_JELD_Immutability.
-- =============================================================================
--
-- WHY A PG-ONLY FILE
--
-- V202610021230__v0.18.x__JournalEntryLineDimension_Immutability_SealMismatch
-- creates trg_JELD_Immutability on SQL Server. The SQL converter does not
-- convert triggers (its .pg.sql output marks the trigger SKIPPED), so the
-- PostgreSQL trigger is written here by hand. It carries the same rule: a
-- dimension tag on a line whose journal entry is Batched or GLPosted cannot be
-- inserted, modified or deleted.
--
-- A row-level AFTER trigger: PostgreSQL has no inserted / deleted pseudo-tables
-- for a trigger that fires on more than one event, so each row checks its own
-- line (the new one and, on update or delete, the old one).
--
-- Runs after the converted V202610021230 file, once, in order.
-- =============================================================================

CREATE OR REPLACE FUNCTION __mj_BizAppsAccounting."fn_trg_JELD_Immutability"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_line_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_line_ids := v_line_ids || NEW."JournalEntryLineID";
    END IF;
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        v_line_ids := v_line_ids || OLD."JournalEntryLineID";
    END IF;

    IF EXISTS (
        SELECT 1
          FROM __mj_BizAppsAccounting."JournalEntryLine" jel
          JOIN __mj_BizAppsAccounting."JournalEntry" je ON je."ID" = jel."JournalEntryID"
         WHERE jel."ID" = ANY (v_line_ids)
           AND je."Status" IN ('Batched', 'GLPosted')
    ) THEN
        RAISE EXCEPTION 'JournalEntryLineDimension on a locked JournalEntry (Status=Batched/GLPosted) cannot be inserted, modified, or deleted. Use the reversal pattern.'
            USING ERRCODE = 'P0001', DETAIL = '50033';
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER "trg_JELD_Immutability"
AFTER INSERT OR UPDATE OR DELETE ON __mj_BizAppsAccounting."JournalEntryLineDimension"
FOR EACH ROW
EXECUTE FUNCTION __mj_BizAppsAccounting."fn_trg_JELD_Immutability"();
