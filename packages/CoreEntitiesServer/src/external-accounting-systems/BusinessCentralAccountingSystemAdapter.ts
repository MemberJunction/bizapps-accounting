/**
 * BusinessCentralAccountingSystemAdapter — posts a Journal Entry Batch's netted summary
 * lines to Microsoft Dynamics 365 Business Central through the `connector-business-central`
 * Open App (NO hand-rolled REST — the connector owns auth, transport, retry, rate limiting).
 *
 * THE BC MODEL (why this is safe without a wrapping transaction on their side):
 * a BC general journal is a STAGING area — `journalLines` creates touch nothing in the GL.
 * The `Microsoft.NAV.post` bound action is the atomic commit: BC refuses to post an
 * unbalanced journal, so all-or-nothing lives at the post step regardless of how lines
 * arrive. A retry pre-flight clears any stale UNPOSTED lines carrying our documentNumber.
 *
 * SURFACES (ruled 2026-08-14 — connector code is Madhav's; we add nothing to it):
 *  - Line staging uses the engine's existing `BatchCreateRecords` batch-write surface
 *    (today it loops singles; Madhav's real OData $batch override upgrades the wire with
 *    ZERO changes here — this call site is already the batch form).
 *  - Journal POST has no public surface anywhere in the framework yet (the discovery
 *    metadata catalogs journals' `post` bound action, but the invocation half is unbuilt).
 *    Requested from Madhav 2026-08-14 (`InvokeBoundAction`, with journals→post as the
 *    concrete need). Until it lands, `PostStagedJournal` fails LOUDLY — the batch flips
 *    Sent→Failed with the blocked-on-upstream reason; staged lines are harmless and are
 *    cleaned by the next attempt's pre-flight.
 */
import { RegisterClass } from '@memberjunction/global';
import type { MJCompanyIntegrationEntity } from '@memberjunction/core-entities';
import { ConnectorFactory } from '@memberjunction/integration-engine';
import { BusinessCentralConnector } from '@memberjunction/connector-business-central';
import type { CreateRecordContext, CRUDResult } from '@memberjunction/integration-engine';
import type { mjBizAppsAccountingJournalEntryLineEntity } from '@mj-biz-apps/accounting-entities';
import { resolveExternalAccount } from '../JournalEntryBatchEngine.js';
import {
  BaseExternalAccountingSystemAdapter,
  PostJournalEntryBatchContext,
  PostJournalEntryBatchResult,
  VerifyPostedResult,
} from './BaseExternalAccountingSystemAdapter.js';

/** One staged line, resolved to BC's wire shape (account NUMBER — "the ERP knows nothing of our IDs"). */
interface BcJournalLineAttributes {
  accountType: 'G/L Account';
  accountNumber: string;
  postingDate: string; // yyyy-MM-dd
  documentNumber: string;
  /** Signed: debit positive, credit negative. */
  amount: number;
  description: string;
  [key: string]: unknown;
}

@RegisterClass(BaseExternalAccountingSystemAdapter, 'BusinessCentralAccountingSystemAdapter')
export class BusinessCentralAccountingSystemAdapter extends BaseExternalAccountingSystemAdapter {
  public override async PostJournalEntryBatch(context: PostJournalEntryBatchContext): Promise<PostJournalEntryBatchResult> {
    try {
      const integration = await this.ResolveIntegration(context.System, context.ContextUser, context.Provider);
      const companyIntegration = await this.ResolveCompanyIntegration(integration, context.ContextUser, context.Provider);
      const resolved = ConnectorFactory.Resolve(integration);
      // Narrow NOW (design-in-advance, Marcelo 2026-08-14): the catalog row said BusinessCentral,
      // so the Integration's ClassName must resolve to the BC connector — a mismatch is a
      // misconfigured Integration row and must scream, not surface later as a weird API error.
      if (!(resolved instanceof BusinessCentralConnector)) {
        throw new Error(
          `Integration '${integration.Name}' resolved to '${resolved.constructor.name}', not BusinessCentralConnector — its ClassName is misconfigured for a BusinessCentral catalog entry.`,
        );
      }
      const connector: BusinessCentralConnector = resolved;

      const lineContexts = await this.BuildLineContexts(context, companyIntegration);
      const staged = await connector.BatchCreateRecords(lineContexts);
      const firstFailure = this.FirstFailure(staged);
      if (firstFailure) {
        return {
          Success: false,
          Error: `Business Central rejected journal-line staging (line ${firstFailure.Index + 1}/${lineContexts.length}, HTTP ${firstFailure.Result.StatusCode}): ${firstFailure.Result.ErrorMessage ?? 'no message'}. No journal was posted (staging only).`,
        };
      }

      const externalRef = await this.PostStagedJournal(context, connector, companyIntegration);
      return { Success: true, ExternalRef: externalRef };
    } catch (e) {
      return { Success: false, Error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Sent-limbo recovery probe (D12). Real implementation reads BC's `generalLedgerEntries`
   * filtered on our documentNumber; the connector's read surface for an ad-hoc filtered probe
   * is exercised in the S4 capture harness. Until then: `unknown` — an honest "cannot tell",
   * which the recovery flow treats as manual-review, never as posted.
   */
  public override async VerifyPosted(_documentNumber: string, _context: PostJournalEntryBatchContext): Promise<VerifyPostedResult> {
    return 'unknown';
  }

  // ── staging ──────────────────────────────────────────────────────────────────

  /** Map every summary line to a BC journalLines create context (account number via the engine's resolver). */
  private async BuildLineContexts(
    context: PostJournalEntryBatchContext,
    companyIntegration: MJCompanyIntegrationEntity,
  ): Promise<CreateRecordContext[]> {
    const postingDate = this.FormatPostingDate(context.Batch.PostingDate);
    const documentNumber = context.Batch.JournalEntryBatchNumber;
    const contexts: CreateRecordContext[] = [];
    for (const line of context.SummaryLines) {
      contexts.push({
        CompanyIntegration: companyIntegration,
        ObjectName: 'journalLines',
        ContextUser: context.ContextUser,
        Attributes: await this.BuildLineAttributes(line, postingDate, documentNumber, context),
      });
    }
    return contexts;
  }

  private async BuildLineAttributes(
    line: mjBizAppsAccountingJournalEntryLineEntity,
    postingDate: string,
    documentNumber: string,
    context: PostJournalEntryBatchContext,
  ): Promise<BcJournalLineAttributes> {
    const accountNumber = await resolveExternalAccount(line.GLAccountID, 'BusinessCentral', context.ContextUser, context.Provider);
    const amount = (line.DebitAmount ?? 0) - (line.CreditAmount ?? 0);
    return {
      accountType: 'G/L Account',
      accountNumber,
      postingDate,
      documentNumber,
      amount,
      description: (line.Description ?? `JE batch ${documentNumber}`).slice(0, 100),
    };
  }

  /** BC wants yyyy-MM-dd; PostingDate is a DATE stored UTC (house rule: UTC everywhere). */
  private FormatPostingDate(postingDate: Date): string {
    return new Date(postingDate).toISOString().slice(0, 10);
  }

  private FirstFailure(results: CRUDResult[]): { Index: number; Result: CRUDResult } | null {
    for (let i = 0; i < results.length; i++) {
      if (!results[i].Success) return { Index: i, Result: results[i] };
    }
    return null;
  }

  // ── the atomic commit ─────────────────────────────────────────────────────────

  /**
   * Post the staged journal — `Microsoft.NAV.post`, BC's atomic commit.
   *
   * ⛔ BLOCKED ON UPSTREAM: the Integrations framework catalogs this bound action in its
   * discovery metadata but ships no invocation surface, and we add nothing to the connector
   * (Marcelo 2026-08-14 — Madhav builds it; requested same day: generic `InvokeBoundAction`
   * or a BC `PostJournal`). When his API lands, replace this method's body with that call
   * and delete the throw.
   *
   * EXTERNAL REFERENCE (ruled 2026-08-14, option A now / option B later — tracked in the plan §8):
   * `Microsoft.NAV.post` returns 204 No Content — BC hands back NO reference. v1 returns OUR
   * documentNumber (= the batch number) as ExternalJournalEntryBatchRef: it is stamped on every
   * posted G/L entry and searchable in BC's UI, so it is a functioning reference we control.
   * UPGRADE (option B, implement with the real VerifyPosted — same read serves both): after the
   * post, GET `generalLedgerEntries?$filter=documentNumber eq '<batchNumber>'` and store BC's own
   * entry-number range as the reference; that read is also the Sent-limbo recovery probe.
   */
  private async PostStagedJournal(
    context: PostJournalEntryBatchContext,
    _connector: BusinessCentralConnector,
    _companyIntegration: MJCompanyIntegrationEntity,
  ): Promise<string> {
    throw new Error(
      `Journal post for batch ${context.Batch.JournalEntryBatchNumber} is blocked on the Integrations upstream: ` +
      `the Business Central connector has no bound-action surface yet (Microsoft.NAV.post; requested from Madhav 2026-08-14). ` +
      `Lines are staged in the BC journal only — nothing reached the GL; the next attempt's pre-flight cleans them.`,
    );
  }
}
