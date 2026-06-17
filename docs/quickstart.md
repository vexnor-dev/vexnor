# Quickstart

## Install

```bash
# PostgreSQL
npm install @vexnor/core @vexnor/postgres pg

# MS SQL Server
npm install @vexnor/core @vexnor/mssql mssql

# SQLite
npm install @vexnor/core @vexnor/sqlite3 better-sqlite3
```

## Generate Types

Connect to your database and generate TypeScript types:

```bash
npx vexnor codegen \
  --plugin @vexnor/postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
   \
  --camelCaseColumns
```

This writes one file per table into `--outDir`. Commit these files — they only change when your schema changes.

Each generated file exports a table constant and its types:

```typescript
// src/models/public.account-table.ts (generated)
export const Account = vexnor.newSqlTable<{
  Select: IAccountSelect;
  Insert: IAccountInsert;
  Update: IAccountUpdate;
  Delete: true;
}>({
  // ...crud, tableInfo, pk, dialect, source, columns
  fk: [
    { from: ["parentId"], to: { schema: "public", table: "account", columns: ["accountId"] } },
  ],
  dbSchema: {
    accountId: { dbType: "uuid", type: vexnor.SqlLiteralType.String, default: "gen_random_uuid()" },
    email: { dbType: "text", type: vexnor.SqlLiteralType.String },
    firstName: { dbType: "varchar", type: vexnor.SqlLiteralType.String },
    // ...
  },
});

export type IAccountSelect = { accountId: string; email: string; firstName: string; ... };
export type IAccountInsert = { email: string; firstName: string; ... };
export type IAccountUpdate = Partial<IAccountInsert>;
```

Column naming convention: `account_id` → `Account.$accountId`, `first_name` → `Account.$firstName`.

## Your First Query

```typescript
import { Account } from './models/public.account-table.js';
import { sql, row, param } from '@vexnor/core';
import '@vexnor/postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const findByEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email')}
`;

const account = await findByEmail.postgres.one({
  db: pool,
  params: { email: 'john@example.com' },
});
// account: IAccountSelect
```

`row(Account.$$)` selects all columns. The result type is inferred as `IAccountSelect`.

## Selecting Specific Columns

Pass individual column references to `row()` to narrow the result type:

```typescript
const query = sql`
  SELECT ${row(Account.$accountId, Account.$email)}
  FROM ${Account}
  WHERE ${Account.$status} = 'ACTIVE'
`;

const account = await query.postgres.one({ db: pool });
// account: { accountId: string; email: string }
// account.firstName — compile error, not selected
```

## Computed Columns

Use `col` to give a raw SQL expression a name and a TypeScript type:

```typescript
import { sql, row, col } from '@vexnor/core';

const result = await sql`
  SELECT
    ${row(Account.$accountId, Account.$email)},
    count(distinct ${Order.$orderId}) as ${col<{ orderCount: number }>('orderCount')},
    first_name || ' ' || last_name as ${col<{ fullName: string }>('fullName')}
  FROM ${Account}
  LEFT JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}
  GROUP BY ${Account.$accountId}, ${Account.$email}, first_name, last_name
`.postgres.all({ db: pool });
// result: { accountId: string; email: string; orderCount: number; fullName: string }[]
```

## INSERT

Use `insertColsVals()` for typed multi-row inserts:

```typescript
const newAccount = await sql`
  INSERT INTO ${Account}
    ${Account.insertColsVals({
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    })}
  RETURNING ${row(Account.$$)}
`.postgres.one({ db: pool });
// newAccount: IAccountSelect
```

Multiple rows:

```typescript
const accounts = await sql`
  INSERT INTO ${Account}
    ${Account.insertColsVals(
      { email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' },
      { email: 'john@example.com', firstName: 'John', lastName: 'Smith' },
    )}
  RETURNING ${row(Account.$$)}
`.postgres.all({ db: pool });
```

## UPDATE

Use `updateSet()` for typed SET clauses:

```typescript
const updated = await sql`
  UPDATE ${Account}
  SET ${Account.updateSet({ status: 'CONFIRMED' })}
  WHERE ${Account.$accountId} = ${accountId}
  RETURNING ${row(Account.$$)}
`.postgres.one({ db: pool });
```

## JSON Aggregation

`jsonMany` and `jsonOne` aggregate related rows into typed JSON arrays or objects using a lateral join — no manual SQL needed.

```typescript
import { jsonMany, jsonOne } from '@vexnor/postgres';

const RecentOrders = sql`
  SELECT ${row(Order.$orderId, Order.$status, Order.$createdAt)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
  ORDER BY ${Order.$createdAt} DESC
  LIMIT 5
`;

const result = await sql`
  SELECT ${row(Account.$$)},
         ${jsonMany(RecentOrders).as('orders')}
  FROM ${Account} ${jsonMany(RecentOrders)}
  WHERE ${Account.$accountId} = ${accountId}
`.postgres.one({ db: pool });
// result.orders: { orderId: string; status: string; createdAt: Date }[]
```

`jsonOne` returns `T | null` instead of `T[]`:

```typescript
const LastOrder = sql`
  SELECT ${row(Order.$$)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
  ORDER BY ${Order.$createdAt} DESC
`;

const result = await sql`
  SELECT ${row(Account.$$)},
         ${jsonOne(LastOrder).as('lastOrder')}
  FROM ${Account} ${jsonOne(LastOrder)}
`.postgres.one({ db: pool });
// result.lastOrder: IOrderSelect | null
```

## Execution Methods

All queries expose four execution methods:

| Method | Returns | Throws if empty |
|--------|---------|-----------------|
| `.one({ db, params? })` | `T` | yes |
| `.any({ db, params? })` | `T \| null` | no |
| `.all({ db, params? })` | `T[]` | no |
| `.run({ db, params? })` | `RunResult` | no |

Works the same across all databases — swap `.postgres` for `.mssql` or `.sqlite`.

All methods accept an optional `options` object:

```typescript
await query.postgres.all({
  db: pool,
  params: { ... },
  options: {
    timeout: 5000,     // abort after 5 s; throws SqlRunError with code QUERY_TIMEOUT
    retryable: false,  // override the plugin's automatic retryable detection
  },
});
```

## Isomorphic SQL (Server + Client)

The same query object works on the server (direct DB access) and in the browser (dispatched over HTTP). No REST endpoints to define, no API types to maintain.

### Shared query definition

Define queries in a shared module imported by both server and client:

```typescript
// shared/queries.ts
import { Account } from './models/public.account-table.js';
import { sql, row, param } from '@vexnor/core';
import '@vexnor/postgres';

export const selectAccounts = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE (${param<{ filter?: string }>('filter')}::text IS NULL
     OR ${Account.$email} ILIKE '%' || ${param<{ filter?: string }>('filter')} || '%')
`;
```

### Server — direct execution

```typescript
// Works in any Node.js server (Hono, Express, Fastify, Next.js API routes, etc.)
const accounts = await selectAccounts.postgres.all({
  db: pool,
  params: { filter: 'jane' },
});
```

### Browser — remote execution

```typescript
import { HttpRemoteClient } from '@vexnor/core';

const remoteClient = new HttpRemoteClient({ targetUrl: '/api/db' });

// Same query, same call signature, same result type
const accounts = await selectAccounts.postgres.all({
  db: remoteClient,
  params: { filter: 'jane' },
});
```

The client sends a stable hash (not SQL). The server looks it up in a `SqlQueryRegistry`, executes it, and returns typed results.

### Server endpoint (any framework)

```typescript
import { SqlQueryRegistry } from '@vexnor/core/execution';
import { vexnorPostgres } from '@vexnor/postgres';
import { selectAccounts } from '../shared/queries.js';

const registry = new SqlQueryRegistry();
await registry.register(vexnorPostgres, { selectAccounts });

// Hono example — same pattern applies to Express, Fastify, Next.js API routes
app.post('/api/db', async (c) => {
  const body = await c.req.json();
  const result = await registry.execute(body, async () => pool);
  return c.json(result);
});
```

### React Server Components (Next.js)

In RSC, queries execute directly on the server — no HTTP round-trip, no loading state:

```typescript
// app/accounts/page.tsx (server component)
import { selectAccounts } from '@/shared/queries';
import { pgPool } from '@/lib/db';

export default async function AccountsPage({ searchParams }) {
  const { filter } = await searchParams;
  const accounts = await selectAccounts.postgres.all({
    db: pgPool,
    params: { filter },
  });

  return (
    <ul>
      {accounts.map(a => <li key={a.accountId}>{a.email}</li>)}
    </ul>
  );
}
```

### Client components (React — any framework)

For client components that need data, use the same query via `remoteClient`:

```typescript
// components/account-list.tsx (client component)
'use client'; // Next.js — or just a regular React component in Vite

import { selectAccounts } from '@/shared/queries';
import { useRemoteClient } from '@/hooks/use-remote-client';
import { use, Suspense } from 'react';

function AccountList({ filter }: { filter?: string }) {
  const db = useRemoteClient();
  const accounts = use(selectAccounts.postgres.all({ db, params: { filter } }));

  return <ul>{accounts.map(a => <li key={a.accountId}>{a.email}</li>)}</ul>;
}
```

See [Isomorphic SQL](isomorphic-sql.md) for the full architecture, security model, and comparison with REST/tRPC/GraphQL.

## Next Steps

- [Queries](queries.md) — subqueries, CTEs, recursive CTEs, window functions
- [Params](params.md) — `param()`, `expand()`, validation rules, inline injection
- [CRUD](crud.md) — typed query factories (`findBy`, `select`, `insertRows`, `upsert`, ...)
- [Registry](registry.md) — SqlQueryRegistry, isomorphic SQL, remote execution
- [CLI](cli.md) — `exec run`, `exec init`, config reference
- [Databases](databases.md) — per-DB driver setup and dialect notes
- [Plugins & Adaptors](plugins.md) — Drizzle, Prisma, TypeORM, Sequelize
