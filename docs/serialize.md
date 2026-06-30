# `vexnor serialize`

Converts TypeScript query definitions into portable JSON manifests for cross-runtime execution.

## Usage

```bash
npx vexnor serialize \
  --input <glob> \
  --output <dir> \
  --dialect <dialect>
```

## Options

| Option | Description | Required |
|--------|-------------|----------|
| `-i, --input <glob>` | Glob pattern for files exporting queries | yes |
| `-o, --output <dir>` | Output directory for manifest JSON files | yes |
| `-d, --dialect <dialect>` | SQL dialect: `postgresql`, `transactsql`, `sqlite` | yes |

## How It Works

1. Resolves all files matching the `--input` glob (excludes `node_modules`, `dist`, `build`)
2. Imports each file and discovers all exported `SqlQuery` and `SqlQueryHandler` instances
3. Serializes each query's template into a portable token stream
4. Writes **one manifest JSON per source file**, preserving the directory structure under `--output`

### One Manifest Per Source File

This is a key design choice. The command does not produce a single monolithic manifest — it maps each source file to its own manifest:

```bash
npx vexnor serialize \
  --input "src/queries/**/*.ts" \
  --output manifests/ \
  --dialect postgresql
```

```
Source files:                         Generated manifests:
src/queries/accounts.ts         →     manifests/src/queries/accounts.json
src/queries/orders.ts           →     manifests/src/queries/orders.json
src/queries/admin/users.ts      →     manifests/src/queries/admin/users.json
```

Each manifest contains all queries exported from that single file. If a file exports 5 query objects, its manifest has 5 entries.

## Examples

### Basic — serialize all queries for PostgreSQL

```bash
npx vexnor serialize \
  --input "src/queries/**/*.ts" \
  --output manifests/ \
  --dialect postgresql
```

Output:

```
  src/queries/accounts.ts → src/queries/accounts.json (5 queries)
  src/queries/orders.ts → src/queries/orders.json (3 queries)

Serialized 8 queries from 2 files to manifests/
```

### Single file

```bash
npx vexnor serialize \
  --input "src/queries/accounts.ts" \
  --output manifests/ \
  --dialect postgresql
```

### MS SQL Server dialect

```bash
npx vexnor serialize \
  --input "src/queries/**/*.ts" \
  --output manifests/mssql/ \
  --dialect transactsql
```

### Multiple dialects (for multi-database deployments)

```bash
npx vexnor serialize -i "src/queries/**/*.ts" -o manifests/postgres/ -d postgresql
npx vexnor serialize -i "src/queries/**/*.ts" -o manifests/mssql/ -d transactsql
npx vexnor serialize -i "src/queries/**/*.ts" -o manifests/sqlite/ -d sqlite
```

## What Gets Serialized

The command discovers exports by importing each file. It picks up:

- `SqlQuery` instances (created with the `sql` tag)
- `SqlQueryHandler` instances (created by `.postgres`, `.mssql`, `.sqlite3` — it extracts the underlying query)

Non-query exports (types, constants, helper functions) are ignored.

```typescript
// src/queries/accounts.ts
import { sql, row, param, filterBy, orderBy } from 'vexnor';
import { Account } from '../models/public.schema.js';

// ✓ Serialized — SqlQuery instance
export const findActiveAccounts = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${filterBy(Account)}
  ${orderBy(Account)}
`;

// ✓ Serialized — SqlQuery instance
export const findAccountById = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
`;

// ✗ Ignored — not a query
export const ACCOUNT_TABLE_NAME = 'account';

// ✗ Ignored — not a query
export type AccountResult = { accountId: string; email: string };
```

## Manifest Format

Each generated JSON file has this structure:

```json
{
  "version": 1,
  "dialect": "postgresql",
  "queries": [
    {
      "name": "findActiveAccounts",
      "hash": "a1b2c3d4e5f6...",
      "template": [
        { "type": "text", "value": "SELECT \"account_id\", \"email\", ... FROM \"account\" WHERE " },
        { "type": "filter", "columns": ["accountId", "email", "status", "createdAt"] },
        { "type": "text", "value": " " },
        { "type": "orderBy", "columns": ["accountId", "email", "status", "createdAt"] }
      ],
      "params": { "filter": { "columns": [...], "operators": [...] } },
      "row": { "accountId": "string", "email": "string", ... },
      "authorization": null
    }
  ]
}
```

### Template Node Types

| Node Type | Purpose | Evaluated From |
|-----------|---------|---------------|
| `text` | Literal SQL emitted as-is | — |
| `param` | Named parameter placeholder (`$N` / `@pN`) | `params[name]` |
| `value` | Static inline value (enum constants) | — |
| `when` | Conditional branch (include/exclude SQL) | `params[flag]` truthiness |
| `set` | `SET col = $N, ...` | `params.set` |
| `insert` | `(cols) VALUES ($N, ...), ...` | `params.rows` |
| `upsert` | INSERT + conflict resolution | `params.rows` |
| `filter` | WHERE conditions | `params.filterBy` |
| `orderBy` | `ORDER BY col DIR` | `params.orderBy` |
| `projection` | Column selection | `params.select` |
| `pagination` | `LIMIT $N OFFSET $N` | `params.limit` / `params.offset` |

## Full Workflow Example

Starting from scratch with a PostgreSQL database:

```bash
# 1. Generate TypeScript models from your database
npx vexnor codegen \
  --plugin @vexnor/postgres \
  --schema public \
  --uri postgres://dev:dev@localhost:5432/myapp \
  --outDir src/models \
  --camelCaseColumns

# 2. Write queries (see example above)

# 3. Build your TypeScript (serialize needs compiled/importable files)
pnpm build

# 4. Serialize to manifests
npx vexnor serialize \
  --input "src/queries/**/*.ts" \
  --output manifests/ \
  --dialect postgresql

# 5. .NET can now load manifests/
dotnet run  # your .NET service loads manifests/ at startup
```

## When to Re-Serialize

Re-run `vexnor serialize` whenever:

- You add, remove, or modify a query export
- You change column selections (`row()` arguments)
- You add or change `.authorize()` tags
- You regenerate models after a schema change (`vexnor codegen`)

Running serialize is **idempotent** — the same inputs always produce the same output. It's safe to run on every build.

## Programmatic API

The serialize logic is also available as a library function for custom build scripts:

```typescript
import { serializeManifest } from 'vexnor';

const queries = [
  { query: findActiveAccounts, name: 'findActiveAccounts', hash: await findActiveAccounts.hash },
  { query: findAccountById, name: 'findAccountById', hash: await findAccountById.hash },
];

const manifest = await serializeManifest(queries, 'postgresql');
// manifest is a plain object — JSON.stringify() to write to disk
```

## Cross-Reference

- [CLI](cli.md) — `codegen`, `exec run`, `exec init`
- [.NET SDK](dotnet.md) — consuming manifests in C#
- [Cross-Stack Setup](cross-stack-setup.md) — end-to-end guide
- [Workflow](workflow.md) — when and how to re-serialize in your dev loop
- [Portable Queries](portable-queries.md) — conceptual overview
