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
 * SURFACES (connector code is Madhav's; we add nothing to it):
 *  - Line staging uses the engine's `BatchCreateRecords` batch-write surface.
 *  - Journal POST uses `connector.PostJournal(ci, journalId, user)`, added in
 *    connector-business-central 1.2.0 (unblocked 2026-08-21; the previous loud
 *    blocked-on-upstream throw is gone).
 *
 * ONE JOURNAL PER RUN — why this, and not a shared batch (researched 2026-08-21):
 *
 * NOTE ON PROVENANCE, so nobody over-trusts this: Microsoft's guidance prescribes a batch per
 * ACTOR, not per operation — "a typical design is to have a journal batch for each user who
 * enters lines" (alguidelines Journal Template-Batch-Line); batches "provide simultaneous access
 * for multiple users to the same journal" (MS Learn ui-work-general-journals). Per-RUN is OUR
 * extension of that, because a stable per-integration batch still races when two dispatches of
 * the same integration overlap. BC does bless per-posting batches via the journal template's
 * "Increment Batch Name" feature ("the posting following BATCH001 is automatically named
 * BATCH002"), which likewise leaves the old batch behind.
 * `Microsoft.NAV.post` posts an ENTIRE journal batch, not just the lines you added. Business
 * Central offers NO lock or checkout for a journal batch; its documented isolation mechanism
 * IS the batch ("a typical design is to have a journal batch for each user who enters lines"
 * — alguidelines.dev Journal Template-Batch-Line; batches exist to "provide simultaneous
 * access for multiple users to the same journal" — MS Learn ui-work-general-journals).
 * So every dispatch mints its OWN journal:
 *  - two concurrent writers (peer agents, two MJ instances on one tenant, a retry racing
 *    itself) can never share a batch, so no lock is needed — isolation is structural;
 *  - posting can never sweep up somebody else's staged lines. This is not hypothetical: the
 *    probed sandbox holds 22 un-posted Bill.com lines worth 65,261.48 in its BDC_GJ journal,
 *    which a shared-batch design would have posted along with ours;
 *  - the pre-post line-count assertion therefore detects a BUG (or a human editing our batch
 *    in the UI), never a race — which is why stopping and surfacing is a COMPLETE resolution
 *    rather than something needing two systems to reconcile.
 *
 * THE JOURNAL CODE is `Code[10]` in BC — ten characters, hard limit. So it is derived, not
 * descriptive: `AI` + 8 base36 chars of a SHA-256 of the batch's GUID.
 *  - DETERMINISTIC, so a re-dispatch of the same batch resolves the SAME journal instead of
 *    creating a second one (BC does not deduplicate POSTs, so retries would otherwise double);
 *  - GUID-derived, so it is unique ACROSS databases — two MJ instances pointed at one tenant
 *    need no shared sequence to avoid collisions;
 *  - base36 (36^8 ~ 2.8e12) rather than hex truncation (16^8 ~ 4.3e9) for the same 10 chars,
 *    and hashing rather than slicing so the output is uniform regardless of GUID generator.
 * Truncation still makes collision POSSIBLE, and its failure mode is severe (staging into a
 * stranger's journal), so `ResolveOrCreateJournal` GUARDS it: an existing journal is reused
 * only if its displayName carries this batch's GUID. Anything else screams.
 *
 * ROLLBACK: deleting a journal cascades to its lines, so a failed staging deletes the journal
 * and leaves nothing behind — and nothing ever reached the GL, because only `post` commits.
 *
 * LIFECYCLE — posting does NOT remove the journal. It removes the LINES ("when general journals
 * are posted, the general journals before posting are deleted automatically"); the BATCH record
 * persists, which is why this tenant carries empty DEFAULT and MONTHLY containers. A per-run
 * journal would therefore accumulate one empty batch per dispatch forever, so a SUCCESSFUL post
 * deletes the journal too. That is safe for traceability because BC stamps the batch name onto
 * the posted entries ("the Batch Name will be saved in posted tables and entry tables"), and the
 * per-line documentNumber remains the API-visible handle regardless.
 *
 * IDEMPOTENCY BOUNDARY (consequence of the above): deriving the code from the batch GUID makes a
 * retry resolve the SAME journal only while that journal still exists — i.e. between staging and
 * posting. Once posted-and-deleted, BC no longer holds the evidence, so re-dispatch protection
 * must come from OUR side. Hence the ExternalJournalEntryBatchRef pre-check below: a batch that
 * already carries a reference has already posted, and re-staging it would DOUBLE-POST.
 */
import { createHash } from 'node:crypto';
import { RegisterClass } from '@memberjunction/global';
import { LogError } from '@memberjunction/core';
import type { MJCompanyIntegrationEntity } from '@memberjunction/core-entities';
import { ConnectorFactory } from '@memberjunction/integration-engine';
import { BusinessCentralConnector } from '@memberjunction/connector-business-central';
import { AccountingBusinessCentralConnector } from './AccountingBusinessCentralConnector.js';
import type { CreateRecordContext, CRUDResult, ExternalRecord } from '@memberjunction/integration-engine';
import type { mjBizAppsAccountingJournalEntryLineEntity } from '@mj-biz-apps/accounting-entities';
import { resolveExternalAccount } from '../JournalEntryBatchEngine.js';
import {
  BaseExternalAccountingSystemAdapter,
  PostJournalEntryBatchContext,
  PostJournalEntryBatchResult,
  VerifyPostedResult,
} from './BaseExternalAccountingSystemAdapter.js';

/**
 * One staged line in BC's wire shape.
 *
 * `journalId` is REQUIRED: as of connector 2.0.0 `journalLines` addresses its nested path under
 * the parent journal (`/companies({id})/journals({journalId})/journalLines`). The flat
 * company-level form is structurally valid OData that Business Central refuses at runtime.
 *
 * ACCOUNT IDENTITY is either/or, never both. `resolveExternalAccount` returns GLAccount
 * .ExternalAccountID when configured and falls back to the account Code, so it hands back a
 * GUID on some installs and an account number on others. BC exposes a distinct field for each
 * (`accountId` vs `accountNumber`) and sending a GUID as an account number is rejected, so the
 * shape is chosen from the VALUE rather than assumed.
 */
interface BcJournalLineAttributes {
  accountType: 'G/L Account';
  journalId: string;
  accountId?: string;
  accountNumber?: string;
  postingDate: string; // yyyy-MM-dd
  documentNumber: string;
  /** Signed: debit positive, credit negative. */
  amount: number;
  description: string;
  [key: string]: unknown;
}

/** A resolved BC journal batch — the container this run stages into and then posts. */
interface BcJournal {
  Id: string;
  Code: string;
  Created: boolean;
}

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

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

      // Already-posted guard. Deleting the journal after a successful post means BC no longer
      // carries the evidence of the earlier run, so this is the only thing standing between a
      // re-dispatch and a DOUBLE POST into the general ledger.
      const priorRef = context.Batch.ExternalJournalEntryBatchRef;
      if (priorRef) {
        return {
          Success: false,
          Error: `Batch ${context.Batch.JournalEntryBatchNumber} already carries an external reference (${priorRef}), meaning it has already been posted to Business Central. `
            + `Refusing to stage it again — a second post would duplicate the entries in the general ledger. `
            + `If the earlier post genuinely failed, clear the reference deliberately after confirming against BC's general ledger entries.`,
        };
      }

      // Mint (or, on a retry, re-resolve) THIS run's own journal before staging anything.
      const journal = await this.ResolveOrCreateJournal(connector, companyIntegration, context);

      const lineContexts = await this.BuildLineContexts(context, companyIntegration, journal.Id);
      const staged = await connector.BatchCreateRecords(lineContexts);
      const firstFailure = this.FirstFailure(staged);
      if (firstFailure) {
        // Cascade-delete the journal so no half-staged lines survive. Nothing reached the GL:
        // only `post` commits, and we never got there.
        const cleanup = await this.TryDeleteJournal(connector, companyIntegration, context, journal.Id);
        return {
          Success: false,
          Error: `Business Central rejected journal-line staging (line ${firstFailure.Index + 1}/${lineContexts.length}, HTTP ${firstFailure.Result.StatusCode}): ${firstFailure.Result.ErrorMessage ?? 'no message'}. `
            + `No journal was posted (staging only). Journal ${journal.Code} ${cleanup}.`,
        };
      }


      const externalRef = await this.PostStagedJournal(context, connector, companyIntegration, journal);

      return { Success: true, ExternalRef: externalRef };
    } catch (e) {
      return { Success: false, Error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Sent-limbo recovery probe (D12): after a lost `Microsoft.NAV.post` response, did the post land?
   *
   * Reads Business Central's `generalLedgerEntries` filtered on the document number we stamped on
   * every line. This is only answerable because `PostStagedJournal` returns the DOCUMENT NUMBER as
   * ExternalJournalEntryBatchRef — while it returned the shared journal code, a lookup on the stored
   * ref matched nothing and this probe would have reported a posted batch as absent.
   *
   * THE THREE ANSWERS ARE NOT INTERCHANGEABLE:
   *   'posted'  — BC holds entries for this document number. Never re-post.
   *   'absent'  — BC genuinely holds none. Safe to re-post.
   *   'unknown' — we could not find out (transport failure, auth, unexpected shape). Treated as
   *               manual-review, NEVER as absent. Collapsing 'unknown' into 'absent' is what turns a
   *               network blip into a double post into a real general ledger.
   *
   * The bounded filtered read lives on AccountingBusinessCentralConnector, a temporary subclass —
   * see Integrations#265. When a filtered-read surface ships upstream, move this to it and delete
   * the subclass.
   */
  public override async VerifyPosted(documentNumber: string, context: PostJournalEntryBatchContext): Promise<VerifyPostedResult> {
    // Resolution and wiring failures THROW. They are not uncertainty about Business Central — we
    // never reached it — they are a broken deployment. Returning 'unknown' here would make a
    // permanently-dead probe indistinguishable from a dropped packet: every batch would route to
    // manual review forever while the real cause sat in a log. A throw is exactly as safe as
    // 'unknown' (neither can cause a double post) and is the only one that gets fixed.
    const integration = await this.ResolveIntegration(context.System, context.ContextUser, context.Provider);
    const companyIntegration = await this.ResolveCompanyIntegration(integration, context.ContextUser, context.Provider);
    const resolved = ConnectorFactory.Resolve(integration);
    if (!(resolved instanceof AccountingBusinessCentralConnector)) {
      throw new Error(
        `VerifyPosted cannot run: ConnectorFactory resolved '${resolved.constructor.name}', not `
        + `AccountingBusinessCentralConnector. The bounded general-ledger probe lives on that subclass, so its `
        + `@RegisterClass registration for key 'BusinessCentralConnector' is not winning resolution — most `
        + `likely the accounting server package was not imported at boot. This is a deployment defect, not an `
        + `uncertain post: fix the registration rather than treating the batch as unverifiable.`,
      );
    }

    // ONLY the network probe is guarded. A transport or HTTP failure is genuine uncertainty about
    // BC's state, which is precisely what 'unknown' means.
    //
    // THE THREE ANSWERS ARE NOT INTERCHANGEABLE:
    //   'posted'  — BC holds entries for this document number. Never re-post.
    //   'absent'  — BC genuinely holds none. Safe to re-post.
    //   'unknown' — we asked and could not tell. Manual review, NEVER treated as absent. Collapsing
    //               'unknown' into 'absent' is what turns a network blip into a double post into a
    //               real general ledger.
    try {
      const entries = await resolved.GetPostedEntriesByDocumentNumber(companyIntegration, documentNumber, context.ContextUser);
      return entries.length > 0 ? { Status: 'posted', EntryCount: entries.length } : { Status: 'absent' };
    } catch (e) {
      // Log AND return the reason. Logging alone strands the caller — and the human resolving the
      // limbo — with 'unknown' and no way to tell an expired credential from a transient 503.
      const reason = e instanceof Error ? e.message : String(e);
      LogError(`VerifyPosted: general-ledger probe failed for document ${documentNumber}: ${reason}`);
      return { Status: 'unknown', Reason: reason };
    }
  }

  // ── staging ──────────────────────────────────────────────────────────────────

  /** Map every summary line to a BC journalLines create context (account number via the engine's resolver). */
  private async BuildLineContexts(
    context: PostJournalEntryBatchContext,
    companyIntegration: MJCompanyIntegrationEntity,
    journalId: string,
  ): Promise<CreateRecordContext[]> {
    const postingDate = this.FormatPostingDate(context.Batch.PostingDate);
    const documentNumber = this.DocumentNumberFor(context);
    const contexts: CreateRecordContext[] = [];
    for (const line of context.SummaryLines) {
      contexts.push({
        CompanyIntegration: companyIntegration,
        ObjectName: 'journalLines',
        ContextUser: context.ContextUser,
        Attributes: await this.BuildLineAttributes(line, postingDate, documentNumber, context, journalId),
      });
    }
    return contexts;
  }

  private async BuildLineAttributes(
    line: mjBizAppsAccountingJournalEntryLineEntity,
    postingDate: string,
    documentNumber: string,
    context: PostJournalEntryBatchContext,
    journalId: string,
  ): Promise<BcJournalLineAttributes> {
    const account = await resolveExternalAccount(line.GLAccountID, 'BusinessCentral', context.ContextUser, context.Provider);
    const amount = (line.DebitAmount ?? 0) - (line.CreditAmount ?? 0);
    // GUID -> accountId (BC's own key); anything else -> accountNumber (the chart code).
    const accountKey: Pick<BcJournalLineAttributes, 'accountId' | 'accountNumber'> = GUID_RE.test(account)
      ? { accountId: account }
      : { accountNumber: account };
    return {
      accountType: 'G/L Account',
      journalId,
      ...accountKey,
      postingDate,
      documentNumber,
      amount,
      description: (line.Description ?? `JE batch ${documentNumber}`).slice(0, 100),
    };
  }

  /**
   * The `documentNumber` stamped on every line, and therefore on every posted G/L entry — this
   * is the handle a human filters General Ledger Entries by to find what we sent. Prefixed so
   * automated exports are identifiable and reversible by whoever owns the ledger. BC's
   * Document No. is Code[20], so it is truncated rather than silently rejected at post time.
   */
  private DocumentNumberFor(context: PostJournalEntryBatchContext): string {
    return `AIDP-${context.Batch.JournalEntryBatchNumber}`.slice(0, 20);
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

  // ── journal lifecycle ─────────────────────────────────────────────────────────

  /**
   * This run's journal code: `AI` + 8 base36 chars of SHA-256(batch GUID) = exactly 10 chars,
   * BC's `Code[10]` limit. Deterministic, so a retry resolves the same journal (see the header
   * for why that matters — BC does not deduplicate POSTs).
   */
  private JournalCodeFor(context: PostJournalEntryBatchContext): string {
    const channel = (context.Channel ?? 'MAN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'MAN';
    return `AIDP_${channel}`.slice(0, 10);
  }

  /** displayName carries the batch GUID — this is what makes the collision guard possible. */
  private JournalDisplayNameFor(context: PostJournalEntryBatchContext): string {
    return `AIDP ${(context.Channel ?? 'MAN').toUpperCase()} — automated journal entry export`;
  }

  /**
   * Find this run's journal, or create it. Idempotent by construction: the code is derived from
   * the batch, so a re-dispatch lands on the same journal rather than making a second one.
   *
   * COLLISION GUARD: the code is a truncated hash, so a stranger's journal could in principle
   * carry it. Reusing that journal would stage our lines into someone else's batch and then post
   * theirs too — the exact hazard this whole design exists to prevent. So a pre-existing journal
   * is only adopted when its displayName carries OUR batch GUID; otherwise this throws.
   */
  private async ResolveOrCreateJournal(
    connector: BusinessCentralConnector,
    companyIntegration: MJCompanyIntegrationEntity,
    context: PostJournalEntryBatchContext,
  ): Promise<BcJournal> {
    const code = this.JournalCodeFor(context);
    const displayName = this.JournalDisplayNameFor(context);

    const existing = await this.FetchAll(connector, companyIntegration, context, 'journals');
    const match = existing.find(r => String(this.Field(r, 'code') ?? '').trim().toUpperCase() === code);
    // The channel journal is a PERSISTENT container by design — reuse it. Posting empties it, so a
    // healthy steady state is "exists, empty". No collision guard is needed now that codes are
    // static and deliberate rather than hash-derived.
    if (match) return { Id: String(this.Field(match, 'id')), Code: code, Created: false };

    const created = await connector.CreateRecord({
      CompanyIntegration: companyIntegration,
      ObjectName: 'journals',
      ContextUser: context.ContextUser,
      Attributes: { code, displayName },
    });
    if (!created.Success || !created.ExternalID) {
      throw new Error(
        `Could not create the Business Central journal '${code}' for batch ${context.Batch.JournalEntryBatchNumber} `
        + `(HTTP ${created.StatusCode}): ${created.ErrorMessage ?? 'no message'}. Nothing was staged.`,
      );
    }
    return { Id: String(created.ExternalID), Code: code, Created: true };
  }


  /** Best-effort cascade cleanup. Returns a clause describing the outcome for the error message. */
  private async TryDeleteJournal(
    connector: BusinessCentralConnector,
    companyIntegration: MJCompanyIntegrationEntity,
    context: PostJournalEntryBatchContext,
    journalId: string,
  ): Promise<string> {
    try {
      const res = await connector.DeleteRecord({
        CompanyIntegration: companyIntegration,
        ObjectName: 'journals',
        ContextUser: context.ContextUser,
        ExternalID: journalId,
      });
      return res.Success
        ? 'was deleted, so no staged lines remain'
        : `could NOT be deleted (${res.ErrorMessage ?? 'no message'}) — staged lines may remain and need manual cleanup`;
    } catch (e) {
      return `could NOT be deleted (${e instanceof Error ? e.message : String(e)}) — staged lines may remain and need manual cleanup`;
    }
  }

  /** Drain every page of an object. BatchSize is generous; HasMore drives the loop. */
  private async FetchAll(
    connector: BusinessCentralConnector,
    companyIntegration: MJCompanyIntegrationEntity,
    context: PostJournalEntryBatchContext,
    objectName: string,
  ): Promise<ExternalRecord[]> {
    const out: ExternalRecord[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 100; guard++) {
      const page = await connector.FetchChanges({
        CompanyIntegration: companyIntegration,
        ObjectName: objectName,
        WatermarkValue: null,
        BatchSize: 5000,
        CurrentCursor: cursor,
        ContextUser: context.ContextUser,
      });
      out.push(...(page.Records ?? []));
      if (!page.HasMore) return out;
      cursor = page.NextCursor;
      if (!cursor) return out;
    }
    return out;
  }

  /** ExternalRecord puts the vendor payload under `Fields`, not on the record itself. */
  private Field(record: ExternalRecord, key: string): unknown {
    return record.Fields?.[key];
  }

  // ── the atomic commit ─────────────────────────────────────────────────────────

  /**
   * Post the staged journal — `Microsoft.NAV.post`, BC's atomic commit, reached through the
   * connector's `PostJournal` (connector-business-central >= 1.2.0). BC refuses an unbalanced
   * journal, so all-or-nothing genuinely lives here regardless of how the lines arrived.
   *
   * IRREVERSIBLE: a posted journal is corrected with a reversing entry, never un-posted.
   *
   * EXTERNAL REFERENCE: `post` returns 204 with no body, so BC hands back nothing and we must
   * choose the handle ourselves. We return the DOCUMENT NUMBER (`AIDP-<batch number>`).
   *
   * This used to return the journal CODE. That was correct only while journals were per-batch.
   * Under per-channel journals a code like `AIDP_MAN` is a SHARED container reused by every
   * manual batch, so storing it makes ExternalJournalEntryBatchRef ambiguous — every manual
   * batch would carry an identical ref, identifying the channel rather than the post. Worse,
   * `VerifyPosted` looks G/L entries up BY DOCUMENT NUMBER: given the journal code it searches
   * for `AIDP_MAN`, matches nothing, and reports a genuinely-posted batch as unposted. That
   * failure was reproduced end-to-end on 2026-08-25 (batch BATCH-000003 posted G/L entries
   * 6242-6244, while a lookup on the stored ref returned zero rows).
   *
   * The document number has the properties the ref needs: unique per batch, stamped on every
   * posted G/L entry, and the value a human filters General Ledger Entries by. Nothing is lost
   * by dropping the code — `JournalCodeFor` re-derives it from the batch's channel at any time.
   */
  private async PostStagedJournal(
    context: PostJournalEntryBatchContext,
    connector: BusinessCentralConnector,
    companyIntegration: MJCompanyIntegrationEntity,
    journal: BcJournal,
  ): Promise<string> {
    const posted = await connector.PostJournal(companyIntegration, journal.Id, context.ContextUser);
    if (!posted.Success) {
      throw new Error(
        `Business Central refused to post journal ${journal.Code} for batch ${context.Batch.JournalEntryBatchNumber} `
        + `(HTTP ${posted.StatusCode}): ${posted.ErrorMessage ?? 'no message'}. Lines remain STAGED — nothing reached the general ledger.`,
      );
    }
    return this.DocumentNumberFor(context);
  }
}
