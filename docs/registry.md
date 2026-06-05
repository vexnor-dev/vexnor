# Query Registry & Isomorphic SQL

For a conceptual overview of the isomorphic pattern and how it compares to REST, tRPC, and GraphQL, see [Isomorphic SQL](isomorphic-sql.md).

Vexnor queries are plain objects — they carry their SQL template, type information, and a stable hash. This makes them portable: the same query defined once can execute directly on the server, or be dispatched from the client to the server over HTTP without any additional API layer.

## The Isomorphic Pattern

The core idea: define queries in a shared module, register them on the server, execute them from anywhere.

```
shared/queries.ts        ← query definitions (shared between client and server)
server/registry.ts       ← registers queries, owns DB connections
client/remote-client.ts  ← sends query hash + params to the server over HTTP
```

The client never sends SQL. It sends a hash that identifies a pre-registered query, plus the runtime params. The server looks up the query by hash, runs it against the database, and returns the result. The result type is inferred on the client from the same query object.

## Setup

### 1. Define queries in a shared module

```typescript
// shared/queries/accounts.ts
import 'vexnor-postgres';
import { sql, row, param } from 'vexnor';
import { Account } from '../codegen/postgres/account-table.js';

export const selectAccounts = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  ORDER BY ${Account.$createdAt} DESC
`;

export const deleteAccount = Account.postgres.delete({
  WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>('accountId')}`,
});

export const insertAccount = Account.postgres.insertRows();
```

### 2. Register queries on the server

```typescript
// server/registry.ts
import { QueryRegistry } from 'vexnor/registry';
import * as accountQueries from '../shared/queries/accounts.js';
import vexnorPostgres from 'vexnor-postgres';
import { Pool } from 'pg';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const registry = new QueryRegistry();

await registry.register(vexnorPostgres, accountQueries);
```

Passing the module namespace directly registers all `SqlQuery` exports under their variable names. Non-query exports are skipped with a warning.

### 3. Expose an HTTP endpoint

```typescript
// server/app.ts
import { SqlError, SqlRunError } from 'vexnor/registry';
import { registry, pool } from './registry.js';

app.post('/api/db', async (c) => {
  const args = await c.req.json();
  const token = c.req.header('Authorization')?.replace('Bearer ', '') ?? null;

  try {
    const result = await registry.execute(
      args,
      async ({ plugin }) => getPool(plugin),
      { token },
    );
    return c.json(result);
  } catch (err) {
    return handleDbError(c, err, args);
  }
});
```

`registry.execute` looks up the query by hash, runs authorization and rate-limit checks, **injects any `runtime()` params from the context object**, executes against the database, and fires the audit log. The fifth argument is the runtime context — values are automatically merged into query params for any `runtime()` nodes declared on the query. See [Runtime Params](params.md#runtime-params-with-runtime) and [Authorization](authorization.md).

#### Error handling

Map `SqlErrorCode` values to HTTP status codes so clients can handle errors programmatically:

```typescript
import { SqlError, SqlRunError } from 'vexnor/registry';

const SQL_ERROR_STATUS: Record<string, number> = {
  QUERY_NOT_FOUND: 400,
  QUERY_BUILD_FAILED: 400,
  PARAM_VALIDATION_FAILED: 400,
  QUERY_NOT_AUTHORIZED: 403,
  REGISTRY_NOT_AUTHORIZED: 403,
  QUERY_RATE_LIMITED: 429,
  QUERY_EXECUTION_FAILED: 500,
  QUERY_RETRYABLE_FAILURE: 503,
  QUERY_TIMEOUT: 504,
};

function handleDbError(c: Context, err: unknown, meta?: { name?: string | null; location?: string | null }) {
  if (err instanceof SqlRunError || err instanceof SqlError) {
    const status = SQL_ERROR_STATUS[err.code] ?? 500;
    return c.json({ error: err.message, code: err.code, ...meta }, status);
  }
  return c.json({ error: String(err) }, 500);
}
```

`SqlRunError` carries `code`, `retryable`, `queryName`, and `queryLocation` — all available for logging or client-side retry logic.

### 4. Create a remote client

For anonymous (unauthenticated) use, construct an `HttpRemoteClient` with the endpoint URL:

```typescript
// client/remote-client.ts
import { HttpRemoteClient } from 'vexnor';

export const remoteClient = new HttpRemoteClient({ targetUrl: '/api/db' });
```

For authenticated use, provide a `headerResolver` that reads the token from your auth context. Use `useMemo` so the client reference only changes when the token changes:

```typescript
// client/use-remote-client.ts
import { useMemo } from 'react';
import { HttpRemoteClient } from 'vexnor';
import { useAuth } from './auth-context.js';

export function useRemoteClient() {
  const { token } = useAuth();

  return useMemo(
    () => new HttpRemoteClient({
      targetUrl: '/api/db',
      headerResolver: async () => ({
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }),
    }),
    [token],
  );
}
```

`HttpRemoteClient` handles `Content-Type`, JSON serialization, and response parsing. You can also pass static `headers`, or a custom `fetch` implementation for testing.

### 5. Execute from the client

```typescript
// client/pages/accounts.tsx
import { selectAccounts, deleteAccount, insertAccount } from '../../shared/queries/accounts.js';
import { remoteClient } from '../remote-client.js';

// Same query object, same API — just pass remoteClient instead of a DB pool
const accounts = await selectAccounts.postgres.all({ db: remoteClient });
// accounts: IAccountSelect[]

await deleteAccount.postgres.run({ db: remoteClient, params: { accountId: '123' } });
```

The result type is inferred from the query definition — no separate API types, no code generation for the HTTP layer.

## Next.js App Router

In a Next.js app, all three execution modes share the same query objects from `shared/queries/`:

**React Server Components** — fetch directly from the database, no API call:

```typescript
// app/postgres/accounts/page.tsx
import { pgPool } from '@/shared/db/postgres';
import { selectAccounts, insertAccount } from '@/shared/queries/postgres';

async function createAccountAction(email: string, firstName: string, lastName: string) {
  'use server';
  await insertAccount.postgres.run({
    db: pgPool,
    params: { rows: [{ email, firstName, lastName }] },
  });
}

export default async function AccountsPage({ searchParams }) {
  const params = getSelectAccountParams({ searchParams: await searchParams });
  const accounts = await selectAccounts.postgres.all({ db: pgPool, params });
  // render directly — no loading state, no useEffect
  return <AccountsGrid initialAccounts={accounts} initialParams={params} />;
}
```

**Client components** — use `useRemoteClient()` to dispatch to `/api/db` for interactive refetches:

```typescript
// app/components/accounts-grid.tsx
'use client';
import { useRemoteClient } from '@/app/components/use-remote-client';
import { selectAccounts } from '@/shared/queries/postgres';

export function AccountsGrid({ initialAccounts, initialParams }) {
  const remoteClient = useRemoteClient();

  async function refetch(params) {
    const accounts = await selectAccounts.postgres.all({ db: remoteClient, params });
    setAccounts(accounts);
  }
  // ...
}
```

**The `/api/db` route** — same `QueryRegistry` endpoint as the Hono example:

```typescript
// app/api/db/route.ts
import { SqlError, SqlRunError } from 'vexnor/registry';

export async function POST(request: Request) {
  const args = await request.json();
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') ?? null;

  try {
    const result = await registry.execute(
      args,
      async ({ plugin }) => getPool(plugin),
      { token },
    );
    return Response.json(result);
  } catch (err) {
    if (err instanceof SqlRunError || err instanceof SqlError) {
      const status = SQL_ERROR_STATUS[err.code] ?? 500;
      return Response.json({ error: err.message, code: err.code, name, location }, { status });
    }
    throw err;
  }
}
```

## How It Works

When `.postgres.all({ db: remoteClient })` is called:

1. Vexnor detects that `db` is a `RemoteClient` (not a real connection pool)
2. It calls `remoteClient.remoteExecute({ plugin: 'vexnor-postgres', hash, params, name, location })`
3. The server receives the request, looks up the query by hash in the registry
4. The query executes against the real DB connection on the server
5. The result is serialized and returned
6. Vexnor deserializes the result on the client (handling `Date` strings, nested JSON, etc.)

The hash is a stable SHA-256 of the query's template strings — it never changes unless the SQL itself changes. `name` and `location` are forwarded for error messages and audit logs.

## QueryRegistry API

```typescript
const registry = new QueryRegistry();
// With options:
const registry = new QueryRegistry({ maxConcurrent: 50 });
// With typed runtime context (for runtime() params and authorization hooks):
type AppRuntime = { userId: string; tenantId: string };
const registry = new QueryRegistry<AppRuntime>();

// Register queries — pass a module namespace or explicit object
await registry.register(plugin, queries);

// Startup validation — throws if any .authorize()-tagged query has no hook registered
registry.checkAuthorization();

// Hooks
registry.registerAuthorization(hook);  // called before every .authorize()-tagged query
registry.use(plugin);                  // attach a QueryExecutionPlugin (audit log, rate limit, telemetry)
registry.registerOpenTelemetry(tracer); // built-in OpenTelemetry plugin; see Telemetry docs

// Introspection
registry.getQueries();              // all registered queries
registry.getAuthorizedQueries();    // queries with .authorize() tag
registry.getUnauthorizedQueries();  // queries without .authorize() tag

// Execute a query by passing the full request args object
// Second arg is the connection resolver — receives the full ExecuteQueryArgs
// Third arg is the runtime context — runtime() params are injected from it automatically
await registry.execute(args, connectionResolver, runtimeContext?);
```

### Constructor Options

- `maxConcurrent?: number` — maximum number of queries that may execute concurrently across all query types. Queries exceeding this limit are rejected immediately with `QUERY_RATE_LIMITED`.

### `use(plugin)`

Attaches a `QueryExecutionPlugin` to the registry. Returns an unsubscribe function.

- `check()` — async gate called before every query executes. Throw to reject.
- `before()` — called after checks pass, before the query runs (fire-and-forget).
- `after()` — called after every query completes, success or failure (fire-and-forget).
- `onError()` — called when `before()` or `after()` throws.

Multiple plugins accumulate and all run on every execution.

The built-in `TimeToLiveRateLimiter` covers the most common rate-limiting cases:

```typescript
import { TimeToLiveRateLimiter } from 'vexnor/registry';

const limiter = new TimeToLiveRateLimiter({
  contextKeyResolver: (ctx) => ctx.userId,   // enables per-user metrics
  maxConcurrent: 20,                          // per-query concurrency cap
  maxConcurrentPerContext: 3,                 // per-user concurrency cap
  contextMetricsTtlMs: 5 * 60 * 1000,        // evict idle users after 5min (default)
  limit: async ({ queryMetrics, contextMetrics, context }) => {
    // custom logic — throw to reject
    await rateLimiter.consume(context.userId);
  },
});

registry.use(limiter);

// Per-query metrics for monitoring
limiter.metrics;         // ReadonlyMap<hash, QueryMetrics>
limiter.contextMetrics;  // ReadonlyMap<hash, ReadonlyMap<contextKey, ContextMetrics>>
limiter.clearContextMetrics(userId); // eager eviction on logout
```

The built-in `AuditLogPlugin` covers audit logging:

```typescript
import { AuditLogPlugin } from 'vexnor/registry';

registry.use(new AuditLogPlugin({
  contextLogResolver: ({ userId }) => ({ userId }), // opt-in — never logs raw context
  onLog: ({ name, durationMs, error, context }) => {
    logger.info({ name, durationMs, error, ...context });
  },
}));
```

For a fully custom plugin, implement the `QueryExecutionPlugin` interface directly:

```typescript
import type { QueryExecutionPlugin } from 'vexnor/registry';

const myPlugin: QueryExecutionPlugin = {
  name: 'my-plugin',
  check: ({ name, context }) => {
    // throw SqlRunError to reject with QUERY_RATE_LIMITED
    // throw any other error — it will be wrapped automatically
  },
  before: ({ name }) => {
    // fires after checks pass, before the query runs (fire-and-forget)
  },
  after: ({ name, durationMs, error }) => {
    // fires after every query completes, success or failure (fire-and-forget)
  },
};

registry.use(myPlugin);
```

## Security

The server only executes queries that were explicitly registered. An unknown hash returns an error — the client cannot construct or inject arbitrary SQL. The attack surface is limited to the set of queries you register.

For additional access control, use `.authorize()` tags and `registerAuthorization()` hooks — see [Authorization](authorization.md).

## Multiple Databases

Register the same query shape for multiple plugins:

```typescript
import * as postgresQueries from './queries/postgres.js';
import * as mssqlQueries from './queries/mssql.js';
import * as sqlite3Queries from './queries/sqlite3.js';

await registry.register(vexnorPostgres, postgresQueries);
await registry.register(vexnorMssql, mssqlQueries);
await registry.register(vexnorSqlite3, sqlite3Queries);
```

The client selects the database by passing the plugin name in the request. Each plugin's queries are scoped independently — a hash registered under `vexnor-postgres` cannot be executed under `vexnor-mssql`.
