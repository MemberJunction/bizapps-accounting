import { describe, it, expect } from 'vitest';
import { NormalizeUUID } from '@memberjunction/global';
import {
  CompanyApprovers,
  MayArchiveBatch,
  MayCancelApprovedBatch,
  MayCancelPendingBatch,
  MayDecideBatch,
} from '../lib/custom/JournalEntryBatchDispatch/batch-action-permission';

/**
 * Tier 1 for who sees the batch actions the server gates on the signed-in user (#308, #339). Each
 * rule mirrors a server check in TasksAppApprovalGate; the server stays the authority.
 */
const COMPANY_ID = '00000000-0000-0000-0000-0000000000C1';
const APPROVER = '00000000-0000-0000-0000-0000000000A1';
const BUILDER = '00000000-0000-0000-0000-0000000000B1';
const APPROVED_BY = '00000000-0000-0000-0000-0000000000D1';
const OTHER = '00000000-0000-0000-0000-0000000000F1';

const APPROVERS: CompanyApprovers = new Map([[NormalizeUUID(COMPANY_ID), APPROVER]]);
/** What a failed approver read leaves. */
const NO_APPROVERS: CompanyApprovers = new Map();

describe('MayDecideBatch (Approve / Reject)', () => {
  const batch = { CompanyID: COMPANY_ID, BatchedByUserID: BUILDER };

  it("lets the company's approver decide", () => {
    expect(MayDecideBatch(batch, APPROVER, APPROVERS)).toBe(true);
  });

  it('matches IDs in either case', () => {
    expect(MayDecideBatch(batch, APPROVER.toLowerCase(), APPROVERS)).toBe(true);
  });

  it('refuses the approver on a batch they built (separation of duties)', () => {
    expect(MayDecideBatch({ ...batch, BatchedByUserID: APPROVER }, APPROVER, APPROVERS)).toBe(false);
  });

  it('refuses the builder and anyone else', () => {
    expect(MayDecideBatch(batch, BUILDER, APPROVERS)).toBe(false);
    expect(MayDecideBatch(batch, OTHER, APPROVERS)).toBe(false);
  });

  it('refuses everyone when no approver is known', () => {
    expect(MayDecideBatch(batch, APPROVER, NO_APPROVERS)).toBe(false);
  });

  it('refuses when nobody is signed in', () => {
    expect(MayDecideBatch(batch, undefined, APPROVERS)).toBe(false);
  });
});

describe('MayCancelApprovedBatch (Cancel on an Approved or Failed batch)', () => {
  const batch = { CompanyID: COMPANY_ID, ApprovedByUserID: APPROVED_BY };

  it("lets the company's approver and the user who approved the batch cancel", () => {
    expect(MayCancelApprovedBatch(batch, APPROVER, APPROVERS)).toBe(true);
    expect(MayCancelApprovedBatch(batch, APPROVED_BY, APPROVERS)).toBe(true);
  });

  it('refuses anyone else, the builder included', () => {
    expect(MayCancelApprovedBatch(batch, OTHER, APPROVERS)).toBe(false);
    expect(MayCancelApprovedBatch(batch, BUILDER, APPROVERS)).toBe(false);
  });

  it('still lets the user who approved the batch cancel when the approver read failed', () => {
    expect(MayCancelApprovedBatch(batch, APPROVED_BY, NO_APPROVERS)).toBe(true);
    expect(MayCancelApprovedBatch(batch, APPROVER, NO_APPROVERS)).toBe(false);
  });

  it('lets only the approver cancel a batch with no recorded approver', () => {
    const unrecorded = { ...batch, ApprovedByUserID: null };
    expect(MayCancelApprovedBatch(unrecorded, APPROVER, APPROVERS)).toBe(true);
    expect(MayCancelApprovedBatch(unrecorded, OTHER, APPROVERS)).toBe(false);
  });

  it('refuses when nobody is signed in', () => {
    expect(MayCancelApprovedBatch(batch, undefined, APPROVERS)).toBe(false);
  });
});

describe('MayCancelPendingBatch (Cancel on a Pending batch)', () => {
  const batch = { Status: 'Pending' as const, CompanyID: COMPANY_ID, BatchedByUserID: BUILDER };

  it("lets the company's approver and the builder cancel, and no one else", () => {
    expect(MayCancelPendingBatch(batch, APPROVER, APPROVERS)).toBe(true);
    expect(MayCancelPendingBatch(batch, BUILDER, APPROVERS)).toBe(true);
    expect(MayCancelPendingBatch(batch, OTHER, APPROVERS)).toBe(false);
  });
});

describe('MayArchiveBatch (Archive, #448)', () => {
  const batch = { CompanyID: COMPANY_ID, BatchedByUserID: BUILDER, ApprovedByUserID: APPROVED_BY };

  it("lets only the company's approver archive a Pending batch — not the builder, who may cancel it", () => {
    const pending = { ...batch, Status: 'Pending' as const };
    expect(MayArchiveBatch(pending, APPROVER, APPROVERS)).toBe(true);
    expect(MayArchiveBatch(pending, BUILDER, APPROVERS)).toBe(false);
    expect(MayCancelPendingBatch(pending, BUILDER, APPROVERS)).toBe(true);
    expect(MayArchiveBatch(pending, APPROVED_BY, APPROVERS)).toBe(false);
    expect(MayArchiveBatch(pending, OTHER, APPROVERS)).toBe(false);
  });

  it.each(['Approved', 'Failed'] as const)("lets the company's approver and the batch's approver archive a %s batch, not the builder", (status) => {
    const past = { ...batch, Status: status };
    expect(MayArchiveBatch(past, APPROVER, APPROVERS)).toBe(true);
    expect(MayArchiveBatch(past, APPROVED_BY, APPROVERS)).toBe(true);
    expect(MayArchiveBatch(past, BUILDER, APPROVERS)).toBe(false);
    expect(MayArchiveBatch(past, OTHER, APPROVERS)).toBe(false);
  });

  it('shows nothing to a user with no ID', () => {
    expect(MayArchiveBatch({ ...batch, Status: 'Pending' }, undefined, NO_APPROVERS)).toBe(false);
  });
});
