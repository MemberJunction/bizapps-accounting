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
  type CreateJournalEntriesInput,
  type CreateJournalEntriesResult,
  type CreateJournalEntryResult,
  type JEValidationError,
  type JournalEntryDraft,
  type NormalizedLine,
  type QueueJournalEntriesResult,
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

  /**
   * The SET pipeline ('Accounting.CreateJournalEntries') — Amith's transaction rule extended to a
   * MULTI-JE unit of work (an order Confirm booking one JE per company, MOD-11/12): validate EVERY
   * draft first (set-scoped errors carry DraftIndex), then queue every header + line + dimension of
   * every draft into ONE TransactionGroup and submit once — all entries or none.
   */
  public async CreateJournalEntries(
    input: CreateJournalEntriesInput,
    contextUser: UserInfo,
    provider: IMetadataProvider,
  ): Promise<CreateJournalEntriesResult> {
    try {
      const validated = await this.validateDraftSet(input?.Drafts ?? [], contextUser, provider);
      if ('errors' in validated) return { Success: false, Errors: validated.errors };

      // Queue every draft's rows into ONE TransactionGroup we own; submit once.
      const tg = await provider.CreateTransactionGroup();
      const set = await this.queueDraftSet(validated.drafts, validated.outcomes, tg, contextUser, provider);
      if ('failure' in set) return { Success: false, Errors: [set.failure] };

      const committed = await tg.Submit();
      if (!committed) {
        const detail = set.queued[0]?.je.LatestResult?.CompleteMessage ?? 'transaction group rolled back';
        LogError(`AccountingEngine.CreateJournalEntries: atomic set write rolled back: ${detail}`);
        return { Success: false, Errors: [{ Code: 'INTERNAL_ERROR', Message: `atomic set write rolled back: ${detail}` }] };
      }
      return {
        Success: true,
        Results: set.queued.map(q => ({ Success: true, JournalEntryID: q.je.ID, EntryNumber: q.je.EntryNumber, LineCount: q.lineCount })),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`AccountingEngine.CreateJournalEntries failed: ${msg}`);
      return { Success: false, Errors: [{ Code: 'INTERNAL_ERROR', Message: msg }] };
    }
  }

  /**
   * The QUEUE-ONTO-CALLER'S-TG seam (orders F1.2b — Confirm unit of work): validate the whole draft
   * set exactly as `CreateJournalEntries`, then queue every header + line + dimension onto the
   * CALLER'S TransactionGroup — WITHOUT submitting. The caller (orders `Orders.ConfirmOrder`) also
   * queues the order-row save onto the same `tg` and submits ONCE, so order + JE set commit
   * atomically or not at all. Never throws for logical failures — returns the typed result.
   */
  public async QueueJournalEntries(
    input: CreateJournalEntriesInput,
    tg: Awaited<ReturnType<IMetadataProvider['CreateTransactionGroup']>>,
    contextUser: UserInfo,
    provider: IMetadataProvider,
  ): Promise<QueueJournalEntriesResult> {
    try {
      const validated = await this.validateDraftSet(input?.Drafts ?? [], contextUser, provider);
      if ('errors' in validated) return { Success: false, Errors: validated.errors };

      const set = await this.queueDraftSet(validated.drafts, validated.outcomes, tg, contextUser, provider);
      if ('failure' in set) return { Success: false, Errors: [set.failure] };

      return {
        Success: true,
        Queued: set.queued.map(q => ({ JournalEntryID: q.je.ID, EntryNumber: q.je.EntryNumber, LineCount: q.lineCount })),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`AccountingEngine.QueueJournalEntries failed: ${msg}`);
      return { Success: false, Errors: [{ Code: 'INTERNAL_ERROR', Message: msg }] };
    }
  }

  /**
   * Validate a whole draft SET against the caches (shared by CreateJournalEntries + QueueJournalEntries).
   * Runs the pure pipeline on every draft with ONE bounded staleness refresh; returns the per-draft
   * outcomes, or the draft-indexed error set when any draft is invalid. Nothing is written here.
   */
  private async validateDraftSet(
    drafts: JournalEntryDraft[],
    contextUser: UserInfo,
    provider: IMetadataProvider,
  ): Promise<{ drafts: JournalEntryDraft[]; outcomes: ReturnType<typeof runDraftPipeline>[] } | { errors: JEValidationError[] }> {
    if (drafts.length === 0) {
      return { errors: [{ Code: 'MALFORMED_DRAFT', Message: 'Drafts must contain at least one journal-entry draft.' }] };
    }
    await this.Config(false, contextUser, provider);
    let outcomes = drafts.map(d => runDraftPipeline(d, this.Base.CreatePipelineLookups()));
    const stalenessCodes = new Set(['ACCOUNT_UNKNOWN', 'ACCOUNT_INACTIVE', 'DIMENSION_UNKNOWN', 'DIMENSION_VALUE_UNKNOWN']);
    if (outcomes.some(o => o.errors.some(e => stalenessCodes.has(e.Code)))) {
      await this.Config(true, contextUser, provider);
      outcomes = drafts.map(d => runDraftPipeline(d, this.Base.CreatePipelineLookups()));
    }
    const setErrors: JEValidationError[] = outcomes.flatMap((o, i) => o.errors.map(e => ({ ...e, DraftIndex: i })));
    return setErrors.length > 0 ? { errors: setErrors } : { drafts, outcomes };
  }

  /**
   * Queue every validated draft's rows onto `tg` (shared by CreateJournalEntries + QueueJournalEntries).
   * The caller owns Submit. On a queue failure nothing has committed (the TG is never submitted) — the
   * failure carries its DraftIndex.
   */
  private async queueDraftSet(
    drafts: JournalEntryDraft[],
    outcomes: ReturnType<typeof runDraftPipeline>[],
    tg: Awaited<ReturnType<IMetadataProvider['CreateTransactionGroup']>>,
    contextUser: UserInfo,
    provider: IMetadataProvider,
  ): Promise<{ queued: Array<{ je: mjBizAppsAccountingJournalEntryEntity; lineCount: number }> } | { failure: JEValidationError }> {
    const queued: Array<{ je: mjBizAppsAccountingJournalEntryEntity; lineCount: number }> = [];
    for (let i = 0; i < drafts.length; i++) {
      const q = await this.queueDraftRows(drafts[i], outcomes[i].normalized, outcomes[i].companyID, tg, contextUser, provider);
      if ('failure' in q) return { failure: { ...q.failure, DraftIndex: i } };
      queued.push(q);
    }
    return { queued };
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
    const q = await this.queueDraftRows(draft, normalized, companyID, tg, contextUser, provider);
    if ('failure' in q) {
      return { Success: false, Errors: [q.failure] };
    }
    const committed = await tg.Submit();
    if (!committed) {
      // Full rollback happened inside the transaction — surface the first per-entity message.
      const detail = q.je.LatestResult?.CompleteMessage ?? 'transaction group rolled back';
      return this.writeFailure('atomic write rolled back', detail);
    }
    return {
      Success: true,
      JournalEntryID: q.je.ID,
      EntryNumber: q.je.EntryNumber,
      LineCount: normalized.length,
    };
  }

  /**
   * Queue ONE draft's header + lines + dimensions onto the given TransactionGroup (shared by the
   * single and SET paths — the caller owns Submit). NewRecord mints UUIDs client-side so children
   * reference parents pre-submit; the W2 numbering hook assigns EntryNumber before the queued save.
   */
  private async queueDraftRows(
    draft: JournalEntryDraft,
    normalized: NormalizedLine[],
    companyID: string,
    tg: Awaited<ReturnType<IMetadataProvider['CreateTransactionGroup']>>,
    contextUser: UserInfo,
    provider: IMetadataProvider,
  ): Promise<{ je: mjBizAppsAccountingJournalEntryEntity; lineCount: number } | { failure: JEValidationError }> {
    const fail = (stage: string, detail: string | undefined): { failure: JEValidationError } => {
      const message = `${stage}: ${detail ?? 'unknown error'}`;
      LogError(`AccountingEngine.queueDraftRows: ${message}`);
      return { failure: { Code: 'INTERNAL_ERROR', Message: message } };
    };
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
      return fail('journal-entry header failed to queue', je.LatestResult?.CompleteMessage);
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
      if (line.CounterpartyOrganizationID) l.CounterpartyOrganizationID = line.CounterpartyOrganizationID;
      l.TransactionGroup = tg;
      if (!(await l.Save())) {
        return fail(`line ${line.LineNumber} failed to queue`, l.LatestResult?.CompleteMessage);
      }
      for (const dim of line.Dimensions) {
        const d = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryLineDimensionEntity>(JELD_ENTITY, contextUser);
        d.NewRecord();
        d.JournalEntryLineID = l.ID;
        d.DimensionID = dim.DimensionID;
        d.DimensionValueID = dim.DimensionValueID;
        d.TransactionGroup = tg;
        if (!(await d.Save())) {
          return fail(`line ${line.LineNumber} dimension failed to queue`, d.LatestResult?.CompleteMessage);
        }
      }
    }
    return { je, lineCount: normalized.length };
  }

  private writeFailure(stage: string, detail: string | undefined): CreateJournalEntryResult {
    const message = `${stage}: ${detail ?? 'unknown error'}`;
    LogError(`AccountingEngine.CreateJournalEntry: ${message}`);
    return { Success: false, Errors: [{ Code: 'INTERNAL_ERROR', Message: message }] };
  }
}
