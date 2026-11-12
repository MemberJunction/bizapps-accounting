-- =============================================================================
-- Wave 4.3b: Single-write __mj_UpdatedAt backfill
--   1. Sets [__mj_UpdatedAt] = GETUTCDATE() directly inside spUpdate* procedures
--      so BaseEntity.Save() performs a single write to the base table.
--   2. Wraps trgUpdate* __mj_UpdatedAt triggers in IF NOT UPDATE([__mj_UpdatedAt])
--      so direct SQL UPDATEs that omit __mj_UpdatedAt still get stamped, while
--      spUpdate* (and explicit callers) skip the redundant second write.
-- =============================================================================























































------------------------------------------------------------
----- UPDATE PROCEDURE FOR AccountingCompanyProfile
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile]
    @ID uniqueidentifier,
    @EntityType nvarchar(30) = NULL,
    @LegalStructureType_Clear bit = 0,
    @LegalStructureType nvarchar(30) = NULL,
    @IncorporationDate_Clear bit = 0,
    @IncorporationDate date = NULL,
    @JurisdictionCountry_Clear bit = 0,
    @JurisdictionCountry char(2) = NULL,
    @JurisdictionRegion_Clear bit = 0,
    @JurisdictionRegion nvarchar(50) = NULL,
    @FederalTaxID_Clear bit = 0,
    @FederalTaxID nvarchar(40) = NULL,
    @OperatingTimeZone_Clear bit = 0,
    @OperatingTimeZone nvarchar(60) = NULL,
    @CompanyCode nvarchar(20) = NULL,
    @FunctionalCurrencyCode char(3) = NULL,
    @ReportingCurrencyCode_Clear bit = 0,
    @ReportingCurrencyCode char(3) = NULL,
    @FiscalYearStartMonth tinyint = NULL,
    @FiscalYearStartDay tinyint = NULL,
    @ParentAccountingCompanyID_Clear bit = 0,
    @ParentAccountingCompanyID uniqueidentifier = NULL,
    @ApprovalCFOUserID_Clear bit = 0,
    @ApprovalCFOUserID uniqueidentifier = NULL,
    @IsActive bit = NULL,
    @PostingStartDate_Clear bit = 0,
    @PostingStartDate date = NULL,
    @ManualJournalEntryApprovalThreshold_Clear bit = 0,
    @ManualJournalEntryApprovalThreshold decimal(19, 4) = NULL,
    @ManualJournalEntryApproverRoleID_Clear bit = 0,
    @ManualJournalEntryApproverRoleID uniqueidentifier = NULL,
    @BooksClosedThroughDate_Clear bit = 0,
    @BooksClosedThroughDate date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[AccountingCompanyProfile]
    SET
        [EntityType] = ISNULL(@EntityType, [EntityType]),
        [LegalStructureType] = CASE WHEN @LegalStructureType_Clear = 1 THEN NULL ELSE ISNULL(@LegalStructureType, [LegalStructureType]) END,
        [IncorporationDate] = CASE WHEN @IncorporationDate_Clear = 1 THEN NULL ELSE ISNULL(@IncorporationDate, [IncorporationDate]) END,
        [JurisdictionCountry] = CASE WHEN @JurisdictionCountry_Clear = 1 THEN NULL ELSE ISNULL(@JurisdictionCountry, [JurisdictionCountry]) END,
        [JurisdictionRegion] = CASE WHEN @JurisdictionRegion_Clear = 1 THEN NULL ELSE ISNULL(@JurisdictionRegion, [JurisdictionRegion]) END,
        [FederalTaxID] = CASE WHEN @FederalTaxID_Clear = 1 THEN NULL ELSE ISNULL(@FederalTaxID, [FederalTaxID]) END,
        [OperatingTimeZone] = CASE WHEN @OperatingTimeZone_Clear = 1 THEN NULL ELSE ISNULL(@OperatingTimeZone, [OperatingTimeZone]) END,
        [CompanyCode] = ISNULL(@CompanyCode, [CompanyCode]),
        [FunctionalCurrencyCode] = ISNULL(@FunctionalCurrencyCode, [FunctionalCurrencyCode]),
        [ReportingCurrencyCode] = CASE WHEN @ReportingCurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@ReportingCurrencyCode, [ReportingCurrencyCode]) END,
        [FiscalYearStartMonth] = ISNULL(@FiscalYearStartMonth, [FiscalYearStartMonth]),
        [FiscalYearStartDay] = ISNULL(@FiscalYearStartDay, [FiscalYearStartDay]),
        [ParentAccountingCompanyID] = CASE WHEN @ParentAccountingCompanyID_Clear = 1 THEN NULL ELSE ISNULL(@ParentAccountingCompanyID, [ParentAccountingCompanyID]) END,
        [ApprovalCFOUserID] = CASE WHEN @ApprovalCFOUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalCFOUserID, [ApprovalCFOUserID]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [PostingStartDate] = CASE WHEN @PostingStartDate_Clear = 1 THEN NULL ELSE ISNULL(@PostingStartDate, [PostingStartDate]) END,
        [ManualJournalEntryApprovalThreshold] = CASE WHEN @ManualJournalEntryApprovalThreshold_Clear = 1 THEN NULL ELSE ISNULL(@ManualJournalEntryApprovalThreshold, [ManualJournalEntryApprovalThreshold]) END,
        [ManualJournalEntryApproverRoleID] = CASE WHEN @ManualJournalEntryApproverRoleID_Clear = 1 THEN NULL ELSE ISNULL(@ManualJournalEntryApproverRoleID, [ManualJournalEntryApproverRoleID]) END,
        [BooksClosedThroughDate] = CASE WHEN @BooksClosedThroughDate_Clear = 1 THEN NULL ELSE ISNULL(@BooksClosedThroughDate, [BooksClosedThroughDate]) END,
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwAccountingCompanyProfiles]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the AccountingCompanyProfile table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateAccountingCompanyProfile]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateAccountingCompanyProfile];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateAccountingCompanyProfile
ON [${flyway:defaultSchema}].[AccountingCompanyProfile]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[AccountingCompanyProfile]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR AccountingEngineExtension
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateAccountingEngineExtension]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateAccountingEngineExtension];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateAccountingEngineExtension]
    @ID uniqueidentifier,
    @Code nvarchar(80) = NULL,
    @Name nvarchar(200) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @DriverClass nvarchar(255) = NULL,
    @Status nvarchar(20) = NULL,
    @Sequence int = NULL,
    @CompanyID_Clear bit = 0,
    @CompanyID uniqueidentifier = NULL,
    @Configuration_Clear bit = 0,
    @Configuration nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[AccountingEngineExtension]
    SET
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [DriverClass] = ISNULL(@DriverClass, [DriverClass]),
        [Status] = ISNULL(@Status, [Status]),
        [Sequence] = ISNULL(@Sequence, [Sequence]),
        [CompanyID] = CASE WHEN @CompanyID_Clear = 1 THEN NULL ELSE ISNULL(@CompanyID, [CompanyID]) END,
        [Configuration] = CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, [Configuration]) END,
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwAccountingEngineExtensions] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwAccountingEngineExtensions]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingEngineExtension] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingEngineExtension] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the AccountingEngineExtension table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateAccountingEngineExtension]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateAccountingEngineExtension];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateAccountingEngineExtension
ON [${flyway:defaultSchema}].[AccountingEngineExtension]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[AccountingEngineExtension]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[AccountingEngineExtension] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR CompanyTaxNexus
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateCompanyTaxNexus]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateCompanyTaxNexus];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateCompanyTaxNexus]
    @ID uniqueidentifier,
    @CompanyID uniqueidentifier = NULL,
    @TaxJurisdictionID uniqueidentifier = NULL,
    @NexusType nvarchar(20) = NULL,
    @RegistrationNumber_Clear bit = 0,
    @RegistrationNumber nvarchar(100) = NULL,
    @RegisteredFrom date = NULL,
    @RegisteredTo_Clear bit = 0,
    @RegisteredTo date = NULL,
    @ObligationEndsAt_Clear bit = 0,
    @ObligationEndsAt date = NULL,
    @Status nvarchar(10) = NULL,
    @Comments_Clear bit = 0,
    @Comments nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[CompanyTaxNexus]
    SET
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [TaxJurisdictionID] = ISNULL(@TaxJurisdictionID, [TaxJurisdictionID]),
        [NexusType] = ISNULL(@NexusType, [NexusType]),
        [RegistrationNumber] = CASE WHEN @RegistrationNumber_Clear = 1 THEN NULL ELSE ISNULL(@RegistrationNumber, [RegistrationNumber]) END,
        [RegisteredFrom] = ISNULL(@RegisteredFrom, [RegisteredFrom]),
        [RegisteredTo] = CASE WHEN @RegisteredTo_Clear = 1 THEN NULL ELSE ISNULL(@RegisteredTo, [RegisteredTo]) END,
        [ObligationEndsAt] = CASE WHEN @ObligationEndsAt_Clear = 1 THEN NULL ELSE ISNULL(@ObligationEndsAt, [ObligationEndsAt]) END,
        [Status] = ISNULL(@Status, [Status]),
        [Comments] = CASE WHEN @Comments_Clear = 1 THEN NULL ELSE ISNULL(@Comments, [Comments]) END,
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwCompanyTaxNexus] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwCompanyTaxNexus]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateCompanyTaxNexus] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateCompanyTaxNexus] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the CompanyTaxNexus table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateCompanyTaxNexus]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateCompanyTaxNexus];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateCompanyTaxNexus
ON [${flyway:defaultSchema}].[CompanyTaxNexus]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[CompanyTaxNexus]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[CompanyTaxNexus] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR Currency
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateCurrency]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateCurrency];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateCurrency]
    @ID uniqueidentifier,
    @Code char(3) = NULL,
    @Name nvarchar(80) = NULL,
    @Symbol_Clear bit = 0,
    @Symbol nvarchar(10) = NULL,
    @DecimalPlaces tinyint = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Currency]
    SET
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [Symbol] = CASE WHEN @Symbol_Clear = 1 THEN NULL ELSE ISNULL(@Symbol, [Symbol]) END,
        [DecimalPlaces] = ISNULL(@DecimalPlaces, [DecimalPlaces]),
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwCurrencies] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwCurrencies]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateCurrency] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateCurrency] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Currency table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateCurrency]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateCurrency];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateCurrency
ON [${flyway:defaultSchema}].[Currency]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[Currency]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[Currency] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR CurrencySpotRate
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateCurrencySpotRate]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateCurrencySpotRate];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateCurrencySpotRate]
    @ID uniqueidentifier,
    @FromCurrencyCode char(3) = NULL,
    @ToCurrencyCode char(3) = NULL,
    @RateDate date = NULL,
    @Rate decimal(18, 8) = NULL,
    @Source nvarchar(50) = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[CurrencySpotRate]
    SET
        [FromCurrencyCode] = ISNULL(@FromCurrencyCode, [FromCurrencyCode]),
        [ToCurrencyCode] = ISNULL(@ToCurrencyCode, [ToCurrencyCode]),
        [RateDate] = ISNULL(@RateDate, [RateDate]),
        [Rate] = ISNULL(@Rate, [Rate]),
        [Source] = ISNULL(@Source, [Source]),
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwCurrencySpotRates] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwCurrencySpotRates]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateCurrencySpotRate] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateCurrencySpotRate] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the CurrencySpotRate table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateCurrencySpotRate]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateCurrencySpotRate];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateCurrencySpotRate
ON [${flyway:defaultSchema}].[CurrencySpotRate]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[CurrencySpotRate]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[CurrencySpotRate] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR Dimension
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateDimension]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateDimension];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateDimension]
    @ID uniqueidentifier,
    @Code nvarchar(40) = NULL,
    @Name nvarchar(100) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @DisplayOrder int = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Dimension]
    SET
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [DisplayOrder] = ISNULL(@DisplayOrder, [DisplayOrder]),
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwDimensions] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwDimensions]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDimension] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDimension] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Dimension table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateDimension]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateDimension];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateDimension
ON [${flyway:defaultSchema}].[Dimension]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[Dimension]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[Dimension] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR DimensionValue
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateDimensionValue]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateDimensionValue];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateDimensionValue]
    @ID uniqueidentifier,
    @DimensionID uniqueidentifier = NULL,
    @Code nvarchar(80) = NULL,
    @Name nvarchar(200) = NULL,
    @ParentDimensionValueID_Clear bit = 0,
    @ParentDimensionValueID uniqueidentifier = NULL,
    @EffectiveFrom_Clear bit = 0,
    @EffectiveFrom date = NULL,
    @EffectiveTo_Clear bit = 0,
    @EffectiveTo date = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DimensionValue]
    SET
        [DimensionID] = ISNULL(@DimensionID, [DimensionID]),
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [ParentDimensionValueID] = CASE WHEN @ParentDimensionValueID_Clear = 1 THEN NULL ELSE ISNULL(@ParentDimensionValueID, [ParentDimensionValueID]) END,
        [EffectiveFrom] = CASE WHEN @EffectiveFrom_Clear = 1 THEN NULL ELSE ISNULL(@EffectiveFrom, [EffectiveFrom]) END,
        [EffectiveTo] = CASE WHEN @EffectiveTo_Clear = 1 THEN NULL ELSE ISNULL(@EffectiveTo, [EffectiveTo]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwDimensionValues] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwDimensionValues]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDimensionValue] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDimensionValue] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the DimensionValue table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateDimensionValue]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateDimensionValue];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateDimensionValue
ON [${flyway:defaultSchema}].[DimensionValue]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[DimensionValue]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[DimensionValue] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR FinanceException
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateFinanceException]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateFinanceException];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateFinanceException]
    @ID uniqueidentifier,
    @FinanceExceptionTypeID uniqueidentifier = NULL,
    @SourceEntityID uniqueidentifier = NULL,
    @SourceRecordID nvarchar(450) = NULL,
    @CompanyID uniqueidentifier = NULL,
    @Amount_Clear bit = 0,
    @Amount decimal(19, 4) = NULL,
    @ExceptionDate date = NULL,
    @DetectedAt datetimeoffset = NULL,
    @Summary nvarchar(1000) = NULL,
    @DedupeKey nvarchar(400) = NULL,
    @SourceCreatedByUserID_Clear bit = 0,
    @SourceCreatedByUserID uniqueidentifier = NULL,
    @CreatorUnresolved bit = NULL,
    @Status nvarchar(20) = NULL,
    @ReviewedByUserID_Clear bit = 0,
    @ReviewedByUserID uniqueidentifier = NULL,
    @ReviewedAt_Clear bit = 0,
    @ReviewedAt datetimeoffset = NULL,
    @ReviewNote_Clear bit = 0,
    @ReviewNote nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[FinanceException]
    SET
        [FinanceExceptionTypeID] = ISNULL(@FinanceExceptionTypeID, [FinanceExceptionTypeID]),
        [SourceEntityID] = ISNULL(@SourceEntityID, [SourceEntityID]),
        [SourceRecordID] = ISNULL(@SourceRecordID, [SourceRecordID]),
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [Amount] = CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, [Amount]) END,
        [ExceptionDate] = ISNULL(@ExceptionDate, [ExceptionDate]),
        [DetectedAt] = ISNULL(@DetectedAt, [DetectedAt]),
        [Summary] = ISNULL(@Summary, [Summary]),
        [DedupeKey] = ISNULL(@DedupeKey, [DedupeKey]),
        [SourceCreatedByUserID] = CASE WHEN @SourceCreatedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@SourceCreatedByUserID, [SourceCreatedByUserID]) END,
        [CreatorUnresolved] = ISNULL(@CreatorUnresolved, [CreatorUnresolved]),
        [Status] = ISNULL(@Status, [Status]),
        [ReviewedByUserID] = CASE WHEN @ReviewedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ReviewedByUserID, [ReviewedByUserID]) END,
        [ReviewedAt] = CASE WHEN @ReviewedAt_Clear = 1 THEN NULL ELSE ISNULL(@ReviewedAt, [ReviewedAt]) END,
        [ReviewNote] = CASE WHEN @ReviewNote_Clear = 1 THEN NULL ELSE ISNULL(@ReviewNote, [ReviewNote]) END,
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwFinanceExceptions] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwFinanceExceptions]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateFinanceException] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateFinanceException] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the FinanceException table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateFinanceException]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateFinanceException];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateFinanceException
ON [${flyway:defaultSchema}].[FinanceException]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[FinanceException]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[FinanceException] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR FinanceExceptionType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateFinanceExceptionType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateFinanceExceptionType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateFinanceExceptionType]
    @ID uniqueidentifier,
    @Code nvarchar(60) = NULL,
    @Name nvarchar(100) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @OwningApp nvarchar(100) = NULL,
    @IsActive bit = NULL,
    @Configuration nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[FinanceExceptionType]
    SET
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [OwningApp] = ISNULL(@OwningApp, [OwningApp]),
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [Configuration] = ISNULL(@Configuration, [Configuration]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwFinanceExceptionTypes] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwFinanceExceptionTypes]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateFinanceExceptionType] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateFinanceExceptionType] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the FinanceExceptionType table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateFinanceExceptionType]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateFinanceExceptionType];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateFinanceExceptionType
ON [${flyway:defaultSchema}].[FinanceExceptionType]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[FinanceExceptionType]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[FinanceExceptionType] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR GLAccount
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateGLAccount]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccount];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccount]
    @ID uniqueidentifier,
    @CompanyID uniqueidentifier = NULL,
    @Code nvarchar(40) = NULL,
    @Name nvarchar(200) = NULL,
    @AccountType nvarchar(15) = NULL,
    @ParentGLAccountID_Clear bit = 0,
    @ParentGLAccountID uniqueidentifier = NULL,
    @CurrencyCode_Clear bit = 0,
    @CurrencyCode char(3) = NULL,
    @ExternalSystem_Clear bit = 0,
    @ExternalSystem nvarchar(50) = NULL,
    @ExternalAccountID_Clear bit = 0,
    @ExternalAccountID nvarchar(100) = NULL,
    @IsActive bit = NULL,
    @IsSystemSeeded bit = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @IsControlAccount bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[GLAccount]
    SET
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [AccountType] = ISNULL(@AccountType, [AccountType]),
        [ParentGLAccountID] = CASE WHEN @ParentGLAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ParentGLAccountID, [ParentGLAccountID]) END,
        [CurrencyCode] = CASE WHEN @CurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyCode, [CurrencyCode]) END,
        [ExternalSystem] = CASE WHEN @ExternalSystem_Clear = 1 THEN NULL ELSE ISNULL(@ExternalSystem, [ExternalSystem]) END,
        [ExternalAccountID] = CASE WHEN @ExternalAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ExternalAccountID, [ExternalAccountID]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [IsSystemSeeded] = ISNULL(@IsSystemSeeded, [IsSystemSeeded]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [IsControlAccount] = ISNULL(@IsControlAccount, [IsControlAccount]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwGLAccounts] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwGLAccounts]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the GLAccount table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateGLAccount]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateGLAccount];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateGLAccount
ON [${flyway:defaultSchema}].[GLAccount]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[GLAccount]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[GLAccount] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR GLAccountLink
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateGLAccountLink]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccountLink];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccountLink]
    @ID uniqueidentifier,
    @GLAccountID uniqueidentifier = NULL,
    @GLAccountRoleID uniqueidentifier = NULL,
    @EntityID uniqueidentifier = NULL,
    @RecordID nvarchar(400) = NULL,
    @Status nvarchar(10) = NULL,
    @StartedAt_Clear bit = 0,
    @StartedAt datetimeoffset = NULL,
    @EndedAt_Clear bit = 0,
    @EndedAt datetimeoffset = NULL,
    @Comments_Clear bit = 0,
    @Comments nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[GLAccountLink]
    SET
        [GLAccountID] = ISNULL(@GLAccountID, [GLAccountID]),
        [GLAccountRoleID] = ISNULL(@GLAccountRoleID, [GLAccountRoleID]),
        [EntityID] = ISNULL(@EntityID, [EntityID]),
        [RecordID] = ISNULL(@RecordID, [RecordID]),
        [Status] = ISNULL(@Status, [Status]),
        [StartedAt] = CASE WHEN @StartedAt_Clear = 1 THEN NULL ELSE ISNULL(@StartedAt, [StartedAt]) END,
        [EndedAt] = CASE WHEN @EndedAt_Clear = 1 THEN NULL ELSE ISNULL(@EndedAt, [EndedAt]) END,
        [Comments] = CASE WHEN @Comments_Clear = 1 THEN NULL ELSE ISNULL(@Comments, [Comments]) END,
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwGLAccountLinks] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwGLAccountLinks]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccountLink] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccountLink] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the GLAccountLink table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateGLAccountLink]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateGLAccountLink];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateGLAccountLink
ON [${flyway:defaultSchema}].[GLAccountLink]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[GLAccountLink]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[GLAccountLink] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR GLAccountLinkDimension
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateGLAccountLinkDimension]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccountLinkDimension];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccountLinkDimension]
    @ID uniqueidentifier,
    @GLAccountLinkID uniqueidentifier = NULL,
    @DimensionID uniqueidentifier = NULL,
    @Sequence int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[GLAccountLinkDimension]
    SET
        [GLAccountLinkID] = ISNULL(@GLAccountLinkID, [GLAccountLinkID]),
        [DimensionID] = ISNULL(@DimensionID, [DimensionID]),
        [Sequence] = ISNULL(@Sequence, [Sequence]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwGLAccountLinkDimensions] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwGLAccountLinkDimensions]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccountLinkDimension] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccountLinkDimension] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the GLAccountLinkDimension table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateGLAccountLinkDimension]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateGLAccountLinkDimension];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateGLAccountLinkDimension
ON [${flyway:defaultSchema}].[GLAccountLinkDimension]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[GLAccountLinkDimension]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[GLAccountLinkDimension] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR GLAccountRole
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateGLAccountRole]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccountRole];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccountRole]
    @ID uniqueidentifier,
    @Name nvarchar(100) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @Status nvarchar(10) = NULL,
    @Sequence int = NULL,
    @Cardinality nvarchar(10) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[GLAccountRole]
    SET
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [Status] = ISNULL(@Status, [Status]),
        [Sequence] = ISNULL(@Sequence, [Sequence]),
        [Cardinality] = ISNULL(@Cardinality, [Cardinality]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwGLAccountRoles] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwGLAccountRoles]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccountRole] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccountRole] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the GLAccountRole table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateGLAccountRole]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateGLAccountRole];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateGLAccountRole
ON [${flyway:defaultSchema}].[GLAccountRole]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[GLAccountRole]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[GLAccountRole] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR IntercompanyAccountMatch
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateIntercompanyAccountMatch]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateIntercompanyAccountMatch];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateIntercompanyAccountMatch]
    @ID uniqueidentifier,
    @SourceCompanyID uniqueidentifier = NULL,
    @TargetCompanyID uniqueidentifier = NULL,
    @DueToGLAccountID uniqueidentifier = NULL,
    @DueFromGLAccountID uniqueidentifier = NULL,
    @Status nvarchar(10) = NULL,
    @StartedAt_Clear bit = 0,
    @StartedAt datetimeoffset = NULL,
    @EndedAt_Clear bit = 0,
    @EndedAt datetimeoffset = NULL,
    @Comments_Clear bit = 0,
    @Comments nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[IntercompanyAccountMatch]
    SET
        [SourceCompanyID] = ISNULL(@SourceCompanyID, [SourceCompanyID]),
        [TargetCompanyID] = ISNULL(@TargetCompanyID, [TargetCompanyID]),
        [DueToGLAccountID] = ISNULL(@DueToGLAccountID, [DueToGLAccountID]),
        [DueFromGLAccountID] = ISNULL(@DueFromGLAccountID, [DueFromGLAccountID]),
        [Status] = ISNULL(@Status, [Status]),
        [StartedAt] = CASE WHEN @StartedAt_Clear = 1 THEN NULL ELSE ISNULL(@StartedAt, [StartedAt]) END,
        [EndedAt] = CASE WHEN @EndedAt_Clear = 1 THEN NULL ELSE ISNULL(@EndedAt, [EndedAt]) END,
        [Comments] = CASE WHEN @Comments_Clear = 1 THEN NULL ELSE ISNULL(@Comments, [Comments]) END,
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwIntercompanyAccountMatches] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwIntercompanyAccountMatches]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateIntercompanyAccountMatch] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateIntercompanyAccountMatch] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the IntercompanyAccountMatch table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateIntercompanyAccountMatch]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateIntercompanyAccountMatch];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateIntercompanyAccountMatch
ON [${flyway:defaultSchema}].[IntercompanyAccountMatch]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[IntercompanyAccountMatch]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[IntercompanyAccountMatch] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR IntercompanyAccountMatchDimension
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateIntercompanyAccountMatchDimension]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateIntercompanyAccountMatchDimension];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateIntercompanyAccountMatchDimension]
    @ID uniqueidentifier,
    @IntercompanyAccountMatchID uniqueidentifier = NULL,
    @Side nvarchar(10) = NULL,
    @DimensionID uniqueidentifier = NULL,
    @DimensionValueID_Clear bit = 0,
    @DimensionValueID uniqueidentifier = NULL,
    @Sequence int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[IntercompanyAccountMatchDimension]
    SET
        [IntercompanyAccountMatchID] = ISNULL(@IntercompanyAccountMatchID, [IntercompanyAccountMatchID]),
        [Side] = ISNULL(@Side, [Side]),
        [DimensionID] = ISNULL(@DimensionID, [DimensionID]),
        [DimensionValueID] = CASE WHEN @DimensionValueID_Clear = 1 THEN NULL ELSE ISNULL(@DimensionValueID, [DimensionValueID]) END,
        [Sequence] = ISNULL(@Sequence, [Sequence]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwIntercompanyAccountMatchDimensions] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwIntercompanyAccountMatchDimensions]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateIntercompanyAccountMatchDimension] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateIntercompanyAccountMatchDimension] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the IntercompanyAccountMatchDimension table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateIntercompanyAccountMatchDimension]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateIntercompanyAccountMatchDimension];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateIntercompanyAccountMatchDimension
ON [${flyway:defaultSchema}].[IntercompanyAccountMatchDimension]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[IntercompanyAccountMatchDimension]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[IntercompanyAccountMatchDimension] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR JournalEntry
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateJournalEntry]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntry];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntry]
    @ID uniqueidentifier,
    @EntryNumber nvarchar(40) = NULL,
    @CompanyID uniqueidentifier = NULL,
    @EffectiveDate date = NULL,
    @EntryTypeID uniqueidentifier = NULL,
    @Status nvarchar(20) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @LinkedEntityID_Clear bit = 0,
    @LinkedEntityID uniqueidentifier = NULL,
    @LinkedRecordID_Clear bit = 0,
    @LinkedRecordID nvarchar(400) = NULL,
    @ReversesJournalEntryID_Clear bit = 0,
    @ReversesJournalEntryID uniqueidentifier = NULL,
    @ReversedByJournalEntryID_Clear bit = 0,
    @ReversedByJournalEntryID uniqueidentifier = NULL,
    @JournalEntryBatchID_Clear bit = 0,
    @JournalEntryBatchID uniqueidentifier = NULL,
    @GLPostedAt_Clear bit = 0,
    @GLPostedAt datetimeoffset = NULL,
    @GLReferenceID_Clear bit = 0,
    @GLReferenceID nvarchar(100) = NULL,
    @FileID_Clear bit = 0,
    @FileID uniqueidentifier = NULL,
    @PredictedAnomalyProbability_Clear bit = 0,
    @PredictedAnomalyProbability decimal(5, 4) = NULL,
    @PredictedAnomalyRiskBand_Clear bit = 0,
    @PredictedAnomalyRiskBand nvarchar(20) = NULL,
    @PredictedAnomalyScoredAt_Clear bit = 0,
    @PredictedAnomalyScoredAt datetimeoffset = NULL,
    @ApprovalLevel_Clear bit = 0,
    @ApprovalLevel nvarchar(20) = NULL,
    @ApprovalRequestedByUserID_Clear bit = 0,
    @ApprovalRequestedByUserID uniqueidentifier = NULL,
    @ApprovalTaskID_Clear bit = 0,
    @ApprovalTaskID uniqueidentifier = NULL,
    @ApprovedAt_Clear bit = 0,
    @ApprovedAt datetimeoffset = NULL,
    @ApprovedByUserID_Clear bit = 0,
    @ApprovedByUserID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntry]
    SET
        [EntryNumber] = ISNULL(@EntryNumber, [EntryNumber]),
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [EffectiveDate] = ISNULL(@EffectiveDate, [EffectiveDate]),
        [EntryTypeID] = ISNULL(@EntryTypeID, [EntryTypeID]),
        [Status] = ISNULL(@Status, [Status]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [LinkedEntityID] = CASE WHEN @LinkedEntityID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedEntityID, [LinkedEntityID]) END,
        [LinkedRecordID] = CASE WHEN @LinkedRecordID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedRecordID, [LinkedRecordID]) END,
        [ReversesJournalEntryID] = CASE WHEN @ReversesJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversesJournalEntryID, [ReversesJournalEntryID]) END,
        [ReversedByJournalEntryID] = CASE WHEN @ReversedByJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversedByJournalEntryID, [ReversedByJournalEntryID]) END,
        [JournalEntryBatchID] = CASE WHEN @JournalEntryBatchID_Clear = 1 THEN NULL ELSE ISNULL(@JournalEntryBatchID, [JournalEntryBatchID]) END,
        [GLPostedAt] = CASE WHEN @GLPostedAt_Clear = 1 THEN NULL ELSE ISNULL(@GLPostedAt, [GLPostedAt]) END,
        [GLReferenceID] = CASE WHEN @GLReferenceID_Clear = 1 THEN NULL ELSE ISNULL(@GLReferenceID, [GLReferenceID]) END,
        [FileID] = CASE WHEN @FileID_Clear = 1 THEN NULL ELSE ISNULL(@FileID, [FileID]) END,
        [PredictedAnomalyProbability] = CASE WHEN @PredictedAnomalyProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyProbability, [PredictedAnomalyProbability]) END,
        [PredictedAnomalyRiskBand] = CASE WHEN @PredictedAnomalyRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyRiskBand, [PredictedAnomalyRiskBand]) END,
        [PredictedAnomalyScoredAt] = CASE WHEN @PredictedAnomalyScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyScoredAt, [PredictedAnomalyScoredAt]) END,
        [ApprovalLevel] = CASE WHEN @ApprovalLevel_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalLevel, [ApprovalLevel]) END,
        [ApprovalRequestedByUserID] = CASE WHEN @ApprovalRequestedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalRequestedByUserID, [ApprovalRequestedByUserID]) END,
        [ApprovalTaskID] = CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, [ApprovalTaskID]) END,
        [ApprovedAt] = CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, [ApprovedAt]) END,
        [ApprovedByUserID] = CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, [ApprovedByUserID]) END,
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwJournalEntries] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwJournalEntries]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntry] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntry] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the JournalEntry table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateJournalEntry]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateJournalEntry];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateJournalEntry
ON [${flyway:defaultSchema}].[JournalEntry]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[JournalEntry]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[JournalEntry] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR JournalEntryBatch
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateJournalEntryBatch]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryBatch];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryBatch]
    @ID uniqueidentifier,
    @JournalEntryBatchNumber nvarchar(40) = NULL,
    @CompanyID uniqueidentifier = NULL,
    @PostingDate date = NULL,
    @SummaryJournalEntryID_Clear bit = 0,
    @SummaryJournalEntryID uniqueidentifier = NULL,
    @TargetSystem nvarchar(50) = NULL,
    @BatchedAt datetimeoffset = NULL,
    @BatchedByUserID uniqueidentifier = NULL,
    @Status nvarchar(20) = NULL,
    @TotalEntries int = NULL,
    @TotalDebits decimal(18, 2) = NULL,
    @TotalCredits decimal(18, 2) = NULL,
    @ExternalJournalEntryBatchRef_Clear bit = 0,
    @ExternalJournalEntryBatchRef nvarchar(100) = NULL,
    @ApprovedAt_Clear bit = 0,
    @ApprovedAt datetimeoffset = NULL,
    @ApprovedByUserID_Clear bit = 0,
    @ApprovedByUserID uniqueidentifier = NULL,
    @SentAt_Clear bit = 0,
    @SentAt datetimeoffset = NULL,
    @PostedAt_Clear bit = 0,
    @PostedAt datetimeoffset = NULL,
    @ErrorMessage_Clear bit = 0,
    @ErrorMessage nvarchar(MAX) = NULL,
    @ApprovalTaskID_Clear bit = 0,
    @ApprovalTaskID uniqueidentifier = NULL,
    @ApprovalTaskRaisedAt_Clear bit = 0,
    @ApprovalTaskRaisedAt datetimeoffset = NULL,
    @ArchiveReason_Clear bit = 0,
    @ArchiveReason nvarchar(500) = NULL,
    @ArchivedAt_Clear bit = 0,
    @ArchivedAt datetimeoffset = NULL,
    @ArchivedByUserID_Clear bit = 0,
    @ArchivedByUserID uniqueidentifier = NULL,
    @CancelReason_Clear bit = 0,
    @CancelReason nvarchar(1000) = NULL,
    @CancelledAt_Clear bit = 0,
    @CancelledAt datetimeoffset = NULL,
    @CancelledByUserID_Clear bit = 0,
    @CancelledByUserID uniqueidentifier = NULL,
    @ERPNotPostedConfirmedAt_Clear bit = 0,
    @ERPNotPostedConfirmedAt datetimeoffset = NULL,
    @ERPNotPostedConfirmedByUserID_Clear bit = 0,
    @ERPNotPostedConfirmedByUserID uniqueidentifier = NULL,
    @ERPNotPostedBasis_Clear bit = 0,
    @ERPNotPostedBasis nvarchar(20) = NULL,
    @ApprovedContentHash_Clear bit = 0,
    @ApprovedContentHash nvarchar(64) = NULL,
    @SentByUserID_Clear bit = 0,
    @SentByUserID uniqueidentifier = NULL,
    @SendAttemptCount int = NULL,
    @SealMismatchDetectedAt_Clear bit = 0,
    @SealMismatchDetectedAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntryBatch]
    SET
        [JournalEntryBatchNumber] = ISNULL(@JournalEntryBatchNumber, [JournalEntryBatchNumber]),
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [PostingDate] = ISNULL(@PostingDate, [PostingDate]),
        [SummaryJournalEntryID] = CASE WHEN @SummaryJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@SummaryJournalEntryID, [SummaryJournalEntryID]) END,
        [TargetSystem] = ISNULL(@TargetSystem, [TargetSystem]),
        [BatchedAt] = ISNULL(@BatchedAt, [BatchedAt]),
        [BatchedByUserID] = ISNULL(@BatchedByUserID, [BatchedByUserID]),
        [Status] = ISNULL(@Status, [Status]),
        [TotalEntries] = ISNULL(@TotalEntries, [TotalEntries]),
        [TotalDebits] = ISNULL(@TotalDebits, [TotalDebits]),
        [TotalCredits] = ISNULL(@TotalCredits, [TotalCredits]),
        [ExternalJournalEntryBatchRef] = CASE WHEN @ExternalJournalEntryBatchRef_Clear = 1 THEN NULL ELSE ISNULL(@ExternalJournalEntryBatchRef, [ExternalJournalEntryBatchRef]) END,
        [ApprovedAt] = CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, [ApprovedAt]) END,
        [ApprovedByUserID] = CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, [ApprovedByUserID]) END,
        [SentAt] = CASE WHEN @SentAt_Clear = 1 THEN NULL ELSE ISNULL(@SentAt, [SentAt]) END,
        [PostedAt] = CASE WHEN @PostedAt_Clear = 1 THEN NULL ELSE ISNULL(@PostedAt, [PostedAt]) END,
        [ErrorMessage] = CASE WHEN @ErrorMessage_Clear = 1 THEN NULL ELSE ISNULL(@ErrorMessage, [ErrorMessage]) END,
        [ApprovalTaskID] = CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, [ApprovalTaskID]) END,
        [ApprovalTaskRaisedAt] = CASE WHEN @ApprovalTaskRaisedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskRaisedAt, [ApprovalTaskRaisedAt]) END,
        [ArchiveReason] = CASE WHEN @ArchiveReason_Clear = 1 THEN NULL ELSE ISNULL(@ArchiveReason, [ArchiveReason]) END,
        [ArchivedAt] = CASE WHEN @ArchivedAt_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedAt, [ArchivedAt]) END,
        [ArchivedByUserID] = CASE WHEN @ArchivedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedByUserID, [ArchivedByUserID]) END,
        [CancelReason] = CASE WHEN @CancelReason_Clear = 1 THEN NULL ELSE ISNULL(@CancelReason, [CancelReason]) END,
        [CancelledAt] = CASE WHEN @CancelledAt_Clear = 1 THEN NULL ELSE ISNULL(@CancelledAt, [CancelledAt]) END,
        [CancelledByUserID] = CASE WHEN @CancelledByUserID_Clear = 1 THEN NULL ELSE ISNULL(@CancelledByUserID, [CancelledByUserID]) END,
        [ERPNotPostedConfirmedAt] = CASE WHEN @ERPNotPostedConfirmedAt_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedAt, [ERPNotPostedConfirmedAt]) END,
        [ERPNotPostedConfirmedByUserID] = CASE WHEN @ERPNotPostedConfirmedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedByUserID, [ERPNotPostedConfirmedByUserID]) END,
        [ERPNotPostedBasis] = CASE WHEN @ERPNotPostedBasis_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedBasis, [ERPNotPostedBasis]) END,
        [ApprovedContentHash] = CASE WHEN @ApprovedContentHash_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedContentHash, [ApprovedContentHash]) END,
        [SentByUserID] = CASE WHEN @SentByUserID_Clear = 1 THEN NULL ELSE ISNULL(@SentByUserID, [SentByUserID]) END,
        [SendAttemptCount] = ISNULL(@SendAttemptCount, [SendAttemptCount]),
        [SealMismatchDetectedAt] = CASE WHEN @SealMismatchDetectedAt_Clear = 1 THEN NULL ELSE ISNULL(@SealMismatchDetectedAt, [SealMismatchDetectedAt]) END,
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwJournalEntryBatches] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwJournalEntryBatches]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatch] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the JournalEntryBatch table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateJournalEntryBatch]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateJournalEntryBatch];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateJournalEntryBatch
ON [${flyway:defaultSchema}].[JournalEntryBatch]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[JournalEntryBatch]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[JournalEntryBatch] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR JournalEntryBatchSequence
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateJournalEntryBatchSequence]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryBatchSequence];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryBatchSequence]
    @ID int,
    @NextSequenceNumber int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntryBatchSequence]
    SET
        [NextSequenceNumber] = ISNULL(@NextSequenceNumber, [NextSequenceNumber]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwJournalEntryBatchSequences] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwJournalEntryBatchSequences]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatchSequence] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatchSequence] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the JournalEntryBatchSequence table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateJournalEntryBatchSequence]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateJournalEntryBatchSequence];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateJournalEntryBatchSequence
ON [${flyway:defaultSchema}].[JournalEntryBatchSequence]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[JournalEntryBatchSequence]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[JournalEntryBatchSequence] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR JournalEntryLine
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateJournalEntryLine]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryLine];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryLine]
    @ID uniqueidentifier,
    @JournalEntryID uniqueidentifier = NULL,
    @LineNumber int = NULL,
    @GLAccountID uniqueidentifier = NULL,
    @DebitAmount_Clear bit = 0,
    @DebitAmount decimal(18, 2) = NULL,
    @CreditAmount_Clear bit = 0,
    @CreditAmount decimal(18, 2) = NULL,
    @OriginalCurrencyCode_Clear bit = 0,
    @OriginalCurrencyCode char(3) = NULL,
    @OriginalDebitAmount_Clear bit = 0,
    @OriginalDebitAmount decimal(18, 2) = NULL,
    @OriginalCreditAmount_Clear bit = 0,
    @OriginalCreditAmount decimal(18, 2) = NULL,
    @ExchangeRateUsed_Clear bit = 0,
    @ExchangeRateUsed decimal(18, 8) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntryLine]
    SET
        [JournalEntryID] = ISNULL(@JournalEntryID, [JournalEntryID]),
        [LineNumber] = ISNULL(@LineNumber, [LineNumber]),
        [GLAccountID] = ISNULL(@GLAccountID, [GLAccountID]),
        [DebitAmount] = CASE WHEN @DebitAmount_Clear = 1 THEN NULL ELSE ISNULL(@DebitAmount, [DebitAmount]) END,
        [CreditAmount] = CASE WHEN @CreditAmount_Clear = 1 THEN NULL ELSE ISNULL(@CreditAmount, [CreditAmount]) END,
        [OriginalCurrencyCode] = CASE WHEN @OriginalCurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@OriginalCurrencyCode, [OriginalCurrencyCode]) END,
        [OriginalDebitAmount] = CASE WHEN @OriginalDebitAmount_Clear = 1 THEN NULL ELSE ISNULL(@OriginalDebitAmount, [OriginalDebitAmount]) END,
        [OriginalCreditAmount] = CASE WHEN @OriginalCreditAmount_Clear = 1 THEN NULL ELSE ISNULL(@OriginalCreditAmount, [OriginalCreditAmount]) END,
        [ExchangeRateUsed] = CASE WHEN @ExchangeRateUsed_Clear = 1 THEN NULL ELSE ISNULL(@ExchangeRateUsed, [ExchangeRateUsed]) END,
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwJournalEntryLines] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwJournalEntryLines]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryLine] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryLine] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the JournalEntryLine table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateJournalEntryLine]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateJournalEntryLine];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateJournalEntryLine
ON [${flyway:defaultSchema}].[JournalEntryLine]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[JournalEntryLine]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[JournalEntryLine] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR JournalEntryLineDimension
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateJournalEntryLineDimension]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryLineDimension];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryLineDimension]
    @ID uniqueidentifier,
    @JournalEntryLineID uniqueidentifier = NULL,
    @DimensionID uniqueidentifier = NULL,
    @DimensionValueID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntryLineDimension]
    SET
        [JournalEntryLineID] = ISNULL(@JournalEntryLineID, [JournalEntryLineID]),
        [DimensionID] = ISNULL(@DimensionID, [DimensionID]),
        [DimensionValueID] = ISNULL(@DimensionValueID, [DimensionValueID]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwJournalEntryLineDimensions] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwJournalEntryLineDimensions]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryLineDimension] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryLineDimension] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the JournalEntryLineDimension table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateJournalEntryLineDimension]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateJournalEntryLineDimension];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateJournalEntryLineDimension
ON [${flyway:defaultSchema}].[JournalEntryLineDimension]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[JournalEntryLineDimension]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[JournalEntryLineDimension] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR JournalEntrySequence
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateJournalEntrySequence]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntrySequence];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntrySequence]
    @CompanyID uniqueidentifier,
    @FiscalYear int,
    @NextSequenceNumber int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntrySequence]
    SET
        [NextSequenceNumber] = ISNULL(@NextSequenceNumber, [NextSequenceNumber]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [CompanyID] = @CompanyID AND [FiscalYear] = @FiscalYear

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwJournalEntrySequences] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwJournalEntrySequences]
                                    WHERE
                                        [CompanyID] = @CompanyID AND [FiscalYear] = @FiscalYear
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntrySequence] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntrySequence] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the JournalEntrySequence table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateJournalEntrySequence]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateJournalEntrySequence];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateJournalEntrySequence
ON [${flyway:defaultSchema}].[JournalEntrySequence]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[JournalEntrySequence]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[JournalEntrySequence] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[CompanyID] = I.[CompanyID] AND _organicTable.[FiscalYear] = I.[FiscalYear];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR JournalEntryType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateJournalEntryType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryType]
    @ID uniqueidentifier,
    @Code nvarchar(40) = NULL,
    @Name nvarchar(100) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @IsSystem bit = NULL,
    @IsJournalEntryBatchSummary bit = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntryType]
    SET
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [IsSystem] = ISNULL(@IsSystem, [IsSystem]),
        [IsJournalEntryBatchSummary] = ISNULL(@IsJournalEntryBatchSummary, [IsJournalEntryBatchSummary]),
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwJournalEntryTypes] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwJournalEntryTypes]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryType] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryType] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the JournalEntryType table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateJournalEntryType]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateJournalEntryType];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateJournalEntryType
ON [${flyway:defaultSchema}].[JournalEntryType]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[JournalEntryType]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[JournalEntryType] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR TaxAuthority
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateTaxAuthority]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateTaxAuthority];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateTaxAuthority]
    @ID uniqueidentifier,
    @Code nvarchar(40) = NULL,
    @Name nvarchar(200) = NULL,
    @CountryCode_Clear bit = 0,
    @CountryCode char(2) = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[TaxAuthority]
    SET
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [CountryCode] = CASE WHEN @CountryCode_Clear = 1 THEN NULL ELSE ISNULL(@CountryCode, [CountryCode]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwTaxAuthorities] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwTaxAuthorities]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateTaxAuthority] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateTaxAuthority] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the TaxAuthority table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateTaxAuthority]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateTaxAuthority];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateTaxAuthority
ON [${flyway:defaultSchema}].[TaxAuthority]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[TaxAuthority]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[TaxAuthority] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR TaxJurisdiction
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateTaxJurisdiction]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateTaxJurisdiction];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateTaxJurisdiction]
    @ID uniqueidentifier,
    @TaxAuthorityID uniqueidentifier = NULL,
    @Code nvarchar(80) = NULL,
    @Name nvarchar(200) = NULL,
    @CountryCode_Clear bit = 0,
    @CountryCode char(2) = NULL,
    @RegionCode_Clear bit = 0,
    @RegionCode nvarchar(50) = NULL,
    @PostalCode_Clear bit = 0,
    @PostalCode nvarchar(20) = NULL,
    @PostalCodeStart_Clear bit = 0,
    @PostalCodeStart nvarchar(20) = NULL,
    @PostalCodeEnd_Clear bit = 0,
    @PostalCodeEnd nvarchar(20) = NULL,
    @CityName_Clear bit = 0,
    @CityName nvarchar(200) = NULL,
    @ParentTaxJurisdictionID_Clear bit = 0,
    @ParentTaxJurisdictionID uniqueidentifier = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[TaxJurisdiction]
    SET
        [TaxAuthorityID] = ISNULL(@TaxAuthorityID, [TaxAuthorityID]),
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [CountryCode] = CASE WHEN @CountryCode_Clear = 1 THEN NULL ELSE ISNULL(@CountryCode, [CountryCode]) END,
        [RegionCode] = CASE WHEN @RegionCode_Clear = 1 THEN NULL ELSE ISNULL(@RegionCode, [RegionCode]) END,
        [PostalCode] = CASE WHEN @PostalCode_Clear = 1 THEN NULL ELSE ISNULL(@PostalCode, [PostalCode]) END,
        [PostalCodeStart] = CASE WHEN @PostalCodeStart_Clear = 1 THEN NULL ELSE ISNULL(@PostalCodeStart, [PostalCodeStart]) END,
        [PostalCodeEnd] = CASE WHEN @PostalCodeEnd_Clear = 1 THEN NULL ELSE ISNULL(@PostalCodeEnd, [PostalCodeEnd]) END,
        [CityName] = CASE WHEN @CityName_Clear = 1 THEN NULL ELSE ISNULL(@CityName, [CityName]) END,
        [ParentTaxJurisdictionID] = CASE WHEN @ParentTaxJurisdictionID_Clear = 1 THEN NULL ELSE ISNULL(@ParentTaxJurisdictionID, [ParentTaxJurisdictionID]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwTaxJurisdictions] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwTaxJurisdictions]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateTaxJurisdiction] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateTaxJurisdiction] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the TaxJurisdiction table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateTaxJurisdiction]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateTaxJurisdiction];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateTaxJurisdiction
ON [${flyway:defaultSchema}].[TaxJurisdiction]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[TaxJurisdiction]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[TaxJurisdiction] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR TaxLiability
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateTaxLiability]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateTaxLiability];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateTaxLiability]
    @ID uniqueidentifier,
    @CompanyID uniqueidentifier = NULL,
    @TaxAuthorityID uniqueidentifier = NULL,
    @TaxJurisdictionID uniqueidentifier = NULL,
    @AccruedAmount decimal(18, 2) = NULL,
    @RemittedAmount decimal(18, 2) = NULL,
    @Status nvarchar(20) = NULL,
    @DueDate_Clear bit = 0,
    @DueDate date = NULL,
    @FilingFrequency_Clear bit = 0,
    @FilingFrequency nvarchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[TaxLiability]
    SET
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [TaxAuthorityID] = ISNULL(@TaxAuthorityID, [TaxAuthorityID]),
        [TaxJurisdictionID] = ISNULL(@TaxJurisdictionID, [TaxJurisdictionID]),
        [AccruedAmount] = ISNULL(@AccruedAmount, [AccruedAmount]),
        [RemittedAmount] = ISNULL(@RemittedAmount, [RemittedAmount]),
        [Status] = ISNULL(@Status, [Status]),
        [DueDate] = CASE WHEN @DueDate_Clear = 1 THEN NULL ELSE ISNULL(@DueDate, [DueDate]) END,
        [FilingFrequency] = CASE WHEN @FilingFrequency_Clear = 1 THEN NULL ELSE ISNULL(@FilingFrequency, [FilingFrequency]) END,
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwTaxLiabilities] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwTaxLiabilities]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateTaxLiability] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateTaxLiability] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the TaxLiability table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateTaxLiability]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateTaxLiability];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateTaxLiability
ON [${flyway:defaultSchema}].[TaxLiability]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[TaxLiability]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[TaxLiability] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO

------------------------------------------------------------
----- UPDATE PROCEDURE FOR TaxRate
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateTaxRate]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateTaxRate];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateTaxRate]
    @ID uniqueidentifier,
    @TaxJurisdictionID uniqueidentifier = NULL,
    @TaxCategory nvarchar(50) = NULL,
    @Rate decimal(9, 6) = NULL,
    @EffectiveFrom date = NULL,
    @EffectiveTo_Clear bit = 0,
    @EffectiveTo date = NULL,
    @Source nvarchar(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[TaxRate]
    SET
        [TaxJurisdictionID] = ISNULL(@TaxJurisdictionID, [TaxJurisdictionID]),
        [TaxCategory] = ISNULL(@TaxCategory, [TaxCategory]),
        [Rate] = ISNULL(@Rate, [Rate]),
        [EffectiveFrom] = ISNULL(@EffectiveFrom, [EffectiveFrom]),
        [EffectiveTo] = CASE WHEN @EffectiveTo_Clear = 1 THEN NULL ELSE ISNULL(@EffectiveTo, [EffectiveTo]) END,
        [Source] = ISNULL(@Source, [Source]),
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwTaxRates] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwTaxRates]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateTaxRate] TO [cdp_Developer], [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateTaxRate] TO [cdp_Developer], [cdp_Integration];
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the TaxRate table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateTaxRate]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateTaxRate];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateTaxRate
ON [${flyway:defaultSchema}].[TaxRate]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[TaxRate]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[TaxRate] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
END;
GO
