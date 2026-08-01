---
'@mj-biz-apps/accounting-ng-widgets': minor
'@mj-biz-apps/accounting-engine-base': minor
'@mj-biz-apps/accounting-ng': minor
---

UI layering: adopt the MJ four-layer UX standard, converting the Journal Entry slice

Introduces `@mj-biz-apps/accounting-ng-widgets` — UI layers 1 and 2, framework-clean Angular with
no `@angular/router` and no MJ Explorer dependency — and converts the journal-entry surfaces onto
it.

**Breaking for direct importers of `@mj-biz-apps/accounting-engine-base`:** nothing was removed,
but three modules moved *into* it from the Angular package and are now exported from its index:
`je-rules` (`canReverse`, `reversalBlockedReason`, `isBalanced`, `statusVariant`,
`awaitsApproval`), `je-draft` (the JE line-editor state + contract mapping), and
`JournalEntryClient` (the `GenerateJournalEntryReversal` remote op). All three were always pure
TypeScript; they were living in a package that forced an Angular dependency on their consumers.
The package now peer-depends on `@memberjunction/graphql-dataprovider`.

Three bugs fixed as a consequence of merging two divergent implementations of the journal-entry
detail:

- The Explorer form gated reversal on `Status === 'GLPosted'`, which both refused reversals the
  server permits (a `Batched` entry) and offered reversals the server rejects (reversing a
  `Reversal`). It now uses the unit-tested `canReverse()` rule that the other surface already used.
- The read-only lines table footed its totals with `colspan="4"` in a six-column table, rendering
  the debit total under the **Credit** heading and the credit total under **Dimensions**.
- "Open source order" read a `Header.OrderID` that no longer exists — the column was replaced by
  the polymorphic `LinkedEntityID` / `LinkedRecordID` pair, and an untyped `simple` result cast hid
  it, so the button had silently stopped rendering. It is now a generic "open source record" link
  driven by `LinkedEntity`.
