/**
 * BaseExternalAccountingSystemAdapter — the contract every external accounting system
 * (ERP/GL destination) adapter implements, plus the shared connection-resolution helpers.
 *
 * Selection is METADATA-DRIVEN (plan: plans/external-accounting-system-dispatch.md, D1-D3):
 * an `ExternalAccountingSystem` catalog row names the system, carries `DriverClass` (the
 * adapter class's OWN name — the ClassFactory key), and, for connector-backed systems,
 * `IntegrationName` (the `__mj.Integration` record's Name; the Integration row is minted
 * by the connector Open App's own migration, so the bridge is by name, not ID).
 *
 * Adapters register with `@RegisterClass(BaseExternalAccountingSystemAdapter, '<OwnClassName>')`
 * and are instantiated via `ClassFactory.CreateInstance` from the catalog row's DriverClass —
 * the same three-legged pattern as Integration.ClassName → ConnectorFactory and
 * AIModel.DriverClass → AIEngine. Adding a new ERP = one catalog row + one registered class.
 *
 * Failure doctrine (D6): a missing catalog row, unregistered DriverClass, or missing/ambiguous
 * CompanyIntegration is a LOUD failure — the dispatch flow flips the batch Sent→Failed with the
 * reason. Nothing ever falls back to the Mock system; selecting Mock is an explicit choice.
 */
import { IMetadataProvider, IRunViewProvider, RunView, UserInfo } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import type { MJIntegrationEntity, MJCompanyIntegrationEntity } from '@memberjunction/core-entities';
import type {
  mjBizAppsAccountingExternalAccountingSystemEntity,
  mjBizAppsAccountingJournalEntryBatchEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';

/** Everything an adapter needs to post one batch's summary lines to its system. */
export interface PostJournalEntryBatchContext {
  /** The batch being dispatched (Status='Sent' when the adapter runs — the in-flight marker is already written). */
  Batch: mjBizAppsAccountingJournalEntryBatchEntity;
  /** The summary JE's lines — the netted, per-GLAccount consolidation the ERP receives. */
  SummaryLines: mjBizAppsAccountingJournalEntryLineEntity[];
  /** The catalog row that selected this adapter (DriverClass, IntegrationName, …). */
  System: mjBizAppsAccountingExternalAccountingSystemEntity;
  ContextUser: UserInfo;
  /** The caller's provider — all reads/writes ride the request's transaction-capable provider. */
  Provider: IMetadataProvider;
}

/** Outcome of a post attempt. `Success: false` flips the batch Sent→Failed with `Error` as the reason. */
export interface PostJournalEntryBatchResult {
  Success: boolean;
  /** The destination system's reference for the posted batch (stored as ExternalJournalEntryBatchRef). */
  ExternalRef?: string;
  Error?: string;
}

/** Verdict of the Sent-limbo recovery probe (crash between the ERP post and the local Posted flip — D12). */
export type VerifyPostedResult = 'posted' | 'absent' | 'unknown';

export abstract class BaseExternalAccountingSystemAdapter {
  /**
   * Post one batch's summary lines to the destination system. Implementations must map every
   * destination response to a clean result — never an ambiguous success (SAFETY.md: when a
   * command's exit and its outcome can disagree, the outcome is what gets reported).
   */
  public abstract PostJournalEntryBatch(context: PostJournalEntryBatchContext): Promise<PostJournalEntryBatchResult>;

  /**
   * Recovery probe: did a batch identified by `documentNumber` actually post on the destination?
   * Used when the local Posted flip is in doubt (crash between the ERP post and phase 3).
   */
  public abstract VerifyPosted(documentNumber: string, context: PostJournalEntryBatchContext): Promise<VerifyPostedResult>;

  // ── shared connection resolution (connector-backed adapters) ────────────────

  /** The `__mj.Integration` record named by the catalog row. Loud error when absent. */
  protected async ResolveIntegration(
    system: mjBizAppsAccountingExternalAccountingSystemEntity,
    contextUser: UserInfo,
    provider: IMetadataProvider,
  ): Promise<MJIntegrationEntity> {
    if (!system.IntegrationName) {
      throw new Error(
        `ExternalAccountingSystem '${system.Name}' has no IntegrationName — it is not connector-backed, so a connector-based adapter cannot serve it.`,
      );
    }
    const rv = new RunView(provider as unknown as IRunViewProvider);
    const res = await rv.RunView<MJIntegrationEntity>(
      {
        EntityName: 'MJ: Integrations',
        ExtraFilter: `Name='${system.IntegrationName.replace(/'/g, "''")}'`,
        ResultType: 'entity_object',
      },
      contextUser,
    );
    if (!res.Success) throw new Error(`ResolveIntegration: lookup failed: ${res.ErrorMessage}`);
    const rows = res.Results ?? [];
    if (rows.length !== 1) {
      throw new Error(
        `ExternalAccountingSystem '${system.Name}' names Integration '${system.IntegrationName}', but ${rows.length} such Integration records exist. ` +
        `Is the backing connector Open App installed/linked (its migration seeds the Integration row)?`,
      );
    }
    return rows[0];
  }

  /**
   * The single active CompanyIntegration carrying this Integration's connection config + credential.
   * External systems are NOT divided by company (D13): resolution is by Integration alone, and
   * exactly one active row must exist — 0 means "connection not configured yet" (the expected state
   * until credentials arrive), 2+ is ambiguous; both fail loudly.
   */
  protected async ResolveCompanyIntegration(
    integration: MJIntegrationEntity,
    contextUser: UserInfo,
    provider: IMetadataProvider,
  ): Promise<MJCompanyIntegrationEntity> {
    const rv = new RunView(provider as unknown as IRunViewProvider);
    const res = await rv.RunView<MJCompanyIntegrationEntity>(
      {
        EntityName: 'MJ: Company Integrations',
        ExtraFilter: `IntegrationID='${integration.ID}' AND IsActive=1`,
        ResultType: 'entity_object',
      },
      contextUser,
    );
    if (!res.Success) throw new Error(`ResolveCompanyIntegration: lookup failed: ${res.ErrorMessage}`);
    const rows = res.Results ?? [];
    if (rows.length === 0) {
      throw new Error(
        `Integration '${integration.Name}' has no active CompanyIntegration — the connection (tenant/environment/credential) is not configured yet.`,
      );
    }
    if (rows.length > 1) {
      throw new Error(
        `Integration '${integration.Name}' has ${rows.length} active CompanyIntegrations — ambiguous connection; deactivate all but one.`,
      );
    }
    return rows[0];
  }
}

/**
 * Load the catalog row for a system by Name and instantiate its adapter via ClassFactory.
 * The loud-failure cases (no row, inactive row, unregistered DriverClass) all throw here,
 * BEFORE any batch state is touched.
 */
export async function ResolveExternalAccountingSystemAdapter(
  systemName: string,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<{ System: mjBizAppsAccountingExternalAccountingSystemEntity; Adapter: BaseExternalAccountingSystemAdapter }> {
  const rv = new RunView(provider as unknown as IRunViewProvider);
  const res = await rv.RunView<mjBizAppsAccountingExternalAccountingSystemEntity>(
    {
      EntityName: 'MJ_BizApps_Accounting: External Accounting Systems',
      ExtraFilter: `Name='${systemName.replace(/'/g, "''")}'`,
      ResultType: 'entity_object',
    },
    contextUser,
  );
  if (!res.Success) throw new Error(`ResolveExternalAccountingSystemAdapter: catalog lookup failed: ${res.ErrorMessage}`);
  const rows = res.Results ?? [];
  if (rows.length !== 1) {
    throw new Error(
      `No ExternalAccountingSystem catalog row named '${systemName}' (${rows.length} matches). Seed the system before dispatching to it.`,
    );
  }
  const system = rows[0];
  if (!system.IsActive) {
    throw new Error(`ExternalAccountingSystem '${systemName}' is inactive (IsActive=0) — dispatching to it is disabled.`);
  }
  const adapter = MJGlobal.Instance.ClassFactory.CreateInstance<BaseExternalAccountingSystemAdapter>(
    BaseExternalAccountingSystemAdapter,
    system.DriverClass,
  );
  if (!adapter) {
    throw new Error(
      `No adapter class registered for DriverClass '${system.DriverClass}' (system '${systemName}'). ` +
      `Is the package exporting it loaded by this host?`,
    );
  }
  return { System: system, Adapter: adapter };
}
