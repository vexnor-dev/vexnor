# Go SDK

The Go SDK (`stacks/golang/`) executes vexnor queries without the TypeScript runtime. It loads a **manifest** — a JSON file produced by `vexnor serialize` — and evaluates the same portable operators (filter, orderBy, set, insert, when, pagination, joinBy, upsert, projection) to build parameterized SQL.

## Cross-Runtime Architecture

```
┌─────────────────────┐       ┌────────────────────────┐
│  Node.js (compile)  │       │    Go (runtime)         │
│                     │       │                         │
│  sql`...`           │       │  LoadFile()             │
│       ↓             │       │       ↓                 │
│  vexnor serialize   │──→──→ │  Registry.Build()       │
│       ↓             │ JSON  │       ↓                 │
│  manifest.json      │       │  SqlBuilder → SQL + $N  │
└─────────────────────┘       └────────────────────────┘
```

1. You write typed SQL queries in TypeScript (same `sql` tag, same operators)
2. `vexnor serialize` outputs a manifest JSON containing the query templates and metadata
3. The Go SDK loads the manifest and reconstructs SQL from templates + runtime params
4. Both runtimes produce **identical SQL text and parameter arrays** — verified by shared fixtures

## Install

```bash
go get github.com/vexnor-dev/vexnor-go/vexnor
go get github.com/vexnor-dev/vexnor-go/postgres  # PostgreSQL executor
go get github.com/vexnor-dev/vexnor-go/mssql     # MSSQL executor
go get github.com/vexnor-dev/vexnor-go/sqlite3   # SQLite3 executor
```

## Loading Manifests

```go
import "github.com/vexnor-dev/vexnor-go/vexnor"

// Single file
manifest, err := vexnor.LoadFile("manifests/queries.json")

// All JSON files in a directory (recursive, merged)
manifest, err := vexnor.LoadDirectory("manifests/", "*.json")

// From raw JSON bytes
manifest, err := vexnor.LoadJSON(data)
```

The loader validates the manifest schema version and generator version compatibility.

## QueryRegistry

The registry is the central entry point — it loads queries, resolves them by hash, and executes through a pipeline:

```go
import "github.com/vexnor-dev/vexnor-go/vexnor"

registry := vexnor.NewQueryRegistry("postgresql")
registry.LoadFile("manifests/queries.json")

// Build SQL without pipeline (for debugging or raw execution)
result, err := registry.Build(queryHash, map[string]any{
    "filterBy": []any{map[string]any{"status": "active"}},
    "orderBy":  map[string]any{"createdAt": "DESC"},
    "limit":    25,
    "offset":   0,
})
// result.Text: "SELECT ... WHERE \"status\" = $1 order by \"created_at\" DESC limit $2 offset $3"
// result.Values: ["active", 25, 0]

// Full pipeline execution (authorization, rate limiting, audit, plugins)
result, err := registry.Execute(queryHash, params, context,
    func(sql *vexnor.SqlBuildResult) (any, error) {
        return executor.QueryRows(ctx, sql)
    },
)
```

## DB Executors

Each database has its own executor package:

```go
import (
    vexnorPg "github.com/vexnor-dev/vexnor-go/postgres"
    vexnorMs "github.com/vexnor-dev/vexnor-go/mssql"
    vexnorSq "github.com/vexnor-dev/vexnor-go/sqlite3"
)

// PostgreSQL (pgx v5)
pgExecutor, err := vexnorPg.NewFromConnString(ctx, "postgres://user:pass@localhost:5432/db")
rows, err := pgExecutor.QueryRows(ctx, sqlResult)

// MSSQL (go-mssqldb)
msExecutor, err := vexnorMs.NewFromConnString("sqlserver://user:pass@localhost:1433?database=db&encrypt=disable")
rows, err := msExecutor.QueryRows(ctx, sqlResult)

// SQLite3 (modernc.org/sqlite — pure Go, no CGO)
sqExecutor, err := vexnorSq.NewFromPath("path/to/db.sqlite")
rows, err := sqExecutor.QueryRows(ctx, sqlResult)
```

All executors implement the `vexnor.Executor` interface:

```go
type Executor interface {
    QueryRows(ctx context.Context, query *SqlBuildResult) ([]map[string]any, error)
    Execute(ctx context.Context, query *SqlBuildResult) (int64, error)
}
```

## Pipeline Plugins

```go
// Rate limiting
registry.Use(vexnor.NewRateLimiterPlugin(vexnor.RateLimiterOptions{
    MaxConcurrent:          50,
    MaxConcurrentPerContext: 5,
    ContextKeyResolver: func(ctx map[string]any) string {
        return ctx["userId"].(string)
    },
}))

// Audit logging
registry.Use(vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{
    ContextLogResolver: func(ctx map[string]any) map[string]any {
        return map[string]any{"userId": ctx["userId"]}
    },
    OnLog: func(entry *vexnor.AuditLogEntry) {
        log.Printf("[audit] %s %dms err=%v", entry.Name, entry.DurationMs, entry.Error)
    },
}))

// OpenTelemetry
registry.Use(vexnor.NewOpenTelemetryPlugin(myTracer))
```

## Authorization

```go
// Register an authorization hook
registry.RegisterAuthorization(func(args *vexnor.AuthorizeArgs) error {
    if !contains(args.Context["roles"], args.Tags[0]) {
        return fmt.Errorf("forbidden: requires %s", args.Tags[0])
    }
    return nil
})

// Assert all tagged queries have hooks at startup
if err := registry.CheckAuthorization(); err != nil {
    log.Fatal(err)
}
```

## Context Injection

Queries using `ctx("userId")` in TypeScript are marked `isContext: true` in the manifest. The Go registry automatically injects context values into params before execution:

```go
context := map[string]any{"userId": currentUser.ID}
result, err := registry.Execute(hash, params, context, execFn)
// userId is injected from context into the query params automatically
```

## Example HTTP API

A complete example API using `chi` is at `stacks/golang/example/`:

```bash
cd stacks/golang/example
VEXNOR_MANIFEST_DIR=../../../examples/react-vite-ui/manifests \
GO_EXAMPLE_PORT=5050 \
go run .
```

Or from `react-vite-ui`:

```bash
pnpm --filter @vexnor/react-vite-ui dev:go
```

This starts the Go backend + React frontend together.

## Testing

The Go SDK uses the same cross-runtime fixtures as the .NET SDK:

```bash
cd stacks/golang
go test ./vexnor/ -v          # unit + cross-runtime tests
go test ./vexnor/ -cover      # with coverage (97.2%)
```

Cross-runtime snapshot tests load `stacks/fixtures/manifests/cross-runtime/manifest.json` + `expected.json` and verify the Go SqlBuilder produces identical SQL to the TypeScript implementation.

## Module Structure

```
stacks/golang/
├── vexnor/        # Core: manifest, SqlBuilder, QueryRegistry, pipeline, plugins
├── postgres/      # PostgreSQL executor (pgx v5)
├── mssql/         # MSSQL executor (go-mssqldb)
├── sqlite3/       # SQLite3 executor (modernc.org/sqlite)
└── example/       # HTTP API example (chi router)
```
