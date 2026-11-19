/**
 * Server-side subclass of JournalEntryType — the SYSTEM-ROW LOCK (issue #24, BA-D29).
 *
 * The type table is deliberately open (consuming apps add their own rows), but the rows
 * accounting's own machinery keys on must not shift underneath it: triggers 50012/50023, the
 * batch pipeline, and GenerateReversal resolve by Code / IsJournalEntryBatchSummary. So IsSystem rows are
 * identity-locked at the entity layer (same pattern as GLAccountEntityServer's identity lock):
 *
 *   - An IsSystem row's Code / IsSystem / IsJournalEntryBatchSummary are IMMUTABLE (Name/Description/
 *     IsActive stay editable — deactivating a system type is a legitimate configuration act).
 *   - An IsSystem row cannot be DELETED.
 *   - No row may GAIN IsSystem=1 after creation (system rows are seeded, not promoted).
 *
 * Consumer-owned rows (IsSystem=0) stay editable while unused, and once any JournalEntry
 * references a row (`EntryTypeID = ID`), its `Code` cannot change and it cannot be deleted
 * (deactivate it with `IsActive = false` instead).
 */
import { BaseEntity, EntityDeleteOptions, IRunViewProvider, ValidationResult, ValidationErrorInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingJournalEntryTypeEntity } from '@mj-biz-apps/accounting-entities';
import { isSqlGuid, sqlGuidLiteral } from './SqlGuards.js';

const JET_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Types';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

@RegisterClass(BaseEntity, JET_ENTITY)
export class JournalEntryTypeEntityServer extends mjBizAppsAccountingJournalEntryTypeEntity {
  /** BaseEntity skips ValidateAsync by default — opt in so the referenced-by-entries Code lock runs on Save. */
  public override get DefaultSkipAsyncValidation(): boolean {
    return false;
  }

  public override Validate(): ValidationResult {
    const result = super.Validate();

    if (this.IsSaved) {
      const isSystemField = this.Fields.find(f => f.Name === 'IsSystem');
      // The STORED value: OldValue when the field is being changed, current value otherwise.
      const wasSystem = isSystemField?.Dirty ? isSystemField.OldValue === true : this.IsSystem === true;
      if (wasSystem) {
        for (const name of ['Code', 'IsSystem', 'IsJournalEntryBatchSummary'] as const) {
          const field = this.Fields.find(f => f.Name === name);
          if (field?.Dirty) {
            result.Success = false;
            result.Errors.push(
              new ValidationErrorInfo(
                'JournalEntryTypeEntityServer.Validate',
                `Journal entry type '${String(field.OldValue ?? this.Code)}' is a system type: its ${name} cannot change, because Accounting's database rules and batching depend on it.`,
                null,
              ),
            );
          }
        }
      } else if (this.Fields.find(f => f.Name === 'IsSystem')?.Dirty && this.IsSystem) {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'JournalEntryTypeEntityServer.Validate',
            'A journal entry type cannot be promoted to a system type after it is created; system types are set up only by Accounting.',
            null,
          ),
        );
      }
    }

    return result;
  }

  public override async ValidateAsync(): Promise<ValidationResult> {
    const result = await super.ValidateAsync();
    if (!this.IsSaved || !this.ID) return result;

    const codeField = this.Fields.find(f => f.Name === 'Code');
    if (!codeField?.Dirty) return result;

    const isSystemField = this.Fields.find(f => f.Name === 'IsSystem');
    const wasSystem = isSystemField?.Dirty ? isSystemField.OldValue === true : this.IsSystem === true;
    if (wasSystem) return result; // already refused by Validate()

    const oldCode = String(codeField.OldValue ?? this.Code);
    const count = await this.referencingJournalEntryCount(oldCode);
    if (count > 0) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'Code',
          `Journal entry type '${oldCode}' is used by ${count} journal entr${count === 1 ? 'y' : 'ies'}, so its Code cannot change. Mark it inactive and create a new type if a different code is needed.`,
          this.Code,
        ),
      );
    }

    return result;
  }

  public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
    const isSystemField = this.Fields.find(f => f.Name === 'IsSystem');
    const isSystem = isSystemField?.Dirty ? isSystemField.OldValue === true || isSystemField.Value === true : isSystemField?.Value === true;
    const code = String(this.Fields.find(f => f.Name === 'Code')?.OldValue ?? this.Fields.find(f => f.Name === 'Code')?.Value ?? this.ID);
    if (isSystem) {
      throw new Error(
        `Journal entry type '${code}' is a system type and cannot be deleted, because Accounting's database rules and batching depend on it.`,
      );
    }
    if (this.IsSaved && this.ID) {
      const count = await this.referencingJournalEntryCount(code);
      if (count > 0) {
        throw new Error(
          `Journal entry type '${code}' is used by ${count} journal entr${count === 1 ? 'y' : 'ies'} and cannot be deleted. Mark it inactive (IsActive = false) instead.`,
        );
      }
    }
    return super.Delete(options);
  }

  private async referencingJournalEntryCount(label: string): Promise<number> {
    const provider = this.ProviderToUse as unknown as Partial<IRunViewProvider> | undefined;
    if (!provider || typeof provider.RunView !== 'function') return 0;
    const rawId: string = this.ID;
    const filterId = isSqlGuid(rawId)
      ? sqlGuidLiteral(rawId, 'JournalEntryType.ID')
      : `'${String(rawId).replace(/'/g, "''")}'`;
    const res = await provider.RunView<{ ID: string }>(
      {
        EntityName: JE_ENTITY,
        ExtraFilter: `EntryTypeID=${filterId}`,
        Fields: ['ID'],
        ResultType: 'count_only',
        BypassCache: true,
      },
      this.ContextCurrentUser,
    );
    if (!res.Success) {
      throw new Error(`Could not check whether journal entries use type '${label}': ${res.ErrorMessage ?? 'unknown error'}`);
    }
    return res.TotalRowCount ?? res.Results?.length ?? 0;
  }
}

/** Anti-tree-shake loader (mirrors the other entity servers). */
export function LoadJournalEntryTypeEntityServer(): void {
  // intentional no-op — importing this module registers the class
}
