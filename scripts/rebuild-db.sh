#!/usr/bin/env bash
#
# Rebuild the local development database from scratch.
#
# WHY THIS EXISTS: the standing pre-production practice is that schema changes EDIT THE BASELINE
# MIGRATION IN PLACE rather than adding fix-up migrations. That is only safe if rebuilding from zero
# is routine — otherwise the baseline drifts from what anyone actually has installed. This script is
# that routine, and it is the same one bizapps-orders uses.
#
# WHAT IT DOES
#   1. drop + recreate the database
#   2. MJ core schema at the pinned version
#   3. bizapps-common   — applied with sqlcmd rather than `mj migrate` because its migrations are
#                         written against ${flyway:defaultSchema} meaning __mj (it EXTENDS core),
#                         which `mj migrate` would rewrite to this app's schema. Its own tables use
#                         the literal __mj_BizAppsCommon schema, so they still land correctly.
#   4. this app's migrations
#
# bizapps-tasks is a declared dependency (mj-app.json) but is NOT installed here: nothing in this
# baseline references its schema, and the approval gate resolves it at runtime. Add a step if that
# ever stops being true.
#
# AFTER THIS, still by hand (they need judgement, not automation):
#   npm run mj:codegen                     # regenerate entity metadata + SQL objects
#   scripts/append-codegen.sh              # append the generated SQL below the migration's banner
#   npm run mj -- sync push --dir metadata # seed currencies + GL account roles
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

MJ_VERSION="${MJ_CORE_VERSION:-v5.49.0}"
COMMON_REPO="${BIZAPPS_COMMON_REPO:-$ROOT/../bizapps-common}"
MJ="node $ROOT/node_modules/@memberjunction/cli/bin/run.js"
SQLCMD="sqlcmd -S ${DB_HOST},${DB_PORT:-1433} -U ${DB_USERNAME} -P ${DB_PASSWORD} -C -N o"

say() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

[[ -d "$COMMON_REPO" ]] || { echo "bizapps-common checkout not found at $COMMON_REPO" >&2; exit 1; }

say "1/4  Recreating ${DB_DATABASE}"
$SQLCMD -d master -Q "
    IF DB_ID('${DB_DATABASE}') IS NOT NULL
    BEGIN
        ALTER DATABASE [${DB_DATABASE}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${DB_DATABASE}];
    END
    CREATE DATABASE [${DB_DATABASE}];"

say "2/4  MJ core @ ${MJ_VERSION}"
$MJ migrate -t "${MJ_VERSION}"

say "3/4  bizapps-common"
for f in "$COMMON_REPO"/migrations/*.sql; do
    printf '  %s\n' "$(basename "$f")"
    sed 's/\${flyway:defaultSchema}/__mj/g; s/\${mjSchema}/__mj/g' "$f" \
        | $SQLCMD -d "${DB_DATABASE}" -i /dev/stdin
done

say "4/4  bizapps-accounting"
# --schema is REQUIRED, not optional. Without it `mj migrate` uses the CORE schema's flyway history,
# which already carries a SQL_BASELINE from step 2 — so flyway skips this app's `B` baseline entirely
# and reports "0 applied" while creating nothing.
$MJ migrate --schema __mj_BizAppsAccounting --dir "$ROOT/migrations"

say "Done"
cat <<'NEXT'
Next, in order:
  npm run mj:codegen
  scripts/append-codegen.sh
  npm run mj -- sync push --dir metadata
  npm run build
NEXT
