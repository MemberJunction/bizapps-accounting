/**
 * Every Accounting action names its category by ID (issue #406).
 *
 * MJ core ships its own action category named "Accounting" (under Business Apps), and this app seeds
 * another with the same name in `metadata/action-categories/`. A `Name=Accounting` lookup matches
 * both rows, so the category an action lands in could differ between hosts. Looking the category up
 * by the ID this app seeds makes it the same everywhere.
 *
 * CONNECTS TO:
 *   TESTS: metadata/actions/.accounting-actions.json, metadata/action-categories/.action-categories.json
 *
 * Pure logic, no database, deterministic, < 5s (MJ unit-test convention).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const METADATA = resolve(HERE, '../../../../metadata');

type MetadataRecord = {
  fields: Record<string, string | number | boolean | null>;
  primaryKey?: { ID: string };
};

const read = (path: string): MetadataRecord[] => JSON.parse(readFileSync(resolve(METADATA, path), 'utf8'));

const ACTIONS = read('actions/.accounting-actions.json');
const CATEGORIES = read('action-categories/.action-categories.json');

const CATEGORY_LOOKUP_BY_ID = /^@lookup:MJ: Action Categories\.ID=([0-9A-Fa-f-]{36})$/;

describe('metadata/actions — action categories', () => {
  it('declares at least one action', () => {
    expect(ACTIONS.length).toBeGreaterThan(0);
  });

  it('looks up every action category by ID, never by name', () => {
    for (const action of ACTIONS) {
      const category = String(action.fields.CategoryID);
      expect(category, `${action.fields.Name}`).toMatch(CATEGORY_LOOKUP_BY_ID);
    }
  });

  it('points every action at a category this app seeds', () => {
    const seeded = new Set(CATEGORIES.map(c => c.primaryKey?.ID.toUpperCase()));
    for (const action of ACTIONS) {
      const id = CATEGORY_LOOKUP_BY_ID.exec(String(action.fields.CategoryID))?.[1].toUpperCase();
      expect(seeded.has(id), `${action.fields.Name} -> ${id}`).toBe(true);
    }
  });
});
