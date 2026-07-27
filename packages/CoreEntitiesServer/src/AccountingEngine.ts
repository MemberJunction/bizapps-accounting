/**
 * AccountingEngine — the server write path (plan §2.2, CH-11; the AIEngine-pattern wrapper over
 * the browser-safe AccountingEngineBase cache).
 *
 * `CreateJournalEntry(draft, user, provider)` runs the pipeline:
 *   stages 1-5 (shape → accounts → dimensions → normalize → balance) are the PURE pipeline from
 *   @mj-biz-apps/accounting-engine-base, fed by the engine caches; stage 6 ASSEMBLES the
 *   encapsulated JournalEntryEntityServer (header + Lines + Dimensions) and persists it with ONE
 *   transactional Save() — the entity owns numbering, validation, and atomicity (phase 2: the
 *   entity is THE creation path; this engine is a thin draft-to-entity adapter over it).
 *   Logical failures NEVER throw (remote-op convention) — inspect `Success` / `Errors`.
 *
 * The DB triggers (50001/50019 balanced-on-lock) remain the un-bypassable floor at lock time.
 *
 * CONNECTS TO:
 *   BASE:    AccountingEngineBase (@mj-biz-apps/accounting-engine-base) — caches + pure pipeline
 *   CALLER:  CreateJournalEntryOperation ('Accounting.CreateJournalEntry') · orders-server (in-process)
 *   ENTITY:  'MJ_BizApps_Accounting: Journal Entries' (+ Lines, Line Dimensions)
 *   DOC:     plans/accounting-engine-plan.md §2.2
 */
import { DatabaseProviderBase, IMetadataProvider, LogError, UserInfo } from '@memberjunction/core';
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
} from '@mj-biz-apps/accounting-engine-base';
import { JournalEntryEntityServer } from './JournalEntryEntityServer.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

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
      const stalenessCodes = new Set(['ENTRY_TYPE_UNKNOWN', 'ENTRY_TYPE_INACTIVE', 'ACCOUNT_UNKNOWN', 'ACCOUNT_INACTIVE', 'DIMENSION_UNKNOWN', 'DIMENSION_VALUE_UNKNOWN']);
      if (outcome.errors.some(e => stalenessCodes.has(e.Code))) {
        await this.Config(true, contextUser, provider);
        outcome = runDraftPipeline(draft, this.Base.CreatePipelineLookups());
      }

      if (outcome.errors.length > 0) {
        return { Success: false, Errors: outcome.errors };
      }

      // Stage 6 — assemble the encapsulated entity; ONE transactional Save() persists everything.
      return await this.writeJournalEntry(draft, outcome.normalized, contextUser, provider);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`AccountingEngine.CreateJournalEntry failed: ${msg}`);
      return { Success: false, Errors: [{ Code: 'INTERNAL_ERROR', Message: msg }] };
    }
  }

  /**
   * The SET pipeline ('Accounting.CreateJournalEntries') — a MULTI-JE unit of work: an order
   * Confirm books one JE per order line and submits ALL of its drafts here. Every draft
   * validates first (draft-scoped errors carry DraftIndex; nothing writes on any failure),
   * then every JE writes inside ONE provider transaction — the encapsulated entity Saves nest
   * as savepoints — so it's all entries or none. A caller composing a larger unit of work
   * (order row + JE set) opens a transaction on ITS provider first; this one nests inside it.
   */
  public async CreateJournalEntries(
    input: CreateJournalEntriesInput,
    contextUser: UserInfo,
    provider: IMetadataProvider,
  ): Promise<CreateJournalEntriesResult> {
    try {
      const drafts = input?.Drafts ?? [];
      if (drafts.length === 0) {
        return { Success: false, Errors: [{ Code: 'MALFORMED_DRAFT', Message: 'Drafts must contain at least one journal-entry draft.' }] };
      }

      await this.Config(false, contextUser, provider);
      let outcomes = drafts.map(d => runDraftPipeline(d, this.Base.CreatePipelineLookups()));
      // One bounded staleness refresh for the whole set (same rationale as the single op).
      const stalenessCodes = new Set(['ENTRY_TYPE_UNKNOWN', 'ENTRY_TYPE_INACTIVE', 'ACCOUNT_UNKNOWN', 'ACCOUNT_INACTIVE', 'DIMENSION_UNKNOWN', 'DIMENSION_VALUE_UNKNOWN']);
      if (outcomes.some(o => o.errors.some(e => stalenessCodes.has(e.Code)))) {
        await this.Config(true, contextUser, provider);
        outcomes = drafts.map(d => runDraftPipeline(d, this.Base.CreatePipelineLookups()));
      }
      const setErrors: JEValidationError[] = outcomes.flatMap((o, i) => o.errors.map(e => ({ ...e, DraftIndex: i })));
      if (setErrors.length > 0) {
        return { Success: false, Errors: setErrors };
      }

      // All drafts valid — write them all inside ONE outer transaction (entity Saves nest).
      const dbProvider = provider as unknown as DatabaseProviderBase;
      await dbProvider.BeginTransaction();
      try {
        const results: CreateJournalEntryResult[] = [];
        for (let i = 0; i < drafts.length; i++) {
          const result = await this.writeJournalEntry(drafts[i], outcomes[i].normalized, contextUser, provider);
          if (!result.Success) {
            await dbProvider.RollbackTransaction();
            return {
              Success: false,
              Errors: (result.Errors ?? [{ Code: 'INTERNAL_ERROR', Message: 'draft write failed' }]).map(e => ({ ...e, DraftIndex: i })),
            };
          }
          results.push(result);
        }
        await dbProvider.CommitTransaction();
        return { Success: true, Results: results };
      } catch (e) {
        try { await dbProvider.RollbackTransaction(); } catch { /* rollback best-effort */ }
        throw e;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`AccountingEngine.CreateJournalEntries failed: ${msg}`);
      return { Success: false, Errors: [{ Code: 'INTERNAL_ERROR', Message: msg }] };
    }
  }

  // ─── stage 6 ───────────────────────────────────────────────────────────────

  private async writeJournalEntry(
    draft: JournalEntryDraft,
    normalized: NormalizedLine[],
    contextUser: UserInfo,
    provider: IMetadataProvider,
  ): Promise<CreateJournalEntryResult> {
    // Single-company JE (plan D3): the header company is the one company every line's
    // GLAccount belongs to (trigger 50019 enforces the match at the DB).
    const companies = [...new Set(normalized.map(l => l.CompanyID.toLowerCase()))];
    if (companies.length !== 1 || !companies[0]) {
      return this.writeFailure(`journal entries are single-company (plan D3); draft lines resolve to ${companies.length} companies`, undefined);
    }

    // Assemble the encapsulated entity: header + Lines + Dimensions in memory, then ONE
    // transactional Save() — the entity owns numbering (W2 hook), validation, and atomicity.
    // Pipeline stage 1b already proved the code resolves; this guard covers a cache refresh
    // between validation and write (defensive — never expected on the same call).
    const entryType = this.Base.JournalEntryTypeByCode(draft.EntryType);
    if (!entryType) {
      return this.writeFailure(`journal-entry type '${draft.EntryType}' vanished between validation and write`, undefined);
    }

    const je = await provider.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, contextUser);
    je.NewRecord();
    je.CompanyID = normalized[0].CompanyID;
    je.EffectiveDate = new Date(draft.EffectiveDate);
    je.EntryTypeID = entryType.ID;
    je.Status = 'Pending';
    je.Description = draft.Description ?? null;
    // Polymorphic origin pair (plan D25) — both-or-neither (CK_JournalEntry_LinkedPair).
    if (draft.LinkedEntityID && draft.LinkedRecordID) {
      je.LinkedEntityID = draft.LinkedEntityID;
      je.LinkedRecordID = draft.LinkedRecordID;
    }

    // Pipeline stage 4 already ordered/merged the lines; CreateLine assigns the same 1..n numbers.
    for (const line of normalized) {
      const l = await je.CreateLine(contextUser);
      l.GLAccountID = line.GLAccountID;
      l.DebitAmount = line.DebitAmount;
      l.CreditAmount = line.CreditAmount;
      l.Description = line.Description;
      for (const dim of line.Dimensions) {
        const d = await l.CreateDimension(contextUser);
        d.DimensionID = dim.DimensionID;
        d.DimensionValueID = dim.DimensionValueID;
      }
    }

    if (!(await je.Save())) {
      return this.writeFailure('journal entry save failed (rolled back)', je.LatestResult?.CompleteMessage);
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
