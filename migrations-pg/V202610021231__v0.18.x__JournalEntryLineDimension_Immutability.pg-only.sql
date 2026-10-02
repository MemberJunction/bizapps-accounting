-- =============================================================================
-- Migration: V202610021231__v0.18.x__JournalEntryLineDimension_Immutability.pg-only.sql
-- Description: #216 — PostgreSQL twins of trg_JELD_Immutability and of the
--              SealMismatchDetectedAt freeze on JournalEntryBatch.
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

-- -----------------------------------------------------------------------------
-- SealMismatchDetectedAt is set once, by the retry that records the batch Posted
-- -----------------------------------------------------------------------------
-- The PostgreSQL twin of the SEAL MISMATCH rule (50034) the T-SQL migration adds
-- to trg_JournalEntryBatch_Immutability. No PostgreSQL migration carries that
-- trigger's other rules, so this rule is its own trigger: a later port of the
-- full trigger cannot replace it and drop the rule.
--
-- The column is written only by the update that records a retried batch Posted
-- (Sent -> Posted with SendAttemptCount above 1: a first send is attempt 1), is
-- never changed or cleared once set, and is never carried by an insert.
-- Compared at millisecond precision, as on SQL Server: the entity writes
-- JavaScript dates.

CREATE OR REPLACE FUNCTION __mj_BizAppsAccounting."fn_trg_JournalEntryBatch_SealMismatchFreeze"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW."SealMismatchDetectedAt" IS NOT NULL)
       OR (
           TG_OP = 'UPDATE'
           AND OLD."SealMismatchDetectedAt" IS NOT NULL
           AND (
               NEW."SealMismatchDetectedAt" IS NULL
               OR ABS(EXTRACT(EPOCH FROM (NEW."SealMismatchDetectedAt" - OLD."SealMismatchDetectedAt"))) >= 0.001
           )
       )
       OR (
           TG_OP = 'UPDATE'
           AND OLD."SealMismatchDetectedAt" IS NULL
           AND NEW."SealMismatchDetectedAt" IS NOT NULL
           AND NOT (OLD."Status" = 'Sent' AND NEW."Status" = 'Posted' AND NEW."SendAttemptCount" > 1)
       )
    THEN
        RAISE EXCEPTION 'JournalEntryBatch SealMismatchDetectedAt refused. It is set only by the update that records a retried batch Posted (Sent -> Posted, SendAttemptCount above 1), and once set it is never changed or cleared.'
            USING ERRCODE = 'P0001', DETAIL = '50034';
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER "trg_JournalEntryBatch_SealMismatchFreeze"
AFTER INSERT OR UPDATE ON __mj_BizAppsAccounting."JournalEntryBatch"
FOR EACH ROW
EXECUTE FUNCTION __mj_BizAppsAccounting."fn_trg_JournalEntryBatch_SealMismatchFreeze"();
