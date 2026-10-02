/**
 * An in-memory stand-in for the RunView reads the batch engine's candidate selection makes, so a
 * test can assert WHICH journal entries a filter admits rather than how the filter string reads.
 *
 * It evaluates the small SQL subset the engine emits (`=`, `<>`, `>=`, `<`, `<=`, `IN`, `NOT IN`,
 * `AND`, `OR`, `NOT`, parentheses) over plain rows whose dates are 'YYYY-MM-DD' strings, which
 * compare correctly as text. A filter using SQL outside that subset fails loudly.
 */
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';

export const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
export const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
export const JET_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Types';
export const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

export const SUMMARY_TYPE_ID = 'e9521aa3-f4ef-4ec5-a899-d9dd59f320b7';
export const MANUAL_TYPE_ID = '684c06d4-55da-49d7-8453-e046fc82b895';

export interface JournalRow {
  ID: string;
  EntryNumber: string;
  CompanyID: string;
  EffectiveDate: string;
  Status: string;
  EntryTypeID: string;
  Description: string | null;
}

export interface ProfileRow {
  ID: string;
  PostingStartDate: Date | null;
}

interface ViewParams {
  EntityName?: string;
  ViewID?: string;
  ExtraFilter?: string;
  ResultType?: string;
}

interface ViewResult {
  Success: boolean;
  Results: object[];
  TotalRowCount: number;
  ErrorMessage?: string;
}

/** A journal row with sensible defaults; override what the case is about. */
export function journal(id: string, companyId: string, effectiveDate: string, overrides: Partial<JournalRow> = {}): JournalRow {
  return { ID: id, EntryNumber: `JE-${id}`, CompanyID: companyId, EffectiveDate: effectiveDate, Status: 'Pending', EntryTypeID: MANUAL_TYPE_ID, Description: null, ...overrides };
}

/** A profile with a PostingStartDate as the provider returns a DATE column: UTC midnight. */
export function profile(companyId: string, postingStartDate: string | null): ProfileRow {
  return { ID: companyId, PostingStartDate: postingStartDate ? new Date(`${postingStartDate}T00:00:00.000Z`) : null };
}

/** Compile the engine's ExtraFilter subset to a row predicate. */
export function compileFilter(filter: string): (row: object) => boolean {
  const js = filter
    .replace(/\b(\w+) NOT IN \(([^)]*)\)/g, '!([$2].includes(r.$1))')
    .replace(/\b(\w+) IN \(([^)]*)\)/g, '[$2].includes(r.$1)')
    .replace(/\b(\w+)\s*(<>|>=|<=|<|>|=)\s*'/g, (_m, col: string, op: string) => `r.${col} ${op === '=' ? '===' : op === '<>' ? '!==' : op} '`)
    .replace(/\bAND\b/g, '&&')
    .replace(/\bOR\b/g, '||')
    .replace(/\bNOT\b/g, '!');
  if (/\b(IS|LIKE|BETWEEN|EXISTS|SELECT)\b/.test(filter)) throw new Error(`in-memory provider: unsupported filter: ${filter}`);
  return new Function('r', `return (${js});`) as (row: object) => boolean;
}

/**
 * A provider over these rows. Every RunView call is recorded in `calls` so a test can also see
 * which ids a later read (e.g. the build's line load) was asked for.
 */
export function inMemoryProvider(data: { journals: JournalRow[]; profiles: ProfileRow[]; viewRows?: object[] }) {
  const calls: ViewParams[] = [];
  const run = async (params: ViewParams): Promise<ViewResult> => {
    calls.push(params);
    const rows = resolve(params, data);
    return { Success: true, Results: params.ResultType === 'count_only' ? [] : rows, TotalRowCount: rows.length };
  };
  const provider = { RunView: run, RunViews: async (all: ViewParams[]) => Promise.all(all.map(run)) } as unknown as IMetadataProvider;
  return { provider, calls };
}

function resolve(params: ViewParams, data: { journals: JournalRow[]; profiles: ProfileRow[]; viewRows?: object[] }): object[] {
  if (params.ViewID) return data.viewRows ?? [];
  if (params.EntityName === JET_ENTITY) {
    return params.ExtraFilter === 'IsJournalEntryBatchSummary=1'
      ? [{ ID: SUMMARY_TYPE_ID, Code: 'JournalEntryBatchSummary', IsJournalEntryBatchSummary: true }]
      : [{ ID: SUMMARY_TYPE_ID, Code: 'JournalEntryBatchSummary' }, { ID: MANUAL_TYPE_ID, Code: 'Manual' }];
  }
  if (params.EntityName === ACP_ENTITY) {
    if (params.ExtraFilter !== 'PostingStartDate IS NOT NULL') throw new Error(`in-memory provider: unexpected profile filter ${params.ExtraFilter}`);
    return data.profiles.filter(p => p.PostingStartDate !== null);
  }
  if (params.EntityName === JE_ENTITY) {
    return params.ExtraFilter ? data.journals.filter(compileFilter(params.ExtraFilter)) : data.journals;
  }
  return [];
}

export const testUser = { ID: 'USER-1' } as unknown as UserInfo;
