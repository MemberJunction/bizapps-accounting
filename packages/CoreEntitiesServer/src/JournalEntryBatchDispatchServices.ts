/**
 * JournalEntryBatchDispatchServices — where the batch engine gets what authorizes a send or a cancel
 * and what reaches the ERP for it (#233).
 *
 * `sendJournalEntryBatch` and `cancelJournalEntryBatch` used to take their gate, ERP poster and ERP
 * lookup from the caller, so any server caller could pass a gate that allowed everything. The engine
 * now resolves them itself through the MJ ClassFactory; a caller cannot supply them. The one send
 * without an approval Task is `autoPostJournalEntryBatch`, the scheduled-posting waiver.
 *
 * The defaults are the real ones: {@link TasksAppApprovalGate} and the AccountingERPEngine poster and
 * lookup. A
 * subclass registered at a higher priority replaces them — for unit tests, which have no database or
 * ERP, and for a deployment that needs a different gate. Other ERPs' lookups do not need one: the
 * AccountingERPEngine lookup already routes to each ERP's `BaseAccountingERPProvider`.
 *
 * CONNECTS TO:
 *   RESOLVED BY: JournalEntryBatchEngine (sendJournalEntryBatch · autoPostJournalEntryBatch) · JournalEntryBatchEntityServer.Cancel (#214)
 *   DEFAULTS:    ./TasksAppApprovalGate · ./AccountingERPEngine (createAccountingERPPoster · createAccountingERPLookup)
 */
import type { IMetadataProvider } from '@memberjunction/core';
import { MJGlobal, RegisterClass } from '@memberjunction/global';
import { createAccountingERPLookup, createAccountingERPPoster } from './AccountingERPEngine.js';
import type { ErpJournalLookup, ErpPoster, JournalEntryBatchApprovalGate, JournalEntryBatchCancelGate } from './JournalEntryBatchEngine.js';
import { TasksAppApprovalGate } from './TasksAppApprovalGate.js';

@RegisterClass(JournalEntryBatchDispatchServices, null, 0, true)
export class JournalEntryBatchDispatchServices {
  /** The highest-priority registration: the real services unless something replaced them. */
  public static Resolve(): JournalEntryBatchDispatchServices {
    const services = MJGlobal.Instance.ClassFactory.CreateInstance<JournalEntryBatchDispatchServices>(JournalEntryBatchDispatchServices);
    if (!services) throw new Error('JournalEntryBatchDispatchServices: the ClassFactory resolved no instance');
    return services;
  }

  /** Whether a batch is approved to send. */
  public CreateApprovalGate(provider: IMetadataProvider): JournalEntryBatchApprovalGate {
    return new TasksAppApprovalGate(provider);
  }

  /** Who may cancel a batch (a Pending rejection, or a cancel past approval) and where the cancel is recorded. */
  public CreateCancelGate(provider: IMetadataProvider): JournalEntryBatchCancelGate {
    return new TasksAppApprovalGate(provider);
  }

  /** Posts a batch's summary lines to its ERP, all-or-nothing. */
  public CreatePoster(provider: IMetadataProvider): ErpPoster {
    return createAccountingERPPoster(provider);
  }

  /** What the ERP holds under a batch's number, read before every send (#182) and before a Failed batch is cancelled (#207). */
  public CreateLookup(provider: IMetadataProvider): ErpJournalLookup {
    return createAccountingERPLookup(provider);
  }
}
