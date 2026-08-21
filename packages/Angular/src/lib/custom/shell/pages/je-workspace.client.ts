import { IRemoteOperationProvider, LogError } from '@memberjunction/core';
import type { CreateJournalEntryInput, CreateJournalEntryOutput } from '@mj-biz-apps/accounting-engine-base';

/**
 * Thin typed client for the manual-JE Remote Operation (§8.1 JE workspace).
 *
 * Same shape + rationale as `JournalEntryBatchWorkspaceClient`: `Accounting.CreateJournalEntry` is a Remote
 * Operation, so `provider.RouteOperation` marshals it for us — this file exists to give the
 * component typed I/O, not to hand-roll transport.
 *
 * ONE deliberate difference from the batch client: a validation failure is NOT thrown. The engine's
 * contract puts LOGICAL failures inside the output (`Success:false` + typed `Errors[]` carrying
 * `Code`/`LineIndex`), and reserves the RemoteOpResult wrapper for transport/authorization faults.
 * The workspace wants those per-line errors ON the lines, so we surface the output as-is and throw
 * only when the CALL itself failed.
 *
 * CONNECTS TO:
 *   SERVER: CreateJournalEntryOperation ('Accounting.CreateJournalEntry') → AccountingEngine
 *   TYPES:  @mj-biz-apps/accounting-engine-base (contract.ts) — imported, never restated
 */
export class JEWorkspaceClient {
  /**
   * Submit a draft. Returns the engine's typed output — including a validated failure.
   * Throws ONLY on a transport/authorization fault, which the component treats as a page-level error.
   */
  public async Create(provider: IRemoteOperationProvider, draft: CreateJournalEntryInput): Promise<CreateJournalEntryOutput> {
    const res = await provider.RouteOperation<CreateJournalEntryInput, CreateJournalEntryOutput>(
      'Accounting.CreateJournalEntry',
      draft,
    );
    if (!res.Success || !res.Output) {
      const msg = res.ErrorMessage ?? 'Could not submit the entry.';
      LogError(`JEWorkspaceClient.Create: ${msg}`);
      throw new Error(msg);
    }
    return res.Output;
  }
}
