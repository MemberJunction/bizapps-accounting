/**
 * Seam between AccountingERPEngine and MJ Actions/BizApps/Accounting verbs.
 * Production uses ActionEngine; tests inject a fake.
 */
import { LogError, UserInfo } from '@memberjunction/core';

export interface AccountingVerbResult {
  Success: boolean;
  ResultCode?: string;
  Message?: string;
  Params?: Array<{ Name: string; Value?: unknown; Type?: string }>;
}

export interface AccountingVerbCall {
  Verb: string;
  CompanyID: string;
  Params: Record<string, unknown>;
  User: UserInfo;
}

export type AccountingVerbRunner = (call: AccountingVerbCall) => Promise<AccountingVerbResult>;

export async function defaultAccountingVerbRunner(call: AccountingVerbCall): Promise<AccountingVerbResult> {
  try {
    const actions = await (Function('m', 'return import(m)') as (m: string) => Promise<Record<string, { Instance?: { RunAction: Function } }>>)('@memberjunction/actions');
    const engine = actions.ActionEngineServer?.Instance ?? actions.ActionEngine?.Instance;
    if (!engine?.RunAction) {
      return {
        Success: false,
        ResultCode: 'ENGINE_UNAVAILABLE',
        Message: 'ActionEngine is not loaded in this host — cannot dispatch ERP verbs.',
      };
    }
    const params = Object.entries({ CompanyID: call.CompanyID, ...call.Params }).map(([Name, Value]) => ({
      Name,
      Value,
      Type: 'Input' as const,
    }));
    const result = await engine.RunAction({
      ActionName: call.Verb,
      Params: params,
      ContextUser: call.User,
    });
    return {
      Success: !!result.Success,
      ResultCode: result.ResultCode ?? (result.Success ? 'SUCCESS' : 'ERROR'),
      Message: result.Message,
      Params: result.Params,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    LogError(`AccountingVerbRunner ${call.Verb} failed: ${msg}`);
    return { Success: false, ResultCode: 'ERROR', Message: msg };
  }
}
