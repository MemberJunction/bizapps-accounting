import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserInfo } from '@memberjunction/core';

const getActionByName = vi.fn();
const runAction = vi.fn();
const config = vi.fn();

vi.mock('@memberjunction/actions', () => ({
  ActionEngineServer: {
    Instance: {
      Loaded: true,
      GetActionByName: (...args: unknown[]) => getActionByName(...args),
      RunAction: (...args: unknown[]) => runAction(...args),
      Config: (...args: unknown[]) => config(...args),
    },
  },
}));

import { defaultAccountingVerbRunner } from '../AccountingVerbRunner.js';

const user = { ID: 'user-1' } as unknown as UserInfo;

describe('defaultAccountingVerbRunner', () => {
  beforeEach(() => {
    getActionByName.mockReset();
    runAction.mockReset();
    config.mockReset();
  });

  it('looks up the Action entity and passes it to RunAction — never ActionName', async () => {
    const action = { Name: 'GetAccountBalances', MaxExecutionTimeMS: 30_000 };
    getActionByName.mockReturnValue(action);
    runAction.mockResolvedValue({
      Success: true,
      Result: { ResultCode: 'SUCCESS' },
      Message: 'ok',
      Params: [],
    });

    const out = await defaultAccountingVerbRunner({
      Verb: 'GetAccountBalances',
      CompanyID: 'co-1',
      Params: { AsOfDate: '2026-08-29' },
      User: user,
    });

    expect(getActionByName).toHaveBeenCalledWith('GetAccountBalances');
    expect(runAction).toHaveBeenCalledWith(expect.objectContaining({
      Action: action,
      ContextUser: user,
      Filters: [],
    }));
    expect(runAction.mock.calls[0][0].ActionName).toBeUndefined();
    expect(out.Success).toBe(true);
    expect(out.ResultCode).toBe('SUCCESS');
  });

  it('surfaces Result.ResultCode from ActionResult, not a missing ResultCode field', async () => {
    getActionByName.mockReturnValue({ Name: 'CreateJournalEntry' });
    runAction.mockResolvedValue({
      Success: false,
      Result: { ResultCode: 'PROVIDER_NOT_REGISTERED' },
      Message: 'No ERP plugin',
    });

    const out = await defaultAccountingVerbRunner({
      Verb: 'CreateJournalEntry',
      CompanyID: 'co-1',
      Params: {},
      User: user,
    });

    expect(out.Success).toBe(false);
    expect(out.ResultCode).toBe('PROVIDER_NOT_REGISTERED');
  });

  it('returns ACTION_NOT_FOUND when the verb is not in the ActionEngine cache', async () => {
    getActionByName.mockReturnValue(undefined);
    const out = await defaultAccountingVerbRunner({
      Verb: 'NotAVerb',
      CompanyID: 'co-1',
      Params: {},
      User: user,
    });
    expect(out.ResultCode).toBe('ACTION_NOT_FOUND');
    expect(runAction).not.toHaveBeenCalled();
  });
});
