/**
 * The batch-operator Authorization check (#448), shared by the batch operations and the batch pages.
 */
import { describe, it, expect } from 'vitest';
import type { AuthorizationInfo, UserInfo } from '@memberjunction/core';
import { JOURNAL_ENTRY_BATCH_OPERATE_AUTH, UserCanOperateJournalEntryBatches } from '../batch-operator.js';

const FINANCE = { ID: 'U-FINANCE' } as UserInfo;
const OTHER = { ID: 'U-OTHER' } as UserInfo;

function catalog(name = JOURNAL_ENTRY_BATCH_OPERATE_AUTH): AuthorizationInfo[] {
  return [{ ID: 'AUTH-1', Name: name, ParentID: null, UserCanExecute: (u: UserInfo) => u.ID === FINANCE.ID }] as unknown as AuthorizationInfo[];
}

describe('UserCanOperateJournalEntryBatches', () => {
  it('is true for a holder', () => {
    expect(UserCanOperateJournalEntryBatches(FINANCE, catalog())).toBe(true);
  });

  it('is false for anyone else', () => {
    expect(UserCanOperateJournalEntryBatches(OTHER, catalog())).toBe(false);
  });

  it('fails closed when the Authorization is not in the catalog, or there is no catalog or user', () => {
    expect(UserCanOperateJournalEntryBatches(FINANCE, catalog('Some.Other.Authorization'))).toBe(false);
    expect(UserCanOperateJournalEntryBatches(FINANCE, undefined)).toBe(false);
    expect(UserCanOperateJournalEntryBatches(undefined, catalog())).toBe(false);
  });
});
