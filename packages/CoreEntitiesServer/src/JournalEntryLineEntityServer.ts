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
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingJournalEntryLineDimensionEntity,
} from '@mj-biz-apps/accounting-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';

const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';

@RegisterClass(BaseEntity, JEL_ENTITY)
export class JournalEntryLineEntityServer extends mjBizAppsAccountingJournalEntryLineEntity {
  /** Optional reference to the parent JournalEntryEntityServer object in memory. */
  public ParentJournalEntry?: any;

  private _dimensions: mjBizAppsAccountingJournalEntryLineDimensionEntity[] = [];
  private _deletedDimensions: mjBizAppsAccountingJournalEntryLineDimensionEntity[] = [];

  /** Convenience getter for line net amount (Debit minus Credit). */
  get NetAmount(): number {
    const dr = this.DebitAmount ?? 0;
    const cr = this.CreditAmount ?? 0;
    return dr - cr;
  }

  // ─── Dimensions collection ──────────────────────────────────────────────────

  /** The JournalEntryLineDimension children attached to this line. */
  get Dimensions(): mjBizAppsAccountingJournalEntryLineDimensionEntity[] {
    return this._dimensions;
  }

  /** Appends a dimension tag to this line (its FK is stamped at save when the line is new). */
  public AddDimension(dimension: mjBizAppsAccountingJournalEntryLineDimensionEntity): void {
    if (!dimension) return;
    if (this.ID) {
      dimension.JournalEntryLineID = this.ID;
    }
    this._dimensions.push(dimension);
  }

  /** Removes a dimension by object instance or array index. Tracks saved rows for deletion on Save(). */
  public RemoveDimension(dimensionOrIndex: mjBizAppsAccountingJournalEntryLineDimensionEntity | number): void {
    let removed: mjBizAppsAccountingJournalEntryLineDimensionEntity | null = null;
    if (typeof dimensionOrIndex === 'number') {
      if (dimensionOrIndex >= 0 && dimensionOrIndex < this._dimensions.length) {
        removed = this._dimensions.splice(dimensionOrIndex, 1)[0];
      }
    } else {
      const idx = this._dimensions.indexOf(dimensionOrIndex);
      if (idx >= 0) {
        removed = this._dimensions.splice(idx, 1)[0];
      }
    }
    if (removed && removed.IsSaved) {
      this._deletedDimensions.push(removed);
    }
  }

  /** Instantiates a new dimension tag, attaches it to this line, and returns it. */
  public async CreateDimension(user?: UserInfo): Promise<mjBizAppsAccountingJournalEntryLineDimensionEntity> {
    const provider = this.ProviderToUse as unknown as IMetadataProvider;
    const dimension = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryLineDimensionEntity>(
      JELD_ENTITY,
      user ?? this.ContextCurrentUser,
    );
    dimension.NewRecord();
    dimension.JournalEntryLineID = this.ID;
    this.AddDimension(dimension);
    return dimension;
  }

  /** Loads this line's dimension tags from the database if saved. */
  public async LoadDimensions(user?: UserInfo): Promise<mjBizAppsAccountingJournalEntryLineDimensionEntity[]> {
    if (!this.IsSaved || !this.ID) {
      return this._dimensions;
    }
    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<mjBizAppsAccountingJournalEntryLineDimensionEntity>(
      {
        EntityName: JELD_ENTITY,
        ExtraFilter: `JournalEntryLineID='${this.ID}'`,
        ResultType: 'entity_object',
      },
      user ?? this.ContextCurrentUser,
    );
    // Loud on failure (loads throw; saves return boolean): a silent empty here would make a
    // tagged line look untagged to reversals, dispatch, and the UI.
    if (!res.Success) {
      throw new Error(`JournalEntryLineEntityServer.LoadDimensions: failed to load dimension tags for line ${this.ID}: ${res.ErrorMessage ?? 'unknown error'}`);
    }
    this._dimensions = res.Results ?? [];
    this._deletedDimensions = [];
    return this._dimensions;
  }

  /**
   * Used by JournalEntryEntityServer.LoadLines to distribute ONE bulk dimension query across
   * its lines instead of one query per line. Replaces the in-memory collection wholesale.
   */
  public SetLoadedDimensions(dimensions: mjBizAppsAccountingJournalEntryLineDimensionEntity[]): void {
    this._dimensions = dimensions;
    this._deletedDimensions = [];
  }

  // ─── Load / Save / Delete overrides ─────────────────────────────────────────

  public override async Load(ID: string, EntityRelationshipsToLoad?: string[]): Promise<boolean> {
    const ok = await super.Load(ID, EntityRelationshipsToLoad);
    if (ok) {
      await this.LoadDimensions();
    }
    return ok;
  }

  /**
   * Persist the line, then its dimension children (removals first). When called from
   * JournalEntryEntityServer.Save() this runs inside the parent's transaction, so the
   * whole JE — header, lines, dimensions — commits or rolls back as one.
   */
  public override async Save(options?: EntitySaveOptions): Promise<boolean> {
    const savedLine = await super.Save(options);
    if (!savedLine) return false;

    for (const dim of this._deletedDimensions) {
      const deleted = await dim.Delete();
      if (!deleted) {
        LogError(`JournalEntryLineEntityServer.Save: failed to delete dimension ${dim.ID}: ${dim.LatestResult?.CompleteMessage ?? 'unknown error'}`);
        return false;
      }
    }
    this._deletedDimensions = [];

    for (const dim of this._dimensions) {
      dim.JournalEntryLineID = this.ID;
      const savedDim = await dim.Save(options);
      if (!savedDim) {
        LogError(`JournalEntryLineEntityServer.Save: failed to save dimension tag: ${dim.LatestResult?.CompleteMessage ?? 'unknown error'}`);
        return false;
      }
    }
    return true;
  }

  /** Delete this line's dimension rows first (FK children), then the line itself. */
  public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
    if (this.IsSaved) {
      await this.LoadDimensions();
      for (const dim of this._dimensions) {
        if (!dim.IsSaved) continue;
        const deleted = await dim.Delete(options);
        if (!deleted) {
          LogError(`JournalEntryLineEntityServer.Delete: failed to delete dimension ${dim.ID} before line delete: ${dim.LatestResult?.CompleteMessage ?? 'unknown error'}`);
          return false;
        }
      }
      this._dimensions = [];
    }
    return super.Delete(options);
  }
  
  // ─── Validation ─────────────────────────────────────────────────────────────

  /** Validate line-level fields (either Debit XOR Credit set, non-negative values, company & active status). */
  public override Validate() {
    const result = super.Validate();
    const dr = this.DebitAmount;
    const cr = this.CreditAmount;

    const hasDr = dr !== null && dr !== undefined && dr > 0;
    const hasCr = cr !== null && cr !== undefined && cr > 0;

    if (hasDr && hasCr) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryLineEntityServer.Validate',
          `Line ${this.LineNumber || ''}: Cannot specify both DebitAmount (${dr}) and CreditAmount (${cr}) on a single line.`,
          null,
        ),
      );
    }

    if (!hasDr && !hasCr && (dr === null || dr === undefined || dr === 0) && (cr === null || cr === undefined || cr === 0)) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryLineEntityServer.Validate',
          `Line ${this.LineNumber || ''}: Must specify either a DebitAmount or CreditAmount.`,
          null,
        ),
      );
    }

    if (dr !== null && dr !== undefined && dr < 0) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryLineEntityServer.Validate',
          `Line ${this.LineNumber || ''}: DebitAmount cannot be negative (${dr}).`,
          null,
        ),
      );
    }

    if (cr !== null && cr !== undefined && cr < 0) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryLineEntityServer.Validate',
          `Line ${this.LineNumber || ''}: CreditAmount cannot be negative (${cr}).`,
          null,
        ),
      );
    }

    if (!this.GLAccountID) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryLineEntityServer.Validate',
          `Line ${this.LineNumber || ''}: GLAccountID is required.`,
          null,
        ),
      );
    }

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
    for (const dim of this._dimensions) {
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
