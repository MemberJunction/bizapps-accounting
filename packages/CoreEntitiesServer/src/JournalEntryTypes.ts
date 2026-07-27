/**
 * JournalEntryType lookups — the server-side resolution helpers for the extensible JE
 * classification (issue #24, BA-D29). The type table replaced the closed EntryType CHECK enum:
 * accounting seeds its ledger-mechanics rows (metadata/journal-entry-types/), consuming apps
 * seed their own domain rows, and code resolves CODES to IDs at runtime through these helpers.
 *
 * Deliberately provider-injected, uncached point reads (BypassCache): the table is tiny, the
 * callers are per-operation (JE create, reversal, batch build), and BypassCache keeps them
 * consistent with the surrounding batch queries that read true DB state. The cached path for
 * high-frequency validation is AccountingEngineBase's `_journalEntryTypes` config +
 * `JournalEntryTypeByCode` — use that inside the engine pipeline.
 *
 * CONNECTS TO:
 *   ENGINE:   AccountingEngineBase (cached sibling for pipeline validation)
 *   CALLERS:  JournalEntryEntityServer (reversal typing) · BatchingEngine (summary typing +
 *             member exclusion) · BatchDispatchResolver · AssociationDemoSeedData
 *   DB:       __mj_BizAppsAccounting.JournalEntryType (UQ Code; filtered-unique IsBatchSummary)
 */
import { IMetadataProvider, IRunViewProvider, RunView, UserInfo } from '@memberjunction/core';

const JET_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Types';

/** The lookup projection callers need (mirror of the pipeline's EntryTypeLookup). */
export interface JournalEntryTypeRow {
  ID: string;
  Code: string;
  Name: string;
  IsSystem: boolean;
  IsBatchSummary: boolean;
  IsActive: boolean;
}

const FIELDS = ['ID', 'Code', 'Name', 'IsSystem', 'IsBatchSummary', 'IsActive'];

/** Resolve a JournalEntryType by Code. Null when no row exists. */
export async function LookupJournalEntryTypeByCode(
  code: string,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<JournalEntryTypeRow | null> {
  const safe = (code ?? '').replace(/'/g, "''");
  return lookupOne(`Code='${safe}'`, contextUser, provider);
}

/** Resolve a JournalEntryType by ID. Null when no row exists. */
export async function LookupJournalEntryTypeByID(
  id: string,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<JournalEntryTypeRow | null> {
  const safe = (id ?? '').replace(/'/g, "''");
  return lookupOne(`ID='${safe}'`, contextUser, provider);
}

/** Resolve a Code to its ID, throwing when the row is missing (write paths want a hard failure). */
export async function RequireJournalEntryTypeID(
  code: string,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<string> {
  const row = await LookupJournalEntryTypeByCode(code, contextUser, provider);
  if (!row) {
    throw new Error(`JournalEntryType '${code}' does not exist — its owning app must seed it (issue #24).`);
  }
  return row.ID;
}

/**
 * The single IsBatchSummary=1 type (filtered unique index allows at most one). Throws when the
 * flag row is missing — a missing discriminator must fail loudly, never fall back (the failure
 * mode is a summary JE that still balances, so there is no downstream signal).
 */
export async function GetBatchSummaryEntryType(
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<JournalEntryTypeRow> {
  const row = await lookupOne('IsBatchSummary=1', contextUser, provider);
  if (!row) {
    throw new Error("No JournalEntryType is flagged IsBatchSummary — seed metadata/journal-entry-types (the 'BatchSummary' system row) before batching.");
  }
  return row;
}

async function lookupOne(
  extraFilter: string,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<JournalEntryTypeRow | null> {
  const rv = new RunView(provider as unknown as IRunViewProvider);
  const res = await rv.RunView<JournalEntryTypeRow>(
    { EntityName: JET_ENTITY, ExtraFilter: extraFilter, Fields: FIELDS, ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  if (!res.Success) {
    throw new Error(`JournalEntryType lookup failed (${extraFilter}): ${res.ErrorMessage}`);
  }
  return res.Results?.[0] ?? null;
}
