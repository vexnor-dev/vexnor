# Quickstart

## Install

```bash
# PostgreSQL
npm install vexnor vexnor-postgres pg

# MS SQL Server
npm install vexnor vexnor-mssql mssql

# SQLite
npm install vexnor vexnor-sqlite3 better-sqlite3
```

## Generate Types

Connect to your database and generate TypeScript types:

```bash
npx vexnor codegen \
  --plugin vexnor-postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
  --pascalCaseTables \
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
}>({ ... });

export type IAccountSelect = { accountId: string; email: string; firstName: string; ... };
export type IAccountInsert = { email: string; firstName: string; ... };
export type IAccountUpdate = Partial<IAccountInsert>;
```

Column naming convention: `account_id` → `Account.$accountId`, `first_name` → `Account.$firstName`.

## Your First Query

```typescript
import { Account } from './models/public.account-table.js';
import { sql, row, param } from 'vexnor';
import 'vexnor-postgres';
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
  WHERE ${Account.$status} = ${'ACTIVE'}
`;

const account = await query.postgres.one({ db: pool });
// account: { accountId: string; email: string }
// account.firstName — compile error, not selected
```

## Computed Columns

Use `val` for raw SQL expressions and `col` for typed column references:

```typescript
import { sql, row, col } from 'vexnor';

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
import { jsonMany, jsonOne } from 'vexnor-postgres';

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
| `.run({ db, params? })` | void | no |

Works the same across all databases — swap `.postgres` for `.mssql` or `.sqlite`.

## Next Steps

- [Queries](queries.md) — subqueries, CTEs, recursive CTEs, window functions
- [Params](params.md) — `param()` validation rules, inline injection
- [CRUD](crud.md) — typed query factories (`findBy`, `select`, `insertRows`, `upsert`, ...)
- [CLI](cli.md) — `exec run`, `exec init`, config reference
- [Databases](databases.md) — per-DB driver setup and dialect notes
- [Plugins & Adaptors](plugins.md) — Drizzle, Prisma, TypeORM, Sequelize
