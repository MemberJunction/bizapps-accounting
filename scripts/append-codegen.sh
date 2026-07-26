#!/usr/bin/env bash
#
# Append CodeGen's SQL output below the baseline migration's banner.
#
# WHY THIS IS A SCRIPT AND NOT A NOTE: the generated half of the baseline (entity/field metadata,
# base views, CRUD procs, permissions, FK indexes) is what makes a fresh `mj migrate` produce a
# WORKING database rather than bare tables. Forgetting the step is not obvious at the time — the
# migration still applies — and is unrecoverable without another full rebuild.
#
# The migration is split at the CODEGEN OUTPUT banner: everything above it is hand-authored DDL and
# is preserved verbatim; everything below is replaced with the current CodeGen output.
#
# Usage: scripts/append-codegen.sh [migration-file]
set -euo pipefail

cd "$(dirname "$0")/.."
MIGRATION="${1:-migrations/B202605281200__v1.0.x__Schema_and_Tables.sql}"
GENERATED_DIR="migrations/codegen"
MARKER='CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE'

[[ -f "$MIGRATION" ]] || { echo "no such migration: $MIGRATION" >&2; exit 1; }
grep -q "$MARKER" "$MIGRATION" || { echo "no CODEGEN OUTPUT banner in $MIGRATION" >&2; exit 1; }

shopt -s nullglob
GENERATED=("$GENERATED_DIR"/*.sql)
(( ${#GENERATED[@]} )) || { echo "no CodeGen output in $GENERATED_DIR — run 'npm run mj:codegen' first" >&2; exit 1; }

# Keep the hand-authored half plus the banner; drop whatever generated tail is already there.
# The banner block ends at the LAST '-- ====' rule following the marker line, so the explanatory
# comment inside the banner survives.
MARKER_LINE=$(grep -n "$MARKER" "$MIGRATION" | head -1 | cut -d: -f1)
BANNER_END=$(awk -v s="$MARKER_LINE" 'NR>s && /^-- =+$/ { last=NR } NR>s && !/^--/ && NF { exit } END { print last }' "$MIGRATION")
[[ -n "$BANNER_END" ]] || { echo "could not find the end of the banner block" >&2; exit 1; }

TMP=$(mktemp)
head -n "$BANNER_END" "$MIGRATION" > "$TMP"
printf '\n\n' >> "$TMP"
for f in "${GENERATED[@]}"; do
    printf '  + %s\n' "$(basename "$f")" >&2
    cat "$f" >> "$TMP"
    printf '\n' >> "$TMP"
done

mv "$TMP" "$MIGRATION"
printf '\n%s is now %s lines (%s hand-authored + banner, rest generated)\n' \
    "$MIGRATION" "$(wc -l < "$MIGRATION" | tr -d ' ')" "$BANNER_END"
