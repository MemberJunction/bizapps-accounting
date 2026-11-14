/**
 * Unit tests verifying bulk hydration optimization for journal entry batches:
 * - lockJournalEntries (inside buildJournalEntryBatchFromExplicitIds) preloads member entries in bulk
 *   and skips per-JE Load() calls when RunView returns entity_object instances with .Save().
 * - markJournalEntriesGLPosted (inside resumeJournalEntryBatchPosting) receives entity_object instances
 *   from RunView and skips both GetEntityObject() and Load() calls when stamping GLPosted.
 */
import { describe, it, expect, vi } from 'vitest';
import type { IMetadataProvider, RunViewParams, UserInfo } from '@memberjunction/core';
import type {
  mjBizAppsAccountingJournalEntryBatchEntity,
  mjBizAppsAccountingJournalEntryEntity,
} from '@mj-biz-apps/accounting-entities';
import {
  buildJournalEntryBatchFromExplicitIds,
  resumeJournalEntryBatchPosting,
  AutoApproveGate,
} from '../JournalEntryBatchEngine.js';

const USER = { ID: 'USER-1' } as UserInfo;
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';
const JET_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Types';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

interface FakeBatchEntity {
  ID: string;
  JournalEntryBatchNumber: string;
  Status: string;
  PostingDate: Date | null;
  PostedAt: Date | null;
  ExternalJournalEntryBatchRef: string | null;
  CompanyID: string;
  TargetSystem: string;
  BatchedAt: Date | null;
  BatchedByUserID: string;
  TotalEntries: number;
  TotalDebits: number;
  TotalCredits: number;
  SummaryJournalEntryID: string | null;
  ApprovalTaskID: string | null;
  ApprovalTaskRaisedAt: Date | null;
  LatestResult: { CompleteMessage: string } | null;
  NewRecord: () => void;
  MarkBuiltByBatchingProcess: () => void;
  Load: (id: string) => Promise<boolean>;
  Save: () => Promise<boolean>;
}

interface FakeSummaryJournalEntry {
  ID: string;
  CompanyID: string;
  EffectiveDate: Date | null;
  EntryTypeID: string;
  Status: string;
  JournalEntryBatchID: string | null;
  Description: string;
  LatestResult: { CompleteMessage: string } | null;
  NewRecord: () => void;
  CreateLine: (contextUser: UserInfo) => Promise<{
    GLAccountID: string;
    DebitAmount: number | null;
    CreditAmount: number | null;
    Description: string;
    CreateDimension: (contextUser: UserInfo) => Promise<{ DimensionID: string; DimensionValueID: string | null }>;
  }>;
  Save: () => Promise<boolean>;
}

interface HydratedJournalEntryRow {
  ID: string;
  Status: string;
  JournalEntryBatchID: string | null;
  GLPostedAt: Date | null;
  GLReferenceID: string | null;
  LatestResult: { CompleteMessage: string } | null;
  Load: (id: string) => Promise<boolean>;
  Save: () => Promise<boolean>;
}

function createHydratedJournalEntry(id: string, initialStatus = 'Pending'): HydratedJournalEntryRow {
  const row: HydratedJournalEntryRow = {
    ID: id,
    Status: initialStatus,
    JournalEntryBatchID: null,
    GLPostedAt: null,
    GLReferenceID: null,
    LatestResult: null,
    Load: vi.fn(async () => true),
    Save: vi.fn(async () => true),
  };
  return row;
}

describe('BatchBulkHydration (0 per-JE Load calls on entity_object RunView)', () => {
  it('buildJournalEntryBatchFromExplicitIds performs 0 per-JE Load() calls when RunView preloads hydrated entities', async () => {
    const jeId1 = '11111111-0000-0000-0000-000000000001';
    const jeId2 = '11111111-0000-0000-0000-000000000002';
    const companyId = '22222222-0000-0000-0000-000000000001';

    const hydrated1 = createHydratedJournalEntry(jeId1, 'Pending');
    const hydrated2 = createHydratedJournalEntry(jeId2, 'Pending');

    const fakeBatch: FakeBatchEntity = {
      ID: 'bbbbbbbb-0000-0000-0000-000000000001',
      JournalEntryBatchNumber: 'JEB-0001',
      Status: 'Pending',
      PostingDate: null,
      PostedAt: null,
      ExternalJournalEntryBatchRef: null,
      CompanyID: companyId,
      TargetSystem: 'BusinessCentral',
      BatchedAt: null,
      BatchedByUserID: 'USER-1',
      TotalEntries: 0,
      TotalDebits: 0,
      TotalCredits: 0,
      SummaryJournalEntryID: null,
      ApprovalTaskID: null,
      ApprovalTaskRaisedAt: null,
      LatestResult: null,
      NewRecord: vi.fn(),
      MarkBuiltByBatchingProcess: vi.fn(),
      Load: vi.fn(async () => true),
      Save: vi.fn(async () => true),
    };

    const fakeSummary: FakeSummaryJournalEntry = {
      ID: 'ssssssss-0000-0000-0000-000000000001',
      CompanyID: companyId,
      EffectiveDate: null,
      EntryTypeID: '',
      Status: 'Pending',
      JournalEntryBatchID: null,
      Description: '',
      LatestResult: null,
      NewRecord: vi.fn(),
      CreateLine: vi.fn(async () => ({
        GLAccountID: '',
        DebitAmount: null,
        CreditAmount: null,
        Description: '',
        CreateDimension: vi.fn(async () => ({ DimensionID: '', DimensionValueID: null })),
      })),
      Save: vi.fn(async () => true),
    };

    const provider: IMetadataProvider = {
      BeginTransaction: vi.fn(async () => undefined),
      CommitTransaction: vi.fn(async () => undefined),
      RollbackTransaction: vi.fn(async () => undefined),
      GetEntityObject: vi.fn(async (name: string) => {
        if (name === BATCH_ENTITY) return fakeBatch;
        if (name === JE_ENTITY) return fakeSummary;
        throw new Error(`Unexpected GetEntityObject call for ${name}`);
      }),
      RunView: vi.fn(async (params: RunViewParams) => {
        if (params.EntityName === JE_ENTITY) {
          if (params.ResultType === 'entity_object') {
            // lockJournalEntries bulk preloading query
            return { Success: true, Results: [hydrated1, hydrated2] };
          }
          if (typeof params.ExtraFilter === 'string' && params.ExtraFilter.includes("EffectiveDate > '2026-08-01'")) {
            // assertPostingDayCoversMembers
            return { Success: true, Results: [] };
          }
          // Initial Pending verification in buildJournalEntryBatchFromExplicitIds
          return {
            Success: true,
            Results: [
              {
                ID: jeId1,
                Status: 'Pending',
                CompanyID: companyId,
                EffectiveDate: '2026-08-01',
                EntryNumber: 'JE-001',
                ApprovalLevel: null,
                ApprovedAt: null,
              },
              {
                ID: jeId2,
                Status: 'Pending',
                CompanyID: companyId,
                EffectiveDate: '2026-08-01',
                EntryNumber: 'JE-002',
                ApprovalLevel: null,
                ApprovedAt: null,
              },
            ],
          };
        }
        if (params.EntityName === ACP_ENTITY) {
          if (typeof params.ExtraFilter === 'string' && params.ExtraFilter.includes(`ID='${companyId}'`)) {
            // assertPostingDayOpen
            return { Success: true, Results: [{ BooksClosedThroughDate: null }] };
          }
          // loadPostingStartDates
          return { Success: true, Results: [{ ID: companyId, PostingStartDate: '2026-01-01' }] };
        }
        if (params.EntityName === JEL_ENTITY) {
          // loadNettableLines
          return {
            Success: true,
            Results: [
              { ID: 'line-1', JournalEntryID: jeId1, GLAccountID: 'gl-1', DebitAmount: 150, CreditAmount: 0 },
              { ID: 'line-2', JournalEntryID: jeId2, GLAccountID: 'gl-2', DebitAmount: 0, CreditAmount: 150 },
            ],
          };
        }
        if (params.EntityName === JELD_ENTITY) {
          // loadDimensionsByLine
          return { Success: true, Results: [] };
        }
        if (params.EntityName === JET_ENTITY) {
          // GetJournalEntryBatchSummaryEntryType
          return {
            Success: true,
            Results: [
              {
                ID: 'jet-summary-1',
                Code: 'JournalEntryBatchSummary',
                Name: 'Batch Summary',
                IsSystem: true,
                IsJournalEntryBatchSummary: true,
                IsActive: true,
              },
            ],
          };
        }
        return { Success: true, Results: [] };
      }),
    } as unknown as IMetadataProvider;

    const results = await buildJournalEntryBatchFromExplicitIds(
      [jeId1, jeId2],
      'BusinessCentral',
      'USER-1',
      USER,
      provider,
      AutoApproveGate,
      '2026-08-01',
    );

    expect(results).toHaveLength(1);
    expect(results[0].jeCount).toBe(2);

    // CRITICAL ASSERTION: Zero per-JE Load() calls were performed!
    expect(hydrated1.Load).not.toHaveBeenCalled();
    expect(hydrated2.Load).not.toHaveBeenCalled();

    // The preloaded entities were saved with the batch lock
    expect(hydrated1.Status).toBe('Batched');
    expect(hydrated1.JournalEntryBatchID).toBe(fakeBatch.ID);
    expect(hydrated1.Save).toHaveBeenCalledTimes(1);

    expect(hydrated2.Status).toBe('Batched');
    expect(hydrated2.JournalEntryBatchID).toBe(fakeBatch.ID);
    expect(hydrated2.Save).toHaveBeenCalledTimes(1);
  });

  it('resumeJournalEntryBatchPosting performs 0 per-JE Load() calls when RunView returns entity_object instances', async () => {
    const batchId = 'bbbbbbbb-0000-0000-0000-000000000002';
    const jeId1 = '11111111-0000-0000-0000-000000000003';
    const jeId2 = '11111111-0000-0000-0000-000000000004';
    const jeId3 = '11111111-0000-0000-0000-000000000005';

    const postedDate = new Date('2026-09-01T12:00:00Z');
    const erpRef = 'ERP-REF-XYZ';

    const hydrated1 = createHydratedJournalEntry(jeId1, 'Batched');
    const hydrated2 = createHydratedJournalEntry(jeId2, 'Batched');
    const hydrated3 = createHydratedJournalEntry(jeId3, 'Batched');

    const fakeBatch: FakeBatchEntity = {
      ID: batchId,
      JournalEntryBatchNumber: 'JEB-0002',
      Status: 'Posted',
      PostingDate: new Date('2026-08-31'),
      PostedAt: postedDate,
      ExternalJournalEntryBatchRef: erpRef,
      CompanyID: '22222222-0000-0000-0000-000000000001',
      TargetSystem: 'BusinessCentral',
      BatchedAt: new Date('2026-08-31'),
      BatchedByUserID: 'USER-1',
      TotalEntries: 3,
      TotalDebits: 300,
      TotalCredits: 300,
      SummaryJournalEntryID: 'summary-id',
      ApprovalTaskID: null,
      ApprovalTaskRaisedAt: null,
      LatestResult: null,
      NewRecord: vi.fn(),
      MarkBuiltByBatchingProcess: vi.fn(),
      Load: vi.fn(async () => true),
      Save: vi.fn(async () => true),
    };

    const getEntityObjectSpy = vi.fn(async (name: string) => {
      if (name === BATCH_ENTITY) return fakeBatch;
      throw new Error(`Unexpected GetEntityObject call for ${name}`);
    });

    const provider: IMetadataProvider = {
      GetEntityObject: getEntityObjectSpy,
      RunView: vi.fn(async (params: RunViewParams) => {
        if (params.EntityName === JE_ENTITY) {
          expect(params.ResultType).toBe('entity_object');
          return { Success: true, Results: [hydrated1, hydrated2, hydrated3] };
        }
        return { Success: true, Results: [] };
      }),
    } as unknown as IMetadataProvider;

    const result = await resumeJournalEntryBatchPosting(batchId, USER, provider);

    expect(result.journalEntriesPosted).toBe(3);

    // CRITICAL ASSERTION: Zero per-JE Load() calls were performed!
    expect(hydrated1.Load).not.toHaveBeenCalled();
    expect(hydrated2.Load).not.toHaveBeenCalled();
    expect(hydrated3.Load).not.toHaveBeenCalled();

    // CRITICAL ASSERTION: GetEntityObject was called ONLY for the batch, never for individual JEs!
    expect(getEntityObjectSpy).toHaveBeenCalledTimes(1);
    expect(getEntityObjectSpy).toHaveBeenCalledWith(BATCH_ENTITY, USER);

    // All entries flipped to GLPosted with matching timestamps and ERP reference
    for (const hydrated of [hydrated1, hydrated2, hydrated3]) {
      expect(hydrated.Status).toBe('GLPosted');
      expect(hydrated.GLPostedAt).toEqual(postedDate);
      expect(hydrated.GLReferenceID).toBe(erpRef);
      expect(hydrated.Save).toHaveBeenCalledTimes(1);
    }
  });

  it('markJournalEntriesGLPosted falls back gracefully to GetEntityObject and Load() when RunView returns unhydrated rows', async () => {
    const batchId = 'bbbbbbbb-0000-0000-0000-000000000003';
    const jeId1 = '11111111-0000-0000-0000-000000000006';

    const postedDate = new Date('2026-09-01T12:00:00Z');
    const erpRef = 'ERP-REF-FALLBACK';

    const fallbackEntity = createHydratedJournalEntry(jeId1, 'Batched');

    const fakeBatch: FakeBatchEntity = {
      ID: batchId,
      JournalEntryBatchNumber: 'JEB-0003',
      Status: 'Posted',
      PostingDate: new Date('2026-08-31'),
      PostedAt: postedDate,
      ExternalJournalEntryBatchRef: erpRef,
      CompanyID: '22222222-0000-0000-0000-000000000001',
      TargetSystem: 'BusinessCentral',
      BatchedAt: new Date('2026-08-31'),
      BatchedByUserID: 'USER-1',
      TotalEntries: 1,
      TotalDebits: 100,
      TotalCredits: 100,
      SummaryJournalEntryID: 'summary-id',
      ApprovalTaskID: null,
      ApprovalTaskRaisedAt: null,
      LatestResult: null,
      NewRecord: vi.fn(),
      MarkBuiltByBatchingProcess: vi.fn(),
      Load: vi.fn(async () => true),
      Save: vi.fn(async () => true),
    };

    const provider: IMetadataProvider = {
      GetEntityObject: vi.fn(async (name: string) => {
        if (name === BATCH_ENTITY) return fakeBatch;
        if (name === JE_ENTITY) return fallbackEntity;
        throw new Error(`Unexpected GetEntityObject for ${name}`);
      }),
      RunView: vi.fn(async (params: RunViewParams) => {
        if (params.EntityName === JE_ENTITY) {
          // Unhydrated row lacking .Save()
          return { Success: true, Results: [{ ID: jeId1 }] };
        }
        return { Success: true, Results: [] };
      }),
    } as unknown as IMetadataProvider;

    const result = await resumeJournalEntryBatchPosting(batchId, USER, provider);

    expect(result.journalEntriesPosted).toBe(1);
    expect(fallbackEntity.Load).toHaveBeenCalledWith(jeId1);
    expect(fallbackEntity.Status).toBe('GLPosted');
    expect(fallbackEntity.GLPostedAt).toEqual(postedDate);
    expect(fallbackEntity.GLReferenceID).toBe(erpRef);
    expect(fallbackEntity.Save).toHaveBeenCalledTimes(1);
  });
});
