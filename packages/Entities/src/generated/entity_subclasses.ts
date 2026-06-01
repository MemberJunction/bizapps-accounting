/**
 * Stub — placeholder until `npm run mj:codegen` regenerates this file
 * against the database. Once CodeGen runs, this file is fully overwritten
 * with the Zod schemas and BaseEntity subclasses for every Accounting entity.
 *
 * Do not hand-edit. The classes here are minimal placeholders so that the
 * server-side EntityServer subclasses in packages/CoreEntitiesServer/ can
 * extend them BY NAME — CodeGen will produce classes with the same names
 * (richer: full Zod schemas, typed property accessors) when run against the
 * v0.1.0 baseline schema. Until then, field access on these classes goes
 * through `Get('FieldName') / Set('FieldName', value)` from BaseEntity.
 */
import { BaseEntity } from '@memberjunction/core';

export const loadModule = (): void => {
  // no-op; ensures the module is a valid TS module and gets bundled
};

// ─── Placeholder entity classes ────────────────────────────────────────────
// Names follow the CodeGen convention `mj<SchemaPrefix><SingularTableName>Entity`.
// CodeGen will overwrite this file but produce classes with these same names.

export class mjBizAppsAccountingAccountingCompanyProfileEntity extends BaseEntity {}
export class mjBizAppsAccountingGLAccountEntity extends BaseEntity {}
export class mjBizAppsAccountingAccountingPeriodEntity extends BaseEntity {}
export class mjBizAppsAccountingJournalEntryEntity extends BaseEntity {}
export class mjBizAppsAccountingJournalEntryLineEntity extends BaseEntity {}
export class mjBizAppsAccountingJournalEntryBatchEntity extends BaseEntity {}
export class mjBizAppsAccountingDimensionEntity extends BaseEntity {}
export class mjBizAppsAccountingDimensionValueEntity extends BaseEntity {}
export class mjBizAppsAccountingJournalEntryLineDimensionEntity extends BaseEntity {}
export class mjBizAppsAccountingChartOfAccountsMappingEntity extends BaseEntity {}
export class mjBizAppsAccountingRecurringJournalEntryTemplateEntity extends BaseEntity {}
export class mjBizAppsAccountingRecurringJournalEntryTemplateLineEntity extends BaseEntity {}
export class mjBizAppsAccountingRecurringJournalEntryEntity extends BaseEntity {}
export class mjBizAppsAccountingTaxAuthorityEntity extends BaseEntity {}
export class mjBizAppsAccountingTaxJurisdictionEntity extends BaseEntity {}
export class mjBizAppsAccountingTaxRateEntity extends BaseEntity {}
export class mjBizAppsAccountingTaxLiabilityEntity extends BaseEntity {}
export class mjBizAppsAccountingTaxRemittanceEntity extends BaseEntity {}
export class mjBizAppsAccountingCustomerTaxProfileEntity extends BaseEntity {}
export class mjBizAppsAccountingAccountBalanceEntity extends BaseEntity {}
export class mjBizAppsAccountingAccountBalanceByDimensionEntity extends BaseEntity {}
