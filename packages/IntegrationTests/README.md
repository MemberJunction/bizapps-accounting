# @mj-biz-apps/accounting-integration-tests

GraphQL-wire suite. Currencies, GL roles, and JE types are **looked up** from shipped metadata.
Accounts and companies come from the committed world (ORD-WORLD / demo data).

`acct-world.AW3` stamps `AccountingCompanyProfile.ApprovalCFOUserID` to the current user on every
active company. The batching gate hard-fails without that field (`No CFO configured for company…`).
`acct-batch.AB1` previews pending JE candidates over `Accounting.PreviewJournalEntryBatch` and does
**not** build batches (that would consume booked order entries).

```bash
pnpm --filter @mj-biz-apps/accounting-integration-tests build
GRAPHQL_PORT=4103 node test-harnesses/integration.mjs
```

The older `test-harnesses/server/` scripts talk to SQL in-process. Prefer this package.
