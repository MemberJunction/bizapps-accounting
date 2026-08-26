/**
 * Unit tests for the Business Central → Dimension / DimensionValue sync CONFIG (metadata, not code).
 *
 * Mirrors `erp-account-sync-config.test.ts`: reads the committed metadata and runs each field map
 * through the SAME engine the integration sync uses at runtime (`FieldTransformEngine` from
 * @memberjunction/global — exactly what MJ's FieldMappingEngine calls). No DB, no BC, no network —
 * pure + deterministic.
 *
 * Guards against silent drift in the things that would break this sync quietly:
 *   - a lost key field (dedup stops working and every re-sync inserts duplicates)
 *   - the dimensions map losing its Priority lead over dimensionValues (the connector's
 *     MJDimensionID stamp reads the Record Map written by the dimensions pass, so order is
 *     load-bearing, not cosmetic)
 *   - a map pointed at the wrong entity or flipped to Push
 *   - the DimensionID source drifting off the synthetic connector-stamped field
 *
 * CONNECTS TO:
 *   metadata/erp-dimension-sync/.business-central-dimensions.json  (the two entity maps + field maps)
 *   metadata/erp-dimension-sync/.mj-sync.json                      (root entity for that directory)
 *   packages/Server/src/custom/BizAppsAccountingBusinessCentralConnector.ts (stamps MJDimensionID)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FieldTransformEngine, type TransformStep } from '@memberjunction/global';

// ─── locate + load the committed metadata (repo root is 4 levels up from this file) ──────────────
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(repoRoot, rel), 'utf-8')) as T;
}

interface FieldMapFields {
  SourceFieldName: string;
  DestinationFieldName: string;
  IsKeyField?: boolean;
  IsRequired?: boolean;
  Priority?: number;
  Status?: string;
  TransformPipeline?: string;
}
interface EntityMapFields {
  CompanyIntegrationID: string;
  ExternalObjectName: string;
  EntityID: string;
  SyncDirection: string;
  SyncEnabled?: boolean;
  Priority?: number;
  Status?: string;
}
interface FieldMapRec { fields: FieldMapFields }
interface EntityMapRec {
  fields: EntityMapFields;
  primaryKey: { ID: string };
  relatedEntities: { 'MJ: Company Integration Field Maps': FieldMapRec[] };
}
interface SyncDirConfig { entity: string }

const entityMaps = readJson<EntityMapRec[]>('metadata/erp-dimension-sync/.business-central-dimensions.json');
const syncDirConfig = readJson<SyncDirConfig>('metadata/erp-dimension-sync/.mj-sync.json');

const mapFor = (objectName: string): EntityMapRec => {
  const found = entityMaps.find((m) => m.fields.ExternalObjectName === objectName);
  if (!found) throw new Error(`no entity map for '${objectName}' in the committed metadata`);
  return found;
};
const fieldMapsOf = (objectName: string): FieldMapFields[] =>
  mapFor(objectName).relatedEntities['MJ: Company Integration Field Maps'].map((r) => r.fields);
const byDest = (objectName: string, dest: string): FieldMapFields | undefined =>
  fieldMapsOf(objectName).find((f) => f.DestinationFieldName === dest);

// ─── run a field map exactly as MJ's FieldMappingEngine.ApplyFieldMapping does ───────────────────
const engine = new FieldTransformEngine();
function applyFieldMap(fm: FieldMapFields, record: Record<string, unknown>): unknown {
  const steps: TransformStep[] = fm.TransformPipeline ? (JSON.parse(fm.TransformPipeline) as TransformStep[]) : [];
  const result = engine.ExecutePipeline(record[fm.SourceFieldName], record, steps);
  return result.Skipped ? undefined : result.Value;
}
function mapRecord(objectName: string, record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const fm of fieldMapsOf(objectName)) out[fm.DestinationFieldName] = applyFieldMap(fm, record);
  return out;
}

describe('BC → Dimension field mapping (real FieldTransformEngine)', () => {
  it('maps a full BC dimension record to Dimension fields', () => {
    expect(mapRecord('dimensions', {
      id: 'bc-dim-guid-1', code: 'DEPT', displayName: 'Department',
      consolidationCode: 'D', lastModifiedDateTime: '2026-08-26T00:00:00Z',
    })).toEqual({ Code: 'DEPT', Name: 'Department' });
  });

  it('maps a full BC dimensionValue record to DimensionValue fields', () => {
    expect(mapRecord('dimensionValues', {
      id: 'bc-val-guid-1', code: 'SALES', displayName: 'Sales',
      dimensionId: 'bc-dim-guid-1',
      MJDimensionID: 'A1B2C3D4-0000-4000-8000-000000000001', // stamped by the connector at fetch
    })).toEqual({
      DimensionID: 'A1B2C3D4-0000-4000-8000-000000000001',
      Code: 'SALES',
      Name: 'Sales',
    });
  });

  it('leaves DimensionID undefined when the connector could not stamp a parent', () => {
    // Deliberate: DimensionID is required, so the engine records a per-record failure rather than
    // inventing a parent. BC's own dimensionId is NOT a fallback — it is meaningless locally.
    const mapped = mapRecord('dimensionValues', { code: 'SALES', displayName: 'Sales', dimensionId: 'bc-dim-guid-1' });
    expect(mapped.DimensionID).toBeUndefined();
    expect(mapped.Code).toBe('SALES');
  });

  it('carries no transform pipelines — these are direct field copies', () => {
    for (const objectName of ['dimensions', 'dimensionValues']) {
      for (const fm of fieldMapsOf(objectName)) expect(fm.TransformPipeline).toBeUndefined();
    }
  });
});

describe('BC → Dimension config integrity', () => {
  it('dedups Dimension on Code (UQ_Dimension_Code is the natural key)', () => {
    expect(byDest('dimensions', 'Code')?.IsKeyField).toBe(true);
    expect(byDest('dimensions', 'Name')?.IsKeyField ?? false).toBe(false);
  });

  it('dedups DimensionValue on (DimensionID, Code) — the composite unique key', () => {
    expect(byDest('dimensionValues', 'DimensionID')?.IsKeyField).toBe(true);
    expect(byDest('dimensionValues', 'Code')?.IsKeyField).toBe(true);
    expect(byDest('dimensionValues', 'Name')?.IsKeyField ?? false).toBe(false);
  });

  it('sources DimensionID from the synthetic connector-stamped field, never BC\'s own GUID', () => {
    // BC's dimensionId is its own identifier; the accounting Dimension.ID is resolved at fetch time
    // through MJ's Record Map. A field-map `lookup` transform cannot do this (LookupConfig is a
    // static value map, not a database lookup), which is why the source is synthetic.
    expect(byDest('dimensionValues', 'DimensionID')?.SourceFieldName).toBe('MJDimensionID');
    expect(fieldMapsOf('dimensionValues').map((f) => f.SourceFieldName)).not.toContain('dimensionId');
  });

  it('maps every NOT NULL column that has no database default', () => {
    // Dimension: Code, Name. DimensionValue: DimensionID, Code, Name. Everything else on both
    // tables (ID, DisplayOrder, IsActive, timestamps) carries a DB default.
    for (const dest of ['Code', 'Name']) expect(byDest('dimensions', dest)).toBeDefined();
    for (const dest of ['DimensionID', 'Code', 'Name']) expect(byDest('dimensionValues', dest)).toBeDefined();
  });

  it('requires every mapped field (a null would violate NOT NULL)', () => {
    for (const objectName of ['dimensions', 'dimensionValues']) {
      for (const fm of fieldMapsOf(objectName)) expect(fm.IsRequired).toBe(true);
    }
  });

  it('writes no external-system columns — these tables have none', () => {
    // Unlike GLAccount (ExternalAccountID / ExternalSystem), Dimension and DimensionValue are
    // system-agnostic. Mapping to a column that does not exist would fail at upsert.
    for (const objectName of ['dimensions', 'dimensionValues']) {
      for (const fm of fieldMapsOf(objectName)) expect(fm.DestinationFieldName).not.toMatch(/^External/);
    }
  });

  it.each([
    ['dimensions', 'Dimensions'],
    ['dimensionValues', 'Dimension Values'],
  ])('pulls the "%s" object into %s', (objectName, entitySuffix) => {
    const m = mapFor(objectName).fields;
    expect(m.SyncDirection).toBe('Pull');
    expect(m.SyncEnabled).toBe(true);
    expect(m.Status).toBe('Active');
    expect(m.EntityID).toContain(entitySuffix);
  });

  it('rides the SAME Company Integration as the account sync, so the nightly job picks it up', () => {
    for (const m of entityMaps) {
      expect(m.fields.CompanyIntegrationID).toContain('MJ: Company Integrations.Name=');
      expect(m.fields.CompanyIntegrationID).toContain('Business Central GL Account Sync');
    }
  });

  it('uses distinct hardcoded primary keys (metadata convention, stable across environments)', () => {
    const ids = entityMaps.flatMap((m) => [
      m.primaryKey.ID,
      ...m.relatedEntities['MJ: Company Integration Field Maps'].map((f) => (f as unknown as { primaryKey: { ID: string } }).primaryKey.ID),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/);
  });
});

describe('Entity-map ordering (load-bearing for the parent stamp)', () => {
  it('runs dimensions BEFORE dimensionValues', () => {
    // Entity maps execute Priority ASC. The connector resolves a value's parent through the Record
    // Map rows the dimensions pass writes, so if this order ever inverts, every dimension value
    // fails its required DimensionID on a from-zero sync.
    const dims = mapFor('dimensions').fields.Priority;
    const vals = mapFor('dimensionValues').fields.Priority;
    expect(typeof dims).toBe('number');
    expect(typeof vals).toBe('number');
    expect(dims as number).toBeLessThan(vals as number);
  });
});

describe('Sync directory config', () => {
  it('declares the entity-map root entity for this directory', () => {
    // These records attach to an EXISTING Company Integration by lookup, so the directory's root
    // entity is the entity map — not 'MJ: Company Integrations' as in the account-sync directory.
    expect(syncDirConfig.entity).toBe('MJ: Company Integration Entity Maps');
  });
});
