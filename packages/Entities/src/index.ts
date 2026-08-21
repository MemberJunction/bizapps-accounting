export * from './generated/entity_subclasses'

/**
 * This function is used to force the generated entities to be loaded. This is necessary because of the way that tree shaking works in webpack.
 * If you don't import this function and execute it, then the generated entities will not be included in the build. This is because the entities are not directly
 * referenced in this file, so webpack doesn't know that they are needed. By importing this function and calling it, webpack will include the generated entities
 * in the build.
 * 
 * @export
 * @returns {void}
 * @example
 * import { LoadGeneratedEntities } from 'mj_core'
 * LoadGeneratedEntities()
 */
export function LoadGeneratedEntities() {
} 

/**
 * `JournalEntryEntity` — the shared (client + server) journal-entry subclass carrying the
 * double-entry invariants: at least two lines, and debits equal to credits at penny precision.
 * `JournalEntryEntityServer` extends it and adds everything that needs the database, so the rules
 * run in the browser before a round trip AND on the server for every other caller.
 */
export * from './JournalEntryEntity';

/**
 * `JournalEntryLineEntity` — the shared (client + server) line subclass carrying the per-line
 * rules: an account is required, exactly one side carries an amount, neither side is negative.
 * `JournalEntryLineEntityServer` extends it and adds the rules that need reference data.
 */
export * from './JournalEntryLineEntity';
