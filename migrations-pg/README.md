# PostgreSQL Migrations

`migrations-pg/` holds the **PostgreSQL counterparts** of every T-SQL migration in `migrations/`. SQL Server is the source of truth; PostgreSQL files are produced (and re-produced) by the MemberJunction SQL converter.

```
migrations/                           migrations-pg/
  V<TS>__v<X.Y.x>__Foo.sql    ───►    V<TS>__v<X.Y.x>__Foo.pg.sql       (converter output)
                                      V<TS>__v<X.Y.x>__Bar.pg-only.sql  (PG-only patches, hand-written)
```

The converter lives in [`@memberjunction/sql-converter`](https://github.com/MemberJunction/MJ/tree/main/packages/SQLConverter). The deeper toolchain is documented in the MJ repo's `.claude/commands/pg-migrate.md` and `plans/pg-migration-architecture/`.

---

## When to (re)generate

- **After adding a new T-SQL migration** in `migrations/`: convert it once, commit both files.
- **After fixing a converter rule** in MJ: re-convert *only the affected new migration(s)*. Never re-convert old, already-committed `.pg.sql` files — that's a breaking change to a deployed history.

## How

```bash
# One-shot for a single new file
npx mj sql-convert \
  migrations/V<TS>__v<X.Y.x>__YourFile.sql \
  --from tsql --to postgres \
  --output migrations-pg/V<TS>__v<X.Y.x>__YourFile.pg.sql \
  --schema __mj_BizAppsAccounting \
  --verbose

# Or batch the whole directory (only converts files missing a .pg.sql counterpart)
npx mj migrate convert
```

The converter is **rule-based** ([`packages/SQLConverter/src/rules`](https://github.com/MemberJunction/MJ/tree/main/packages/SQLConverter/src/rules) in MJ). If the output contains `-- TODO:` comments, the converter cannot handle a pattern in your migration — **do not hand-fix the output**. Instead, fix the rule upstream in MJ, rebuild `sql-converter`, and re-convert here.

## PG-only patches

Some patterns have no clean T-SQL ↔ PG equivalent (e.g. PG-specific deferrable constraint triggers, GENERATED columns, schema GRANTs to roles). Write those as **`*.pg-only.sql`** in `migrations-pg/`. Skyway picks them up alongside the converted files, but they have no T-SQL twin. Document why each PG-only patch exists at the top of the file.

## How runtime picks the right files

`mj migrate` (Skyway under the hood) reads `DB_PLATFORM`:

- `DB_PLATFORM=sqlserver` → `migrations/` (T-SQL)
- `DB_PLATFORM=postgresql` → `migrations-pg/` (`*.pg.sql` + `*.pg-only.sql`)

Both are committed; deployments choose at runtime.

## CI

`.github/workflows/pg-migrations.yml` spins up PostgreSQL 17 on every PR that touches `migrations/`, `migrations-pg/`, or the converter, applies the PG migration set to a fresh database, and fails the build if anything errors. **Validates parity automatically** — you cannot land a T-SQL migration without a working PG counterpart.

## Filename rules

Identical to `migrations/`:

```
V<YYYYMMDDHHMM>__v<X.Y.x>__<Description>.pg.sql        (converted)
V<YYYYMMDDHHMM>__v<X.Y.x>__<Description>.pg-only.sql   (hand-written PG-only)
B<YYYYMMDDHHMM>__<Description>.pg.sql                  (baseline)
```

The validator script (`.github/scripts/validate-migration-filenames.sh`) enforces these on every PR.
