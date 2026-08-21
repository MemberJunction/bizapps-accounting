/**
 * Compatibility shim: `netLines` still lives on JournalEntryBatchEngine so existing
 * server callers keep compiling. The behavior is owned by EngineBase.NetLines.
 */
import { describe, it, expect } from 'vitest';
import { NetLines } from '@mj-biz-apps/accounting-engine-base';
import { netLines, type NettableLine } from '../JournalEntryBatchEngine.js';

const line = (glAccountId: string, debit: number, credit: number): NettableLine => ({
    companyId: '11111111-0000-0000-0000-000000000001',
    glAccountId,
    debit,
    credit,
    dims: [],
});

describe('netLines (compat alias for NetLines)', () => {
    it('delegates to NetLines from accounting-engine-base', () => {
        const input = [line('aaaaaaaa-0000-0000-0000-000000000001', 100, 0), line('aaaaaaaa-0000-0000-0000-000000000001', 0, 30)];
        expect(netLines(input)).toEqual(NetLines(input));
    });
});
