/**
 * AccountingERPEngine — domain brain for ERP master-data pull and journal dispatch.
 *
 * Pull of COA/dimensions uses the MJ Integration Engine (object-name narrowing via
 * entity-map destination). Posting a batch uses MJ verb CreateJournalEntry, never
 * an outbound table sync. Other apps hook in via BaseAccountingEngineExtension.
 */
import { IntegrationEngine } from '@memberjunction/integration-engine';
import { IMetadataProvider, IRunViewProvider, LogError, LogStatus, UserInfo } from '@memberjunction/core';
import { BaseSingleton, EscapeSQLString, MJGlobal } from '@memberjunction/global';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';
import {
  ACCOUNTING_ENGINE_EXTENSION_ENTITY,
  ALL_ERP_SYNC_OBJECTS,
  BaseAccountingEngineExtension,
  ERP_SYNC_OBJECT_ENTITY,
  type AccountingEngineExtensionContext,
  type AccountingERPSyncObject,
  type RunERPSyncCompanyResult,
  type RunERPSyncInput,
  type RunERPSyncOutput,
} from '@mj-biz-apps/accounting-engine-base';
import type {
  mjBizAppsAccountingAccountingEngineExtensionEntity,
  mjBizAppsAccountingJournalEntryBatchEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';
import { AccountingEngine } from './AccountingEngine.js';
import {
  defaultAccountingVerbRunner,
  type AccountingVerbRunner,
} from './AccountingVerbRunner.js';
import {
  BaseAccountingERPProvider,
  type CreateERPJournalInput,
  type ERPPostedJournalLine,
} from './BaseAccountingERPProvider.js';
import {
  resolveExternalAccount,
  resolveExternalDimensions,
  type ErpJournalLookupResult,
  type ErpPostResult,
  type JournalEntryBatchTargetSystem,
} from './JournalEntryBatchEngine.js';

const CI_ENTITY = 'MJ: Company Integrations';
const CI_MAP_ENTITY = 'MJ: Company Integration Entity Maps';
const INTEGRATION_ENTITY = 'MJ: Integrations';

export interface AccountingERPEngineSeams {
  runVerb?: AccountingVerbRunner;
  runSync?: (
    companyIntegrationID: string,
    user: UserInfo,
    entityMapIDs: string[],
    provider: IMetadataProvider,
  ) => Promise<{ Success: boolean; Message?: string }>;
}

interface CredentialedIntegration {
  CompanyIntegrationID: string;
  CompanyID: string;
  IntegrationID: string;
  IntegrationName: string;
}

export class AccountingERPEngine extends BaseSingleton<AccountingERPEngine> {
  public static get Instance(): AccountingERPEngine {
    return super.getInstance<AccountingERPEngine>();
  }

  private seams: AccountingERPEngineSeams = {};

  /** Test injection. Production leaves this empty and uses ActionEngine + IntegrationEngine. */
  public UseSeams(seams: AccountingERPEngineSeams): void {
    this.seams = seams;
  }

  public async Config(forceRefresh: boolean, contextUser: UserInfo, provider?: IMetadataProvider): Promise<void> {
    await AccountingEngine.Instance.Config(forceRefresh, contextUser, provider);
  }

  public async SyncMasterData(input: RunERPSyncInput, user: UserInfo, provider: IMetadataProvider): Promise<RunERPSyncOutput> {
    await this.Config(false, user, provider);
    const objects = normalizeObjects(input.Objects);
    const integrations = await this.loadCredentialedIntegrations(user, provider, input.CompanyIDs);
    if (integrations.length === 0) {
      return {
        Success: false,
        Results: [],
      };
    }
    const results: RunERPSyncCompanyResult[] = [];

    for (const ci of integrations) {
      const ctx = await this.extensionContext(ci, objects, user, provider);
      const extensions = await this.loadExtensions(provider, user, ci.CompanyID);
      await this.invokeExtensions(extensions, ctx, 'beforeSync');
      try {
        const mapIds = await this.entityMapIDsForObjects(ci.CompanyIntegrationID, objects, user, provider);
        if (mapIds.length === 0) {
          results.push({
            CompanyID: ci.CompanyID,
            CompanyIntegrationID: ci.CompanyIntegrationID,
            ProviderName: ci.IntegrationName,
            Success: false,
            Message: `No entity maps for ${objects.join(', ')} on this Company Integration.`,
            Objects: objects,
          });
          continue;
        }
        const sync = await this.runSync(ci.CompanyIntegrationID, user, mapIds, provider);
        const row: RunERPSyncCompanyResult = {
          CompanyID: ci.CompanyID,
          CompanyIntegrationID: ci.CompanyIntegrationID,
          ProviderName: ci.IntegrationName,
          Success: sync.Success,
          Message: sync.Message ?? (sync.Success ? 'Synced' : 'Sync failed'),
          Objects: objects,
        };
        results.push(row);
        if (sync.Success) {
          for (const obj of objects) {
            await this.invokeExtensions(extensions, ctx, afterHookFor(obj));
          }
          await this.invokeExtensions(extensions, ctx, 'afterSync');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        LogError(`AccountingERPEngine.SyncMasterData company ${ci.CompanyID}: ${msg}`);
        results.push({
          CompanyID: ci.CompanyID,
          CompanyIntegrationID: ci.CompanyIntegrationID,
          ProviderName: ci.IntegrationName,
          Success: false,
          Message: msg,
          Objects: objects,
        });
      }
    }

    return { Success: results.every((r) => r.Success), Results: results };
  }

  public async PostJournalBatch(
    batch: mjBizAppsAccountingJournalEntryBatchEntity,
    summaryLines: mjBizAppsAccountingJournalEntryLineEntity[],
    user: UserInfo,
    provider: IMetadataProvider,
  ): Promise<ErpPostResult> {
    await this.Config(false, user, provider);
    const companyId = batch.CompanyID;
    const target = batch.TargetSystem as JournalEntryBatchTargetSystem;
    const integrations = await this.loadCredentialedIntegrations(user, provider, [companyId]);
    const ci = integrations.find((row) => namesMatch(row.IntegrationName, target));
    const extensions = await this.loadExtensions(provider, user, companyId);

    if (!ci) {
      const error = target
        ? `No active '${target}' integration for company ${companyId}.`
        : `No active accounting ERP integration for company ${companyId}.`;
      const ctx = await this.extensionContext(
        { CompanyID: companyId, CompanyIntegrationID: '', IntegrationID: '', IntegrationName: target ?? '' },
        [],
        user,
        provider,
      );
      ctx.JournalEntryBatchID = batch.ID;
      ctx.ErrorMessage = error;
      await this.invokeExtensions(extensions, ctx, 'afterPostFailure');
      return { success: false, error };
    }

    const plugin = this.providerFor(ci.IntegrationName);
    const ctx = await this.extensionContext(ci, [], user, provider);
    ctx.JournalEntryBatchID = batch.ID;

    await this.invokeExtensions(extensions, ctx, 'beforePost');
    if (!plugin) {
      const error = `No ERP provider registered for ${ci.IntegrationName}.`;
      ctx.ErrorMessage = error;
      await this.invokeExtensions(extensions, ctx, 'afterPostFailure');
      return { success: false, error };
    }

    let posted: ErpPostResult;
    try {
      posted = await plugin.CreateJournalEntry({
        CompanyID: companyId,
        EntryDate: entryDateOf(batch),
        DocNumber: batch.JournalEntryBatchNumber,
        PrivateNote: `Accounting batch ${batch.JournalEntryBatchNumber}`,
        Lines: await erpLinesFor(summaryLines, target, user, provider),
      }, user);
    } catch (e) {
      posted = { success: false, error: e instanceof Error ? e.message : String(e) };
    }

    if (!posted.success) {
      ctx.ErrorMessage = posted.error ?? 'ERP post failed';
      await this.invokeExtensions(extensions, ctx, 'afterPostFailure');
      return posted;
    }
    // The ERP has accepted the journal. Nothing after this point may turn that into a failure: a
    // batch recorded Failed invites a retry, and a retry of a journal the ERP holds duplicates it.
    ctx.ExternalJournalEntryBatchRef = posted.externalJournalEntryBatchRef ?? null;
    try {
      await this.invokeExtensions(extensions, ctx, 'afterPost');
    } catch (e) {
      LogError(`AccountingERPEngine.PostJournalBatch: afterPost failed for batch ${batch.JournalEntryBatchNumber ?? batch.ID}, which the ERP has accepted; the post stands.`, null, e);
    }
    return posted;
  }

  /**
   * What the batch's target ERP holds under the batch's number, compared with what the batch would
   * send (#182). A posting counts as this batch only when every line matches on account, debit and
   * credit, and every line carries the batch's posting date. Runs no extension hooks: it posts
   * nothing.
   */
  public async FindPostedJournalBatch(
    batch: mjBizAppsAccountingJournalEntryBatchEntity,
    summaryLines: mjBizAppsAccountingJournalEntryLineEntity[],
    user: UserInfo,
    provider: IMetadataProvider,
  ): Promise<ErpJournalLookupResult> {
    await this.Config(false, user, provider);
    const target = batch.TargetSystem as JournalEntryBatchTargetSystem;
    const integrations = await this.loadCredentialedIntegrations(user, provider, [batch.CompanyID]);
    const ci = integrations.find((row) => namesMatch(row.IntegrationName, target));
    // No integration or no provider: the post cannot run either, and says why when it is attempted.
    const plugin = ci ? this.providerFor(ci.IntegrationName) : null;
    if (!plugin) return { status: 'Unavailable' };
    if (!batch.JournalEntryBatchNumber) {
      return { status: 'Error', error: `batch ${batch.ID} has no number to look up in the ERP.` };
    }

    try {
      const found = await plugin.FindJournalEntry({ CompanyID: batch.CompanyID, DocNumber: batch.JournalEntryBatchNumber }, user);
      if (found.status !== 'Ok') return found;
      if (found.lines.length === 0) return { status: 'NotFound' };
      const expected = await erpLinesFor(summaryLines, target, user, provider);
      // The day the post sends: the verb writes EntryDate from the same Date's UTC parts.
      const postingDate = ToCalendarDay(entryDateOf(batch));
      if (!postingDate) return { status: 'Error', error: `batch ${batch.JournalEntryBatchNumber} has an unreadable posting date.` };
      const detail = postedJournalMismatch(expected, postingDate, found.lines);
      return detail
        ? { status: 'Mismatch', detail }
        : { status: 'Found', externalJournalEntryBatchRef: found.externalJournalEntryBatchRef };
    } catch (e) {
      return { status: 'Error', error: e instanceof Error ? e.message : String(e) };
    }
  }

  private providerFor(integrationName: string | undefined): BaseAccountingERPProvider | null {
    if (!integrationName) return null;
    const res = MJGlobal.Instance.ClassFactory.TryCreateInstance<BaseAccountingERPProvider>(
      BaseAccountingERPProvider,
      integrationName,
      this.seams.runVerb ?? defaultAccountingVerbRunner,
    );
    if (!res.Resolved || !res.Instance) {
      LogStatus(`AccountingERPEngine: no provider for '${integrationName}': ${res.Reason}`);
      return null;
    }
    return res.Instance;
  }

  private async runSync(
    companyIntegrationID: string,
    user: UserInfo,
    entityMapIDs: string[],
    provider: IMetadataProvider,
  ): Promise<{ Success: boolean; Message?: string }> {
    if (this.seams.runSync) {
      return this.seams.runSync(companyIntegrationID, user, entityMapIDs, provider);
    }
    try {
      const result = await IntegrationEngine.Instance.RunSync(
        companyIntegrationID,
        user,
        'Manual',
        undefined,
        undefined,
        { EntityMapIDs: entityMapIDs, SyncDirection: 'Pull' },
        provider,
      );
      return { Success: !!result?.Success, Message: result?.ErrorMessage };
    } catch (e) {
      return { Success: false, Message: e instanceof Error ? e.message : String(e) };
    }
  }

  private async loadCredentialedIntegrations(
    user: UserInfo,
    provider: IMetadataProvider,
    companyIds?: string[],
  ): Promise<CredentialedIntegration[]> {
    const rv = provider as unknown as IRunViewProvider;
    const filter = [`IsActive = 1`];
    if (companyIds && companyIds.length > 0) {
      filter.push(`CompanyID IN (${companyIds.map((id) => `'${EscapeSQLString(id)}'`).join(',')})`);
    }
    const res = await rv.RunView<Record<string, unknown>>({
      EntityName: CI_ENTITY,
      ExtraFilter: filter.join(' AND '),
      ResultType: 'simple',
    }, user);
    if (!res.Success) throw new Error(res.ErrorMessage ?? 'Company Integrations load failed.');
    const rows = res.Results ?? [];
    const namesById = await this.integrationNamesById(rows, user, provider);
    const out: CredentialedIntegration[] = [];
    for (const row of rows) {
      const denorm = row.Integration;
      const integrationName = (typeof denorm === 'string' && denorm.trim())
        ? denorm.trim()
        : namesById.get(String(row.IntegrationID ?? '')) ?? null;
      if (!integrationName) continue;
      out.push({
        CompanyIntegrationID: String(row.ID),
        CompanyID: String(row.CompanyID),
        IntegrationID: String(row.IntegrationID),
        IntegrationName: integrationName,
      });
    }
    return out;
  }

  private async integrationNamesById(
    rows: Record<string, unknown>[],
    user: UserInfo,
    provider: IMetadataProvider,
  ): Promise<Map<string, string>> {
    const missing = [...new Set(
      rows
        .filter((row) => !(typeof row.Integration === 'string' && row.Integration.trim()))
        .map((row) => String(row.IntegrationID ?? ''))
        .filter(Boolean),
    )];
    const names = new Map<string, string>();
    if (missing.length === 0) return names;
    const rv = provider as unknown as IRunViewProvider;
    const res = await rv.RunView<{ ID: string; Name: string }>({
      EntityName: INTEGRATION_ENTITY,
      ExtraFilter: `ID IN (${missing.map((id) => `'${EscapeSQLString(id)}'`).join(',')})`,
      ResultType: 'simple',
    }, user);
    for (const row of res.Results ?? []) {
      if (row.Name) names.set(String(row.ID), row.Name);
    }
    return names;
  }

  private async entityMapIDsForObjects(
    companyIntegrationID: string,
    objects: AccountingERPSyncObject[],
    user: UserInfo,
    provider: IMetadataProvider,
  ): Promise<string[]> {
    const rv = provider as unknown as IRunViewProvider;
    const res = await rv.RunView<Record<string, unknown>>({
      EntityName: CI_MAP_ENTITY,
      ExtraFilter: `CompanyIntegrationID = '${EscapeSQLString(companyIntegrationID)}' AND IsActive = 1`,
      ResultType: 'simple',
    }, user);
    if (!res.Success) return [];
    const wanted = new Set(objects.map((o) => ERP_SYNC_OBJECT_ENTITY[o]));
    const ids: string[] = [];
    for (const row of res.Results ?? []) {
      const entityName = String(row.Entity ?? row.EntityName ?? '');
      if (wanted.has(entityName)) ids.push(String(row.ID));
    }
    return ids;
  }

  private async extensionContext(
    ci: CredentialedIntegration | { CompanyID: string; CompanyIntegrationID: string; IntegrationID: string; IntegrationName: string },
    objects: AccountingERPSyncObject[],
    user: UserInfo,
    provider: IMetadataProvider,
  ): Promise<AccountingEngineExtensionContext> {
    return {
      CompanyID: ci.CompanyID,
      AsOf: new Date(),
      Objects: objects,
      CompanyIntegrationID: ci.CompanyIntegrationID || null,
      ProviderName: ci.IntegrationName || null,
      User: user,
      Provider: provider,
    };
  }

  private async loadExtensions(
    provider: IMetadataProvider,
    user: UserInfo,
    companyId: string,
  ): Promise<BaseAccountingEngineExtension[]> {
    const rows = await this.loadExtensionRows(provider, user, companyId);
    const out: BaseAccountingEngineExtension[] = [];
    for (const row of rows) {
      const ext = this.instantiateExtension(row);
      if (ext) out.push(ext);
    }
    return out;
  }

  private async invokeExtensions(
    extensions: BaseAccountingEngineExtension[],
    ctx: AccountingEngineExtensionContext,
    hook: 'beforeSync' | 'afterSync' | 'afterAccounts' | 'afterDimensions' | 'afterDimensionValues' | 'beforePost' | 'afterPost' | 'afterPostFailure',
  ): Promise<void> {
    for (const ext of extensions) {
      if (!extensionParticipates(ext, ctx, hook)) continue;
      const continueOnError = ext.Configuration?.ContinueOnError === true;
      try {
        switch (hook) {
          case 'beforeSync': await ext.BeforeSyncMasterData(ctx); break;
          case 'afterSync': await ext.AfterSyncMasterData(ctx); break;
          case 'afterAccounts': await ext.AfterSyncAccounts(ctx); break;
          case 'afterDimensions': await ext.AfterSyncDimensions(ctx); break;
          case 'afterDimensionValues': await ext.AfterSyncDimensionValues(ctx); break;
          case 'beforePost': await ext.BeforePostJournalBatch(ctx); break;
          case 'afterPost': await ext.AfterPostJournalBatch(ctx); break;
          case 'afterPostFailure': await ext.AfterPostJournalBatchFailure(ctx); break;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        LogError(`AccountingEngineExtension ${ext.Code} ${hook}: ${msg}`);
        if (!continueOnError) throw e;
      }
    }
  }

  private async loadExtensionRows(
    provider: IMetadataProvider,
    user: UserInfo,
    companyId: string,
  ): Promise<mjBizAppsAccountingAccountingEngineExtensionEntity[]> {
    const rv = provider as unknown as IRunViewProvider;
    const res = await rv.RunView<mjBizAppsAccountingAccountingEngineExtensionEntity>({
      EntityName: ACCOUNTING_ENGINE_EXTENSION_ENTITY,
      ExtraFilter: `Status = 'Active' AND (CompanyID IS NULL OR CompanyID = '${EscapeSQLString(companyId)}')`,
      OrderBy: 'Sequence, Code',
      ResultType: 'entity_object',
    }, user);
    if (!res.Success) {
      LogError(`AccountingEngineExtension load failed: ${res.ErrorMessage}`);
      return [];
    }
    return res.Results ?? [];
  }

  private instantiateExtension(row: mjBizAppsAccountingAccountingEngineExtensionEntity): BaseAccountingEngineExtension | null {
    const key = row.DriverClass;
    const res = MJGlobal.Instance.ClassFactory.TryCreateInstance<BaseAccountingEngineExtension>(
      BaseAccountingEngineExtension,
      key,
    );
    if (!res.Resolved || !res.Instance) {
      LogStatus(`AccountingERPEngine: extension '${row.Code}' DriverClass '${key}' did not resolve — skipped.`);
      return null;
    }
    res.Instance.Configuration = row.ConfigurationObject ?? null;
    return res.Instance;
  }
}

function normalizeObjects(objects?: AccountingERPSyncObject[]): AccountingERPSyncObject[] {
  if (!objects || objects.length === 0) return [...ALL_ERP_SYNC_OBJECTS];
  return objects.filter((o) => ALL_ERP_SYNC_OBJECTS.includes(o));
}

function afterHookFor(obj: AccountingERPSyncObject): 'afterAccounts' | 'afterDimensions' | 'afterDimensionValues' {
  if (obj === 'accounts') return 'afterAccounts';
  if (obj === 'dimensions') return 'afterDimensions';
  return 'afterDimensionValues';
}

function objectsAllowed(ext: BaseAccountingEngineExtension, ran: AccountingERPSyncObject[]): boolean {
  const wanted = ext.Configuration?.Objects;
  if (!wanted || wanted.length === 0) return true;
  return wanted.some((o) => ran.includes(o));
}

function objectConfigured(ext: BaseAccountingEngineExtension, obj: AccountingERPSyncObject): boolean {
  const wanted = ext.Configuration?.Objects;
  if (!wanted || wanted.length === 0) return true;
  return wanted.includes(obj);
}

type ExtensionHook =
  | 'beforeSync' | 'afterSync' | 'afterAccounts' | 'afterDimensions' | 'afterDimensionValues'
  | 'beforePost' | 'afterPost' | 'afterPostFailure';

function extensionParticipates(
  ext: BaseAccountingEngineExtension,
  ctx: AccountingEngineExtensionContext,
  hook: ExtensionHook,
): boolean {
  switch (hook) {
    case 'beforeSync':
      return ext.ParticipatesInSyncMasterData && objectsAllowed(ext, ctx.Objects);
    case 'afterSync':
      return ext.ParticipatesInSyncMasterData && ext.RunAfterSyncMasterData && objectsAllowed(ext, ctx.Objects);
    case 'afterAccounts':
      return ext.ParticipatesInSyncMasterData && ext.RunAfterSyncMasterData
        && ctx.Objects.includes('accounts') && objectConfigured(ext, 'accounts');
    case 'afterDimensions':
      return ext.ParticipatesInSyncMasterData && ext.RunAfterSyncMasterData
        && ctx.Objects.includes('dimensions') && objectConfigured(ext, 'dimensions');
    case 'afterDimensionValues':
      return ext.ParticipatesInSyncMasterData && ext.RunAfterSyncMasterData
        && ctx.Objects.includes('dimensionValues') && objectConfigured(ext, 'dimensionValues');
    case 'beforePost':
      return ext.ParticipatesInPostJournalBatch;
    case 'afterPost':
      return ext.ParticipatesInPostJournalBatch && ext.RunAfterPostJournalBatch;
    case 'afterPostFailure':
      return ext.ParticipatesInPostJournalBatchFailure && ext.RunAfterPostJournalBatchFailure;
  }
}

function namesMatch(integrationName: string, targetSystem: string | null | undefined): boolean {
  if (!targetSystem) return false;
  const a = integrationName.toLowerCase().replace(/\s+/g, '');
  const b = targetSystem.toLowerCase().replace(/\s+/g, '');
  if (a.includes('quickbooks') && b.includes('quickbooks')) return true;
  if (a.includes('businesscentral') && (b.includes('businesscentral') || b === 'bc')) return true;
  return a === b;
}

export function createAccountingERPPoster(provider: IMetadataProvider) {
  return async (
    batch: mjBizAppsAccountingJournalEntryBatchEntity,
    summaryLines: mjBizAppsAccountingJournalEntryLineEntity[],
    user: UserInfo,
  ): Promise<ErpPostResult> => AccountingERPEngine.Instance.PostJournalBatch(batch, summaryLines, user, provider);
}

/** The pre-flight partner of {@link createAccountingERPPoster}: wire the two together. */
export function createAccountingERPLookup(provider: IMetadataProvider) {
  return async (
    batch: mjBizAppsAccountingJournalEntryBatchEntity,
    summaryLines: mjBizAppsAccountingJournalEntryLineEntity[],
    user: UserInfo,
  ): Promise<ErpJournalLookupResult> => AccountingERPEngine.Instance.FindPostedJournalBatch(batch, summaryLines, user, provider);
}

/** The journal date the ERP receives. */
function entryDateOf(batch: mjBizAppsAccountingJournalEntryBatchEntity): Date {
  return batch.PostingDate ? new Date(batch.PostingDate) : new Date();
}

/** The summary lines in the terms the ERP receives them: external account numbers and dimension codes. */
async function erpLinesFor(
  summaryLines: mjBizAppsAccountingJournalEntryLineEntity[],
  target: JournalEntryBatchTargetSystem,
  user: UserInfo,
  provider: IMetadataProvider,
): Promise<CreateERPJournalInput['Lines']> {
  // One batched resolution for the whole summary — the tags live in a separate entity, and
  // re-querying per line would issue two RunViews per line for data that does not vary.
  const dimensionsByLine = await resolveExternalDimensions(summaryLines.map((l) => l.ID), user, provider);
  const lines: CreateERPJournalInput['Lines'] = [];
  for (const line of summaryLines) {
    const accountNumber = await resolveExternalAccount(line.GLAccountID, target, user, provider);
    lines.push({
      accountNumber,
      debit: line.DebitAmount ?? undefined,
      credit: line.CreditAmount ?? undefined,
      description: line.Description ?? undefined,
      dimensions: dimensionsByLine.get(line.ID),
    });
  }
  return lines;
}

/**
 * Why the posted lines are not the batch's lines, or null when they are: the same posting date on
 * every line, and the same lines by account, debit and credit, each as many times as the batch has it.
 */
function postedJournalMismatch(expected: CreateERPJournalInput['Lines'], postingDate: string, posted: ERPPostedJournalLine[]): string | null {
  const otherDates = [...new Set(posted.map((l) => l.postingDate).filter((d) => d !== postingDate))];
  if (otherDates.length > 0) {
    return `it posted on ${otherDates.join(', ')}; the batch's posting date is ${postingDate}.`;
  }
  const want = lineCounts(expected.map((l) => lineKey(l.accountNumber, l.debit ?? 0, l.credit ?? 0)));
  const have = lineCounts(posted.map((l) => lineKey(l.accountNumber, l.debit, l.credit)));
  const differing = [...new Set([...want.keys(), ...have.keys()])].filter((k) => want.get(k) !== have.get(k));
  if (differing.length === 0) return null;
  const shown = differing.slice(0, 5).map((k) => `${k} (batch ${want.get(k) ?? 0}, ERP ${have.get(k) ?? 0})`);
  return `${posted.length} ERP line(s) against ${expected.length} in the batch; lines that differ, as account debit/credit: ` +
    `${shown.join('; ')}${differing.length > shown.length ? `; and ${differing.length - shown.length} more` : ''}.`;
}

/** Account and amounts, rounded to the cent so float noise from either side cannot split a match. */
function lineKey(accountNumber: string, debit: number, credit: number): string {
  return `${accountNumber} ${debit.toFixed(2)}/${credit.toFixed(2)}`;
}

function lineCounts(keys: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return counts;
}

export function LoadAccountingERPEngine(): void {}
