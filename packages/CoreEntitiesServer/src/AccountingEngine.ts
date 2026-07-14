/**
 * AccountingEngine — the server write path (plan §2.2, CH-11; the AIEngine-pattern wrapper over
 * the browser-safe AccountingEngineBase cache).
 *
 * `CreateJournalEntry(draft, user, provider)` runs the 7-stage pipeline:
 *   stages 1-5 (shape → accounts → dimensions → normalize → balance + single-company MOD-12) are the
 *   PURE pipeline from @mj-biz-apps/accounting-engine-base, fed by the engine caches;
 *   stage 6 writes the JE header + lines + line-dimensions in ONE TransactionGroup (all rows or
 *   none); stage 7 shapes the typed result. Logical failures NEVER throw (remote-op convention) —
 *   inspect `Success` / `Errors`.
 *
 * Numbering rides the existing JournalEntryEntityServer W2 hook (per-company per-FY, MOD-12);
 * the DB triggers (50001/50019 balanced-on-lock) remain the un-bypassable floor at lock time.
 *
 * CONNECTS TO:
 *   BASE:    AccountingEngineBase (@mj-biz-apps/accounting-engine-base) — caches + pure pipeline
 *   CALLER:  CreateJournalEntryOperation ('Accounting.CreateJournalEntry') · orders-server (in-process)
 *   ENTITY:  'MJ_BizApps_Accounting: Journal Entries' (+ Lines, Line Dimensions)
 *   DOC:     plans/accounting-engine-plan.md §2.2
 */
import { IMetadataProvider, LogError, UserInfo } from '@memberjunction/core';
import { BaseSingleton } from '@memberjunction/global';
import {
  AccountingEngineBase,
  runDraftPipeline,
  type CreateJournalEntryResult,
  type JournalEntryDraft,
  type NormalizedLine,
} from '@mj-biz-apps/accounting-engine-base';
import type {
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingJournalEntryLineDimensionEntity,
} from '@mj-biz-apps/accounting-entities';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';

export class AccountingEngine extends BaseSingleton<AccountingEngine> {
  public static get Instance(): AccountingEngine {
    return super.getInstance<AccountingEngine>();
  }

  /** The browser-safe cache this server engine wraps (AIEngine pattern). */
  public get Base(): AccountingEngineBase {
    return AccountingEngineBase.Instance;
  }

  /** Ensure the base caches are loaded (no-op when already configured). */
  public async Config(forceRefresh: boolean, contextUser: UserInfo, provider?: IMetadataProvider): Promise<void> {
    await this.Base.Config(forceRefresh, contextUser, provider);
  }

  /**
   * The Accounting.CreateJournalEntry pipeline (plan §2.2). Validates the draft against the
   * cached reference data, then writes header + lines + line-dimensions atomically.
   * Never throws for logical failures — returns the typed result.
   */
  public async CreateJournalEntry(
    draft: JournalEntryDraft,
    contextUser: UserInfo,
    provider: IMetadataProvider,
  ): Promise<CreateJournalEntryResult> {
    try {
      await this.Config(false, contextUser, provider);

      // Stages 1-5 — the pure pipeline over the engine caches.
      let outcome = runDraftPipeline(draft, this.Base.CreatePipelineLookups());

      // Cache-miss retry (bounded to ONE forced refresh): BaseEngine auto-refresh only sees entity
      // events in THIS process tier, so reference rows created by another process (a second MJAPI,
      // a script, a fixture) are invisible until refresh. An unknown-reference failure is exactly
      // that staleness signal — refresh once and re-validate before rejecting the caller.
      const stalenessCodes = new Set(['ACCOUNT_UNKNOWN', 'ACCOUNT_INACTIVE', 'DIMENSION_UNKNOWN', 'DIMENSION_VALUE_UNKNOWN']);
      if (outcome.errors.some(e => stalenessCodes.has(e.Code))) {
        await this.Config(true, contextUser, provider);
        outcome = runDraftPipeline(draft, this.Base.CreatePipelineLookups());
      }

      if (outcome.errors.length > 0) {
        return { Success: false, Errors: outcome.errors };
      }

      // Stage 6 — atomic write (one TransactionGroup: all rows or none).
      return await this.writeJournalEntry(draft, outcome.normalized, outcome.companyID, contextUser, provider);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`AccountingEngine.CreateJournalEntry failed: ${msg}`);
      return { Success: false, Errors: [{ Code: 'INTERNAL_ERROR', Message: msg }] };
    }
  }

  // ─── stage 6 ───────────────────────────────────────────────────────────────

  private async writeJournalEntry(
    draft: JournalEntryDraft,
    normalized: NormalizedLine[],
    companyID: string,
    contextUser: UserInfo,
    provider: IMetadataProvider,
  ): Promise<CreateJournalEntryResult> {
    const tg = await provider.CreateTransactionGroup();

    // Header. NewRecord mints the UUID client-side, so lines/dimensions can reference it pre-submit.
    // The W2 numbering hook (JournalEntryEntityServer.Save) assigns EntryNumber before the queued save.
    const je = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, contextUser);
    je.NewRecord();
    je.CompanyID = companyID; // MOD-12: the single company every line resolved to (pipeline-verified)
    je.EffectiveDate = new Date(draft.EffectiveDate);
    je.EntryType = draft.EntryType;
    je.Status = 'Pending';
    je.Description = draft.Description ?? null;
    if (draft.OrderID) je.OrderID = draft.OrderID;
    je.TransactionGroup = tg;
    if (!(await je.Save())) {
      return this.writeFailure('journal-entry header failed to queue', je.LatestResult?.CompleteMessage);
    }

    for (const line of normalized) {
      const l = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, contextUser);
      l.NewRecord();
      l.JournalEntryID = je.ID;
      l.LineNumber = line.LineNumber;
      l.GLAccountID = line.GLAccountID;
      l.DebitAmount = line.DebitAmount;
      l.CreditAmount = line.CreditAmount;
      l.Description = line.Description;
      if (line.OrderLineID) l.OrderLineID = line.OrderLineID;
      l.TransactionGroup = tg;
      if (!(await l.Save())) {
        return this.writeFailure(`line ${line.LineNumber} failed to queue`, l.LatestResult?.CompleteMessage);
      }
      for (const dim of line.Dimensions) {
        const d = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryLineDimensionEntity>(JELD_ENTITY, contextUser);
        d.NewRecord();
        d.JournalEntryLineID = l.ID;
        d.DimensionID = dim.DimensionID;
        d.DimensionValueID = dim.DimensionValueID;
        d.TransactionGroup = tg;
        if (!(await d.Save())) {
          return this.writeFailure(`line ${line.LineNumber} dimension failed to queue`, d.LatestResult?.CompleteMessage);
        }
      }
    }

    const committed = await tg.Submit();
    if (!committed) {
      // Full rollback happened inside the transaction — surface the first per-entity message.
      const detail = je.LatestResult?.CompleteMessage ?? 'transaction group rolled back';
      return this.writeFailure('atomic write rolled back', detail);
    }

    return {
      Success: true,
      JournalEntryID: je.ID,
      EntryNumber: je.EntryNumber,
      LineCount: normalized.length,
    };
  }

  private writeFailure(stage: string, detail: string | undefined): CreateJournalEntryResult {
    const message = `${stage}: ${detail ?? 'unknown error'}`;
    LogError(`AccountingEngine.CreateJournalEntry: ${message}`);
    return { Success: false, Errors: [{ Code: 'INTERNAL_ERROR', Message: message }] };
  }
}
