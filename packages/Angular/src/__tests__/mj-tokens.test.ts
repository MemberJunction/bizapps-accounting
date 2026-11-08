import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * TIER 1 — every `var(--mj-…)` this package reads is a name something defines (#390).
 *
 * CSS reports nothing for an unknown custom property. A declaration that reads one with no fallback
 * is dropped, so the element inherits instead; one with a fallback always renders the fallback and
 * follows neither theme. Accepted names are MemberJunction's design tokens, read from the installed
 * `@memberjunction/ng-shared-generic` (so a version bump moves the list with it), plus the few
 * `--mj-*` properties this package declares itself.
 */

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SRC = join(HERE, '..');
const PACKAGE_ROOT = join(SRC, '..');
const MJ_TOKENS = join(PACKAGE_ROOT, 'node_modules/@memberjunction/ng-shared-generic/dist/lib/_tokens.scss');

const SKIP_DIR = new Set(['generated', 'node_modules', 'dist']);
const STYLE_SOURCE = /\.(ts|css|scss|html)$/;
const TOKEN_USE = /var\(\s*(--mj-[a-z0-9-]+)/g;
const TOKEN_DECLARATION = /(--mj-[a-z0-9-]+)\s*:/g;

function sourcesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIR.has(entry)) found.push(...sourcesUnder(full));
    } else if (STYLE_SOURCE.test(entry) && !entry.endsWith('.d.ts') && !/\.test\.ts$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

function namesIn(text: string, pattern: RegExp): Set<string> {
  return new Set([...text.matchAll(pattern)].map((m) => m[1]));
}

describe('MJ design tokens', () => {
  const files = sourcesUnder(SRC);
  const mjTokens = namesIn(readFileSync(MJ_TOKENS, 'utf8'), TOKEN_DECLARATION);
  const localTokens = new Set(files.flatMap((f) => [...namesIn(readFileSync(f, 'utf8'), TOKEN_DECLARATION)]));

  it('reads a real token list and real sources (guard is pointed at something)', () => {
    expect(mjTokens.size).toBeGreaterThan(100);
    expect(files.length).toBeGreaterThan(50);
  });

  it('uses only names MemberJunction or this package defines', () => {
    const unknown: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
        for (const [, name] of line.matchAll(TOKEN_USE)) {
          if (!mjTokens.has(name) && !localTokens.has(name)) {
            unknown.push(`${relative(SRC, file).split(sep).join('/')}:${i + 1}  ${name}`);
          }
        }
      });
    }
    expect(unknown, `--mj-* names nothing defines:\n${unknown.join('\n')}`).toEqual([]);
  });
});
