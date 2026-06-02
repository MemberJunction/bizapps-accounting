/** @type {import('@memberjunction/config').MJConfig} */
module.exports = {
  /**
   * MemberJunction v3.0 Minimal Distribution Configuration
   *
   * This config leverages the minimal configuration system where most settings
   * come from package defaults:
   * - Database settings → Environment variables (via config schema defaults)
   * - CodeGen settings → DEFAULT_CODEGEN_CONFIG (@memberjunction/codegen-lib)
   *
   * You only need to specify:
   * 1. Environment variables in .env file (database, auth)
   * 2. Deployment-specific settings (output paths, commands) - BELOW
   * 3. Any settings you want to override from the defaults
   */

  // ============================================================================
  // DEPLOYMENT-SPECIFIC CONFIGURATION (Required)
  // ============================================================================

  /**
   * Output paths for code generation
   * These are specific to this distribution's directory structure
   */
  // Single-package (string) form: CodeGen generates THIS app's entity subclasses
  // into packages/Entities and imports them as '@mj-biz-apps/accounting-entities'
  // everywhere (resolvers, Angular forms, hand-written server code).
  //
  // NOTE: We intentionally do NOT use the schema→package MAP form that
  // `mj app install` writes. The map treats every listed schema as "external,
  // skip local generation" (see CodeGenLib getExternalEntitySchemas), which is
  // for pure OpenApp consumers. This repo is the app under DEVELOPMENT and
  // hand-wires its dependency (bizapps-common) in apps/MJAPI/src/index.ts, so
  // we must generate accounting locally and pull common from its installed
  // npm packages instead. Common is kept out of CodeGen via excludeSchemas below.
  entityPackageName: '@mj-biz-apps/accounting-entities',

  // Additional schema info CodeGen can't infer from the DB. Declares the
  // AccountingCompanyProfile IS-A Company (Table-Per-Type) inheritance so
  // CodeGen sets Entity.ParentID, mirrors Company fields as virtual fields on
  // the profile, and JOINs __mj.Company in vwAccountingCompanyProfiles.
  additionalSchemaInfo: 'codegen-schema-info.json',

  output: [
    { type: 'SQL', directory: './SQL Scripts/generated', appendOutputCode: true },
    {
      type: 'Angular',
      directory: './packages/Angular/src/lib/generated',
      options: [{ name: 'maxComponentsPerModule', value: 20 }],
    },
    { type: 'GraphQLServer', directory: './packages/Server/src/generated' },
    { type: 'ActionSubclasses', directory: './packages/Actions/src/generated' },
    { type: 'EntitySubclasses', directory: './packages/Entities/src/generated' },
    { type: 'DBSchemaJSON', directory: './Schema Files' },
  ],

  /**
   * Build commands to run after code generation.
   */
  commands: [
    { workingDirectory: './packages/Entities', command: 'npm', args: ['run', 'build'], when: 'after' },
    { workingDirectory: './packages/Actions',  command: 'npm', args: ['run', 'build'], when: 'after' },
    { workingDirectory: './packages/Server',   command: 'npm', args: ['run', 'build'], when: 'after' },
    { workingDirectory: './packages/Angular',  command: 'npm', args: ['run', 'build'], when: 'after' },
  ],

  /**
   * Open App installer layout. This distribution puts its server/client apps
   * under apps/ (not the MJ-repo default of packages/MJAPI + packages/MJExplorer),
   * so the `mj app install` orchestrator needs these paths to wire dependency
   * apps (e.g. bizapps-common) into the right workspaces.
   */
  openApps: {
    serverPackagePath: 'apps/MJAPI',
    clientPackagePath: 'apps/MJExplorer',
  },

  // ============================================================================
  // OPTIONAL OVERRIDES
  // ============================================================================
  // Everything below this line is OPTIONAL. These settings have sensible defaults
  // in DEFAULT_SERVER_CONFIG and DEFAULT_CODEGEN_CONFIG.
  //
  // Uncomment and modify only if you need to override the defaults.
  // ============================================================================

  // ---------------------------------------------------------------------------
  // CodeGen Settings Overrides
  // ---------------------------------------------------------------------------
  // Default: [
  //   { name: 'mj_core_schema', value: '__mj' },
  //   { name: 'skip_database_generation', value: false },
  //   { name: 'recompile_mj_views', value: true },
  //   { name: 'auto_index_foreign_keys', value: true },
  // ]
  // settings: [
  //   { name: 'mj_core_schema', value: '__mj' },
  //   { name: 'skip_database_generation', value: false },
  //   { name: 'recompile_mj_views', value: true },
  //   { name: 'auto_index_foreign_keys', value: true },
  // ],

  // ---------------------------------------------------------------------------
  // Logging Overrides
  // ---------------------------------------------------------------------------
  // Default: { log: true, logFile: 'codegen.output.log', console: true }
  // logging: {
  //   log: true,
  //   logFile: 'codegen.output.log',
  //   console: true,
  // },

  // ---------------------------------------------------------------------------
  // New Entity Defaults Overrides
  // ---------------------------------------------------------------------------
  // Default v3.x settings for new entities
  newEntityDefaults: {
    NameRulesBySchema: [
      { SchemaName: '${mj_core_schema}', EntityNamePrefix: 'MJ: ' },
      // BizApps family convention (matches published bizapps-common, which uses
      // 'MJ_BizApps_Common: '): prefix this app's entities so their MJ entity
      // names are globally unambiguous, e.g. 'MJ_BizApps_Accounting: GL Accounts'.
      { SchemaName: '__mj_BizAppsAccounting', EntityNamePrefix: 'MJ_BizApps_Accounting: ', EntityNameSuffix: '' },
      {
        SchemaName: 'Committees',
        EntityNamePrefix: 'Committees: ',
        EntityNameSuffix: '',
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // Schema/Table Exclusions
  // ---------------------------------------------------------------------------
  // Default: excludeSchemas: ['sys', 'staging', '__mj']
  // Default: excludeTables: [{ schema: '%', table: 'sys%' }, { schema: '%', table: 'flyway_schema_history' }]
  //
  // Using defaults - Core entities (__mj schema) should not be modified by distributions.
  // Uncomment only if you need different exclusions than the defaults.
  // Exclude core (__mj) AND the bizapps-common dependency schema: common's
  // entities + resolvers ship in its installed @mj-biz-apps/common-* packages,
  // so this app's CodeGen must not regenerate them locally.
  excludeSchemas: ['sys', 'staging', 'dbo', '__mj', '__mj_BizAppsCommon'],
  // excludeTables: [
  //   { schema: '%', table: 'sys%' },
  //   { schema: '%', table: 'flyway_schema_history' }
  // ],

  // ---------------------------------------------------------------------------
  // AI-Powered Advanced Generation Features
  // ---------------------------------------------------------------------------
  // Default v3.x: Several features enabled by default
  // advancedGeneration: {
  //   enableAdvancedGeneration: true,
  //   features: [
  //     { name: 'EntityNames', enabled: false },
  //     { name: 'DefaultInViewFields', enabled: true },
  //     { name: 'EntityDescriptions', enabled: false },
  //     { name: 'SmartFieldIdentification', enabled: true },
  //     { name: 'TransitiveJoinIntelligence', enabled: true },
  //     { name: 'FormLayoutGeneration', enabled: true },
  //     { name: 'ParseCheckConstraints', enabled: true },
  //   ],
  // },

  // ---------------------------------------------------------------------------
  // SQL Output (for migrations)
  // ---------------------------------------------------------------------------
  // Default v3.x: enabled: true, folderPath: './migrations/v3/'
  SQLOutput: {
    enabled: true,
    folderPath: './migrations/codegen/',
    appendToFile: false,
    convertCoreSchemaToFlywayMigrationFile: true,
    omitRecurringScriptsFromLog: false,
    schemaPlaceholders: [
      // Order matters: more-specific schemas must come first because
      // substitution is run sequentially with a greedy regex. If '__mj'
      // were listed first, it would also match the '__mj' prefix of
      // '__mj_BizAppsAccounting', producing '${mjSchema}_BizAppsAccounting'.
      { schema: '__mj_BizAppsAccounting', placeholder: '${flyway:defaultSchema}' },
      { schema: '__mj', placeholder: '${mjSchema}' }
    ]
  },

  // ---------------------------------------------------------------------------
  // Force Regeneration Options
  // ---------------------------------------------------------------------------
  // Default: All false (only regenerate on schema changes)
  // forceRegeneration: {
  //   enabled: false,
  //   baseViews: false,
  //   spCreate: false,
  //   spUpdate: false,
  //   spDelete: false,
  //   allStoredProcedures: false,
  //   indexes: false,
  //   fullTextSearch: false,
  // },

  // ---------------------------------------------------------------------------
  // Database Connection Overrides
  // ---------------------------------------------------------------------------
  // These come from DEFAULT_SERVER_CONFIG with environment variable defaults
  // dbHost: process.env.DB_HOST ?? 'localhost',
  // dbPort: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
  // dbDatabase: process.env.DB_DATABASE,
  // dbUsername: process.env.DB_USERNAME,
  // dbPassword: process.env.DB_PASSWORD,
  // codeGenLogin: process.env.CODEGEN_DB_USERNAME,
  // codeGenPassword: process.env.CODEGEN_DB_PASSWORD,

  // ---------------------------------------------------------------------------
  // Server Settings Overrides
  // ---------------------------------------------------------------------------
  // These come from DEFAULT_SERVER_CONFIG
  // graphqlPort: process.env.GRAPHQL_PORT ?? 4000,
  // mjCoreSchema: process.env.MJ_CORE_SCHEMA ?? '__mj',

  dynamicPackages: {
    server: [
      {
        PackageName: '@mj-biz-apps/common-server',
        StartupExport: 'LoadBizAppsCommonServer',
        AppName: 'mj-bizapps-common',
        Enabled: true
      },
    ]
  },
};
