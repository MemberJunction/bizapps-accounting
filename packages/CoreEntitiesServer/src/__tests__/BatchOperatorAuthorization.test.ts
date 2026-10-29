/**
 * Build, Regenerate, Dispatch and Archive require the batch-operator Authorization, held by the
 * Finance role (#448). The check runs first, before any read, so a caller without it learns only
 * that. The engine is mocked: what is under test is whether the operation reaches it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthorizationInfo, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { JOURNAL_ENTRY_BATCH_OPERATE_AUTH } from '@mj-biz-apps/accounting-engine-base';
import {
  ArchiveJournalEntryBatchOperation,
  BuildJournalEntryBatchOperation,
  DispatchJournalEntryBatchOperation,
  RegenerateJournalEntryBatchOperation,
} from '../JournalEntryBatchOperations.js';
import { buildJournalEntryBatch, regenerateJournalEntryBatch, sendJournalEntryBatch } from '../JournalEntryBatchEngine.js';

vi.mock('../JournalEntryBatchEngine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../JournalEntryBatchEngine.js')>();
  return { ...actual, buildJournalEntryBatch: vi.fn(), regenerateJournalEntryBatch: vi.fn(), sendJournalEntryBatch: vi.fn() };
});

const BATCH_ID = 'bbbbbbbb-0000-4000-8000-000000000001';
const COMPANY_ID = 'cccccccc-0000-4000-8000-000000000001';
const FINANCE_USER = { ID: 'U-FINANCE' } as UserInfo;
const OTHER_USER = { ID: 'U-OTHER' } as UserInfo;

/** A provider whose catalog grants the Authorization to FINANCE_USER only; `withAuth: false` leaves it out of the catalog. */
function providerFor(withAuth = true): { provider: IMetadataProvider; getEntityObject: ReturnType<typeof vi.fn> } {
  const auth = { ID: 'AUTH-OPERATE', Name: JOURNAL_ENTRY_BATCH_OPERATE_AUTH, ParentID: null, UserCanExecute: (u: UserInfo) => u.ID === FINANCE_USER.ID };
  const archived = { Status: 'Archived', ArchivedAt: new Date('2026-10-18T12:00:00Z') };
  const getEntityObject = vi.fn(async () => ({ ...archived, Load: async () => true, Archive: async () => true }));
  const provider = { Authorizations: (withAuth ? [auth] : []) as unknown as AuthorizationInfo[], GetEntityObject: getEntityObject };
  return { provider: provider as unknown as IMetadataProvider, getEntityObject };
}

/** Each operation, its input, and the engine call (or entity load) it makes once authorized. */
const cases = [
  {
    name: 'Build',
    run: (p: IMetadataProvider, u: UserInfo) => new (class extends BuildJournalEntryBatchOperation {
      public Run() { return this.InternalExecute({ TargetSystem: 'BusinessCentral', CompanyID: COMPANY_ID }, p, u); }
    })().Run(),
    reached: () => vi.mocked(buildJournalEntryBatch),
  },
  {
    name: 'Regenerate',
    run: (p: IMetadataProvider, u: UserInfo) => new (class extends RegenerateJournalEntryBatchOperation {
      public Run() { return this.InternalExecute({ JournalEntryBatchID: BATCH_ID, TargetSystem: 'BusinessCentral' }, p, u); }
    })().Run(),
    reached: () => vi.mocked(regenerateJournalEntryBatch),
  },
  {
    name: 'Dispatch',
    run: (p: IMetadataProvider, u: UserInfo) => new (class extends DispatchJournalEntryBatchOperation {
      public Run() { return this.InternalExecute({ JournalEntryBatchID: BATCH_ID }, p, u); }
    })().Run(),
    reached: () => vi.mocked(sendJournalEntryBatch),
  },
] as const;

describe('batch operations require the batch-operator Authorization (#448)', () => {
  beforeEach(() => {
    vi.mocked(buildJournalEntryBatch).mockReset().mockResolvedValue({} as never);
    vi.mocked(regenerateJournalEntryBatch).mockReset().mockResolvedValue({} as never);
    vi.mocked(sendJournalEntryBatch).mockReset().mockResolvedValue({ Status: 'Posted', ExternalJournalEntryBatchRef: 'JEB-1' } as never);
  });

  it.each(cases)('$name refuses a user without it, before reaching the engine', async ({ run, reached }) => {
    await expect(run(providerFor().provider, OTHER_USER)).rejects.toThrow(`requires the ${JOURNAL_ENTRY_BATCH_OPERATE_AUTH} authorization`);
    expect(reached()).not.toHaveBeenCalled();
  });

  it.each(cases)('$name refuses everyone when the Authorization is missing from the catalog', async ({ run, reached }) => {
    await expect(run(providerFor(false).provider, FINANCE_USER)).rejects.toThrow(/authorization \(the Finance role\)/);
    expect(reached()).not.toHaveBeenCalled();
  });

  it.each(cases)('$name lets a holder through to the engine', async ({ run, reached }) => {
    await run(providerFor().provider, FINANCE_USER);
    expect(reached()).toHaveBeenCalledTimes(1);
  });

  describe('Archive', () => {
    const archive = (p: IMetadataProvider, u: UserInfo) => new (class extends ArchiveJournalEntryBatchOperation {
      public Run() { return this.InternalExecute({ JournalEntryBatchID: BATCH_ID, Reason: 'Posted in the legacy system' }, p, u); }
    })().Run();

    it('refuses a user without it, before loading the batch', async () => {
      const { provider, getEntityObject } = providerFor();
      await expect(archive(provider, OTHER_USER)).rejects.toThrow(`requires the ${JOURNAL_ENTRY_BATCH_OPERATE_AUTH} authorization`);
      expect(getEntityObject).not.toHaveBeenCalled();
    });

    it('lets a holder through to the batch, whose Archive() then checks who may archive it', async () => {
      const { provider, getEntityObject } = providerFor();
      await expect(archive(provider, FINANCE_USER)).resolves.toEqual({ Status: 'Archived', ArchivedAt: '2026-10-18T12:00:00.000Z' });
      expect(getEntityObject).toHaveBeenCalledTimes(1);
    });
  });
});
