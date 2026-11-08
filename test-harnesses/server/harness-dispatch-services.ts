/**
 * harness-dispatch-services.ts — the batch engine's dispatch services for harnesses and demo seeding.
 *
 * `sendJournalEntryBatch` resolves its approval gate, ERP poster and ERP lookup itself (#233), so a
 * harness can no longer pass `AutoApproveGate` and the mock poster. It registers these instead: every
 * batch counts as approved, every post is accepted without an ERP call, and the ERP offers no lookup.
 * The cancel gate stays the real one.
 *
 * Dev and test databases only. Never import this from a package that ships.
 */
import { MJGlobal } from '@memberjunction/global';
import {
  AutoApproveGate,
  JournalEntryBatchDispatchServices,
  mockErpPoster,
  unavailableErpLookup,
  type ErpJournalLookup,
  type ErpPoster,
  type JournalEntryBatchApprovalGate,
} from '@mj-biz-apps/accounting-core-entities-server';

class HarnessDispatchServices extends JournalEntryBatchDispatchServices {
  public override CreateApprovalGate(): JournalEntryBatchApprovalGate {
    return AutoApproveGate;
  }
  public override CreatePoster(): ErpPoster {
    return mockErpPoster;
  }
  public override CreateLookup(): ErpJournalLookup {
    return unavailableErpLookup;
  }
}

/** Register the harness services above the real ones. Call once, before the first send. */
export function RegisterHarnessDispatchServices(): void {
  MJGlobal.Instance.ClassFactory.Register(JournalEntryBatchDispatchServices, HarnessDispatchServices, null, 1000, true);
}
