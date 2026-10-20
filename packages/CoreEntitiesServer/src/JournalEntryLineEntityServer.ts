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
  ValidationResult,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  JournalEntryLineEntity,
  mjBizAppsAccountingJournalEntryLineDimensionEntity,
} from '@mj-biz-apps/accounting-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';

import { WithDimensionsSavedThroughLine } from './JournalEntryLineDimensionEntityServer.js';
import { ManualJournalEntryApprovalService } from './ManualJournalEntryApproval.js';

const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';

@RegisterClass(BaseEntity, JEL_ENTITY)
export class JournalEntryLineEntityServer extends JournalEntryLineEntity {
  /** Optional reference to the parent JournalEntryEntityServer object in memory. */
  public ParentJournalEntry?: any;

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
}
