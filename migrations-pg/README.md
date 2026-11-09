# PostgreSQL Migrations

`migrations-pg/` holds the **PostgreSQL counterparts** of T-SQL migrations in `migrations/`. Every migration added since the last release needs one before the next release ships (see [CI](#ci)); most migrations from before that rule, the baseline included, have none. SQL Server is the source of truth; PostgreSQL files are produced (and re-produced) by the MemberJunction SQL converter.

```
migrations/                           migrations-pg/
  V<TS>__v<X.Y.x>__Foo.sql    ───►    V<TS>__v<X.Y.x>__Foo.pg.sql       (converter output)
                                      V<TS>__v<X.Y.x>__Bar.pg-only.sql  (PG-only patches, hand-written)
```

The converter lives in [`@memberjunction/sql-converter`](https://github.com/MemberJunction/MJ/tree/main/packages/SQLConverter). The deeper toolchain is documented in the MJ repo's `.claude/commands/pg-migrate.md` and `plans/pg-migration-architecture/`.

---

## When to (re)generate

- **After adding a new T-SQL migration** in `migrations/`: convert it once and commit both files, in the same PR or a later one before the release.
- **After fixing a converter rule** in MJ: re-convert *only the affected new migration(s)*. Never re-convert old, already-committed `.pg.sql` files — that's a breaking change to a deployed history.

## How

```bash
# One-shot for a single new file
pnpm exec mj sql-convert \
  migrations/V<TS>__v<X.Y.x>__YourFile.sql \
  --from tsql --to postgres \
  --output migrations-pg/V<TS>__v<X.Y.x>__YourFile.pg.sql \
  --schema __mj_BizAppsAccounting \
  --verbose

# Or batch the whole directory (only converts files missing a .pg.sql counterpart)
pnpm exec mj migrate convert
```

The converter is **rule-based** ([`packages/SQLConverter/src/rules`](https://github.com/MemberJunction/MJ/tree/main/packages/SQLConverter/src/rules) in MJ). If the output contains `-- TODO:` comments, the converter cannot handle a pattern in your migration — **do not hand-fix the output**. Instead, fix the rule upstream in MJ, rebuild `sql-converter`, and re-convert here.

## PG-only patches

Some patterns have no clean T-SQL ↔ PG equivalent (e.g. PG-specific deferrable constraint triggers, GENERATED columns, schema GRANTs to roles). Write those as **`*.pg-only.sql`** in `migrations-pg/`. Skyway picks them up alongside the converted files, but they have no T-SQL twin. Document why each PG-only patch exists at the top of the file.

## How runtime picks the right files

`mj migrate` (Skyway under the hood) reads `DB_PLATFORM`:

- `DB_PLATFORM=sqlserver` → `migrations/` (T-SQL)
- `DB_PLATFORM=postgresql` → `migrations-pg/` (`*.pg.sql` + `*.pg-only.sql`)

Both are committed; deployments choose at runtime.

The swap applies only to `migrationsLocation` in `mj.config.cjs`, never to an explicit `--dir`. That is why `pnpm run mj:migrate` passes no `--dir`. A hand-run `mj migrate --dir ./migrations` runs the T-SQL set on either platform; on PostgreSQL pass `--dir ./migrations-pg`. `mj.config.cjs` must not set `mjRepoVersion`: with it set and no `--dir`, `mj migrate` fetches MJ core's migrations instead of this repo's.

## Quote the schema name

PostgreSQL folds unquoted names to lowercase, so `__mj_BizAppsAccounting` unquoted means the schema `__mj_bizappsaccounting`. `mj migrate --schema` and the Open App installer create `"__mj_BizAppsAccounting"` quoted, and MJ's PostgreSQL provider quotes mixed-case names in runtime SQL, so every reference in `migrations-pg/` must be quoted too. The converter emits the name unquoted. After converting a file, quote it (and the `${mjSchema}_BizApps*` sibling schemas) before committing:

```bash
perl -pi -e 's/(?<!["\[\x27])__mj_BizAppsAccounting(?!["\]\x27])/"__mj_BizAppsAccounting"/g; s/(?<!")(\$\{mjSchema\}_BizApps\w+)(?!")/"$1"/g' migrations-pg/<file>.sql
```

Also replace the converter's header note that calls the unquoted name deliberate (see any committed file for the wording). The pattern leaves T-SQL comments (`[__mj_BizAppsAccounting]`) and string literals (`'__mj_BizAppsAccounting'`) alone. This is the one post-conversion edit allowed to a `.pg.sql` file until the converter quotes the name itself.

## CI

Two checks, at two points:

- **Counterpart present** (`.github/scripts/check-pg-counterpart.sh`). On a PR into `next` that adds a T-SQL migration with no matching `.pg.sql`, it adds a warning and does not fail. On the release PR (`rr: pg counterparts` in `release-readiness.yml`) it fails for any migration added since the last release tag that has no counterpart.
- **Schema name quoted** (`.github/workflows/pg-migrations.yml`, same manual run). Fails on any unquoted `__mj_BizAppsAccounting` in `migrations-pg/`.
- **PG set applies** (`.github/workflows/pg-migrations.yml`). Spins up PostgreSQL 17 and applies the PG migration set to a fresh database. It runs only when started by hand (`workflow_dispatch`), not on PRs.

## Filename rules

Identical to `migrations/`:

```
V<YYYYMMDDHHMM>__v<X.Y.x>__<Description>.pg.sql        (converted)
V<YYYYMMDDHHMM>__v<X.Y.x>__<Description>.pg-only.sql   (hand-written PG-only)
B<YYYYMMDDHHMM>__v<X.Y.x>__<Description>.pg.sql        (baseline)
```

The validator script (`.github/scripts/validate-migration-filenames.sh`) checks only the `V<YYYYMMDDHHMM>__` prefix and that the timestamp is a valid time. It runs on `migrations/` in PRs into `next` that change a migration, and on `migrations-pg/` when the PG parity workflow runs.
