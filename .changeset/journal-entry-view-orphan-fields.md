---
"@mj-biz-apps/accounting-entities": minor
---

`Predictive_Journal_Entry_Anomaly_Fields` could not apply on a fresh install.

The migration rebuilds `vwJournalEntries` as a layered view that no longer selects
`RootReversesJournalEntryID` or `RootReversedByJournalEntryID`, which
`CodeGen_Scoped_SQL_Objects` kept. Their `EntityField` rows stayed at Sequence 25 and 26, and
`spUpdateExistingEntityFieldsFromSchema` then moved `ReversedByJournalEntry` onto 25:

    Violation of UNIQUE KEY constraint 'UQ_EntityField_EntityID_Sequence'.
    The duplicate key value is (<Journal Entries entity ID>, 25).

A database that already had CodeGen run against it never shows this, because CodeGen deletes
fields the base view no longer carries before it renumbers.

The migration now does the same: after rebuilding the view it calls
`spDeleteUnneededEntityFields`, scoped to Journal Entries and skipped when that entity row does
not exist. A fresh install ends with the same 35 fields as the generated `JournalEntry` class.
Databases that already applied the migration are unaffected, because `mj migrate` does not
re-run applied scripts and does not compare checksums. A Flyway or Skyway `validate` against
such a database will report a checksum change for this version.
