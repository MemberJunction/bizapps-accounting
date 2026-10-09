# @mj-biz-apps/accounting-ng

## 0.21.3

### Patch Changes

- 746b731: Batch preview selection (the Build Batch dialog and the batch workspace) is now either every candidate or an explicit set of ticked entries, sent to the preview and the build as it is. A filter change no longer sends a selection derived from the previous preview's entries, so Entry Totals, Net to Post, the out-of-order warning and the Build count describe the entries ticked on screen. After Clear All, or any untick, entries that a later filter change brings in start unticked (bc-aidp-next-golive#284).
  - @mj-biz-apps/accounting-engine-base@0.21.3
  - @mj-biz-apps/accounting-entities@0.21.3

## 0.21.2

### Patch Changes

- 7234d75: Company Setup selects a newly created company again. On MJ 6.1.x a new Accounting Company Profile (IsA MJ: Companies) comes back from its save with `.ID` holding the browser's key, which was never written, so the dashboard selected nothing after the reload. It now reads the key from `PrimaryKey`, which carries the written value.
  - @mj-biz-apps/accounting-engine-base@0.21.2
  - @mj-biz-apps/accounting-entities@0.21.2

## 0.21.1

### Patch Changes

- 96e5830: A journal-entry batch cutoff is now always a whole business day (golive #168). `EffectiveDate` is a `DATE` column, but the batch workspace sent its cutoff as a UTC instant ("now"), and the engine compared it directly, so from about 7 PM Central the preview included journal entries dated tomorrow and the build batched them. The workspace's cutoff is now a date input that defaults to today's business day.

  The SHAPE of a cutoff or start date decides what it means: `YYYY-MM-DD` is that day; an ISO date-time with an offset is the business day it falls on (`BusinessTimeZoneEngine`), so `2026-09-30T19:00:00-05:00` — exactly UTC midnight — is 30 September, not 1 October. `StartDate` follows the same rule as `Cutoff`, so a start and cutoff at the same evening instant no longer select an empty window. `BuildJournalEntryBatchOptions.cutoff`/`startDate` accept these strings as well as a `Date`; a `Date` at UTC midnight is still read as a day (the in-process shape `FromCalendarDay` produces), any other `Date` as an instant.

  A malformed `Cutoff` or `StartDate` — `garbage`, `2026-02-30`, a date-time with no offset — is now refused at the boundary with an error naming the field, instead of a bare `RangeError` or a silent roll-over into March. New public export: `requireDateBound(value, context)`. The batch `PostingDate` now looks up the business day for the batch's company, the same lookup the cutoff makes.

- cb62474: Clearing the batch cutoff now says what it does (golive #168). An empty cutoff sends no date clause, so the preview includes Pending journal entries dated in the future; the batch workspace and the Batches page's Build Batch modal now show "No cutoff — includes future-dated entries." under the date input, and the workspace's criteria chips show it in place of the missing "through" chip.
- 468b524: Date-only fields (`PostingDate`, `EffectiveDate`) now show the stored day for viewers west of UTC instead of the day before (golive #168). This covers the company overview's recent batches, the Batches page list, Build Batch preview rows and covered range, the Accounting overview's batch list, and the Batch Status dashboard. The overview's monthly JE volume bars now bucket by calendar month, so entries dated the 1st no longer count toward the prior month.
- Updated dependencies [fd193bf]
  - @mj-biz-apps/accounting-entities@0.21.1
  - @mj-biz-apps/accounting-engine-base@0.21.1

## 0.21.0

### Minor Changes

- 6a30d91: A Pending journal entry batch can be cancelled with a reason by the company's configured approver or by the user who built it. Its journal entries return to the candidate pool, and its approval Task gets a comment and is closed as Cancelled. `Accounting.CancelJournalEntryBatch` now accepts a Pending batch. A CFO rejection still cancels a Pending batch through `Accounting.RecordJournalEntryBatchDecision`, and its notes become the batch's `CancelReason`.

  The Batches screen and JE batch approvals offer Cancel on a Pending batch, and Reject asks for a reason.

  Breaking change to `JournalEntryBatchCancelGate`: `assertRejected` is replaced by `isRejected`, which returns a boolean, and `assertMayCancelPending` is added.

### Patch Changes

- Updated dependencies [4b5fdac]
- Updated dependencies [1af981d]
  - @mj-biz-apps/accounting-entities@0.21.0
  - @mj-biz-apps/accounting-engine-base@0.21.0

## 0.20.0

### Minor Changes

- c7a1af4: A journal entry batch can no longer be sent to the ERP twice, and every send is recorded (#184).

  - New trigger `trg_JournalEntryBatch_SendOnce` (error 50030). A send must start from `Approved` or `Failed`
    and advance `SendAttemptCount` by exactly one; no update may keep a batch `Sent`; and `SentAt`,
    `SentByUserID` and `SendAttemptCount` change at no other time. When two operators, two browser tabs, or a
    scheduled run and an operator send the same batch, the second save fails and its ERP call never runs,
    whether the first send is still `Sent`, has `Posted`, or has `Failed` again.
  - `sendJournalEntryBatch` throws `JournalEntryBatchSendRefusedError` for that refusal, naming the status the
    batch reads now. `Accounting.BuildJournalEntryBatches` does not mark the batch `Failed` on it.
  - New columns `SentByUserID` and `SendAttemptCount` on `JournalEntryBatch`. Every transition into `Sent`
    stamps them, with `SentAt`, from the context user and the loaded count. The count is dispatch attempts that
    entered `Sent`, including a retry adopted from the ERP and a first send the pre-flight lookup refuses.
    Batches sent before this release read `SendAttemptCount = 1`, with no sender.
  - The batch detail panel and the Dispatch status page show who sent a batch and how many attempts it took.
  - A successful retry still clears `ErrorMessage`. The earlier value, and each overwritten `SentAt` and
    sender, remain in `__mj.RecordChange`.

- b2de2f7: Dimension tags on a locked journal entry line are frozen, and a batch can record that a retry adopted the ERP's posting over a broken approved-content seal (#216).

  - New trigger `trg_JELD_Immutability` (error 50033) refuses insert, update and delete of a `JournalEntryLineDimension` row whose journal entry is `Batched` or `GLPosted`, as `trg_JEL_Immutability` does for the line. The PostgreSQL twin ships as a PG-only migration, since the converter does not convert triggers.
  - New nullable column `JournalEntryBatch.SealMismatchDetectedAt`: when a Failed batch's retry finds its journal already in the ERP although the batch no longer matches its seal, this records when it was recorded Posted, so the batch can be listed and its local tags reviewed. Existing batches read NULL.
  - `SealMismatchDetectedAt` is frozen. `trg_JournalEntryBatch_Immutability` (error 50034) lets it be set only by the update that records a retried batch `Posted` (`Sent` → `Posted` with `SendAttemptCount` above 1), and refuses any later change or clear and any insert that carries it. The trigger now also fires on insert. Its PostgreSQL twin is `trg_JournalEntryBatch_SealMismatchFreeze` in the same PG-only migration.

- a8e560f: New nullable column `AccountingCompanyProfile.PostingStartDate` (DATE): the first `EffectiveDate` a company posts to the ERP. Journal entries dated before it are meant never to enter a posting batch, for example history brought in at cutover that the ERP already holds. NULL means no floor; existing profiles read NULL. Includes the CodeGen output for the column (entity subclass, GraphQL types, profile form field).

### Patch Changes

- 5ce8759: A batch the ERP accepted can no longer be posted a second time. A `Failed` batch that carries the ERP's reference (the ERP accepted it and only its `Posted` save failed) is recorded `Posted` by a retry under that reference, with no lookup and no post, whatever the lookup would answer and whether or not the operator confirmed. `Cancel()` refuses it, and Dispatch status no longer offers Cancel for it. When the ERP returns no reference, the batch number is kept in its place.

  When the `Sent → Failed` save itself fails, the send reloads the batch and throws `JournalEntryBatchFailureNotRecordedError`, carrying the status the database holds and any ERP reference, instead of reporting a `Failed` the database does not hold. The scheduled run's triage writes that reference with `Failed`.

  A batch moves to `Sent` or `Posted` only through `JournalEntryBatchEntityServer.SaveDispatchTransition()`, which the dispatch engine calls; a plain save to either is refused, so a batch cannot be marked `Sent` and then `Posted` without the ERP being called.

  A lookup that finds nothing is not trusted while the `ERP_POSTING_NOT_READ_BACK` finance exception type is missing or inactive, since a post that could not be read back would then raise no exception. An over-long account number names the account and points at its External Account ID instead of saying to shorten it. Both batch previews show how many entries a company's posting start date holds back.

- f6aebd8: The Journal Entry Batch and Company overview panels mount again. Their card tools and footers sat on `<div>` elements, but `mj-card`'s `mjCardTools` and `mjCardFooter` slots are TemplateRef directives that need an `<ng-template>`, so both panels failed with NG0201 and the batch record lost its member journal entries table.
- 6931f2c: A Failed batch that did post, but whose summary-line dimension tags changed locally, can be recorded Posted again (#216). Its retry was refused by the approved-content seal before the ERP lookup could find the posting, and its cancel was refused because the lookup did find it, so archiving was the only way out.

  - `sendJournalEntryBatch` now judges a broken seal on a `Failed` retry after the ERP lookup. When the ERP already holds the batch, it is recorded `Posted` with no second post and `SealMismatchDetectedAt` is set; the local tags are left as they are. A lookup that finds nothing, a mismatch, another batch's journal, a failed lookup or no lookup still refuses the retry. A first send from `Approved`, and any retry whose footing, member count or summary header is off, are refused before the lookup as before.
  - New `JournalEntryBatchEntityServer.CheckApprovedContent()` returns the dispatch checks split into `CoherenceProblems` and `SealProblems`; `CheckControlTotalCoherence()` is unchanged.
  - The batch detail panel shows a warning and the time when a batch carries `SealMismatchDetectedAt`.

- 854cf11: Build Batch preview: apply only the latest preview response. Overlapping previews (ticking entries quickly) could settle out of order, so an earlier, slower response overwrote the totals for the current selection and cleared the loading state early. The Build Batch modal and the batch workspace now discard superseded responses, and the workspace writes a response to the tab that requested it rather than the tab active when it arrives (#254).
- Updated dependencies [77e4756]
- Updated dependencies [c7a1af4]
- Updated dependencies [d3a99ff]
- Updated dependencies [b2de2f7]
- Updated dependencies [a8e560f]
  - @mj-biz-apps/accounting-entities@0.20.0
  - @mj-biz-apps/accounting-engine-base@0.20.0

## 0.19.0

### Minor Changes

- 6f1515e: The deferred-revenue waterfall adds a "Recognized YTD" KPI (#231): entries recognized between the first day of the company's fiscal year and the business day, inclusive. The fiscal-year start comes from the company's Accounting Company Profile, 1 January when it has none. The rule (`FiscalYearOf`, `IsInFiscalYearToDate`, `AccountingEngineBase.FiscalYearStartFor`) moves to accounting-engine-base, and journal-entry numbering now uses it too, with no change in the fiscal years it assigns.

### Patch Changes

- Updated dependencies [6f1515e]
  - @mj-biz-apps/accounting-engine-base@0.19.0
  - @mj-biz-apps/accounting-entities@0.19.0

## 0.18.0

### Patch Changes

- Updated dependencies [cc21d7c]
  - @mj-biz-apps/accounting-entities@0.18.0
  - @mj-biz-apps/accounting-engine-base@0.18.0

## 0.17.0

### Minor Changes

- a36297a: Adds a finance exception list for month-end review (golive #279). New tables `FinanceExceptionType` (the catalog of exception kinds: a stable `Code`, the owning app, `IsActive`, and a JSON `Configuration` of detector thresholds) and `FinanceException` (one row per record a reviewer must look at, unique on type and `DedupeKey`, with `Status` `Open` → `Reviewed` | `Corrected` and a review audit that `CK_FinanceException_Review` keeps consistent with it). Five types are seeded as metadata: `PROGRESS_JUDGMENT_CALL`, `PROGRESS_UNATTESTED`, `WON_DEAL_ORDER_NOT_CONFIRMED`, `PRICE_BELOW_ENGINE_UNAPPROVED` and `OVERLAPPING_SUBSCRIPTION`. Three remote operations: `Accounting.GetFinanceExceptionTypes` returns each type's parsed thresholds; `Accounting.RaiseFinanceExceptions` raises exceptions idempotently (an existing row is returned rather than duplicated, and a repeat raise of an Open row refreshes its creator fields and summary; an inactive type is skipped; an unknown type or entity fails the whole call and writes nothing), joins the caller's transaction, reads under an update lock so a concurrent raise of the same item returns the first one's row, and requires the system user when called through the API, so only server code raises; `Accounting.ClearFinanceException` clears an Open exception with a required note, locking the row so a concurrent clear finds it no longer Open, and requires the new `MJ.BizApps.Accounting.FinanceExceptions.Clear` authorization, held by a new `Finance` role, while refusing the source record's creator and any exception whose creator has no linked login. `FinanceExceptionEntityServer` refuses a status or review change made outside that operation, any change to a cleared exception, and any delete. A saved query, "Finance Exceptions Ready To Close", groups the list by company and month; a month is ready when it has no Open exceptions. Remote operation typed bases are now emitted into `@mj-biz-apps/accounting-entities` (`generated/remote_operations.ts`).

### Patch Changes

- c46af6c: The batch preview returns `GrossDebits` and `GrossCredits`, the ticked entries' line totals before netting, beside
  the netted `TotalDebits` and `TotalCredits` the batch carries. The Build Batch modal shows both as "Entry Totals" and
  "Net to Post", with a note when netting reduces the total, and the batch workspace's summary strip shows both. A
  recognition entry's Dr Deferred Revenue nets against its booking's Cr Deferred Revenue, so the netted pair alone read
  as if recognition entries were left out. The modal's ordering warning now says the count is of excluded entries older
  than an included one; it described them as included entries.
- Updated dependencies [7210151]
- Updated dependencies [3af15bb]
- Updated dependencies [a36297a]
  - @mj-biz-apps/accounting-entities@0.17.0
  - @mj-biz-apps/accounting-engine-base@0.17.0

## 0.16.0

### Patch Changes

- 0529ef0: The deferred-revenue waterfall counts an entry as recognized from its `EffectiveDate` day, not from the first of
  its month, and a month's "Released" amount and chip follow the same rule. Reversed entries and reversal entries
  are left out, since the pair nets to zero. The "Recognized YTD" KPI, which summed the whole schedule, is now
  "Recognized to Date" (`WaterfallSummary.TotalRecognizedToDate`). The unused `FormatCompact` method is removed.
- Updated dependencies [844cb02]
  - @mj-biz-apps/accounting-entities@0.16.0
  - @mj-biz-apps/accounting-engine-base@0.16.0

## 0.15.0

### Minor Changes

- 0587bfa: A `Failed` journal entry batch's content is now frozen, and an `Approved` or `Failed` batch can be cancelled (#183). A `Failed` batch is retried under its original approval, but `trg_JournalEntryBatch_Immutability` did not freeze it, so its `PostingDate` — the journal date the ERP receives — control totals and summary pointer could be edited before the retry, and the dispatch check (self-consistency only) would not notice. The trigger now freezes `Failed` alongside `Approved` / `Sent` / `Posted` / `Archived`, and also `Cancelled`, whose approval pair and cancel audit can no longer be rewritten or deleted. It polices the status door too: `Posted`, `Cancelled` and `Archived` are terminal, no batch returns to `Pending`, only a `Pending` batch is approved, a `Sent` batch is not archived, `Cancelled` is reachable only from `Pending`, `Approved` or `Failed`, and an `Approved`/`Failed` batch becomes `Cancelled` only with its summary pointer cleared in the same update. The cancel audit and ERP check are written only by the update that cancels the batch, and `SentAt` is never cleared once set. So that a batch with genuinely wrong content is not left with only retry or archive, `JournalEntryBatchEntityServer.Cancel(contextUser, { reason, confirmNotAlreadyPostedInERP })` now takes an `Approved` or `Failed` batch — and is the only way to: it marks the batch `Cancelled`, then releases the member entries to the next build and deletes the summary, in one transaction. Past approval, only the company's CFO or the batch's approver may cancel, a reason is required (entity plus `CK_JournalEntryBatch_CancelAudit`) and written to the approval Task, and cancelling a `Failed` batch looks its number up in the ERP first (#207): its entries would otherwise be batched again under a new number that no later lookup can connect to a journal that did post. A matching posting refuses the cancel with no override (retry it instead, which records it `Posted`); nothing found lets it through; a mismatch, a failed lookup or no lookup needs the operator's confirmation, and the operation answers `ConfirmationRequired` / `ConfirmationKind` to ask for it. The check is persisted as `ERPNotPostedConfirmedAt` / `ERPNotPostedConfirmedByUserID` / `ERPNotPostedBasis` (`ERPLookup` or `UserAttested`; `CK_JournalEntryBatch_CancelERPCheck`), and the approval Task comment says whether the lookup or the operator established it. `trg_JournalEntry_Immutability` sanctions the member unlock while the owning batch is `Pending` or `Cancelled`. Approval also writes a new `ApprovedContentHash`, a SHA-256 of the batch header, summary entry and lines and member set, frozen by the trigger; `CheckControlTotalCoherence` compares against it and checks the summary entry carries the batch's date and company, so dispatch refuses a batch that changed since approval. Batches approved before this have no hash and get the other checks. Exposed as the `Accounting.CancelJournalEntryBatch` remote operation (Approved/Failed only; Pending is rejected through Batch approvals) and a Cancel action on Dispatch status, Batch Dispatch and the Batches overview.

### Patch Changes

- Updated dependencies [0587bfa]
  - @mj-biz-apps/accounting-entities@0.15.0
  - @mj-biz-apps/accounting-engine-base@0.15.0

## 0.14.0

### Patch Changes

- @mj-biz-apps/accounting-engine-base@0.14.0
- @mj-biz-apps/accounting-entities@0.14.0

## 0.13.0

### Patch Changes

- 673b4dc: Batch dispatch dashboard: a first dispatch that the ERP rejects now shows as an error pointing at Dispatch status, instead of a success message reading "→ Failed". Only a `Posted` outcome is reported as success (#192).
- 995ab69: Journal entry batch dispatch no longer posts a journal the ERP already holds (#182).

  - Every send first looks up the batch number in the ERP. On a Failed retry, a posting that matches
    the batch line for line, on account, amounts and posting date, is recorded as Posted without a
    second send. That recovers a batch whose post succeeded but was recorded Failed. On a first send
    a match is another journal under the same number, so the send is refused and the batch stays
    Approved. A posting that differs, or a lookup that fails, refuses the send unless the operator
    confirms the batch has not posted. Business Central is looked up through `GetGLEntries`.
    QuickBooks Online has no lookup yet and keeps the confirmation on Failed retries.
  - The lookup reads posted G/L entries only. Business Central posting now refuses to write into a
    journal that already holds unposted lines, such as lines left by an earlier rejected post, since
    posting the journal would send them to the GL with the batch.
  - An `afterPost` extension hook that throws no longer turns a post the ERP accepted into a failure.
  - A Business Central post is recorded under its document number. The previous reference was the id
    of the general journal, the same for every batch.
  - The Dispatch status page's Retry sends straight away, and asks for the ERP check only when the
    server says the lookup could not settle it, showing why. A mismatch gets its own dialog that
    defaults to Cancel and needs the batch number retyped to post again.

- f1c039d: The deferred-revenue waterfall buckets each journal entry into the month of its `EffectiveDate` as a
  calendar day, and measures "recognized to date" against the business month. It read the stored UTC
  midnight with browser-local getters, so for any viewer west of Greenwich every month shifted back one
  period. An entry with no `EffectiveDate` falls back to its creation instant, placed on the business
  zone's calendar.
  - @mj-biz-apps/accounting-engine-base@0.13.0
  - @mj-biz-apps/accounting-entities@0.13.0

## 0.12.0

### Minor Changes

- 541595e: Give a journal entry batch that fails after approval a way back (#145).

  A `Failed` batch can now be retried: `sendJournalEntryBatch` (and `Accounting.DispatchJournalEntryBatch`)
  accepts `Failed` as well as `Approved`, taking the `Failed → Sent` edge the status graph already
  allowed. The retry reuses the batch's existing approval, re-running the approval gate and the
  coherence check before it sends. Because a `Failed` batch may already be in the ERP, a retry
  requires `ConfirmNotAlreadyPostedInERP: true`; the Dispatch status page's Retry dispatch button,
  which the server previously refused, now asks the operator to check the ERP for the batch number
  first, and reports a retry the ERP rejects as a failure. A successful retry clears the earlier
  attempt's `ErrorMessage`. A poster that throws now marks the batch `Failed` instead of leaving it
  at `Sent`, and the summary lines load before the `→Sent` save.

  A `Posted` batch whose member `Batched → GLPosted` flip stopped partway is finished by the new
  `resumeJournalEntryBatchPosting` / `Accounting.ResumeJournalEntryBatchPosting`, which makes no ERP
  call. Entries it finishes carry the batch's `PostedAt` and ERP reference.

  `findStrandedJournalEntries` / `Accounting.GetStrandedJournalEntries` report the entries held by
  either state. `Accounting.BuildJournalEntryBatches` appends that count to every run's message, and
  the Dispatch status page shows it with a Finish GL posting action for Posted batches. Scheduled
  runs do not retry failed batches themselves.

### Patch Changes

- c2b3453: The Journal Entries dashboard's "Entries this month" tooltip no longer says the month is UTC. The
  count has been the calendar month in the business time zone since the business-day change; the
  tooltip now says so.
- Updated dependencies [a64b1e0]
  - @mj-biz-apps/accounting-entities@0.12.0
  - @mj-biz-apps/accounting-engine-base@0.12.0

## 0.11.0

### Minor Changes

- dc4235d: Make the journal entry batch build reachable, selective and the only way to create a batch.

  The Batches page's Build Batch dialog now carries an Include checkbox per candidate entry, so an
  operator can hold specific entries back and batch the rest. Ticking re-previews, so the netted
  totals, the covered date range and the out-of-order warning always describe the ticked set; the
  build sends exactly that selection. The server contract for this already existed and was unused.

  The preview operation now distinguishes an empty `IncludedJournalEntryIDs` array ("nothing is
  ticked") from an omitted one ("no selection filter"); collapsing the two netted the whole pool
  behind a header that said nothing was included.

  An unbatched journal entry no longer says only "Assigned when the next batch is built" — it links
  to the Batches page. Creating a batch through Explorer's generic New form is now refused by
  `JournalEntryBatchEntityServer`, and a new batch record opens on an explainer that points at the
  build flow instead of a blank form with control totals to type.

- 8ae3395: Effective dates, posting dates and batch cutoffs are judged on the business day (bc-aidp-next-golive#168).

  A journal entry drafted at 9 PM Eastern on 31 August defaulted to 1 September, because the default
  was the UTC calendar day; the prior-day batch run at 1 AM UTC on the 1st judged "yesterday" in UTC
  too and skipped it. The draft now defaults to today in the instance's business time zone
  (`BusinessTimeZoneEngine` from bizapps-common), the picker writes UTC midnight of the chosen day and
  the draft reads it back from UTC parts, so the two never disagree by a browser offset. The batch
  engine's posting date and `resolveCutoff`'s prior-day and prior-month arithmetic take the business
  zone as an argument. The dashboards' month window, the batch-build modal's default cutoff and the
  "last N days" list windows on Dispatch status, All batches and All journal entries all anchor on the
  same day. CLAUDE.md's "display/zone is a presentation concern" line is replaced with the
  calendar-day doctrine.

  `AccountingCompanyProfile.OperatingTimeZone` is unchanged as the per-company OVERRIDE: the company
  profile panel still prefers it and falls back to `BusinessTimeZoneEngine.Instance.Zone` when it is
  blank, replacing a hardcoded `'America/New_York'`. It migrates into MJ Companies at 6.2, at which
  point the override/fallback split goes away. Note that new profiles are stamped with a non-blank
  `'UTC'`, so the fallback rarely fires in practice — tracked separately.

  **The two posting jobs now schedule on the business clock.** `Timezone` on
  `accounting-post-orders-payments-nightly` and `accounting-post-subscriptions-monthly` moves from
  `UTC` to `America/Chicago`, because the cutoff is resolved from the BUSINESS day at the firing
  instant and a job that fires before that day has rolled over resolves a day early. With the cron on
  UTC and the business zone on Central, the nightly run fired at 20:00 Central the previous evening —
  so PriorDay excluded that whole day's entries, and PriorMonth closed JULY on the 1 September run,
  leaving all of August to wait for October. **A host in another zone must set these two rows to their
  own business zone.** A test reads the committed job metadata and fails if the two stop agreeing on a
  zone or name one the runtime cannot resolve.

  Two window filters compared an instant against a calendar day and are corrected: Dispatch status
  bounds `BatchedAt` (a `datetimeoffset`) on the instants the business day actually starts and ends
  via `DayStartUtc`, rather than pasting `YYYY-MM-DD` into the SQL — which hid the 01:00 UTC nightly
  run's own batches from the page that exists to triage them; and the batch-status dashboard's span
  filter parses both ends as UTC midnight, where the upper end had been parsed in the browser's zone.
  The journal-entry posting-date picker no longer throws on an out-of-range date: `<input type="date">` accepts
  years beyond four digits, and `FromCalendarDay` raises a `RangeError` on anything that is
  not a calendar day, so the handler now leaves the draft's date alone instead.

  `timeWindowFilter`, exported from this package's public API, now takes `now` and `zone` as required
  arguments rather than defaulting them. It had no callers inside this repo, but the change is
  source-breaking for anyone outside it: a silent `'UTC'` default would have let a caller believe it
  had the business-day fix when it did not, so the argument is now forced. `timeWindowRange` keeps its
  optional parameters and its existing behaviour.

  `resolveCutoff`, exported from `@mj-biz-apps/accounting-actions`'s public API (`export *` in
  `packages/Actions/src/index.ts`), gained a required 4th parameter, `zone: string` — callers now pass
  `resolveCutoff(explicitCutoff, mode, now, zone)` instead of the old 3-argument form. Same reasoning
  as `timeWindowFilter`: an optional/defaulted zone would have let a caller believe prior-day/prior-month
  cutoffs were business-zone-aware when they were not, so the argument is required rather than
  defaulted. This is source-breaking for anyone outside this repo calling `resolveCutoff` directly.

  Requires `@mj-biz-apps/common-entities` >= 5.43.0.

### Patch Changes

- @mj-biz-apps/accounting-engine-base@0.11.0
- @mj-biz-apps/accounting-entities@0.11.0

## 0.10.0

### Minor Changes

- 2919ad0: Add predictive journal entry anomaly outcome columns, layered base views (vwJournalEntriesGenerated and vwJournalEntries), and scoring binding write-back.

### Patch Changes

- Updated dependencies [2919ad0]
  - @mj-biz-apps/accounting-entities@0.10.0
  - @mj-biz-apps/accounting-engine-base@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [b1f3c53]
  - @mj-biz-apps/accounting-entities@0.9.0
  - @mj-biz-apps/accounting-engine-base@0.9.0

## 0.8.0

### Minor Changes

- 21accf9: A terminal `Archived` status for journal entry batches that must never post to the ERP (golive #214). Until now the only two terminal states were `Posted`, reachable only through a successful ERP send, and `Cancelled`, which releases the member entries back to the candidate pool — so "close this batch, it must never go to Business Central" had no expression. `Archived` is reachable from `Pending`, `Approved` and `Failed` (not from `Sent`, which may still be posting), makes no ERP call, and leaves the member entries locked at `Batched`: they stay invisible to the nightly and monthly builds, and `trg_JournalEntry_Immutability` refuses to unlock them once the owning batch is no longer `Pending`. A required `ArchiveReason` plus `ArchivedAt` / `ArchivedByUserID` are enforced by the entity and by a new `CK_JournalEntryBatch_ArchiveAudit` CHECK, and `trg_JournalEntryBatch_Immutability` now freezes an `Archived` batch alongside `Approved` / `Sent` / `Posted` so its status cannot be edited back to `Pending` by direct SQL. Exposed as `JournalEntryBatchEntityServer.Archive(reason)`, the `Accounting.ArchiveJournalEntryBatch` remote operation, and an Archive action on the Batch Dispatch dashboard.

### Patch Changes

- Updated dependencies [21accf9]
  - @mj-biz-apps/accounting-entities@0.8.0
  - @mj-biz-apps/accounting-engine-base@0.8.0

## 0.7.0

### Patch Changes

- @mj-biz-apps/accounting-engine-base@0.7.0
- @mj-biz-apps/accounting-entities@0.7.0

## 0.6.1

### Patch Changes

- 553ee29: License declarations now agree on BUSL-1.1 everywhere.

  The README badge was the last thing in the repo still advertising ISC — `LICENSE`,
  `package.json`, `mj-app.json` and every workspace package already declare BUSL-1.1.
  A green ISC badge at the top of the README is the first thing a reader sees, so it
  outranked all of them in practice. The badge now reads BUSL-1.1 and links to `LICENSE`.

- Updated dependencies [553ee29]
  - @mj-biz-apps/accounting-engine-base@0.6.1
  - @mj-biz-apps/accounting-entities@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [434df96]
- Updated dependencies [71fc375]
  - @mj-biz-apps/accounting-entities@0.6.0
  - @mj-biz-apps/accounting-engine-base@0.6.0

## 0.5.0

### Minor Changes

- 9966206: Accounting engine extension registry (`AccountingEngineExtension`) — host-visible
  enable/disable, run order, optional company scope, and a JSON `Configuration` bag
  typed as `IAccountingEngineExtensionConfiguration`.

  Hook participation is not columns: `BaseAccountingEngineExtension` getters and
  Before/After overrides (later in this PR). Empty seed — consumers such as FP&A
  insert their own row. Schema change, so `minor`.

- 51012f5: AccountingERPEngine: Integration Engine pull for COA/dimensions, MJ CreateJournalEntry for batch post, BaseAccountingEngineExtension seam, Accounting.RunERPSync, daily job metadata, and Configuration > ERP sync UI (reusable widgets + Explorer page).
- fa6ae13: BA-D34: `GLAccountRole.Cardinality` (`One` | `Many`) and the `BankAccount` role.

  Separates "where does a receipt post?" (role `Cash`, One, unchanged) from "what
  is cash, for a position?" (role `BankAccount`, Many). Existing roles are
  backfilled to `One`, so payment routing and the BA-D32 tie guard are unaffected.
  Enables FP&A to build `CashBalance` as the sum of a company's Active
  `BankAccount` links. Schema change, so `minor`.

### Patch Changes

- Updated dependencies [9966206]
- Updated dependencies [51012f5]
- Updated dependencies [fa6ae13]
  - @mj-biz-apps/accounting-entities@0.5.0
  - @mj-biz-apps/accounting-engine-base@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [15c31a7]
  - @mj-biz-apps/accounting-entities@0.4.0
  - @mj-biz-apps/accounting-engine-base@0.4.0

## 0.3.0

### Patch Changes

- 6a247d6: Raise the platform floor to MJ 6.1.0-edge.4 and the app dependency floors to the
  versions actually exercised together: bizapps-common >=5.35.1, bizapps-tasks
  > =1.3.0. All @memberjunction/\* dependencies now pin ^6.1.0-edge.4 (caret, never
  > exact — an exact edge pin in a published package forces two MJ copies into a
  > consumer's tree and splits the ClassFactory registry).
- Updated dependencies [cb7aae2]
- Updated dependencies [6a247d6]
- Updated dependencies [804f67e]
- Updated dependencies [e2e867c]
  - @mj-biz-apps/accounting-entities@0.3.0
  - @mj-biz-apps/accounting-engine-base@0.3.0

## 0.2.0

### Minor Changes

- fb2899b: Ship the release-time metadata migration, and realign the release plumbing that 0.1.1 exposed.

  **The metadata migration.** Everything under `metadata/` reached a host only by
  someone running `mj sync push` against it; nothing carried it into a database built
  from migrations alone. A clean deploy therefore came up with the schema but without
  the seeded currencies, journal entry types, GL account roles, the application
  record, the entity/field metadata, the entity actions, or the
  `RelatedRecordCollection` declarations that CodeGen reads to emit the typed `Lines`,
  `Dimensions` and `Members` accessors. This adds that state as a versioned migration,
  captured by pushing into a database built purely from migrations and keeping the
  emitted SQL.

  **Migration filenames realigned to the published version.** The two existing files
  said `v1.0.x` while every package, `mj-app.json`, and npm say `0.1.x`. That segment
  is Flyway/Skyway _description_ text — `ParseMigrationFilename` takes the version from
  the leading digits only, `ComputeChecksum` hashes file content and never the
  filename, and `validate()` compares version and checksum while using the description
  purely in message text — so the rename cannot re-run or invalidate anything on a
  database that already applied them. Renamed with `git mv` (zero content change), plus
  the three places that referenced the baseline by name: the ERD, the migrations doc,
  and `scripts/append-codegen.sh`, where it was the default argument.

  **`pnpm-lock.yaml` refreshed.** The 0.1.1 bump rewrote every internal
  `@mj-biz-apps/accounting-*` dependency to `0.1.1` without updating the lockfile, so
  `pnpm install --frozen-lockfile` failed on `next`, on PRs to `main`, and on every
  feature branch — `ERR_PNPM_OUTDATED_LOCKFILE`. The publish workflow's own
  `mergemain:update-lock` step exists to prevent exactly this; a hand-run bump skips it.

  **Three cross-schema form-chrome entries removed.** `metadata/entity-relationships/.form-chrome.json`
  configured `inclusion` for relationships whose related entity lives in **bizapps-orders** — Journal
  Entries → Order Lines and → Payment Headers, and Dimensions → Order Line Dimensions. Those
  relationship rows exist only because orders' tables carry the FKs, so CodeGen creates them when
  orders installs: on a database with accounting and no orders there are none, the `@lookup:` resolved
  nothing, and `mj sync push` aborted with a full transaction rollback. Accounting's metadata could not
  be applied on any host that installs it without orders — every standalone install. Removed here and
  re-homed in orders, which may legally reference accounting's entities (MemberJunction/bizapps-orders#92).
  No behaviour is lost: `inclusion` is layer 1 of the runtime chrome stack, not a CodeGen input.

### Patch Changes

- Updated dependencies [fb2899b]
  - @mj-biz-apps/accounting-entities@0.2.0
  - @mj-biz-apps/accounting-engine-base@0.2.0

## 0.1.1

### Patch Changes

- 7e00cbd: The last hand-rolled child collections become related-record collections. `JournalEntryLine.Dimensions` replaces `_dimensions` / `_deletedDimensions` plus their save and delete ordering, and is now available on BOTH tiers rather than server-only. `JournalEntryBatch.Members` replaces `_members`, a lazy cache with its own forceRefresh flag, and is declared `ReadOnly: true` / `OnRemove: 'refuse'` — the code already said "read-only by convention" in a comment, and a convention in a comment is enforced by whoever reads it. The GL accounts editor binds the `GLAccount` entity instead of an `AccountDraft` mirror of eleven columns filled by hand in two places and copied back by a third.
- 4ecb890: Rebuilds the baseline's generated half with CodeGen's AI advanced-generation enabled, so the shipped metadata carries semantic form layouts and sensible view defaults instead of bare structural ones. Every field gains a semantic Category (291/291), driving real grouped forms rather than one flat list; `DefaultInView` goes from 9 fields to 106 and search flags are set across the searchable text fields, so a newly-created User View is useful without hand-configuration; four entities that had no name field gain the right one (Journal Entries → `EntryNumber`, Journal Entry Batches → `JournalEntryBatchNumber`, plus Currency Spot Rates and Tax Rates); `Validate()` bodies are generated from CHECK constraints; and field DisplayNames read better (the mirrored parent `Name` on the accounting company profile is now "Company Name", which also stops it colliding with the currency picker's own "Name" column). Entity descriptions are deliberately left as the hand-authored 23/23 — `EntityDescriptions` stays off, since those were written and reviewed rather than generated. No entity or field IDs change: metadata IDs come from the baseline's own INSERTs, so a from-zero deploy reproduces them exactly, verified name-wise and order-independently at zero differences.

  Adds `V202608062100`, a migration that corrects two things the AI got wrong on `AccountingCompanyProfile` — the IS-A child of `__mj.Company` whose parent columns are mirrored as virtual fields and therefore sequenced last. `Name` and `Description` are both NOT NULL but were grouped into a section rendering fifth, so the create dialog hid two required fields; they now sit in the leading section. And `IsNameField` had been cleared on `Name` with nothing nominated, leaving the entity with no name field at all, so anything resolving its display value fell back to a raw UUID; that is restored. Both are pinned with MJ's `AutoUpdate*` opt-outs so a later enrichment run cannot revert them. The corrections live in a V migration rather than the baseline because the baseline's generated half is replaced wholesale on every regeneration — a V migration runs after it on every deploy and therefore survives. Filed upstream as MemberJunction/MJ#3551.

  Removes the Orders Product Catalog Playwright spec from this app's harness. It drove the Orders app from accounting's test suite because Orders had no harness of its own, which inverts the dependency — Orders depends on accounting, never the reverse.

- 1dbc0bb: Declare rxjs as a peerDependency of the Angular package. Four files import it (coa-dashboard, company-scope.service, dismissable-dialog.directive, page-refresh.service) but the package never declared it — a phantom dependency that npm's hoisting masks and any isolated linker (pnpm) fails to resolve. Found by cadam11 in the strict-pnpm workspace spike (supersedes the surviving third of PR #26; its other two fixes were overtaken when the donor-line port removed AssociationDemoSeedData.ts and the relic apps/ tree).
- 7d8d115: Cross-app FK discipline, final piece (#22 item 1): JournalEntryBatch.ApprovalTaskID is now a REAL nullable FK to **mj_BizAppsTasks.Task — bizapps-tasks is a declared dependency that installs before this app, so the target always exists; the both-or-neither CHECK with ApprovalTaskRaisedAt is unchanged (D10 retryable task-raise semantics). rebuild-db.sh gains a bizapps-tasks step, applies bizapps-common via `mj migrate --schema **mj_BizAppsCommon`(its old sqlcmd loop mapped ${flyway:defaultSchema} to __mj AND swallowed SQL errors without`-b`, silently skipping common's V migrations — including the Person.DisplayName computed column that tasks' generated views join on), and defaults MJ core to v5.50.0. Baseline re-baked from zero (codegen tail regenerated; ApprovalTaskID's entity metadata now relates to MJ_BizApps_Tasks: Tasks).
- 87079db: Donor-line port onto the realigned baseline (2026-07-28 rulings). Data access moves to the four-surface doctrine: all three custom resolvers are deleted and the UI drives 7 typed Remote Operations (batch preview/build/build-from-view/cancel/regenerate, CreateJournalEntry, GenerateReversal) via RouteOperation. Batch build is ONE provider transaction — netting, summary JE, member locking, and the CFO approval-task raise (ApprovalTaskID stamped in-transaction; soft FK until CodeGen cross-app FKs land) commit or roll back together, with a pre-write assertCanRaise precondition and a never-persist-empty guard. JournalEntryBatch is a real encapsulated entity: transition-graph Validate, approval-coherence ValidateAsync (summary foots vs members at Pending→Approved), cached LoadMembers/LoadSummaryJournalEntry hydration, and a one-transaction Cancel() that returns member JEs to Pending. GLAccount identity (CompanyID/Code/AccountType/CurrencyCode) is locked unconditionally from creation; GLAccountLink gains a per-(record, role, company, window) tie guard and derives company through the account FK; ResolveLinkedAccount takes forCompanyID. Pipeline stage 5 rejects multi-company drafts with typed MULTI_COMPANY_DRAFT. TaxRemittance (remit-to-authority is an ERP concern) and JournalEntryLine.CounterpartyOrganizationID (handled at the orders biz-logic level) are REMOVED from the schema. Donor category-shell UI ported (transfer-pending workspace, shared components, RouteOperation clients). Test scaffolding no longer ships: CoreEntitiesServer excludes src/**tests** from its build (dist previously carried compiled test files) and pure engine-internal specs move to test-harnesses/.
- 22c66cf: New companies start with an EMPTY chart of accounts: the W1 auto-seed on AccountingCompanyProfile
  first-save is retired (auto-seeding collided with the immediate GL-account identity lock, forcing
  ten locked-identity accounts on every company). The starter chart remains available as the explicit,
  idempotent, audited `AccountingCompanyProfileEntityServer.SeedDefaultChartOfAccounts()`. UI line:
  All-journal-entries gains a "New journal entry" verb routed to the JE workspace; batch drill-downs
  no longer double-count by including the batch's own summary JE; company/account pickers dedupe by
  normalized UUID and self-heal stale caches (reactive scope roster, one-shot workspace re-check);
  GL editor shows human save errors instead of raw SQL; COA editor currency is a searchable
  code-or-name combobox; nav-rail hover-peek is off by default, the collapse toggle highlights only
  its own chip, and count badges no longer shift layout (row-edge pill expanded / icon-corner
  count collapsed).
- e91285e: Recapture the codegen baseline from a from-zero database, restoring the guarded `__mj.Application`
  producer and its three `ApplicationRole` grants that the 2026-08-06 recapture silently dropped
  (taken from a lived-in DB where the Application row had survived a drop-schema cycle) — clean
  deploys no longer fail on `FK_ApplicationEntity_Application`. Also: V202608062100 trimmed to the
  form-layout override only (MJ#3651 landed, so the recapture bakes the correct name field); the
  `metadata/schema-info` record removed (three writers fought over one row, causing the recurring
  sync checksum misalignment); and the `Accounting` app is now visible to new users by default
  instead of only the codegen bucket app. Regenerated entity/server/Angular packages included.
- f26d658: The JE workspace tags dimensions on the LINE rather than in a component `Map` keyed by line id. That Map was justified by a comment saying `JournalEntryLine` declares no `Dimensions` related collection — true when written, false since the collection landed, and a mirror kept alive by its own stale justification. Clearing an axis now removes the tag rather than setting it to null, because an axis with no value is an absent tag and the engine rejects the alternative.
- b014af6: The JE workspace composes a real `JournalEntryEntity` with its `Lines` collection instead of a hand-maintained `JEDraftState`/`JEDraftLine` mirror, so the screen and the ledger run the same `Validate()`. New shared `JournalEntryLineEntity` carries the per-line rules that need nothing but the line — an account, exactly one side, neither side negative — which were server-only and restated by hand in the editor. `JournalEntryEntityServer.Validate()` loses the three rules it duplicated from the shared subclass (every unbalanced entry was reporting itself twice) and gains the one that is genuinely its own: a blank line reaching a save is named by number rather than failing at a NOT NULL constraint. The double-entry line count now counts lines somebody actually typed in, so an untouched two-row draft can no longer satisfy it.
- 32d95f7: Journal Entries keep the generated form. A header, overview, lines, and reversal panel register as BaseFormPanel contributions — same pattern as People and Products — instead of a custom `*Extended` form class.
- 2889128: Round 4 of the JournalEntryBatch rename (Marcelo 2026-08-06) — the **visible chrome** now matches the entity. The top-nav category "Batches" becomes **"Journal Entry Batches"** (the app's `DefaultNavItems` Label, so it also renames the workspace tab and the category header), and the rail mirrors the Journal Entries category's own scheme: "All batches" → **"All journal entry batches"** (primary list spelled out), "Batch workspace" → **"JE batch workspace"**, "Batch approvals" → **"JE batch approvals"** (the "JE" abbreviation already established by "JE workspace"). Dashboard / Dispatch status are unchanged (no batch noun), as is page-internal prose — "this batch", the "New batch" verb, the `Batched` status value, and `BATCH-…` numbers all still name the action or the format, not the entity.

  **All accounts** moves onto the standard `mj-entity-data-grid` (matching All journal entries / All journal entry batches): the toolbar's search and filters now feed the grid's server-side predicate, clicking a row opens the inline editor, and the hand-rolled table — with its per-row Edit/Retire buttons — is retired (the editor's Active checkbox is the retire path; rollup structure remains on Chart of accounts).

  Three **grid bug fixes** found while validating that swap:

  - **Refresh did nothing when the filters hadn't changed.** The grid's `Params` setter deep-compares and skips refetching equal params, so rebuilding params after a save — or on a header Refresh click — was a silent no-op. All journal entries and All journal entry batches also carried a `RefreshToken` counter that nothing consumed, so their header Refresh never reached the grid either. All four grid pages (All accounts, All journal entries, All journal entry batches, Dispatch status) now hold a `@ViewChild` on the grid and call its `Refresh()` explicitly; the dead counters are gone.
  - **Row clicks on All accounts never opened the editor.** `AfterRowClick` emits a `CompositeKey` concatenated string (`ID|<uuid>`), not a bare ID; the handler compared it against raw IDs and always missed. It now parses through the shared `rowKeyToId` helper, as the other grid pages already did.
  - **The All accounts grid rendered at zero height.** Its wrapper carried card dressing but no sizing, and the grid's host is `height: 100%` — the same regression the All journal entries page documents. The wrapper now uses that page's proven height chain.

  Known cosmetic issue, filed upstream against MJ core, not fixable here: the Entries column on All journal entry batches renders a count as currency ("$1.00"). `mj-entity-data-grid` drops the host column's `type`/`format`/`formatter` and then force-formats any numeric field whose name contains "total" as currency. The column's config here is correct and left in place, so the display heals when MJ wires host formats through.

- 04ae8cf: Refactor (Amith ruling 2026-08-04): every bare `Batch`-prefixed identifier referring to the JournalEntryBatch entity is renamed to carry the full entity name. Columns: `JournalEntry.BatchID → JournalEntryBatchID`, `JournalEntryBatch.BatchNumber → JournalEntryBatchNumber`, `JournalEntryBatch.ExternalBatchRef → ExternalJournalEntryBatchRef`, `JournalEntryType.IsBatchSummary → IsJournalEntryBatchSummary`. Named off them: `spAssignNextBatchNumber → spAssignNextJournalEntryBatchNumber`, triggers `trg_JEBatch_* → trg_JournalEntryBatch_*`, constraints/indexes `FK_JE_Batch → FK_JE_JournalEntryBatch`, `FK_JEBatch_* → FK_JournalEntryBatch_*`, `CK_JournalEntry_BatchedHasBatch → …HasJournalEntryBatch`, `UX_JournalEntryType_BatchSummary → …_JournalEntryBatchSummary` — plus the full generated + hand-written code, harness, metadata, and ERD surface. Deliberately unchanged: the verb-form lifecycle columns `BatchedAt`/`BatchedByUserID`, the `Status` value `'Batched'` (they name the action, not the entity), the `BATCH-…` number format string, and user-facing DisplayNames ("Batch ID", "Batch Number" stay compact). Applied by editing the consolidated baseline in place (pre-prod, house convention) — clean deploys re-create the schema under the new names; existing instances re-apply via drop-schema + migrate.

  Round 2 (Marcelo rulings 2026-08-05): **DisplayNames** now carry the full name too ("Journal Entry Batch ID", "Journal Entry Batch Number", "External Journal Entry Batch Ref", "Is Journal Entry Batch Summary") — updated in the baseline seed and reflected in generated code. **Files/classes align:** `BatchingEngine.ts → JournalEntryBatchEngine.ts`, `BatchOperations.ts → JournalEntryBatchOperations.ts` (+ test file), and every exported bare-`Batch` identifier renamed (`BuildBatchOperation → BuildJournalEntryBatchOperation`, `BatchApprovalGate → JournalEntryBatchApprovalGate`, `BatchTargetSystem → JournalEntryBatchTargetSystem`, all Input/Output/Result/Options types, error classes, `LoadJournalEntryBatchOperations`). The remotable-op WIRE KEYS (`Accounting.BuildBatch` etc.) are deliberately unchanged pending an explicit ruling — they are a cross-app contract (bizapps-orders drives them). Angular FILE renames (`BatchDispatch/`, `batch-workspace.page.*`) deferred to the UI line to avoid rename-vs-delete conflicts with in-flight PRs #43/#44.

  Round 3 (Marcelo rulings 2026-08-05): **remotable-op wire keys renamed** — `Accounting.{Preview,Build,Regenerate,Dispatch}Batch → …JournalEntryBatch`, `Accounting.RecordBatchDecision → …RecordJournalEntryBatchDecision`, `Accounting.GetBatchApprovalState → …GetJournalEntryBatchApprovalState` — safe because bizapps-orders' current tip has ZERO references (verified; heads-up filed as bizapps-orders#37). **Angular files/classes renamed too:** `BatchDispatch/ → JournalEntryBatchDispatch/`, `BatchStatus/ → JournalEntryBatchStatus/`, `batch-workspace.page/client → journal-entry-batch-workspace.*`, `batches-dashboard.page → journal-entry-batches-dashboard.page` (+ the gui dom spec), with all 9 component/client/module classes, wire types, and tree-shake loaders carrying the full prefix. Kept: component selectors and `@RegisterClass` resource keys (metadata-bound), and `batches-category.*` (named for the visible "Batches" nav category, not the entity).

- 858eaaa: Open journal entries and batches as Explorer records instead of an in-shell workspace tab. New journal entry uses OpenNewEntityRecord; Build JE batch is the create verb for batches. Lists and the review queue emit RecordOpened and the category calls NavigationService.
- 518b952: List-page UI standard across the accounting shell. Adds shared `mja-summary-strip` (equal-width stat figures) and `mja-list-toolbar` (search + status preset chips + trailing Filters disclosure) components, and converts All Journal Entries, All Batches (new page, replacing the BatchStatus dashboard on that rail item), All Accounts, and Chart of Accounts to the standard page shape: one fused subheader band (stats + toolbar) over a rounded grid card, no title card. Adds a batch detail slide-in panel (identity, dispatch trail, totals, missing-task warning, member entries) and "Open in workspace" from both detail panels (JE workspace `FocusEntryID`, batch workspace `FocusBatchID`). Category headers gain an icon-only refresh and promote the primary create verb; the nav rail's collapse control is redesigned (double-angle chip, locked position across expand/collapse — no more hamburger).
- b0d708a: Restore and export DeferredRevenueWaterfallModule so orders Subscription / Subscription Term / Order Header can render the year-grouped rev-rec schedule instead of a stub table.
- dca6970: Schema realignment (issues #22 + #24, BA-D29/BA-D30): the closed JournalEntry.EntryType CHECK enum is replaced by the extensible JournalEntryType lookup (EntryTypeID FK; accounting seeds only its 8 IsSystem ledger-mechanics rows via metadata, consuming apps seed their own domain types; IsBatchSummary flag replaces the 'BatchSummary' magic string in triggers 50012/50023 and all batch queries; system rows are identity-locked at the entity layer). AccountingCompanyProfile.DefaultPaymentTermsTypeID is DROPPED — accounting never references its dependents, hard or soft (per-company default terms move to orders). The draft contract now carries the type CODE, validated against live reference data (ENTRY_TYPE_UNKNOWN / ENTRY_TYPE_INACTIVE). mj-app.json's mj-bizapps-common range is fixed to the published 5.x line (installer was hard-blocked). Baseline edited in place and re-proven from zero; ERD/ARCHITECTURE refreshed; stale plans/handoff-next-steps.md removed.
- 0458a71: Tax model rework (PR #28): CustomerTaxProfile is DROPPED — it asked "is this CUSTOMER exempt", a customer-shaped concern that now lives in bizapps-orders as CustomerTaxExemption (accounting is the general JE/ERP engine; customer attributes start at the orders layer). CompanyTaxNexus replaces it with the opposite, accounting-shaped question: where OUR legal entity must collect — NexusType (Economic/Physical/Marketplace/Voluntary), RegisteredFrom/RegisteredTo separate from ObligationEndsAt (the duty to collect routinely outlasts the registration activity), FK to \_\_mj.Company. TaxRate.Rate widens DECIMAL(7,4) → DECIMAL(9,6): four decimal places cannot store real US rates (San Mateo 9.375%, California's 0.125% district increments), and orders' OrderCharge.Rate was already DECIMAL(9,6) so orders could record a rate accounting could not hold. CK_TaxRate_Source is dropped so a new rate source (e.g. the Streamlined Sales Tax state files) is data, not a schema migration. Baseline edited in place per the pre-1.0 convention and re-proven from zero.
- 3c54a0c: UI wave (Marcelo rulings 2026-08-05), on top of the list-page standard: **JE detail panel** has ONE open action — "Open in workspace" ("Open full" removed; the workspace is the entry's full-depth home). **Every native `<select>` (34 across 11 files) replaced with MJ controls** — `mj-dropdown` for single-selects and the new shared `mja-check-dropdown` CHECKBOX multi-select for the company filters on All journal entries, All batches, All accounts, Chart of accounts, and the batch-status dashboard (empty = "All companies"; predicates become `IN (…)`); the batch-workspace company stays single-select on purpose (a build criterion under single-company batches). **Refresh**: all inline refresh buttons removed; all five category headers carry the orders-style icon-only outline refresh, and dashboards reach it through the shared per-shell refresh channel (optional injection). **Create verbs**: hoisted to the category header, which now shows the ACTIVE page's verb (New account / New dimension / New company); the dashboards' redundant header-cards are gone. **Dimensions page**: status filter, New-dimension header verb, and per-row details opening the record's real form in the standardized MJ slide-in (`openBizCreate` added to the shared helper). Slide-in audit: the app was already fully on `mj-slide-panel`/`MJFormPresenterService` — nothing swapped.
- 77b79d0: Initial BizApps Accounting build — AR subledger + journal-entry primitives (Blocks 0–6):GL accounts, AccountingCompanyProfile (IsA child of Company), accounting periods, balanced/immutableJEs, dimensions, tax, scheduled/recurring JEs, ChartOfAccountsMapping, and read-model views; batchingengine with the bizapps-tasks CFO approval gate. Clean-deploy hardening: IS-A Entity.ParentID is nowserialized into the migration (GAP-1), numbering-sproc EXECUTE grants added (GAP-2), and codegen scopedto the accounting schema (excludes bizapps-tasks/common). Validated end-to-end on a migrations-onlyclean deploy (full harness green).
- Updated dependencies [7e00cbd]
- Updated dependencies [4ecb890]
- Updated dependencies [7d8d115]
- Updated dependencies [87079db]
- Updated dependencies [84b0629]
- Updated dependencies [808f172]
- Updated dependencies [e91285e]
- Updated dependencies [b014af6]
- Updated dependencies [04ae8cf]
- Updated dependencies [d098f63]
- Updated dependencies [06eed73]
- Updated dependencies [6ab6f78]
- Updated dependencies [dca6970]
- Updated dependencies [0458a71]
- Updated dependencies [77b79d0]
  - @mj-biz-apps/accounting-entities@0.1.1
  - @mj-biz-apps/accounting-engine-base@0.1.1
