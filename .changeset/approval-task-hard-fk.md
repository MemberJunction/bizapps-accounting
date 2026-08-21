---
"@mj-biz-apps/accounting-entities": patch
"@mj-biz-apps/accounting-engine-base": patch
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-server": patch
"@mj-biz-apps/accounting-ng": patch
---

Cross-app FK discipline, final piece (#22 item 1): JournalEntryBatch.ApprovalTaskID is now a REAL nullable FK to __mj_BizAppsTasks.Task — bizapps-tasks is a declared dependency that installs before this app, so the target always exists; the both-or-neither CHECK with ApprovalTaskRaisedAt is unchanged (D10 retryable task-raise semantics). rebuild-db.sh gains a bizapps-tasks step, applies bizapps-common via `mj migrate --schema __mj_BizAppsCommon` (its old sqlcmd loop mapped ${flyway:defaultSchema} to __mj AND swallowed SQL errors without `-b`, silently skipping common's V migrations — including the Person.DisplayName computed column that tasks' generated views join on), and defaults MJ core to v5.50.0. Baseline re-baked from zero (codegen tail regenerated; ApprovalTaskID's entity metadata now relates to MJ_BizApps_Tasks: Tasks).
