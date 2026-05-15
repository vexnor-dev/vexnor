# vexnor-sqlite3

SQLite plugin for Vexnor.

Provides schema introspection, type mapping, query execution, JSON aggregation, and transaction support for SQLite via `better-sqlite3`.

## Install

```bash
npm install vexnor vexnor-sqlite3 better-sqlite3
```

## Setup

Import `vexnor-sqlite3` once at your entry point — this registers the `.sqlite` execution property on all queries via module augmentation.

```typescript
import 'vexnor-sqlite3';
import Database from 'better-sqlite3';

const db = new Database('mydb.sqlite');
```

`better-sqlite3` is synchronous — Vexnor wraps calls in `Promise.resolve()` so the async execution API stays consistent with other plugins.

## Executing Queries

```typescript
import { sql, row, param } from 'vexnor';
import { Account } from './models/account-table.js';

const findByEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email')}
`;

const account = await findByEmail.sqlite.one({ db, params: { email: 'jane@example.com' } });
const accounts = await findByEmail.sqlite.all({ db, params: { email: 'jane@example.com' } });
const found = await findByEmail.sqlite.any({ db, params: { email: 'jane@example.com' } });
await findByEmail.sqlite.run({ db, params: { email: 'jane@example.com' } });
```

| Method | Returns | Throws if empty |
|--------|---------|-----------------|
| `.one({ db, params? })` | `T` | yes |
| `.any({ db, params? })` | `T \| null` | no |
| `.all({ db, params? })` | `T[]` | no |
| `.run({ db, params? })` | void | no |

## JSON Aggregation

`jsonMany` and `jsonOne` aggregate related rows into typed JSON using `json_group_array` and `json_object`.

Place each charm twice — once in `SELECT` (with `.as(key)`) and once in `FROM`.

### `jsonMany`

Aggregates rows into `T[]`. Returns `[]` when no rows match.

```typescript
import { jsonMany } from 'vexnor-sqlite3';

const AccountOrders = sql`
  SELECT ${row(Order.$orderId, Order.$status)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
`;

const result = await sql`
  SELECT ${row(Account.$$)}, ${jsonMany(AccountOrders).as('orders')}
  FROM ${Account} ${jsonMany(AccountOrders)}
`.sqlite.all({ db });
// result[0].orders: { orderId: string; status: string }[]
```

### `jsonOne`

Aggregates the first matching row into `T | null`. Returns `null` when no row matches.

```typescript
import { jsonOne } from 'vexnor-sqlite3';

const LastOrder = sql`
  SELECT ${row(Order.$$)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
  ORDER BY ${Order.$createdAt} DESC
`;

const result = await sql`
  SELECT ${row(Account.$$)}, ${jsonOne(LastOrder).as('lastOrder')}
  FROM ${Account} ${jsonOne(LastOrder)}
`.sqlite.one({ db });
// result.lastOrder: IOrderSelect | null
```

## Transactions

### `transaction`

Begins a transaction, runs a callback, then commits. Rolls back automatically on error.

```typescript
import { transaction } from 'vexnor-sqlite3';

await transaction(db, async (db) => {
  await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)} RETURNING ${row(Account.$$)}`
    .sqlite.one({ db });
});
```

Options:

```typescript
await transaction(db, async (db) => { ... }, {
  behavior: 'IMMEDIATE', // default: 'DEFERRED'
});
```

Supported behaviors: `DEFERRED`, `IMMEDIATE`, `EXCLUSIVE`.

### `savepoint`

Creates a savepoint within an existing transaction. Rolls back to the savepoint and returns `undefined` if the callback throws. Releases the savepoint on success.

```typescript
import { transaction, savepoint } from 'vexnor-sqlite3';

await transaction(db, async (db) => {
  await savepoint(db, async (db) => {
    await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.sqlite.run({ db });
  });
});
```

## CRUD Query Factories

Generated tables expose typed query factories on `.sqlite`. Available methods depend on which operations are enabled in the table's `crud` config.

```typescript
// Find by primary key
const account = await Account.sqlite.findById().any({
  db,
  params: { accountId: '00000000-0000-0000-0000-000000000001' },
});

// Find by any column subset
const account = await Account.sqlite.findBy().any({
  db,
  params: { email: 'jane@example.com' },
});

// SELECT with optional clauses
const accounts = await Account.sqlite.select({
  WHERE: sql`${Account.$status} = 'ACTIVE'`,
  ORDER_BY: sql`${Account.$createdAt} DESC`,
  limit: param<{ limit: number }>('limit'),
  offset: param<{ offset: number }>('offset'),
  includeMany: { orders: AccountOrders },
  includeOne: { lastOrder: LastOrder },
}).all({ db, params: { limit: 20, offset: 0 } });
// ORDER_BY is required when using limit/offset

// INSERT multiple rows
const inserted = await Account.sqlite.insertRows().all({
  db,
  params: { rows: [{ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }] },
});

// INSERT from SELECT — copies rows from a source query
const sourceQuery = sql`
  SELECT ${row(StagingAccount.$email, StagingAccount.$firstName, StagingAccount.$lastName)}
  FROM ${StagingAccount}
  WHERE ${StagingAccount.$status} = 'READY'
`;
const result = await Account.sqlite.insertFrom({ FROM: sourceQuery }).all({ db });

// UPDATE
const updated = await Account.sqlite.update({
  WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>('accountId')}`,
}).all({ db, params: { set: { status: 'CONFIRMED' }, accountId: '00000000-0000-0000-0000-000000000001' } });

// DELETE
await Account.sqlite.delete({
  WHERE: sql`${Account.$status} = 'INACTIVE'`,
}).run({ db });

// UPSERT (INSERT ... ON CONFLICT DO UPDATE)
const result = await Account.sqlite.upsert({
  CONFLICT_ON: [Account.$email],
  // SET is optional — defaults to updating all non-conflict columns with EXCLUDED values
}).all({
  db,
  params: { rows: [{ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }] },
});
```

Available `select()` clauses: `SELECT`, `WHERE`, `JOIN`, `GROUP_BY`, `HAVING`, `ORDER_BY`, `limit`, `offset`, `includeMany`, `includeOne`.

## Codegen

Generate TypeScript types from your SQLite schema:

```bash
npx vexnor codegen \
  --plugin vexnor-sqlite3 \
  --schema main \
  --uri $SQLITE_PATH \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns
```

Schema introspection uses `PRAGMA table_list`, `PRAGMA table_info`, and `PRAGMA index_list`.
