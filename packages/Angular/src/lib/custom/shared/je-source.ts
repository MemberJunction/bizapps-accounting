import { RunView, type EntityInfo, type IMetadataProvider, type RunViewParams } from '@memberjunction/core';
import { EscapeSQLString } from '@memberjunction/global';

/**
 * The source record of a journal entry, as a batch list shows it (bc-aidp-next-golive#452).
 *
 * Each entry carries its D25 origin pair: `LinkedEntity` (the entity's name, from the JE view) and
 * `LinkedRecordID`. Accounting does not know which app wrote the entry, so the record is labelled
 * generically: by the linked entity's own name field when it has one, otherwise by the entity's
 * display name. Names load in ONE RunViews call, one query per linked entity — never per row.
 */

/** The origin pair a journal entry row carries. */
export interface JournalEntrySourceRow {
  ID: string;
  LinkedEntity?: string | null;
  LinkedRecordID?: string | null;
}

/** What a Source cell shows and opens. */
export interface JournalEntrySource {
  EntityName: string;
  RecordID: string;
  /** The record's name when its entity has a name field and the record was found. */
  RecordName: string | null;
  /** The entity's display name (e.g. "Payment Lines"), the fallback label. */
  EntityLabel: string;
}

/** The link text: the record's name, else the entity it lives in. */
export function SourceLabel(source: JournalEntrySource): string {
  return source.RecordName || source.EntityLabel;
}

/** One name query for an entity, or null when it has no single-column key and separate name field. */
function nameQuery(info: EntityInfo | undefined, recordIds: string[]): RunViewParams | null {
  const nameField = info?.NameField;
  const keys = info?.PrimaryKeys ?? [];
  if (!info || !nameField || keys.length !== 1 || nameField.Name === keys[0].Name) return null;
  const pk = keys[0].Name;
  return {
    EntityName: info.Name,
    ExtraFilter: `${pk} IN (${recordIds.map((id) => `'${EscapeSQLString(id)}'`).join(',')})`,
    Fields: [pk, nameField.Name],
    ResultType: 'simple',
  };
}

/** Linked record ids grouped by linked entity name, skipping manual entries (no origin pair). */
function groupByEntity(rows: readonly JournalEntrySourceRow[]): Map<string, string[]> {
  const byEntity = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.LinkedEntity || !r.LinkedRecordID) continue;
    const ids = byEntity.get(r.LinkedEntity) ?? [];
    if (!ids.includes(r.LinkedRecordID)) ids.push(r.LinkedRecordID);
    byEntity.set(r.LinkedEntity, ids);
  }
  return byEntity;
}

/** Record names per entity (lower-cased id → name), from one batched round trip. */
async function loadNames(provider: IMetadataProvider, byEntity: Map<string, string[]>): Promise<Map<string, Map<string, string>>> {
  const queries: Array<{ Entity: string; Params: RunViewParams; Key: string; NameField: string }> = [];
  for (const [entity, ids] of byEntity) {
    const info = provider.EntityByName(entity);
    const params = nameQuery(info, ids);
    if (params && info?.NameField) queries.push({ Entity: entity, Params: params, Key: info.PrimaryKeys[0].Name, NameField: info.NameField.Name });
  }
  const names = new Map<string, Map<string, string>>();
  if (queries.length === 0) return names;
  const results = await RunView.FromMetadataProvider(provider).RunViews(queries.map((q) => q.Params), provider.CurrentUser);
  queries.forEach((q, i) => {
    const res = results[i];
    if (!res?.Success) return; // a missing name falls back to the entity label; the link still works
    const rows = (res.Results ?? []) as Array<Record<string, string | null>>;
    names.set(q.Entity, new Map(rows.map((row) => [String(row[q.Key]).toLowerCase(), row[q.NameField] ?? ''])));
  });
  return names;
}

/** Source per journal entry ID, for every row that has an origin pair. Manual entries are absent. */
export async function LoadJournalEntrySources(
  provider: IMetadataProvider,
  rows: readonly JournalEntrySourceRow[],
): Promise<Map<string, JournalEntrySource>> {
  const names = await loadNames(provider, groupByEntity(rows));
  const sources = new Map<string, JournalEntrySource>();
  for (const r of rows) {
    if (!r.LinkedEntity || !r.LinkedRecordID) continue;
    sources.set(r.ID, {
      EntityName: r.LinkedEntity,
      RecordID: r.LinkedRecordID,
      RecordName: names.get(r.LinkedEntity)?.get(r.LinkedRecordID.toLowerCase()) || null,
      EntityLabel: provider.EntityByName(r.LinkedEntity)?.DisplayNameOrName ?? r.LinkedEntity,
    });
  }
  return sources;
}
