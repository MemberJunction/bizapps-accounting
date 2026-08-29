-- ============================================================================
-- MemberJunction PostgreSQL Migration
-- Converted from SQL Server using TypeScript conversion pipeline
-- ============================================================================

-- Ship JSONType on AccountingEngineExtension.Configuration (see SQL Server twin).

UPDATE __mj."EntityField"
SET
    "JSONType" = 'IAccountingEngineExtensionConfiguration',
    "JSONTypeIsArray" = FALSE,
    "JSONTypeDefinition" = $jsontype$export interface IAccountingEngineExtensionConfiguration {
    AsOf?: string | null;
    Objects?: Array<'accounts' | 'dimensions' | 'dimensionValues'> | null;
    ContinueOnError?: boolean | null;
}$jsontype$
WHERE "ID" = 'e823d31f-b6ba-4858-8527-e42297b73645';
