-- ============================================================================
-- MemberJunction PostgreSQL Migration
-- Converted from SQL Server using TypeScript conversion pipeline
-- ============================================================================

-- Ship JSONType on AccountingEngineExtension.Configuration (see SQL Server twin).

DO $jsontype$
DECLARE
    n integer;
BEGIN
    UPDATE __mj."EntityField"
    SET
        "JSONType" = 'IAccountingEngineExtensionConfiguration',
        "JSONTypeIsArray" = FALSE,
        "JSONTypeDefinition" = $def$export interface IAccountingEngineExtensionConfiguration {
    AsOf?: string | null;
    Objects?: Array<'accounts' | 'dimensions' | 'dimensionValues'> | null;
    ContinueOnError?: boolean | null;
}$def$
    WHERE "ID" = 'e823d31f-b6ba-4858-8527-e42297b73645'
       OR ("EntityID" = '17b0dc00-2fbb-475e-8da7-388570dadf0e' AND "Name" = 'Configuration');
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN
        RAISE EXCEPTION 'AccountingEngineExtension.Configuration EntityField row not found — JSONType not applied.';
    END IF;
END
$jsontype$;
