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

Attach an `AuditLogPlugin` to observe every query execution — success, failure, or authorization denial.

```typescript
import { AuditLogPlugin } from 'vexnor/registry';

queryRegistry.use(new AuditLogPlugin({
  contextLogResolver: ({ userId }) => ({ userId }), // opt-in — never logs raw context
  onLog: ({ query, name, plugin, params, durationMs, error, context }) => {
    if (error) {
      logger.error({ name, query: query.label, plugin: plugin.name, durationMs, err: error, ...context }, 'query failed');
    } else {
      logger.info({ name, query: query.label, plugin: plugin.name, durationMs, ...context }, 'query executed');
    }
  },
}));
```

The `onLog` callback receives the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `query` | `SqlQueryAny` | The query that was executed |
| `name` | `string` | The name the query was registered under (the object key passed to `register()`) |
| `plugin` | `VexnorPluginAny` | The plugin (database driver) used |
| `params` | `Record<string, unknown>` | The merged params passed to the query (runtime params included) |
| `durationMs` | `number` | Execution duration in milliseconds |
| `error` | `unknown \| null` | The error if execution failed, `null` on success |
| `context` | `Record<string, unknown> \| null` | The trimmed context from `contextLogResolver`, or `null` if not configured |
| `input` | `ExecuteQueryArgs` | The raw request: `{ plugin, hash, params, location, mode }` |

Multiple plugins can be attached — they all receive every event independently.

### With Pino

```typescript
import pino from 'pino';
import { AuditLogPlugin } from 'vexnor/registry';

const log = pino({ name: 'vexnor' });

queryRegistry.use(new AuditLogPlugin({
  contextLogResolver: ({ userId }) => ({ userId }),
  onLog: ({ name, plugin, durationMs, error, context }) => {
    const meta = { name, plugin: plugin.name, durationMs, ...context };
    if (error) {
      log.error({ ...meta, err: error }, 'query failed');
    } else {
      log.info(meta, 'query executed');
    }
  },
}));
```

Example output:

```json
{"level":30,"name":"vexnor","name":"findAccounts","plugin":"vexnor-postgres","durationMs":3.2,"userId":"u-123","msg":"query executed"}
{"level":50,"name":"vexnor","name":"deleteAccount","plugin":"vexnor-postgres","durationMs":1.1,"userId":"u-123","err":{},"msg":"query failed"}
```

### SOC2 / HIPAA Notes

- The audit log fires on **every** execution — success, failure, and authorization denial. Denied attempts are logged with the error.
- `params` are included in `onLog` args but **not** logged by default in the examples above. If your params contain PII or PHI, omit them from your log output or scrub them before logging.
- `contextLogResolver` is opt-in — raw context is never forwarded to `onLog`. Only what you explicitly return from the resolver is included.
- `input.location` identifies where in your codebase the query was defined — useful for tracing which code path triggered a sensitive operation.
- For HIPAA compliance, ensure your log destination (CloudWatch, Datadog, etc.) has appropriate access controls and retention policies.
