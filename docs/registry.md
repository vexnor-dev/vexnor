# Query Registry & Isomorphic SQL

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
import { registry, pool } from './registry.js';
import vexnorPostgres from 'vexnor-postgres';

app.post('/api/db', async (req, res) => {
  const { plugin, hash, params } = req.body;

  const result = await registry.execute(plugin, hash, params ?? {}, async () => pool);
  res.json(result);
});
```

`registry.execute` looks up the query by hash, executes it against the database, and returns the serialized result.

### 4. Create a remote client

```typescript
// client/remote-client.ts
import type { RemoteClient } from 'vexnor';

export const remoteClient: RemoteClient = {
  remoteExecute: async ({ plugin, hash, params }) => {
    const response = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plugin, hash, params }),
    });
    if (!response.ok) throw new Error(`Query failed: ${response.status}`);
    return response.json();
  },
};
```

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

## How It Works

When `.postgres.all({ db: remoteClient })` is called:

1. Vexnor detects that `db` is a `RemoteClient` (not a real connection pool)
2. It calls `remoteClient.remoteExecute({ plugin: 'vexnor-postgres', hash, params })`
3. The server receives the request, looks up the query by hash in the registry
4. The query executes against the real DB connection on the server
5. The result is serialized and returned
6. Vexnor deserializes the result on the client (handling `Date` strings, nested JSON, etc.)

The hash is a stable SHA-256 of the query's template strings — it never changes unless the SQL itself changes.

## QueryRegistry API

```typescript
const registry = new QueryRegistry();

// Register queries — pass a module namespace or explicit object
await registry.register(plugin, queries);

// Startup validation — throws if any .authorize()-tagged query has no hook registered
registry.checkAuthorization();

// Introspection
registry.getQueries();              // all registered queries
registry.getAuthorizedQueries();    // queries with .authorize() tag
registry.getUnauthorizedQueries();  // queries without .authorize() tag

// Execute a query by plugin name and hash
await registry.execute(pluginName, hash, params, connectionResolver);
```

For authorization hooks and audit logging see [Authorization](authorization.md).

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
