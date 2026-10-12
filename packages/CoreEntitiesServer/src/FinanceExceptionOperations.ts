/**
 * The finance exception remote operations (golive #279). Each extends the typed base CodeGen emits
 * from its `MJ: Remote Operations` row (metadata/remote-operations/, GenerationType=Manual) and
 * supplies the body from ./FinanceExceptions.ts.
 *
 * Consuming apps (orders, sales) resolve these by key through the ClassFactory, with no build-time
 * dependency on this package:
 *
 *   MJGlobal.Instance.ClassFactory.CreateInstance<BaseRemotableOperation<I, O>>(BaseRemotableOperation, 'Accounting.RaiseFinanceExceptions')
 *
 * and check both the envelope (`result.Success`) and the payload (`Output.Success`).
 */
import { BaseRemotableOperation, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  AccountingClearFinanceExceptionOperation,
  AccountingGetFinanceExceptionTypesOperation,
  AccountingRaiseFinanceExceptionsOperation,
  type AccountingClearFinanceExceptionInput,
  type AccountingClearFinanceExceptionOutput,
  type AccountingGetFinanceExceptionTypesInput,
  type AccountingGetFinanceExceptionTypesOutput,
  type AccountingRaiseFinanceExceptionsInput,
  type AccountingRaiseFinanceExceptionsOutput,
} from '@mj-biz-apps/accounting-entities';
import { ClearFinanceException, GetFinanceExceptionTypes, RaiseFinanceExceptions } from './FinanceExceptions.js';

@RegisterClass(BaseRemotableOperation, 'Accounting.GetFinanceExceptionTypes')
export class GetFinanceExceptionTypesOperation extends AccountingGetFinanceExceptionTypesOperation {
  protected async InternalExecute(
    input: AccountingGetFinanceExceptionTypesInput,
    provider: IMetadataProvider,
    _user: UserInfo,
  ): Promise<AccountingGetFinanceExceptionTypesOutput> {
    return GetFinanceExceptionTypes(input, provider);
  }
}

@RegisterClass(BaseRemotableOperation, 'Accounting.RaiseFinanceExceptions')
export class RaiseFinanceExceptionsOperation extends AccountingRaiseFinanceExceptionsOperation {
  protected async InternalExecute(
    input: AccountingRaiseFinanceExceptionsInput,
    provider: IMetadataProvider,
    _user: UserInfo,
  ): Promise<AccountingRaiseFinanceExceptionsOutput> {
    return RaiseFinanceExceptions(input, provider);
  }
}

@RegisterClass(BaseRemotableOperation, 'Accounting.ClearFinanceException')
export class ClearFinanceExceptionOperation extends AccountingClearFinanceExceptionOperation {
  protected async InternalExecute(
    input: AccountingClearFinanceExceptionInput,
    provider: IMetadataProvider,
    user: UserInfo,
  ): Promise<AccountingClearFinanceExceptionOutput> {
    return ClearFinanceException(input, provider, user);
  }
}

/**
 * Tree-shaking anchor — called from the app's server bootstrap so the `@RegisterClass`
 * registrations are retained and the operations stay resolvable by key.
 */
export function LoadFinanceExceptionOperations(): void {
  // intentionally empty
}
