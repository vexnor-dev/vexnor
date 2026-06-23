# Queries

## Subqueries

A `sql` query is a first-class object — it can be embedded in another `sql` tag directly.

### Subquery in FROM

```typescript
const ActiveAccounts = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$status} = 'ACTIVE'
`;

const result = await sql`
  SELECT ${row(ActiveAccounts.$accountId, ActiveAccounts.$email)}
  FROM ${ActiveAccounts}
  WHERE ${ActiveAccounts.$email} LIKE '%@example.com'
`.postgres.all({ db: pool });
// result: { accountId: string; email: string }[]
```

### Subquery in WHERE

```typescript
const result = await sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} IN (
    SELECT ${Order.$accountId} FROM ${Order}
  )
`.postgres.all({ db: pool });
```

### EXISTS

```typescript
const result = await sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE EXISTS (
    SELECT 1 FROM ${Order}
    WHERE ${Order.$accountId} = ${Account.$accountId}
  )
`.postgres.all({ db: pool });
```

### Accessing Subquery Columns

Columns from a subquery are accessible via `.row.$columnName` and can be passed to `row()` in a parent query:

```typescript
const sub = sql`
  SELECT ${row(Account.$accountId, Account.$email)}
  FROM ${Account}
`;

const query = sql`
  SELECT ${row(sub.row.$accountId, sub.row.$email)}
  FROM ${sub}
  ORDER BY ${sub.row.$email}
`;
```

### `out` — Referencing a Query Without Re-expanding

Use `.out` to reference a query's output columns without inlining it as a subquery. This is used for correlating a subquery to a parent table:

```typescript
const OrderItems = sql`
  SELECT ${row(OrderItem.$$)}
  FROM ${OrderItem}
  WHERE ${OrderItem.$orderId} = ${Order.out.$orderId}
`;
```

`Order.out.$orderId` emits just the column reference — it does not re-render the `Order` query.

---

## CTEs

Place a subquery after `WITH` — Vexnor renders it as `name AS (...)`. Reference it in `FROM` and it renders as just the name.

```typescript
const ActiveAccounts = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$status} = 'ACTIVE'
`;

const result = await sql`
  WITH ${ActiveAccounts}
  SELECT ${row(ActiveAccounts.$$)}
  FROM ${ActiveAccounts}
  WHERE ${ActiveAccounts.$email} LIKE '%@example.com'
`.postgres.all({ db: pool });
```

### Multiple CTEs

```typescript
const ActiveAccounts = sql`...`;
const AccountOrders = sql`...`;

const result = await sql`
  WITH ${ActiveAccounts}, ${AccountOrders}
  SELECT ${row(ActiveAccounts.$accountId)},
         count(${AccountOrders.$orderId}) as ${col<{ orderCount: number }>('orderCount')}
  FROM ${ActiveAccounts}
  JOIN ${AccountOrders} ON ${AccountOrders.$accountId} = ${ActiveAccounts.$accountId}
  GROUP BY ${ActiveAccounts.$accountId}
`.postgres.all({ db: pool });
```

---

## Recursive CTEs

Use `anchor.out` inside the recursive branch to reference the CTE by name rather than re-expanding it as a subquery.

```typescript
const anchor = sql`
  SELECT ${row(Account.$$)}, 0 as ${col<{ depth: number }>('depth')}
  FROM ${Account}
  WHERE ${Account.$parentId} IS NULL
`;

const hierarchy = sql`
  ${anchor} UNION ALL
  SELECT ${row(Account.as('b').$$)},
         ${anchor.out.$depth} + 1 as ${col<{ depth: number }>('depth')}
  FROM ${Account.as('b')}
  JOIN ${anchor.out} ON ${anchor.out.$accountId} = ${Account.as('b').$parentId}
`;

const result = await sql`
  WITH RECURSIVE ${hierarchy}
  SELECT ${row(hierarchy.$$)}
  FROM ${hierarchy}
  ORDER BY ${hierarchy.$depth}, ${hierarchy.$email}
`.postgres.all({ db: pool });
// result: (IAccountSelect & { depth: number })[]
```

---

## UNION / UNION ALL

Combine queries using SQL `UNION` or `UNION ALL`:

```typescript
const activeAccounts = sql`
  SELECT ${row(Account.$accountId, Account.$email)}
  FROM ${Account}
  WHERE ${Account.$status} = 'ACTIVE'
`;

const inactiveAccounts = sql`
  SELECT ${row(Account.$accountId, Account.$email)}
  FROM ${Account}
  WHERE ${Account.$status} = 'INACTIVE'
`;

const allAccounts = sql`
  ${activeAccounts}
  UNION ALL
  ${inactiveAccounts}
`;

const result = await allAccounts.postgres.all({ db: pool });
// result: { accountId: string; email: string }[]
```

---

## Table Aliases

Use `.as(alias)` to reference the same table multiple times in a query:

```typescript
const Parent = Account.as('parent');
const Child = Account.as('child');

const result = await sql`
  SELECT ${row(Parent.$accountId, Parent.$email,
               Child.$accountId.as('childId'), Child.$email.as('childEmail'))}
  FROM ${Parent}
  JOIN ${Child} ON ${Child.$parentId} = ${Parent.$accountId}
`.postgres.all({ db: pool });
// result: { accountId: string; email: string; childId: string; childEmail: string }[]
```

### Self-Joins

The same pattern works for self-joins of any depth:

```typescript
const Manager = Account.as('manager');
const Employee = Account.as('employee');

const result = await sql`
  SELECT ${row(
    Employee.$email.as('employeeEmail'),
    Manager.$email.as('managerEmail')
  )}
  FROM ${Employee}
  LEFT JOIN ${Manager} ON ${Manager.$accountId} = ${Employee.$managerId}
`.postgres.all({ db: pool });
```

---

## Aliased Columns

Use `.as(name)` on a column to rename it in the output:

```typescript
const result = await sql`
  SELECT ${row(
    Account.$accountId.as('id'),
    Account.$email.as('emailAddress')
  )}
  FROM ${Account}
`.postgres.all({ db: pool });
// result: { id: string; emailAddress: string }[]
```

---

## Custom Typed Columns with `col<T>()`

Use `col<T>()` to introduce a typed column for expressions that are not table columns (aggregates, functions, computed values):

```typescript
import { col } from 'vexnor';

const result = await sql`
  SELECT ${row(Account.$accountId)},
         count(*) as ${col<{ total: number }>('total')},
         max(${Order.$createdAt}) as ${col<{ lastOrder: Date }>('lastOrder')}
  FROM ${Account}
  JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}
  GROUP BY ${Account.$accountId}
`.postgres.all({ db: pool });
// result: { accountId: string; total: number; lastOrder: Date }[]
```

---

## Window Functions

Use `col<T>` to type the result of window function expressions:

```typescript
const result = await sql`
  SELECT
    ${row(Order.$orderId, Order.$accountId, Order.$createdAt)},
    row_number() over (
      partition by ${Order.$accountId}
      order by ${Order.$createdAt}
    ) as ${col<{ rn: number }>('rn')}
  FROM ${Order}
  ORDER BY ${Order.$accountId}, rn
`.postgres.all({ db: pool });
// result: { orderId: string; accountId: string; createdAt: Date; rn: number }[]
```

### Ranking / DENSE_RANK

```typescript
const result = await sql`
  SELECT
    ${row(Order.$orderId, Order.$accountId, Order.$totalAmount)},
    dense_rank() over (
      partition by ${Order.$accountId}
      order by ${Order.$totalAmount} desc
    ) as ${col<{ rank: number }>('rank')}
  FROM ${Order}
`.postgres.all({ db: pool });
```

---

## JSON Aggregation (`jsonMany` / `jsonOne`)

Each driver package exports `jsonMany` and `jsonOne` to embed related rows as typed JSON arrays or objects:

```typescript
import { jsonMany, jsonOne } from '@vexnor/postgres';

const OrderItems = sql`
  SELECT ${row(OrderItem.$$)}
  FROM ${OrderItem}
  WHERE ${OrderItem.$orderId} = ${Order.out.$orderId}
`;

const result = await sql`
  SELECT ${row(Order.$orderId, Order.$status)},
         ${jsonMany(OrderItems).as('items')}
  FROM ${Order} ${jsonMany(OrderItems)}
`.postgres.all({ db: pool });
// result: { orderId: string; status: string; items: IOrderItemSelect[] }[]
```

`jsonMany` → `T[]` (empty array when no matches).  
`jsonOne` → `T | null` (null when no match).

See [Databases](databases.md) for how each driver implements JSON aggregation.

---

## Query Labeling with `info()`

Use `info()` to attach a label to a query. The label appears as a SQL comment and is used as the CTE name when the query is used in a `WITH` clause.

```typescript
import { info } from 'vexnor';

const ActiveAccounts = sql`
  ${info({ label: 'ActiveAccounts' })}
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$status} = 'ACTIVE'
`;
```

Useful for identifying queries in database logs and query plans.

---

## Inline Rendering with `.inline()`

Force a query to render inline (without wrapping in a subquery or CTE):

```typescript
const whereClause = sql`${Account.$status} = 'ACTIVE' AND ${Account.$email} IS NOT NULL`;

const result = await sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${whereClause.inline()}
`.postgres.all({ db: pool });
```

---

## Rendering Control with `.render()`

Control the SQL format when a query is embedded:

```typescript
const subquery = sql`
  SELECT ${row(Account.$accountId)}
  FROM ${Account}
  WHERE ${Account.$status} = 'ACTIVE'
`;

// Force rendering as a CTE
const result = await sql`
  WITH ${subquery.render('with')}
  SELECT ${row(subquery.$$)}
  FROM ${subquery}
`.postgres.all({ db: pool });
```

---

## Getting Raw SQL with `getSql()`

Extract the compiled SQL text and parameter values without executing:

```typescript
const query = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
`;

const { text, values } = query.getSql({ params: { accountId: '123' } });
// text: "SELECT ... FROM account WHERE account.account_id = $1"
// values: ['123']
```

Useful for debugging, logging, and the CLI `--dry-run` mode.

---

## Query Composition Patterns

### Reusable Fragments

```typescript
const ActiveFilter = sql`${Account.$status} = ${AccountStatusUdt.ACTIVE}`;

const findActiveByEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${ActiveFilter.inline()} AND ${Account.$email} = ${param<{ email: string }>('email')}
`;
```

### Building Queries from Shared Subqueries

Subqueries are composable objects — use the same subquery in multiple parent queries:

```typescript
const OrderItems = sql`
  SELECT ${row(OrderItem.$$)}
  FROM ${OrderItem}
  WHERE ${OrderItem.$orderId} = ${Order.out.$orderId}
`;

// Used as a lateral join in select()
const ordersWithItems = Account.postgres.select({
  includeMany: { orders: sql`
    SELECT ${row(Order.$$)}, ${jsonMany(OrderItems).as('items')}
    FROM ${Order} ${jsonMany(OrderItems)}
    WHERE ${Order.$accountId} = ${Account.out.$accountId}
  ` },
});

// Also usable directly
const singleOrder = sql`
  SELECT ${row(Order.$$)}, ${jsonMany(OrderItems).as('items')}
  FROM ${Order} ${jsonMany(OrderItems)}
  WHERE ${Order.$orderId} = ${param<{ orderId: string }>('orderId')}
`;
```

---

## Authorization

Tag a query with `.authorize()` to require authorization before execution:

```typescript
const deleteAccount = sql`
  DELETE FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
`.authorize('admin');
```

See [Authorization](authorization.md) for hooks, audit logging, and compliance.

---

## Execution Methods

All queries share four execution methods:

| Method | Returns | Throws if empty |
|--------|---------|-----------------|
| `.one({ db, params? })` | `T` | yes |
| `.any({ db, params? })` | `T \| null` | no |
| `.all({ db, params? })` | `T[]` | no |
| `.run({ db, params? })` | void | no |

```typescript
// Direct execution
const accounts = await findActiveAccounts.postgres.all({ db: pool });

// Remote execution (same API)
const accounts = await findActiveAccounts.postgres.all({ db: remoteClient });
```

See [Isomorphic SQL](isomorphic-sql.md) for remote execution patterns.

---

## Run Options

Pass `options` to control timeout and retry behavior:

```typescript
const result = await findAccounts.postgres.all({
  db: pool,
  params: { status: 'ACTIVE' },
  options: {
    timeout: 5000, // abort after 5s
    retry: {
      maxAttempts: 3,
      delayMs: 100,
      shouldRetry: ({ error }) => error instanceof SqlRunError && error.retryable,
    },
  },
});
```

| Option | Type | Description |
|--------|------|-------------|
| `timeout` | `number` | Abort after this many ms; throws `SqlRunError` with code `QUERY_TIMEOUT` |
| `retryable` | `"default" \| true \| false` | Override automatic retryable detection |
| `retry` | `SqlRetryOptions \| false` | Retry policy (see below) |

### `SqlRetryOptions`

| Field | Type | Default |
|-------|------|---------|
| `maxAttempts` | `number` | `1` (no retry) |
| `delayMs` | `number \| (args) => number` | `0` |
| `shouldRetry` | `(args) => boolean` | Retries only `SqlRunError` with `retryable: true` |

## `val` — Computed Subquery Columns

`val` creates a named, typed column from an inline SQL expression or an existing subquery. Use it when `col` isn't enough — when the expression is multi-token or wraps a subquery.

```typescript
import { sql, row, val } from 'vexnor';

// Inline expression
const query = sql`
  SELECT ${row(Account.$accountId)},
         ${val`COALESCE(${Account.$notes}, 'N/A')`.as<{ notes: string }>('notes')}
  FROM ${Account}
`;
// result: { accountId: string; notes: string }

// Wrapping an existing subquery
const OrderCount = sql`SELECT count(*) FROM ${Order} WHERE ${Order.$accountId} = ${Account.out.$accountId}`;

const query2 = sql`
  SELECT ${row(Account.$accountId, Account.$email)},
         ${val(OrderCount).as<{ orderCount: number }>('orderCount')}
  FROM ${Account}
`;
// result: { accountId: string; email: string; orderCount: number }
```

## `excluded(table)` — Upsert EXCLUDED References

For manual `ON CONFLICT ... DO UPDATE SET` statements, `excluded(table)` gives you typed column references to the `EXCLUDED` pseudo-table:

```typescript
import { sql, row, excluded } from 'vexnor';

const upsert = sql`
  INSERT INTO ${Account}
    ${Account.insertColsVals({ accountId: id, email, firstName })}
  ON CONFLICT (${Account.$accountId}) DO UPDATE SET
    ${Account.$email} = ${excluded(Account).$email},
    ${Account.$firstName} = ${excluded(Account).$firstName}
  RETURNING ${row(Account.$$)}
`;
```

`excluded(Account).$email` emits `EXCLUDED."email"` in the SQL output. The result is cached per table.

## `DEFAULT` — SQL DEFAULT Keyword

Use `DEFAULT` in insert or update values to explicitly apply a column's database default:

```typescript
import { sql, DEFAULT } from 'vexnor';

const insert = sql`
  INSERT INTO ${Account}
    ${Account.insertColsVals({
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      createdAt: DEFAULT,   // uses the column's database default (e.g. NOW())
      modifiedAt: DEFAULT,
    })}
  RETURNING ${row(Account.$$)}
`;
```

## `info()` — Query Metadata

Attach a label and metadata to a query for debugging, audit logging, and telemetry:

```typescript
import { sql, row, info } from 'vexnor';

const findActiveAccounts = sql`
  ${info({ label: 'findActiveAccounts' })}
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$status} = 'ACTIVE'
`;
```

The label appears in:
- Error messages (`SqlRunError.queryName`)
- Audit log entries (`AuditLogPlugin` `onLog` callback)
- OpenTelemetry span names
- Pipeline execution args (`args.name`)

Options:
- `label: string` — human-readable query name
- `driver: string` — restrict to a specific plugin driver (rarely needed)

## Dynamic Column Expansion

For CRUD factories that build INSERT/UPDATE SQL dynamically from runtime params, vexnor provides expansion helpers:

### `expandInsertColumns(table)` / `expandInsertValues(table)`

Build the column list and VALUES clause from a `{ rows: [...] }` param at execution time:

```typescript
import { sql, row, expandInsertColumns, expandInsertValues } from 'vexnor';

const insertAccounts = sql`
  INSERT INTO ${Account} (${expandInsertColumns(Account)})
  VALUES ${expandInsertValues(Account)}
  RETURNING ${row(Account.$$)}
`;

// At execution time, columns and values are derived from the rows param
await insertAccounts.postgres.all({
  db: pool,
  params: { rows: [{ email: 'a@b.com', firstName: 'Alice' }] },
});
```

### `buildUpdateSetExpand(table)`

Build the `SET col = ?, col = ?` clause from a `{ set: {...} }` param at execution time:

```typescript
import { sql, row, buildUpdateSetExpand, param } from 'vexnor';

const updateAccount = sql`
  UPDATE ${Account}
  ${buildUpdateSetExpand(Account)}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
  RETURNING ${row(Account.$$)}
`;

await updateAccount.postgres.one({
  db: pool,
  params: { accountId: '...', set: { firstName: 'Jane', email: 'jane@new.com' } },
});
```

---

## `when()` — Conditional SQL Fragments

Include or exclude a SQL fragment based on a parameter's presence. The condition is evaluated at build time — only the matching branch is emitted into the final SQL.

A value is considered **present** if it is not `null`, `undefined`, or `false`. Notably, `0` and `""` (empty string) are treated as **truthy** — they count as present values.

Fully serializable for cross-stack execution (the manifest stores both branches and the condition).

### Basic Usage

```typescript
type P = { status: string; hasEmail: boolean; email: string };

const query = sql`
  SELECT ${row(Account.$$)} FROM ${Account}
  WHERE ${Account.$status} = ${param<P>('status')}
  ${when<P>('hasEmail', sql`AND ${Account.$email} = ${param<P>('email')}`)}
`;

// hasEmail: true  → AND "email" = $2
// hasEmail: false → (nothing)
```

### Negation — `"!"` Prefix

Prefix the param name with `"!"` to negate the condition — the `onTrue` branch is included when the param is **absent** (null, undefined, or false):

```typescript
// Include when hasEmail is absent (null/undefined/false)
${when<P>('!hasEmail', sql`AND ${Account.$email} IS NULL`)}

// hasEmail: false/null/undefined → AND "email" IS NULL
// hasEmail: true  → (nothing)
```

### Else Branch (`onFalse`)

Pass a second SQL fragment for the absent case:

```typescript
${when<P>('sortAsc', sql`ASC`, sql`DESC`)}

// sortAsc: present (not null/undefined/false) → ASC
// sortAsc: absent (null/undefined/false)      → DESC
```

With negation:

```typescript
${when<P>('!isAdmin', sql`AND "tier" = 'basic'`, sql`AND "tier" = 'admin'`)}

// isAdmin: present → AND "tier" = 'admin' (onFalse, because negated + present = false)
// isAdmin: absent  → AND "tier" = 'basic' (onTrue, because negated + absent = true)
```

### Type Safety

The `flag` parameter must be a key of the params type. The value is considered present if not `null`, `undefined`, or `false` — this means `0` and `""` are truthy. Invalid keys produce compile errors:

```typescript
type P = { status: string; hasEmail: boolean };

when<P>('hasEmail', ...)   // ✓ valid key
when<P>('!hasEmail', ...)  // ✓ negated valid key
when<P>('status', ...)     // ✓ valid key — present when not null/undefined/false
when<P>('badKey', ...)     // ✗ compile error — not in P
```

### Serialization (Cross-Stack)

The manifest includes a `negate` field:

```json
{
  "type": "when",
  "param": "hasEmail",
  "negate": true,
  "onTrue": [...],
  "onFalse": [...]
}
```

Any stack reads `negate` and flips the boolean evaluation accordingly.
