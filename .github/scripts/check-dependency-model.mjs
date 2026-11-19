#!/usr/bin/env node
// ==============================================================================
// Dependency model guard (BizApps family)
//
// Part 1 — Single-copy peer model:
// A host installs ONE copy of MemberJunction and one copy of each Open App. A package that brings
// its own copy splits the class-factory registry: entities and resolvers stop registering, with no
// error. Two declarations do that:
//
//   1. @memberjunction/* in `dependencies`. A dependency is resolved on its own, so whenever its
//      range misses the host's version, pnpm installs a second MemberJunction tree.
//   2. A peer range that rejects later minor releases: `~6.1.5` (>=6.1.5 <6.2.0) or an exact
//      version. Every 6.2 host then reports the peer unmet and gets a 6.1 copy.
//
// The same holds for another app's @mj-biz-apps/* packages: the host installs that app once.
//
// So, for every published package in packages/ (private packages are skipped):
//   - @memberjunction/* and other apps' @mj-biz-apps/* packages never appear in `dependencies`;
//   - their peerDependencies ranges are caret (^X.Y.Z), or `>=X.Y.Z` (optionally `<N.0.0`) for a
//     0.x package, where a caret would pin the minor;
//   - exact versions belong in devDependencies, which anchor local builds and never ship.
// This repo's own packages may depend on each other with exact versions.
//
// Part 2 — Manifest tier isolation (mj-app.json):
// The Open App engine imports every package listed under `packages.shared` or `packages.client` in
// mj-app.json into the Explorer browser workspace. If a `shared` or `client` package depends on or
// peers with a server-only package (either a package listed under `packages.server` in mj-app.json,
// or a server-only @memberjunction/* / @mj-biz-apps/* package such as @memberjunction/actions-base,
// @memberjunction/actions, @memberjunction/server, @memberjunction/sqlserver-dataprovider, or
// @memberjunction/core-entities-server), Node-only code enters the browser dependency graph.
//
// Usage:  node .github/scripts/check-dependency-model.mjs [repo-root]
//         node .github/scripts/check-dependency-model.mjs --self-test
// ==============================================================================
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MJ_SCOPE = '@memberjunction/';
const APP_SCOPE = '@mj-biz-apps/';
/**
 * `^6.1.5` / `^6.1.0-edge.5` (major 1 or above), or `>=0.5.0` with an optional upper bound on a major
 * boundary (`>=0.5.0 <1.0.0`). Caret on a 0.x version (`^0.5.0` = `>=0.5.0 <0.6.0`) pins the minor,
 * so it is checked separately below.
 */
const ACCEPTED_RANGE = /^(\^[1-9]\d*\.\d+\.\d+(-[0-9A-Za-z.-]+)?|>=\s*\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\s+<\s*\d+\.0\.0(-0)?)?)$/;
const ZERO_MAJOR_CARET = /^\^0\.\d+\.\d+/;
const MAX_DEPTH = 3;
const DEP_SECTIONS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

/**
 * MemberJunction packages whose dependency graphs pull in Node-only modules (database drivers,
 * isolated-vm / code execution, GraphQL / Express server bootstrap, server-side entity hooks) and
 * must never be declared in `dependencies`, `peerDependencies`, or `optionalDependencies` of a
 * package listed under `packages.shared` or `packages.client` in `mj-app.json`.
 */
const SERVER_ONLY_MJ_PACKAGES = new Set([
  '@memberjunction/actions',
  '@memberjunction/actions-base',
  '@memberjunction/ai',
  '@memberjunction/aiengine',
  '@memberjunction/core-entities-server',
  '@memberjunction/generic-database-provider',
  '@memberjunction/postgresql-dataprovider',
  '@memberjunction/server',
  '@memberjunction/server-bootstrap',
  '@memberjunction/server-bootstrap-lite',
  '@memberjunction/sqlserver-dataprovider',
  '@memberjunction/storage',
]);

const SERVER_ONLY_MJ_PREFIXES = [
  '@memberjunction/actions-',
];

const SERVER_ONLY_APP_SUFFIXES = [
  '-server',
  '-core-entities-server',
  '-actions',
  '-core',
];

/** Every package.json under `dir` (node_modules and dot-directories skipped), to MAX_DEPTH levels. */
function findManifests(dir, depth = 0) {
  if (!existsSync(dir) || depth > MAX_DEPTH) {
    return [];
  }
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findManifests(path, depth + 1));
    } else if (entry.name === 'package.json') {
      found.push(path);
    }
  }
  return found;
}

/** True for a package that comes from MemberJunction or from another Open App. */
function isHostProvided(name, ownNames) {
  return name.startsWith(MJ_SCOPE) || (name.startsWith(APP_SCOPE) && !ownNames.has(name));
}

/** True when `name` is a server-only package (from mj-app.json `packages.server`, MJ, or a sibling Open App). */
export function IsServerOnlyPackage(name, repoServerNames = new Set()) {
  if (repoServerNames.has(name)) {
    return true;
  }
  if (SERVER_ONLY_MJ_PACKAGES.has(name) || SERVER_ONLY_MJ_PREFIXES.some((p) => name.startsWith(p))) {
    return true;
  }
  if (name.startsWith(APP_SCOPE) && SERVER_ONLY_APP_SUFFIXES.some((s) => name.endsWith(s))) {
    return true;
  }
  return false;
}

/** The problems in one manifest, as human-readable lines. */
export function CheckManifest(manifest, ownNames) {
  const problems = [];
  for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
    if (isHostProvided(name, ownNames)) {
      problems.push(`${name}@${spec} is in dependencies: move it to peerDependencies with a caret range, `
        + 'and keep an exact devDependencies entry for local builds.');
    }
  }
  for (const [name, spec] of Object.entries(manifest.peerDependencies ?? {})) {
    const range = String(spec).trim();
    if (!isHostProvided(name, ownNames) || ACCEPTED_RANGE.test(range)) {
      continue;
    }
    problems.push(ZERO_MAJOR_CARET.test(range)
      ? `peer ${name}@${spec}: ^0.x pins the minor version. Use >=${range.slice(1)} <1.0.0.`
      : `peer ${name}@${spec}: use a caret range (^X.Y.Z), or >=X.Y.Z for a 0.x package. `
        + '~ and exact versions reject every later minor release of the host.');
  }
  return problems;
}

/**
 * Direct and transitive server-only dependencies reachable from `startManifest` through in-repo
 * manifests (`byName`), excluding `devDependencies`.
 */
function findServerOnlyReachability(startManifest, tier, byName, repoServerNames) {
  const problems = [];
  for (const section of DEP_SECTIONS) {
    for (const [dep, spec] of Object.entries(startManifest[section] ?? {})) {
      if (IsServerOnlyPackage(dep, repoServerNames)) {
        problems.push(
          `${tier} package ${startManifest.name} (in mj-app.json) declares server-only ${section} `
            + `${dep}@${spec}: shared and client packages must stay browser-safe.`,
        );
        continue;
      }
      const chain = findTransitiveServerPath(dep, byName, repoServerNames, new Set([startManifest.name]));
      if (chain !== null) {
        problems.push(
          `${tier} package ${startManifest.name} (in mj-app.json) transitively reaches server-only package `
            + `${chain[chain.length - 1]} via ${[startManifest.name, ...chain].join(' -> ')}.`,
        );
      }
    }
  }
  return problems;
}

/** Returns the shortest path `[pkg, ..., serverOnlyLeaf]` through in-repo packages, or `null`. */
function findTransitiveServerPath(pkgName, byName, repoServerNames, visited) {
  const target = byName.get(pkgName);
  if (!target || visited.has(pkgName)) {
    return null;
  }
  visited.add(pkgName);
  for (const section of DEP_SECTIONS) {
    for (const dep of Object.keys(target.json[section] ?? {})) {
      if (IsServerOnlyPackage(dep, repoServerNames)) {
        return [pkgName, dep];
      }
      const subPath = findTransitiveServerPath(dep, byName, repoServerNames, visited);
      if (subPath !== null) {
        return [pkgName, ...subPath];
      }
    }
  }
  return null;
}

/**
 * Reads `mj-app.json` at `root` (when present) and appends any client/shared-tier server dependency
 * violations to `problemsByFile`.
 */
function checkAppManifestTiers(root, byName, problemsByFile) {
  const appPath = join(root, 'mj-app.json');
  if (!existsSync(appPath)) {
    return;
  }
  const appJson = JSON.parse(readFileSync(appPath, 'utf8'));
  const pkgs = appJson.packages ?? {};
  const repoServerNames = new Set((pkgs.server ?? []).map((p) => p?.name).filter(Boolean));

  for (const tier of ['shared', 'client']) {
    for (const entry of pkgs[tier] ?? []) {
      const name = entry?.name;
      if (!name) {
        continue;
      }
      const manifestEntry = byName.get(name);
      if (!manifestEntry) {
        const list = problemsByFile.get('mj-app.json') ?? [];
        list.push(`packages.${tier} lists ${name}, which does not match any package.json under packages/.`);
        problemsByFile.set('mj-app.json', list);
        continue;
      }
      const relFile = relative(root, manifestEntry.file);
      const list = problemsByFile.get(relFile) ?? [];
      if (repoServerNames.has(name)) {
        list.push(`${name} is listed under both packages.${tier} and packages.server in mj-app.json.`);
      }
      list.push(...findServerOnlyReachability(manifestEntry.json, tier, byName, repoServerNames));
      if (list.length > 0) {
        problemsByFile.set(relFile, list);
      }
    }
  }
}

/** Checks every published package under `root`/packages and mj-app.json tiers; returns `{ file, problems }[]`. */
export function CheckRepo(root) {
  const manifests = findManifests(join(root, 'packages')).map((file) => ({
    file,
    json: JSON.parse(readFileSync(file, 'utf8')),
  }));
  const ownNames = new Set(manifests.map((m) => m.json.name).filter(Boolean));
  const byName = new Map(manifests.filter((m) => m.json.name).map((m) => [m.json.name, m]));
  const problemsByFile = new Map();

  for (const m of manifests) {
    if (!m.json.name || m.json.private === true) {
      continue;
    }
    const problems = CheckManifest(m.json, ownNames);
    if (problems.length > 0) {
      problemsByFile.set(relative(root, m.file), problems);
    }
  }

  checkAppManifestTiers(root, byName, problemsByFile);

  return Array.from(problemsByFile.entries())
    .filter(([, problems]) => problems.length > 0)
    .map(([file, problems]) => ({ file, problems }));
}

function report(root) {
  const failures = CheckRepo(root);
  for (const { file, problems } of failures) {
    console.log(`✗ ${file}`);
    for (const problem of problems) {
      console.log(`    ${problem}`);
    }
  }
  if (failures.length > 0) {
    console.log('\nSee the "Angular pinning model" / dependency and mj-app.json tier rules in CLAUDE.md.');
    return 1;
  }
  console.log('✓ Dependency model: MemberJunction and other apps\' packages are caret peers, and shared/client tiers are browser-safe.');
  return 0;
}

// ---------------------------------------------------------------------------
// Self-test: each fixture must produce exactly the expected number of problems.
// ---------------------------------------------------------------------------

const FIXTURES = [
  { name: 'caret peers + exact dev anchors pass', expect: 0, pkg: {
    name: '@mj-biz-apps/demo-entities',
    peerDependencies: { '@memberjunction/core': '^6.1.5', '@mj-biz-apps/common-entities': '^5.51.0' },
    devDependencies: { '@memberjunction/core': '6.1.5' } } },
  { name: 'major-bounded range passes', expect: 0, pkg: {
    name: '@mj-biz-apps/demo-ng', peerDependencies: { '@memberjunction/ng-shared': '>=6.1.5 <7.0.0' } } },
  { name: 'open lower bound passes for a 0.x package', expect: 0, pkg: {
    name: '@mj-biz-apps/demo-ng', peerDependencies: { '@mj-biz-apps/accounting-entities': '>=0.5.0' } } },
  { name: 'caret on a 0.x package fails (pins the minor)', expect: 1, pkg: {
    name: '@mj-biz-apps/demo-ng', peerDependencies: { '@mj-biz-apps/accounting-entities': '^0.5.0' } } },
  { name: 'MJ in dependencies fails', expect: 1, pkg: {
    name: '@mj-biz-apps/demo-server', dependencies: { '@memberjunction/server': '^6.1.5' } } },
  { name: 'tilde peer fails', expect: 1, pkg: {
    name: '@mj-biz-apps/demo-server', peerDependencies: { '@memberjunction/core': '~6.1.5' } } },
  { name: 'exact peer fails', expect: 1, pkg: {
    name: '@mj-biz-apps/demo-server', peerDependencies: { '@memberjunction/core': '6.1.5' } } },
  { name: "another app's package pinned in dependencies fails", expect: 1, pkg: {
    name: '@mj-biz-apps/demo-server', dependencies: { '@mj-biz-apps/common-entities': '5.34.0' } } },
  { name: "this repo's own packages may pin each other", expect: 0, pkg: {
    name: '@mj-biz-apps/demo-server', dependencies: { '@mj-biz-apps/demo-entities': '1.2.3' } } },
  { name: 'private packages are skipped', expect: 0, pkg: {
    name: '@mj-biz-apps/demo-tests', private: true, dependencies: { '@memberjunction/core': '6.1.5' } } },
  {
    name: 'mj-app.json: browser-safe shared and client tiers pass',
    expect: 0,
    pkg: {
      name: '@mj-biz-apps/demo-ng',
      dependencies: { '@mj-biz-apps/demo-entities': '1.0.0' },
      peerDependencies: { '@memberjunction/core': '^6.1.5', '@memberjunction/ng-shared': '^6.1.5' },
    },
    app: {
      packages: {
        server: [{ name: '@mj-biz-apps/demo-server' }],
        client: [{ name: '@mj-biz-apps/demo-ng' }],
        shared: [{ name: '@mj-biz-apps/demo-entities' }],
      },
    },
    extraPkgs: {
      Server: { name: '@mj-biz-apps/demo-server', peerDependencies: { '@memberjunction/server': '^6.1.5' } },
    },
  },
  {
    name: 'mj-app.json: client package peering with @memberjunction/actions-base fails (#396/#397)',
    expect: 1,
    pkg: {
      name: '@mj-biz-apps/demo-ng',
      peerDependencies: { '@memberjunction/core': '^6.1.5', '@memberjunction/actions-base': '^6.1.5' },
    },
    app: {
      packages: {
        server: [],
        client: [{ name: '@mj-biz-apps/demo-ng' }],
        shared: [{ name: '@mj-biz-apps/demo-entities' }],
      },
    },
  },
  {
    name: 'mj-app.json: shared package peering with @memberjunction/sqlserver-dataprovider fails (#146/#397)',
    expect: 1,
    pkg: {
      name: '@mj-biz-apps/demo-actions',
      peerDependencies: { '@memberjunction/core': '^6.1.5', '@memberjunction/sqlserver-dataprovider': '^6.1.5' },
    },
    app: {
      packages: {
        server: [],
        client: [],
        shared: [{ name: '@mj-biz-apps/demo-actions' }],
      },
    },
  },
  {
    name: 'mj-app.json: client package depending on a repo server-tier package fails',
    expect: 1,
    pkg: {
      name: '@mj-biz-apps/demo-ng',
      dependencies: { '@mj-biz-apps/demo-core-entities-server': '1.0.0' },
    },
    app: {
      packages: {
        server: [{ name: '@mj-biz-apps/demo-core-entities-server' }],
        client: [{ name: '@mj-biz-apps/demo-ng' }],
        shared: [{ name: '@mj-biz-apps/demo-entities' }],
      },
    },
    extraPkgs: {
      CoreEntitiesServer: {
        name: '@mj-biz-apps/demo-core-entities-server',
        peerDependencies: { '@memberjunction/core': '^6.1.5' },
      },
    },
  },
  {
    name: 'mj-app.json: client package transitively reaching a server-only package fails',
    expect: 1,
    pkg: {
      name: '@mj-biz-apps/demo-ng',
      dependencies: { '@mj-biz-apps/demo-helper': '1.0.0' },
    },
    app: {
      packages: {
        server: [{ name: '@mj-biz-apps/demo-server' }],
        client: [{ name: '@mj-biz-apps/demo-ng' }],
        shared: [{ name: '@mj-biz-apps/demo-entities' }],
      },
    },
    extraPkgs: {
      Helper: {
        name: '@mj-biz-apps/demo-helper',
        peerDependencies: { '@memberjunction/core-entities-server': '^6.1.5' },
      },
      Server: {
        name: '@mj-biz-apps/demo-server',
        peerDependencies: { '@memberjunction/server': '^6.1.5' },
      },
    },
  },
];

function selfTest() {
  let failed = 0;
  for (const fixture of FIXTURES) {
    const root = mkdtempSync(join(tmpdir(), 'dep-model-'));
    try {
      const own = join(root, 'packages', 'Entities');
      mkdirSync(own, { recursive: true });
      writeFileSync(join(own, 'package.json'), JSON.stringify({ name: '@mj-biz-apps/demo-entities' }));
      const dir = join(root, 'packages', 'Subject');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'package.json'), JSON.stringify(fixture.pkg));
      for (const [folder, pkgJson] of Object.entries(fixture.extraPkgs ?? {})) {
        const extraDir = join(root, 'packages', folder);
        mkdirSync(extraDir, { recursive: true });
        writeFileSync(join(extraDir, 'package.json'), JSON.stringify(pkgJson));
      }
      if (fixture.app) {
        writeFileSync(join(root, 'mj-app.json'), JSON.stringify(fixture.app));
      }
      const found = CheckRepo(root).flatMap((r) => r.problems).length;
      const ok = found === fixture.expect;
      failed += ok ? 0 : 1;
      console.log(`${ok ? '✓' : '✗'} ${fixture.name} (expected ${fixture.expect}, found ${found})`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  console.log(failed === 0 ? `\nSelf-test passed: ${FIXTURES.length} fixtures.` : `\nSelf-test FAILED: ${failed} fixture(s).`);
  return failed === 0 ? 0 : 1;
}

/**
 * True only when this file was run directly, not imported. Both sides go through realpathSync, so a
 * script reached through a symlink (macOS `/tmp` is one) still runs `main`. An `argv[1]` that cannot
 * be resolved does not name this file, so `false` is the answer, not a swallowed error.
 */
function isDirectlyExecuted() {
  if (process.argv[1] === undefined) {
    return false;
  }
  let invokedPath;
  try {
    invokedPath = realpathSync(process.argv[1]);
  } catch {
    return false;
  }
  return invokedPath === realpathSync(fileURLToPath(import.meta.url));
}

if (isDirectlyExecuted()) {
  const arg = process.argv[2];
  process.exit(arg === '--self-test' ? selfTest() : report(arg ?? process.cwd()));
}
