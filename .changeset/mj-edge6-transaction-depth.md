---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Move to MemberJunction 6.1.0-edge.7, which is what `AccountingEngine` already assumes.

`AccountingEngine.ts` reads `DatabaseProviderBase.TransactionDepth` — the PascalCase getter
introduced by MemberJunction/MJ#4225. That rename landed in **edge.6**, but every
`@memberjunction/*` dependency here was pinned `^6.1.0-edge.5` and the lockfile resolved
edge.5, so the build failed on every commit:

    src/AccountingEngine.ts(128,47): error TS2339:
    Property 'TransactionDepth' does not exist on type 'DatabaseProviderBase'

accounting has therefore been unreleasable since that code merged. Pins and `mj-app.json`'s
`mjVersionRange` now target edge.7 and the lockfile is regenerated; all 7 packages build.

Pinned to **edge.7 rather than edge.6** — edge.6 is the floor the `TransactionDepth` getter actually requires, but AIDP stage now runs edge.7, and building against one edge release while running on another is avoidable skew for no benefit. Verified: all 7 packages build at edge.7.
