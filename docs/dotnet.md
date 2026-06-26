# .NET SDK

The .NET SDK (`Vexnor.Core`) executes vexnor queries without the TypeScript runtime. It loads a **manifest** — a JSON file produced by `vexnor serialize` — and evaluates the same portable operators (filter, orderBy, set, insert, when, pagination) to build parameterized SQL.

## Cross-Runtime Architecture

```
┌─────────────────────┐       ┌────────────────────────┐
│  Node.js (compile)  │       │    .NET (runtime)       │
│                     │       │                         │
│  sql`...`           │       │  ManifestLoader.Load()  │
│       ↓             │       │       ↓                 │
│  vexnor serialize   │──→──→ │  QueryRegistry.Build()  │
│       ↓             │ JSON  │       ↓                 │
│  manifest.json      │       │  SqlBuilder → SQL + $N  │
└─────────────────────┘       └────────────────────────┘
```

1. You write typed SQL queries in TypeScript (same `sql` tag, same operators)
2. `vexnor serialize` outputs a manifest JSON containing the query templates and metadata
3. The .NET SDK loads the manifest and reconstructs SQL from templates + runtime params
4. Both runtimes produce **identical SQL text and parameter arrays** — verified by shared fixtures

## Loading Manifests

```csharp
using Vexnor.Core.Manifest;

// Single file
var manifest = ManifestLoader.LoadFile("manifests/queries.json");

// All JSON files in a directory (merged)
var manifest = ManifestLoader.LoadGlob("manifests/", "*.json");

// From a raw JSON string
var manifest = ManifestLoader.Load(jsonString);
```

The loader validates the manifest schema version and generator version compatibility.

## QueryRegistry

The registry is the central entry point — it loads queries, resolves them by hash, and executes through a pipeline:

```csharp
using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;

var registry = new QueryRegistry("postgresql");
registry.LoadFile("manifests/queries.json");

// Build SQL without pipeline (for debugging or raw execution)
var result = registry.Build(queryHash, new Dictionary<string, object?>
{
    ["filterBy"] = new object?[] { new Dictionary<string, object?> { ["status"] = "active" } },
    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "DESC" },
    ["limit"] = 25,
    ["offset"] = 0,
});
// result.Text: "SELECT ... WHERE \"status\" = $1 order by \"created_at\" DESC limit $2 offset $3"
// result.Values: ["active", 25, 0]

// Full pipeline execution (authorization, rate limiting, audit, plugins)
var accounts = await registry.ExecuteAsync<List<Account>>(
    queryHash,
    parameters: new() { ["filterBy"] = filters },
    context: new() { ["userId"] = currentUser.Id },
    executeFn: async (sql) =>
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = sql.Text;
        // bind sql.Values...
        return await ExecuteReader<Account>(cmd);
    }
);
```

### Pipeline Plugins

```csharp
// Authorization — throw to deny
registry.RegisterAuthorization((args) =>
{
    if (args.Query.Authorization.Contains("admin") && !IsAdmin(args.Context))
        throw new UnauthorizedAccessException("Admin required");
});

// Rate limiting
registry.Use(new RateLimiterPlugin(maxConcurrent: 50, maxPerContext: 5));

// Audit logging
registry.Use(new AuditLogPlugin(log =>
    logger.LogInformation("{Name} executed in {Duration}ms", log.Name, log.DurationMs)));

// Startup check — assert every .authorize() query has a hook
registry.CheckAuthorization();
```

## SqlBuilder

The `SqlBuilder` evaluates a query's template nodes against runtime parameters to produce SQL text and a parameter array. It handles all portable operators:

| Operator Node | Evaluates |
|---|---|
| `text` | Literal SQL — emitted as-is |
| `param` | Resolves from params dict, emits `$N` placeholder |
| `value` | Static inline value (enum constants) |
| `when` | Conditional branch — includes `onTrue` or `onFalse` template based on param presence |
| `set` | `SET col = $N, ...` from `params.set` dict |
| `insert` | `(cols) VALUES ($N, ...), ...` from `params.rows` array |
| `filter` | WHERE conditions from `params.filterBy` — supports all operators |
| `orderBy` | `ORDER BY col DIR, ...` from `params.orderBy` dict |
| `projection` | Column selection from `params.select` array |
| `pagination` | `LIMIT $N OFFSET $N` from `params.limit`/`params.offset` |

### Filter Operators

The .NET SDK supports the same operators as Node.js:

| Operator | Tuple Form | SQL Output |
|----------|-----------|------------|
| *(bare value)* | `{ "col": value }` | `"col" = $1` |
| `=` | `["=", value]` | `"col" = $1` |
| `not` / `!=` | `["not", value]` | `"col" <> $1` |
| `>` | `[">", value]` | `"col" > $1` |
| `>=` | `[">=", value]` | `"col" >= $1` |
| `<` | `["<", value]` | `"col" < $1` |
| `<=` | `["<=", value]` | `"col" <= $1` |
| `between` | `["between", low, high]` | `"col" BETWEEN $1 AND $2` (empty: `"col" IS NULL`) |
| `in` | `["in", v1, v2, ...]` | `"col" IN ($1, $2, ...)` (empty: `"col" IS NULL`) |
| `notIn` | `["notIn", v1, v2, ...]` | `"col" NOT IN ($1, $2, ...)` (empty: `"col" IS NOT NULL`) |
| `like` | `["like", pattern]` | `"col" LIKE $1` |
| `notLike` | `["notLike", pattern]` | `"col" NOT LIKE $1` |
| `isNull` | `["isNull"]` | `"col" IS NULL` |
| `isNotNull` | `["isNotNull"]` | `"col" IS NOT NULL` |

### Dialect-Aware Placeholders

The builder formats parameter placeholders per dialect:

| Dialect | Placeholder |
|---|---|
| `postgresql` | `$1`, `$2`, ... |
| `transactsql` | `@p0`, `@p1`, ... |
| `sqlite` | `$1`, `$2`, ... |

## Complete Example

```csharp
using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Npgsql;

// 1. Load the manifest generated by `vexnor serialize`
var registry = new QueryRegistry("postgresql");
registry.LoadDirectory("manifests/");

// 2. Build SQL from a query hash + runtime params
var sql = registry.Build("abc123hash", new Dictionary<string, object?>
{
    ["filterBy"] = new object?[]
    {
        new Dictionary<string, object?> { ["status"] = new object?[] { "in", "active", "confirmed" } },
        new Dictionary<string, object?> { ["createdAt"] = new object?[] { ">=", "2024-01-01" } },
        new Dictionary<string, object?>
        {
            ["or"] = new object?[]
            {
                new Dictionary<string, object?> { ["email"] = new object?[] { "like", "%@vip.com" } },
                new Dictionary<string, object?> { ["parentId"] = new object?[] { "isNotNull" } },
            }
        },
    },
    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "DESC" },
    ["limit"] = 25,
    ["offset"] = 0,
});

// 3. Execute with your preferred ADO.NET provider
await using var conn = new NpgsqlConnection(connectionString);
await conn.OpenAsync();
await using var cmd = new NpgsqlCommand(sql.Text, conn);
for (int i = 0; i < sql.Values.Count; i++)
    cmd.Parameters.AddWithValue($"p{i}", sql.Values[i] ?? DBNull.Value);

await using var reader = await cmd.ExecuteReaderAsync();
```

## ParamValidation

The manifest includes validation schemas for structured params (`filter`, `projection`). The .NET SDK validates these at execution time — before any SQL is built:

```csharp
// Manifest includes:
// { "validation": { "type": "filter", "columns": ["email", "status", ...], "operators": ["=", "in", ...] } }

// At execution time, the registry validates:
// ✓ All column keys in filterBy are in the allowed list
// ✓ All operators are in the allowed list
// ✗ Unknown column → throws InvalidOperationException("Column not found: badCol")
// ✗ Unknown operator → throws InvalidOperationException("Invalid filter operator: badOp")
```

This ensures the .NET side enforces the same schema constraints as the TypeScript side — invalid columns or operators never reach SQL construction.

## Cross-Runtime Testing

Both runtimes are verified against shared fixtures:

```
stacks/fixtures/
├── generate-cross-runtime.ts    ← generates manifest + expected output
├── manifests/cross-runtime/
│   ├── manifest.json            ← serialized queries
│   └── expected.json            ← { text, values } per test case
└── queries/cross-runtime.ts     ← query definitions + test params
```

**How it works:**

1. TypeScript defines queries and test params in `queries/cross-runtime.ts`
2. `generate-cross-runtime.ts` serializes the manifest and evaluates each query to produce `{ text, values }` expected output
3. The .NET `CrossRuntimeSnapshotTests` loads the same manifest, runs the same params through `SqlBuilder`, and asserts the output matches `expected.json` exactly

```csharp
// CrossRuntimeSnapshotTests.cs
[Fact]
public void FilterOperators_Match_NodeJS_Output()
{
    AssertMatch("xFilterOperators", new()
    {
        ["filterBy"] = new object?[] { ... }  // same params as TypeScript
    });
}
```

If a .NET test fails, it means the .NET SQL output diverges from Node.js. Regenerate fixtures with:

```bash
cd stacks/fixtures && npx tsx generate-cross-runtime.ts
```

## Project Structure

```
stacks/dotnet/
├── src/
│   ├── Vexnor.Core/           ← Core SDK (manifest, builder, registry, pipeline)
│   ├── Vexnor.Postgres/       ← PostgreSQL executor (Npgsql)
│   ├── Vexnor.Mssql/          ← MS SQL executor (Microsoft.Data.SqlClient)
│   └── Vexnor.Sqlite3/        ← SQLite executor (Microsoft.Data.Sqlite)
└── tests/
    ├── Vexnor.Core.Tests/     ← Unit tests (builder, pipeline, cross-runtime)
    └── Vexnor.Integration.Tests/  ← Database integration tests
```
