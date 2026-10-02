/**
 * Server-side subclass of DimensionValue: the code must fit the ERP it is posted to
 * (bc-aidp-next-golive#280).
 *
 * Dimension values belong to dimensions, which every company shares, so the check applies
 * whenever any company posts to an ERP accounting checks limits for. Codes pulled from the ERP
 * always fit; this catches codes created or edited here. Checked on create and on a Code change
 * only, so a row saved before the check existed stays editable; dispatch rejects it before
 * sending.
 */
import { BaseEntity, IMetadataProvider, ValidationErrorInfo, ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingDimensionValueEntity } from '@mj-biz-apps/accounting-entities';
import { CheckErpFieldOnSave } from './ErpFieldLimits.js';

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Dimension Values')
export class DimensionValueEntityServer extends mjBizAppsAccountingDimensionValueEntity {
  /** BaseEntity skips ValidateAsync unless a subclass opts in. */
  public override get DefaultSkipAsyncValidation(): boolean {
    return false;
  }

  public override async ValidateAsync(): Promise<ValidationResult> {
    const result = await super.ValidateAsync();
    if (this.IsSaved && !this.GetFieldByName('Code')?.Dirty) return result;
    const messages = await CheckErpFieldOnSave('DimensionValueCode', this.Code, this.ContextCurrentUser, this.ProviderToUse as unknown as IMetadataProvider);
    for (const message of messages) {
      result.Success = false;
      result.Errors.push(new ValidationErrorInfo('Code', message, this.Code));
    }
    return result;
  }
}

/** Tree-shaking anchor — imported by ./index.ts so the @RegisterClass registration survives bundling. */
export function LoadDimensionValueEntityServer(): void {
  // intentionally empty
}
