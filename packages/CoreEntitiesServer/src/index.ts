/**
 * @mj-biz-apps/accounting-core-entities-server
 *
 * Server-side entity subclasses for BizApps Accounting entities.
 * These classes override Save() and Delete() to add lifecycle hooks
 * (JE numbering, balance materialization, period-close validation, etc.)
 * that only run on the server.
 *
 * Import this package from your server bootstrap to ensure @RegisterClass
 * decorators fire at startup.
 *
 * No subclasses yet — Phase A scaffolding only. Add a class here when you
 * need server-only behavior (e.g. JournalEntryEntityServer to assign the
 * gap-free JE number on Save).
 */
export {};
