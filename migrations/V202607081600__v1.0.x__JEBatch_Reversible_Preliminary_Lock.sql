-- =============================================================================
-- JournalEntry immutability: LEVELS OF LOCKING (preliminary vs permanent)
-- -----------------------------------------------------------------------------
-- Robert 2026-07-08 (task #12; plan plans/batch-approval-lock-redesign.md, Option A):
-- A journal entry that is Batched into a batch that is STILL PENDING (unapproved) is
-- only PRELIMINARILY locked — reversible back to the candidate pool. Once the batch is
-- APPROVED, the lock becomes PERMANENT (GL summary must tie back to unchanged detail).
--
-- This reworks trg_JournalEntry_Immutability so the row is byte-for-byte identical to
-- an external viewer (still Status='Batched'), but the SANCTIONED reversal —
-- Status Batched→Pending AND BatchID→NULL, and NOTHING else, while the owning batch is
-- still Pending — is permitted. Every other mutation on a locked JE stays blocked, and
-- a JE whose batch is Approved/Sent/Posted (or GLPosted itself) is permanently frozen.
--
-- Option A = derive the lock level from the batch's approval state (single source of
-- truth), so approve/reject touch only the batch and the JE lock level follows.
--
-- SQL Server only for now — the PostgreSQL counterpart is produced at the PG cutover
-- (fast-prototype phase; see plan §9). Supersedes the trigger body in the baseline
-- migration B202605281200 (section 4.3).
-- =============================================================================

IF OBJECT_ID('__mj_BizAppsAccounting.trg_JournalEntry_Immutability', 'TR') IS NOT NULL
    DROP TRIGGER __mj_BizAppsAccounting.trg_JournalEntry_Immutability;
GO

CREATE TRIGGER __mj_BizAppsAccounting.trg_JournalEntry_Immutability
ON __mj_BizAppsAccounting.JournalEntry
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- DELETE: block if any deleted row was locked (unchanged from baseline).
    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted WHERE Status IN ('Batched','GLPosted'))
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50003, 'JournalEntry cannot be deleted once Status is Batched or GLPosted. Use the reversal pattern (new Pending JE with ReversesJournalEntryID).', 1;
    END;

    -- UPDATE: block changes to frozen fields when previous Status was locked.
    -- Allowed on a locked row: GLPostedAt, GLReferenceID, ReversedByJournalEntryID, and Status moving
    -- Batched→GLPosted. NEW (levels of locking): the reversible PRELIMINARY unlock — Status Batched→Pending
    -- with BatchID→NULL, while the owning batch is still Pending — is also allowed, but it may change ONLY
    -- Status + BatchID (any other frozen field changing in the same update is still blocked).
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Batched','GLPosted')
          AND (
            -- (A) any frozen field OTHER THAN BatchID changed → never allowed on a locked row
            i.EntryNumber                 <> d.EntryNumber                 OR
            i.EffectiveDate               <> d.EffectiveDate               OR
            i.EntryType                   <> d.EntryType                   OR
            ISNULL(CAST(i.Description AS NVARCHAR(MAX)),N'') <> ISNULL(CAST(d.Description AS NVARCHAR(MAX)),N'') OR
            ISNULL(i.OrderID,                  '00000000-0000-0000-0000-000000000000') <> ISNULL(d.OrderID,                  '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.OrderLineID,              '00000000-0000-0000-0000-000000000000') <> ISNULL(d.OrderLineID,              '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.SubscriptionID,           '00000000-0000-0000-0000-000000000000') <> ISNULL(d.SubscriptionID,           '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.PaymentID,                '00000000-0000-0000-0000-000000000000') <> ISNULL(d.PaymentID,                '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ContractID,               '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ContractID,               '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.RevRecScheduleID,         '00000000-0000-0000-0000-000000000000') <> ISNULL(d.RevRecScheduleID,         '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.IntercompanyFlowID,       '00000000-0000-0000-0000-000000000000') <> ISNULL(d.IntercompanyFlowID,       '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ScheduledJournalEntryID,  '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ScheduledJournalEntryID,  '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.TaxRemittanceID,          '00000000-0000-0000-0000-000000000000') <> ISNULL(d.TaxRemittanceID,          '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ReversesJournalEntryID,   '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ReversesJournalEntryID,   '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.FileID,                   '00000000-0000-0000-0000-000000000000') <> ISNULL(d.FileID,                   '00000000-0000-0000-0000-000000000000') OR
            -- (B) BatchID changed, and this is NOT the sanctioned reversible preliminary unlock
            (
                ISNULL(i.BatchID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.BatchID, '00000000-0000-0000-0000-000000000000')
                AND NOT (
                    d.Status = 'Batched'
                    AND i.Status = 'Pending'
                    AND i.BatchID IS NULL
                    AND EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.JournalEntryBatch b WHERE b.ID = d.BatchID AND b.Status = 'Pending')
                )
            )
          )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50004, 'JournalEntry is locked (Status=Batched/GLPosted). Only GLPostedAt, GLReferenceID, ReversedByJournalEntryID, Status (Batched→GLPosted), and the reversible unlock (Batched→Pending + BatchID→NULL while the batch is still Pending) may change.', 1;
    END;

    -- Disallow regressing Status backwards on a locked row. Batched→Pending is permitted ONLY as the
    -- reversible preliminary unlock (BatchID cleared, owning batch still Pending); GLPosted never regresses.
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE (d.Status = 'GLPosted' AND i.Status IN ('Pending','Batched'))
           OR (
               d.Status = 'Batched' AND i.Status = 'Pending'
               AND NOT (
                   i.BatchID IS NULL
                   AND EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.JournalEntryBatch b WHERE b.ID = d.BatchID AND b.Status = 'Pending')
               )
           )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50005, 'JournalEntry Status cannot regress (only Pending→Batched, Batched→GLPosted, and the reversible Batched→Pending unlock of an unapproved batch are allowed).', 1;
    END;
END;
GO
