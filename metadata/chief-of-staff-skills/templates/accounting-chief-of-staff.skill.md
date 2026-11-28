# Accounting & Subledger Skill

**BizApps Accounting** is installed in this environment. It is the AR subsidiary ledger of record and balanced journal-entry primitive (GL accounts, dimensions, multi-currency journal entries, ERP posting batches, tax liabilities, and finance exceptions). It is **not** a standalone general ledger — approved journal-entry batches post outward to the company's ERP (Business Central, QuickBooks, NetSuite, Sage, Xero).

Use this skill whenever the user asks about pending or posted journal entries, GL batch readiness, ERP dispatch failures, open finance exceptions, chart of accounts / dimensions, close cutoff dates (`BooksClosedThroughDate`), tax liabilities, or anomaly-flagged entries.

## Core Data Access & RLS Rules

- **Always read through `RunView` — never raw SQL.** Row-Level Security (RLS) and entity permissions enforce which companies (`CompanyID`) and financial entities the calling user is authorized to inspect.
- **Keep financial writes under explicit operator approval:** Do not autonomously post, approve, or dispatch batches to an external ERP (`Build Journal Entry Batches`, `Dispatch Approved Journal Entry Batches`, `Run ERP Sync`). Summarize what is pending or failed and direct the user to approve/dispatch through Accounting or confirm explicitly if an authorized operator requests action.
- **Check `BooksClosedThroughDate` and `PostingStartDate`** on `MJ_BizApps_Accounting: Accounting Company Profiles` whenever explaining why an entry is held back or requires a period adjustment.
- **Multi-currency accuracy:** `DebitAmount` / `CreditAmount` on `MJ_BizApps_Accounting: Journal Entry Lines` are in the company's `FunctionalCurrencyCode`; original transaction amounts live in `OriginalCurrencyCode`, `OriginalDebitAmount`, `OriginalCreditAmount`, and `ExchangeRateUsed`.

## Main Entities & Key Fields

| Entity | Purpose | Key Fields & Statuses |
| --- | --- | --- |
| `MJ_BizApps_Accounting: Accounting Company Profiles` | Legal/operating entity accounting settings and close controls | `CompanyCode`, `EntityType`, `FunctionalCurrencyCode`, `ReportingCurrencyCode`, `FiscalYearStartMonth`, `PostingStartDate`, `BooksClosedThroughDate`, `ApprovalCFOUserID`, `ManualJournalEntryApprovalThreshold`, `IsActive` |
| `MJ_BizApps_Accounting: GL Accounts` | Chart of accounts per company (synced from ERP or seeded) | `CompanyID`, `Code`, `Name`, `AccountType` (`'Asset'` \| `'Liability'` \| `'Equity'` \| `'Revenue'` \| `'Expense'`), `ParentGLAccountID`, `IsControlAccount`, `ExternalSystem`, `ExternalAccountID`, `IsActive` |
| `MJ_BizApps_Accounting: GL Account Roles` & `MJ_BizApps_Accounting: GL Account Links` | Role-based mappings from business records (products, banks, companies) to GL accounts | `GLAccountID`, `GLAccountRoleID`, `EntityID`, `RecordID`, `Status` (`'Active'` \| `'Pending'` \| `'Disabled'`) |
| `MJ_BizApps_Accounting: Journal Entries` | Balanced subledger journal entries (order/payment/rev-rec/manual) | `EntryNumber`, `CompanyID`, `EffectiveDate`, `EntryTypeID`, `Status` (`'Pending'` \| `'Batched'` \| `'GLPosted'`), `Description`, `LinkedEntityID`, `LinkedRecordID`, `JournalEntryBatchID`, `ReversesJournalEntryID`, `GLPostedAt`, `PredictedAnomalyRiskBand` (`'Low'` \| `'Medium'` \| `'High'` \| `'Critical'`), `ApprovalLevel` (`'Standard'` \| `'CFO'`) |
| `MJ_BizApps_Accounting: Journal Entry Lines` | Debit/credit lines belonging to a journal entry (with optional `Journal Entry Line Dimensions`) | `JournalEntryID`, `LineNumber`, `GLAccountID`, `DebitAmount`, `CreditAmount`, `OriginalCurrencyCode`, `OriginalDebitAmount`, `OriginalCreditAmount`, `ExchangeRateUsed`, `Description` |
| `MJ_BizApps_Accounting: Journal Entry Batches` | Single-company netted GL posting batches queued for ERP dispatch | `JournalEntryBatchNumber`, `CompanyID`, `PostingDate`, `TargetSystem` (`'BusinessCentral'` \| `'QuickBooks'` \| `'NetSuite'` \| `'Sage'` \| `'Xero'` \| `'Other'`), `Status` (`'Pending'` \| `'Approved'` \| `'Sent'` \| `'Posted'` \| `'Failed'` \| `'Cancelled'` \| `'Archived'`), `TotalEntries`, `TotalDebits`, `TotalCredits`, `ApprovedAt`, `SentAt`, `PostedAt`, `ErrorMessage`, `ApprovalTaskID` |
| `MJ_BizApps_Accounting: Dimensions` & `MJ_BizApps_Accounting: Dimension Values` | Analytical dimensions (department, class, location, project) | `Code`, `Name`, `DimensionID`, `ParentDimensionValueID`, `EffectiveFrom`, `EffectiveTo`, `IsActive` |
| `MJ_BizApps_Accounting: Finance Exceptions` | Actionable accounting/billing exceptions surfaced for finance review | `FinanceExceptionTypeID`, `CompanyID`, `SourceEntityID`, `SourceRecordID`, `Amount`, `ExceptionDate`, `Summary`, `Status` (`'Open'` \| `'Reviewed'` \| `'Corrected'`), `ReviewedByUserID`, `ReviewedAt`, `ReviewNote` |
| `MJ_BizApps_Accounting: Tax Liabilities` | Accrued vs remitted sales/indirect tax obligations per jurisdiction | `CompanyID`, `TaxAuthorityID`, `TaxJurisdictionID`, `AccruedAmount`, `RemittedAmount`, `Status` (`'Open'` \| `'Filed'` \| `'PartiallyPaid'` \| `'Paid'`), `DueDate`, `FilingFrequency` |
| `MJ_BizApps_Accounting: Currencies` & `MJ_BizApps_Accounting: Currency Spot Rates` | Supported currencies and FX spot rates | `Code`, `Name`, `Symbol`, `DecimalPlaces`, `IsActive` |

## Common Chief of Staff Workflows

1. **"What needs finance attention today?" / Close readiness check**
   - Query `MJ_BizApps_Accounting: Finance Exceptions` where `Status = 'Open'` ordered by `ExceptionDate ASC` (group by `Company` and `FinanceExceptionType`).
   - Query `MJ_BizApps_Accounting: Journal Entry Batches` where `Status IN ('Pending', 'Approved', 'Failed')` to highlight batches awaiting approval, queued for ERP dispatch, or stuck with `ErrorMessage`.
   - Query `MJ_BizApps_Accounting: Journal Entries` where `PredictedAnomalyRiskBand IN ('High', 'Critical')` and `Status != 'GLPosted'` to surface flagged entries before close.
2. **"Why hasn't entry X posted to the ERP yet?"**
   - Read the `MJ_BizApps_Accounting: Journal Entries` row and its `CompanyID`'s `Accounting Company Profiles` (`PostingStartDate`, `BooksClosedThroughDate`), plus its linked `Journal Entry Batch` (`Status`, `ApprovalTaskID`, `ErrorMessage`).
3. **"What tax liabilities are coming due?"**
   - Query `MJ_BizApps_Accounting: Tax Liabilities` where `Status IN ('Open', 'PartiallyPaid', 'Filed')` ordered by `DueDate ASC`, reporting `AccruedAmount`, `RemittedAmount`, and remaining balance (`AccruedAmount - RemittedAmount`).
4. **"Break down journal entry X by GL account and dimensions"**
   - Query `MJ_BizApps_Accounting: Journal Entry Lines` filtered by `JournalEntryID` (and `MJ_BizApps_Accounting: Journal Entry Line Dimensions` when dimensions are requested), confirming debits equal credits and citing functional vs original currency.
