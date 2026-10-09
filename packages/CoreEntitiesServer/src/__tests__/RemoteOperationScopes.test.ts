import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BaseRemotableOperation } from '@memberjunction/core';
import { describe, expect, it } from 'vitest';
import * as server from '../index.js';

/**
 * MJAPI checks an API key's scopes only when the registered operation class carries a
 * `RequiredScope`, and refuses a scope that has no `MJ: API Scopes` row (#310). This pins:
 * every Accounting operation class carries an `accounting:` scope; a class with a metadata row
 * carries the scope that row declares; and every scope a class carries ships in metadata/api-scopes
 * with an MJAPI ceiling row in metadata/api-application-scopes.
 */

const METADATA_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'metadata');

interface MetadataRecord {
    fields: Record<string, string | number | boolean | undefined>;
    relatedEntities?: Record<string, MetadataRecord[]>;
}

function readRecords(folder: string): MetadataRecord[] {
    const dir = join(METADATA_DIR, folder);
    return readdirSync(dir)
        .filter((f) => f.endsWith('.json') && f !== '.mj-sync.json')
        .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as MetadataRecord[]);
}

function flatten(records: MetadataRecord[]): MetadataRecord[] {
    return records.flatMap((r) => [r, ...Object.values(r.relatedEntities ?? {}).flatMap(flatten)]);
}

function declaredScopes(): Map<string, string> {
    const scopes = new Map<string, string>();
    for (const r of readRecords('remote-operations')) {
        scopes.set(String(r.fields.OperationKey), String(r.fields.RequiredScope ?? ''));
    }
    return scopes;
}

function serverScopes(): Map<string, string | undefined> {
    const scopes = new Map<string, string | undefined>();
    for (const value of Object.values(server)) {
        if (typeof value !== 'function' || !(value.prototype instanceof BaseRemotableOperation)) continue;
        const op = new (value as new () => BaseRemotableOperation)();
        if (op.OperationKey?.startsWith('Accounting.')) scopes.set(op.OperationKey, op.RequiredScope);
    }
    return scopes;
}

/**
 * The operations that send to the ERP or record what the ERP accepted. They need accounting:post, which a
 * key holding accounting:write does not have, so a key that only books entries cannot dispatch (#329).
 */
const ERP_OPERATIONS = [
    'Accounting.DispatchJournalEntryBatch',
    'Accounting.ResumeJournalEntryBatchPosting',
    'Accounting.RunERPSync',
];

const shippedScopes =new Set(flatten(readRecords('api-scopes')).map((r) => String(r.fields.FullPath)));

const mjapiScopes = new Set(
    readRecords('api-application-scopes')
        .filter((r) => r.fields.ApplicationID === '@lookup:MJ: API Applications.Name=MJAPI' && r.fields.IsDeny === false)
        .map((r) => String(r.fields.ScopeID).replace('@lookup:MJ: API Scopes.FullPath=', '')),
);

describe('Accounting remote operation scopes (#310)', () => {
    const declared = declaredScopes();
    const actual = serverScopes();

    it('finds operations in metadata and in the server package', () => {
        expect(declared.size).toBeGreaterThan(0);
        expect(actual.size).toBeGreaterThan(declared.size);
    });

    it.each([...declared.keys()])('%s carries the scope its metadata row declares', (key) => {
        expect(actual.get(key)).toBe(declared.get(key));
    });

    it.each([...actual.keys()])('%s carries an accounting scope that ships with an MJAPI ceiling', (key) => {
        const scope = actual.get(key);
        expect(scope).toMatch(/^accounting:(read|write|post)$/);
        expect(shippedScopes.has(scope!)).toBe(true);
        expect(mjapiScopes.has(scope!)).toBe(true);
    });

    it('requires accounting:post on exactly the operations that act on the ERP (#329)', () => {
        const post = [...actual.entries()].filter(([, scope]) => scope === 'accounting:post').map(([key]) => key).sort();
        expect(post).toEqual(ERP_OPERATIONS);
    });

    it('ships the accounting parent scope', () => {
        expect(shippedScopes.has('accounting')).toBe(true);
    });
});
