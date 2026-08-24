#!/usr/bin/env node
/**
 * Syncs `mj-app.json`'s `version` to the packages' version.
 *
 * Runs as part of `version:ci`, i.e. INSIDE the Version Packages PR, so the manifest
 * version arrives as a reviewable diff alongside the package.json bumps rather than
 * being written at publish time.
 *
 * Deliberately does NOT touch `mjVersionRange`. The previous publish-time step derived
 * it from the `@memberjunction/core` dependency, which silently overwrote a hand-chosen
 * value: 0.1.1 shipped `>=6.1.0-edge.3 <7.0.0` on purpose, and the 0.2.0 run rewrote it
 * to `>=6.1.0 <7.0.0` without anyone asking. The range is a deliberate compatibility
 * claim about which MJ era this app supports — it is not derivable from a dependency pin,
 * so it stays a human edit.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'packages/Entities/package.json'; // any package works: they are fixed-versioned
const TARGET = 'mj-app.json';

const version = JSON.parse(readFileSync(SOURCE, 'utf8')).version;
if (!version) {
  console.error(`✗ no version found in ${SOURCE}`);
  process.exit(1);
}

const raw = readFileSync(TARGET, 'utf8');
const manifest = JSON.parse(raw);

if (manifest.version === version) {
  console.log(`✓ ${TARGET} already at ${version} — nothing to do`);
  process.exit(0);
}

// Targeted line rewrite rather than JSON.stringify, so formatting and key order survive
// untouched and the PR diff is exactly one line.
const before = manifest.version;
const pattern = new RegExp(`("version"\\s*:\\s*)"${before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
if (!pattern.test(raw)) {
  console.error(`✗ could not locate "version": "${before}" in ${TARGET}`);
  process.exit(1);
}
writeFileSync(TARGET, raw.replace(pattern, `$1"${version}"`));
console.log(`✓ ${TARGET} version ${before} -> ${version} (mjVersionRange untouched)`);
