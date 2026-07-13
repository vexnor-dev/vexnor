# Projections (.toView)

Project a subset of columns and add window functions to any existing query — without modifying the original. The result is a new immutable query that trims the SELECT clause and appends window expressions at the SQL level.

## Developer API

### Column projection

```typescript
const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;

const slim = base.toView({ columns: ["accountId", "email"] });
// SELECT "account_id" AS "accountId", "email" FROM "account"

const results = await slim.postgres.all({ db: pool });
results[0].accountId; // string
results[0].email;     // string
results[0].status;    // ❌ type error — not in view
```

### Window functions

```typescript
const ranked = base.toView({
  columns: ["accountId", "email"],
  window: {
    rank: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } },
  },
});
// SELECT "account_id" AS "accountId", "email",
//        row_number() OVER (ORDER BY "createdAt" DESC) AS "rank"
// FROM "account"

results[0].rank; // number
```

### Window only (no column trimming)

```typescript
const withRank = base.toView({
  window: { rn: { fn: "row_number", over: { orderBy: { email: "ASC" } } } },
});
// All original columns preserved + rn appended
```

## Immutability

`.toView()` returns a **new query** — the original is never mutated:

```typescript
const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
const view = base.toView({ columns: ["accountId"] });

base.view;  // null — unchanged
view.view;  // { columns: Set(["accountId"]), windowExprs: [], ... }
```

The `view` property is readonly and exposes the active view configuration (or `null` if none).

## How it works

During SQL build:
1. `SqlQuery.write()` sets `context.viewFilter` when `this.view` is present
2. `SqlSelectRow.write()` skips columns not in `viewFilter.columns`
3. `SqlTableAll.write()` skips columns not in `viewFilter.columns`
4. `col()` tokens not in the columns list are trimmed (including their preceding SQL expression)
5. Window expressions are injected before `FROM` (or at the end if no FROM is present)

CTEs, WHERE, FROM, JOINs, ORDER BY pass through unchanged.

## AI Runtime (viewBy)

For AI agents calling queries through `QueryRegistry.execute()`, the `viewBy` field on `ExecuteQueryArgs` applies `.toView()` before execution:

```typescript
await queryRegistry.execute(
  {
    plugin: "@vexnor/postgres",
    hash: "abc123",
    params: { filterBy: [{ status: "active" }], limit: 20 },
    viewBy: { columns: ["accountId", "email"], window: { rank: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } } },
    mode: "read",
    location: null,
    name: null,
  },
  async () => pool,
);
```

The AI passes `viewBy` as a typed field alongside `params`. The registry:
1. Looks up the base query by hash
2. Calls `.toView(viewBy)` to create a projected query
3. Executes the projected query with the provided params

### fetchData tool integration

In the AI route, the `fetchData` tool extracts `viewBy` from params before calling execute:

```typescript
const viewBy = params.viewBy;
delete params.viewBy;

await queryRegistry.execute(
  { hash, plugin, params, name: null, mode: "read", location: null, viewBy },
  async () => pool,
);
```

## ViewByArgs type

```typescript
import { type ViewByArgs } from "@vexnor/core/execution";

type ViewByArgs = {
  columns?: string[];
  window?: Record<string, {
    fn: string;
    col?: string;
    args?: unknown;
    over: Record<string, unknown>;
  }>;
};
```

## col() edge case

When a query uses `col()` for computed expressions:

```typescript
const query = sql`
  SELECT ${row(Account.$accountId)}, count(*) as ${col<{ total: number }>("total")}
  FROM ${Account}
`;

const view = query.toView({ columns: ["accountId"] });
// "total" col and its preceding "count(*) as" are trimmed from SELECT
```

The trimming logic handles:
- `col()` preceded by a comma (trims from last comma)
- `col()` as the first expression after SELECT (trims expression, adjusts next comma)

## Window function reference

Same functions and syntax as [`windowBy`](window-functions.md#supported-functions):

| Category | Functions | Parameters |
|----------|-----------|------------|
| **Ranking** | `row_number`, `rank`, `dense_rank`, `percent_rank`, `cume_dist` | `{ fn, over }` |
| **Bucket** | `ntile` | `{ fn, args: number, over }` |
| **Aggregate** | `sum`, `avg`, `count`, `min`, `max`, `first_value`, `last_value` | `{ fn, col, over }` |
| **Offset** | `lag`, `lead` | `{ fn, col, args?: number, over }` |

### OVER clause

```typescript
over: {
  partitionBy?: string[],
  orderBy?: Record<string, "ASC" | "DESC">,
  frame?: "rows" | "range",
  start?: "unbounded preceding" | "current row" | number,
  end?: "unbounded following" | "current row" | number,
}
```

## Type inference

- `columns` narrows the result to `Pick<Row, columns[number]>`
- `window` adds `{ [alias]: number }` for each window entry
- Combined: `Pick<Row, columns[number]> & { [alias]: number }`
- Neither: returns original Row unchanged

```typescript
const view = base.toView({
  columns: ["accountId"] as const,
  window: { rank: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } } as const,
});
// Row type: { accountId: string; rank: number }
```

## Validation

| Rule | Error |
|------|-------|
| Empty `columns` array | `.toView() columns must not be an empty array` |

## Cross-reference

- [Window Functions](window-functions.md) — `windowBy` runtime param on `select()`
- [CRUD](crud.md) — `select()` query factories
- [Registry](registry.md) — `QueryRegistry.execute()` and `ExecuteQueryArgs`
- [Schema Graph](schema-graph.md) — AI column discovery
