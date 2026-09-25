import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * TIER 1 — spec-placement guard (#185).
 *
 * This package has two vitest configs over `src/`: `vitest.config.ts` (tier 1, node) and
 * `vitest.dom.config.ts` (TestBed + jsdom, `*.dom.test.ts`). A spec in the wrong place does not
 * error: a component spec named `foo.test.ts` runs under tier 1's node environment with no
 * TestBed, and a narrowed include glob would drop it silently. So every spec must be one of:
 *   - a tier-1 unit spec under `src/__tests__/`, or
 *   - a DOM spec named `*.dom.test.ts` (conventionally beside its component).
 */

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SRC = join(HERE, '..');

function specsUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...specsUnder(full));
    } else if (entry.endsWith('.test.ts')) {
      found.push(full);
    }
  }
  return found;
}

describe('spec placement', () => {
  const specs = specsUnder(SRC).map((f) => relative(SRC, f));

  it('finds specs (guard is actually pointed at something)', () => {
    // Without this, a wrong SRC path would make the placement check vacuously pass.
    expect(specs).toContain(['__tests__', 'spec-placement.test.ts'].join(sep));
  });

  it('every *.test.ts under src/ is in __tests__/ or named *.dom.test.ts', () => {
    const misplaced = specs.filter((f) => !f.startsWith(`__tests__${sep}`) && !f.endsWith('.dom.test.ts'));
    expect(
      misplaced,
      `Misplaced specs:\n  ${misplaced.join('\n  ')}\n` +
        'Move a pure unit spec into src/__tests__/, or rename a TestBed spec to *.dom.test.ts so ' +
        'vitest.dom.config.ts runs it under jsdom.',
    ).toEqual([]);
  });
});
