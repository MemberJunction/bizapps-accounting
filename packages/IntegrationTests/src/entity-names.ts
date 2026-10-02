export const ACCT_ENTITIES = {
    Currency: 'MJ_BizApps_Accounting: Currencies',
    GLRole: 'MJ_BizApps_Accounting: GL Account Roles',
    GLAccount: 'MJ_BizApps_Accounting: GL Accounts',
    JEType: 'MJ_BizApps_Accounting: Journal Entry Types',
    JE: 'MJ_BizApps_Accounting: Journal Entries',
    Company: 'MJ_BizApps_Accounting: Accounting Company Profiles',
    /** MJ core's Company: the IS-A parent of `Company` (the accounting profile) above. */
    MJCompany: 'MJ: Companies',
} as const;
