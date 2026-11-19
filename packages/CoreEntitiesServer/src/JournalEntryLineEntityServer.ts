/**
 * Server-side subclass of JournalEntryLine — represents individual debit/credit lines
 * of a Journal Entry with dirty state, validation, parent pointer support, and an
 * encapsulated Dimensions collection (JournalEntryLineDimension children) so a line's
 * analytical tags persist with the line itself:
 *
 *   - `line.Dimensions` holds 0+ JournalEntryLineDimension entities.
 *   - AddDimension / RemoveDimension / CreateDimension manage the collection in memory;
 *     Save() persists them (and processes removals) right after the line row persists —
 *     inside the parent JournalEntryEntityServer.Save() transaction when saved through it.
 *   - Delete() removes the line's dimension rows first (FK children), then the line.
 *   - Save() and Delete() written on their own (not through the parent entry) are refused for a
 *     Pending manual entry under approval, because only the entry's Save re-routes it (golive #353).
 *     A tag written on its own is refused the same way by JournalEntryLineDimensionEntityServer; the
 *     tags this line saves or deletes are marked as going through it.
 *   - Validate() checks the dimension pairs: both IDs present, one value per dimension
 *     (UQ_JELDimension_Line_Dimension), and — when the AccountingEngineBase cache is
 *     loaded — that the value belongs to the dimension it tags.
 */
import {
  BaseEntity,
  EntityDeleteOptions,
  EntitySaveOptions,
  IMetadataProvider,
  IRunViewProvider,
  LogError,
  UserInfo,
  ValidationErrorInfo,
  ValidationErrorType,
  ValidationResult,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  JournalEntryEntity,
  JournalEntryLineEntity,
  mjBizAppsAccountingJournalEntryLineDimensionEntity,
} from '@mj-biz-apps/accounting-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';

import { WithDimensionsSavedThroughLine } from './JournalEntryLineDimensionEntityServer.js';
import { ManualJournalEntryApprovalService } from './ManualJournalEntryApproval.js';

const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';

/** Maximum allowed discrepancy between `OriginalAmount × ExchangeRateUsed` and functional amount. */
export const FX_AMOUNT_TOLERANCE = 0.01;
/** Relative band around the entry date's `CurrencySpotRate` outside which a warning is raised. */
export const FX_SPOT_RATE_WARNING_BAND = 0.05;

@RegisterClass(BaseEntity, JEL_ENTITY)
export class JournalEntryLineEntityServer extends JournalEntryLineEntity {
  /** Optional reference to the parent JournalEntryEntityServer object in memory. */
  public ParentJournalEntry?: JournalEntryEntity;

  /**
   * Set by JournalEntryEntityServer while it saves or deletes this line as part of the entry, so the
   * manual-entry approval guard below lets the write through: the entry's own Save re-routes its
   * approval (golive #353). A line written on its own leaves this false.
   */
  public SavingThroughJournalEntry = false;

  // `Dimensions` is a RelatedRecordCollection on the GENERATED class now, declared in
  // metadata/entity-relationships. It replaces `_dimensions` + `_deletedDimensions` and the
  // Add/Remove/Create/Load/SetLoaded methods that reimplemented, by hand and server-only, exactly
  // what the collection does: tracked removals, FK stamping, batched hydration, save ordering.

  /** Convenience getter for line net amount (Debit minus Credit). */
  get NetAmount(): number {
    const dr = this.DebitAmount ?? 0;
    const cr = this.CreditAmount ?? 0;
    return dr - cr;
  }

  // ─── Dimensions ─────────────────────────────────────────────────────────────
  //
  // Thin wrappers over the collection, kept because four call sites across two engines use them and
  // renaming those is churn with no meaning. Each one is now a single delegation rather than its own
  // copy of collection bookkeeping.

  /** Append a dimension tag. The FK is stamped by the collection, at save, when the line has an ID. */
  public AddDimension(dimension: mjBizAppsAccountingJournalEntryLineDimensionEntity): void {
    this.Dimensions.Add(dimension);
  }

  /** Remove a tag by instance or index; a persisted one is queued for deletion. */
  public RemoveDimension(dimensionOrIndex: mjBizAppsAccountingJournalEntryLineDimensionEntity | number): void {
    this.Dimensions.Remove(dimensionOrIndex);
  }

  /** A new tag, already attached to this line. */
  public async CreateDimension(_user?: UserInfo): Promise<mjBizAppsAccountingJournalEntryLineDimensionEntity> {
    return this.Dimensions.Create();
  }

  /**
   * Load this line's tags.
   *
   * Throws on failure, as it always did: a silent empty here makes a tagged line look untagged to
   * reversals, dispatch and the UI — and the collection throws for the same reason.
   */
  public async LoadDimensions(_user?: UserInfo): Promise<readonly mjBizAppsAccountingJournalEntryLineDimensionEntity[]> {
    await this.Dimensions.Load();
    return this.Dimensions.Items;
  }

  /**
   * Used by `JournalEntryEntityServer.LoadLines` to distribute ONE bulk dimension query across its
   * lines instead of one query per line.
   */
  public SetLoadedDimensions(dimensions: mjBizAppsAccountingJournalEntryLineDimensionEntity[]): void {
    this.Dimensions.SetLoadedItems(dimensions);
  }

  // ─── Load / Save / Delete overrides ─────────────────────────────────────────

  public override async Load(ID: string, EntityRelationshipsToLoad?: string[]): Promise<boolean> {
    const ok = await super.Load(ID, EntityRelationshipsToLoad);
    if (ok) {
      // `Load: 'explicit'`, so the tags still have to be asked for. Asked for HERE because every
      // caller that loads a line to inspect it wants them, and a line whose tags are silently absent
      // reads as untagged to intercompany resolution.
      await this.Dimensions.Load();
    }
    return ok;
  }

  // Persisting the tags — removals first, then inserts with the FK stamped — is what the collection
  // contributes to the entity's save plan, inside the same transaction the parent JE opens. The
  // hand-written version did the same thing in the same order and had to be kept in step with it by
  // hand. Save() is overridden only for the manual-entry approval guard.

  /**
   * Refuses a line saved ON ITS OWN that changes the account, amounts or tags of a Pending manual
   * entry under approval (golive #353): only the entry's Save raises its approval again.
   */
  public override async Save(options?: EntitySaveOptions): Promise<boolean> {
    if (this.ChangesWhatApprovalCovers()) await this.assertStandaloneChangeAllowed();
    // The tags this save writes are covered by the check above (or by the entry's own routing).
    return WithDimensionsSavedThroughLine([...this.Dimensions.Items, ...this.Dimensions.Removed], () => super.Save(options));
  }

  /**
   * True for a line written on its own that adds, re-accounts, re-amounts or re-tags a line — the
   * saves that must pass the standalone approval guard. Public so the guard's wiring is testable.
   */
  public ChangesWhatApprovalCovers(): boolean {
    if (this.SavingThroughJournalEntry || !this.JournalEntryID) return false;
    return !this.IsSaved ||
      ['GLAccountID', 'DebitAmount', 'CreditAmount'].some(f => this.GetFieldByName(f)?.Dirty) ||
      this.Dimensions.Dirty;
  }

  private async assertStandaloneChangeAllowed(): Promise<void> {
    const service = new ManualJournalEntryApprovalService(this.ProviderToUse as unknown as IMetadataProvider);
    await service.AssertStandaloneLineChangeAllowed(this.JournalEntryID, this.ContextCurrentUser);
  }

  /**
   * Delete this line's dimension rows first (FK children), then the line itself.
   *
   * Still explicit: `OnRemove: 'delete'` governs a child REMOVED from the collection, which is a
   * different event from the parent being deleted out from under it.
   */
  public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
    // A line deleted on its own changes what an approval covers, as an edit does (golive #353).
    if (this.IsSaved && !this.SavingThroughJournalEntry && this.JournalEntryID) await this.assertStandaloneChangeAllowed();
    if (this.IsSaved) {
      await this.Dimensions.Load();
      for (const dim of [...this.Dimensions.Items]) {
        if (!dim.IsSaved) continue;
        const deleted = await WithDimensionsSavedThroughLine([dim], () => dim.Delete(options));
        if (!deleted) {
          LogError(`JournalEntryLineEntityServer.Delete: failed to delete dimension ${dim.ID} before line delete: ${dim.LatestResult?.CompleteMessage ?? 'unknown error'}`);
          return false;
        }
      }
      this.Dimensions.Clear();
    }
    return super.Delete(options);
  }
  
  // ─── Validation ─────────────────────────────────────────────────────────────

  /**
   * The rules that need REFERENCE DATA. Everything decidable from the line alone — an account is
   * required, one side only, neither side negative — moved to `JournalEntryLineEntity` so the
   * browser refuses those before a round trip, and `super.Validate()` runs them here too.
   */
  public override Validate() {
    const result = super.Validate();

    this.ValidateOriginalCurrency(result);
    this.ValidateDimensions(result);

    // Validation via AccountingEngineBase cache: verify GL Account active status & company alignment
    if (this.GLAccountID && this.ParentJournalEntry?.CompanyID) {
      const gl = AccountingEngineBase.Instance.GLAccountByID(this.GLAccountID);
      if (gl) {
        if (!gl.IsActive) {
          result.Success = false;
          result.Errors.push(
            new ValidationErrorInfo(
              'JournalEntryLineEntityServer.Validate',
              `Line ${this.LineNumber || ''}: GL account ${gl.Code || gl.ID} is inactive. Pick an active account.`,
              null,
            ),
          );
        }

        if (gl.CompanyID && gl.CompanyID.toLowerCase() !== this.ParentJournalEntry.CompanyID.toLowerCase()) {
          result.Success = false;
          result.Errors.push(
            new ValidationErrorInfo(
              'JournalEntryLineEntityServer.Validate',
              `Line ${this.LineNumber || ''}: GL account ${gl.Code || gl.ID} belongs to company ${gl.CompanyID}, but this journal entry belongs to company ${this.ParentJournalEntry.CompanyID}. Every line must use an account of the entry's company.`,
              null,
            ),
          );
        }
      }
    }

    return result;
  }

  /**
   * Dimension-pair rules: both IDs present, one value per dimension on a line
   * (UQ_JELDimension_Line_Dimension), and — when the AccountingEngineBase cache has
   * data — the value must belong to the dimension it tags.
   */
  private ValidateDimensions(result: ValidationResult): void {
    const seenDimensionIds = new Set<string>();
    for (const dim of this.Dimensions.Items) {
      if (!dim.DimensionID || !dim.DimensionValueID) {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'JournalEntryLineEntityServer.Validate',
            `Line ${this.LineNumber || ''}: each dimension on a line needs both a dimension and a value.`,
            null,
          ),
        );
        continue;
      }

      const key = dim.DimensionID.toLowerCase();
      if (seenDimensionIds.has(key)) {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'JournalEntryLineEntityServer.Validate',
            `Line ${this.LineNumber || ''}: dimension ${dim.DimensionID} is used more than once. A line takes one value per dimension.`,
            null,
          ),
        );
      }
      seenDimensionIds.add(key);

      const values = AccountingEngineBase.Instance.DimensionValues;
      if (values.length > 0) {
        const value = values.find(v => v.ID?.toLowerCase() === dim.DimensionValueID?.toLowerCase());
        if (value && value.DimensionID?.toLowerCase() !== key) {
          result.Success = false;
          result.Errors.push(
            new ValidationErrorInfo(
              'JournalEntryLineEntityServer.Validate',
              `Line ${this.LineNumber || ''}: dimension value ${dim.DimensionValueID} does not belong to dimension ${dim.DimensionID}.`,
              null,
            ),
          );
        }
      }
    }
  }

  /**
   * Multi-currency line invariants:
   *   1. All four FX columns (`OriginalCurrencyCode`, `OriginalDebitAmount`, `OriginalCreditAmount`,
   *      `ExchangeRateUsed`) are either all absent, or together form a complete single-sided FX tuple
   *      matching the line's functional side (Debit vs Credit).
   *   2. `ExchangeRateUsed` and the populated original amount must be strictly positive (`> 0`).
   *   3. `|OriginalAmount × ExchangeRateUsed − FunctionalAmount|` must not exceed `FX_AMOUNT_TOLERANCE`
   *      (0.01 functional units per line).
   *   4. When `CurrencySpotRate` for the entry's date and currency pair is loaded in cache and
   *      `ExchangeRateUsed` deviates by more than `FX_SPOT_RATE_WARNING_BAND` (5%), record a warning.
   */
  private ValidateOriginalCurrency(result: ValidationResult): void {
    const code = this.OriginalCurrencyCode?.trim() || null;
    const origDr = this.OriginalDebitAmount;
    const origCr = this.OriginalCreditAmount;
    const rate = this.ExchangeRateUsed;

    const anyFxSet = code !== null || origDr !== null || origCr !== null || rate !== null;
    if (!anyFxSet) return;

    const fail = (source: string, message: string, value: unknown = null) => {
      result.Success = false;
      result.Errors.push(new ValidationErrorInfo(source, message, value, ValidationErrorType.Failure));
    };

    if (!code) {
      fail(
        'OriginalCurrencyCode',
        `Line ${this.LineNumber || ''}: OriginalCurrencyCode is required when original-currency amounts or an exchange rate are set.`,
        this.OriginalCurrencyCode,
      );
    }

    if (origDr === null && origCr === null) {
      fail(
        'OriginalDebitAmount',
        `Line ${this.LineNumber || ''}: an original debit or credit amount is required when OriginalCurrencyCode or ExchangeRateUsed is set.`,
        null,
      );
      return;
    }

    if (origDr !== null && origDr <= 0) {
      fail(
        'OriginalDebitAmount',
        `Line ${this.LineNumber || ''}: OriginalDebitAmount must be greater than zero (${origDr}).`,
        origDr,
      );
    }

    if (origCr !== null && origCr <= 0) {
      fail(
        'OriginalCreditAmount',
        `Line ${this.LineNumber || ''}: OriginalCreditAmount must be greater than zero (${origCr}).`,
        origCr,
      );
    }

    if (rate === null || rate <= 0) {
      fail(
        'ExchangeRateUsed',
        `Line ${this.LineNumber || ''}: ExchangeRateUsed must be greater than zero when original-currency amounts are set.`,
        rate,
      );
      return;
    }

    if (origDr !== null && origDr > 0 && this.DebitAmount !== null && this.DebitAmount > 0) {
      const converted = origDr * rate;
      if (Math.abs(converted - this.DebitAmount) > FX_AMOUNT_TOLERANCE + 1e-9) {
        fail(
          'DebitAmount',
          `Line ${this.LineNumber || ''}: DebitAmount (${this.DebitAmount.toFixed(2)}) differs from OriginalDebitAmount (${origDr.toFixed(2)}) × ExchangeRateUsed (${rate}) = ${converted.toFixed(2)} by more than ${FX_AMOUNT_TOLERANCE.toFixed(2)}.`,
          this.DebitAmount,
        );
      }
    }

    if (origCr !== null && origCr > 0 && this.CreditAmount !== null && this.CreditAmount > 0) {
      const converted = origCr * rate;
      if (Math.abs(converted - this.CreditAmount) > FX_AMOUNT_TOLERANCE + 1e-9) {
        fail(
          'CreditAmount',
          `Line ${this.LineNumber || ''}: CreditAmount (${this.CreditAmount.toFixed(2)}) differs from OriginalCreditAmount (${origCr.toFixed(2)}) × ExchangeRateUsed (${rate}) = ${converted.toFixed(2)} by more than ${FX_AMOUNT_TOLERANCE.toFixed(2)}.`,
          this.CreditAmount,
        );
      }
    }

    if (code) {
      this.warnIfOutsideSpotRateBand(result, code, rate);
    }
  }

  private warnIfOutsideSpotRateBand(result: ValidationResult, fromCurrencyCode: string, rate: number): void {
    const effectiveDay = ToCalendarDay(this.ParentJournalEntry?.EffectiveDate ?? null);
    if (!effectiveDay) return;
    const companyId = this.ParentJournalEntry?.CompanyID?.toLowerCase();
    const profile = companyId
      ? AccountingEngineBase.Instance.CompanyProfiles.find(p => p.ID?.toLowerCase() === companyId)
      : undefined;
    const toCurrencyCode = (
      profile?.FunctionalCurrencyCode ??
      (this.GLAccountID ? AccountingEngineBase.Instance.GLAccountByID(this.GLAccountID)?.CurrencyCode : null)
    )?.trim().toUpperCase();
    if (!toCurrencyCode) return;

    const fromKey = fromCurrencyCode.toUpperCase();
    const spot = AccountingEngineBase.Instance.CurrencySpotRates.find(
      s =>
        s.IsActive !== false &&
        s.FromCurrencyCode?.trim().toUpperCase() === fromKey &&
        s.ToCurrencyCode?.trim().toUpperCase() === toCurrencyCode &&
        ToCalendarDay(s.RateDate) === effectiveDay,
    );
    if (!spot || !spot.Rate || spot.Rate <= 0) return;

    const deviation = Math.abs(rate - spot.Rate) / spot.Rate;
    if (deviation > FX_SPOT_RATE_WARNING_BAND) {
      result.Errors.push(
        new ValidationErrorInfo(
          'ExchangeRateUsed',
          `Line ${this.LineNumber || ''}: ExchangeRateUsed (${rate}) differs from the ${effectiveDay} ${fromKey}→${toCurrencyCode} spot rate (${spot.Rate}) by ${(deviation * 100).toFixed(1)}% (more than ${(FX_SPOT_RATE_WARNING_BAND * 100).toFixed(0)}%).`,
          rate,
          ValidationErrorType.Warning,
        ),
      );
    }
  }
}
