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
#   3. bizapps-common   — applied with `mj migrate --schema __mj_BizAppsCommon`, same as the
#                         installer. Its baseline uses only literal __mj_BizAppsCommon names (zero
#                         placeholders), and its codegen-emitted V migrations use
#                         ${flyway:defaultSchema} meaning its OWN schema — so the standard rewrite
#                         is correct for every file. (The previous sqlcmd loop mapped
#                         defaultSchema to __mj AND swallowed SQL errors — sqlcmd without `-b`
#                         exits 0 on statement failures — so common's V migrations, including the
#                         Person.DisplayName computed column that tasks' views join on, were
#                         silently skipped on every rebuild.)
#   4. this app's migrations
#
# bizapps-tasks is a declared dependency AND the baseline now references its schema —
# FK_JEBatch_ApprovalTask points at __mj_BizAppsTasks.Task (#22 item 1) — so it is applied as
# step 4, before this app's migrations. Its migrations are written against its OWN schema
# (${flyway:defaultSchema} = __mj_BizAppsTasks), so plain `mj migrate --schema` applies them.
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

MJ_VERSION="${MJ_CORE_VERSION:-v5.50.0}"
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

# TRIM THE GENERATED HALF BEFORE APPLYING. Once CodeGen output lives in the baseline, a rebuild
# produces a database whose entity metadata is ALREADY current — so the next CodeGen run has nothing
# to do and emits only a delta, which append-codegen.sh then refuses (rightly) as a partial. Worse,
# stale generated SQL referencing a table the hand-authored half no longer creates fails the migrate
# outright. The cycle is only self-consistent if the rebuild applies the hand-authored DDL alone and
# CodeGen regenerates the rest from scratch. This is what makes "edit the baseline in place" safe.
say "4/5  bizapps-tasks"
$MJ migrate --schema __mj_BizAppsTasks --dir "$TASKS_REPO/migrations"

say "5/5  bizapps-accounting (hand-authored DDL only)"
MARKER='CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE'
ACCT_MIGRATION=$(grep -rl "$MARKER" "$ROOT/migrations"/*.sql | head -1)
if [[ -n "$ACCT_MIGRATION" ]]; then
    MARKER_LINE=$(grep -n "$MARKER" "$ACCT_MIGRATION" | head -1 | cut -d: -f1)
    BANNER_END=$(awk -v s="$MARKER_LINE" 'NR>=s && /^-- =+$/ { last=NR } NR>s && !/^--/ && NF { exit } END { print last }' "$ACCT_MIGRATION")
    GENERATED_LINES=$(( $(wc -l < "$ACCT_MIGRATION") - BANNER_END ))
    if (( GENERATED_LINES > 0 )); then
        printf '  trimming %s lines of generated output (CodeGen will regenerate them)\n' "$GENERATED_LINES"
        head -n "$BANNER_END" "$ACCT_MIGRATION" > "$ACCT_MIGRATION.tmp"
        mv "$ACCT_MIGRATION.tmp" "$ACCT_MIGRATION"
    fi
fi
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
