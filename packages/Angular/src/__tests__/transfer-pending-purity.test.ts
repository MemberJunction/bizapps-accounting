import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * TIER 1 — parking-discipline guard (UI plan §0; plans/TRANSFER-BACKLOG.md).
 *
 * Components in `lib/transfer-pending/` are PARKED here for iteration speed and are owed to other
 * homes (bizapps-common / bizapps-tasks / MJ base). The rule that keeps extraction a file move
 * rather than a refactor: **they may not import anything accounting-specific.**
 *
 * A prose rule decays the moment someone is in a hurry. This test is the enforcement — it fails the
 * build the moment a parked component reaches for an accounting type. Do not weaken it; if a
 * component genuinely needs an accounting type, it is not framework-clean and belongs in
 * `lib/custom/shared/` instead.
 */

const HERE = fileURLToPath(new URL('.', import.meta.url));
const TRANSFER_PENDING = join(HERE, '..', 'lib', 'transfer-pending');

/** Import specifiers a parked component must never reach for. */
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /@mj-biz-apps\/accounting-/, why: 'an accounting package (entities/engine/actions)' },
  { pattern: /@mj-biz-apps\/common-/, why: 'a bizapps-common package (parked code must not bind to a sibling app either)' },
  { pattern: /from\s+['"]\.\.\/\.\.\/custom\//, why: "this app's custom/ folder" },
  { pattern: /from\s+['"](\.\.\/)+lib\/custom\//, why: "this app's custom/ folder" },
  { pattern: /from\s+['"](\.\.\/)+generated\//, why: "this app's generated entity code" },
];

/** Every import specifier in a TS source file (static imports, type imports, and re-exports). */
function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importRegex = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(source)) !== null) specifiers.push(match[1]);
  return specifiers;
}

function tsFilesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...tsFilesUnder(full));
    } else if (entry.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

describe('transfer-pending parking discipline', () => {
  const files = tsFilesUnder(TRANSFER_PENDING);

  it('finds the parked components (guard is actually pointed at something)', () => {
    // Without this, deleting/moving the folder would make every assertion below vacuously pass.
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [relative(TRANSFER_PENDING, f), f]))(
    '%s imports nothing accounting-specific',
    (_label, file) => {
      const source = readFileSync(file, 'utf8');
      const specifiers = importSpecifiers(source);

      const violations = specifiers.flatMap((specifier) =>
        FORBIDDEN_PATTERNS.filter(({ pattern }) => pattern.test(specifier) || pattern.test(`from '${specifier}'`)).map(
          ({ why }) => `"${specifier}" reaches into ${why}`,
        ),
      );

      expect(
        violations,
        `${relative(TRANSFER_PENDING, file)} breaks parking discipline:\n  ${violations.join('\n  ')}\n` +
          'Parked components must extract as a file move. Either drop the dependency (pass it in as an ' +
          '@Input/generic) or move the component to lib/custom/shared/ — it is not framework-clean.',
      ).toEqual([]);
    },
  );
});
