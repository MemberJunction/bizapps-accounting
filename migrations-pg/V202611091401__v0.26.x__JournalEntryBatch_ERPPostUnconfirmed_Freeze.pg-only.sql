-- =============================================================================
-- Migration: V202611091401__v0.26.x__JournalEntryBatch_ERPPostUnconfirmed_Freeze.pg-only.sql
-- Description: #414 — PostgreSQL twin of the ERPPostUnconfirmedAt rule (50040)
--              on JournalEntryBatch.
-- =============================================================================
--
-- WHY A PG-ONLY FILE
--
-- V202611091400__v0.26.x__Post_GoLive_Schema_and_Metadata_Sync updates
-- trg_JournalEntryBatch_Immutability on SQL Server to enforce the transition
-- rule on ERPPostUnconfirmedAt. The SQL converter does not convert triggers
-- (its .pg.sql output marks the trigger SKIPPED), so the PostgreSQL trigger is
-- written here by hand.
--
-- ERPPostUnconfirmedAt is written only when a Sent batch fails (Sent -> Failed),
-- cleared only when a Failed batch is re-sent or cancelled (Failed -> Sent or
-- Cancelled), and never changed in any other update or carried on insert.
-- Compared at millisecond precision, as on SQL Server: the entity writes
-- JavaScript dates.
--
-- Runs after the converted V202611091400 file, once, in order.
-- =============================================================================

CREATE OR REPLACE FUNCTION "__mj_BizAppsAccounting"."fn_trg_JournalEntryBatch_ERPPostUnconfirmedFreeze"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW."ERPPostUnconfirmedAt" IS NOT NULL)
       OR (
           TG_OP = 'UPDATE'
           AND OLD."ERPPostUnconfirmedAt" IS NULL
           AND NEW."ERPPostUnconfirmedAt" IS NOT NULL
           AND NOT (OLD."Status" = 'Sent' AND NEW."Status" = 'Failed')
       )
       OR (
           TG_OP = 'UPDATE'
           AND OLD."ERPPostUnconfirmedAt" IS NOT NULL
           AND NEW."ERPPostUnconfirmedAt" IS NULL
           AND NOT (OLD."Status" = 'Failed' AND NEW."Status" IN ('Sent', 'Cancelled'))
       )
       OR (
           TG_OP = 'UPDATE'
           AND OLD."ERPPostUnconfirmedAt" IS NOT NULL
           AND NEW."ERPPostUnconfirmedAt" IS NOT NULL
           AND ABS(EXTRACT(EPOCH FROM (NEW."ERPPostUnconfirmedAt" - OLD."ERPPostUnconfirmedAt"))) >= 0.001
           AND NOT (OLD."Status" = 'Sent' AND NEW."Status" = 'Failed')
       )
    THEN
        RAISE EXCEPTION 'JournalEntryBatch ERPPostUnconfirmedAt refused. It is set only when a Sent batch fails (Sent -> Failed), cleared only when a Failed batch is re-sent or cancelled, and never modified otherwise.'
            USING ERRCODE = 'P0001', DETAIL = '50040';
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER "trg_JournalEntryBatch_ERPPostUnconfirmedFreeze"
AFTER INSERT OR UPDATE ON "__mj_BizAppsAccounting"."JournalEntryBatch"
FOR EACH ROW
EXECUTE FUNCTION "__mj_BizAppsAccounting"."fn_trg_JournalEntryBatch_ERPPostUnconfirmedFreeze"();
