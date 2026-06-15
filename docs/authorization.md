# Authorization & Audit Logging

`SqlQueryRegistry` provides two enterprise hooks: authorization (pre-execution, can deny) and audit logging (post-execution, observational).

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

---

## Query Authorization

Tag a query with `.authorize(...tags)` to require an authorization check before it executes:

```typescript
const deleteAccount = sql`
  DELETE FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
`.authorize('admin');

const findAccounts = sql`
  SELECT ${row(Account.$$)} FROM ${Account}
`.authorize('read:accounts');

// Multiple tags at once
const sensitiveReport = sql`...`.authorize('admin', 'audit');
```

Tags are arbitrary strings — use whatever convention fits your app (`'admin'`, `'read:orders'`, `'superuser'`, etc.).

`.authorize()` returns a new query object with the tags added. The original query is not mutated. Tags accumulate across chained calls and are inherited from subqueries.

### Registering an Authorization Hook

Register a hook on the `SqlQueryRegistry` that runs before any tagged query executes. Throw to deny:

```typescript
import { queryRegistry } from './registry.js';

queryRegistry.registerAuthorization(({ query, plugin, params, context }) => {
  for (const tag of query.authorization) {
    if (!context.roles.includes(tag)) {
      throw new Error(`Forbidden: requires role '${tag}'`);
    }
  }
});
```

The hook receives:

| Field | Type | Description |
|-------|------|-------------|
| `query` | `SqlQueryAny` | The query being executed |
| `plugin` | `SqlQueryExecutionPluginRef` | Plugin (driver) identity |
| `name` | `string` | The registered name of the query |
| `params` | `Record<string, unknown>` | Merged params including runtime context |
| `context` | `TContext` | The pipeline context passed to `execute()` |

### Multiple Hooks

Multiple hooks can be registered — they run sequentially. If any hook throws, execution is denied and subsequent hooks are not called:

```typescript
// RBAC check
queryRegistry.registerAuthorization(({ query, context }) => {
  if (!query.authorization.every(tag => context.roles.includes(tag))) throw new Error('Forbidden');
});

// Rate limiting
queryRegistry.registerAuthorization(({ query, context }) => {
  if (rateLimiter.isExceeded(context.userId)) throw new Error('Rate limit exceeded');
});
```

### Using with `connect()`

Authorization also works with direct connections wrapped via `connect()`:

```typescript
import { connect } from 'vexnor';
import { SqlQueryPipeline } from 'vexnor/execution';

type AppContext = { userId: string; roles: string[] };

const pipeline = new SqlQueryPipeline<{ Context: AppContext }>();
pipeline.registerAuthorization(({ query, context }) => {
  if (!query.authorization.every(tag => context.roles.includes(tag))) throw new Error('Forbidden');
});

const db = connect<AppContext>(pool, { pipeline });

// Context is inferred from params that use ctx()
await deleteAccount.postgres.run({
  db,
  params: { accountId: '...', userId: 'u-1', roles: ['admin'] },
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

The error thrown is a `SqlError` with code `REGISTRY_NOT_AUTHORIZED`.

### Inspecting Authorization Coverage

```typescript
// all queries with an .authorize() tag
queryRegistry.getAuthorizedQueries();

// all queries without an .authorize() tag — useful for security audits
queryRegistry.getUnauthorizedQueries();

// all registered queries
queryRegistry.getQueries();

// all registered queries with metadata
queryRegistry.getRegisteredQueries();
// returns: { plugin: string; hash: string; name: string; location: string | null; hashId: string }[]
```

Enforce a policy at startup where every query must be tagged:

```typescript
const unprotected = queryRegistry.getUnauthorizedQueries();
if (unprotected.length > 0) {
  throw new Error(`Unprotected queries: ${unprotected.map(q => q.label).join(', ')}`);
}
```

---

## Denied Query Errors

When a query is denied, vexnor throws a `SqlRunError` with:

- `code`: `QUERY_NOT_AUTHORIZED`
- `queryName`: the registered name of the query
- `cause`: the original error thrown by the hook

```typescript
import { SqlRunError, SqlErrorCode } from 'vexnor/execution';

try {
  await deleteAccount.postgres.run({ db, params });
} catch (err) {
  if (err instanceof SqlRunError && err.code === SqlErrorCode.QUERY_NOT_AUTHORIZED) {
    // respond with 403
  }
}
```

---

## Audit Logging

Attach an `AuditLogPlugin` to observe every query execution — success, failure, or authorization denial.

```typescript
import { AuditLogPlugin } from 'vexnor/execution';

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

### `AuditLogPluginOptions`

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Plugin instance name (default: `"AuditLogPlugin"`) |
| `contextLogResolver` | `(context) => Record<string, unknown>` | Opt-in projection of context into the log |
| `onLog` | `(args) => void` | Callback fired after every query execution |

### `onLog` Arguments

The `onLog` callback receives the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `query` | `SqlQueryAny` | The query that was executed |
| `name` | `string` | The name the query was registered under |
| `plugin` | `SqlQueryExecutionPluginRef` | The plugin (database driver) used |
| `mode` | `"read" \| "write"` | Execution mode |
| `params` | `Record<string, unknown>` | The merged params passed to the query |
| `durationMs` | `number` | Execution duration in milliseconds |
| `error` | `unknown \| null` | The error if execution failed, `null` on success |
| `context` | `TContext` | The projected context from `contextLogResolver`, or raw context if not configured |
| `remote` | `{ plugin, hash, params, location, mode, name } \| null` | The raw remote request, if applicable |

Multiple plugins can be attached — they all receive every event independently.

### With Pino

```typescript
import pino from 'pino';
import { AuditLogPlugin } from 'vexnor/execution';

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
{"level":30,"name":"vexnor","name":"findAccounts","plugin":"@vexnor/postgres","durationMs":3.2,"userId":"u-123","msg":"query executed"}
{"level":50,"name":"vexnor","name":"deleteAccount","plugin":"@vexnor/postgres","durationMs":1.1,"userId":"u-123","err":{},"msg":"query failed"}
```

---

## Rate Limiting with `TimeToLiveRateLimiter`

Built-in per-query and per-context concurrency limiting:

```typescript
import { TimeToLiveRateLimiter } from 'vexnor/execution';

queryRegistry.use(new TimeToLiveRateLimiter<AppContext>({
  contextKeyResolver: (ctx) => ctx.userId,
  maxConcurrent: 50,            // max concurrent executions per query
  maxConcurrentPerContext: 5,   // max concurrent per user per query
  contextMetricsTtlMs: 5 * 60 * 1000, // evict idle context metrics after 5min
}));
```

### Custom Limit Hook

For advanced rate limiting logic beyond simple concurrency caps:

```typescript
queryRegistry.use(new TimeToLiveRateLimiter<AppContext>({
  contextKeyResolver: (ctx) => ctx.userId,
  limit: ({ queryMetrics, contextMetrics }) => {
    if (contextMetrics && contextMetrics.totalErrors > 10) {
      throw new Error('Too many errors — slow down');
    }
  },
}));
```

### Metrics Access

```typescript
const limiter = new TimeToLiveRateLimiter<AppContext>({ ... });
queryRegistry.use(limiter);

// Per-query metrics (keyed by query ID)
limiter.metrics; // ReadonlyMap<string, QueryMetrics>

// Per-query per-context metrics
limiter.contextMetrics; // ReadonlyMap<string, ReadonlyMap<string, ContextMetrics>>

// Manual cleanup on logout
limiter.clearContextMetrics('user-123');
```

---

## SOC2 / HIPAA Notes

- The audit log fires on **every** execution — success, failure, and authorization denial. Denied attempts are logged with the error.
- `params` are included in `onLog` args but **not** logged by default in the examples above. If your params contain PII or PHI, omit them from your log output or scrub them before logging.
- `contextLogResolver` is opt-in — raw context is never forwarded to `onLog`. Only what you explicitly return from the resolver is included.
- `input.location` identifies where in your codebase the query was defined — useful for tracing which code path triggered a sensitive operation.
- For HIPAA compliance, ensure your log destination (CloudWatch, Datadog, etc.) has appropriate access controls and retention policies.

---

## Cross-Reference

- [Registry](registry.md) — `SqlQueryRegistry`, `SqlQueryPipeline`, `connect()`, full plugin API
- [Telemetry](telemetry.md) — OpenTelemetry integration, spans alongside audit logs
