---
"@mj-biz-apps/accounting-engine-base": minor
---

Add `ResolveFirstLinkedAccount` and `RefreshAfterLinkMiss` to `AccountingEngineBase`: when a link walk finds no GL account for a role, the engine reloads its cache once (throttled to one reload per 30 seconds, shared between concurrent callers) and retries, so GL account links written directly to the database are picked up without restarting the server (bc-aidp-next-golive#438).
