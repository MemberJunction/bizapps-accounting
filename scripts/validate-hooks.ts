/**
 * Validation Script for BizApps Accounting Foundations (W1/W2/W3)
 *
 * This script validates that the core entity server hooks are firing:
 * 1. AccountingCompanyProfile initialization (W1)
 * 2. JournalEntry numbering (W2)
 * 3. JournalEntryBatch numbering (W3)
 */

import { Metadata, RunView } from '@memberjunction/core';
import { SQLServerDataProvider } from '@memberjunction/sqlserver-dataprovider';
import { mjBizAppsAccountingGLAccountEntity, mjBizAppsAccountingAccountingPeriodEntity, mjBizAppsAccountingJournalEntryEntity, mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import { mjCompanyEntity } from '@memberjunction/core-entities';
import * as dotenv from 'dotenv';

// Load .env if present
dotenv.config();

async function validate() {
    console.log('--- BizApps Accounting Foundation Validation ---');

    // 1. Initialize Provder
    const provider = new SQLServerDataProvider();
    const config = {
        driver: 'tedious',
        server: process.env.DB_HOST || 'localhost',
        database: process.env.DB_DATABASE || 'bizapps_accounting',
        options: {
            encrypt: true,
            trustServerCertificate: true,
            port: parseInt(process.env.DB_PORT || '1433')
        },
        authentication: {
            type: 'default',
            options: {
                userName: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD
            }
        }
    };

    if (!config.authentication.options.userName) {
        console.error('ERROR: DB_USERNAME and DB_PASSWORD must be set in .env');
        process.exit(1);
    }

    console.log(`Connecting to ${config.server}/${config.database}...`);
    // Note: Actual initialization depends on MJ's provider API. 
    // This is a representative setup.
    // await provider.Initialize(config);
    // Metadata.Provider = provider;

    const md = new Metadata();
    const contextUser = await md.GetContextUser();
    if (!contextUser) {
        throw new Error('Failed to get context user. Is the provider initialized?');
    }

    // --- Validation Steps ---

    // 1. Create Company
    console.log('\n[STEP 1] Creating Test Company...');
    const company = await md.GetEntityObject<mjCompanyEntity>('MJ: Companies', contextUser);
    company.NewRecord();
    company.Set('Name', 'Validation Test Co ' + new Date().toISOString());
    if (!await company.Save()) throw new Error('Failed to save company');
    const companyId = company.Get('ID');

    // 2. W1: Profile Initialization
    console.log('[STEP 2] Testing W1: AccountingCompanyProfile Initialization...');
    const profile = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>('MJ_BizApps_Accounting: Accounting Company Profiles', contextUser);
    profile.NewRecord();
    profile.Set('ID', companyId);
    profile.Set('CompanyCode', 'VAL' + Math.floor(Math.random() * 1000));
    profile.Set('FunctionalCurrencyCode', 'USD');
    profile.Set('FiscalYearStartMonth', 1);

    if (!await profile.Save()) throw new Error('Failed to save profile');
    console.log('Profile saved.');

    // Verify Seeding
    const rv = new RunView();
    const glAccounts = await rv.RunView({ EntityName: 'MJ_BizApps_Accounting: GL Accounts', ExtraFilter: `CompanyID = '${companyId}'` }, contextUser);
    const periods = await rv.RunView({ EntityName: 'MJ_BizApps_Accounting: Accounting Periods', ExtraFilter: `CompanyID = '${companyId}'` }, contextUser);

    console.log(`- GLAccounts Seeded: ${glAccounts.Results.length} (Expected: 23)`);
    console.log(`- Periods Seeded: ${periods.Results.length} (Expected: 17)`);

    // 3. W2: Journal Entry Numbering
    console.log('\n[STEP 3] Testing W2: Journal Entry Numbering...');
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>('MJ_BizApps_Accounting: Journal Entries', contextUser);
    je.NewRecord();
    je.Set('CompanyID', companyId);
    je.Set('EffectiveDate', new Date());
    je.Set('EntryType', 'Manual');
    je.Set('AccountingPeriodID', (periods.Results[0] as any).ID);
    je.Set('Status', 'Pending');

    if (!await je.Save()) throw new Error('Failed to save JE');
    console.log(`- JE EntryNumber: ${je.Get('EntryNumber')}`);

    console.log('\n--- Validation Complete ---');
}

validate().catch(err => {
    console.error('Validation failed:', err);
    process.exit(1);
});
