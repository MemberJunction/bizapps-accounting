# @mj-biz-apps/accounting-integration-tests

GraphQL-wire suite. Currencies, GL roles, and JE types are **looked up** from shipped metadata.
Accounts and companies come from the committed world (ORD-WORLD / demo data).

| Bundle | Checks | What it covers |
|---|---|---|
| `acct-world` | AW1–AW3 | shipped metadata over GraphQL; stamps `ApprovalCFOUserID` on world companies |
| `acct-ledger` | AL1 | Journal Entry RunView |
| `acct-batch` | AB1 | `Accounting.PreviewJournalEntryBatch` sees pending candidates, consuming none |
| `acct-isa` | I1–I8 | MJ's IS-A machinery on `AccountingCompanyProfile` IS-A `MJ: Companies` |

`acct-world.AW3` stamps `AccountingCompanyProfile.ApprovalCFOUserID` to the current user on every
active company. The batching gate hard-fails without that field (`No CFO configured for company…`).
`acct-batch.AB1` previews pending JE candidates over `Accounting.PreviewJournalEntryBatch` and does
**not** build batches (that would consume booked order entries).

`acct-isa` needs no world data, only a shipped currency. Each check creates its own Company and inactive
profile (named `ISA fixture <check> <run>`, coded `ISA-<check>-<run>`) and deletes them when it ends.
It covers promotion (`AttachToParent`), the whole-chain create, child discovery, the joined view, a
Company edit through the profile, the rollback of a failed profile write, and both deletes. I7
records MJ's current rule that deleting a profile deletes its Company. A delete that runs past 30
seconds fails its check instead of hanging the run (MJ#4850).

```bash
pnpm --filter @mj-biz-apps/accounting-integration-tests build
GRAPHQL_PORT=4103 node test-harnesses/integration.mjs          # every bundle
GRAPHQL_PORT=4103 node test-harnesses/integration.mjs acct-isa # one bundle; acct-isa.I3 runs one check
```

The older `test-harnesses/server/` scripts talk to SQL in-process. Prefer this package.
