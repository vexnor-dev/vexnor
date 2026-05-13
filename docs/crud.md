# CRUD Query Factories

Generated tables expose typed query factories on the plugin property (`.postgres`, `.mssql`, `.sqlite`). Each factory returns a typed `SqlQuery` — executed via the same execution methods as any other query.

## Execution Methods

All queries share four execution methods:

| Method | Returns | Throws if empty |
|--------|---------|-----------------|\
| `.one({ db, params? })` | `T` | yes |
| `.any({ db, params? })` | `T \| null` | no |
| `.all({ db, params? })` | `T[]` | no |
| `.run({ db, params? })` | void | no |

## `findById()`

Returns a query parameterized by the table's primary key fields.

```typescript
const account = await Account.postgres.findById().any({
  db: pool,
  params: { accountId: '00000000-0000-0000-0000-000000000001' },
});
// account: IAccountSelect | null
```

## `findBy()`

Returns a query parameterized by any subset of columns.

```typescript
const account = await Account.postgres.findBy().any({
  db: pool,
  params: { email: 'jane@example.com' },
});
// account: IAccountSelect | null
```

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

Available clauses: `SELECT`, `WHERE`, `JOIN`, `GROUP_BY`, `HAVING`, `ORDER_BY`, `limit`, `offset`.

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

## `insertFrom()`

INSERT from a SELECT subquery with optional WHERE/JOIN clauses.

```typescript
const result = await Account.postgres.insertFrom({
  WHERE: sql`${Account.$status} = 'PENDING'`,
}).all({ db: pool });
```

## `update()`

Typed UPDATE with WHERE and optional JOIN clauses.

```typescript
const updated = await Account.postgres.update({
  WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>('accountId')}`,
}).all({
  db: pool,
  params: { accountId: '00000000-0000-0000-0000-000000000001' },
});
// updated: IAccountSelect[]
```

## `delete()`

Typed DELETE with WHERE clause.

```typescript
await Account.postgres.delete({
  WHERE: sql`${Account.$status} = 'INACTIVE'`,
}).run({ db: pool });
```

## `upsert()` (PostgreSQL / MS SQL Server)

INSERT with conflict resolution.

```typescript
const result = await Account.postgres.upsert({
  onConflict: sql`(${Account.$email}) DO UPDATE SET ${Account.updateSet({ status: 'ACTIVE' })}`,
}).all({
  db: pool,
  params: {
    rows: [{ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }],
  },
});
```

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
