/**
 * BizApps Accounting Server Bootstrap
 *
 * Server-side bootstrap package for the BizApps Accounting Open App.
 * Ensures all entity subclasses, action subclasses, and GraphQL resolvers
 * are registered with the MJ class factory.
 */

// Import entity and action packages to trigger @RegisterClass decorators
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-actions';

// Server-side entity subclasses — must come after accounting-entities so
// @RegisterClass auto-increment gives these higher priority
import '@mj-biz-apps/accounting-core-entities-server';

// Import generated GraphQL resolvers
import './generated/generated.js';

// Import custom (hand-written) GraphQL resolvers so their @Resolver decorators fire.
// These also need to be in RESOLVER_PATHS (below) so TypeGraphQL builds them into the schema.
import './resolvers/BatchDispatchResolver.js';
import './resolvers/ReadModelsResolver.js';
import './resolvers/JournalEntryResolver.js';

// Import generated class registrations manifest
import { CLASS_REGISTRATIONS } from './generated/class-registrations-manifest.js';

// Re-export the manifest for consumers
export { CLASS_REGISTRATIONS } from './generated/class-registrations-manifest.js';

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Absolute paths to the resolver files (generated + custom), for use with createMJServer().
 * NOTE the `*Resolver.{js,ts}` suffix (not `*.{js,ts}`): brace-expansion of `*.{js,ts}` would
 * also match the emitted `*.d.ts` declaration files (the `*` absorbs the `.d`), which ts-node
 * then fails to require. Requiring the literal `Resolver.js`/`Resolver.ts` ending excludes `.d.ts`.
 */
export const RESOLVER_PATHS = [
    resolve(__dirname, 'generated/generated.{js,ts}'),
    resolve(__dirname, 'resolvers/*Resolver.{js,ts}'),
];

/**
 * Bootstrap function called by DynamicPackageLoader during MJAPI startup.
 * The static imports above handle all registration; this function ensures
 * the module is fully evaluated.
 */
export function LoadBizAppsAccountingServer(): void {
    // Static imports above ensure all classes are registered.
    // This function exists as the startupExport entry point for DynamicPackageLoader.
}
