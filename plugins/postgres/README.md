# @vexnor/postgres

PostgreSQL plugin for Vexnor.

Provides schema introspection, type mapping, query execution, JSON aggregation, and transaction support for PostgreSQL.

## Install

```bash
npm install vexnor @vexnor/postgres pg
```

## Setup

Import `@vexnor/postgres` once at your entry point — this registers the `.postgres` execution property on all queries via module augmentation.

```typescript
import '@vexnor/postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

Also works with `postgres.js` — pass a `postgres()` client as `db`.

## Executing Queries

```typescript
import { sql, row, param } from 'vexnor';
import { Account } from './models/public.account-table.js';

const findByEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email')}
`;

const account = await findByEmail.postgres.one({ db: pool, params: { email: 'jane@example.com' } });
const accounts = await findByEmail.postgres.all({ db: pool, params: { email: 'jane@example.com' } });
const found = await findByEmail.postgres.any({ db: pool, params: { email: 'jane@example.com' } });
await findByEmail.postgres.run({ db: pool, params: { email: 'jane@example.com' } });
```

| Method | Returns | Throws if empty |
|--------|---------|-----------------|
| `.one({ db, params? })` | `T` | yes |
| `.any({ db, params? })` | `T \| null` | no |
| `.all({ db, params? })` | `T[]` | no |
| `.run({ db, params? })` | void | no |

## JSON Aggregation

`jsonMany` and `jsonOne` aggregate related rows into typed JSON using a `LEFT JOIN LATERAL`.

Place each charm twice — once in `SELECT` (with `.as(key)` to name the result column) and once in `FROM` (to emit the lateral join).

### `jsonMany`

Aggregates rows into a `T[]` using `jsonb_agg`. Returns `[]` when no rows match.

```typescript
import { jsonMany } from '@vexnor/postgres';

const AccountOrders = sql`
  SELECT ${row(Order.$orderId, Order.$status)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
`;

const result = await sql`
  SELECT ${row(Account.$$)}, ${jsonMany(AccountOrders).as('orders')}
  FROM ${Account} ${jsonMany(AccountOrders)}
`.postgres.all({ db: pool });
// result[0].orders: { orderId: string; status: string }[]
```

### `jsonOne`

Aggregates the first matching row into `T | null` using `to_jsonb`. Returns `null` when no row matches.

```typescript
import { jsonOne } from '@vexnor/postgres';

const LastOrder = sql`
  SELECT ${row(Order.$$)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
  ORDER BY ${Order.$createdAt} DESC
`;

const result = await sql`
  SELECT ${row(Account.$$)}, ${jsonOne(LastOrder).as('lastOrder')}
  FROM ${Account} ${jsonOne(LastOrder)}
`.postgres.one({ db: pool });
// result.lastOrder: IOrderSelect | null
```

## Transactions

### `transaction`

Acquires a client from the pool, runs a callback inside a transaction, then commits. Rolls back automatically on error.

```typescript
import { transaction } from '@vexnor/postgres';

await transaction(pool, async (client) => {
  await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)} RETURNING ${row(Account.$$)}`
    .postgres.one({ db: client });
  await sql`UPDATE ${Order} SET ${Order.updateSet({ status: 'confirmed' })} WHERE ...`
    .postgres.run({ db: client });
});
```

Options:

```typescript
await transaction(pool, async (client) => { ... }, {
  isolationLevel: 'SERIALIZABLE', // default: 'READ COMMITTED'
  accessMode: 'READ ONLY',        // default: 'READ WRITE'
  deferrable: 'DEFERRABLE',       // default: 'NOT DEFERRABLE'
});
```

### `savepoint`

Creates a savepoint within an existing transaction. Rolls back to the savepoint and returns `undefined` if the callback throws.

```typescript
import { transaction, savepoint } from '@vexnor/postgres';

await transaction(pool, async (client) => {
  await savepoint(client, async (client) => {
    // rolls back to savepoint if this throws, outer transaction continues
    await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.postgres.run({ db: client });
  });
});
```

## Special Types

The following PostgreSQL-specific types are exported for use in custom type assertions:

```typescript
import type { Point, Circle, Interval } from '@vexnor/postgres';
```

## CRUD Query Factories

Generated tables expose typed query factories on `.postgres`. Available methods depend on which operations are enabled in the table's `crud` config.

```typescript
// Find by primary key
const account = await Account.postgres.findById().any({
  db: pool,
  params: { accountId: '00000000-0000-0000-0000-000000000001' },
});

// Find by any column subset
const account = await Account.postgres.findBy().any({
  db: pool,
  params: { email: 'jane@example.com' },
});

// SELECT with optional clauses
const accounts = await Account.postgres.select({
  WHERE: sql`${Account.$status} = 'ACTIVE'`,
  ORDER_BY: sql`${Account.$createdAt} DESC`,
  limit: param<{ limit: number }>('limit'),
  offset: param<{ offset: number }>('offset'),
  includeMany: { orders: AccountOrders },
  includeOne: { lastOrder: LastOrder },
}).all({ db: pool, params: { limit: 20, offset: 0 } });

// INSERT multiple rows
const inserted = await Account.postgres.insertRows().all({
  db: pool,
  params: { rows: [{ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }] },
});

// INSERT from SELECT — copies rows from a source query
const sourceQuery = sql`
  SELECT ${row(StagingAccount.$email, StagingAccount.$firstName, StagingAccount.$lastName)}
  FROM ${StagingAccount}
  WHERE ${StagingAccount.$status} = 'READY'
`;
const result = await Account.postgres.insertFrom({ FROM: sourceQuery }).all({ db: pool });

// UPDATE
const updated = await Account.postgres.update({
  WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>('accountId')}`,
}).all({ db: pool, params: { set: { status: 'CONFIRMED' }, accountId: '00000000-0000-0000-0000-000000000001' } });

// DELETE
await Account.postgres.delete({
  WHERE: sql`${Account.$status} = 'INACTIVE'`,
}).run({ db: pool });

// UPSERT (INSERT ... ON CONFLICT DO UPDATE)
const result = await Account.postgres.upsert({
  CONFLICT_ON: [Account.$email],
  // SET is optional — defaults to updating all non-conflict columns with EXCLUDED values
}).all({
  db: pool,
  params: { rows: [{ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }] },
});
```

Available `select()` clauses: `SELECT`, `WHERE`, `JOIN`, `GROUP_BY`, `HAVING`, `ORDER_BY`, `limit`, `offset`, `includeMany`, `includeOne`.

## Bundler Notes

The `sideEffects` field in `package.json` explicitly marks `dist/index.js`, `dist/@vexnor/postgres.js`, and `dist/postgres-augment.js` as having side effects. This is required for bundlers (Turbopack, webpack, esbuild) that perform tree-shaking — without it, the prototype augmentation that registers `.postgres` on all queries gets dropped, causing runtime errors.

Do not remove or narrow the `sideEffects` field.

## Codegen

```bash
npx vexnor codegen \
  --plugin @vexnor/postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
   \
  --camelCaseColumns
```

PostgreSQL enums are generated as typed `const` objects:

```typescript
export const AccountStatusUdt = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } as const;
export type AccountStatusUdt = (typeof AccountStatusUdt)[keyof typeof AccountStatusUdt];
```
