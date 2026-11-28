import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { RunViewParams, RunViewResult, UserInfo } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../..');

const UUID_V4_UPPER = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/;

const USER_A_ID = '11111111-1111-4111-8111-111111111111';
const USER_B_ID = '22222222-2222-4222-8222-222222222222';
const COMPANY_ALPHA_ID = 'A0000001-0001-4001-8001-000000000001';
const COMPANY_BETA_ID = 'B0000002-0002-4002-8002-000000000002';
const CHIEF_OF_STAFF_AGENT_ID = '33333333-3333-4333-8333-333333333333';
const PEPPER_AGENT_A_ID = '44444444-4444-4444-8444-444444444444';
const PEPPER_AGENT_B_ID = '55555555-5555-4555-8555-555555555555';

interface SkillMetadataRecord {
    fields: {
        Name: string;
        Description: string;
        Instructions: string;
        Status: string;
        ActivationMode: string;
        Category?: string;
        IconClass?: string;
        CreatedByUserID: string;
    };
    relatedEntities: {
        'MJ: AI Agent Skills': Array<{
            fields: { AgentID: string; SkillID: string; Status: string };
            primaryKey: { ID: string };
        }>;
    };
    primaryKey: { ID: string };
}

interface JournalEntrySummaryRow {
    ID: string;
    EntryNumber: string;
    CompanyID: string;
    Status: 'Pending' | 'Batched' | 'GLPosted';
    PredictedAnomalyRiskBand: 'Low' | 'Medium' | 'High' | 'Critical' | null;
}

interface BatchSummaryRow {
    ID: string;
    JournalEntryBatchNumber: string;
    CompanyID: string;
    Status: 'Pending' | 'Approved' | 'Sent' | 'Posted' | 'Failed' | 'Cancelled' | 'Archived';
    TotalDebits: number;
    ErrorMessage: string | null;
}

interface FinanceExceptionRow {
    ID: string;
    CompanyID: string;
    Summary: string;
    Status: 'Open' | 'Reviewed' | 'Corrected';
    Amount: number | null;
}

interface PersonalAgentInstance {
    ID: string;
    Name: string;
    BaseAgentID: string;
    ForUserID: string;
}

function assertNoSyncBlocks(node: object | Array<object | string | number | boolean | null>, path = '$'): void {
    if (Array.isArray(node)) {
        node.forEach((item, index) => {
            if (item !== null && typeof item === 'object') {
                assertNoSyncBlocks(item, `${path}[${index}]`);
            }
        });
        return;
    }
    expect(Object.prototype.hasOwnProperty.call(node, 'sync'), `Unexpected "sync" block at ${path}`).toBe(false);
    for (const [key, value] of Object.entries(node)) {
        if (value !== null && typeof value === 'object') {
            assertNoSyncBlocks(value, `${path}.${key}`);
        }
    }
}

function makeUser(id: string, name: string, email: string): UserInfo {
    return { ID: id, Name: name, Email: email } as UserInfo;
}

function resolveInheritedSkills(
    personalAgent: PersonalAgentInstance,
    templateAgentId: string,
    templateSkills: string[],
): string[] {
    return UUIDsEqual(personalAgent.BaseAgentID, templateAgentId) ? [...templateSkills] : [];
}

/**
 * Typed RunView harness modeling company-scoped RLS for BizApps Accounting entities.
 * Every read evaluates against the calling user's authorized companies — zero raw SQL.
 */
class RlsScopedAccountingRunView {
    private readonly entries: JournalEntrySummaryRow[];
    private readonly batches: BatchSummaryRow[];
    private readonly exceptions: FinanceExceptionRow[];
    private readonly userCompanies: Map<string, string[]>;

    constructor(
        entries: JournalEntrySummaryRow[],
        batches: BatchSummaryRow[],
        exceptions: FinanceExceptionRow[],
        userCompanies: Map<string, string[]>,
    ) {
        this.entries = entries;
        this.batches = batches;
        this.exceptions = exceptions;
        this.userCompanies = userCompanies;
    }

    private isCompanyAuthorized(userId: string, companyId: string): boolean {
        const allowed = this.userCompanies.get(userId) ?? [];
        return allowed.some((id) => UUIDsEqual(id, companyId));
    }

    public async RunView<T>(params: RunViewParams, contextUser?: UserInfo): Promise<RunViewResult<T>> {
        if (!contextUser?.ID) {
            return {
                Success: false,
                Results: [],
                UserViewRunID: '',
                RowCount: 0,
                TotalRowCount: 0,
                ExecutionTime: 0,
                ErrorMessage: 'ContextUser is required for RLS evaluation.',
            };
        }

        if (params.EntityName === 'MJ_BizApps_Accounting: Journal Entries') {
            const rows = this.entries.filter((row) => this.isCompanyAuthorized(contextUser.ID, row.CompanyID));
            return this.ok(rows as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Accounting: Journal Entry Batches') {
            const rows = this.batches.filter((row) => this.isCompanyAuthorized(contextUser.ID, row.CompanyID));
            return this.ok(rows as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Accounting: Finance Exceptions') {
            const rows = this.exceptions.filter((row) => this.isCompanyAuthorized(contextUser.ID, row.CompanyID));
            return this.ok(rows as T[]);
        }

        return {
            Success: false,
            Results: [],
            UserViewRunID: '',
            RowCount: 0,
            TotalRowCount: 0,
            ExecutionTime: 0,
            ErrorMessage: `Unsupported entity: ${params.EntityName}`,
        };
    }

    private ok<T>(rows: T[]): RunViewResult<T> {
        return {
            Success: true,
            Results: rows,
            UserViewRunID: '',
            RowCount: rows.length,
            TotalRowCount: rows.length,
            ExecutionTime: 1,
            ErrorMessage: '',
        };
    }
}

interface CloseReadinessBrief {
    openExceptionSummaries: string[];
    flaggedEntryNumbers: string[];
    failedBatchNumbers: string[];
    totalPendingBatchDebits: number;
}

async function buildCloseReadinessBrief(
    rv: RlsScopedAccountingRunView,
    contextUser: UserInfo,
): Promise<CloseReadinessBrief> {
    const [entriesRes, batchesRes, exceptionsRes] = await Promise.all([
        rv.RunView<JournalEntrySummaryRow>({ EntityName: 'MJ_BizApps_Accounting: Journal Entries' }, contextUser),
        rv.RunView<BatchSummaryRow>({ EntityName: 'MJ_BizApps_Accounting: Journal Entry Batches' }, contextUser),
        rv.RunView<FinanceExceptionRow>({ EntityName: 'MJ_BizApps_Accounting: Finance Exceptions' }, contextUser),
    ]);

    if (!entriesRes.Success || !batchesRes.Success || !exceptionsRes.Success) {
        throw new Error('Failed to load accounting close readiness view.');
    }

    return {
        openExceptionSummaries: exceptionsRes.Results.filter((e) => e.Status === 'Open').map((e) => e.Summary),
        flaggedEntryNumbers: entriesRes.Results.filter(
            (e) => e.PredictedAnomalyRiskBand === 'High' || e.PredictedAnomalyRiskBand === 'Critical',
        ).map((e) => e.EntryNumber),
        failedBatchNumbers: batchesRes.Results.filter((b) => b.Status === 'Failed').map(
            (b) => b.JournalEntryBatchNumber,
        ),
        totalPendingBatchDebits: batchesRes.Results.filter((b) => b.Status === 'Pending').reduce(
            (sum, b) => sum + b.TotalDebits,
            0,
        ),
    };
}

describe('BizApps Accounting Chief of Staff skill', () => {
    describe('metadata & auto-install integrity', () => {
        it('wires metadata/chief-of-staff-skills into mj-app.json and metadata/.mj-sync.json', () => {
            const manifest = JSON.parse(readFileSync(resolve(REPO_ROOT, 'mj-app.json'), 'utf8')) as {
                metadata?: { directory?: string };
            };
            expect(manifest.metadata?.directory).toBe('metadata');

            const rootSync = JSON.parse(readFileSync(resolve(REPO_ROOT, 'metadata/.mj-sync.json'), 'utf8')) as {
                directoryOrder: string[];
            };
            expect(rootSync.directoryOrder).toContain('chief-of-staff-skills');
            expect(rootSync.directoryOrder.indexOf('chief-of-staff-skills')).toBeGreaterThan(
                rootSync.directoryOrder.indexOf('actions'),
            );

            const folderSync = JSON.parse(
                readFileSync(resolve(REPO_ROOT, 'metadata/chief-of-staff-skills/.mj-sync.json'), 'utf8'),
            ) as { entity: string; pull: { filter: string; relatedEntities: Record<string, object> } };
            expect(folderSync.entity).toBe('MJ: AI Skills');
            expect(folderSync.pull.filter).toContain('Accounting & Subledger');
            expect(folderSync.pull.relatedEntities['MJ: AI Agent Skills']).toBeDefined();
        });

        it('defines valid UUIDv4 primary keys, zero sync blocks, Chief of Staff grant, and real accounting entities', () => {
            const skillPath = resolve(
                REPO_ROOT,
                'metadata/chief-of-staff-skills/.chief-of-staff-accounting-skill.json',
            );
            const records = JSON.parse(readFileSync(skillPath, 'utf8')) as SkillMetadataRecord[];
            expect(records).toHaveLength(1);

            const skill = records[0];
            assertNoSyncBlocks(records);
            expect(skill.primaryKey.ID).toMatch(UUID_V4_UPPER);
            expect(skill.fields.Name).toBe('Accounting & Subledger');
            expect(skill.fields.Status).toBe('Active');
            expect(skill.fields.ActivationMode).toBe('Auto');
            expect(skill.fields.CreatedByUserID).toBe('@lookup:MJ: Users.Name=System');

            const grants = skill.relatedEntities['MJ: AI Agent Skills'];
            expect(grants).toHaveLength(1);
            expect(grants[0].primaryKey.ID).toMatch(UUID_V4_UPPER);
            expect(grants[0].fields.AgentID).toBe('@lookup:MJ: AI Agents.Name=Chief of Staff');
            expect(grants[0].fields.SkillID).toBe('@parent:ID');
            expect(grants[0].fields.Status).toBe('Active');

            const pepperA: PersonalAgentInstance = {
                ID: PEPPER_AGENT_A_ID,
                Name: 'Pepper',
                BaseAgentID: CHIEF_OF_STAFF_AGENT_ID,
                ForUserID: USER_A_ID,
            };
            expect(resolveInheritedSkills(pepperA, CHIEF_OF_STAFF_AGENT_ID, [skill.fields.Name])).toEqual([
                'Accounting & Subledger',
            ]);

            expect(skill.fields.Instructions.startsWith('@file:')).toBe(true);
            const relTemplate = skill.fields.Instructions.slice('@file:'.length);
            const templatePath = resolve(REPO_ROOT, 'metadata/chief-of-staff-skills', relTemplate);
            expect(existsSync(templatePath)).toBe(true);
            const markdown = readFileSync(templatePath, 'utf8');
            for (const entityName of [
                'MJ_BizApps_Accounting: Accounting Company Profiles',
                'MJ_BizApps_Accounting: GL Accounts',
                'MJ_BizApps_Accounting: Journal Entries',
                'MJ_BizApps_Accounting: Journal Entry Lines',
                'MJ_BizApps_Accounting: Journal Entry Batches',
                'MJ_BizApps_Accounting: Finance Exceptions',
                'MJ_BizApps_Accounting: Tax Liabilities',
                'MJ_BizApps_Accounting: Dimensions',
            ]) {
                expect(markdown).toContain(entityName);
            }
            expect(markdown).toContain('RunView');
            expect(markdown).toMatch(/never raw SQL/i);
        });
    });

    describe('two-user RLS isolation', () => {
        it('returns strictly company-scoped close-readiness answers for User A vs User B invoking the same skill', async () => {
            const userA = makeUser(USER_A_ID, 'Alpha Controller', 'controller@alpha.example');
            const userB = makeUser(USER_B_ID, 'Beta Controller', 'controller@beta.example');

            const pepperA: PersonalAgentInstance = {
                ID: PEPPER_AGENT_A_ID,
                Name: 'Pepper (Alpha)',
                BaseAgentID: CHIEF_OF_STAFF_AGENT_ID,
                ForUserID: USER_A_ID,
            };
            const pepperB: PersonalAgentInstance = {
                ID: PEPPER_AGENT_B_ID,
                Name: 'Pepper (Beta)',
                BaseAgentID: CHIEF_OF_STAFF_AGENT_ID,
                ForUserID: USER_B_ID,
            };
            expect(resolveInheritedSkills(pepperA, CHIEF_OF_STAFF_AGENT_ID, ['Accounting & Subledger'])).toEqual(
                resolveInheritedSkills(pepperB, CHIEF_OF_STAFF_AGENT_ID, ['Accounting & Subledger']),
            );

            const rv = new RlsScopedAccountingRunView(
                [
                    {
                        ID: 'E1111111-1111-4111-8111-111111111111',
                        EntryNumber: 'JE-ALPHA-001',
                        CompanyID: COMPANY_ALPHA_ID,
                        Status: 'Pending',
                        PredictedAnomalyRiskBand: 'High',
                    },
                    {
                        ID: 'E2222222-2222-4222-8222-222222222222',
                        EntryNumber: 'JE-BETA-009',
                        CompanyID: COMPANY_BETA_ID,
                        Status: 'Pending',
                        PredictedAnomalyRiskBand: 'Critical',
                    },
                ],
                [
                    {
                        ID: 'B1111111-1111-4111-8111-111111111111',
                        JournalEntryBatchNumber: 'BATCH-ALPHA-01',
                        CompanyID: COMPANY_ALPHA_ID,
                        Status: 'Pending',
                        TotalDebits: 12500,
                        ErrorMessage: null,
                    },
                    {
                        ID: 'B2222222-2222-4222-8222-222222222222',
                        JournalEntryBatchNumber: 'BATCH-BETA-99',
                        CompanyID: COMPANY_BETA_ID,
                        Status: 'Failed',
                        TotalDebits: 84000,
                        ErrorMessage: 'ERP token expired',
                    },
                ],
                [
                    {
                        ID: 'F1111111-1111-4111-8111-111111111111',
                        CompanyID: COMPANY_ALPHA_ID,
                        Summary: 'Alpha missing tax nexus mapping',
                        Status: 'Open',
                        Amount: 420,
                    },
                    {
                        ID: 'F2222222-2222-4222-8222-222222222222',
                        CompanyID: COMPANY_BETA_ID,
                        Summary: 'Beta unmapped deferred revenue account',
                        Status: 'Open',
                        Amount: 19500,
                    },
                ],
                new Map<string, string[]>([
                    [USER_A_ID, [COMPANY_ALPHA_ID]],
                    [USER_B_ID, [COMPANY_BETA_ID]],
                ]),
            );

            const [briefA, briefB] = await Promise.all([
                buildCloseReadinessBrief(rv, userA),
                buildCloseReadinessBrief(rv, userB),
            ]);

            expect(briefA).toEqual({
                openExceptionSummaries: ['Alpha missing tax nexus mapping'],
                flaggedEntryNumbers: ['JE-ALPHA-001'],
                failedBatchNumbers: [],
                totalPendingBatchDebits: 12500,
            });
            expect(briefB).toEqual({
                openExceptionSummaries: ['Beta unmapped deferred revenue account'],
                flaggedEntryNumbers: ['JE-BETA-009'],
                failedBatchNumbers: ['BATCH-BETA-99'],
                totalPendingBatchDebits: 0,
            });

            // Missing ContextUser fails closed
            const unauth = await rv.RunView<JournalEntrySummaryRow>(
                { EntityName: 'MJ_BizApps_Accounting: Journal Entries' },
                undefined,
            );
            expect(unauth.Success).toBe(false);
            expect(unauth.Results).toEqual([]);
        });
    });
});
