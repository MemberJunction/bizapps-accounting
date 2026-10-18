---
"@mj-biz-apps/accounting-core-entities-server": minor
---

Finance exception clearing rights by type (golive #320 §4). `Accounting.ClearFinanceException` now decides per exception which authorization the reviewer must hold, after the checks that always apply (still Open, not the source record's creator, a note): `MJ.BizApps.Accounting.FinanceExceptions.ClearUnattributed` for an exception whose creator is unresolved or the system user; `ClearEscalated` for one on a record created by a holder of the `EscalatedCreator` marker; the type's `ClearType.<TYPE CODE>`; otherwise `Clear`, as before. The package ships the nine new authorizations granted to no role, and a rule is on only while its authorization is granted (Allow) to some role, so an install that grants none behaves exactly as before. The rule rights are direct grants with no parent: holding `Clear` never confers them. New refusal codes: `TYPE_NOT_AUTHORIZED`, `UNATTRIBUTED_NOT_AUTHORIZED`, `ESCALATED_NOT_AUTHORIZED`, `TYPE_UNKNOWN`; the pre-read `NOT_AUTHORIZED` gate now admits a holder of any clearing right. Exported: `FinanceExceptionClearPolicy`'s pure `ResolveFinanceExceptionClearRule` and helpers, the authorization-name constants, and `FinanceExceptionClearContextFor`.

New saved query "Finance Exceptions Cleared": every cleared exception by month, with type, outcome, reviewer, note and the source record's creator.

The new authorizations and query are metadata: they reach a host through the release's Metadata_Sync migration.
