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
 * lookup. Other ERPs' lookups do not need a replacement: the AccountingERPEngine lookup already routes
 * to each ERP's `BaseAccountingERPProvider`.
 *
 * A subclass registered at a higher priority replaces them only where that is deliberate (#452): in a
 * unit-test run, which has no database or ERP, or when the server's environment names the subclass in
 * {@link DISPATCH_SERVICES_OVERRIDE_ENV}. Anywhere else, any server package loaded into the process
 * could register a gate that approves everything, so the replacement is logged as an error and the
 * real services are used. An allowed replacement is logged too, so it is never silent.
 *
 * CONNECTS TO:
 *   RESOLVED BY: JournalEntryBatchEngine (sendJournalEntryBatch · autoPostJournalEntryBatch) · JournalEntryBatchEntityServer.Cancel (#214)
 *   DEFAULTS:    ./TasksAppApprovalGate · ./AccountingERPEngine (createAccountingERPPoster · createAccountingERPLookup)
 *                · ./FinanceExceptions (RaiseFinanceExceptions)
 */
import { LogError, LogStatus, type IMetadataProvider } from '@memberjunction/core';
import { MJGlobal, RegisterClass } from '@memberjunction/global';
import type { AccountingRaiseFinanceExceptionsInput, AccountingRaiseFinanceExceptionsOutput } from '@mj-biz-apps/accounting-entities';
import { createAccountingERPLookup, createAccountingERPPoster } from './AccountingERPEngine.js';
import { RaiseFinanceExceptions } from './FinanceExceptions.js';
import type { ErpJournalLookup, ErpPoster, JournalEntryBatchApprovalGate, JournalEntryBatchCancelGate } from './JournalEntryBatchEngine.js';
import { TasksAppApprovalGate } from './TasksAppApprovalGate.js';

/**
 * The environment variable that allows a replacement outside unit tests: the class name of the one
 * registered subclass the deployment means to use.
 */
export const DISPATCH_SERVICES_OVERRIDE_ENV = 'ACCOUNTING_DISPATCH_SERVICES_OVERRIDE';

/** Whether this process is a unit-test run; Vitest sets VITEST in every worker. */
function isUnitTestRun(): boolean {
  return !!process.env.VITEST;
}

@RegisterClass(JournalEntryBatchDispatchServices, null, 0, true)
export class JournalEntryBatchDispatchServices {
  /**
   * The highest-priority registration when its replacement of the real services is allowed (see the
   * file header); otherwise the real services.
   */
  public static Resolve(): JournalEntryBatchDispatchServices {
    const services = MJGlobal.Instance.ClassFactory.CreateInstance<JournalEntryBatchDispatchServices>(JournalEntryBatchDispatchServices);
    if (!services) throw new Error('Batches cannot be sent: no batch dispatch services are registered on this server.');
    if (services.constructor === JournalEntryBatchDispatchServices) return services;
    return JournalEntryBatchDispatchServices.allowedReplacement(services);
  }

  /** `replacement` when it may stand in for the real services, logged either way; otherwise the real services. */
  private static allowedReplacement(replacement: JournalEntryBatchDispatchServices): JournalEntryBatchDispatchServices {
    const name = replacement.constructor.name;
    if (isUnitTestRun() || process.env[DISPATCH_SERVICES_OVERRIDE_ENV] === name) {
      LogStatus(`JournalEntryBatchDispatchServices: batch send and cancel are using the replacement ${name} for the approval gate, ERP poster and ERP lookup.`);
      return replacement;
    }
    LogError(
      `JournalEntryBatchDispatchServices: ${name} is registered to replace the batch approval gate, ERP poster and ERP lookup, ` +
      `but ${DISPATCH_SERVICES_OVERRIDE_ENV} does not name it; using the real services.`,
    );
    return new JournalEntryBatchDispatchServices();
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

  /** Raises finance exceptions for what a send found, such as an ERP that rejected the batch (golive #316). */
  public RaiseFinanceExceptions(
    input: AccountingRaiseFinanceExceptionsInput, provider: IMetadataProvider,
  ): Promise<AccountingRaiseFinanceExceptionsOutput> {
    return RaiseFinanceExceptions(input, provider);
  }
}
