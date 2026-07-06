# Window Functions

Runtime window functions via `params.windowBy` — AI agents and developers can request window function columns without writing SQL.

See the full documentation in the [GitHub issue #59](https://github.com/vexnor-dev/vexnor/issues/59) and inline JSDoc on the `SqlWindowBy` class.

## Quick Reference

```typescript
const results = await Order.postgres.select({}).all({
  db: pool,
  params: {
    windowBy: {
      rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } },
      rank: { fn: "rank", over: { partitionBy: ["customerId"], orderBy: { total: "DESC" } } },
      runningTotal: { fn: "sum", col: "total", over: { orderBy: { createdAt: "ASC" } } },
      prev: { fn: "lag", col: "total", args: 1, over: { orderBy: { createdAt: "ASC" } } },
      quartile: { fn: "ntile", args: 4, over: { orderBy: { total: "ASC" } } },
    },
  },
});
```

## Supported Functions

| Category | Functions | Parameters |
|----------|-----------|------------|
| **Ranking** | `row_number`, `rank`, `dense_rank`, `percent_rank`, `cume_dist` | `{ fn, over }` |
| **Bucket** | `ntile` | `{ fn, args: number, over }` |
| **Aggregate** | `sum`, `avg`, `count`, `min`, `max`, `first_value`, `last_value` | `{ fn, col, over }` |
| **Offset** | `lag`, `lead` | `{ fn, col, args?: number, over }` |

## OVER Clause

```typescript
over: {
  partitionBy?: string[],
  orderBy?: Record<string, "ASC" | "DESC">,
  frame?: "rows" | "range",
  start?: "unbounded preceding" | "current row" | number,
  end?: "unbounded following" | "current row" | number,
}
```

## Dialect Support

| Feature | PostgreSQL | MSSQL | SQLite |
|---------|-----------|-------|--------|
| All 15 functions | ✅ | ✅ | ✅ (3.25+) |
| ROWS BETWEEN | ✅ | ✅ | ✅ |
| RANGE BETWEEN (string bounds) | ✅ | ✅ | ✅ |
| RANGE BETWEEN (numeric bounds) | ✅ | ❌ throws | ✅ |

## Cross-Reference

- [CRUD](crud.md) — `select()` query factories
- [Schema Graph](schema-graph.md) — column discovery for AI agents
- [Databases](databases.md) — driver-specific notes
