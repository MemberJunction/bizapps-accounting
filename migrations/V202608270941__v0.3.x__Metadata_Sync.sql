-- =============================================================================
-- Metadata Sync — JE Batches tab chrome on the Task form
-- =============================================================================
--
-- Captures metadata/entity-relationships/.form-chrome.json's record for the
-- Task form's "Journal Entry Batches this task approved" tab (inclusion: More)
-- so migrations-only installs get it without an `mj sync push`. Counterpart to
-- bizapps-tasks#54, which removes this record from Tasks (Tasks metadata must
-- not name Accounting; the unresolvable @lookup rolled back Tasks' entire
-- metadata push on installs without Accounting).
--
-- WHY NOT A RAW CAPTURE. The Tasks -> Journal Entry Batches relationship row is
-- NOT authored with a stable ID: it is created mid-migrate by a CodeGen heal
-- EXEC discovering the ApprovalTaskID FK, with NEWID() — a different ID on
-- every install. The emitted `mj sync push` SQL updates by that ID and would
-- silently no-op everywhere else. Resolve the row by its natural key instead:
-- both Entity IDs ARE stable (Tasks' entity ships in bizapps-tasks migrations;
-- Journal Entry Batches ships in this app's baseline), and the heal that
-- creates the row runs earlier in this app's own migration sequence, so the
-- row exists by the time this V executes on a fresh install.
--
-- The Configuration literal matches the MetadataSync push output byte for byte
-- (push_2026-08-27T14-27-22-962Z.sql) so a subsequent push sees no drift.
-- =============================================================================

DECLARE @RelID UNIQUEIDENTIFIER = (
    SELECT [ID]
    FROM [${mjSchema}].[EntityRelationship]
    WHERE [EntityID] = 'B348FFA2-B1A7-4AC2-B6FD-F4E0C0697466'        -- MJ_BizApps_Tasks: Tasks
      AND [RelatedEntityID] = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' -- MJ_BizApps_Accounting: Journal Entry Batches
      AND [RelatedEntityJoinField] = 'ApprovalTaskID'
);

IF @RelID IS NOT NULL
    UPDATE [${mjSchema}].[EntityRelationship]
    SET [Configuration] = N'{
  "UI": {
    "inclusion": "More"
  }
}',
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE [ID] = @RelID;
GO
