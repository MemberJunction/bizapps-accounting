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
 * Consumer-owned rows (IsSystem=0) stay fully editable — they belong to their app.
 */
import { BaseEntity, EntityDeleteOptions, ValidationResult, ValidationErrorInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingJournalEntryTypeEntity } from '@mj-biz-apps/accounting-entities';

const JET_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Types';

@RegisterClass(BaseEntity, JET_ENTITY)
export class JournalEntryTypeEntityServer extends mjBizAppsAccountingJournalEntryTypeEntity {
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

  public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
    const isSystem = this.Fields.find(f => f.Name === 'IsSystem')?.Value === true;
    if (isSystem) {
      const code = this.Fields.find(f => f.Name === 'Code')?.Value ?? this.ID;
      throw new Error(
        `Journal entry type '${String(code)}' is a system type and cannot be deleted, because Accounting's database rules and batching depend on it.`,
      );
    }
    return super.Delete(options);
  }
}

/** Anti-tree-shake loader (mirrors the other entity servers). */
export function LoadJournalEntryTypeEntityServer(): void {
  // intentional no-op — importing this module registers the class
}
