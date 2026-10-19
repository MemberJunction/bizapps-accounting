import { BaseEntity, EntityInfo, Metadata } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import '@mj-biz-apps/accounting-entities';

/**
 * Entity stubs shared by this package's tier-1 specs, so a spec can build REAL entities through the
 * class factory with no database.
 *
 * `EntityInfo` is built through its own constructor, which turns plain field data into
 * `EntityFieldInfo`s the same way provider metadata does, so no field shape is hand-asserted.
 */

/** A string-typed field, the only kind these specs need. ID and *ID are uniqueidentifiers. */
function fieldData(name: string): Record<string, unknown> {
  return {
    Name: name,
    CodeName: name,
    Type: name === 'ID' || name.endsWith('ID') ? 'uniqueidentifier' : 'nvarchar',
    TSType: 'string',
    IsPrimaryKey: name === 'ID',
    AutoIncrement: false,
    // `ReadOnly` is derived from this (and IsPrimaryKey); without it a field locks after one write.
    AllowUpdateAPI: true,
    AllowsNull: true,
    Status: 'Active',
  };
}

export function stubEntityInfo(name: string, fieldNames: string[]): EntityInfo {
  return new EntityInfo({
    ID: `id-${name}`,
    Name: name,
    Status: 'Active',
    AllowDirectSQL: true,
    EntityFields: fieldNames.map(fieldData),
  });
}

let registered: EntityInfo[] = [];

/**
 * An entity through the CLASS FACTORY, exactly as a real provider's `GetEntityObject` does — the
 * mechanism `RelatedRecordCollection.Create()` reaches for, so a registered subclass wins over the
 * generated base here just as it does in production.
 */
export async function entityObject<T extends BaseEntity>(entityName: string): Promise<T> {
  const info = registered.find((e) => e.Name.toLowerCase() === entityName.toLowerCase());
  if (!info) throw new Error(`No EntityInfo registered in this test for '${entityName}'.`);
  const entity = MJGlobal.Instance.ClassFactory.CreateInstance<T>(BaseEntity, entityName, info);
  if (!entity) throw new Error(`The class factory returned nothing for '${entityName}'.`);
  return entity;
}

/**
 * Installs a provider that knows only `entities`, on both globals: `Metadata.Provider`, and
 * `BaseEntity.Provider`, which is the one `BaseEntity.ProviderToUse` (and so a collection) reads.
 */
export function installStubProvider(entities: EntityInfo[]): void {
  registered = entities;
  const provider = {
    Entities: entities,
    FindEntityByName: (name: string) => entities.find((e) => e.Name.toLowerCase() === name.toLowerCase()),
    // What `Lines.Create()` and `Dimensions.Create()` call. Without it a collection cannot issue a
    // child at all, which is the point: production has no other way to make one either.
    GetEntityObject: (name: string) => entityObject(name),
    Config: { ActiveStatusAssertions: false },
    BeginTransaction: async () => undefined,
    CommitTransaction: async () => undefined,
    RollbackTransaction: async () => undefined,
  } as never; // implements only what these specs reach; IMetadataProvider has ~300 lines of members
  Metadata.Provider = provider;
  BaseEntity.Provider = provider;
}
