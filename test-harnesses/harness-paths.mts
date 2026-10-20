/**
 * Where the harnesses find the repo, the database settings, the mjdev launcher and tsx.
 *
 * Paths to files in this repo resolve from this file's location, never from the working directory,
 * so a harness runs the same from a plain clone (`npx tsx test-harnesses/...` at the repo root) and
 * from inside an MJ Dev Manager instance (repo at `<instance>/packages/dev-apps/bizapps-accounting`).
 * Things that live outside the repo (the instance's `.env`, `bin/mjdev`, `node_modules/.bin/tsx`)
 * are searched for upward from the repo root.
 *
 * Overrides: MJDEV_BIN (launcher path; otherwise `bin/mjdev` above the repo, then `mjdev` on PATH).
 */
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/** The repo root (this file sits in `<root>/test-harnesses/`). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The first `<dir>/<relativePath>` that exists, from `start` up to the filesystem root. */
export function FindUp(relativePath: string, start: string = REPO_ROOT): string | null {
  let dir = start;
  for (;;) {
    const candidate = path.join(dir, relativePath);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** The mjdev launcher: MJDEV_BIN, else the nearest `bin/mjdev` above the repo, else `mjdev` on PATH. */
export const MJDEV_BIN = process.env.MJDEV_BIN ?? FindUp(path.join('bin', 'mjdev')) ?? 'mjdev';

/** The nearest installed tsx binary, else `tsx` on PATH. */
export const TSX_BIN = FindUp(path.join('node_modules', '.bin', 'tsx')) ?? 'tsx';

/**
 * Load DB and auth settings: the working directory's `.env`, then the nearest `.env` from the repo
 * root upward (the repo's own in a clone, the instance root's inside an mjdev instance). dotenv
 * never overrides a value already set, so the first file that sets a key wins.
 */
export function LoadHarnessEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const nearest = FindUp('.env');
  if (nearest) dotenv.config({ path: nearest, quiet: true });
}
