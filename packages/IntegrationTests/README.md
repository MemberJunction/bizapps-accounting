# @mj-biz-apps/accounting-integration-tests

GraphQL-wire suite. Currencies, GL roles, and JE types are **looked up** from shipped metadata.
Accounts and companies come from the committed world (ORD-WORLD / demo data).

```bash
pnpm --filter @mj-biz-apps/accounting-integration-tests build
GRAPHQL_PORT=4103 node test-harnesses/integration.mjs
```

The older `test-harnesses/server/` scripts talk to SQL in-process. Prefer this package.
