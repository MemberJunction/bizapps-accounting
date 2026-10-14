---
'@mj-biz-apps/accounting-actions': patch
'@mj-biz-apps/accounting-ng': patch
'@mj-biz-apps/accounting-core-entities-server': patch
'@mj-biz-apps/accounting-engine-base': patch
'@mj-biz-apps/accounting-server': patch
---

The packages' dependencies on each other are caret ranges (`^0.22.0`) instead of exact versions. A host that pins or overrides one package of this app at a later compatible version no longer forces an exact-match copy of its siblings. Changesets keeps the caret and moves its floor on each release.
