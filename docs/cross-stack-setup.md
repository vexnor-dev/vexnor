# Cross-Stack Setup

Get TypeScript and .NET running against the same queries — step by step.

## Prerequisites

- Node.js `>=22.21.1` with pnpm `>=11.0.0`
- .NET SDK `>=10.0`
- A running PostgreSQL, MS SQL, or SQLite database

## 1. Set Up the TypeScript Side

Install vexnor and a database plugin:

```bash
npm install vexnor @vexnor/postgres pg
```

Generate typed models from your database:

```bash
npx vexnor codegen \
  --plugin @vexnor/postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
  --camelCaseColumns
```

Define queries as exports in a dedicated file:

```typescript
// src/queries/accounts.ts
import { sql, row, param, filterBy, orderBy } from 'vexnor';
import { Account } from '../models/public.schema.js';
import '@vexnor/postgres';

export const findActiveAccounts = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${filterBy(Account)}
  ${orderBy(Account)}
`;

export const findAccountById = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
`;
```

## 2. Serialize Queries to a Manifest

The `vexnor serialize` command converts TypeScript queries into portable JSON manifests that .NET can consume:

```bash
npx vexnor serialize \
  --input "src/queries/**/*.ts" \
  --output manifests/ \
  --dialect postgresql
```

This produces one JSON file per source file, preserving directory structure:

```
manifests/
└── src/queries/
    └── accounts.json
```

Each manifest contains query templates, parameter metadata, and stable hashes — everything the .NET SDK needs to reconstruct the same SQL.

## 3. Set Up the .NET Side

Add the Vexnor NuGet packages to your .NET project:

```bash
dotnet add package Vexnor.Core
dotnet add package Vexnor.Postgres   # or Vexnor.Mssql / Vexnor.Sqlite3
```

Copy or reference the generated manifests in your .NET project. A common pattern is to place them in a shared `manifests/` directory at the repo root and reference via a relative path:

```xml
<!-- In your .csproj -->
<ItemGroup>
  <None Include="../../manifests/**/*.json" CopyToOutputDirectory="PreserveNewest" LinkBase="manifests" />
</ItemGroup>
```

## 4. Load and Execute in .NET

```csharp
using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Npgsql;

// Load all manifests
var registry = new QueryRegistry("postgresql");
registry.LoadDirectory("manifests/");

// Build SQL from a query hash + runtime params
var sql = registry.Build("findActiveAccounts", new Dictionary<string, object?>
{
    ["filterBy"] = new object?[] { new Dictionary<string, object?> { ["status"] = "active" } },
    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "DESC" },
});

// Execute with Npgsql
await using var conn = new NpgsqlConnection(connectionString);
await conn.OpenAsync();
await using var cmd = new NpgsqlCommand(sql.Text, conn);
for (int i = 0; i < sql.Values.Count; i++)
    cmd.Parameters.AddWithValue($"p{i}", sql.Values[i] ?? DBNull.Value);

await using var reader = await cmd.ExecuteReaderAsync();
```

## 5. Add Cross-Runtime Fixtures (Optional)

Shared fixtures verify that both runtimes produce identical SQL. This catches drift when you change queries.

Create a fixture generator:

```typescript
// stacks/fixtures/generate-cross-runtime.ts
import { serializeManifest, sql, row, filterBy, orderBy } from '@vexnor/core';
import { Account } from './codegen/postgres/vexnor_dev.account-table.js';
import { mkdirSync, writeFileSync } from 'node:fs';

const queries = {
  findActive: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)} ${orderBy(Account)}`,
};

const testParams = {
  findActive: { filterBy: { status: "active" }, orderBy: { createdAt: "DESC" } },
};

const results: Record<string, { hash: string; text: string; values: unknown[] }> = {};
for (const [name, query] of Object.entries(queries)) {
  const hash = await query.hash;
  const { text, values } = query.getSql({
    params: testParams[name] as never,
    options: { dialect: "postgresql", format: false },
  });
  results[name] = { hash, text, values };
}

const manifest = await serializeManifest(
  await Promise.all(
    Object.entries(queries).map(async ([name, query]) => ({ query, name, hash: await query.hash }))
  ),
  "postgresql"
);

mkdirSync("manifests/cross-runtime", { recursive: true });
writeFileSync("manifests/cross-runtime/manifest.json", JSON.stringify(manifest, null, 2));
writeFileSync("manifests/cross-runtime/expected.json", JSON.stringify(results, null, 2));
```

Run it:

```bash
cd stacks/fixtures && npx tsx generate-cross-runtime.ts
```

In .NET, assert against the expected output:

```csharp
[Fact]
public void FindActive_Matches_NodeJS_Output()
{
    var expected = LoadExpected("findActive");
    var result = _registry.Build(expected.Hash, testParams);
    Assert.Equal(expected.Text, result.Text);
    Assert.Equal(expected.Values, result.Values);
}
```

## 6. Wire Up Authorization and Pipelines

Both runtimes support the same pipeline model. Tag queries with `.authorize()` in TypeScript — the manifest carries authorization metadata so .NET can enforce the same rules:

```csharp
registry.RegisterAuthorization((args) =>
{
    if (args.Query.Authorization == "admin" && !IsAdmin(args.Context))
        throw new UnauthorizedAccessException("Admin required");
});

registry.CheckAuthorization(); // fails if any tagged query has no hook
```

## Directory Structure

A typical cross-stack repo layout:

```
your-project/
├── src/
│   ├── models/              ← generated by `vexnor codegen`
│   └── queries/             ← TypeScript query definitions
├── manifests/               ← generated by `vexnor serialize`
├── stacks/
│   ├── dotnet/
│   │   ├── src/             ← .NET service(s)
│   │   └── tests/           ← .NET unit + integration tests
│   └── fixtures/
│       ├── generate-cross-runtime.ts
│       └── manifests/cross-runtime/
├── vexnor.config.ts
└── package.json
```

## Cross-Reference

- [Serialize](serialize.md) — full CLI reference for `vexnor serialize`
- [.NET SDK](dotnet.md) — QueryRegistry, SqlBuilder, manifest format
- [Portable Queries](portable-queries.md) — conceptual overview of all portability axes
- [Workflow](workflow.md) — day-to-day dev loop when queries change
- [CI](ci.md) — CI pipeline setup for cross-stack projects
