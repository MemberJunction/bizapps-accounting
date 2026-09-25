#!/bin/bash
# Fails if any tracked JSON file references a sibling ../MJ checkout.
# A tsconfig `paths` entry pointing at ../MJ resolves MJ types from whatever
# happens to be checked out next to this repo instead of the installed
# @memberjunction packages, so builds pass locally and differ in CI (#171).
# Scans the whole tree, not just the PR diff, so an existing reference is
# caught too.

MATCHES=$(git grep -n '\.\./MJ' -- '*.json' || true)

if [ -n "$MATCHES" ]; then
  echo "::error::JSON files reference a sibling ../MJ checkout. Resolve MJ from the installed @memberjunction packages instead."
  echo "$MATCHES"
  exit 1
fi

echo "No sibling ../MJ references in JSON files"
