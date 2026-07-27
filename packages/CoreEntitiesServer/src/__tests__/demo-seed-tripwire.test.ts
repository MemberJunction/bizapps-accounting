/**
 * TRIPWIRE (ruled by Marcelo 2026-07-27): AssociationDemoSeedData is dev/test-only and must be
 * removed before anything ships to `main`. This test is green everywhere EXCEPT a run whose
 * target branch is main (GITHUB_BASE_REF in GitHub Actions PR builds, or TARGET_BRANCH set by
 * hand) while the seed file still exists.
 *
 * Known limitation, on purpose rather than silently: CI does not run vitest on PRs today (and no
 * workflow triggers on PRs to main at all), so this fires when the release-PR author runs
 * `npm test` locally — which the release checklist requires. If CI ever gains a test step, this
 * starts firing there automatically with no changes.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SEED_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'AssociationDemoSeedData.ts');

describe('demo-seed tripwire (dev/test-only code must not reach main)', () => {
  it('AssociationDemoSeedData must be removed before a PR to main', () => {
    const targetBranch = process.env.GITHUB_BASE_REF ?? process.env.TARGET_BRANCH ?? '';
    if (targetBranch.trim().toLowerCase() === 'main') {
      expect(
        existsSync(SEED_FILE),
        'AssociationDemoSeedData.ts is dev/test-only and must be deleted (with its index.ts export and this tripwire) before merging to main — ruled 2026-07-27.',
      ).toBe(false);
    } else {
      // Not a main-targeted run — assert the tripwire is still wired to the real file location,
      // so a rename/move can't silently disarm it.
      expect(existsSync(SEED_FILE)).toBe(true);
    }
  });
});
