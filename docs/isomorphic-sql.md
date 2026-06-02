# Isomorphic SQL

Vexnor queries are plain objects. They carry their SQL template, type information, and a stable hash — which means the same query can execute in two fundamentally different ways without any change to the query definition itself.

## The Problem

In a typical web application, data access is split across two layers:

- **Server** — SQL queries, ORM calls, or repository methods
- **Client** — fetch calls to REST endpoints, GraphQL queries, or tRPC procedures

This split creates friction: you define the data shape once on the server, then define it again as an API contract, then consume it on the client. Any change to the data shape requires updating all three layers.

## The Vexnor Approach

A vexnor query is defined once in a shared module. It can then be executed in two ways:

**Direct execution** — pass a real database connection:

```typescript
const accounts = await selectAccounts.postgres.all({ db: pool });
```

**Remote execution** — pass a `RemoteClient`:

```typescript
const accounts = await selectAccounts.postgres.all({ db: remoteClient });
```

The call site is identical. The result type is identical. The only difference is where the SQL actually runs.

## How Remote Execution Works

When vexnor detects a `RemoteClient` as the `db` argument:

1. It computes the query's stable SHA-256 hash from its SQL template strings
2. It calls `remoteClient.remoteExecute({ plugin, hash, params, name, location, mode })`
3. The server receives `{ plugin, hash, params, name, location, mode }` — no SQL, just a hash
4. The server looks up the query by hash in its `QueryRegistry`
5. The query executes against the real database connection on the server
6. The result is serialized and returned to the client
7. Vexnor deserializes the result (restoring `Date` objects, nested JSON, etc.)

The client never sends SQL. It sends a hash that identifies a pre-registered query. The server only executes queries that were explicitly registered — an unknown hash is rejected. `name` and `location` are forwarded for error messages and server-side audit logs. `mode` (`"mutation"` or `"query"`) tells the server which execution path to use — write operations use `"mutation"`, read operations use `"query"`.

## Execution Contexts

The same query works across all three contexts:

```
┌─────────────────────────────────────────────────────────────┐
│  shared/queries/postgres.ts                                  │
│                                                              │
│  export const selectAccounts = sql`                          │
│    SELECT ${row(Account.$$)}, ...                            │
│    FROM ${Account}                                           │
│    WHERE (${filter}::text IS NULL OR ...)                    │
│  `;                                                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
       ┌───────────┼───────────────────┐
       ▼           ▼                   ▼
  Server (Node)  RSC (Next.js)    Browser (React)
  direct pool    direct pool      remoteClient
  execution      execution        → /api/db → pool
```

### Server-side (Node.js / Hono)

```typescript
// server/src/server.ts
const accounts = await selectAccounts.postgres.all({
  db: pool,
  params: { filter },
});
```

### React Server Components (Next.js)

```typescript
// app/postgres/accounts/page.tsx
export default async function AccountsPage({ searchParams }) {
  const { filter } = await searchParams;
  const accounts = await selectAccounts.postgres.all({
    db: pgPool,
    params: { filter },
  });
  // render directly — no API call, no loading state
}
```

### Browser (React client component)

```typescript
// client/src/pages/postgres-accounts.tsx
const accounts = await selectAccounts.postgres.all({
  db: remoteClient,   // dispatches to /api/db
  params: { filter },
});
```

## `HttpRemoteClient`

`HttpRemoteClient` is the built-in `RemoteClient` implementation. It handles JSON serialization, `Content-Type`, and response parsing.

For anonymous (unauthenticated) use:

```typescript
import { HttpRemoteClient } from 'vexnor';

export const remoteClient = new HttpRemoteClient({ targetUrl: '/api/db' });
```

For authenticated use, provide a `headerResolver`. Use `useMemo` so the reference only changes when the token changes:

```typescript
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

`HttpRemoteClientOptions`:
- `targetUrl: string` — the endpoint URL
- `headers?: Record<string, string>` — static headers merged into every request
- `headerResolver?` — async function returning headers per request; receives the full request payload so you can vary headers by query if needed
- `fetch?` — override the fetch implementation (useful for testing)

## Compared to Alternatives

| | REST | tRPC | GraphQL | Vexnor |
|---|---|---|---|---|
| Define data shape | twice (server + client types) | once (router) | once (schema) | once (query) |
| Type safety | manual or codegen | ✓ | codegen | ✓ |
| Raw SQL | no | no | no | ✓ |
| Client sends SQL | — | — | — | never |
| Shared query definition | no | no | no | ✓ |
| Works in RSC | fetch | fetch | fetch | direct |

The key difference from tRPC: vexnor doesn't require you to define a procedure for each operation. The query *is* the procedure — it's registered by hash, not by name, and the type flows from the SQL definition directly to the call site.

## Security

The server only executes queries that were explicitly registered at startup. The client cannot construct or inject arbitrary SQL — it can only reference queries by their pre-computed hash.

```typescript
// server registers at startup
await registry.register(vexnorPostgres, { selectAccounts, deleteAccount, insertAccount });

// client dispatches by hash — server rejects anything not registered
const result = await registry.execute(plugin, hash, params, resolver);
// throws SqlError with code QUERY_NOT_FOUND — if hash not registered
```

The `/api/db` endpoint should map `SqlErrorCode` values to appropriate HTTP status codes so clients get structured error responses:

```typescript
import { SqlError, SqlRunError } from 'vexnor/registry';

// QUERY_NOT_FOUND → 400, QUERY_NOT_AUTHORIZED → 403,
// QUERY_RATE_LIMITED → 429, QUERY_TIMEOUT → 504, etc.
const status = SQL_ERROR_STATUS[err.code] ?? 500;
return c.json({ error: err.message, code: err.code }, status);
```

See [Registry](registry.md#error-handling) for the full status mapping.

For additional access control, queries can be tagged with `.authorize()` and validated against a hook before execution. See [Authorization](authorization.md).

## Further Reading

- [Registry & Setup](registry.md) — step-by-step setup, `QueryRegistry` API, Next.js, multiple databases
- [Authorization](authorization.md) — per-query authorization hooks, audit logging
- [Examples: react-vite-api](../examples/react-vite-api) — React + Vite + Hono, full isomorphic setup
- [Examples: react-next-app](../examples/react-next-app) — Next.js App Router, RSC + Server Actions + remoteClient
