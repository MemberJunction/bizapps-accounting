#!/bin/bash
# Fails if any tracked JSON file references a sibling ../MJ checkout.
# A tsconfig `paths` entry pointing at ../MJ resolves MJ types from whatever
# happens to be checked out next to this repo instead of the installed
# @memberjunction packages, so builds pass locally and differ in CI (#171).
# Scans the whole tree, not just the PR diff, so an existing reference is
# caught too.
#
# Scope is JSON only, deliberately: that is where the reference arrived (#186).
# Aliases in .ts/.mjs configs or pnpm-workspace.yaml are not checked.
# Case-insensitive because macOS resolves ../mj/ to ../MJ/; the trailing
# boundary keeps sibling names such as ../MJAPI from matching.

MATCHES=$(git grep -niE '\.\./MJ([/"]|$)' -- '*.json')
STATUS=$?

# git grep exits 1 for "no match"; anything higher is a git error, not a pass.
if [ "$STATUS" -gt 1 ]; then
  echo "::error::git grep failed (exit $STATUS); cannot verify the absence of ../MJ references"
  exit 1
fi

if [ -n "$MATCHES" ]; then
  echo "::error::JSON files reference a sibling ../MJ checkout. Resolve MJ from the installed @memberjunction packages instead."
  echo "$MATCHES"
  exit 1
fi

echo "No sibling ../MJ references in JSON files"
