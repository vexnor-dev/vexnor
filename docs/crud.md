# CRUD Query Factories

Generated tables expose typed query factories on the plugin property (`.postgres`, `.mssql`, `.sqlite`). Each factory returns a typed `SqlQuery` — executed via the same execution methods as any other query.

## Execution Methods

All queries share four execution methods:

| Method | Returns | Throws if empty |
|--------|---------|-----------------|| `.one({ db, params? })` | `T` | yes |
| `.any({ db, params? })` | `T \| null` | no |
| `.all({ db, params? })` | `T[]` | no |
| `.run({ db, params? })` | void | no |

---

## `findById()`

Returns a query parameterized by the table's primary key fields.

```typescript
const account = await Account.postgres.findById().any({
  db: pool,
  params: { accountId: '00000000-0000-0000-0000-000000000001' },
});
// account: IAccountSelect | null
```

For composite primary keys, pass all key columns:

```typescript
const item = await OrderItem.postgres.findById().any({
  db: pool,
  params: { orderId: '...', productId: '...' },
});
```

---

## `findBy()`

Returns a query parameterized by any subset of columns. All provided columns are ANDed in the WHERE clause.

```typescript
const account = await Account.postgres.findBy().any({
  db: pool,
  params: { email: 'jane@example.com' },
});
// account: IAccountSelect | null
```

Multiple columns:

```typescript
const account = await Account.postgres.findBy().any({
  db: pool,
  params: { email: 'jane@example.com', status: 'ACTIVE' },
});
```

Use `.all()` to get all matching rows:

```typescript
const accounts = await Account.postgres.findBy().all({
  db: pool,
  params: { status: 'ACTIVE' },
});
// accounts: IAccountSelect[]
```

---

## `select()`

Full SELECT with optional clauses.

```typescript
const accounts = await Account.postgres.select({
  WHERE: sql`${Account.$status} = 'ACTIVE'`,
  ORDER_BY: sql`${Account.$createdAt} DESC`,
  limit: param<{ limit: number }>('limit'),
  offset: param<{ offset: number }>('offset'),
}).all({
  db: pool,
  params: { limit: 20, offset: 0 },
});
```

### Available Clauses

| Clause | Type | Description |
|--------|------|-------------|
| `SELECT` | `SqlQueryBaseAny` | Override default `SELECT *` with custom columns |
| `WHERE` | `SqlQueryBaseAny` | Filter condition (without `WHERE` keyword) |
| `JOIN` | `SqlQueryBaseAny` | One or more JOIN clauses (must include `JOIN` keyword) |
| `GROUP_BY` | `SqlQueryBaseAny` | Grouping (without `GROUP BY` keyword) |
| `HAVING` | `SqlQueryBaseAny` | Group filter (without `HAVING` keyword) |
| `ORDER_BY` | `SqlQueryBaseAny` | Sort order (without `ORDER BY` keyword) |
| `limit` | `SqlParam` | Pagination limit |
| `offset` | `SqlParam` | Pagination offset |
| `includeMany` | `Record<string, SqlQueryBaseAny>` | Attach related rows as JSON arrays |
| `includeOne` | `Record<string, SqlQueryBaseAny>` | Attach a related row as JSON object |

### Custom SELECT Columns

```typescript
const accounts = await Account.postgres.select({
  SELECT: sql`${row(Account.$accountId, Account.$email)}`,
  WHERE: sql`${Account.$status} = 'ACTIVE'`,
}).all({ db: pool });
// accounts: { accountId: string; email: string }[]
```

### JOIN

```typescript
const results = await Account.postgres.select({
  JOIN: sql`JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}`,
  GROUP_BY: sql`${Account.$accountId}`,
}).all({ db: pool });
```

### Pagination

```typescript
const accounts = await Account.postgres.select({
  ORDER_BY: sql`${Account.$createdAt} DESC`,
  limit: param<{ limit: number }>('limit'),
  offset: param<{ offset: number }>('offset'),
}).all({
  db: pool,
  params: { limit: 20, offset: 40 },
});
```

### `includeMany` and `includeOne`

Attach related rows as typed JSON arrays or objects using lateral joins — no manual SQL needed. Pass any `sql` subquery.

```typescript
const AccountOrders = sql`
  SELECT ${row(Order.$orderId, Order.$status, Order.$createdAt)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
  ORDER BY ${Order.$createdAt} DESC
  LIMIT ${param<{ limit: number }>('limit')}
`;

const accounts = await Account.postgres.select({
  WHERE: sql`${Account.$status} = 'ACTIVE'`,
  includeMany: { orders: AccountOrders },
  includeOne: { lastOrder: AccountOrders },
}).all({
  db: pool,
  params: { limit: 5 },
});
// (IAccountSelect & {
//   orders: { orderId: string; status: string; createdAt: Date }[];
//   lastOrder: { orderId: string; status: string; createdAt: Date } | null;
// })[]
```

`includeMany` → `T[]`, `includeOne` → `T | null`. The key name becomes the result property.

---

## `insertRows()`

Typed multi-row INSERT returning all inserted rows.

```typescript
const inserted = await Account.postgres.insertRows().all({
  db: pool,
  params: {
    rows: [
      { email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' },
      { email: 'john@example.com', firstName: 'John', lastName: 'Smith' },
    ],
  },
});
// inserted: IAccountSelect[]
```

The `rows` param type is derived from the table's `Insert` type — only non-generated, non-defaulted columns are required. Columns with defaults (e.g. `createdAt`, auto-generated PKs) are optional.

---

## `insertFrom()`

INSERT from a SELECT subquery. The subquery's row type must match the table's `Insert` type.

```typescript
const sourceQuery = sql`
  SELECT ${row(StagingAccount.$email, StagingAccount.$firstName, StagingAccount.$lastName)}
  FROM ${StagingAccount}
  WHERE ${StagingAccount.$status} = 'READY'
`;

const result = await Account.postgres.insertFrom({ FROM: sourceQuery }).all({ db: pool });
// result: IAccountSelect[]
```

---

## `update()`

Typed UPDATE. The columns to update are passed as `set` in `params` at execution time.

```typescript
const updated = await Account.postgres.update({
  WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>('accountId')}`,
}).all({
  db: pool,
  params: {
    set: { status: 'CONFIRMED' },
    accountId: '00000000-0000-0000-0000-000000000001',
  },
});
// updated: IAccountSelect[]
```

The `set` type is the table's `Update` type — all columns are optional (you only set what you need to change):

```typescript
const updated = await Account.postgres.update({
  WHERE: sql`${Account.$status} = 'PENDING'`,
}).all({
  db: pool,
  params: {
    set: { status: 'ACTIVE', confirmedAt: new Date() },
  },
});
```

---

## `delete()`

Typed DELETE. Requires either a `WHERE` clause or `{ force: true }` for a full-table delete.

```typescript
// Filtered delete
await Account.postgres.delete({
  WHERE: sql`${Account.$status} = 'INACTIVE'`,
}).run({ db: pool });

// Full-table delete — force: true required to prevent accidents
await Account.postgres.delete({ force: true }).run({ db: pool });
```

The `force: true` guard prevents accidental unfiltered deletes — you cannot pass an empty `WHERE`.

---

## `upsert()` (PostgreSQL / MS SQL Server / SQLite)

INSERT with conflict resolution. The API differs per database.

**PostgreSQL** — uses `ON CONFLICT DO UPDATE`:

```typescript
const result = await Account.postgres.upsert({
  CONFLICT_ON: [Account.$email],
  // SET is optional — defaults to updating all non-conflict columns with EXCLUDED values
}).all({
  db: pool,
  params: { rows: [{ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }] },
});
// result: IAccountSelect[]
```

**MS SQL Server** — uses `MERGE`:

```typescript
const result = await Account.mssql.upsert({
  MERGE_ON: [Account.$email],
  // SET is optional — defaults to updating all non-merge columns from the source
}).all({
  db: pool,
  params: { rows: [{ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }] },
});
```

**SQLite** — uses `ON CONFLICT DO UPDATE`:

```typescript
const result = await Account.sqlite.upsert({
  CONFLICT_ON: [Account.$email],
}).all({
  db,
  params: { rows: [{ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }] },
});
```

---

## Raw SQL with `insertColsVals` and `updateSet`

For full control, use the table helpers directly in a `sql` tag:

```typescript
// INSERT
const account = await sql`
  INSERT INTO ${Account}
    ${Account.insertColsVals({ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' })}
  RETURNING ${row(Account.$$)}
`.postgres.one({ db: pool });

// UPDATE
const updated = await sql`
  UPDATE ${Account}
  SET ${Account.updateSet({ status: 'CONFIRMED' })}
  WHERE ${Account.$accountId} = ${accountId}
  RETURNING ${row(Account.$$)}
`.postgres.one({ db: pool });
```

---

## Type Inference

All CRUD factories infer their result type from the table's generated types:

- `IAccountSelect` — the full row type (all columns as they come from SELECT)
- `IAccountInsert` — the insert type (required columns + optional defaults)
- `IAccountUpdate` — the update type (all columns optional)

When using `select()` with custom `SELECT` or `includeMany`/`includeOne`, the result type is composed from exactly what you selected:

```typescript
const result = await Account.postgres.select({
  SELECT: sql`${row(Account.$accountId, Account.$email)}`,
  includeMany: { orders: OrderSubquery },
}).all({ db: pool });
// result: { accountId: string; email: string; orders: { orderId: string; ... }[] }[]
```

---

## Cross-Reference

- [Queries](queries.md) — composing subqueries, CTEs, JSON aggregation
- [Params](params.md) — `param()`, `expand()`, runtime validation
- [Transactions](transactions.md) — using CRUD queries within transactions
- [Databases](databases.md) — per-driver dialect notes
