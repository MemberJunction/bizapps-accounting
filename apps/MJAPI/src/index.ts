/**
 * MemberJunction API Server (MJ 3.0 Minimal Architecture)
 * All initialization logic is in @memberjunction/server-bootstrap
 */
import { createMJServer } from '@memberjunction/server-bootstrap';

// Import BizApps Common first so Currency / CurrencyExchangeRate / Organization
// classes are registered before any Accounting class references them.
import { RESOLVER_PATHS as COMMON_RESOLVER_PATHS } from '@mj-biz-apps/common-server';

// Import the BizApps Accounting server bootstrap (registers entities, actions, and resolvers)
import { RESOLVER_PATHS as ACCOUNTING_RESOLVER_PATHS } from '@mj-biz-apps/accounting-server';

const RESOLVER_PATHS = [...COMMON_RESOLVER_PATHS, ...ACCOUNTING_RESOLVER_PATHS];

// Import pre-built MJ class registrations manifest (covers all @memberjunction/* packages)
import '@memberjunction/server-bootstrap/mj-class-registrations';

// Optional: Import communication providers if needed
// import '@memberjunction/communication-sendgrid';
// import '@memberjunction/communication-teams';

// Optional: Import custom auth/user creation logic
// See: /docs/examples/custom-user-creation/README.md
// import './custom/customUserCreation';

// Start the server
createMJServer({ resolverPaths: RESOLVER_PATHS }).catch(console.error);
