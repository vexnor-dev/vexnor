# vexnor

A type-safe SQL query generator for TypeScript that gives you typed SQL without an ORM abstraction layer.

[![CI](https://github.com/vexnor-dev/vexnor/actions/workflows/ci_github.yml/badge.svg)](https://github.com/vexnor-dev/vexnor/actions/workflows/ci_github.yml)
[![npm version](https://img.shields.io/npm/v/vexnor.svg)](https://www.npmjs.com/package/vexnor)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## What Is Vexnor?

Vexnor generates TypeScript types from your database schema, so you can write real SQL with full type safety and auto-completion. It is not an ORM abstraction layer.

**Key benefits:**
- Write SQL you already know, with compile-time safety
- Generate types once, then reuse them across queries
- No repository-layer boilerplate required
- Works with existing drivers and databases
- Zero runtime overhead from type generation
- Includes Drizzle and TypeORM adaptors

### Why vs ORMs/Query Builders?

- No DSL abstraction between you and SQL
- No forced repository pattern
- Full SQL support (CTEs, windows, complex joins)
- Strong type inference for params and result shapes

## Start Here

If you want to adopt Vexnor quickly:

1. Install packages for your database.
2. Generate types from your schema.
3. Write SQL with typed columns/results.

```bash
# PostgreSQL
npm install vexnor vexnor-postgres pg

# Generate types
npx vexnor codegen \
  --plugin vexnor-postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns
```

```typescript
import { sql, row, param } from 'vexnor';
import 'vexnor-postgres';
import { Account } from './models/public.account-table.js';
import { Pool } from 'pg';

const pool = new Pool({ /* connection config */ });
const activeStatus = 'ACTIVE';

// column convention: DB account_id -> Account.$accountId in Vexnor
// row(Account.$accountId, Account.$email) selects only these two columns
const ActiveAccounts = sql`
  SELECT ${row(Account.$accountId, Account.$email)}
  FROM ${Account}
  WHERE ${Account.$status} = ${activeStatus}
`;

const findActiveById = sql`
  SELECT ${row(ActiveAccounts.$$)}
  FROM ${ActiveAccounts}
  WHERE ${ActiveAccounts.$accountId} = ${param<{ accountId: string }>('accountId', {
    minLength: 1,
  })}
`;

const account = await findActiveById.postgres.one({
  db: pool,
  params: { accountId: '00000000-0000-0000-0000-000000000001' },
});
// expected row structure: only accountId and email
const accountRow: { accountId: string; email: string } = account;
// @ts-expect-error property should not exist in this query result
account.firstName;
```

```typescript
// CRUD helper path (common usage): typed findBy query factory
const byEmail = await Account.postgres.findBy().any({
  db: pool,
  params: { email: 'john@example.com' },
});
// byEmail type: IAccountSelect | null
```

### Value Injection vs `param()`

Both styles are safe: values are bound as SQL parameters at execution time.

- Inline value injection (`${value}`) is best for local query composition.
- Named params (`param()`) define a reusable, typed query input contract (`params`) and support runtime validation.

```typescript
const status = "ACTIVE"; // inline value injection

const query = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$status} = ${status}
    AND ${Account.$accountId} = ${param<{ accountId: string }>("accountId", { minLength: 1 })}
`;

// repository-like reusable query API, no wrapper repository method needed
const row1 = await query.postgres.one({
  db: pool,
  params: { accountId: "00000000-0000-0000-0000-000000000001" },
});
```

## Choose Your Path

- App adoption (core flow): this README + [Examples](examples/)
- Drizzle users: [Drizzle adaptor](docs/plugins.md#drizzle-adaptor)
- TypeORM users: [TypeORM adaptor](docs/plugins.md#typeorm-adaptor)
- CLI usage and query execution: [CLI docs](docs/cli.md)
- CRUD query factories: [CRUD docs](docs/crud.md)
- CTE/recursive patterns: [CTE docs](docs/ctes.md)
- Monorepo/dev workflow: [Monorepo docs](docs/monorepo.md)

## Why Vexnor

- Write real SQL, not a query DSL
- Compile-time safety for columns/params/results
- Zero runtime overhead from type machinery
- Works with your existing DB drivers
- Supports PostgreSQL, MS SQL Server, and SQLite

## Param Validation

You can attach runtime validation directly to `param(...)`.

```typescript
const findByEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email', {
    minLength: 5,
    pattern: /@/,
  })}
`;
```

Supported rule families are type-aware:

- `string`: `minLength`, `maxLength`, `pattern`
- `number` / `Date`: `min`, `max`
- `array`: `minLength`, `maxLength`
- any type: `enum`, `validate(value) => boolean | string`

At runtime, missing or `undefined` param values are normalized to `null` before binding.

## Supported Databases

- PostgreSQL: `vexnor-postgres` + `pg` (or postgres.js)
- MS SQL Server: `vexnor-mssql` + `mssql`
- SQLite: `vexnor-sqlite3` + `better-sqlite3`

## Examples

- [examples/postgres-esm](examples/postgres-esm/)
- [examples/postgres-cjs](examples/postgres-cjs/)

## Contributing

Contributor setup and repository layout are documented in [docs/monorepo.md](docs/monorepo.md).

## Requirements

- Node.js `>=22.21.1`
- pnpm `>=10.17.0` (for repo development)

## License

Apache-2.0. See [LICENSE](LICENSE).
