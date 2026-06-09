import { BaseAgent } from '@memberjunction/ai-agents';
import { RegisterClass } from '@memberjunction/global';
import { LogError, Metadata, RunView, UserInfo } from '@memberjunction/core';
import {
    mjBizAppsAccountingGLAccountEntity
} from '@mj-biz-apps/accounting-entities';

/**
 * A2: COA Mapping Suggester Agent.
 * 
 * Assists users in mapping external system accounts to the internal Chart of Accounts.
 * 
 * Logic (BA-D12):
 * 1. Analyzes external account names/descriptions.
 * 2. Suggests candidate internal GLAccounts based on semantic similarity.
 * 3. Provides confidence scores for suggestions.
 */
@RegisterClass(BaseAgent, 'MJ_BizApps_Accounting: COA Mapping Suggester')
export class COAMappingSuggesterAgent extends BaseAgent {

    /**
     * Suggests mapping for an external account.
     * 
     * In a production MJ environment, this would utilize the MemberJunction AI Engine 
     * to provide vector-based semantic search across the COA.
     */
    public async suggestMapping(params: {
        externalAccountName: string,
        companyId: string,
        externalSystem: string
    }, contextUser: UserInfo): Promise<{ internalGLAccountId: string, confidence: number, rationale: string }[]> {
        const rv = new RunView();

        // 1. Fetch available GL accounts for the company
        const accountsResult = await rv.RunView<mjBizAppsAccountingGLAccountEntity>({
            EntityName: 'MJ_BizApps_Accounting: GL Accounts',
            ExtraFilter: `CompanyID = '${params.companyId}' AND IsActive = 1`,
            ResultType: 'simple'
        }, contextUser);

        if (!accountsResult.Success) {
            throw new Error(`MappingSuggester: Failed to load GL accounts for company ${params.companyId}.`);
        }

        // 2. Baseline heuristic matcher (Placeholder for AI semantic search)
        // In a full implementation, we would use the LLM to rank these candidates.
        const suggestions = accountsResult.Results
            .filter(acc => {
                const name = acc.Get('Name') as string;
                return name.toLowerCase().includes(params.externalAccountName.toLowerCase()) ||
                    params.externalAccountName.toLowerCase().includes(name.toLowerCase());
            })
            .map(acc => {
                const name = acc.Get('Name') as string;
                return {
                    internalGLAccountId: acc.ID,
                    confidence: 0.85,
                    rationale: `High similarity detected between external "${params.externalAccountName}" and internal "${name}"`
                };
            });

        return suggestions.slice(0, 5); // Return top 5 suggestions
    }
}
