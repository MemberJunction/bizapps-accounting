/**
 * Shape tests for the Entity Action bindings in `metadata/entity-actions/`.
 *
 * CONNECTS TO:
 *   TESTS:   metadata/entity-actions/.entity-actions.json (authored bindings)
 *   DOC:     plans/mj-entity-action-workflow-adoption.md
 *
 * These guard the accounting-specific safety rules the adoption plan calls load-bearing, all of
 * which are properties of the JSON and so are checkable without a database:
 *
 *   - No binding uses a Before* or Validate invocation. The balanced-JE and batch-lock triggers are
 *     DEFERRABLE constraint triggers that fire at COMMIT; a synchronous binding runs inside that
 *     same transaction and interleaves with them.
 *   - Nothing ships Active. The bindings are templates an administrator completes (recipient,
 *     company scope, threshold); MJ's provider dispatches only Active rows, so Pending is inert.
 *   - CK_EntityAction_Scope: ScopeEntityID and ScopeRecordID are both set or both NULL.
 *   - Every `Script` param actually compiles under the engine's wrapper, so a syntax error is caught
 *     here rather than swallowed by SafeEvalScript's catch at runtime.
 *
 * Pure logic, no database, deterministic, < 5s (MJ unit-test convention).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const METADATA_FILE = resolve(HERE, '../../../../metadata/entity-actions/.entity-actions.json');

type MetadataRecord = {
  fields: Record<string, string | number | null>;
  relatedEntities?: Record<string, MetadataRecord[]>;
  primaryKey?: { ID: string };
};

const BINDINGS: MetadataRecord[] = JSON.parse(readFileSync(METADATA_FILE, 'utf8'));

/** Invocations that run inside the caller's transaction, alongside the deferrable constraint triggers. */
const SYNCHRONOUS_INVOCATIONS = ['BeforeCreate', 'BeforeUpdate', 'BeforeDelete', 'Validate'];

const invocationsOf = (b: MetadataRecord): MetadataRecord[] =>
  b.relatedEntities?.['MJ: Entity Action Invocations'] ?? [];
const paramsOf = (b: MetadataRecord): MetadataRecord[] =>
  b.relatedEntities?.['MJ: Entity Action Params'] ?? [];

describe('metadata/entity-actions — authored bindings', () => {
  it('parses and declares the two buildable bindings', () => {
    expect(BINDINGS).toHaveLength(2);
    expect(BINDINGS.map(b => b.fields.EntityID)).toEqual([
      '@lookup:MJ: Entities.Name=MJ_BizApps_Accounting: Journal Entry Batches',
      '@lookup:MJ: Entities.Name=MJ_BizApps_Accounting: Journal Entries',
    ]);
  });

  it('binds every entity and action by @lookup, never by a raw UUID', () => {
    for (const b of BINDINGS) {
      expect(String(b.fields.EntityID)).toMatch(/^@lookup:MJ: Entities\.Name=/);
      expect(String(b.fields.ActionID)).toMatch(/^@lookup:MJ: Actions\.Name=/);
    }
  });

  it('never binds a Before* or Validate invocation (deferrable constraint triggers)', () => {
    for (const b of BINDINGS) {
      for (const inv of invocationsOf(b)) {
        const type = String(inv.fields.InvocationTypeID);
        for (const banned of SYNCHRONOUS_INVOCATIONS) {
          expect(type.endsWith(`Name=${banned}`), `${type} runs in the caller's transaction`).toBe(false);
        }
      }
    }
  });

  it('ships nothing Active — bindings and their invocations are all Pending', () => {
    for (const b of BINDINGS) {
      expect(b.fields.Status).toBe('Pending');
      for (const inv of invocationsOf(b)) {
        expect(inv.fields.Status).toBe('Pending');
      }
      expect(invocationsOf(b).length).toBeGreaterThan(0);
    }
  });

  it('satisfies CK_EntityAction_Scope — scope columns are both set or both unset', () => {
    for (const b of BINDINGS) {
      const hasEntity = b.fields.ScopeEntityID != null;
      const hasRecord = b.fields.ScopeRecordID != null;
      expect(hasEntity).toBe(hasRecord);
    }
  });

  it('never authors a `sync` block or an audit column', () => {
    const walk = (r: MetadataRecord): void => {
      expect(r).not.toHaveProperty('sync');
      for (const audit of ['__mj_CreatedAt', '__mj_UpdatedAt', 'CreatedAt', 'UpdatedAt']) {
        expect(r.fields).not.toHaveProperty(audit);
      }
      for (const children of Object.values(r.relatedEntities ?? {})) children.forEach(walk);
    };
    BINDINGS.forEach(walk);
  });

  it('gives every record and child a unique hardcoded primary key', () => {
    const ids: string[] = [];
    const walk = (r: MetadataRecord): void => {
      expect(r.primaryKey?.ID).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/);
      ids.push(r.primaryKey!.ID);
      for (const children of Object.values(r.relatedEntities ?? {})) children.forEach(walk);
    };
    BINDINGS.forEach(walk);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('wires every child to its parent via @parent:ID', () => {
    for (const b of BINDINGS) {
      for (const inv of invocationsOf(b)) expect(inv.fields.EntityActionID).toBe('@parent:ID');
      for (const p of paramsOf(b)) expect(p.fields.EntityActionID).toBe('@parent:ID');
    }
  });

  it('compiles every Script param under the engine\'s SafeEvalScript wrapper', () => {
    let scripts = 0;
    for (const b of BINDINGS) {
      for (const p of paramsOf(b)) {
        if (p.fields.ValueType !== 'Script') continue;
        scripts++;
        expect(
          () => new Function('EntityActionContext', `return (async () => {${p.fields.Value}})();`),
        ).not.toThrow();
      }
    }
    expect(scripts).toBe(4);
  });

  it('uses only ValueTypes the CHK_EntityActionParam_ValueType constraint allows', () => {
    const allowed = new Set(['Script', 'Entity Object', 'Entity Object Data', 'Entity Field', 'Static']);
    for (const b of BINDINGS) {
      for (const p of paramsOf(b)) {
        expect(allowed.has(String(p.fields.ValueType))).toBe(true);
      }
    }
  });
});
