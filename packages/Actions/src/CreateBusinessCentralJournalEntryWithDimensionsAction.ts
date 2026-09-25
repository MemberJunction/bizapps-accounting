/**
 * Business Central journal posting WITH the journal lines' dimension tags.
 *
 * WHY THIS EXISTS. MJ's `CreateBusinessCentralJournalEntryAction` builds each BC journal line from
 * account / amount / posting date / document number / description and ignores `line.dimensions`
 * entirely — its QuickBooks sibling already consumes that field. A fully tagged batch therefore
 * lands in Business Central with no dimensions, and the consolidated chart cannot report by
 * venture, product, new-vs-renewal, event or counterparty. This subclass closes that gap from the
 * app side, leaving the MJ platform untouched.
 *
 * KNOWN, ACCEPTED FOOTPRINT. Registering for the plugin key
 * `CreateJournalEntry:Microsoft Dynamics 365 Business Central` overrides Business Central journal
 * posting for EVERY app in the instance, not just Accounting. That is undesirable but predictable,
 * which is the trade this repo makes rather than editing the platform.
 *
 * HOW DIMENSIONS REACH BC. The standard API v2.0 `journalLine` resource has NO
 * `shortcutDimension1Code` / `shortcutDimension2Code` properties — its writable fields are account,
 * amount, dates, document numbers, description, tax and balancing account. The only dimension
 * surface is the `dimensionSetLines` child collection, which accepts POST with `journalLine` as a
 * parent. So every dimension travels the same way, and BC derives Shortcut Dimension 1 and 2 on the
 * posted G/L entry from the dimension set — the two global dimensions land in their slots on their
 * own, provided they are configured as global dimensions in that BC company.
 *
 * WHY THE WHOLE POST LOOP IS RESTATED. `mapToBCJournalLine`, `resolveGeneralJournal` and
 * `deleteCreatedJournalLines` are all PRIVATE on the MJ class, so there is no seam to extend;
 * `InternalRunAction` is the only override point. The protected helpers on the BC base
 * (`makeBCRequest`, `formatBCDate`, `getParamValue`, `validateJournalEntryBalance`) and the
 * package's shared journal helpers are reused rather than copied.
 */
import { RegisterClass } from '@memberjunction/global';
import { LogError } from '@memberjunction/core';
import { ActionParam, ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { BaseAction } from '@memberjunction/actions';
import {
  ACCOUNTING_VERBS,
  CreateBusinessCentralJournalEntryAction,
  ERP_INTEGRATION,
  erpPluginKey,
  journalEntryBalanceError,
  parseAndValidateJournalEntryLines,
  totalDebits,
  type JournalEntryLine,
} from '@memberjunction/actions-bizapps-accounting';

/** The subset of BC's `journal` resource this action reads. */
interface BCJournal {
  id: string;
  code?: string;
  displayName?: string;
  balancingAccountNumber?: string | null;
}

/** The subset of BC's `journalLine` resource a create returns. */
interface BCJournalLineResult {
  id?: string;
  documentNumber?: string;
}

/** How many staged lines the pre-write check reads: enough to name what is there, not to page it all. */
const STAGED_LINES_SAMPLE = 20;

type AccountingContextUser = NonNullable<RunActionParams['ContextUser']>;

@RegisterClass(BaseAction, erpPluginKey(ACCOUNTING_VERBS.CreateJournalEntry, ERP_INTEGRATION.BusinessCentral))
export class CreateBusinessCentralJournalEntryWithDimensionsAction extends CreateBusinessCentralJournalEntryAction {

  public get Description(): string {
    return 'Creates a balanced journal entry in Microsoft Dynamics 365 Business Central, tagging each line with its dimensions, and posts the batch';
  }

  protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
    try {
      const contextUser = params.ContextUser;
      if (!contextUser) {
        return this.errorResult('Context user is required for Business Central API calls', params.Params);
      }

      this.params = params.Params;

      const lines = parseAndValidateJournalEntryLines(this.getParamValue(params.Params, 'Lines'));
      if (!this.validateJournalEntryBalance(lines)) {
        return journalEntryBalanceError(params.Params);
      }

      const resolved = await this.resolveJournal(this.getParamValue(params.Params, 'JournalCode'), contextUser);
      if (!resolved.journal) {
        return this.errorResult(resolved.error ?? 'No general journal found in Business Central.', params.Params);
      }

      const staged = await this.stagedLinesError(resolved.journal, contextUser);
      if (staged) {
        return this.errorResult(staged, params.Params);
      }

      return await this.writeAndPost(resolved.journal, lines, params, contextUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return this.errorResult(message, params.Params);
    }
  }

  /**
   * Write every line (with its dimension tags) and then post the batch. Any failure before the post
   * deletes the lines already written: a half-tagged or half-written batch must never reach the GL,
   * and BC cascades a line's dimension set lines when the line itself is deleted.
   */
  private async writeAndPost(
    journal: BCJournal,
    lines: JournalEntryLine[],
    params: RunActionParams,
    contextUser: AccountingContextUser,
  ): Promise<ActionResultSimple> {
    const postingDate = this.formatBCDate(this.entryDateOf(params));
    const docNumber = this.getParamValue(params.Params, 'DocNumber');
    const description = this.getParamValue(params.Params, 'PrivateNote')
      || this.getParamValue(params.Params, 'Description');

    const createdLineIds: string[] = [];
    try {
      let lastLine: BCJournalLineResult | undefined;
      for (let i = 0; i < lines.length; i++) {
        lastLine = await this.makeBCRequest<BCJournalLineResult>(
          `journals(${journal.id})/journalLines`,
          'POST',
          this.mapJournalLine(lines[i], i, postingDate, docNumber, description),
          contextUser,
        );
        if (lastLine?.id) {
          createdLineIds.push(lastLine.id);
        }
        await this.writeLineDimensions(lines[i], i, lastLine?.id, contextUser);
      }

      await this.makeBCRequest(`journals(${journal.id})/Microsoft.NAV.post`, 'POST', undefined, contextUser);

      return this.successResult(journal, docNumber || lastLine?.documentNumber || '', lines, params.Params);
    } catch (postError) {
      await this.deleteJournalLines(createdLineIds, contextUser);
      throw postError;
    }
  }

  /**
   * Refuse to write into a journal that already holds unposted lines. `Microsoft.NAV.post` posts the
   * WHOLE journal, so any line already there goes to the GL with this entry. Lines get left behind
   * when a post is rejected (a closed posting date, say) and the compensating delete then fails; a
   * retry would write the batch a second time beside them and post both, doubling the GL under one
   * document number, and the pre-send lookup cannot see them because it reads posted G/L entries
   * only (#182). The same applies to lines staged by hand in BC. Returns the error, or null when the
   * journal is empty.
   */
  private async stagedLinesError(journal: BCJournal, contextUser: AccountingContextUser): Promise<string | null> {
    const response = await this.queryBC<{ value?: BCJournalLineResult[] }>(
      `journals(${journal.id})/journalLines`, [], ['id', 'documentNumber'], [], undefined, STAGED_LINES_SAMPLE, contextUser,
    );
    if (!Array.isArray(response?.value)) {
      return `Could not read the lines of Business Central journal '${journal.code ?? journal.id}' before posting.`;
    }
    if (response.value.length === 0) {
      return null;
    }
    const documents = [...new Set(response.value.map(l => l.documentNumber || '(none)'))].join(', ');
    const count = response.value.length >= STAGED_LINES_SAMPLE ? `${STAGED_LINES_SAMPLE} or more` : String(response.value.length);
    return `Business Central journal '${journal.code ?? journal.id}' already holds ${count} unposted line(s), document number(s) ${documents}. ` +
      'Posting would send them to the GL with this entry. Post or delete them in Business Central, then retry.';
  }

  /**
   * POST one `dimensionSetLines` child per tag on the line. A tagged line whose create returned no
   * id is an error rather than a skip — posting it would silently drop exactly the tags this action
   * exists to carry.
   */
  private async writeLineDimensions(
    line: JournalEntryLine,
    index: number,
    lineId: string | undefined,
    contextUser: AccountingContextUser,
  ): Promise<void> {
    const dimensions = (line.dimensions ?? []).filter(d => d.code && d.valueCode);
    if (dimensions.length === 0) {
      return;
    }
    if (!lineId) {
      throw new Error(
        `Line ${index + 1}: Business Central returned no line id, so its ${dimensions.length} dimension tag(s) cannot be written.`,
      );
    }
    for (const dimension of dimensions) {
      await this.makeBCRequest(
        `journalLines(${lineId})/dimensionSetLines`,
        'POST',
        { code: dimension.code, valueCode: dimension.valueCode },
        contextUser,
      );
    }
  }

  /** BC journal line body. Dimensions are NOT line fields — they are a child collection. */
  private mapJournalLine(
    line: JournalEntryLine,
    index: number,
    postingDate: string,
    documentNumber: string | undefined,
    batchDescription: string | undefined,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      lineNumber: (index + 1) * 10000,
      accountType: 'G/L Account',
      postingDate,
      amount: line.debit != null ? line.debit : -(line.credit || 0),
      description: line.description || batchDescription || '',
    };
    if (documentNumber) {
      body.documentNumber = documentNumber;
    }
    // AM-4: accountNumber wins. Sending both lets a stale accountId override the number.
    if (line.accountNumber) {
      body.accountNumber = line.accountNumber;
    } else if (line.accountId) {
      body.accountId = line.accountId;
    }
    return body;
  }

  /**
   * Pick the journal to write into. A journal with a balancing account would add an extra line to a
   * self-balanced multi-line entry, so those are refused (named) or skipped (auto-selected).
   */
  private async resolveJournal(
    journalCode: string | undefined,
    contextUser: AccountingContextUser,
  ): Promise<{ journal?: BCJournal; error?: string }> {
    const response = await this.makeBCRequest<{ value: BCJournal[] }>('journals', 'GET', undefined, contextUser);
    const journals = response?.value || [];
    if (journals.length === 0) {
      return { error: 'This Business Central company has no journals.' };
    }

    if (journalCode) {
      const match = journals.find(j => j.code === journalCode);
      if (!match) {
        return { error: `JournalCode '${journalCode}' does not exist in Business Central.` };
      }
      if (match.balancingAccountNumber) {
        return {
          error: `Journal '${journalCode}' has a balancing account; posting a self-balanced multi-line entry would add an extra line. Use a journal without a balancing account.`,
        };
      }
      return { journal: match };
    }

    const unbalancing = journals.filter(j => !j.balancingAccountNumber);
    const preferred = unbalancing.find(j => {
      const code = (j.code || '').toUpperCase();
      return code === 'GENERAL' || code === 'DEFAULT';
    }) || unbalancing[0];
    if (!preferred) {
      return {
        error: 'No general journal without a balancing account found. Pass JournalCode for an unbalanced journal, or configure a GENERAL/DEFAULT journal without a balancing account.',
      };
    }
    return { journal: preferred };
  }

  /** Compensating delete: orphan lines left by a failed write would go to the GL on the next post. */
  private async deleteJournalLines(lineIds: string[], contextUser: AccountingContextUser): Promise<void> {
    for (const lineId of lineIds) {
      try {
        await this.makeBCRequest(`journalLines(${lineId})`, 'DELETE', undefined, contextUser);
      } catch (cleanupError) {
        const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        LogError(`CreateBusinessCentralJournalEntryWithDimensions: failed to delete orphan journalLines(${lineId}): ${message}`);
      }
    }
  }

  private entryDateOf(params: RunActionParams): Date {
    const raw = this.getParamValue(params.Params, 'EntryDate');
    return raw ? new Date(raw) : new Date();
  }

  private successResult(
    journal: BCJournal, docNumber: string, lines: JournalEntryLine[], params: ActionParam[],
  ): ActionResultSimple {
    const outputParams: ActionParam[] = [
      { Name: 'JournalEntryID', Value: journal.id, Type: 'Output' },
      { Name: 'DocNumber', Value: docNumber, Type: 'Output' },
      { Name: 'TotalAmount', Value: totalDebits(lines), Type: 'Output' },
    ];
    return {
      Success: true,
      ResultCode: 'SUCCESS',
      Params: [...params, ...outputParams],
      Message: `Journal entry ${docNumber || journal.id} posted successfully`,
    };
  }

  private errorResult(message: string, params: ActionParam[]): ActionResultSimple {
    return { Success: false, ResultCode: 'ERROR', Message: message, Params: params };
  }
}

/** Tree-shaking anchor — the class must be imported for its @RegisterClass to run. */
export function LoadCreateBusinessCentralJournalEntryWithDimensionsAction(): void {}
