import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MJGlobal } from '@memberjunction/global';
import { BaseAction } from '@memberjunction/actions';
import { ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { ACCOUNTING_VERBS, ERP_INTEGRATION, erpPluginKey } from '@memberjunction/actions-bizapps-accounting';
import { CreateBusinessCentralJournalEntryWithDimensionsAction } from '../CreateBusinessCentralJournalEntryWithDimensionsAction';

const PLUGIN_KEY = erpPluginKey(ACCOUNTING_VERBS.CreateJournalEntry, ERP_INTEGRATION.BusinessCentral);

/** One BC call as the spy records it: endpoint, method, body. */
type BCCall = [string, string, Record<string, unknown> | undefined];

/**
 * The protected request helper the action inherits from `BusinessCentralBaseAction`, named as a
 * structural type so the spy is typed rather than cast away — this file compiles under the
 * package's `tsc` build, not just vitest.
 */
interface BCRequestSeam {
  makeBCRequest(
    endpoint: string,
    method: string,
    body?: Record<string, unknown>,
    contextUser?: unknown,
  ): Promise<unknown>;
}

const seamOf = (action: CreateBusinessCentralJournalEntryWithDimensionsAction): BCRequestSeam =>
  action as unknown as BCRequestSeam;

const inputs = (values: Record<string, unknown>): RunActionParams => {
  const params = new RunActionParams();
  params.ContextUser = { ID: 'SYSTEM-USER' } as never;
  params.Params = Object.entries(values).map(([Name, Value]) => ({ Name, Type: 'Input' as const, Value }));
  return params;
};

const run = (action: BaseAction, params: RunActionParams): Promise<ActionResultSimple> => action.Run(params);

const outParam = (result: ActionResultSimple, name: string): unknown =>
  result.Params?.find(p => p.Name === name)?.Value;

/** Records every BC call and answers the journal lookup + line creates. */
const stubBC = (
  action: CreateBusinessCentralJournalEntryWithDimensionsAction,
  overrides: (endpoint: string, method: string) => unknown = () => undefined,
) => {
  let lineNumber = 0;
  return vi.spyOn(seamOf(action), 'makeBCRequest').mockImplementation(async (endpoint, method) => {
    const override = overrides(endpoint, method);
    if (override !== undefined) {
      return override;
    }
    if (endpoint === 'journals') {
      return { value: [{ id: 'j-1', code: 'GENERAL', balancingAccountNumber: null }] };
    }
    if (endpoint.endsWith('/journalLines') && method === 'POST') {
      lineNumber += 1;
      return { id: `line-${lineNumber}`, documentNumber: 'JE-9' };
    }
    return undefined;
  });
};

const calls = (spy: { mock: { calls: Parameters<BCRequestSeam['makeBCRequest']>[] } }): BCCall[] =>
  spy.mock.calls.map(c => [c[0], c[1], c[2]] as BCCall);

const TAGGED_LINES = [
  {
    accountNumber: '1000',
    debit: 100,
    description: 'Debit side',
    dimensions: [
      { code: 'VENTURE', valueCode: 'ACME' },
      { code: 'PRODUCT', valueCode: 'WIDGET' },
    ],
  },
  {
    accountNumber: '2000',
    credit: 100,
    dimensions: [{ code: 'VENTURE', valueCode: 'ACME' }],
  },
];

describe('CreateBusinessCentralJournalEntryWithDimensionsAction', () => {
  let action: CreateBusinessCentralJournalEntryWithDimensionsAction;

  beforeEach(() => {
    vi.restoreAllMocks();
    action = new CreateBusinessCentralJournalEntryWithDimensionsAction();
  });

  it('outranks the platform registration for the Business Central CreateJournalEntry plugin key', () => {
    const instance = MJGlobal.Instance.ClassFactory.CreateInstance<BaseAction>(BaseAction, PLUGIN_KEY);
    expect(instance).toBeInstanceOf(CreateBusinessCentralJournalEntryWithDimensionsAction);
  });

  it('POSTs a dimensionSetLine per tag, against the created line, before posting the batch', async () => {
    const spy = stubBC(action);

    const result = await run(action, inputs({ CompanyID: 'comp-1', DocNumber: 'JE-9', Lines: TAGGED_LINES }));

    expect(calls(spy).map(c => [c[0], c[1]])).toEqual([
      ['journals', 'GET'],
      ['journals(j-1)/journalLines', 'POST'],
      ['journalLines(line-1)/dimensionSetLines', 'POST'],
      ['journalLines(line-1)/dimensionSetLines', 'POST'],
      ['journals(j-1)/journalLines', 'POST'],
      ['journalLines(line-2)/dimensionSetLines', 'POST'],
      ['journals(j-1)/Microsoft.NAV.post', 'POST'],
    ]);
    expect(calls(spy)[2][2]).toEqual({ code: 'VENTURE', valueCode: 'ACME' });
    expect(calls(spy)[3][2]).toEqual({ code: 'PRODUCT', valueCode: 'WIDGET' });
    expect(calls(spy)[5][2]).toEqual({ code: 'VENTURE', valueCode: 'ACME' });
    expect(result.Success).toBe(true);
    expect(outParam(result, 'JournalEntryID')).toBe('j-1');
    expect(outParam(result, 'TotalAmount')).toBe(100);
  });

  it('keeps the line body free of dimension fields — BC v2.0 journalLines has no shortcut dimension properties', async () => {
    const spy = stubBC(action);

    await run(action, inputs({ CompanyID: 'comp-1', DocNumber: 'JE-9', Lines: TAGGED_LINES }));

    const firstLine = calls(spy)[1][2] as Record<string, unknown>;
    expect(firstLine.accountNumber).toBe('1000');
    expect(firstLine.amount).toBe(100);
    expect(Object.keys(firstLine)).not.toContain('dimensions');
    expect(Object.keys(firstLine)).not.toContain('shortcutDimension1Code');
    expect(Object.keys(firstLine)).not.toContain('shortcutDimension2Code');
  });

  it('writes no dimensionSetLines for untagged lines, and skips tags missing a code', async () => {
    const spy = stubBC(action);

    await run(action, inputs({
      CompanyID: 'comp-1',
      Lines: [
        { accountNumber: '1000', debit: 100 },
        { accountNumber: '2000', credit: 100, dimensions: [{ code: '', valueCode: 'ACME' }, { code: 'VENTURE', valueCode: '' }] },
      ],
    }));

    expect(calls(spy).filter(c => c[0].includes('dimensionSetLines'))).toEqual([]);
  });

  it('deletes the lines written so far and does not post when a dimensionSetLine POST fails', async () => {
    const spy = stubBC(action, (endpoint, method) => {
      if (endpoint.includes('dimensionSetLines') && method === 'POST') {
        throw new Error('dimension VENTURE does not exist');
      }
      return undefined;
    });

    const result = await run(action, inputs({ CompanyID: 'comp-1', Lines: TAGGED_LINES }));

    expect(result.Success).toBe(false);
    expect(result.Message).toBe('dimension VENTURE does not exist');
    expect(calls(spy).map(c => [c[0], c[1]])).toEqual([
      ['journals', 'GET'],
      ['journals(j-1)/journalLines', 'POST'],
      ['journalLines(line-1)/dimensionSetLines', 'POST'],
      ['journalLines(line-1)', 'DELETE'],
    ]);
  });

  it('fails rather than dropping tags when BC returns a created line with no id', async () => {
    const spy = stubBC(action, (endpoint, method) =>
      endpoint.endsWith('/journalLines') && method === 'POST' ? { documentNumber: 'JE-9' } : undefined,
    );

    const result = await run(action, inputs({ CompanyID: 'comp-1', Lines: TAGGED_LINES }));

    expect(result.Success).toBe(false);
    expect(result.Message).toContain('no line id');
    expect(calls(spy).some(c => c[0].includes('Microsoft.NAV.post'))).toBe(false);
  });

  it('still refuses an unbalanced entry without calling Business Central', async () => {
    const spy = stubBC(action);

    const result = await run(action, inputs({
      CompanyID: 'comp-1',
      Lines: [{ accountNumber: '1000', debit: 100 }, { accountNumber: '2000', credit: 50 }],
    }));

    expect(result.ResultCode).toBe('VALIDATION_ERROR');
    expect(spy).not.toHaveBeenCalled();
  });
});
