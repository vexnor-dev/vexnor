# Monorepo and Development

This repository is a `pnpm` monorepo.

## Layout

```text
packages/
  vexnor/
  vexnor-postgres/
  vexnor-mssql/
  vexnor-sqlite3/
  vexnor-drizzle/
  vexnor-typeorm/

tests/
  vexnor-test-postgres/
  vexnor-test-mssql/
  vexnor-test-sqlite3/

@db-postgres/
@db-mssql/
@db-sqlite3/
examples/
```

## Prerequisites

- Node.js `>=22.21.1`
- pnpm `>=10.17.0`

## Common Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm format
pnpm db-migrate
```

Note: `pnpm codegen` is not a root script; code generation commands are run per package/test context where needed.
