---
"@mj-biz-apps/accounting-core-entities-server": minor
---

Seed the `Unbilled Receivable` GL account role (contract asset) — orders D92, golive #240.

Revenue can be earned before it is billed: service already delivered that the contract does not yet allow us to invoice. That is a contract asset, distinct from a receivable because no customer owes anything until they are billed, and it needs its own name on the balance sheet.

Orders keeps the position on the order line (`BilledToDate` and `RecognizedToDate`) and this account is where the gap lands. Both of its ordering rules use it: recognising revenue debits Deferred Revenue down to what has been billed and then debits this account for the rest, and invoicing an instalment credits this account first, down to zero, before opening any new Deferred. So the balance here is only ever revenue earned ahead of billing.

`metadata/gl-account-roles/.gl-account-roles.json` gains one row — `Unbilled Receivable`, ID `3EFC77F3-2468-463F-9197-D0A8A6762A36`, Active, Cardinality `One`, Sequence 100. The JSON is the source of truth and the only thing this change contributes: hosts receive it through the single `*__Metadata_Sync.sql` the build engineer generates per release, not through a migration in this PR.

`docs/unbilled-receivable-seeding.md` is the runbook for the company-level `GLAccountLink` rows, one per company against that company's own `11300 Unbilled Revenue (Contract Asset)`. **Until a company has that link, orders refuses any journal entry that needs it**, including the confirm of an order for a company billed by instalment that has an up-front line; nothing is posted to Deferred Revenue in its place. The runbook also records that the role's `Name` is a cross-repo contract: bizapps-orders resolves roles by accounting's exact `Name` string, so a one-character difference makes every company look unlinked and those entries are refused.
