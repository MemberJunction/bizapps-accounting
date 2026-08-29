/**
 * AccountingERPEngine — domain brain for ERP master-data pull and journal dispatch.
 *
 * Pull of COA/dimensions uses the MJ Integration Engine (object-name narrowing via
 * entity-map destination). Posting a batch uses MJ verb CreateJournalEntry, never
 * an outbound table sync. Other apps hook in via BaseAccountingEngineExtension.
 */
import { IMetadataProvider, IRunViewProvider, LogError, LogStatus, UserInfo } from '@memberjunction/core';
import { BaseSingleton, MJGlobal } from '@memberjunction/global';
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
import { BaseAccountingERPProvider } from './BaseAccountingERPProvider.js';
import {
  resolveExternalAccount,
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
    const results: RunERPSyncCompanyResult[] = [];

    for (const ci of integrations) {
      const ctx = await this.extensionContext(ci, objects, user, provider);
      await this.invokeExtensions(ctx, 'beforeSync');
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
            await this.invokeExtensions(ctx, afterHookFor(obj));
          }
          await this.invokeExtensions(ctx, 'afterSync');
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
    const ci = (await this.loadCredentialedIntegrations(user, provider, [companyId]))
      .find((row) => namesMatch(row.IntegrationName, target))
      ?? (await this.loadCredentialedIntegrations(user, provider, [companyId]))[0];

    const plugin = this.providerFor(ci?.IntegrationName);
    const ctx = await this.extensionContext(
      ci ?? { CompanyID: companyId, CompanyIntegrationID: '', IntegrationID: '', IntegrationName: target ?? null as unknown as string },
      [],
      user,
      provider,
    );
    ctx.JournalEntryBatchID = batch.ID;

    await this.invokeExtensions(ctx, 'beforePost');
    if (!plugin) {
      const error = `No ERP provider registered for ${ci?.IntegrationName ?? target ?? 'unknown'}.`;
      ctx.ErrorMessage = error;
      await this.invokeExtensions(ctx, 'afterPostFailure');
      return { success: false, error };
    }

    try {
      const lines = [];
      for (const line of summaryLines) {
        const accountNumber = await resolveExternalAccount(line.GLAccountID, target, user, provider);
        lines.push({
          accountNumber,
          debit: line.DebitAmount ?? undefined,
          credit: line.CreditAmount ?? undefined,
          description: line.Description ?? undefined,
        });
      }
      const posted = await plugin.CreateJournalEntry({
        CompanyID: companyId,
        EntryDate: batch.PostingDate ? new Date(batch.PostingDate) : new Date(),
        DocNumber: batch.JournalEntryBatchNumber,
        PrivateNote: `Accounting batch ${batch.JournalEntryBatchNumber}`,
        Lines: lines,
      }, user);
      if (posted.success) {
        ctx.ExternalJournalEntryBatchRef = posted.externalJournalEntryBatchRef ?? null;
        await this.invokeExtensions(ctx, 'afterPost');
      } else {
        ctx.ErrorMessage = posted.error ?? 'ERP post failed';
        await this.invokeExtensions(ctx, 'afterPostFailure');
      }
      return posted;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      ctx.ErrorMessage = error;
      await this.invokeExtensions(ctx, 'afterPostFailure');
      return { success: false, error };
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
      const mod = await (Function('m', 'return import(m)') as (m: string) => Promise<{ IntegrationEngine: { Instance: { RunSync: Function } } }>)('@memberjunction/integration-engine');
      const engine = mod.IntegrationEngine.Instance;
      const result = await engine.RunSync(
        companyIntegrationID,
        user,
        'Manual',
        undefined,
        undefined,
        { EntityMapIDs: entityMapIDs, SyncDirection: 'Pull' },
        provider,
      );
      return { Success: !!result?.Success, Message: result?.ErrorMessage ?? result?.Message };
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
      filter.push(`CompanyID IN (${companyIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',')})`);
    }
    const res = await rv.RunView<Record<string, unknown>>({
      EntityName: CI_ENTITY,
      ExtraFilter: filter.join(' AND '),
      ResultType: 'simple',
    }, user);
    if (!res.Success) throw new Error(res.ErrorMessage ?? 'Company Integrations load failed.');
    const rows = res.Results ?? [];
    const out: CredentialedIntegration[] = [];
    for (const row of rows) {
      const integrationName = await this.integrationName(String(row.IntegrationID ?? ''), user, provider, row);
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

  private async integrationName(
    integrationId: string,
    user: UserInfo,
    provider: IMetadataProvider,
    ciRow: Record<string, unknown>,
  ): Promise<string | null> {
    const denorm = ciRow.Integration;
    if (typeof denorm === 'string' && denorm.trim()) return denorm.trim();
    if (!integrationId) return null;
    const rv = provider as unknown as IRunViewProvider;
    const res = await rv.RunView<{ Name: string }>({
      EntityName: INTEGRATION_ENTITY,
      ExtraFilter: `ID = '${integrationId.replace(/'/g, "''")}'`,
      ResultType: 'simple',
    }, user);
    return res.Results?.[0]?.Name ?? null;
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
      ExtraFilter: `CompanyIntegrationID = '${companyIntegrationID.replace(/'/g, "''")}' AND IsActive = 1`,
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

  private async invokeExtensions(
    ctx: AccountingEngineExtensionContext,
    hook: 'beforeSync' | 'afterSync' | 'afterAccounts' | 'afterDimensions' | 'afterDimensionValues' | 'beforePost' | 'afterPost' | 'afterPostFailure',
  ): Promise<void> {
    const rows = await this.loadExtensionRows(ctx.Provider, ctx.User, ctx.CompanyID);
    for (const row of rows) {
      const ext = this.instantiateExtension(row);
      if (!ext) continue;
      const syncHook = hook === 'beforeSync' || hook === 'afterSync'
        || hook === 'afterAccounts' || hook === 'afterDimensions' || hook === 'afterDimensionValues';
      const participates = syncHook
        ? ext.RunAfterSyncMasterData
        : hook === 'afterPostFailure'
          ? ext.RunAfterPostJournalBatchFailure
          : ext.RunAfterPostJournalBatch;
      if (!participates) continue;
      if (syncHook && !objectsAllowed(ext, ctx.Objects)) continue;
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
      ExtraFilter: `Status = 'Active' AND (CompanyID IS NULL OR CompanyID = '${companyId.replace(/'/g, "''")}')`,
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

export function LoadAccountingERPEngine(): void {}
