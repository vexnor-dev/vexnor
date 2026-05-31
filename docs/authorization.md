# Authorization & Audit Logging

`QueryRegistry` provides two enterprise hooks: authorization (pre-execution, can deny) and audit logging (post-execution, observational).

## Registering Queries

Pass queries as a named object — the key becomes the query name in audit logs:

```typescript
import * as accountQueries from './queries/accounts.js';
import * as orderQueries from './queries/orders.js';

// Pass a module namespace directly — all SqlQuery exports are registered,
// non-query exports are skipped with a console.warn
await queryRegistry.register(vexnorPostgres, accountQueries);
await queryRegistry.register(vexnorPostgres, orderQueries);

// Or pass an explicit object
await queryRegistry.register(vexnorPostgres, { findAccounts, deleteAccount });
```

## Query Authorization

Tag a query with `.authorize(tag)` to require an authorization check before it executes:

```typescript
const deleteAccount = sql`
  DELETE FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
`.authorize('admin');

const findAccounts = sql`
  SELECT ${row(Account.$$)} FROM ${Account}
`.authorize('read:accounts');
```

The tag is an arbitrary string — use whatever convention fits your app (`'admin'`, `'read:orders'`, `'superuser'`, etc.).

`.authorize()` returns a new query object with the tag set. The original query is not mutated.

### Registering an Authorization Hook

Register a hook on the `QueryRegistry` that runs before any tagged query executes. Throw to deny:

```typescript
import { queryRegistry } from './registry.js';

queryRegistry.registerAuthorization(({ query, plugin, params }) => {
  const user = getCurrentUser(); // your own context — AsyncLocalStorage, request scope, etc.

  if (!user.roles.includes(query.authorization!)) {
    throw new Error(`Forbidden: requires role '${query.authorization}'`);
  }
});
```

Multiple hooks can be registered — they run sequentially. If any hook throws, execution is denied and subsequent hooks are not called:

```typescript
// RBAC check
queryRegistry.registerAuthorization(({ query }) => {
  if (!user.roles.includes(query.authorization!)) throw new Error('Forbidden');
});

// Rate limiting
queryRegistry.registerAuthorization(({ query, params }) => {
  if (rateLimiter.isExceeded(user.id)) throw new Error('Rate limit exceeded');
});
```

### Startup Validation

Call `checkAuthorization()` at startup to fail fast if any tagged query has no hook registered:

```typescript
await queryRegistry.register(plugin, { deleteAccount, findAccounts });

queryRegistry.registerAuthorization(myAuthHook);

// throws if any .authorize() query has no hook
queryRegistry.checkAuthorization();
```

### Inspecting Authorization Coverage

```typescript
// all queries with an .authorize() tag
queryRegistry.getAuthorizedQueries();

// all queries without an .authorize() tag — useful for security audits
queryRegistry.getUnauthorizedQueries();

// all registered queries
queryRegistry.getQueries();
```

Enforce a policy at startup where every query must be tagged:

```typescript
const unprotected = queryRegistry.getUnauthorizedQueries();
if (unprotected.length > 0) {
  throw new Error(`Unprotected queries: ${unprotected.map(q => q.label).join(', ')}`);
}
```

## Audit Logging

Register an audit log listener to observe every query execution — success, failure, or authorization denial. Uses the browser-compatible `EventTarget` API.

```typescript
queryRegistry.registerAuditLog((event) => {
  const { query, name, plugin, params, durationMs, error, location } = event.args;

  if (error) {
    logger.error({ name, query: query.label, plugin: plugin.name, durationMs, location, err: error }, 'query failed');
  } else {
    logger.info({ name, query: query.label, plugin: plugin.name, durationMs, location }, 'query executed');
  }
});
```

The listener receives an `AuditLogEvent` with the following `args`:

| Field | Type | Description |
|-------|------|-------------|
| `query` | `SqlQueryAny` | The query that was executed |
| `name` | `string \| null` | The name the query was registered under (the object key passed to `register()`) |
| `plugin` | `VexnorPluginAny` | The plugin (database driver) used |
| `params` | `Record<string, unknown>` | The runtime params passed to the query |
| `durationMs` | `number` | Execution duration in milliseconds |
| `error` | `unknown \| null` | The error if execution failed, `null` on success |
| `location` | `string \| null` | File and line where the query was defined |

Multiple listeners can be registered — they all receive every event independently.

### With Pino

```typescript
import pino from 'pino';

const log = pino({ name: 'vexnor' });

queryRegistry.registerAuditLog((event) => {
  const { query, name, plugin, durationMs, error, location } = event.args;
  const meta = { name, query: query.label, plugin: plugin.name, durationMs, location };

  if (error) {
    log.error({ ...meta, err: error }, 'query failed');
  } else {
    log.info(meta, 'query executed');
  }
});
```

Example output:

```json
{"level":30,"name":"vexnor","name":"findAccounts","query":"findAccounts","plugin":"vexnor-postgres","durationMs":3.2,"location":"file:///app/src/queries/accounts.ts:12:24","msg":"query executed"}
{"level":50,"name":"vexnor","name":"deleteAccount","query":"deleteAccount","plugin":"vexnor-postgres","durationMs":1.1,"location":"file:///app/src/queries/accounts.ts:18:3","err":{},"msg":"query failed"}
```

### SOC2 / HIPAA Notes

- The audit log fires on **every** execution — success, failure, and authorization denial. Denied attempts are logged with the error.
- `params` are included in `event.args` but **not** logged by default in the examples above. If your params contain PII or PHI, omit them from your log output or scrub them before logging.
- `location` identifies where in your codebase the query was defined — useful for tracing which code path triggered a sensitive operation.
- For HIPAA compliance, ensure your log destination (CloudWatch, Datadog, etc.) has appropriate access controls and retention policies.
