-- =============================================================================
-- Migration: V202610201040__v0.24.x__Validator_Capture.sql
-- Description: stores the CodeGen validator code for eight CHECK constraints
--              whose generated validators no migration carried (#314).
-- =============================================================================
--
-- WHY
--
-- CodeGen turns each CHECK constraint into a TypeScript Validate*() method and
-- stores the method in __mj.GeneratedCode. On the next run it reuses a stored
-- row whose Source matches the constraint's definition text exactly, and only
-- asks the AI again when no row matches. A host or a fresh database built from
-- migrations has only the rows migrations insert, so for these eight
-- constraints every CodeGen run wrote new AI code under new names, and the
-- committed entity_subclasses.ts could not be reproduced from the migrations.
--
-- - Journal Entry Batches (ArchiveAudit, CancelAudit, CancelERPCheck): v0.15
--   inserted rows for the cancel rules, but each insert's NOT EXISTS guard was
--   keyed on the entity alone, matched the entity's earlier table-level
--   validator and skipped the insert (MemberJunction/MJ#4921). ArchiveAudit was
--   never captured.
-- - Finance Exception Types (Code, Configuration) and Finance Exceptions
--   (DedupeKey, Summary, Review): never captured after v0.17 created them.
--
-- WHAT CHANGES
--
-- Eight __mj.GeneratedCode rows in the 'CodeGen: Validators' category. Name,
-- Description and Code are the validators already committed in
-- packages/Entities/src/generated/entity_subclasses.ts, so CodeGen keeps them
-- unchanged. Source is each constraint's definition as SQL Server stores it
-- (sys.check_constraints.definition), which is the text CodeGen matches on.
-- Table-level rows link to the entity (MJ: Entities); field-level rows link to
-- the entity field (MJ: Entity Fields). Each insert selects its entity or field
-- by name, so it inserts nothing where that row is absent.
--
-- No schema change, so there is no CodeGen output section.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================

-- MJ_BizApps_Accounting: Journal Entry Batches @ Table Level (CK_JournalEntryBatch_ArchiveAudit): ValidateArchivedStatusRequirements
INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
SELECT 'b5540d95-9b93-4ed5-9b64-e4c7d91ad56a',
       (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name] = 'CodeGen: Validators'),
       'C43229F6-4CC8-4838-9D04-03419A2DA191',
       GETUTCDATE(),
       'TypeScript',
       'Approved',
       N'([Status]<>''Archived'' OR [ArchiveReason] IS NOT NULL AND len(ltrim(rtrim([ArchiveReason])))>(0) AND [ArchivedAt] IS NOT NULL AND [ArchivedByUserID] IS NOT NULL)',
       N'public ValidateArchivedStatusRequirements(result: ValidationResult) {
	if (this.Status === "Archived") {
		if (this.ArchiveReason == null || this.ArchiveReason.trim().length === 0) {
			result.Errors.push(new ValidationErrorInfo(
				"ArchiveReason",
				"An archive reason is required when the status is set to Archived.",
				this.ArchiveReason,
				ValidationErrorType.Failure
			));
		}
		if (this.ArchivedAt == null) {
			result.Errors.push(new ValidationErrorInfo(
				"ArchivedAt",
				"The archived date and time is required when the status is set to Archived.",
				this.ArchivedAt,
				ValidationErrorType.Failure
			));
		}
		if (this.ArchivedByUserID == null) {
			result.Errors.push(new ValidationErrorInfo(
				"ArchivedByUserID",
				"The user who archived the record is required when the status is set to Archived.",
				this.ArchivedByUserID,
				ValidationErrorType.Failure
			));
		}
	}
}',
       N'When the status is set to ''Archived'', an archive reason, archive date, and the user who archived the record must all be provided.',
       N'ValidateArchivedStatusRequirements',
       (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ: Entities'),
       CONVERT(NVARCHAR(450), e.[ID])
FROM [${mjSchema}].[Entity] e
WHERE e.[Name] = N'MJ_BizApps_Accounting: Journal Entry Batches';

-- MJ_BizApps_Accounting: Journal Entry Batches @ Table Level (CK_JournalEntryBatch_CancelAudit): ValidateCancelledApprovedBatch
INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
SELECT 'ef7c98bc-7dc2-4e8b-a34c-c77ea32f21df',
       (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name] = 'CodeGen: Validators'),
       'C43229F6-4CC8-4838-9D04-03419A2DA191',
       GETUTCDATE(),
       'TypeScript',
       'Approved',
       N'([Status]<>''Cancelled'' OR [ApprovedAt] IS NULL OR [CancelReason] IS NOT NULL AND len(ltrim(rtrim([CancelReason])))>(0) AND [CancelledAt] IS NOT NULL AND [CancelledByUserID] IS NOT NULL)',
       N'public ValidateCancelledApprovedBatch(result: ValidationResult) {
	if (this.Status === "Cancelled" && this.ApprovedAt != null) {
		const hasCancelReason = this.CancelReason != null && this.CancelReason.trim().length > 0;
		const hasCancelledAt = this.CancelledAt != null;
		const hasCancelledBy = this.CancelledByUserID != null;

		if (!hasCancelReason || !hasCancelledAt || !hasCancelledBy) {
			result.Errors.push(new ValidationErrorInfo(
				"CancelReason",
				"An approved batch that is cancelled must have a cancellation reason, cancellation date, and the user who cancelled it.",
				this.CancelReason,
				ValidationErrorType.Failure
			));
		}
	}
}',
       N'If an approved journal entry batch is cancelled, a cancellation reason, cancellation date, and the user who cancelled it must be provided.',
       N'ValidateCancelledApprovedBatch',
       (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ: Entities'),
       CONVERT(NVARCHAR(450), e.[ID])
FROM [${mjSchema}].[Entity] e
WHERE e.[Name] = N'MJ_BizApps_Accounting: Journal Entry Batches';

-- MJ_BizApps_Accounting: Journal Entry Batches @ Table Level (CK_JournalEntryBatch_CancelERPCheck): ValidateCancelledSentBatchERPNotPostedDetails
INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
SELECT '273e8328-3679-4583-af7c-81147357f718',
       (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name] = 'CodeGen: Validators'),
       'C43229F6-4CC8-4838-9D04-03419A2DA191',
       GETUTCDATE(),
       'TypeScript',
       'Approved',
       N'([Status]<>''Cancelled'' OR [SentAt] IS NULL OR [ERPNotPostedConfirmedAt] IS NOT NULL AND [ERPNotPostedConfirmedByUserID] IS NOT NULL AND [ERPNotPostedBasis] IS NOT NULL)',
       N'public ValidateCancelledSentBatchERPNotPostedDetails(result: ValidationResult) {
	if (this.Status === "Cancelled" && this.SentAt != null) {
		if (this.ERPNotPostedConfirmedAt == null || this.ERPNotPostedConfirmedByUserID == null || this.ERPNotPostedBasis == null) {
			result.Errors.push(new ValidationErrorInfo(
				"ERPNotPostedBasis",
				"If a batch is cancelled after being sent, the ERP non-posting confirmation date, confirming user, and basis must all be specified.",
				this.ERPNotPostedBasis,
				ValidationErrorType.Failure
			));
		}
	}
}',
       N'If a journal entry batch is marked as Cancelled after it has already been sent, the ERP non-posting confirmation details (date, confirming user, and basis) must be provided to ensure proper audit tracking of why the batch was not posted.',
       N'ValidateCancelledSentBatchERPNotPostedDetails',
       (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ: Entities'),
       CONVERT(NVARCHAR(450), e.[ID])
FROM [${mjSchema}].[Entity] e
WHERE e.[Name] = N'MJ_BizApps_Accounting: Journal Entry Batches';

-- MJ_BizApps_Accounting: Finance Exception Types @ Field: Code (CK_FinanceExceptionType_Code): ValidateCodeNotEmpty
INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
SELECT 'bfa51cd3-470d-491a-8f9f-a570de3e626a',
       (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name] = 'CodeGen: Validators'),
       'C43229F6-4CC8-4838-9D04-03419A2DA191',
       GETUTCDATE(),
       'TypeScript',
       'Approved',
       N'(len(ltrim(rtrim([Code])))>(0))',
       N'public ValidateCodeNotEmpty(result: ValidationResult) {
	if (this.Code === undefined || this.Code === null || this.Code.trim().length === 0) {
		result.Errors.push(new ValidationErrorInfo(
			"Code",
			"Code cannot be empty or consist only of whitespace.",
			this.Code,
			ValidationErrorType.Failure
		));
	}
}',
       N'The Code field cannot be empty or consist only of whitespace characters.',
       N'ValidateCodeNotEmpty',
       (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ: Entity Fields'),
       CONVERT(NVARCHAR(450), ef.[ID])
FROM [${mjSchema}].[EntityField] ef
INNER JOIN [${mjSchema}].[Entity] e ON e.[ID] = ef.[EntityID]
WHERE e.[Name] = N'MJ_BizApps_Accounting: Finance Exception Types' AND ef.[Name] = N'Code';

-- MJ_BizApps_Accounting: Finance Exception Types @ Field: Configuration (CK_FinanceExceptionType_Configuration): ValidateConfigurationIsJson
INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
SELECT '2956bf0d-509f-4c15-aaf7-11ad6336462b',
       (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name] = 'CodeGen: Validators'),
       'C43229F6-4CC8-4838-9D04-03419A2DA191',
       GETUTCDATE(),
       'TypeScript',
       'Approved',
       N'(isjson([Configuration])=(1))',
       N'public ValidateConfigurationIsJson(result: ValidationResult) {
	if (this.Configuration != null && this.Configuration.trim() !== "") {
		try {
			JSON.parse(this.Configuration);
		} catch (e) {
			result.Errors.push(new ValidationErrorInfo(
				"Configuration",
				"The Configuration field must be a valid JSON string.",
				this.Configuration,
				ValidationErrorType.Failure
			));
		}
	}
}',
       N'The configuration field must contain a valid JSON-formatted string to ensure system settings can be parsed and applied correctly.',
       N'ValidateConfigurationIsJson',
       (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ: Entity Fields'),
       CONVERT(NVARCHAR(450), ef.[ID])
FROM [${mjSchema}].[EntityField] ef
INNER JOIN [${mjSchema}].[Entity] e ON e.[ID] = ef.[EntityID]
WHERE e.[Name] = N'MJ_BizApps_Accounting: Finance Exception Types' AND ef.[Name] = N'Configuration';

-- MJ_BizApps_Accounting: Finance Exceptions @ Field: DedupeKey (CK_FinanceException_DedupeKey): ValidateDedupeKeyNotEmpty
INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
SELECT '3267996a-32fd-4272-907e-c1dd1887b3e1',
       (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name] = 'CodeGen: Validators'),
       'C43229F6-4CC8-4838-9D04-03419A2DA191',
       GETUTCDATE(),
       'TypeScript',
       'Approved',
       N'(len(ltrim(rtrim([DedupeKey])))>(0))',
       N'	public ValidateDedupeKeyNotEmpty(result: ValidationResult) {
		if (this.DedupeKey === undefined || this.DedupeKey === null || this.DedupeKey.trim() === "") {
			result.Errors.push(new ValidationErrorInfo(
				"DedupeKey",
				"Dedupe Key cannot be empty or consist only of spaces.",
				this.DedupeKey,
				ValidationErrorType.Failure
			));
		}
	}',
       N'The deduplication key must not be empty or consist only of spaces.',
       N'ValidateDedupeKeyNotEmpty',
       (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ: Entity Fields'),
       CONVERT(NVARCHAR(450), ef.[ID])
FROM [${mjSchema}].[EntityField] ef
INNER JOIN [${mjSchema}].[Entity] e ON e.[ID] = ef.[EntityID]
WHERE e.[Name] = N'MJ_BizApps_Accounting: Finance Exceptions' AND ef.[Name] = N'DedupeKey';

-- MJ_BizApps_Accounting: Finance Exceptions @ Field: Summary (CK_FinanceException_Summary): ValidateSummaryNotEmpty
INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
SELECT '7fe5e374-b56f-499d-9c11-35d34e20da0f',
       (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name] = 'CodeGen: Validators'),
       'C43229F6-4CC8-4838-9D04-03419A2DA191',
       GETUTCDATE(),
       'TypeScript',
       'Approved',
       N'(len(ltrim(rtrim([Summary])))>(0))',
       N'public ValidateSummaryNotEmpty(result: ValidationResult) {
	if (this.Summary != null && this.Summary.trim().length === 0) {
		result.Errors.push(new ValidationErrorInfo(
			"Summary",
			"Summary cannot be empty or consist only of spaces.",
			this.Summary,
			ValidationErrorType.Failure
		));
	}
}',
       N'The summary field cannot be empty or consist only of spaces.',
       N'ValidateSummaryNotEmpty',
       (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ: Entity Fields'),
       CONVERT(NVARCHAR(450), ef.[ID])
FROM [${mjSchema}].[EntityField] ef
INNER JOIN [${mjSchema}].[Entity] e ON e.[ID] = ef.[EntityID]
WHERE e.[Name] = N'MJ_BizApps_Accounting: Finance Exceptions' AND ef.[Name] = N'Summary';

-- MJ_BizApps_Accounting: Finance Exceptions @ Table Level (CK_FinanceException_Review): ValidateStatusAndReviewDetails
INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
SELECT 'b3874bd0-54a1-409c-b70b-337c93a68254',
       (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name] = 'CodeGen: Validators'),
       'C43229F6-4CC8-4838-9D04-03419A2DA191',
       GETUTCDATE(),
       'TypeScript',
       'Approved',
       N'([Status]=''Open'' AND [ReviewedByUserID] IS NULL AND [ReviewedAt] IS NULL AND [ReviewNote] IS NULL OR ([Status]=''Corrected'' OR [Status]=''Reviewed'') AND [ReviewedByUserID] IS NOT NULL AND [ReviewedAt] IS NOT NULL)',
       N'public ValidateStatusAndReviewDetails(result: ValidationResult) {
	const status = this.Status;
	const hasReviewer = this.ReviewedByUserID !== null && this.ReviewedByUserID !== undefined;
	const hasReviewedAt = this.ReviewedAt !== null && this.ReviewedAt !== undefined;
	const hasReviewNote = this.ReviewNote !== null && this.ReviewNote !== undefined;

	const conditionOpen = status === "Open" && !hasReviewer && !hasReviewedAt && !hasReviewNote;
	const conditionReviewed = (status === "Corrected" || status === "Reviewed") && hasReviewer && hasReviewedAt;

	if (!conditionOpen && !conditionReviewed) {
		result.Errors.push(new ValidationErrorInfo(
			"Status",
			"An ''Open'' status requires all review fields to be empty. A ''Corrected'' or ''Reviewed'' status requires both ReviewedByUserID and ReviewedAt to be populated.",
			this.Status,
			ValidationErrorType.Failure
		));
	}
}',
       N'Ensures that open exceptions do not have any review information, while corrected or reviewed exceptions must have both a reviewer and a review timestamp.',
       N'ValidateStatusAndReviewDetails',
       (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ: Entities'),
       CONVERT(NVARCHAR(450), e.[ID])
FROM [${mjSchema}].[Entity] e
WHERE e.[Name] = N'MJ_BizApps_Accounting: Finance Exceptions';
