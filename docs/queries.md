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

## Table Aliases

Use `.as(alias)` to reference the same table multiple times in a query:

```typescript
const Parent = Account.as('parent');
const Child = Account.as('child');

const result = await sql`
  SELECT ${row(Parent.$accountId, Parent.$email)},
         ${row(Child.$accountId.as('childId'), Child.$email.as('childEmail'))}
  FROM ${Parent}
  JOIN ${Child} ON ${Child.$parentId} = ${Parent.$accountId}
`.postgres.all({ db: pool });
```

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
