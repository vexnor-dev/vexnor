# Window Functions

Window functions via `windowBy` — declare in `.select()` for typed results, or pass in `params` for dynamic AI agent composition.

## Type-Safe Usage (Developers)

Declare `windowBy` in `.select()` — the result Row type includes the window aliases:

```typescript
const query = Account.postgres.select({
  windowBy: {
    rank: { fn: "rank", over: { partitionBy: ["status"], orderBy: { createdAt: "DESC" } } },
    prevEmail: { fn: "lag", col: "email", args: 1, over: { orderBy: { createdAt: "ASC" } } },
    total: { fn: "count", col: "accountId", over: { orderBy: { createdAt: "ASC" } } },
  },
});

const results = await query.all({ db: pool });
results[0].rank;       // ✅ number
results[0].prevEmail;  // ✅ string | null
results[0].total;      // ✅ number
results[0].email;      // ✅ string (base row still present)
results[0].fake;       // ❌ type error
```

### Combined with `select` (Projection)

Declare `select` in `.select()` to narrow the result to specific columns:

```typescript
const query = Account.postgres.select({
  select: { email: true, revenue: { fn: "sum", col: "amount" } },
  windowBy: { rank: { fn: "rank", over: { orderBy: { createdAt: "ASC" } } } },
});

const results = await query.all({ db: pool });
results[0].email;     // ✅ string
results[0].revenue;   // ✅ number
results[0].rank;      // ✅ number
results[0].accountId; // ❌ type error — not selected
```

### `select` Narrowing (without windowBy)

```typescript
const query = Account.postgres.select({
  select: {
    email: true,                                    // picks column, type: string
    name: "firstName",                              // renames, type: string
    total: { fn: "count", col: "*" },              // aggregate, type: number
    month: { fn: "dateTrunc", col: "createdAt", args: "month" },  // transform, type: string
  },
});
// Row = { email: string; name: string; total: number; month: string }
```

## Dynamic Usage (AI Agents)

Pass `windowBy` in `params` at runtime — columns are available on the result but not typed:

```typescript
const results = await Account.postgres.select({}).all({
  db: pool,
  params: {
    windowBy: agentConstructedObject,  // built dynamically from SchemaGraph
  },
});
// Access via bracket notation or dynamic processing
```

## Column Constraints

All column references (`col`, `partitionBy`, `orderBy`) are constrained to actual table columns at compile time:

```typescript
Account.postgres.select({
  windowBy: {
    rank: { fn: "rank", over: { partitionBy: ["status"], orderBy: { createdAt: "ASC" } } },  // ✅
    bad: { fn: "sum", col: "nonExistent", over: {} },  // ❌ type error
  },
});
```

## Supported Functions

| Category | Functions | Parameters | Return Type |
|----------|-----------|------------|-------------|
| **Ranking** | `row_number`, `rank`, `dense_rank`, `percent_rank`, `cume_dist` | `{ fn, over }` | `number` |
| **Bucket** | `ntile` | `{ fn, args: number, over }` | `number` |
| **Aggregate** | `sum`, `avg` | `{ fn, col, over }` | `number \| null` |
| **Aggregate** | `count` | `{ fn, col, over }` | `number` |
| **Aggregate** | `min`, `max` | `{ fn, col, over }` | `T[col] \| null` |
| **Value** | `first_value`, `last_value` | `{ fn, col, over }` | `T[col] \| null` |
| **Offset** | `lag`, `lead` | `{ fn, col, args?: number, over }` | `T[col] \| null` |

## OVER Clause

```typescript
over: {
  partitionBy?: (keyof T["Select"])[],            // PARTITION BY columns
  orderBy?: { [K in keyof T["Select"]]?: "ASC" | "DESC" },  // ORDER BY
  frame?: "rows" | "range",                        // Frame type
  start?: "unbounded preceding" | "current row" | number,    // N PRECEDING
  end?: "unbounded following" | "current row" | number,      // N FOLLOWING
}
```

### Frame Examples

```typescript
// Sliding window: last 3 rows
over: { orderBy: { createdAt: "ASC" }, frame: "rows", start: 2, end: "current row" }
// → ROWS BETWEEN 2 PRECEDING AND CURRENT ROW

// Cumulative (unbounded)
over: { orderBy: { createdAt: "ASC" }, frame: "range", start: "unbounded preceding", end: "current row" }
// → RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
```

## Dialect Support

| Feature | PostgreSQL | MSSQL | SQLite |
|---------|-----------|-------|--------|
| All 15 functions | ✅ | ✅ | ✅ (3.25+) |
| ROWS BETWEEN | ✅ | ✅ | ✅ |
| RANGE BETWEEN (string bounds) | ✅ | ✅ | ✅ |
| RANGE BETWEEN (numeric bounds) | ✅ | ❌ throws | ✅ |

> **MSSQL:** `frame: "range"` with numeric `start`/`end` throws at build time.

## Validation

All validation happens at build time:

| Rule | Error |
|------|-------|
| Invalid `fn` | `windowBy: invalid function 'X'` |
| `col` on ranking fn | `ranking function 'X' does not accept 'col'` |
| Missing `col` on aggregate/offset fn | `aggregate function 'X' requires 'col'` |
| Missing `args` on ntile | `ntile requires 'args'` |
| Invalid `orderBy` direction | `invalid orderBy direction 'X'` |
| `start`/`end` without `frame` | `'frame' (rows\|range) is required` |
| Invalid column | `column 'X' not found` |
| MSSQL RANGE + numeric | `MSSQL does not support numeric bounds with RANGE frame` |

## Cross-Runtime (.NET SDK)

The .NET SDK supports `windowBy` via the serialized query manifest:

```csharp
var result = await registry.Execute("findAccounts", new Dictionary<string, object?>
{
    ["windowBy"] = new Dictionary<string, object?>
    {
        ["rank"] = new Dictionary<string, object?> { ["fn"] = "rank", ["over"] = new Dictionary<string, object?> { ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" } } }
    }
});
```

## Cross-Reference

- [CRUD](crud.md) — `select()` query factories, `params.filterBy`, `params.orderBy`
- [Schema Graph](schema-graph.md) — column discovery for AI agents
- [Databases](databases.md) — driver-specific notes
