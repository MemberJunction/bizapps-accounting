-- =============================================================================
-- Migration: V202610201030__v0.24.x__JournalEntry_Numbering_Functions.pg-only.sql
-- Description: #343 — PostgreSQL twins of spAssignNextJournalEntryNumber and
--              spAssignNextJournalEntryBatchNumber.
-- =============================================================================
--
-- WHY A PG-ONLY FILE
--
-- The two numbering procedures live in the T-SQL baseline
-- (B202605281200__v0.1.x__Schema_and_Tables.sql, section 5). They return the
-- number through an OUTPUT parameter and lock the counter row with
-- HOLDLOCK + UPDLOCK; the SQL converter translates neither, so the PostgreSQL
-- functions are written here by hand.
--
-- Same names, same number formats and the same gap-free rule as on SQL Server:
--   spAssignNextJournalEntryNumber(company, fiscal year) -> 'JE-{CompanyCode}-{FY}-{seq:000000}'
--   spAssignNextJournalEntryBatchNumber()               -> 'BATCH-{seq:000000}'
--
-- Each counter is read and advanced by one INSERT ... ON CONFLICT DO UPDATE,
-- which takes the row lock that HOLDLOCK + UPDLOCK takes on SQL Server: two
-- concurrent saves serialize on the counter row and never get the same number.
-- A function runs inside its caller's transaction, so a save that rolls back
-- also rolls back the number it took — no gap, as on SQL Server, where the
-- procedure's own transaction nests inside the save's.
--
-- The names are created quoted because the PostgreSQL provider quotes a
-- dot-qualified name when it runs SequenceService's SELECT.
--
-- Needs the PostgreSQL counterpart of the baseline (the JournalEntrySequence,
-- JournalEntryBatchSequence and AccountingCompanyProfile tables), so it runs
-- after that counterpart, once, in order.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Journal entry number: per company, per fiscal year
-- -----------------------------------------------------------------------------
CREATE FUNCTION __mj_BizAppsAccounting."spAssignNextJournalEntryNumber"(
    p_company_id UUID,
    p_fiscal_year INTEGER
)
RETURNS VARCHAR(40)
LANGUAGE plpgsql
AS $$
DECLARE
    v_company_code VARCHAR(20);
    v_next_seq INTEGER;
BEGIN
    SELECT "CompanyCode" INTO v_company_code
      FROM __mj_BizAppsAccounting."AccountingCompanyProfile"
     WHERE "ID" = p_company_id;
    IF v_company_code IS NULL THEN
        RAISE EXCEPTION 'spAssignNextJournalEntryNumber: no AccountingCompanyProfile exists for @CompanyID (the company must be accounting-enabled before JEs can be numbered).'
            USING ERRCODE = 'P0001', DETAIL = '50020';
    END IF;

    INSERT INTO __mj_BizAppsAccounting."JournalEntrySequence" AS s ("CompanyID", "FiscalYear", "NextSequenceNumber")
    VALUES (p_company_id, p_fiscal_year, 2)
    ON CONFLICT ("CompanyID", "FiscalYear")
    DO UPDATE SET "NextSequenceNumber" = s."NextSequenceNumber" + 1
    RETURNING s."NextSequenceNumber" - 1 INTO v_next_seq;

    RETURN 'JE-' || v_company_code || '-' || p_fiscal_year::TEXT || '-' || RIGHT('000000' || v_next_seq::TEXT, 6);
END;
$$;

-- -----------------------------------------------------------------------------
-- Journal entry batch number: one global counter (batches are multi-company)
-- -----------------------------------------------------------------------------
CREATE FUNCTION __mj_BizAppsAccounting."spAssignNextJournalEntryBatchNumber"()
RETURNS VARCHAR(40)
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_seq INTEGER;
BEGIN
    INSERT INTO __mj_BizAppsAccounting."JournalEntryBatchSequence" AS s ("ID", "NextSequenceNumber")
    VALUES (1, 2)
    ON CONFLICT ("ID")
    DO UPDATE SET "NextSequenceNumber" = s."NextSequenceNumber" + 1
    RETURNING s."NextSequenceNumber" - 1 INTO v_next_seq;

    RETURN 'BATCH-' || RIGHT('000000' || v_next_seq::TEXT, 6);
END;
$$;

-- -----------------------------------------------------------------------------
-- EXECUTE grants, to the roles the baseline grants on SQL Server (section 5.2.1).
-- Written in the form the converter emits for every grant: a host without the
-- cdp roles skips the grant instead of failing the migration.
-- -----------------------------------------------------------------------------
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spAssignNextJournalEntryNumber"(UUID, INTEGER) TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spAssignNextJournalEntryBatchNumber"() TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
