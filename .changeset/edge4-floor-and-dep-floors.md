---
"@mj-biz-apps/accounting-entities": patch
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-engine-base": patch
"@mj-biz-apps/accounting-server": patch
"@mj-biz-apps/accounting-ng": patch
"@mj-biz-apps/accounting-actions": patch
---

Raise the platform floor to MJ 6.1.0-edge.4 and the app dependency floors to the
versions actually exercised together: bizapps-common >=5.35.1, bizapps-tasks
>=1.3.0. All @memberjunction/* dependencies now pin ^6.1.0-edge.4 (caret, never
exact — an exact edge pin in a published package forces two MJ copies into a
consumer's tree and splits the ClassFactory registry).
