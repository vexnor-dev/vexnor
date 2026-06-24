# Monorepo and Development

This repository is a `pnpm` monorepo.

## Layout

```text
packages/
  vexnor/              — Core library: sql tag, query builder, pipeline, registry, CLI, telemetry
  @vexnor/postgres/     — PostgreSQL plugin (pg driver)
  @vexnor/mssql/        — MS SQL Server plugin (mssql/tedious driver)
  @vexnor/sqlite3/      — SQLite plugin (better-sqlite3 driver)
  @vexnor/drizzle/      — Drizzle ORM adaptor
  @vexnor/prisma/       — Prisma adaptor
  @vexnor/typeorm/      — TypeORM adaptor
  @vexnor/sequelize/    — Sequelize adaptor

tests/
  vexnor-test-postgres/ — Integration tests against a real PostgreSQL database
  vexnor-test-mssql/    — Integration tests against a real MS SQL Server database
  vexnor-test-sqlite3/  — Integration tests against a real SQLite database
  vexnor-test-remote/   — Integration tests for remote/isomorphic execution

@db-postgres/          — PostgreSQL test database migrations
@db-mssql/             — MS SQL Server test database migrations
@db-sqlite3/           — SQLite test database migrations

examples/
  postgres-esm/        — Minimal Node.js ESM script — insert, select, update with PostgreSQL
  postgres-cjs/        — Same as above using CommonJS
  react-vite-api/      — React + Vite + Hono — isomorphic queries, SqlQueryRegistry, HttpRemoteClient
  react-next-app/      — Next.js App Router — React Server Components, Server Actions
```

## Prerequisites

- Node.js `>=22.21.1`
- pnpm `>=10.17.0`

## Getting Started

```bash
git clone https://github.com/vexnor-dev/vexnor.git
cd vexnor
pnpm install
pnpm build
pnpm test
```

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages (core first, then plugins, then examples) |
| `pnpm test` | Run all unit tests via Vitest |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format all packages with Prettier |
| `pnpm db-migrate` | Run database migrations for all three test databases |

## Build Order

The build is sequenced via `npm-run-all`:

1. `build:1-core` — Build all `packages/*` (vexnor core + plugins)
2. `build:4-install` — Re-install to link built packages
3. `build:5-rest` — Build remaining workspaces (tests, examples)

## Testing

Tests run via Vitest (`vitest run` at the root). Each package has its own `vitest.config.ts`:

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter vexnor test

# Run tests with coverage
pnpm --filter vexnor test -- --coverage

# Run a specific test file
pnpm --filter @vexnor/postgres test -- src/__tests__/postgres-transaction.test.ts
```

### Integration Tests

Integration tests require running databases. Use the test database migrations:

```bash
# Ensure databases are running (Docker, local, etc.)
pnpm db-migrate

# Run integration tests
pnpm --filter vexnor-test-postgres test
pnpm --filter vexnor-test-mssql test
pnpm --filter vexnor-test-sqlite3 test
```

## Package Structure

Each package follows the same structure:

```text
packages/@vexnor/postgres/
  src/
    __tests__/           — Unit tests
    crud/                — CRUD query factories
    charms/              — JSON aggregation (jsonMany, jsonOne)
    schema/              — Database introspection for codegen
    index.ts             — Public exports
    index.browser.ts     — Browser-safe exports (no Node.js imports)
    postgres-transaction.ts
    postgres-query-handler.ts
    postgres-tokenizer.ts
    @vexnor/postgres.ts   — Plugin class
  package.json
  tsconfig.json
  vitest.config.ts
```

The core `vexnor` package is larger:

```text
packages/core/
  src/
    core/
      query/             — SqlQuery, params, execution, types
      schema/            — SqlTable, columns
      crud/              — Base CRUD factories (select, update, delete, insert)
      builder/           — SQL build context, tokenizer, formatter
      charms/            — info(), insertColsVals, updateSet
      utils/             — Utility types, JSON schema, caller location
    execution/           — SqlQueryPipeline, SqlQueryRegistry, AuditLogPlugin, RateLimiter
    telemetry/           — OpenTelemetry integration
    cli/
      codegen/           — Code generation commands
      exec/              — Query execution commands
    config/              — Config loading, defineConfig, defineQueryConfig
    plugin/              — VexnorPlugin base class, VexnorConnection, connect()
    remote/              — HttpRemoteClient
    format/              — SQL formatting registry
    lib/                 — Utilities (cache, queue, assertions)
    test/                — Test utilities (MockPlugin, MockQueryHandler)
```

## Subpath Exports

The `vexnor` package exposes multiple subpath exports:

| Import Path | Contents |
|-------------|----------|
| `vexnor` | Core: `sql`, `row`, `col`, `param`, `ctx`, `info`, `raw`, `connect`, types |
| `vexnor/execution` | `SqlQueryRegistry`, `SqlQueryPipeline`, `AuditLogPlugin`, `TimeToLiveRateLimiter` |
| `vexnor/telemetry` | `registerOpenTelemetry` augmentation (Node-only) |
| `vexnor/plugin` | `VexnorPlugin`, `VexnorConnection`, plugin interfaces |
| `vexnor/config` | `defineConfig`, `defineQueryConfig`, config types |
| `vexnor/testing` | `MockPlugin`, `MockQueryHandler`, test utilities |

## Contributing

- All new features require unit tests
- Use `toMatchInlineSnapshot()` for SQL output assertions
- Run `pnpm lint` and `pnpm format` before committing
- Integration tests must pass against all three databases

## License

Apache-2.0. See [LICENSE](../LICENSE).
