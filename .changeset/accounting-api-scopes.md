---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Ship the `accounting`, `accounting:read` and `accounting:write` API scopes with an MJAPI ceiling, so an API key can be granted the Accounting remote operations (#310). The 15 code-only Accounting operations now carry a `RequiredScope`, so MJAPI's API-key scope gate applies to them: an API key that calls them needs `accounting:read` or `accounting:write` (or `full_access`) after upgrading. `accounting:write` does not include `accounting:read`; a key that needs both is granted both.
