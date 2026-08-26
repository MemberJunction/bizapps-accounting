---
'@mj-biz-apps/accounting-entities': minor
---

Raise this release to a minor: it carries schema migrations.

Two migrations have landed on `next` since `v0.2.0` and both arrived with no changeset of
their own, so the release was resolving to a patch:

- `V202608241445__v0.1.x__ApprovalTask_FK.sql` — adds the foreign key
  `FK_JournalEntryBatch_ApprovalTask` on
  `__mj_BizAppsAccounting.JournalEntryBatch.ApprovalTaskID` → `__mj_BizAppsTasks.Task.ID`.
  A new referential constraint: an existing row whose `ApprovalTaskID` does not resolve to a
  Task now fails to insert or update where it used to succeed.
- `V202608252220__v0.1.x__CodeGen_Scoped_SQL_Objects.sql` — folds the scoped CodeGen emit for
  the accounting schema (hierarchy views/SPs, 16 hierarchy `EntityField` rows).

A consumer upgrading on a patch would not expect a schema change to run, which is exactly what
`ci/check-bump-level.sh` asserts on the release. Both packages move together under the
`fixed` group, so this takes the whole release `0.2.0 -> 0.3.0`.
