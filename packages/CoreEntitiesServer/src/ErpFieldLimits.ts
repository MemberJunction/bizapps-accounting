/**
 * Field-length limits on what accounting sends to an ERP (bc-aidp-next-golive#280).
 *
 * Business Central rejects a journal line whose account number, document number or dimension code
 * is longer than its field, and it does so when the batch posts, long after the value was typed.
 * The lengths come from the ERP connector's integration metadata through
 * `ExternalFieldLimitEngine`; this module only says which ERP field each value lands in.
 *
 * Checked twice: on save of the record that supplies the value (GL account, dimension, dimension
 * value), so the person typing it sees the limit; and before a batch is sent, so a value saved
 * before this check existed still never reaches the ERP. Over-long values are rejected, never
 * truncated.
 *
 * Only ERPs with a field table here are checked. An ERP added later is unchecked until its table
 * is added, rather than guessed at.
 */
import { IMetadataProvider, IRunViewProvider, UserInfo } from '@memberjunction/core';
import { EscapeSQLString } from '@memberjunction/global';
import { UserCache } from '@memberjunction/generic-database-provider';
import { ExternalFieldLimitEngine, type ExternalFieldTarget } from '@mj-biz-apps/common-entities';
import type { CreateERPJournalInput } from './BaseAccountingERPProvider.js';

const CI_ENTITY = 'MJ: Company Integrations';

/** A value accounting sends to an ERP. */
export type ErpWireField = 'AccountNumber' | 'DocumentNumber' | 'LineDescription' | 'DimensionCode' | 'DimensionValueCode';

interface ErpFieldSpec {
  Object: string;
  Field: string;
  Label: string;
}

/**
 * The integration whose metadata carries Business Central's field lengths: the BC connector's own
 * record. A company may post through an integration row with another name; the lengths are BC's
 * either way, so they are always read from here.
 */
const BUSINESS_CENTRAL_METADATA_INTEGRATION = 'business-central';

/** Where each value lands in Business Central's API v2.0, named as the connector's metadata names it. */
const BUSINESS_CENTRAL_FIELDS: Record<ErpWireField, ErpFieldSpec> = {
  AccountNumber: { Object: 'journalLines', Field: 'accountNumber', Label: 'GL account number' },
  DocumentNumber: { Object: 'journalLines', Field: 'documentNumber', Label: 'Batch number' },
  LineDescription: { Object: 'journalLines', Field: 'description', Label: 'Journal line description' },
  DimensionCode: { Object: 'dimensions', Field: 'code', Label: 'Dimension code' },
  DimensionValueCode: { Object: 'dimensionValues', Field: 'code', Label: 'Dimension value code' },
};

/** True for any spelling of Business Central an integration or target system uses. */
export function IsBusinessCentral(name: string | null | undefined): boolean {
  return (name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').includes('businesscentral');
}

function fieldSpec(integrationName: string, field: ErpWireField): ErpFieldSpec | null {
  return IsBusinessCentral(integrationName) ? BUSINESS_CENTRAL_FIELDS[field] : null;
}

/** True when accounting checks field lengths for this ERP. */
export function HasErpFieldLimits(integrationName: string): boolean {
  return IsBusinessCentral(integrationName);
}

/**
 * The message for `value` sent as `field` to `integrationName`, or null when it fits or the ERP
 * has no field table. The engine must be configured.
 */
export function CheckErpFieldValue(integrationName: string, field: ErpWireField, value: string | null | undefined): string | null {
  const spec = fieldSpec(integrationName, field);
  if (!spec) return null;
  const target: ExternalFieldTarget = { Integration: BUSINESS_CENTRAL_METADATA_INTEGRATION, Object: spec.Object, Field: spec.Field };
  return ExternalFieldLimitEngine.Instance.Check(spec.Label, value, [target]);
}

/** Every over-limit value in a journal about to be sent, one message per distinct problem. */
export function CheckErpJournalInput(integrationName: string, input: CreateERPJournalInput): string[] {
  const problems = new Set<string>();
  const add = (message: string | null): void => {
    if (message) problems.add(message);
  };
  add(CheckErpFieldValue(integrationName, 'DocumentNumber', input.DocNumber));
  for (const line of input.Lines) {
    add(CheckErpFieldValue(integrationName, 'AccountNumber', line.accountNumber));
    add(CheckErpFieldValue(integrationName, 'LineDescription', line.description));
    for (const dimension of line.dimensions ?? []) {
      add(CheckErpFieldValue(integrationName, 'DimensionCode', dimension.code));
      add(CheckErpFieldValue(integrationName, 'DimensionValueCode', dimension.valueCode));
    }
  }
  return [...problems];
}

/**
 * Names of the active ERP integrations accounting checks limits for: those of one company, or of
 * every company when `companyId` is omitted (dimensions are shared by all companies).
 */
export async function LoadLimitedErpIntegrationNames(user: UserInfo, provider: IMetadataProvider, companyId?: string): Promise<string[]> {
  const filter = companyId ? `IsActive = 1 AND CompanyID = '${EscapeSQLString(companyId)}'` : 'IsActive = 1';
  const res = await (provider as unknown as IRunViewProvider).RunView<{ Integration: string }>(
    { EntityName: CI_ENTITY, ExtraFilter: filter, Fields: ['Integration'], ResultType: 'simple' },
    user,
  );
  if (!res.Success) throw new Error(`Could not load company integrations to check ERP field lengths: ${res.ErrorMessage ?? 'unknown error'}`);
  const names = (res.Results ?? []).map((row) => row.Integration).filter((name) => HasErpFieldLimits(name));
  return [...new Set(names)];
}

/**
 * The user the limit engine is configured with: the server's system user, falling back to `user`.
 * Field lengths are catalog data, so whether they can be read must not depend on which user's
 * save is being checked.
 */
export function LimitCheckUser(user: UserInfo): UserInfo {
  return UserCache.Instance.GetSystemUser() ?? user;
}

/**
 * Messages for one value against every limited ERP integration in scope. Configures the limit
 * engine, so it can be called straight from an entity's ValidateAsync.
 */
export async function CheckErpFieldOnSave(
  field: ErpWireField,
  value: string | null | undefined,
  user: UserInfo,
  provider: IMetadataProvider,
  companyId?: string,
): Promise<string[]> {
  const integrations = await LoadLimitedErpIntegrationNames(user, provider, companyId);
  if (integrations.length === 0) return [];
  await ExternalFieldLimitEngine.Instance.Config(false, LimitCheckUser(user), provider);
  return integrations.map((name) => CheckErpFieldValue(name, field, value)).filter((m): m is string => m !== null);
}
