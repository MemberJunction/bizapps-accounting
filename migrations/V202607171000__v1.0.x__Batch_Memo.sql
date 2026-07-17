-- =============================================================================
-- Naming/memo model (Marcelo 2026-07-17) — JournalEntryBatch gets a Memo.
--
-- The ratified model: TRANSACTIONS are identified by a number + carry a free-text
-- MEMO for meaning (how every real accounting system works — QuickBooks/NetSuite/
-- BC all pair a document number with a "Memo"); MASTER DATA carries names. A batch
-- keeps its agreed sequential `BatchNumber` (the D-SEQ id) as its identity; this
-- Memo is purely for findability — "what was this batch for" — so a user can label
-- and search a batch by something human, without touching the number scheme.
--
-- JournalEntry already has a Memo and Order already has a Description, so this batch
-- column is the ONLY schema change the whole naming/memo feature needs.
--
-- Idempotent by construction (guarded ADD + guarded extended-property) so it is
-- upsert-safe: re-running it, or later folding this column into the baseline
-- CREATE TABLE and keeping this file, can never double-add or error. That is what
-- lets us apply it now WITHOUT a drop-and-remigrate of the working instance.
-- =============================================================================

IF COL_LENGTH('__mj_BizAppsAccounting.JournalEntryBatch', 'Memo') IS NULL
BEGIN
    ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch ADD
        Memo NVARCHAR(500) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('__mj_BizAppsAccounting.JournalEntryBatch')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('__mj_BizAppsAccounting.JournalEntryBatch'), 'Memo', 'ColumnId')
      AND name = 'MS_Description'
)
BEGIN
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Optional free-text memo describing what this batch is for. NOT the batch identity — that is BatchNumber (the agreed sequential id). The memo exists purely so a user can label a batch and find it again by a human phrase; it is surfaced in the batch lists + workspace and included in name/id search. Nullable and editable pre-build.',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
        @level1type = N'TABLE',  @level1name = N'JournalEntryBatch',
        @level2type = N'COLUMN', @level2name = N'Memo';
END
GO
