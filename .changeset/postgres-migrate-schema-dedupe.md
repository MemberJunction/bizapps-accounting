---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-core-entities-server": minor
---

PostgreSQL fixes (#374, #436, #437).

- `pnpm run mj:migrate` no longer passes `--dir ./migrations`, so with `DB_PLATFORM=postgresql` it runs `migrations-pg/` instead of the T-SQL set. `mj.config.cjs` now sets `migrationsLocation`.
- Every file in `migrations-pg/` names the schema quoted, `"__mj_BizAppsAccounting"`. Unquoted, PostgreSQL folded it to `__mj_bizappsaccounting`, a schema neither `mj migrate --schema` nor MJ's runtime SQL uses. **Upgrade note:** the three PostgreSQL migrations released in 0.20–0.22 are edited in place. They could not have applied to a database whose schema `mj migrate` or the installer created, because their first statement against an existing table looked in the lowercase schema. A failed run may have left an empty lowercase `__mj_bizappsaccounting` schema behind; nothing reads it.
- Raising and clearing a finance exception on PostgreSQL quote the schema, table and column names, and a raise matches `DedupeKey` case-insensitively, as SQL Server's collation does, so `KEY-A` and `key-a` return one row. This does not run on PostgreSQL yet: no `migrations-pg/` file creates the Finance Exceptions table (#321).
