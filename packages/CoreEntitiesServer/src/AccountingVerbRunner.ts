/**
 * Seam between AccountingERPEngine and MJ Actions/BizApps/Accounting verbs.
 * Production uses ActionEngine; tests inject a fake.
 */
import { ActionEngineServer } from '@memberjunction/actions';
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

function resultCodeOf(result: { Success?: boolean; Result?: { ResultCode?: string } | null }): string {
  return result.Result?.ResultCode ?? (result.Success ? 'SUCCESS' : 'ERROR');
}

export async function defaultAccountingVerbRunner(call: AccountingVerbCall): Promise<AccountingVerbResult> {
  try {
    const engine = ActionEngineServer.Instance;
    if (!engine?.RunAction) {
      return {
        Success: false,
        ResultCode: 'ENGINE_UNAVAILABLE',
        Message: 'ActionEngine is not loaded in this host — cannot dispatch ERP verbs.',
      };
    }
    if (!engine.Loaded) {
      await engine.Config(false, call.User);
    }
    const action = engine.GetActionByName(call.Verb);
    if (!action) {
      return {
        Success: false,
        ResultCode: 'ACTION_NOT_FOUND',
        Message: `No Action named ${call.Verb}.`,
      };
    }
    const params = Object.entries({ CompanyID: call.CompanyID, ...call.Params }).map(([Name, Value]) => ({
      Name,
      Value,
      Type: 'Input' as const,
    }));
    const result = await engine.RunAction({
      Action: action,
      Params: params,
      ContextUser: call.User,
      Filters: [],
    });
    return {
      Success: !!result.Success,
      ResultCode: resultCodeOf(result),
      Message: result.Message,
      Params: result.Params,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    LogError(`AccountingVerbRunner ${call.Verb} failed: ${msg}`);
    return { Success: false, ResultCode: 'ERROR', Message: msg };
  }
}
