# Database migrations — incremental only

> **The rule:** schema changes are new `V` migrations. Do **not** edit the baseline, and do not
> rebuild the database as part of ordinary development.

## What changed, and why

The baseline was edited in place, and `scripts/rebuild-db.sh` existed to make that safe: drop the
database, re-apply the edited baseline from zero, re-run CodeGen. That was the right call while the
schema was changing constantly and nothing downstream depended on it — a bootstrap practice for a
bootstrap phase.

That phase is over. The schema is depended on now, so the properties that made rebuilding safe no
longer hold:

- **Somebody else already has the old schema.** An edit to the baseline is invisible to any database
  that already ran it. Their column never appears, and nothing reports a problem — the migration is
  recorded as applied.
- **A rebuild throws away data.** Once there is anything worth keeping in a developer or shared
  database, "drop and re-apply" stops being a neutral operation.
- **An edit to an applied script is silently skipped.** `mj migrate` records each script's checksum
  but never validates it (Skyway's `Migrate()` does not call `Validate()`), so a database that already
  ran the baseline keeps its old version and nothing reports the difference.

## What to do instead

Add a new migration:

```
migrations/V<yyyyMMddHHmm>__v<app-version>__<Short_Description>.sql
```

It runs after the baseline on every deploy — clean install or existing database — so both converge
on the same schema. Write it to work on a database that **already has data**: give new `NOT NULL`
columns a default or backfill them before adding the constraint, and check existing rows before
adding a `CHECK` or `UNIQUE` constraint, so a violation fails with a message naming the rows and the
fix instead of a bare constraint error.

### Deterministic, not idempotent

`mj migrate` runs on **Skyway** (`@memberjunction/skyway-core`), which keeps a Flyway-compatible
`flyway_schema_history`. It applies each `V` migration **exactly once, in version order**, and never
re-runs one that succeeded; with `outOfOrder` off (the default, and this repo's setting) it refuses a
migration older than the newest one already applied. So a `V` migration's starting point is exact:
the state every earlier migration left. Write it **deterministically** against that state. Guards
such as `IF NOT EXISTS` or `IF COL_LENGTH(...) IS NULL` are not needed for objects this repo's own
earlier migrations create or leave out; they add nothing the runner does not already guarantee. Say
so in the header, as `V202609111415` and `V202609261000` do:

```sql
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
```

Guards **are** still required wherever the starting point genuinely differs from one database to
another:

- **Anything CodeGen creates.** Entity and field metadata rows exist only after CodeGen, which runs
  after migrations. A migration that reads them must skip cleanly when they are absent (see below).
- **Objects another schema owns.** MJ core, `bizapps-common` and sibling apps can sit at different
  versions on different hosts, so check before relying on or altering their objects.
- **Rows a host or developer may have written.** A backfill or data fix cannot assume which rows
  exist. Pre-check them and fail with a clear message, as the constraint rule above says.

When a migration can fail on existing data, make the check fail **before the first change**, with a
message naming the rows and the fix. Skyway's default `per-run` transaction rolls the whole run back
on a failure, so nothing is half-applied, but a bare constraint error tells a host nothing.

**Two migrations that regenerate the same entity collide.** A migration's CodeGen block hard-codes
that entity's whole base view and CRUD procedures. Two branches that each add a column to the same
table each carry a view and procedures without the other's column, and whichever runs second wins:
every save then passes a parameter the procedure no longer accepts. The branch that merges second
must re-run CodeGen on a database that has the first branch's migration applied, and re-timestamp
past it if it would otherwise sort first.

Then regenerate the code CodeGen owns:

```bash
pnpm run mj:migrate      # apply the new migration to your database
pnpm run mj:codegen      # entity metadata, base views, CRUD procs, TypeScript
```

## What must NOT happen any more

**Do not edit the baseline** (`migrations/B202605281200__v0.1.x__Schema_and_Tables.sql`), above or
below the CodeGen banner. Its generated half is still replaced wholesale by `append-codegen.sh` when
CodeGen runs against a bare database — that is why a hand edit below the banner disappears — but the
hand-authored half above it is now equally off limits, because it has already been applied
everywhere.

**Do not run `scripts/rebuild-db.sh` as part of feature work.** It stays in the repo for the one case
it is still correct for — standing up a brand-new empty database from nothing — and its own header
says so. It is not a development loop.

**A migration that depends on CodeGen metadata cannot assume it exists.** Entity and field rows are
created by CodeGen, which runs *after* migrations. A migration that reads `__mj.Entity` must skip
cleanly when the row is absent rather than throw, or it will fail on precisely the clean installs it
was supposed to support. If the change is really about metadata — field categories, display names,
form layout — its home is `metadata/` and `mj sync push` **while you are developing**.

## Metadata reaches a host only as a migration

`mj sync push` seeds *your* database. It does not ship. MJ documents `mj-app.json`'s
`metadata.directory` as a dev-time pointer — "kept purely as documentation of where the metadata
lives" (`packages/OpenApp/Engine/src/manifest/manifest-schema.ts`) — and `mj app install` applies
migrations and nothing else: no CodeGen step, no metadata step. So a row that exists only because
someone ran a push is a row no customer has, and nothing anywhere reports a problem.

**The migration is the delivery mechanism.** `V202608240216__v0.1.x__Metadata_Sync.sql` is this
repo's; at release the build engineer regenerates it so it carries whatever `metadata/` has gained.
That is the same path `bizapps-common` and `bizapps-tasks` use.

Two properties of that step, both of which fail silently:

- **Generate it from a FRESH database, never a dev one.** A dev-database push emits `spUpdate*`
  statements, which the generator refuses and which would overwrite host state if they got through.
- **No gate catches a pending metadata change with no migration behind it.** CI does not look, and
  the app installs cleanly either way. A `metadata/` edit a host needs is therefore not finished when
  it merges — only when a release carries it.

The practical consequence for anything an external caller depends on (a Remote Operation, an
Application row, a seeded lookup): it does not exist for that caller until a release ships the
metadata migration.

## The test to apply in review

> If a colleague pulls this branch onto a database that already has last week's schema and runs
> `pnpm run mj:migrate`, do they end up with exactly the schema this branch describes?

If the answer requires them to drop their database, the change is in the wrong place.
