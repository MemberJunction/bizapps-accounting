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

const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';

@RegisterClass(BaseEntity, JEL_ENTITY)
export class JournalEntryLineEntityServer extends JournalEntryLineEntity {
  /** Optional reference to the parent JournalEntryEntityServer object in memory. */
  public ParentJournalEntry?: any;

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

  // `Save()` is NOT overridden any more. Persisting the tags — removals first, then inserts with the
  // FK stamped — is what the collection contributes to the entity's save plan, inside the same
  // transaction the parent JE opens. The hand-written version did the same thing in the same order
  // and had to be kept in step with it by hand.

  /**
   * Delete this line's dimension rows first (FK children), then the line itself.
   *
   * Still explicit: `OnRemove: 'delete'` governs a child REMOVED from the collection, which is a
   * different event from the parent being deleted out from under it.
   */
  public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
    if (this.IsSaved) {
      await this.Dimensions.Load();
      for (const dim of [...this.Dimensions.Items]) {
        if (!dim.IsSaved) continue;
        const deleted = await dim.Delete(options);
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
              `Line ${this.LineNumber || ''}: GL Account ${gl.Code || gl.ID} is inactive.`,
              null,
            ),
          );
        }

        if (gl.CompanyID && gl.CompanyID.toLowerCase() !== this.ParentJournalEntry.CompanyID.toLowerCase()) {
          result.Success = false;
          result.Errors.push(
            new ValidationErrorInfo(
              'JournalEntryLineEntityServer.Validate',
              `Line ${this.LineNumber || ''}: GL Account ${gl.Code || gl.ID} belongs to company ${gl.CompanyID}, but parent Journal Entry belongs to company ${this.ParentJournalEntry.CompanyID} (single-company isolation rule D3).`,
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
            `Line ${this.LineNumber || ''}: a dimension tag must carry BOTH DimensionID and DimensionValueID.`,
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
            `Line ${this.LineNumber || ''}: dimension ${dim.DimensionID} is tagged more than once (one value per dimension per line — UQ_JELDimension_Line_Dimension).`,
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
