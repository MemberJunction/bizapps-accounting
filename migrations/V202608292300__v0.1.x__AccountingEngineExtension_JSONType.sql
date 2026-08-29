-- =============================================================================
-- Ship JSONType on AccountingEngineExtension.Configuration.
--
-- V202608292100 created the EntityField row (CodeGen capture) but did not set
-- JSONType / JSONTypeIsArray / JSONTypeDefinition. metadata/ does not ship
-- with mj app install, so a host would get the column and the generated
-- TypeScript accessor in the npm package, but not the EntityField.JSONType
-- that Explorer's typed editor and a host CodeGen pass need.
--
-- Deterministic UPDATE of the row CodeGen already inserted. No IF NOT EXISTS.
-- =============================================================================

UPDATE [${mjSchema}].[EntityField]
SET
    JSONType = N'IAccountingEngineExtensionConfiguration',
    JSONTypeIsArray = 0,
    JSONTypeDefinition = N'export interface IAccountingEngineExtensionConfiguration {
    AsOf?: string | null;
    Objects?: Array<''accounts'' | ''dimensions'' | ''dimensionValues''> | null;
    ContinueOnError?: boolean | null;
}'
WHERE ID = 'E823D31F-B6BA-4858-8527-E42297B73645';
GO
