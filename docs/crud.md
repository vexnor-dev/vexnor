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

## Runtime Filter (`params.filterBy`)

Every `select()` query automatically accepts a `filterBy` param at runtime — no compile-time changes needed. This enables AI agents and dynamic UIs to filter by any column subset, using any operator, without pre-defining the query for each combination.

### Basic Syntax

The filter is an **array of condition objects**. Entries are AND'd together:

```typescript
const accounts = await Account.postgres.select({}).all({
  db: pool,
  params: {
    filterBy: [
      { status: "active" },
      { email: ["like", "%@example.com"] },
    ]
  }
});
// → WHERE "status" = $1 AND "email" LIKE $2
```

### Backwards Compatible Object Form

The legacy object form still works — all keys are equality-checked and AND'd:

```typescript
params: {
  filterBy: { email: "jane@example.com", status: "active" }
}
// → WHERE "email" = $1 AND "status" = $2
```

### Operators

Each condition value is either a **bare value** (equality) or a **tuple** `[operator, ...args]`:

| Operator | Tuple Form | SQL Output |
|----------|-----------|------------|
| *(bare value)* | `{ col: value }` | `"col" = $1` |
| `=` | `["=", value]` | `"col" = $1` |
| `not` | `["not", value]` | `"col" <> $1` |
| `!=` | `["!=", value]` | `"col" <> $1` |
| `>` | `[">", value]` | `"col" > $1` |
| `>=` | `[">=", value]` | `"col" >= $1` |
| `<` | `["<", value]` | `"col" < $1` |
| `<=` | `["<=", value]` | `"col" <= $1` |
| `between` | `["between", low, high]` | `"col" BETWEEN $1 AND $2` |
| `in` | `["in", v1, v2, ...]` | `"col" IN ($1, $2, ...)` |
| `notIn` | `["notIn", v1, v2, ...]` | `"col" NOT IN ($1, $2, ...)` |
| `like` | `["like", pattern]` | `"col" LIKE $1` |
| `notLike` | `["notLike", pattern]` | `"col" NOT LIKE $1` |
| `isNull` | `["isNull"]` | `"col" IS NULL` |
| `isNotNull` | `["isNotNull"]` | `"col" IS NOT NULL` |

### Range Filtering (Include/Exclude Edges)

- `>=` / `<=` → **include** the edge value (closed bound)
- `>` / `<` → **exclude** the edge value (open bound)

Use the same column multiple times for ranges:

```typescript
// Half-open range: >= start AND < end
params: {
  filterBy: [
    { createdAt: [">=", "2024-01-01"] },
    { createdAt: ["<", "2025-01-01"] },
  ]
}
// → WHERE "created_at" >= $1 AND "created_at" < $2

// Inclusive range with between:
params: {
  filterBy: [
    { createdAt: ["between", "2024-01-01", "2024-12-31"] },
  ]
}
// → WHERE "created_at" BETWEEN $1 AND $2
```

### OR Groups

Wrap conditions in `{ or: [...] }` to OR them. The OR group itself is AND'd with sibling conditions:

```typescript
// Simple OR
params: {
  filterBy: [
    { or: [{ status: "active" }, { status: "confirmed" }] }
  ]
}
// → WHERE ("status" = $1 OR "status" = $2)

// AND + OR combined
params: {
  filterBy: [
    { status: ["not", "deleted"] },
    { or: [
      { email: ["like", "%@vip.com"] },
      { parentId: ["isNotNull"] },
    ]}
  ]
}
// → WHERE "status" <> $1 AND ("email" LIKE $2 OR "parent_id" IS NOT NULL)
```

### Nested OR

OR groups can contain other OR groups for complex logic:

```typescript
params: {
  filterBy: [
    { or: [
      { status: "active" },
      { or: [
        { email: ["like", "%@admin%"] },
        { firstName: "Root" },
      ]},
    ]}
  ]
}
// → WHERE ("status" = $1 OR ("email" LIKE $2 OR "first_name" = $3))
```

### IN / NOT IN

```typescript
// Include specific values
params: {
  filterBy: [{ status: ["in", "active", "confirmed", "pending"] }]
}
// → WHERE "status" IN ($1, $2, $3)

// Exclude specific values
params: {
  filterBy: [{ accountId: ["notIn", "id-1", "id-2"] }]
}
// → WHERE "account_id" NOT IN ($1, $2)
```

Empty `in` emits `1 = 0` (always false). Empty `notIn` emits `1 = 1` (no-op).

### NULL Checks

```typescript
// Find root accounts (no parent)
params: {
  filterBy: [{ parentId: ["isNull"] }]
}
// → WHERE "parent_id" IS NULL

// Find child accounts (has parent)
params: {
  filterBy: [{ parentId: ["isNotNull"] }]
}
// → WHERE "parent_id" IS NOT NULL
```

### Pattern Matching

```typescript
params: {
  filterBy: [{ email: ["like", "%@example.com"] }]
}
// → WHERE "email" LIKE $1

params: {
  filterBy: [{ email: ["notLike", "%@spam.%"] }]
}
// → WHERE "email" NOT LIKE $1
```

### Combining with WHERE Clause

The `filterBy` param composes with a compile-time `WHERE` clause via AND:

```typescript
const recentAccounts = Account.postgres.select({
  WHERE: sql`${Account.$createdAt} > ${param<{ since: string }>('since')}`,
});

const accounts = await recentAccounts.all({
  db: pool,
  params: {
    since: "2024-01-01",
    filterBy: [{ status: "active" }, { email: ["like", "%@example.com"] }],
  },
});
// → WHERE "status" = $1 AND "email" LIKE $2 AND "created_at" > $3
```

### Complete Example — AI Agent Query

```typescript
// An AI agent fetches: active accounts created this year,
// excluding spam, sorted by email, page 1
const accounts = await Account.postgres.select({}).all({
  db: pool,
  params: {
    filterBy: [
      { status: ["in", "active", "confirmed"] },
      { createdAt: [">=", "2024-01-01"] },
      { createdAt: ["<", "2025-01-01"] },
      { email: ["notLike", "%@spam.%"] },
      { parentId: ["isNotNull"] },
    ],
    orderBy: { email: "ASC" },
    limit: 25,
    offset: 0,
  },
});
```

### Validation

- **Unknown columns** throw at build time: `Column not found: badColumn`
- **Invalid operators** throw at build time: `Invalid filter operator: badOp`
- **Non-primitive bare values** throw: `Filter value is not a primitive`
- All values are always **parameterized** — SQL injection is structurally impossible

### TypeScript Types

```typescript
import { FilterOp, FilterCondition, FilterConditionList } from 'vexnor';

// FilterOp: "=" | "not" | "!=" | ">" | ">=" | "<" | "<="
//         | "between" | "in" | "notIn" | "like" | "notLike" | "isNull" | "isNotNull"

// FilterCondition<T>: { [col]: value | [op, ...args] } | { or: FilterConditionList<T> }
// FilterConditionList<T>: FilterCondition<T>[]
```

### `filterBy()` — Column Restriction

Use `filterBy()` inside a `sql` tag to restrict which columns are filterable at runtime. By default, all columns are available. Use `omit` to exclude sensitive columns, or `include` to whitelist a subset:

```typescript
import { filterBy } from 'vexnor';

// Exclude sensitive columns — all other columns remain filterable
filterBy(Account, { paramName: "filterBy", omit: ["password", "internalNotes"] })

// Whitelist only specific columns — all others are excluded
filterBy(Account, { paramName: "filterBy", include: ["email", "status"] })
```

`omit` takes precedence if both are specified. Both are `keyof`-checked at compile time — typos produce a type error.

---

## Runtime Order (`orderBy`)

Use `orderBy()` inside a `sql` tag to accept a runtime sort param. The format is `{ col: dir }` where key order determines sort priority:

```typescript
import { orderBy } from 'vexnor';

const accounts = await sql`
  SELECT ${row(Account.$$)} FROM ${Account}
  ${orderBy(Account)}
`.postgres.all({
  db: pool,
  params: { orderBy: { email: "ASC", createdAt: "DESC" } },
});
// → ORDER BY "email" ASC, "created_at" DESC
```

Pass `null` or omit the param to skip ORDER BY entirely:

```typescript
params: { orderBy: null }
// → (no ORDER BY clause)
```

> **CRUD `select({})`** auto-includes `orderBy` — no compile-time declaration needed. Just pass `params.orderBy` at runtime.

---

## Runtime Pagination (`limit` / `offset`)

Every CRUD `select({})` query automatically accepts `limit` and `offset` params at runtime — no compile-time declaration needed. Simply pass them in `params`:

```typescript
const accounts = await Account.postgres.select({}).all({
  db: pool,
  params: {
    limit: 25,
    offset: 50,
  },
});
// → ... LIMIT $1 OFFSET $2
```

Both are optional. Omit either to skip it:

```typescript
params: { limit: 10 }
// → ... LIMIT $1 (no OFFSET)

params: {}
// → (no LIMIT/OFFSET clause)
```

> You do **not** need `param<{ limit: number }>('limit')` in `select({})` — pagination is built in. Only use explicit `param()` declarations for raw `sql` queries.

---

## Runtime Projection (`omit` / `include`)

Every CRUD `select({})` query accepts a `select` param for runtime column projection:

```typescript
// Return only specific columns
const accounts = await Account.postgres.select({}).all({
  db: pool,
  params: {
    select: ["accountId", "email", "status"],
  },
});
// → SELECT "account_id", "email", "status" FROM ...
```

Use aggregation functions with `[fn, col, alias]` tuples:

```typescript
params: {
  select: ["accountId", ["count", "*", "total"]],
}
// → SELECT "account_id", count(*) AS "total" FROM ... GROUP BY "account_id"
```

---

## `set()` — Runtime UPDATE Columns

Use `set()` inside a `sql` tag to accept a runtime `set` param for dynamic UPDATE columns:

```typescript
import { set } from 'vexnor';

const updateAccount = sql`
  UPDATE ${Account}
  ${set(Account)}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
  RETURNING ${row(Account.$$)}
`;

await updateAccount.postgres.one({
  db: pool,
  params: { accountId: '...', set: { firstName: 'Jane', email: 'jane@new.com' } },
});
// → UPDATE "account" SET "first_name" = $1, "email" = $2 WHERE ...
```

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
- [Params](params.md) — `param()`, runtime validation
- [Transactions](transactions.md) — using CRUD queries within transactions
- [Databases](databases.md) — per-driver dialect notes
