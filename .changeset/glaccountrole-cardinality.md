---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-actions": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-engine-base": minor
"@mj-biz-apps/accounting-ng": minor
---

BA-D34: `GLAccountRole.Cardinality` (`One` | `Many`) and the `BankAccount` role.

Separates "where does a receipt post?" (role `Cash`, One, unchanged) from "what
is cash, for a position?" (role `BankAccount`, Many). Existing roles are
backfilled to `One`, so payment routing and the BA-D32 tie guard are unaffected.
Enables FP&A to build `CashBalance` as the sum of a company's Active
`BankAccount` links. Schema change, so `minor`.
