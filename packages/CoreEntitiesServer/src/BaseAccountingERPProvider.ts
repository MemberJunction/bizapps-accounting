/**
 * Abstract ERP plugin for AccountingERPEngine. One subclass per Integration.Name.
 * The base calls MJ verbs; subclasses only override what is actually different.
 */
import { RegisterClass, RequiresSubclass } from '@memberjunction/global';
import { UserInfo } from '@memberjunction/core';
import type { AccountingVerbRunner } from './AccountingVerbRunner.js';
import type { ErpPostResult } from './JournalEntryBatchEngine.js';

export interface CreateERPJournalInput {
  CompanyID: string;
  EntryDate: Date;
  DocNumber?: string;
  PrivateNote?: string;
  Lines: Array<{
    accountNumber: string;
    debit?: number;
    credit?: number;
    description?: string;
  }>;
}

@RequiresSubclass()
export abstract class BaseAccountingERPProvider {
  /** Must match MJ: Integrations.Name (e.g. 'QuickBooks Online'). */
  abstract get IntegrationName(): string;

  constructor(protected readonly runVerb: AccountingVerbRunner) {}

  async CreateJournalEntry(input: CreateERPJournalInput, user: UserInfo): Promise<ErpPostResult> {
    const result = await this.runVerb({
      Verb: 'CreateJournalEntry',
      CompanyID: input.CompanyID,
      User: user,
      Params: {
        EntryDate: input.EntryDate.toISOString().slice(0, 10),
        DocNumber: input.DocNumber,
        PrivateNote: input.PrivateNote,
        Lines: input.Lines,
      },
    });
    if (!result.Success) {
      return { success: false, error: result.Message ?? result.ResultCode };
    }
    const id = result.Params?.find((p) => p.Name === 'JournalEntryID')?.Value;
    return { success: true, externalJournalEntryBatchRef: id != null ? String(id) : undefined };
  }
}

@RegisterClass(BaseAccountingERPProvider, 'Microsoft Dynamics 365 Business Central')
export class BusinessCentralERPProvider extends BaseAccountingERPProvider {
  get IntegrationName(): string {
    return 'Microsoft Dynamics 365 Business Central';
  }
}

@RegisterClass(BaseAccountingERPProvider, 'QuickBooks Online')
export class QuickBooksERPProvider extends BaseAccountingERPProvider {
  get IntegrationName(): string {
    return 'QuickBooks Online';
  }
}

export function LoadAccountingERPProviders(): void {}
