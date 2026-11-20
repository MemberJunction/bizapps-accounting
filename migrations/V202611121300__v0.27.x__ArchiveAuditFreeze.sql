-- =============================================================================
-- Migration: V202611121300__v0.27.x__ArchiveAuditFreeze.sql
-- Description: an Archived batch's archive audit (ArchiveReason, ArchivedAt,
--              ArchivedByUserID) is written only by the update that archives it.
-- DETERMINISTIC, NOT IDEMPOTENT: runs once, after V202610021230.
-- =============================================================================
--
-- WHY
--
-- Archived is terminal: the batch never posts to the ERP and its entries stay
-- locked to it, so ArchiveReason is the only record of why. The cancel audit is
-- frozen once a batch is Cancelled (50032 and 50009), but the archive audit was
-- not: a raw UPDATE could rewrite the reason, who archived the batch, or when,
-- on a batch that was already Archived.
--
-- WHAT CHANGES
--
-- trg_JournalEntryBatch_Immutability is the V202610021230 body verbatim, with
-- one rule added to AUDIT (50032), mirroring the cancel audit's: ArchiveReason,
-- ArchivedAt and ArchivedByUserID may change only in the update that moves the
-- batch from another status to Archived (JournalEntryBatchEntityServer.Archive).
-- That also refuses stamping an archive audit on a batch that is not being
-- archived. ArchivedAt compares at millisecond precision, like the other
-- timestamps here, because every entity save writes it back through a
-- JavaScript Date. The 50032 and 50009 messages say so.
--
-- EXISTING DATA
--
-- No row changes. The rule applies to updates only, so Archived batches already
-- in the table keep the audit they carry, and a later save that does not touch
-- those three columns passes as before.
--
-- PostgreSQL: no trg_JournalEntryBatch_Immutability exists there (the converter skipped
-- V202610021230's), so the .pg.sql counterpart carries this trigger commented out.
-- =============================================================================
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JournalEntryBatch_Immutability
ON __mj_BizAppsAccounting.JournalEntryBatch
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
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE i.Status <> d.Status
          AND (
            d.Status IN ('Posted','Cancelled','Archived')
            OR i.Status = 'Pending'
            OR (i.Status = 'Approved' AND d.Status <> 'Pending')
            OR (i.Status = 'Archived' AND d.Status NOT IN ('Pending','Approved','Failed'))
            OR (i.Status = 'Cancelled' AND d.Status NOT IN ('Pending','Approved','Failed'))
            OR (i.Status = 'Cancelled' AND i.SummaryJournalEntryID IS NOT NULL)
            OR (i.Status IN ('Posted','Failed') AND d.Status <> 'Sent')
          )
    )
    BEGIN
        THROW 50031, 'JournalEntryBatch status change refused. Posted, Cancelled and Archived are terminal; no batch returns to Pending; only a Pending batch is approved; Posted and Failed are reachable only from Sent; Archived is reachable only from Pending, Approved or Failed; Cancelled is reachable only from Pending, Approved or Failed; and a batch is cancelled only with its summary pointer cleared (JournalEntryBatchEntityServer.Cancel).', 1;
    END;

    -- AUDIT: the cancel audit and the ERP check are written only by the update that cancels the
    -- batch, so no other save can stamp a "not posted in the ERP" record on it; likewise the archive
    -- audit (ArchiveReason / ArchivedAt / ArchivedByUserID) is written only by the update that
    -- archives the batch, so the record of why it never posts cannot be rewritten; and SentAt, once set,
    -- is never cleared, because it is the evidence CK_JournalEntryBatch_CancelERPCheck keys on. A
    -- retry re-stamps SentAt with a new time, which is allowed.
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE (d.SentAt IS NOT NULL AND i.SentAt IS NULL)
           OR (
               NOT (i.Status = 'Cancelled' AND d.Status <> 'Cancelled')
               AND (
                   ISNULL(i.CancelReason,                  N'')                                    <> ISNULL(d.CancelReason,                  N'')                                    OR
                   (CASE WHEN i.CancelledAt IS NULL AND d.CancelledAt IS NULL THEN 0 WHEN i.CancelledAt IS NULL OR d.CancelledAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.CancelledAt, d.CancelledAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                   ISNULL(i.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') <> ISNULL(d.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') OR
                   (CASE WHEN i.ERPNotPostedConfirmedAt IS NULL AND d.ERPNotPostedConfirmedAt IS NULL THEN 0 WHEN i.ERPNotPostedConfirmedAt IS NULL OR d.ERPNotPostedConfirmedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ERPNotPostedConfirmedAt, d.ERPNotPostedConfirmedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                   ISNULL(i.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000') OR
                   ISNULL(i.ERPNotPostedBasis,             N'')                                    <> ISNULL(d.ERPNotPostedBasis,             N'')
               )
           )
           OR (
               NOT (i.Status = 'Archived' AND d.Status <> 'Archived')
               AND (
                   ISNULL(i.ArchiveReason,                 N'')                                    <> ISNULL(d.ArchiveReason,                 N'')                                    OR
                   (CASE WHEN i.ArchivedAt IS NULL AND d.ArchivedAt IS NULL THEN 0 WHEN i.ArchivedAt IS NULL OR d.ArchivedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ArchivedAt, d.ArchivedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                   ISNULL(i.ArchivedByUserID,              '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ArchivedByUserID,              '00000000-0000-0000-0000-000000000000')
               )
           )
    )
    BEGIN
        THROW 50032, 'JournalEntryBatch audit refused. CancelReason / CancelledAt / CancelledByUserID and ERPNotPostedConfirmedAt / ERPNotPostedConfirmedByUserID / ERPNotPostedBasis are written only by the update that cancels the batch, ArchiveReason / ArchivedAt / ArchivedByUserID only by the update that archives it, and SentAt is never cleared once set.', 1;
    END;

    -- CONTENT: frozen from approval on, Failed and Cancelled included. The timestamps this migration
    -- freezes compare at millisecond precision: every entity save writes each column back through a
    -- JavaScript Date, so a value written by SQL with sub-millisecond digits would otherwise read as
    -- changed on the next ordinary save.
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Approved','Sent','Posted','Failed','Archived','Cancelled')
          AND (
            i.JournalEntryBatchNumber          <> d.JournalEntryBatchNumber          OR
            i.CompanyID            <> d.CompanyID            OR
            i.PostingDate          <> d.PostingDate          OR
            -- The summary pointer is frozen, except for the one sanctioned change: an Approved or
            -- Failed batch clearing it in the same update that marks it Cancelled.
            (
                ISNULL(i.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000')
                AND NOT (
                    d.Status IN ('Approved','Failed')
                    AND i.Status = 'Cancelled'
                    AND i.SummaryJournalEntryID IS NULL
                )
            ) OR
            ISNULL(i.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') OR
            (CASE WHEN i.ApprovedAt IS NULL AND d.ApprovedAt IS NULL THEN 0 WHEN i.ApprovedAt IS NULL OR d.ApprovedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ApprovedAt, d.ApprovedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
            ISNULL(i.ApprovedByUserID,      '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ApprovedByUserID,      '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ApprovedContentHash,   N'')                                    <> ISNULL(d.ApprovedContentHash,   N'')                                    OR
            i.TargetSystem         <> d.TargetSystem         OR
            i.BatchedAt            <> d.BatchedAt            OR
            i.BatchedByUserID      <> d.BatchedByUserID      OR
            i.TotalEntries         <> d.TotalEntries         OR
            i.TotalDebits          <> d.TotalDebits          OR
            i.TotalCredits         <> d.TotalCredits         OR
            -- Once Cancelled, the cancel audit and the ERP-check attestation are the record; they freeze too.
            (
                d.Status = 'Cancelled'
                AND (
                    ISNULL(i.CancelReason,                  N'')                                    <> ISNULL(d.CancelReason,                  N'')                                    OR
                    (CASE WHEN i.CancelledAt IS NULL AND d.CancelledAt IS NULL THEN 0 WHEN i.CancelledAt IS NULL OR d.CancelledAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.CancelledAt, d.CancelledAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                    ISNULL(i.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') <> ISNULL(d.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') OR
                    (CASE WHEN i.ERPNotPostedConfirmedAt IS NULL AND d.ERPNotPostedConfirmedAt IS NULL THEN 0 WHEN i.ERPNotPostedConfirmedAt IS NULL OR d.ERPNotPostedConfirmedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ERPNotPostedConfirmedAt, d.ERPNotPostedConfirmedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                    ISNULL(i.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000')
                )
            )
          )
    )
    BEGIN
        THROW 50009, 'JournalEntryBatch is locked (Status=Approved/Sent/Posted/Failed/Archived/Cancelled). Only Status / PostedAt / ExternalJournalEntryBatchRef / ErrorMessage may evolve; the send stamp (SentAt / SentByUserID / SendAttemptCount) changes only on a send (50030); the Cancel audit and ERP check are written only by the update that cancels the batch, and the Archive audit only by the update that archives it (50032). CompanyID, PostingDate, SummaryJournalEntryID, the approval-task pointer, ApprovedAt / ApprovedByUserID and ApprovedContentHash freeze at approval; the summary pointer may clear only as an Approved or Failed batch is Cancelled.', 1;
    END;

    -- SEAL MISMATCH (#216): SealMismatchDetectedAt is written only by the update that records a
    -- retried batch Posted from the ERP, and once set it never changes or clears. A retry is a send
    -- from Failed; a first send from Approved is attempt 1, so Sent -> Posted with SendAttemptCount
    -- above 1 is the one update that may set it. A new batch carries none. Compared at millisecond
    -- precision, as above. THROW with no ROLLBACK, so an entity save reports this message, not 3915.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN deleted d ON d.ID = i.ID
        WHERE (d.ID IS NULL AND i.SealMismatchDetectedAt IS NOT NULL)
           OR (
               d.SealMismatchDetectedAt IS NOT NULL
               AND (i.SealMismatchDetectedAt IS NULL OR ABS(DATEDIFF_BIG(MICROSECOND, i.SealMismatchDetectedAt, d.SealMismatchDetectedAt)) >= 1000)
           )
           OR (
               d.ID IS NOT NULL
               AND d.SealMismatchDetectedAt IS NULL
               AND i.SealMismatchDetectedAt IS NOT NULL
               AND NOT (d.Status = 'Sent' AND i.Status = 'Posted' AND i.SendAttemptCount > 1)
           )
    )
        THROW 50034, 'JournalEntryBatch SealMismatchDetectedAt refused. It is set only by the update that records a retried batch Posted (Sent -> Posted, SendAttemptCount above 1), and once set it is never changed or cleared.', 1;
END;
GO
