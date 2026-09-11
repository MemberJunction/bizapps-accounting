---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Move to MemberJunction 6.1.0-edge.6, which is what `AccountingEngine` already assumes.

`AccountingEngine.ts` reads `DatabaseProviderBase.TransactionDepth` — the PascalCase getter
introduced by MemberJunction/MJ#4225. That rename landed in **edge.6**, but every
`@memberjunction/*` dependency here was pinned `^6.1.0-edge.5` and the lockfile resolved
edge.5, so the build failed on every commit:

    src/AccountingEngine.ts(128,47): error TS2339:
    Property 'TransactionDepth' does not exist on type 'DatabaseProviderBase'

accounting has therefore been unreleasable since that code merged. Pins and `mj-app.json`'s
`mjVersionRange` now target edge.6 and the lockfile is regenerated; all 7 packages build.
