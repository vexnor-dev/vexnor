# vexnor-mssql

MS SQL Server plugin for Vexnor.

Provides schema introspection, type mapping, query execution, JSON aggregation, and transaction support for MS SQL Server.

## Install

```bash
npm install vexnor vexnor-mssql mssql
```

## Setup

Import `vexnor-mssql` once at your entry point — this registers the `.mssql` execution property on all queries via module augmentation.

```typescript
import 'vexnor-mssql';
import * as mssql from 'mssql';

const pool = await mssql.connect(process.env.MSSQL_CONNECTION_STRING!);
```

## Executing Queries

```typescript
import { sql, row, param } from 'vexnor';
import { Account } from './models/dbo.account-table.js';

const findByEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email')}
`;

const account = await findByEmail.mssql.one({ db: pool, params: { email: 'jane@example.com' } });
const accounts = await findByEmail.mssql.all({ db: pool, params: { email: 'jane@example.com' } });
const found = await findByEmail.mssql.any({ db: pool, params: { email: 'jane@example.com' } });
await findByEmail.mssql.run({ db: pool, params: { email: 'jane@example.com' } });
```

| Method | Returns | Throws if empty |
|--------|---------|-----------------|
| `.one({ db, params? })` | `T` | yes |
| `.any({ db, params? })` | `T \| null` | no |
| `.all({ db, params? })` | `T[]` | no |
| `.run({ db, params? })` | void | no |

Params are bound as named `@paramName` placeholders internally — this is handled automatically.

## JSON Aggregation

`jsonMany` and `jsonOne` aggregate related rows into typed JSON using `FOR JSON PATH`.

Place each charm twice — once in `SELECT` (with `.as(key)`) and once in `FROM`.

### `jsonMany`

Aggregates rows into `T[]` using `FOR JSON PATH`. Returns `[]` when no rows match.

```typescript
import { jsonMany } from 'vexnor-mssql';

const AccountOrders = sql`
  SELECT ${row(Order.$orderId, Order.$status)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
`;

const result = await sql`
  SELECT ${row(Account.$$)}, ${jsonMany(AccountOrders).as('orders')}
  FROM ${Account} ${jsonMany(AccountOrders)}
`.mssql.all({ db: pool });
// result[0].orders: { orderId: string; status: string }[]
```

### `jsonOne`

Aggregates the first matching row into `T | null` using `FOR JSON PATH, WITHOUT_ARRAY_WRAPPER`. Returns `null` when no row matches.

```typescript
import { jsonOne } from 'vexnor-mssql';

const LastOrder = sql`
  SELECT ${row(Order.$$)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
  ORDER BY ${Order.$createdAt} DESC
`;

const result = await sql`
  SELECT ${row(Account.$$)}, ${jsonOne(LastOrder).as('lastOrder')}
  FROM ${Account} ${jsonOne(LastOrder)}
`.mssql.one({ db: pool });
// result.lastOrder: IOrderSelect | null
```

## Transactions

### `transaction`

Begins a transaction on the pool, runs a callback, then commits. Rolls back automatically on error.

```typescript
import { transaction } from 'vexnor-mssql';

await transaction(pool, async (tx) => {
  const request = tx.request();
  await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`
    .mssql.run({ db: request });
});
```

Options:

```typescript
await transaction(pool, async (tx) => { ... }, {
  isolationLevel: 'SERIALIZABLE', // default: 'READ_COMMITTED'
});
```

Supported isolation levels: `READ_UNCOMMITTED`, `READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE`, `SNAPSHOT`.

### `savepoint`

Creates a named savepoint within an existing transaction. Rolls back to the savepoint and returns `undefined` if the callback throws. MSSQL savepoints are released automatically on commit.

```typescript
import { transaction, savepoint } from 'vexnor-mssql';

await transaction(pool, async (tx) => {
  await savepoint(tx, async (request) => {
    await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.mssql.run({ db: request });
  });
});
```

## CRUD Query Factories

Generated tables expose typed query factories on `.mssql`. Available methods depend on which operations are enabled in the table's `crud` config.

```typescript
// Find by primary key
const account = await Account.mssql.findById().any({
  db: pool,
  params: { accountId: '00000000-0000-0000-0000-000000000001' },
});

// Find by any column subset
const account = await Account.mssql.findBy().any({
  db: pool,
  params: { email: 'jane@example.com' },
});

// SELECT with optional clauses
const accounts = await Account.mssql.select({
  WHERE: sql`${Account.$status} = 'ACTIVE'`,
  ORDER_BY: sql`${Account.$createdAt} DESC`,
  limit: param<{ limit: number }>('limit'),
  offset: param<{ offset: number }>('offset'),
  includeMany: { orders: AccountOrders },
  includeOne: { lastOrder: LastOrder },
}).all({ db: pool, params: { limit: 20, offset: 0 } });
// Pagination uses OFFSET x ROWS FETCH NEXT y ROWS ONLY — ORDER_BY is required when using limit/offset

// INSERT multiple rows
const inserted = await Account.mssql.insertRows().all({
  db: pool,
  params: { rows: [{ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }] },
});

// INSERT from SELECT — copies rows from a source query
const sourceQuery = sql`
  SELECT ${row(StagingAccount.$email, StagingAccount.$firstName, StagingAccount.$lastName)}
  FROM ${StagingAccount}
  WHERE ${StagingAccount.$status} = 'READY'
`;
const result = await Account.mssql.insertFrom({ FROM: sourceQuery }).all({ db: pool });

// UPDATE
const updated = await Account.mssql.update({
  WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>('accountId')}`,
}).all({ db: pool, params: { set: { status: 'CONFIRMED' }, accountId: '00000000-0000-0000-0000-000000000001' } });

// DELETE
await Account.mssql.delete({
  WHERE: sql`${Account.$status} = 'INACTIVE'`,
}).run({ db: pool });

// UPSERT (MERGE)
const result = await Account.mssql.upsert({
  MERGE_ON: [Account.$email],
  // SET is optional — defaults to updating all non-merge columns from the source
}).all({
  db: pool,
  params: { rows: [{ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }] },
});
```

Available `select()` clauses: `SELECT`, `WHERE`, `JOIN`, `GROUP_BY`, `HAVING`, `ORDER_BY`, `limit`, `offset`, `includeMany`, `includeOne`.

## Bundler Notes

The `sideEffects` field in `package.json` explicitly marks `dist/index.js`, `dist/vexnor-mssql.js`, and `dist/mssql-augment.js` as having side effects. This is required for bundlers (Turbopack, webpack, esbuild) that perform tree-shaking — without it, the prototype augmentation that registers `.mssql` on all queries gets dropped, causing runtime errors.

Do not remove or narrow the `sideEffects` field.

## Codegen

```bash
npx vexnor codegen \
  --plugin vexnor-mssql \
  --schema dbo \
  --uri $MSSQL_CONNECTION_STRING \
  --outDir src/models \
   \
  --camelCaseColumns
```

MSSQL has no native enum type — enum-like columns are generated as `string`.
