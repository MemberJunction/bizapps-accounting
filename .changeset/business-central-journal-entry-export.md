---
'@mj-biz-apps/accounting-entities': minor
---

Business Central journal-entry export: a new `ExternalAccountingSystem` catalog entity, the BC
adapter that posts an approved batch to a live general ledger, and a cleanup migration for a defect
that currently reproduces on a clean install of `next`.

Two migrations, both stamped `2026-08-26` so they land after everything already on `next`:

- `V202608260800__v1.0.x__ExternalAccountingSystem.sql` — the catalog table plus its Mock and
  BusinessCentral rows. Account-driven routing (D13) resolves a batch to exactly one external
  system through it, so a batch straddling two systems fails loudly instead of half-posting.
- `V202608260900__v1.0.x__Drop_Orphaned_JournalEntry_Hierarchy_Artifacts.sql` — deletes two
  orphaned `EntityField` rows and two orphaned RootID TVFs on `Journal Entries`.

The second is a defect fix rather than part of this feature, and it is worth understanding
independently of Business Central. On a clean install of `next` today, `Journal Entries` declares
26 `EntityField` rows while `vwJournalEntries` projects 24 columns, and MJ rejects a save when the
two disagree — so **every save on the entity fails**. Reproduced from zero on 2026-08-26 with MJ
core + common + tasks + accounting migrations, `mj sync push` (0 errors) and `mj codegen`.

The cause is that MJ PR #3948 gated recursive-hierarchy generation behind
`EntityField.Configuration.Hierarchy.IsHierarchy`. `Journal Entries`' two reversal pointers are
linear pointers rather than trees, so they are correctly not opted in and CodeGen no longer projects
their `Root*` columns. But CodeGen ceasing to EMIT them is not the same as REMOVING what an earlier
CodeGen wrote: the baseline created the TVFs and inserted the `EntityField` rows, and CodeGen's own
cleanup (`spDeleteUnneededEntityFields`) deletes fields that are "NOT virtual and not part of the
underlying VIEW or TABLE" — these fields ARE virtual, so they fall outside it by design. There is
no self-healing path; the rows persist until something deletes them deliberately.

Note for the follow-up: `V202608252220__CodeGen_Scoped_SQL_Objects.sql` still recreates
`vwJournalEntries` WITH the `Root*` columns (~line 2751), which is what reintroduces the mismatch on
every clean install until CodeGen runs. Ordering matters for the same reason — stamped earlier, the
cleanup dropped those TVFs out from under that view and the migration run failed with
`Invalid object name '...fnJournalEntryReversesJournalEntryID_GetRootID'`.
