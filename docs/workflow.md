# Development Workflow

The day-to-day loop when working with vexnor across TypeScript and .NET.

## The Core Loop

```
Schema change → codegen → update queries → serialize → regenerate fixtures → test both runtimes
```

Each step is optional depending on what changed:

| What Changed | Steps Required |
|---|---|
| Database schema (new column, table) | codegen → serialize → fixtures → tests |
| Query logic (new query, changed WHERE) | serialize → fixtures → tests |
| Runtime params only (different filter values) | tests only |
| .NET pipeline code (auth hooks, plugins) | .NET tests only |
| TypeScript pipeline code | Node.js tests only |

## Step-by-Step

### 1. Regenerate Models After Schema Changes

```bash
npx vexnor codegen --profile dev
```

This introspects the live database and updates TypeScript models in your `outDir`. If you added a column, it appears immediately in the generated types — any query using `Account.$$` (all-columns) picks it up automatically.

### 2. Write or Modify Queries

TypeScript catches errors immediately — referencing a nonexistent column or using the wrong param type fails the build:

```typescript
// src/queries/accounts.ts — add a new query export
export const findByEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email')}
`;
```

### 3. Serialize to Manifests

```bash
npx vexnor serialize \
  --input "src/queries/**/*.ts" \
  --output manifests/ \
  --dialect postgresql
```

Output tells you exactly what changed:

```
  src/queries/accounts.ts → src/queries/accounts.json (4 queries)

Serialized 4 queries from 1 files to manifests/
```

Remember: one manifest per source file. The new `findByEmail` query is now in `manifests/src/queries/accounts.json` alongside the other queries from that file.

### 4. Regenerate Cross-Runtime Fixtures

If you maintain shared fixtures for cross-runtime verification:

```bash
cd stacks/fixtures && npx tsx generate-cross-runtime.ts
```

This updates `manifests/cross-runtime/manifest.json` and `expected.json` that .NET tests assert against.

### 5. Run Tests

```bash
# TypeScript — unit + integration
pnpm test

# .NET — unit + cross-runtime snapshots
dotnet test stacks/dotnet
```

If .NET tests fail after a query change, common causes:
- Stale manifest — forgot to re-serialize
- Stale fixtures — forgot to regenerate `expected.json`
- New operator not yet supported in .NET SqlBuilder

## Shortcuts

TypeScript-only changes (no .NET consumers):

```bash
npx vexnor codegen --profile dev   # if schema changed
pnpm build && pnpm test
```

.NET-only changes (pipeline plugins, auth hooks):

```bash
dotnet test stacks/dotnet
```

Query changes with .NET consumers:

```bash
pnpm build
npx vexnor serialize -i "src/queries/**/*.ts" -o manifests/ -d postgresql
cd stacks/fixtures && npx tsx generate-cross-runtime.ts
pnpm test && dotnet test stacks/dotnet
```

## Adding a New Query

1. Export the query from a `src/queries/*.ts` file
2. Add `.authorize('tag')` if it needs access control
3. Register in `SqlQueryRegistry` if it should be callable from the browser
4. `pnpm build` — TypeScript validates types
5. `npx vexnor serialize -i "src/queries/**/*.ts" -o manifests/ -d postgresql`
6. If cross-runtime: add test params to fixture generator, run `npx tsx generate-cross-runtime.ts`
7. `pnpm test` and `dotnet test stacks/dotnet`
8. Commit manifests alongside source code

## Removing a Query

1. Delete the export from the source file
2. Re-serialize — the query disappears from the manifest
3. Remove any .NET code referencing the old hash
4. Remove fixture test cases if applicable
5. Run both test suites

## Renaming a Query

Renaming a query export changes its `name` in the manifest but **not** its hash (hashes are content-addressed from the SQL structure). Consumers that look up by hash are unaffected. Consumers that look up by name need updating.

## Schema Migrations in Production

The recommended deployment sequence for schema + query changes:

1. **Deploy the migration** — add the column/table (additive changes are safe)
2. **Deploy the new code** — updated manifests reference the new column
3. **If removing a column** — deploy code first (stop referencing it), then drop it

This avoids a window where code references a column that doesn't exist yet.

## Handling Multiple Dialects

If you target multiple databases (e.g., PostgreSQL in production, SQLite in tests):

```bash
npx vexnor serialize -i "src/queries/**/*.ts" -o manifests/postgres/ -d postgresql
npx vexnor serialize -i "src/queries/**/*.ts" -o manifests/sqlite/ -d sqlite
```

The .NET side loads the appropriate manifest based on its runtime configuration:

```csharp
var dialect = Environment.GetEnvironmentVariable("DB_DIALECT") ?? "postgresql";
var registry = new QueryRegistry(dialect);
registry.LoadDirectory($"manifests/{dialect}/");
```

## Cross-Reference

- [Cross-Stack Setup](cross-stack-setup.md) — initial setup guide
- [Serialize](serialize.md) — CLI reference for manifest generation
- [CLI](cli.md) — `codegen` and `exec` commands
- [CI](ci.md) — automated pipeline for all these steps
