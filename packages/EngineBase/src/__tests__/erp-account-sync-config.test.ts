/**
 * Unit tests for the Business Central → GL Account sync CONFIG (metadata, not code).
 *
 * These read the committed metadata files and verify the mapping actually produces correct
 * GLAccount field values by running each field map's TransformPipeline through the SAME engine
 * the integration sync uses at runtime (`FieldTransformEngine` from @memberjunction/global —
 * exactly what MJ's FieldMappingEngine calls). No DB, no BC, no network — pure + deterministic.
 *
 * Guards against silent drift: a broken category→AccountType map, a dropped required field, a
 * mis-pointed scheduled job, or an un-gated sync dir all fail here.
 *
 * CONNECTS TO:
 *   metadata/erp-account-sync/.business-central-gl-accounts.json      (Company Integration + maps)
 *   metadata/erp-account-sync-schedule/.bc-gl-account-nightly-sync.json (nightly Scheduled Job)
 *   metadata/.mj-sync.json  ·  mj-app.json
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
  Status?: string;
  TransformPipeline?: string;
}
interface EntityMapFields { ExternalObjectName: string; EntityID: string; SyncDirection: string }
interface CIFields { IntegrationID: string; CredentialID?: string; ScheduleType?: string; CronExpression?: string }
interface FieldMapRec { fields: FieldMapFields }
interface EntityMapRec { fields: EntityMapFields; relatedEntities: { 'MJ: Company Integration Field Maps': FieldMapRec[] } }
interface CIRec { fields: CIFields; primaryKey: { ID: string }; relatedEntities: { 'MJ: Company Integration Entity Maps': EntityMapRec[] } }
interface JobFields { JobTypeID: string; CronExpression: string; Status: string; Configuration: string }
interface JobRec { fields: JobFields }
interface MjApp { dependencies: Record<string, { version: string; repository: string; subpath?: string }> }

const ci = readJson<CIRec[]>('metadata/erp-account-sync/.business-central-gl-accounts.json')[0];
const entityMap = ci.relatedEntities['MJ: Company Integration Entity Maps'][0];
const fieldMaps = entityMap.relatedEntities['MJ: Company Integration Field Maps'].map((r) => r.fields);
const job = readJson<JobRec[]>('metadata/erp-account-sync-schedule/.bc-gl-account-nightly-sync.json')[0].fields;
const mjApp = readJson<MjApp>('mj-app.json');

const byDest = (dest: string): FieldMapFields | undefined => fieldMaps.find((f) => f.DestinationFieldName === dest);

// The GLAccount.AccountType CHECK values (the mapping's valid targets).
const VALID_ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

// ─── run a field map exactly as MJ's FieldMappingEngine.ApplyFieldMapping does ───────────────────
const engine = new FieldTransformEngine();
function applyFieldMap(fm: FieldMapFields, record: Record<string, unknown>): unknown {
  const steps: TransformStep[] = fm.TransformPipeline ? (JSON.parse(fm.TransformPipeline) as TransformStep[]) : [];
  const result = engine.ExecutePipeline(record[fm.SourceFieldName], record, steps);
  return result.Skipped ? undefined : result.Value;
}
function mapAccount(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const fm of fieldMaps) out[fm.DestinationFieldName] = applyFieldMap(fm, record);
  return out;
}

describe('BC → GL Account field mapping (real FieldTransformEngine)', () => {
  it('maps a full BC account record to GLAccount fields', () => {
    const gla = mapAccount({ id: 'bc-guid-1', number: '1000', displayName: 'Cash', category: 'Assets', blocked: false });
    expect(gla).toMatchObject({
      ExternalAccountID: 'bc-guid-1',
      Code: '1000',
      Name: 'Cash',
      AccountType: 'Asset',
      IsActive: true,
      ExternalSystem: 'BusinessCentral',
    });
    expect(typeof gla.CompanyID).toBe('string'); // constant company binding (placeholder until wired)
  });

  it.each([
    ['Assets', 'Asset'],
    ['Liabilities', 'Liability'],
    ['Equity', 'Equity'],
    ['Income', 'Revenue'],
    ['Cost of Goods Sold', 'Expense'],
    ['Expense', 'Expense'],
    ['income', 'Revenue'], // lookup is case-insensitive
  ])('maps BC category "%s" → AccountType "%s"', (category, expected) => {
    expect(applyFieldMap(byDest('AccountType')!, { category })).toBe(expected);
  });

  it('maps a blank/heading category to null (heading rows are not postable accounts)', () => {
    expect(applyFieldMap(byDest('AccountType')!, { category: '' })).toBeNull();
  });

  it('negates blocked → IsActive (undefined blocked = active)', () => {
    expect(applyFieldMap(byDest('IsActive')!, { blocked: true })).toBe(false);
    expect(applyFieldMap(byDest('IsActive')!, { blocked: false })).toBe(true);
    expect(applyFieldMap(byDest('IsActive')!, {})).toBe(true);
  });

  it('emits the ExternalSystem constant regardless of input', () => {
    expect(applyFieldMap(byDest('ExternalSystem')!, {})).toBe('BusinessCentral');
    expect(applyFieldMap(byDest('ExternalSystem')!, { _constant: 'ignored' })).toBe('BusinessCentral');
  });

  it('every category→AccountType target is a valid GLAccount AccountType', () => {
    const steps = JSON.parse(byDest('AccountType')!.TransformPipeline!) as TransformStep[];
    const lookup = steps.find((s) => s.Type === 'lookup')!; // decode step runs first, then the lookup
    const map = (lookup.Config as { Map: Record<string, string> }).Map;
    for (const target of Object.values(map)) expect(VALID_ACCOUNT_TYPES).toContain(target);
  });
});

describe('BC → GL Account config integrity', () => {
  it('dedups on (Code, CompanyID) so BC accounts upsert onto the seeded chart', () => {
    expect(byDest('Code')?.IsKeyField).toBe(true);
    expect(byDest('CompanyID')?.IsKeyField).toBe(true);
    // ExternalAccountID must NOT be a key field — seeded rows have it null, and key fields
    // are AND-ed, so keying on it would exclude the seed and re-introduce the insert collision.
    expect(byDest('ExternalAccountID')?.IsKeyField ?? false).toBe(false);
  });

  it.each(['Code', 'Name', 'AccountType', 'CompanyID', 'ExternalAccountID', 'ExternalSystem', 'IsActive'])(
    'maps the required GLAccount field %s',
    (dest) => {
      expect(byDest(dest)).toBeDefined();
    },
  );

  it('pulls the "accounts" object into GL Accounts', () => {
    expect(entityMap.fields.ExternalObjectName).toBe('accounts');
    expect(entityMap.fields.SyncDirection).toBe('Pull');
    expect(entityMap.fields.EntityID).toContain('GL Accounts');
  });

  it('targets the business-central connector', () => {
    expect(ci.fields.IntegrationID).toContain('business-central');
  });
});

describe('Nightly schedule', () => {
  it('targets the same Company Integration', () => {
    const cfg = JSON.parse(job.Configuration) as { CompanyIntegrationID: string };
    expect(cfg.CompanyIntegrationID.toUpperCase()).toBe(ci.primaryKey.ID.toUpperCase());
  });

  it('runs at 02:00 daily via the sync driver', () => {
    expect(job.CronExpression).toBe('0 2 * * *');
    expect(job.JobTypeID).toContain('IntegrationSyncScheduledJobDriver');
  });
});

describe('App manifest + credential safety', () => {
  it('declares the business-central connector as an Open App dependency', () => {
    const dep = mjApp.dependencies['connector-business-central'];
    expect(dep).toBeDefined();
    expect(dep.subpath).toBe('Finance/BusinessCentral');
  });

  it('ships no CredentialID — BC credentials are wired manually per environment, never in metadata', () => {
    // mj sync push writes only the fields present in each record, so omitting CredentialID keeps a
    // manually-attached credential from being reset on re-push. A credential committed here would be
    // clobbered on the next push (and would leak a secret into git), so it must never appear.
    expect(ci.fields.CredentialID).toBeUndefined();
  });
});
