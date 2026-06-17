# Cheat Sheet

Quick reference for all composable APIs.

---

## Imports

```typescript
// Core — query building
import { sql, row, col, param, ctx, expand, raw, val, excluded, DEFAULT } from 'vexnor';
import { HttpRemoteClient, connect } from 'vexnor';

// Execution — registry, pipelines, errors
import { SqlQueryRegistry, SqlQueryPipeline, AuditLogPlugin, TimeToLiveRateLimiter } from 'vexnor/execution';
import { SqlError, SqlRunError, SqlErrorCode } from 'vexnor/execution';

// Config — CLI config files
import { defineConfig, defineQueryConfig } from 'vexnor/config';

// Telemetry
import 'vexnor/telemetry';

// Plugins (side-effect imports — augment .postgres, .mssql, .sqlite3)
import '@vexnor/postgres';
import '@vexnor/mssql';
import '@vexnor/sqlite3';

// Plugin-specific helpers
import { jsonMany, jsonOne, transaction, savepoint } from '@vexnor/postgres';
```

---

## `sql` — Tagged Template

Every `sql` tag returns a typed, composable query object.

```typescript
const q = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$status} = 'ACTIVE'`;
```

---

## `row()` — Select Columns

Defines the SELECT output type. Only what you put in `row()` appears in the result type.

```typescript
// All columns
row(Account.$$)

// Specific columns
row(Account.$accountId, Account.$email)

// Mix tables
row(Account.$accountId, Order.$orderId, Order.$status)
```

---

## `$$` — All Columns

Expands to every column of the table.

```typescript
sql`SELECT ${row(Account.$$)} FROM ${Account}`
// result: IAccountSelect (all columns)
```

---

## `.$column` — Column Reference

Columns are prefixed with `$`. They emit `"table"."column"` in SQL.

```typescript
Account.$accountId   // → "account"."account_id"
Account.$email       // → "account"."email"
Order.$createdAt     // → "order"."created_at"
```

---

## `.as()` — Column Alias

Renames a column in the result type. The SQL emits `AS "alias"`.

```typescript
sql`SELECT ${row(
  Account.$accountId.as('id'),
  Account.$email.as('emailAddress')
)} FROM ${Account}`
// result: { id: string; emailAddress: string }[]
```

Use it when:
- You want a shorter/different property name in the result
- Two tables have the same column name and you need to disambiguate
- You're projecting subquery columns into a parent

```typescript
// Subquery columns renamed in parent
sql`SELECT ${row(
  Account.$$,
  AccountChildren.out.$accountId.as('childId'),
  AccountChildren.out.$email.as('childEmail')
)} FROM ${Account} ...`
```

---

## `.out` — Reference Without Re-expanding

Use `.out` on a **table or query** to emit a column reference without inlining the full subquery. Essential for correlated subqueries.

```typescript
const OrderItems = sql`
  SELECT ${row(OrderItem.$$)}
  FROM ${OrderItem}
  WHERE ${OrderItem.$orderId} = ${Order.out.$orderId}
`;
// Order.out.$orderId → just "order"."order_id" — does NOT re-render the Order query

const AccountOrders = sql`
  SELECT ${row(Order.$$)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
`;
// Account.out.$accountId correlates this subquery to the parent Account query
```

**Rule:** Use `Table.out.$col` when the table is defined *outside* the current query (in the parent). Use `Table.$col` when the table is *in* the current query's FROM.

---

## `col<T>()` — Custom Typed Column

For expressions that aren't table columns (aggregates, functions, computed values):

```typescript
sql`SELECT ${row(Account.$accountId)},
    count(*) as ${col<{ total: number }>('total')},
    max(${Order.$createdAt}) as ${col<{ lastOrder: Date }>('lastOrder')}
FROM ${Account} JOIN ${Order} ON ...`
// result: { accountId: string; total: number; lastOrder: Date }[]
```

---

## `param<T>()` — Caller-Provided Parameter

Value provided at call site, validated at compile time.

```typescript
const findByEmail = sql`
  SELECT ${row(Account.$$)} FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email')}
`;

await findByEmail.postgres.all({ db: pool, params: { email: 'jane@example.com' } });
//                                                   ^^^^^^ type-checked
```

---

## `ctx<T>()` — Pipeline Context Value

Injected server-side from the execution context. Never sent from the client.

```typescript
const myOrders = sql`
  SELECT ${row(Order.$$)} FROM ${Order}
  WHERE ${Order.$accountId} = ${ctx<{ userId: string }>('userId')}
`.authorize('user');
```

---

## `expand()` — Dynamic IN Lists

Expands an array parameter into `($1, $2, $3, ...)`.

```typescript
const findByIds = sql`
  SELECT ${row(Account.$$)} FROM ${Account}
  WHERE ${Account.$accountId} IN ${expand<{ ids: string[] }>('ids')}
`;

await findByIds.postgres.all({ db: pool, params: { ids: ['a', 'b', 'c'] } });
```

---

## `jsonMany()` / `jsonOne()` — Nested JSON

Embed a subquery as a nested array or object in the result.

```typescript
import { jsonMany, jsonOne } from '@vexnor/postgres';

const AccountOrders = sql`
  SELECT ${row(Order.$orderId, Order.$status)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
`;

sql`SELECT ${row(Account.$$)}, ${jsonMany(AccountOrders).as('orders')}
    FROM ${Account} ${jsonMany(AccountOrders)}`
// result: { ...account, orders: { orderId: string; status: string }[] }[]
```

---

## Table Alias — `.as('alias')`

Use `.as()` on a **table** (not column) when you need the same table multiple times:

```typescript
const Parent = Account.as('parent');
const Child = Account.as('child');

sql`SELECT ${row(Parent.$email.as('parentEmail'), Child.$email.as('childEmail'))}
    FROM ${Parent}
    JOIN ${Child} ON ${Child.$parentId} = ${Parent.$accountId}`
```

Also works as a tagged template: `Account.as\`parent\``

---

## `val` — Typed Value Expression

Wraps a raw SQL expression with a type:

```typescript
val`${anchor.$depth} + 1`.as<{ depth: number }>('depth')
```

---

## `.authorize(tag)` — Query Authorization

Tags a query to require authorization. Without a registered hook, execution throws.

```typescript
const deleteAccount = sql`...`.authorize('admin');
```

---

## Execution Methods

```typescript
// All results
const rows = await query.postgres.all({ db: pool, params: { ... } });

// First result or null
const row = await query.postgres.any({ db: pool, params: { ... } });

// First result or throw
const row = await query.postgres.one({ db: pool, params: { ... } });
```

---

## CRUD Factories

```typescript
// SELECT with typed includes
Account.postgres.select({
  WHERE: sql`${Account.$status} = 'ACTIVE'`,
  includeMany: { orders: AccountOrders },
}).all({ db: pool });

// INSERT
Account.postgres.insertRows().all({
  db: pool,
  params: { rows: [{ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }] },
});

// FIND BY
Account.postgres.findBy().any({ db: pool, params: { email: 'jane@example.com' } });
```

---

## CLI — Troubleshooting Queries

### `exec init` — Scaffold config

```bash
npx vexnor exec init
```

Creates `vexnor.config.ts` and a starter `queries.vexnor.ts`.

### `exec run` — Execute any query from terminal

```bash
# Run a query and see results
npx vexnor exec run findActiveAccounts -q queries.vexnor.ts

# Dry run — print generated SQL and params without executing
npx vexnor exec run findActiveAccounts -q queries.vexnor.ts --dry-run

# Output as formatted table
npx vexnor exec run findActiveAccounts -q queries.vexnor.ts --format table

# Provide context values for ctx() params
npx vexnor exec run selectMyOrders -q queries.vexnor.ts --context userId=abc123

# Limit results
npx vexnor exec run findActiveAccounts -q queries.vexnor.ts --limit 5
```

### Query config file (`queries.vexnor.ts`)

```typescript
import { defineQueryConfig } from 'vexnor/config';
import { findActiveAccounts, selectMyOrders } from './src/queries.js';

export default defineQueryConfig({
  queries: {
    findActiveAccounts,
    selectMyOrders,
  },
});
```

Use `--dry-run` to inspect the exact SQL and parameter positions without hitting the database — invaluable for debugging type mismatches or unexpected query shapes.

---

## Subquery Composition Pattern

```typescript
// 1. Define reusable subquery (correlates via .out)
const AccountOrders = sql`
  SELECT ${row(Order.$orderId, Order.$status, Order.$createdAt)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
  ORDER BY ${Order.$createdAt} DESC
`;

// 2. Compose into parent query
const result = await sql`
  SELECT ${row(Account.$accountId, Account.$email)},
         ${jsonMany(AccountOrders).as('orders')}
  FROM ${Account} ${jsonMany(AccountOrders)}
  WHERE ${Account.$status} = 'ACTIVE'
`.postgres.all({ db: pool });
// { accountId: string; email: string; orders: { orderId: string; status: string; createdAt: Date }[] }[]
```

---

## Common Patterns

### Disambiguate columns from two tables

```typescript
row(
  Account.$accountId,
  Account.$email,
  Order.$createdAt.as('orderDate')  // rename to avoid clash with Account.$createdAt
)
```

### Aggregate with col<T>()

```typescript
sql`SELECT ${row(Account.$accountId)},
    count(*) as ${col<{ count: number }>('count')}
FROM ${Account}
GROUP BY ${Account.$accountId}`
```

### Correlated subquery with .out

```typescript
const unreadCount = sql`
  SELECT count(*) as ${col<{ unread: number }>('unread')}
  FROM ${Notification}
  WHERE ${Notification.$accountId} = ${Account.out.$accountId}
    AND ${Notification.$readAt} IS NULL
`;
```
