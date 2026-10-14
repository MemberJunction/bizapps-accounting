#!/usr/bin/env bash
#
# Build the local development database from scratch.
#
# FOR A NEW, EMPTY DATABASE ONLY. It drops the database named in .env, so it is not a development
# loop: schema changes are new V migrations applied with `pnpm run mj:migrate` (see
# docs/database-migrations.md). The script applies every migration as committed and never edits a
# file in the repo.
#
# WHAT IT DOES
#   1. drop + recreate the database
#   2. MJ core schema at the pinned version
#   3. bizapps-common   — applied with `mj migrate --schema __mj_BizAppsCommon`, same as the
#                         installer. Its baseline uses only literal __mj_BizAppsCommon names (zero
#                         placeholders), and its codegen-emitted V migrations use
#                         ${flyway:defaultSchema} meaning its OWN schema — so the standard rewrite
#                         is correct for every file. (The previous sqlcmd loop mapped
#                         defaultSchema to __mj AND swallowed SQL errors — sqlcmd without `-b`
#                         exits 0 on statement failures — so common's V migrations, including the
#                         Person.DisplayName computed column that tasks' views join on, were
#                         silently skipped on every rebuild.)
#   4. bizapps-tasks
#   5. this app's migrations, the baseline in full followed by every V migration
#
# bizapps-tasks is a declared dependency AND the baseline now references its schema —
# FK_JEBatch_ApprovalTask points at __mj_BizAppsTasks.Task (#22 item 1) — so it is applied as
# step 4, before this app's migrations. Its migrations are written against its OWN schema
# (${flyway:defaultSchema} = __mj_BizAppsTasks), so plain `mj migrate --schema` applies them.
#
# AFTER THIS, by hand:
#   pnpm run mj:codegen                     # should find nothing to change; output means drift
#   pnpm run mj sync push --dir metadata    # seed currencies + GL account roles
#   pnpm run build
#
# Usage: scripts/rebuild-db.sh
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

# .env is parsed, NOT sourced. It is written for dotenv, which tolerates `KEY = 'value'` with spaces
# around the '='; bash does not — `DB_DATABASE= 'x'` sets DB_DATABASE empty and then tries to RUN x.
# Sourcing it silently produced an empty database name, so parse it properly instead.
eval "$(python3 - <<'PARSE'
import re, shlex
for line in open('.env'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    k = k.strip()
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', k):
        continue
    v = v.strip().strip('"').strip("'")
    print(f'export {k}={shlex.quote(v)}')
PARSE
)"

: "${DB_DATABASE:?DB_DATABASE is not set — check .env}"

# Tracks the MJ line this repo's package.json pins (^6.1.5). A rebuild against v5 core installs a
# schema older than the code expects — Entity.GeneratedBaseViewName and
# EntityRelationship.RelatedRecordCollection are both v6 columns, and CodeGen writes to them.
MJ_VERSION="${MJ_CORE_VERSION:-v6.1.5}"
COMMON_REPO="${BIZAPPS_COMMON_REPO:-$ROOT/../bizapps-common}"
TASKS_REPO="${BIZAPPS_TASKS_REPO:-$ROOT/../bizapps-tasks}"
MJ="node $ROOT/node_modules/@memberjunction/cli/bin/run.js"
SQLCMD="sqlcmd -S ${DB_HOST},${DB_PORT:-1433} -U ${DB_USERNAME} -P ${DB_PASSWORD} -C -N o -b"

say() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

[[ -d "$COMMON_REPO" ]] || { echo "bizapps-common checkout not found at $COMMON_REPO" >&2; exit 1; }
[[ -d "$TASKS_REPO" ]] || { echo "bizapps-tasks checkout not found at $TASKS_REPO" >&2; exit 1; }

say "1/5  Recreating ${DB_DATABASE}"
$SQLCMD -d master -Q "
    IF DB_ID('${DB_DATABASE}') IS NOT NULL
    BEGIN
        ALTER DATABASE [${DB_DATABASE}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${DB_DATABASE}];
    END
    CREATE DATABASE [${DB_DATABASE}];"

say "2/5  MJ core @ ${MJ_VERSION}"
$MJ migrate -t "${MJ_VERSION}"

say "3/5  bizapps-common"
$MJ migrate --schema __mj_BizAppsCommon --dir "$COMMON_REPO/migrations"

say "4/5  bizapps-tasks"
$MJ migrate --schema __mj_BizAppsTasks --dir "$TASKS_REPO/migrations"

# The baseline is applied in full, generated half included: V migrations call the CRUD procs it
# creates (the Metadata_Sync files call spCreateCurrency, for one), so trimming it fails the migrate.
say "5/5  bizapps-accounting"
# --schema is REQUIRED, not optional. Without it `mj migrate` uses the CORE schema's flyway history,
# which already carries a SQL_BASELINE from step 2 — so flyway skips this app's `B` baseline entirely
# and reports "0 applied" while creating nothing.
$MJ migrate --schema __mj_BizAppsAccounting --dir "$ROOT/migrations"

say "Done"
cat <<'NEXT'
Next, in order:
  pnpm run mj:codegen                     # should find nothing to change
  pnpm run mj sync push --dir metadata
  pnpm run build
NEXT
