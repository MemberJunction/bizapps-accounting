-- =============================================================================
-- Drop the orphaned Journal Entry hierarchy artifacts
-- =============================================================================
--
-- WHAT IS WRONG. On a clean install of this branch, `Journal Entries` declares 26
-- EntityFields while `vwJournalEntries` projects 24 columns. MJ rejects a save when the
-- two disagree, so every save on the entity fails. Reproduced from zero on 2026-08-26:
-- MJ core + common + tasks + accounting migrations, `mj sync push` (0 errors), `mj codegen`.
--
-- WHY IT HAPPENS. MJ PR #3948 gated recursive-hierarchy generation behind
-- EntityField.Configuration.Hierarchy.IsHierarchy. Journal Entries' two reversal pointers
-- (ReversesJournalEntryID, ReversedByJournalEntryID) are linear pointers, not trees, so they
-- are correctly NOT opted in by metadata/entities/.entity-field-hierarchy-configurations.json
-- and CodeGen no longer projects their Root* columns.
--
-- CodeGen stopping EMITTING them is not the same as REMOVING what an earlier CodeGen wrote.
-- The baseline (B202605281200) creates two RootID TVFs and INSERTs two EntityField rows, and
-- nothing prunes them: CodeGen's own cleanup, `spDeleteUnneededEntityFields`, deletes fields
-- that are "NOT virtual and not part of the underlying VIEW or TABLE" — and these fields ARE
-- virtual, so they fall outside it by design. There is therefore no self-healing path; the
-- rows persist until something deletes them deliberately. Hence this migration.
--
-- ORDERING MATTERS. This must run AFTER V202608252220__CodeGen_Scoped_SQL_Objects, which still
-- recreates vwJournalEntries WITH the Root* columns and therefore still references these TVFs
-- (line ~2751: `root_ReversesJournalEntryID.RootID AS [RootReversesJournalEntryID]`). Timestamped
-- earlier, this migration dropped the functions out from under that view and the run failed with
-- `Invalid object name '...fnJournalEntryReversesJournalEntryID_GetRootID'`. Hence the 2026-08-26
-- stamp rather than 08-24.
--
-- That stale view definition is the upstream cause worth fixing: while it ships, every clean
-- install recreates the Root* columns and the 26-vs-24 mismatch returns until CodeGen runs.
--
-- SCOPE. Cleanup ONLY. Regenerating the affected views/procs is CodeGen's job and is captured
-- separately — this deletes exactly the artifacts that CodeGen can no longer reach.
-- Idempotent, and a no-op on a database where they were never created.
-- =============================================================================

-- ── 1. the two orphaned RootID table-valued functions ────────────────────────
-- Nothing references these once vwJournalEntries is regenerated without the Root* columns.

IF OBJECT_ID('[${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetRootID]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetRootID];
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetRootID]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetRootID];
GO

-- ── 2. the two orphaned EntityField rows ─────────────────────────────────────
-- Matched by EntityID + Name so the delete is precise, and scoped so it is a silent no-op
-- when the rows are already gone or when CodeGen metadata was never seeded here.

DECLARE @JournalEntryEntityID UNIQUEIDENTIFIER =
    (SELECT TOP 1 [ID] FROM [${mjSchema}].[Entity]
     WHERE [SchemaName] = '${flyway:defaultSchema}' AND [BaseTable] = 'JournalEntry');

IF @JournalEntryEntityID IS NOT NULL
BEGIN
    DECLARE @OrphanFieldIDs TABLE ([ID] UNIQUEIDENTIFIER);

    INSERT INTO @OrphanFieldIDs ([ID])
    SELECT [ID] FROM [${mjSchema}].[EntityField]
    WHERE [EntityID] = @JournalEntryEntityID
      AND [Name] IN ('RootReversesJournalEntryID', 'RootReversedByJournalEntryID');

    IF EXISTS (SELECT 1 FROM @OrphanFieldIDs)
    BEGIN
        DELETE FROM [${mjSchema}].[EntityFieldValue]
        WHERE [EntityFieldID] IN (SELECT [ID] FROM @OrphanFieldIDs);

        DELETE FROM [${mjSchema}].[EntityField]
        WHERE [ID] IN (SELECT [ID] FROM @OrphanFieldIDs);
    END
END
GO
