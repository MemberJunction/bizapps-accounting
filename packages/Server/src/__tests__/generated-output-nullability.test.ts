/**
 * @fileoverview bc-aidp-next-golive#295 — a GraphQL output field may promise a value only when the
 * column can never be NULL.
 *
 * ── THE BUG THIS PINS ──
 *
 * `generated.ts` declared the MJ geo virtual fields non-null on three output types:
 *
 *     @Field(() => Float)
 *     _mj__Latitude: number;
 *
 * On a host, `__mj_Latitude` / `__mj_Longitude` come from a LEFT JOIN to the geocode cache, so they are
 * NULL for every record that has not been geocoded (every Accounting Company Profile on AIDP). GraphQL
 * answers a NULL on a non-null field with "Cannot return null for non-nullable field", so every
 * single-record load failed, and every save committed and then reported failure, because the mutation
 * returns the record through the same type.
 *
 * ── THE ROOT CAUSE IS THE GENERATOR, NOT THIS REPO ──
 *
 * MJ 6.1.x's `isNonNullableServerField` (6.1.4, and the 6.1.0-edge.7 CodeGen this repo pins) returns
 * `IsUnrestrictableField` and ignores `AllowsNull`, so any unrestrictable field (primary keys and `__mj_`
 * columns) comes out non-null even when it allows NULL. MJ `next` fixed it (#4635:
 * `!AllowsNull && IsUnrestrictableField`); `lts/6.1` does not have the fix yet. The fix here is a hand
 * edit that matches the fixed generator's output, so a CodeGen run on an unfixed generator puts the `!`
 * straight back, and this test is what notices.
 *
 * ── WHY THE GENERATED ENTITY CLASS IS THE ORACLE ──
 *
 * `entity_subclasses.ts` is generated from the same entity metadata, and its getters carry `| null`
 * exactly when the field's `AllowsNull` is true. So "non-null in GraphQL, `| null` on the entity" is the
 * precise signature of the generator bug, for these fields and for any field a future run adds.
 *
 * INPUT types are deliberately not checked: they carry the WRITE contract, which the database
 * constraint still governs, and MJ's fix leaves them alone.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const GENERATED_SERVER = join(__dirname, '..', 'generated', 'generated.ts');
const GENERATED_ENTITIES = join(__dirname, '../../../Entities/src/generated/entity_subclasses.ts');

/** The output types #295 was reported against: each carries both geo virtual fields. */
const GEO_TYPES = [
    'mjBizAppsAccountingAccountingCompanyProfile_',
    'mjBizAppsAccountingTaxAuthority_',
    'mjBizAppsAccountingTaxJurisdiction_',
] as const;

const GEO_FIELDS = ['_mj__Latitude', '_mj__Longitude'] as const;

interface OutputField {
    TypeName: string;
    Name: string;
    /** The decorator's options object opens with `nullable: true`, the generator's nullable form. */
    DecoratorNullable: boolean;
    /** The property is declared optional (`name?: T`), which the generator pairs with `nullable: true`. */
    PropertyOptional: boolean;
    Decorator: string;
}

/** A generator-emitted `@Field(` decorator whose options object opens with `nullable: true`. */
const NULLABLE_DECORATOR = /^@Field\((?:\(\) => [^,{]+, )?\{nullable: true\b/;
/** A generated property declaration: four-space indent, name, optional `?`, type. */
const PROPERTY_LINE = /^ {4}(\w+)(\?)?: [^;]+;\s*$/;

const serverSource = readFileSync(GENERATED_SERVER, 'utf8');
const entitySource = readFileSync(GENERATED_ENTITIES, 'utf8');

/** The source of `export class <name> { ... }`, up to its closing brace at column 0. */
function classBody(source: string, className: string): string | undefined {
    const start = source.indexOf(`export class ${className} `);
    if (start < 0) return undefined;
    const end = source.indexOf('\n}\n', start);
    return source.slice(start, end < 0 ? source.length : end);
}

/** Every entity output type: the `@ObjectType` classes named `<entity>_` (view results and inputs are not). */
function entityOutputTypeNames(): string[] {
    const names: string[] = [];
    for (const m of serverSource.matchAll(/^export class (\w+_) \{/gm)) {
        const decorator = serverSource.lastIndexOf('\n@', m.index);
        if (serverSource.startsWith('\n@ObjectType(', decorator)) names.push(m[1]);
    }
    return names;
}

/** Pairs each `@Field(` decorator with the property declaration it decorates. */
function outputFieldsOf(typeName: string): OutputField[] {
    const body = classBody(serverSource, typeName);
    expect(body, `output type ${typeName} must exist in generated.ts`).toBeDefined();
    const lines = (body as string).split('\n');
    const fields: OutputField[] = [];
    lines.forEach((line, i) => {
        const decorator = line.trim();
        if (!decorator.startsWith('@Field(')) return;
        const property = lines.slice(i + 1).map((l) => l.match(PROPERTY_LINE)).find((m) => m !== null);
        expect(property, `${typeName}: the class's @Field on line ${i + 1} decorates no property`).toBeTruthy();
        const [, name, optional] = property as RegExpMatchArray;
        fields.push({
            TypeName: typeName,
            Name: name,
            DecoratorNullable: NULLABLE_DECORATOR.test(decorator),
            PropertyOptional: optional === '?',
            Decorator: decorator,
        });
    });
    return fields;
}

/** GraphQL cannot start a name with `__`, so the generator emits `__mj_X` as `_mj__X`. */
function entityFieldName(graphQLName: string): string {
    return graphQLName.startsWith('_mj__') ? `__mj_${graphQLName.slice('_mj__'.length)}` : graphQLName;
}

/** Whether the generated entity class types the field `| null`, i.e. its metadata says AllowsNull. */
function entityFieldAllowsNull(typeName: string, graphQLName: string): boolean | undefined {
    const entityClass = `${typeName.slice(0, -1)}Entity`;
    const body = classBody(entitySource, entityClass);
    if (body === undefined) return undefined;
    const getter = body.match(new RegExp(`get ${entityFieldName(graphQLName)}\\(\\):\\s*([^{]+)\\{`));
    if (getter === null) return undefined;
    return /\|\s*null\b/.test(getter[1]);
}

/** `ReadableFields___` is the field-level-security envelope, not an entity column. */
const isEntityColumn = (field: OutputField): boolean => field.Name !== 'ReadableFields___';

describe('#295 — the geo virtual fields are nullable on every output type that carries them', () => {
    for (const typeName of GEO_TYPES) {
        for (const fieldName of GEO_FIELDS) {
            it(`${typeName}.${fieldName} is declared nullable`, () => {
                const field = outputFieldsOf(typeName).find((f) => f.Name === fieldName);
                expect(field, `${typeName} must still expose ${fieldName}`).toBeDefined();
                const { Decorator, DecoratorNullable, PropertyOptional } = field as OutputField;
                expect(Decorator).toBe('@Field(() => Float, {nullable: true})');
                expect(DecoratorNullable, 'an ungeocoded record has no coordinates').toBe(true);
                expect(PropertyOptional, 'the generator pairs nullable: true with name?:').toBe(true);
            });
        }
    }

    it('the entity metadata agrees: the geo fields allow NULL', () => {
        for (const typeName of GEO_TYPES) {
            for (const fieldName of GEO_FIELDS) {
                expect(entityFieldAllowsNull(typeName, fieldName), `${typeName}.${fieldName}`).toBe(true);
            }
        }
    });
});

describe('#295 — no output field promises a value its column may not hold', () => {
    const outputTypes = (): string[] => entityOutputTypeNames();
    const allFields = (): OutputField[] => outputTypes().flatMap((t) => outputFieldsOf(t)).filter(isEntityColumn);

    it('finds every entity output type and pairs each @Field with its own property (guards the parser)', () => {
        const types = outputTypes();
        expect(types.length).toBeGreaterThanOrEqual(20);
        expect(types).toEqual(expect.arrayContaining([...GEO_TYPES]));
        for (const typeName of types) {
            const names = outputFieldsOf(typeName).map((f) => f.Name);
            expect(new Set(names).size, `${typeName}: two @Field decorators resolved to one property`).toBe(names.length);
        }
    });

    it('declares nullable: true and name?: together', () => {
        const disagreeing = allFields().filter((f) => f.DecoratorNullable !== f.PropertyOptional);
        expect(disagreeing.map((f) => `${f.TypeName}.${f.Name}`)).toEqual([]);
    });

    it('maps every output field to a field on the generated entity class', () => {
        const unmapped = allFields().filter((f) => entityFieldAllowsNull(f.TypeName, f.Name) === undefined);
        expect(unmapped.map((f) => `${f.TypeName}.${f.Name}`)).toEqual([]);
    });

    it('declares non-null only fields whose metadata says NOT NULL', () => {
        const overPromised = allFields()
            .filter((f) => !f.DecoratorNullable)
            .filter((f) => entityFieldAllowsNull(f.TypeName, f.Name) === true)
            .map((f) => `${f.TypeName}.${f.Name}`);
        expect(
            overPromised,
            'a non-null GraphQL field whose column allows NULL fails every load of a row where it is NULL. '
            + 'MJ 6.1.x CodeGen emits exactly this (isNonNullableServerField ignores AllowsNull): mark the '
            + 'field {nullable: true} and name?:, as the fixed generator (MJ #4635) does.',
        ).toEqual([]);
    });
});
