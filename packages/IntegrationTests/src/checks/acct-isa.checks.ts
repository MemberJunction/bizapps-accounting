/**
 * acct-isa — MemberJunction's IS-A (Table-Per-Type) machinery on a real database, over GraphQL, through
 * accounting's IS-A child: AccountingCompanyProfile (__mj_BizAppsAccounting) IS-A MJ: Companies
 * (MJ core's __mj.Company). One ID, two schemas.
 *
 * I1 promotion: an existing Company gains its profile (AttachToParent); one Company row, same ID,
 *    values kept. AttachToParent on an ID with no Company returns false.
 * I2 a Company and its profile created in one save through the child: both rows, one ID.
 * I3 loading the Company as MJ: Companies finds its profile (ISAChild, LeafEntity) through MJ's
 *    cross-schema child probe.
 * I4 the profile's view carries the Company's columns: RunView filters and sorts on them.
 * I5 a Company field changed through the profile is saved to __mj.Company.
 * I6 a profile write the database refuses rolls back the Company created in the same save.
 * I7 deleting the profile deletes its Company too (MJ's rule for a disjoint parent).
 * I8 Delete() on a loaded Company with its profile linked removes both and returns (MJ#4850).
 *
 * MJ ships no IS-A entity and tests IS-A only against mocks, and the profile is what makes a company
 * an accounting company. Each failure here is silent data damage: a second Company row, a Company
 * orphaned by a failed save, a delete that never returns.
 *
 * Over GraphQL the client opens no transaction. The parent's save and delete are skipped on the
 * client and the leaf's one mutation carries the chain, which MJAPI runs in its own transaction (I6
 * proves it is there). So nothing here rolls back: each check makes its own rows (a Company named
 * `ISA fixture <check> <run>`, an inactive profile coded `ISA-<check>-<run>`), finds them by that
 * name, and removes them in a finally. I3, I7 and I8 read MJ: Companies' AllowMultipleSubtypes from
 * the loaded metadata and require it false (disjoint) rather than assume it.
 */
import { randomUUID } from 'node:crypto';
import { CompositeKey, LogError, type BaseEntity, type EntityInfo } from '@memberjunction/core';
import { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import {
    Assert,
    AssertEqual,
    IntegrationCheckRegistry,
    type IntegrationCheckContext,
    type NamedCheck,
} from '@memberjunction/testing-integration/registry';
import { ACCT_ENTITIES } from '../entity-names.js';
import { RequireSave, SameID, View } from '../wire.js';

type ProfileEntity = mjBizAppsAccountingAccountingCompanyProfileEntity;

/**
 * The MJ: Companies fields these checks touch. MJCompanyEntity is in @memberjunction/core-entities,
 * which this package does not depend on; the profile mirrors the same Company columns (IS-A), so
 * their types come from its generated class. At runtime the object is the registered MJCompanyEntity.
 */
type CompanyEntity = BaseEntity & Pick<ProfileEntity, 'ID' | 'Name' | 'Description' | 'Website'>;

/** The Company columns a fixture sets, on a Company or on the profile (IS-A routes them up). */
type CompanyColumns = Pick<ProfileEntity, 'Name' | 'Description' | 'Website'>;

interface Fixture {
    /** Unique `__mj.Company.Name`: how the read-backs and the cleanup find this check's rows. */
    Name: string;
    Description: string;
    Website: string;
    /** Unique `AccountingCompanyProfile.CompanyCode` (2–20 of A-Z, 0-9, _ and -). */
    CompanyCode: string;
}

interface CompanyRow {
    ID: string;
    Name: string;
    Description: string;
    Website: string | null;
}

interface ProfileRow {
    ID: string;
    CompanyCode: string;
}

/** A profile-view row: the profile's own column beside two the view joins in from __mj.Company. */
interface ProfileViewRow extends ProfileRow {
    Name: string;
    Description: string;
}

/** How long a Delete() may take before a check calls it hung (MJ#4850). */
const DELETE_SETTLE_MS = 30_000;

/** Eight hex digits per run, so neither a rerun nor a concurrent run shares a fixture. */
function newRun(): string {
    return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

function newFixture(check: string, run: string = newRun()): Fixture {
    return {
        Name: `ISA fixture ${check} ${run}`,
        Description: `IS-A integration fixture ${check} (safe to delete)`,
        Website: `https://${check.toLowerCase()}-${run.toLowerCase()}.isa-fixture.invalid`,
        CompanyCode: `ISA-${check}-${run}`,
    };
}

function stageCompany(entity: CompanyColumns, fixture: Fixture): void {
    entity.Name = fixture.Name;
    entity.Description = fixture.Description;
    entity.Website = fixture.Website;
}

/**
 * The profile's own required columns. Inactive, so a row a failed cleanup leaves behind stays out of
 * acct-world.AW3 (every active company) and batching.
 */
function stageProfile(profile: ProfileEntity, fixture: Fixture, currency: string): void {
    profile.CompanyCode = fixture.CompanyCode;
    profile.FunctionalCurrencyCode = currency;
    profile.IsActive = false;
}

async function newEntity<T extends BaseEntity>(ctx: IntegrationCheckContext, entityName: string): Promise<T> {
    const entity = await ctx.Provider.GetEntityObject<T>(entityName, ctx.User);
    Assert(!!entity, `GetEntityObject returned no ${entityName} object`);
    return entity;
}

/** A NEW Company and its profile in ONE save through the child: MJ's whole-chain create. */
async function createProfiledCompany(ctx: IntegrationCheckContext, fixture: Fixture, currency: string): Promise<ProfileEntity> {
    const profile = await newEntity<ProfileEntity>(ctx, ACCT_ENTITIES.Company);
    profile.NewRecord();
    stageCompany(profile, fixture);
    stageProfile(profile, fixture, currency);
    await RequireSave(profile, `fixture ${fixture.Name}`);
    return profile;
}

/** Loads a Company as MJ: Companies. Its InnerLoad runs IS-A child discovery. */
async function loadCompany(ctx: IntegrationCheckContext, id: string, check: string): Promise<CompanyEntity> {
    const company = await newEntity<CompanyEntity>(ctx, ACCT_ENTITIES.MJCompany);
    Assert(await company.InnerLoad(CompositeKey.FromID(id)), `${check}: ${ACCT_ENTITIES.MJCompany} ${id} did not load`);
    return company;
}

async function loadProfile(ctx: IntegrationCheckContext, id: string, check: string): Promise<ProfileEntity> {
    const profile = await newEntity<ProfileEntity>(ctx, ACCT_ENTITIES.Company);
    Assert(await profile.Load(id), `${check}: ${ACCT_ENTITIES.Company} ${id} did not load`);
    return profile;
}

function entityInfo(ctx: IntegrationCheckContext, entityName: string): EntityInfo {
    const info = ctx.Provider.EntityByName(entityName);
    if (!info) {
        throw new Error(`metadata has no ${entityName}`);
    }
    return info;
}

/** Without Entity.ParentID every check below fails for a reason it does not name. */
function assertProfileIsCompanyChild(ctx: IntegrationCheckContext): void {
    const profile = entityInfo(ctx, ACCT_ENTITIES.Company);
    const company = entityInfo(ctx, ACCT_ENTITIES.MJCompany);
    Assert(
        SameID(profile.ParentID, company.ID),
        `${ACCT_ENTITIES.Company} is not an IS-A child of ${ACCT_ENTITIES.MJCompany} (Entity.ParentID is not set): codegen-schema-info.json never reached this database`,
    );
}

/**
 * Reads AllowMultipleSubtypes as loaded. Discovery (I3) and the delete rules (I7, I8) differ for an
 * overlapping parent, and any app that extends MJ: Companies could flip the flag for all of them.
 */
function assertCompanyIsDisjoint(ctx: IntegrationCheckContext): void {
    Assert(
        !entityInfo(ctx, ACCT_ENTITIES.MJCompany).AllowMultipleSubtypes,
        `${ACCT_ENTITIES.MJCompany} has AllowMultipleSubtypes = true (overlapping); this repo treats the profile as its DISJOINT child`,
    );
}

function sameEntityName(left: string, right: string): boolean {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function asProfile(entity: BaseEntity | null, what: string): ProfileEntity {
    if (entity instanceof mjBizAppsAccountingAccountingCompanyProfileEntity) {
        return entity;
    }
    throw new Error(`${what} is ${entity ? entity.EntityInfo.Name : 'null'}, not a ${ACCT_ENTITIES.Company} object`);
}

/** An active shipped currency for FunctionalCurrencyCode (an FK to Currency.Code): USD when present. */
async function fixtureCurrency(ctx: IntegrationCheckContext): Promise<string> {
    const res = await View(ctx).RunView<{ Code: string; IsActive: boolean | number }>(
        { EntityName: ACCT_ENTITIES.Currency, Fields: ['Code', 'IsActive'], ResultType: 'simple' },
        ctx.User,
    );
    Assert(res.Success, res.ErrorMessage ?? 'currencies');
    const active = (res.Results ?? []).filter((r) => r.IsActive === true || r.IsActive === 1).map((r) => r.Code);
    Assert(active.length > 0, 'no active currency for a fixture profile: push accounting metadata');
    return active.find((code) => code === 'USD') ?? active[0];
}

function namesIn(names: string[]): string {
    return `Name IN (${names.map((name) => `'${name}'`).join(', ')})`;
}

/** MJ: Companies rows. BypassCache: the table, not a cache entry an earlier save left behind. */
async function companyRows(ctx: IntegrationCheckContext, filter: string): Promise<CompanyRow[]> {
    const res = await View(ctx).RunView<CompanyRow>(
        {
            EntityName: ACCT_ENTITIES.MJCompany,
            ExtraFilter: filter,
            Fields: ['ID', 'Name', 'Description', 'Website'],
            ResultType: 'simple',
            BypassCache: true,
        },
        ctx.User,
    );
    Assert(res.Success, res.ErrorMessage ?? `${ACCT_ENTITIES.MJCompany} where ${filter}`);
    return res.Results ?? [];
}

/** Profile rows by their own CompanyCode column, so the lookup needs nothing from the parent join. */
async function profilesCoded(ctx: IntegrationCheckContext, code: string): Promise<ProfileRow[]> {
    const res = await View(ctx).RunView<ProfileRow>(
        {
            EntityName: ACCT_ENTITIES.Company,
            ExtraFilter: `CompanyCode = '${code}'`,
            Fields: ['ID', 'CompanyCode'],
            ResultType: 'simple',
            BypassCache: true,
        },
        ctx.User,
    );
    Assert(res.Success, res.ErrorMessage ?? `${ACCT_ENTITIES.Company} coded ${code}`);
    return res.Results ?? [];
}

/** Neither row is left: the Company by its fixture name, the profile by its code. */
async function assertFixtureGone(ctx: IntegrationCheckContext, fixture: Fixture, check: string): Promise<void> {
    AssertEqual((await companyRows(ctx, namesIn([fixture.Name]))).length, 0, `${check}: ${ACCT_ENTITIES.MJCompany} rows named ${fixture.Name} after the delete`);
    AssertEqual((await profilesCoded(ctx, fixture.CompanyCode)).length, 0, `${check}: profile rows coded ${fixture.CompanyCode} after the delete`);
}

/**
 * Delete() raced against a timer. An IS-A delete that hands off to its leaf used to wait on itself
 * and never return (MJ#4850, fixed in MJ#4891); without the race that regression hangs the suite.
 */
async function deleteWithin(entity: BaseEntity, what: string): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const hung = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
            () => reject(new Error(`${what}: Delete() did not return within ${DELETE_SETTLE_MS / 1000}s, the IS-A delete hang of MJ#4850`)),
            DELETE_SETTLE_MS,
        );
    });
    try {
        return await Promise.race([entity.Delete(), hung]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

/** Why a Delete() failed. A parent that handed the delete to its leaf has the result on the leaf. */
function deleteFailure(entity: BaseEntity): string {
    return entity.LeafEntity.LatestResult?.CompleteMessage || entity.LatestResult?.CompleteMessage || 'no message';
}

async function removeRow(ctx: IntegrationCheckContext, entityName: string, id: string): Promise<void> {
    try {
        const entity = await newEntity<BaseEntity>(ctx, entityName);
        if (!(await entity.InnerLoad(CompositeKey.FromID(id)))) {
            LogError(`acct-isa cleanup: ${entityName} ${id} did not load, so it was not deleted`);
        } else if (!(await deleteWithin(entity, `acct-isa cleanup of ${entityName} ${id}`))) {
            LogError(`acct-isa cleanup: ${entityName} ${id} did not delete: ${deleteFailure(entity)}`);
        }
    } catch (e: unknown) {
        LogError(`acct-isa cleanup of ${entityName} ${id} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
}

/**
 * Removes a check's rows by their unique Company names, never by a remembered ID a failed create may
 * not have. Profiles first (each takes its Company with it), then any Company left without one.
 * Never throws: a failure is logged, so it cannot hide the check's own result.
 */
async function removeFixtures(ctx: IntegrationCheckContext, fixtures: Fixture[]): Promise<void> {
    const names = fixtures.map((f) => f.Name);
    for (const entityName of [ACCT_ENTITIES.Company, ACCT_ENTITIES.MJCompany]) {
        try {
            const res = await View(ctx).RunView<{ ID: string }>(
                { EntityName: entityName, ExtraFilter: namesIn(names), Fields: ['ID'], ResultType: 'simple', BypassCache: true },
                ctx.User,
            );
            if (!res.Success) {
                LogError(`acct-isa cleanup: looking up ${entityName} rows named ${names.join(', ')} failed: ${res.ErrorMessage}`);
                continue;
            }
            for (const row of res.Results ?? []) {
                await removeRow(ctx, entityName, row.ID);
            }
        } catch (e: unknown) {
            LogError(`acct-isa cleanup of ${entityName} rows named ${names.join(', ')} failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}

/** AttachToParent on a key with no Company row: false, and the record is the fresh chain it was. */
async function assertAttachToMissingCompanyFails(ctx: IntegrationCheckContext): Promise<void> {
    const orphan = await newEntity<ProfileEntity>(ctx, ACCT_ENTITIES.Company);
    orphan.NewRecord();
    const mintedID = orphan.ID;
    Assert(!(await orphan.AttachToParent(CompositeKey.FromID(randomUUID()))), 'I1: AttachToParent returned true for an ID with no Company row');
    Assert(
        SameID(orphan.ID, mintedID) && !orphan.IsSaved && orphan.ISAParent?.IsSaved === false,
        'I1: a failed AttachToParent did not leave the profile a fresh chain on its own key',
    );
    // The Company object still links back to the profile after the failed load (MJ#4870, fixed in MJ#4891).
    Assert(orphan.ISAParent?.LeafEntity === orphan, 'I1: after a failed AttachToParent the Company object no longer links to its profile (MJ#4870)');
}

/** Promotion UPDATEs the existing Company and INSERTs only the profile, both under the Company's ID. */
async function assertPromoted(ctx: IntegrationCheckContext, fixture: Fixture, companyID: string): Promise<void> {
    const companies = await companyRows(ctx, namesIn([fixture.Name]));
    AssertEqual(companies.length, 1, `I1: ${ACCT_ENTITIES.MJCompany} rows named ${fixture.Name} (a second one means promotion inserted a Company)`);
    const company = companies[0];
    Assert(SameID(company.ID, companyID), `I1: the Company named ${fixture.Name} is ${company.ID}, not the promoted ${companyID}`);
    AssertEqual(company.Description, fixture.Description, 'I1: promotion overwrote the Company Description');
    AssertEqual(company.Website, fixture.Website, 'I1: promotion overwrote the Company Website');
    const profiles = await profilesCoded(ctx, fixture.CompanyCode);
    AssertEqual(profiles.length, 1, `I1: profile rows coded ${fixture.CompanyCode}`);
    Assert(SameID(profiles[0].ID, companyID), `I1: the profile row is ${profiles[0].ID}, not the Company's ${companyID}`);
}

/** One profile-view row: the profile's own column beside the Company's, under the saved ID. */
function assertViewRow(row: ProfileViewRow, fixture: Fixture, profile: ProfileEntity): void {
    Assert(SameID(row.ID, profile.ID), `I4: ${fixture.Name} came back as ${row.ID}, saved as ${profile.ID}`);
    AssertEqual(row.Description, fixture.Description, `I4: the view's Description for ${fixture.Name} is not the Company's`);
    AssertEqual(row.CompanyCode, fixture.CompanyCode, `I4: the view's CompanyCode for ${fixture.Name}`);
}

const checks: NamedCheck[] = [
    {
        Id: 'acct-isa.I1',
        Name: 'I1 — promotion: an existing Company gains its profile; one Company row, same ID, values kept',
        RequiresMutation: true,
        Fn: async (ctx) => {
            assertProfileIsCompanyChild(ctx);
            const currency = await fixtureCurrency(ctx);
            const fixture = newFixture('I1');
            try {
                const company = await newEntity<CompanyEntity>(ctx, ACCT_ENTITIES.MJCompany);
                company.NewRecord();
                stageCompany(company, fixture);
                await RequireSave(company, `I1: ${ACCT_ENTITIES.MJCompany} ${fixture.Name}`);
                await assertAttachToMissingCompanyFails(ctx);

                const profile = await newEntity<ProfileEntity>(ctx, ACCT_ENTITIES.Company);
                profile.NewRecord();
                Assert(await profile.AttachToParent(CompositeKey.FromID(company.ID)), `I1: AttachToParent returned false for Company ${company.ID}`);
                Assert(SameID(profile.ID, company.ID), `I1: the profile holds ${profile.ID}, not the Company's ${company.ID}`);
                AssertEqual(profile.Name, fixture.Name, 'I1: the attached profile does not read the loaded Company');
                // The loaded Company still links back to this profile (MJ#4870, fixed in MJ#4891).
                Assert(profile.ISAParent?.LeafEntity === profile, 'I1: the loaded Company does not link back to its new profile (MJ#4870)');
                stageProfile(profile, fixture, currency);
                await RequireSave(profile, `I1: profile for ${fixture.Name}`);

                await assertPromoted(ctx, fixture, company.ID);
            } finally {
                await removeFixtures(ctx, [fixture]);
            }
        },
    },
    {
        Id: 'acct-isa.I2',
        Name: 'I2 — a Company and its profile created in one save through the child: both rows, one ID',
        RequiresMutation: true,
        Fn: async (ctx) => {
            assertProfileIsCompanyChild(ctx);
            const currency = await fixtureCurrency(ctx);
            const fixture = newFixture('I2');
            try {
                const profile = await createProfiledCompany(ctx, fixture, currency);
                const companies = await companyRows(ctx, namesIn([fixture.Name]));
                AssertEqual(companies.length, 1, `I2: ${ACCT_ENTITIES.MJCompany} rows named ${fixture.Name}`);
                AssertEqual(companies[0].Description, fixture.Description, 'I2: a Company column set on the profile did not reach __mj.Company');
                const profiles = await profilesCoded(ctx, fixture.CompanyCode);
                AssertEqual(profiles.length, 1, `I2: profile rows coded ${fixture.CompanyCode}`);
                Assert(SameID(companies[0].ID, profiles[0].ID), `I2: the Company is ${companies[0].ID} and its profile ${profiles[0].ID}`);
                Assert(SameID(profile.ID, profiles[0].ID), `I2: the saved profile holds ${profile.ID}, the database ${profiles[0].ID}`);
            } finally {
                await removeFixtures(ctx, [fixture]);
            }
        },
    },
    {
        Id: 'acct-isa.I3',
        Name: 'I3 — loading the Company as MJ: Companies finds its profile: ISAChild and LeafEntity are the loaded profile',
        RequiresMutation: true,
        Fn: async (ctx) => {
            assertProfileIsCompanyChild(ctx);
            assertCompanyIsDisjoint(ctx);
            const currency = await fixtureCurrency(ctx);
            const fixture = newFixture('I3');
            try {
                const created = await createProfiledCompany(ctx, fixture, currency);
                const company = await loadCompany(ctx, created.ID, 'I3');
                // FindISAChildEntity probes each child's base view in the child's own schema: here
                // __mj_BizAppsAccounting.vwAccountingCompanyProfiles, for an __mj.Company ID.
                const child = company.ISAChild;
                Assert(
                    child !== null && sameEntityName(child.EntityInfo.Name, ACCT_ENTITIES.Company),
                    `I3: ISAChild is ${child ? child.EntityInfo.Name : 'null'}; child discovery did not find the ${ACCT_ENTITIES.Company} row`,
                );
                const loaded = asProfile(child, 'I3: ISAChild');
                Assert(company.LeafEntity === loaded, 'I3: LeafEntity is not the discovered profile');
                Assert(company.ISAChildren === null, 'I3: the disjoint Company listed ISAChildren, as an overlapping parent does');
                Assert(loaded.ISAParent === company, 'I3: the discovered profile does not share the chain; its ISAParent is another Company object');
                Assert(SameID(loaded.ID, created.ID), `I3: the discovered profile holds ${loaded.ID}, not ${created.ID}`);
                AssertEqual(loaded.CompanyCode, fixture.CompanyCode, 'I3: the discovered profile did not load its own fields (CompanyCode)');
                AssertEqual(loaded.FunctionalCurrencyCode, currency, 'I3: the discovered profile did not load its own fields (FunctionalCurrencyCode)');
            } finally {
                await removeFixtures(ctx, [fixture]);
            }
        },
    },
    {
        Id: 'acct-isa.I4',
        Name: 'I4 — the profile view carries the Company columns: RunView filters and sorts profiles on Company Name',
        RequiresMutation: true,
        Fn: async (ctx) => {
            assertProfileIsCompanyChild(ctx);
            const currency = await fixtureCurrency(ctx);
            const run = newRun();
            const fixtures = [newFixture('I4A', run), newFixture('I4B', run)];
            try {
                const saved: ProfileEntity[] = [];
                for (const fixture of fixtures) {
                    saved.push(await createProfiledCompany(ctx, fixture, currency));
                }
                const res = await View(ctx).RunView<ProfileViewRow>(
                    {
                        EntityName: ACCT_ENTITIES.Company,
                        ExtraFilter: namesIn(fixtures.map((f) => f.Name)),
                        OrderBy: 'Name DESC',
                        Fields: ['ID', 'Name', 'Description', 'CompanyCode'],
                        ResultType: 'simple',
                        BypassCache: true,
                    },
                    ctx.User,
                );
                Assert(res.Success, res.ErrorMessage ?? 'I4: profile view filtered on the Company Name');
                const rows = res.Results ?? [];
                // The names differ only in I4A/I4B, so Name DESC puts I4B first under any collation.
                AssertEqual(rows.map((r) => r.Name).join(' | '), `${fixtures[1].Name} | ${fixtures[0].Name}`, 'I4: profiles filtered on Name, sorted Name DESC');
                assertViewRow(rows[0], fixtures[1], saved[1]);
                assertViewRow(rows[1], fixtures[0], saved[0]);
            } finally {
                await removeFixtures(ctx, fixtures);
            }
        },
    },
    {
        Id: 'acct-isa.I5',
        Name: 'I5 — a Company field changed and saved through the profile updates __mj.Company',
        RequiresMutation: true,
        Fn: async (ctx) => {
            assertProfileIsCompanyChild(ctx);
            const currency = await fixtureCurrency(ctx);
            const fixture = newFixture('I5');
            try {
                const created = await createProfiledCompany(ctx, fixture, currency);
                const profile = await loadProfile(ctx, created.ID, 'I5');
                const edited = `${fixture.Description}, edited through the profile`;
                profile.Description = edited; // a Company column: routed to the MJ: Companies parent
                await RequireSave(profile, 'I5: profile with an edited Company Description');

                const companies = await companyRows(ctx, namesIn([fixture.Name]));
                AssertEqual(companies.length, 1, `I5: ${ACCT_ENTITIES.MJCompany} rows named ${fixture.Name}`);
                Assert(SameID(companies[0].ID, created.ID), `I5: the Company named ${fixture.Name} is ${companies[0].ID}, not ${created.ID}`);
                AssertEqual(companies[0].Description, edited, 'I5: __mj.Company.Description did not change; the chain saved the profile without its Company');
            } finally {
                await removeFixtures(ctx, [fixture]);
            }
        },
    },
    {
        Id: 'acct-isa.I6',
        Name: 'I6 — a profile write the database refuses rolls back the Company created in the same save',
        RequiresMutation: true,
        Fn: async (ctx) => {
            assertProfileIsCompanyChild(ctx);
            const currency = await fixtureCurrency(ctx);
            const fixture = newFixture('I6');
            try {
                const profile = await newEntity<ProfileEntity>(ctx, ACCT_ENTITIES.Company);
                profile.NewRecord();
                stageCompany(profile, fixture);
                stageProfile(profile, fixture, currency);
                // A well-formed UUID with no MJ: Users row passes client validation. On the server
                // the Company INSERT runs first, then the profile INSERT fails FK_ACP_ApprovalCFOUser.
                profile.ApprovalCFOUserID = randomUUID();
                const mintedID = profile.ID;

                Assert(!(await profile.Save()), 'I6: a profile whose ApprovalCFOUserID names no user saved');
                const refusal = profile.LatestResult?.CompleteMessage ?? '';
                Assert(
                    refusal.includes('FK_ACP_ApprovalCFOUser'),
                    `I6: the save failed, but not on the profile's own INSERT, so it proves nothing about rollback: ${refusal || 'no message'}`,
                );
                // Nothing continues inside the failed transaction: it is MJAPI's own (outermost, on a
                // per-request provider), and each read below is a new request. So it does not matter
                // whether SQL Server dooms it; MJ rolls it back either way. By ID and by name, since a
                // client that let the server mint the key would be checking an ID nobody stored.
                const byName = namesIn([fixture.Name]);
                const survivors = await companyRows(ctx, mintedID ? `ID = '${mintedID}' OR ${byName}` : byName);
                AssertEqual(survivors.length, 0, 'I6: Company rows left by the failed save (it was not atomic)');
            } finally {
                await removeFixtures(ctx, [fixture]);
            }
        },
    },
    {
        Id: 'acct-isa.I7',
        Name: 'I7 — deleting the profile deletes its Company too (MJ\'s rule for a disjoint parent)',
        RequiresMutation: true,
        Fn: async (ctx) => {
            assertProfileIsCompanyChild(ctx);
            assertCompanyIsDisjoint(ctx);
            const currency = await fixtureCurrency(ctx);
            const fixture = newFixture('I7');
            try {
                const created = await createProfiledCompany(ctx, fixture, currency);
                const profile = await loadProfile(ctx, created.ID, 'I7');
                // MJ's contract today, not an accounting decision: a disjoint parent goes with its
                // child (shouldDeleteParentAfterChildDelete). MJAPI deletes both in one transaction.
                Assert(await deleteWithin(profile, 'I7: profile'), `I7: deleting the profile failed: ${deleteFailure(profile)}`);
                await assertFixtureGone(ctx, fixture, 'I7');
            } finally {
                await removeFixtures(ctx, [fixture]);
            }
        },
    },
    {
        Id: 'acct-isa.I8',
        Name: 'I8 — Delete() on a loaded Company with its profile linked removes both rows and returns (MJ#4850)',
        RequiresMutation: true,
        Fn: async (ctx) => {
            assertProfileIsCompanyChild(ctx);
            assertCompanyIsDisjoint(ctx);
            const currency = await fixtureCurrency(ctx);
            const fixture = newFixture('I8');
            try {
                const created = await createProfiledCompany(ctx, fixture, currency);
                const company = await loadCompany(ctx, created.ID, 'I8');
                Assert(
                    sameEntityName(company.LeafEntity.EntityInfo.Name, ACCT_ENTITIES.Company),
                    'I8: the loaded Company did not link its profile, so Delete() has no leaf to hand off to',
                );
                // Delete() hands off to the leaf, which deletes itself and then calls back up to this
                // Company. That call used to wait on this Delete() and never return (MJ#4850, fixed in MJ#4891).
                Assert(await deleteWithin(company, `I8: ${ACCT_ENTITIES.MJCompany}`), `I8: deleting the Company failed: ${deleteFailure(company)}`);
                await assertFixtureGone(ctx, fixture, 'I8');
            } finally {
                await removeFixtures(ctx, [fixture]);
            }
        },
    },
];

for (const c of checks) IntegrationCheckRegistry.Instance.Register(c);
IntegrationCheckRegistry.Instance.RegisterLifecycle('acct-isa', { Setup: async () => {}, Teardown: async () => {} });
