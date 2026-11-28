import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MJGlobal } from '@memberjunction/global';
import { BaseAction } from '@memberjunction/actions';
import { RunActionParams } from '@memberjunction/actions-base';
import { Metadata, RunView, type RunViewParams } from '@memberjunction/core';
import {
    COMPANY_PROFILE_ENTITY,
    ListOffboardingHoldingsAction,
    type OffboardingHolding,
} from '../ListOffboardingHoldingsAction';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const EMP_1 = '33333333-3333-4333-8333-333333333333';
const CO_1 = '44444444-4444-4444-8444-444444444444';
const CO_2 = '55555555-5555-4555-8555-555555555555';

interface World {
    users: Array<{ ID: string; EmployeeID: string | null }>;
    employees: string[];
    profiles: Array<{ ID: string; Name: string; ApprovalCFOUserID: string | null }>;
}

/** Answers RunView from an in-memory world by reading the ID lists out of each filter. */
function mockRunView(world: World, failEntity?: string) {
    const calls: RunViewParams[] = [];
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (p: RunViewParams) => {
        calls.push(p);
        if (p.EntityName === failEntity) return { Success: false, ErrorMessage: 'boom', Results: [] } as never;
        const ids = String(p.ExtraFilter ?? '').match(/[0-9a-f-]{36}/gi) ?? [];
        const has = (id: string | null) => !!id && ids.some(x => x.toLowerCase() === id.toLowerCase());
        let rows: object[] = [];
        if (p.EntityName === 'MJ: Users') rows = world.users.filter(u => has(u.ID) || has(u.EmployeeID));
        if (p.EntityName === 'MJ: Employees') rows = world.employees.filter(has).map(ID => ({ ID }));
        if (p.EntityName === COMPANY_PROFILE_ENTITY) {
            rows = world.profiles.filter(c => has(c.ApprovalCFOUserID)).map(c => ({ ID: c.ID, Name: c.Name }));
        }
        return { Success: true, Results: rows } as never;
    });
    return calls;
}

const runParams = (inputs: Record<string, unknown>): RunActionParams => {
    const params = new RunActionParams();
    params.ContextUser = { ID: 'CALLER' } as never;
    params.Params = [
        ...Object.entries(inputs).map(([Name, Value]) => ({ Name, Type: 'Input' as const, Value })),
        { Name: 'Holdings', Type: 'Output', Value: null },
    ];
    return params;
};

const holdingsOf = (params: RunActionParams): OffboardingHolding[] =>
    JSON.parse(String(params.Params.find(p => p.Name === 'Holdings')?.Value));

const world: World = {
    users: [{ ID: USER_A, EmployeeID: EMP_1 }, { ID: USER_B, EmployeeID: null }],
    employees: [EMP_1],
    profiles: [
        { ID: CO_1, Name: 'Placeholder Co', ApprovalCFOUserID: USER_A },
        { ID: CO_2, Name: 'Other Co', ApprovalCFOUserID: USER_B },
    ],
};

describe('ListOffboardingHoldingsAction', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        Metadata.Provider = { Config: { ActiveStatusAssertions: false } } as never;
    });

    it('is registered as Accounting.ListOffboardingHoldings', () => {
        const instance = MJGlobal.Instance.ClassFactory.CreateInstance<BaseAction>(BaseAction, 'Accounting.ListOffboardingHoldings');
        expect(instance).toBeInstanceOf(ListOffboardingHoldingsAction);
    });

    it('declares on its own class that it authorizes its caller', () => {
        expect(Object.getOwnPropertyDescriptor(ListOffboardingHoldingsAction, 'AuthorizesCaller')?.value).toBe(true);
    });

    it('lists each company whose CFO approver is the leaver, never reassignable, pointing to Company Setup', async () => {
        mockRunView(world);
        const params = runParams({ LeaverUserID: USER_A });

        const result = await new ListOffboardingHoldingsAction().Run(params);

        expect(result).toMatchObject({ Success: true, ResultCode: 'SUCCESS' });
        expect(holdingsOf(params)).toEqual([{
            App: 'Accounting', Domain: 'Finance', Kind: 'CFO_APPROVER', KindLabel: 'CFO approver',
            EntityName: COMPANY_PROFILE_ENTITY, RecordID: CO_1, Label: 'Placeholder Co',
            CanReassign: false, Note: 'Set a new CFO approver for Placeholder Co in Company Setup.',
        }]);
    });

    it('resolves an employee to the users linked to it', async () => {
        mockRunView(world);
        const params = runParams({ LeaverEmployeeID: EMP_1 });

        await new ListOffboardingHoldingsAction().Run(params);

        expect(holdingsOf(params).map(h => h.RecordID)).toEqual([CO_1]);
    });

    it('covers both the given user and the employee\'s users when both are given', async () => {
        mockRunView(world);
        const params = runParams({ LeaverUserID: USER_B, LeaverEmployeeID: EMP_1 });

        await new ListOffboardingHoldingsAction().Run(params);

        expect(holdingsOf(params).map(h => h.RecordID).sort()).toEqual([CO_1, CO_2].sort());
    });

    it('reads every table as the calling user', async () => {
        const calls = mockRunView(world);
        const params = runParams({ LeaverUserID: USER_A });
        const spy = vi.mocked(RunView.prototype.RunView);

        await new ListOffboardingHoldingsAction().Run(params);

        expect(calls.length).toBeGreaterThan(0);
        for (const call of spy.mock.calls) expect(call[1]).toBe(params.ContextUser);
    });

    it('returns an empty list for an employee with no user', async () => {
        const calls = mockRunView({ ...world, employees: [EMP_1], users: [] });
        const params = runParams({ LeaverEmployeeID: EMP_1 });

        const result = await new ListOffboardingHoldingsAction().Run(params);

        expect(result).toMatchObject({ Success: true, ResultCode: 'SUCCESS' });
        expect(holdingsOf(params)).toEqual([]);
        expect(calls.some(c => c.EntityName === COMPANY_PROFILE_ENTITY)).toBe(false);
    });

    it('returns an empty list for a user who approves nothing', async () => {
        mockRunView({ ...world, profiles: [] });
        const params = runParams({ LeaverUserID: USER_A });

        expect(await new ListOffboardingHoldingsAction().Run(params)).toMatchObject({ ResultCode: 'SUCCESS' });
        expect(holdingsOf(params)).toEqual([]);
    });

    it('refuses when neither ID is given', async () => {
        const calls = mockRunView(world);

        const result = await new ListOffboardingHoldingsAction().Run(runParams({ LeaverUserID: '  ' }));

        expect(result).toMatchObject({ Success: false, ResultCode: 'INVALID_INPUT' });
        expect(calls).toHaveLength(0);
    });

    it('refuses an ID that is not a UUID before it reaches a filter', async () => {
        const calls = mockRunView(world);

        const result = await new ListOffboardingHoldingsAction().Run(runParams({ LeaverUserID: "x' OR 1=1--" }));

        expect(result).toMatchObject({ Success: false, ResultCode: 'INVALID_INPUT' });
        expect(calls).toHaveLength(0);
    });

    it('refuses when neither ID matches a user or employee', async () => {
        mockRunView({ users: [], employees: [], profiles: [] });

        const result = await new ListOffboardingHoldingsAction().Run(runParams({ LeaverUserID: USER_A, LeaverEmployeeID: EMP_1 }));

        expect(result).toMatchObject({ Success: false, ResultCode: 'INVALID_INPUT' });
    });

    it('fails rather than report an empty list when a read fails', async () => {
        mockRunView(world, COMPANY_PROFILE_ENTITY);

        await expect(new ListOffboardingHoldingsAction().Run(runParams({ LeaverUserID: USER_A })))
            .rejects.toThrow(/could not read MJ_BizApps_Accounting: Accounting Company Profiles/);
    });
});

describe('the List Offboarding Holdings action metadata', () => {
    const [action] = JSON.parse(readFileSync(
        resolve(__dirname, '../../../../metadata/actions/.accounting-offboarding-actions.json'), 'utf8',
    )) as Array<{
        fields: { Name: string; DriverClass: string; CategoryID: string };
        relatedEntities: {
            'MJ: Action Params': Array<{ fields: { Name: string; Type: string } }>;
            'MJ: Action Result Codes': Array<{ fields: { ResultCode: string } }>;
        };
    }>;

    it('sits in the shared Offboarding Holdings category under the agreed name and driver', () => {
        expect(action.fields).toMatchObject({
            Name: 'Accounting: List Offboarding Holdings',
            DriverClass: 'Accounting.ListOffboardingHoldings',
            CategoryID: '@lookup:MJ: Action Categories.Name=Offboarding Holdings',
        });
    });

    it('declares the contract params and result codes', () => {
        expect(action.relatedEntities['MJ: Action Params'].map(p => `${p.fields.Type}:${p.fields.Name}`))
            .toEqual(['Input:LeaverUserID', 'Input:LeaverEmployeeID', 'Output:Holdings']);
        expect(action.relatedEntities['MJ: Action Result Codes'].map(r => r.fields.ResultCode))
            .toEqual(['SUCCESS', 'INVALID_INPUT']);
    });
});
