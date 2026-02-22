# valnor

A type-safe SQL query generator for TypeScript that creates precise type mappings from your database schema, enabling fully type-safe SQL queries without an ORM.

[![CI](https://github.com/atopala/valnor/actions/workflows/ci_github.yml/badge.svg)](https://github.com/atopala/valnor/actions/workflows/ci_github.yml)
[![npm version](https://img.shields.io/npm/v/valnor.svg)](https://www.npmjs.com/package/valnor)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## What is Valnor?

Valnor generates TypeScript types from your database schema, allowing you to write real SQL with full type safety and auto-completion. It's not an ORM - just TypeScript types that make your SQL queries type-safe.

**Key Benefits:**
- ✅ Write SQL you already know, get TypeScript safety for free
- ✅ Two-step process: generate types once, write queries forever
- ✅ **No repository layer needed** - queries are self-documenting and type-safe
- ✅ Works with your existing database and drivers
- ✅ Zero runtime overhead

### Why Valnor vs ORMs/Query Builders?

- **No abstraction layer** - Write actual SQL, not a DSL
- **No repository boilerplate** - Queries define their own types
- **No learning curve** - If you know SQL, you're ready
- **Full SQL power** - CTEs, window functions, complex joins - everything works
- **Type safety without overhead** - Generated types, zero runtime cost

## Quick Start

### Step 1: Install

```bash
# PostgreSQL
npm install valnor valnor-postgres pg

# MS SQL Server
npm install valnor valnor-mssql mssql

# SQLite
npm install valnor valnor-sqlite3 better-sqlite3
```

> **Note**: Install `valnor` as a regular dependency. The CLI is used for code generation during development, but the runtime library is needed in production.

### Step 2: Generate Types from Your Database

```bash
# PostgreSQL (with connection string)
npx valnor generate \
  --plugin valnor-postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns

# PostgreSQL (with individual params)
npx valnor generate \
  --plugin valnor-postgres \
  --schema public \
  --host localhost \
  --port 5432 \
  --database mydb \
  --user postgres \
  --password password \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns

# MS SQL Server
npx valnor generate \
  --plugin valnor-mssql \
  --schema dbo \
  --host localhost \
  --port 1433 \
  --database mydb \
  --user sa \
  --password password \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns

# SQLite
npx valnor generate \
  --plugin valnor-sqlite3 \
  --schema main \
  --uri ./database.sqlite \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns
```

### Step 3: Write Type-Safe Queries

```typescript
import { sql, param, row } from 'valnor';
import valnorPostgres from 'valnor-postgres';
import { Account, IAccountSelect } from './models/valnor_test.account-table.js';
import { Pool } from 'pg';

const pool = new Pool({ /* config */ });

// Type-safe insert
const newAccount = await sql`
  INSERT INTO ${Account}
    ${Account.insertColsVals({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com"
    })}
  RETURNING ${row(Account.$$)}
`.postgres.getOneRequired({ db: pool });
// newAccount type: IAccountSelect = { accountId: string, firstName: string, lastName: string, email: string, ... }

// Parameterized query with explicit param types
const findById = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ id: string }>("id")}
`;
// findById requires params: { id: string }
// findById returns: IAccountSelect

const account = await findById.postgres.getOneRequired({ 
  db: pool, 
  params: { id: newAccount.accountId }  // TypeScript validates this matches { id: string }
});
// account type: IAccountSelect
```

### What You Get

- ✅ **Full auto-completion** for table names, column names, and types
- ✅ **Compile-time errors** if you reference wrong columns or types
- ✅ **Generated interfaces** for SELECT, INSERT, UPDATE operations
- ✅ **Helper methods** for common operations (insertColsVals, updateSet, etc.)
- ✅ **Subquery support** with type inference

## How Type Inference Works

Valnor tracks which columns you select and infers the exact result type:

### Using `row()` for multiple columns

```typescript
import { row } from 'valnor';

// All columns
const account = await sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
`.postgres.getOneRequired({ db: pool });
// Type: IAccountSelect (all columns)

// Specific columns
const partial = await sql`
  SELECT ${row(Account.$firstName, Account.$email)}
  FROM ${Account}
`.postgres.getOneRequired({ db: pool });
// Type: { firstName: string, email: string }

// With aliases
const aliased = await sql`
  SELECT ${row(Account.$firstName.as('name'))}
  FROM ${Account}
`.postgres.getOneRequired({ db: pool });
// Type: { name: string }
```

### Using `val()` for computed/aggregate values

```typescript
import { val } from 'valnor';

// Aggregate with type annotation
const stats = await sql`
  SELECT ${row(
    Account.$accountId,
    val`COUNT(*)`.as<{ total: number }>('total')
  )}
  FROM ${Account}
  GROUP BY ${Account.$accountId}
`.postgres.getAll({ db: pool });
// Type: { accountId: string, total: number }[]

// JSON aggregation
const result = await sql`
  SELECT ${val`json_agg(name)`.as<{ names: string[] }>('names')}
  FROM ${Account}
`.postgres.getOneRequired({ db: pool });
// Type: { names: string[] }
```

### Accessing fields from subqueries

```typescript
// Define subquery with row()
const AccountChildren = sql`
  SELECT ${row(Account.as('children').$$)}
  FROM ${Account.as('children')}
  WHERE ${Account.as('children').$parentId} = ${Account.$accountId}
`;

// Access subquery fields in parent query
const query = sql`
  SELECT ${row(
    Account.$$,
    AccountChildren.row.$accountId.as('childId'),
    AccountChildren.row.$email.as('childEmail')
  )}
  FROM ${Account}
  JOIN LATERAL (${AccountChildren}) children ON true
`;
// Type includes: accountId, firstName, ..., childId, childEmail
```

## Supported Databases

### PostgreSQL

- **Plugin**: `valnor-postgres`
- **Drivers**: `pg` (node-postgres) and `postgres.js`
- **Features**: Enums, arrays, JSON aggregation, CTEs
- **Installation**: `npm install valnor valnor-postgres pg`
- **Version**: 1.0.0-beta.1

**Generate types:**
```bash
npx valnor generate \
  --plugin valnor-postgres \
  --schema public \
  --host localhost \
  --port 5432 \
  --database mydb \
  --user postgres \
  --password password \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns
```

### MS SQL Server

- **Plugin**: `valnor-mssql`
- **Driver**: `mssql` (tedious)
- **Features**: OUTPUT clause, table-valued parameters
- **Installation**: `npm install valnor valnor-mssql mssql`
- **Version**: 1.0.0-beta.1

**Generate types:**
```bash
npx valnor generate \
  --plugin valnor-mssql \
  --schema dbo \
  --host localhost \
  --port 1433 \
  --database mydb \
  --user sa \
  --password YourPassword \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns
```

### SQLite

- **Plugin**: `valnor-sqlite3`
- **Driver**: `better-sqlite3`
- **Features**: Lightweight, file-based, perfect for testing and embedded databases
- **Installation**: `npm install valnor valnor-sqlite3 better-sqlite3`
- **Version**: 1.0.0-beta.1

**Generate types:**
```bash
npx valnor generate \
  --plugin valnor-sqlite3 \
  --schema main \
  --uri ./database.sqlite \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns
```

## Core Features

### Type Safety

- Full TypeScript support for tables, columns, and views
- Compile-time validation of column names
- Type inference for query results
- Parameterized queries with type checking

### Code Generation

- Generates TypeScript interfaces for SELECT/INSERT/UPDATE
- Automatic enum type generation
- Helper methods for common operations
- Customizable naming conventions (PascalCase, camelCase)

### Query Building

- Template literal syntax (familiar SQL)
- Subquery composition with type inference
- CTE (Common Table Expression) support
- JSON aggregation helpers (PostgreSQL)

### Plugin Architecture

- **Separate packages per database** - Core library stays lightweight
- **Consistent API across databases** - Same query syntax, different execution
- **Database-specific features** - Each plugin exposes native capabilities (PostgreSQL enums, MSSQL OUTPUT clause, etc.)
- **Easy to extend** - Add support for any database by implementing the plugin interface

**How it works:**
1. Core library (`valnor`) provides SQL builder and type system
2. Plugin packages (`valnor-postgres`, `valnor-mssql`, etc.) handle:
   - Schema introspection (reading table/column metadata)
   - Type mapping (database types → TypeScript types)
   - Query execution (`.postgres.getAll()`, `.mssql.run()`, etc.)
3. Generated code imports both core and plugin
4. You write SQL once, plugin handles database specifics

**Current plugins:**
- `valnor-postgres` (v1.0.0-beta.1) - PostgreSQL via `pg` or `postgres.js` drivers
- `valnor-mssql` (v1.0.0-beta.1) - MS SQL Server via `mssql` driver  
- `valnor-sqlite3` (v1.0.0-beta.1) - SQLite via `better-sqlite3` driver

**Coming soon:** MySQL/MariaDB, Oracle, CockroachDB

> **Note**: All packages are currently in beta. The API is stable but may have minor changes before 1.0.0 release.

### Developer Experience

- ESM and CommonJS support
- Works with existing database drivers
- No runtime overhead
- CI/CD integration ready
- Comprehensive test coverage

## Common Patterns

### Insert Operations

```typescript
// Single insert
const account = await sql`
  INSERT INTO ${Account}
    ${Account.insertColsVals({ 
      firstName: "John", 
      lastName: "Doe",
      email: "john@example.com" 
    })}
  RETURNING ${row(Account.$$)}
`.postgres.getOneRequired({ db: pool });

// Batch insert
const accounts = await sql`
  INSERT INTO ${Account}
    ${Account.insertColsVals(
      { firstName: "John", lastName: "Doe", email: "john@example.com" },
      { firstName: "Jane", lastName: "Smith", email: "jane@example.com" }
    )}
  RETURNING ${row(Account.$$)}
`.postgres.getAll({ db: pool });
```

### Parameterized Queries

```typescript
// Define once, reuse many times
const findAccountById = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
`;

// Execute with different params
const account1 = await findAccountById.postgres.getOneRequired({ 
  db: pool, 
  params: { accountId: "123" } 
});
const account2 = await findAccountById.postgres.getOneOptional({ 
  db: pool, 
  params: { accountId: "456" } 
});
```

### Update Operations

```typescript
const updated = await sql`
  UPDATE ${Account}
  SET ${Account.$firstName} = ${'John Updated'}
  WHERE ${Account.$accountId} = ${accountId}
  RETURNING ${row(Account.$$)}
`.postgres.getOneRequired({ db: pool });
```

### Subqueries with Type Inference

```typescript
import { jsonMany } from 'valnor-postgres';

// Define reusable subquery
const AccountChildren = sql`
  SELECT ${row(Account.as('children').$$)}
  FROM ${Account.as('children')}
  WHERE ${Account.as('children').$parentId} = ${Account.$accountId}
  ORDER BY ${Account.as('children').$email}
`;

// Use in main query - types flow through!
const accountsWithChildren = await sql`
  SELECT ${row(Account.$$)}, ${jsonMany(AccountChildren).as("children")}
  FROM ${Account} ${jsonMany(AccountChildren)}
  WHERE ${Account.$parentId} IS NULL
  ORDER BY ${Account.$email}
`.postgres.getAll({ db: pool });
```

## Example Projects

- **[postgres-esm](examples/postgres-esm/)** - Full ESM example with PostgreSQL
  - Complete setup with code generation
  - CRUD operations
  - Subqueries and JSON aggregation
  - Parameterized queries

- **[postgres-cjs](examples/postgres-cjs/)** - CommonJS example
  - Shows CommonJS compatibility
  - Same features as ESM

## CLI Reference

### Generate Command

```bash
valnor generate [options]

Options:
  --plugin <name>          Plugin package name (required)
  --schema <name>          Database schema name (can specify multiple)
  --uri <connection>       Database connection URI
  --host <host>            Database host
  --port <port>            Database port
  --database <name>        Database name
  --user <username>        Database user
  --password <password>    Database password
  --outDir <path>          Output directory for generated files
  --pascalCaseTables       Use PascalCase for table names
  --camelCaseColumns       Use camelCase for column names
```

## Configuration (Optional)

Create a `valnor.config.ts` file to store connection profiles and generation settings:

```typescript
import { defineConfig } from 'valnor/config';

export default defineConfig({
  profiles: {
    dev: {
      plugin: 'valnor-postgres',
      connection: {
        host: 'localhost',
        database: 'mydb',
        user: 'postgres',
        password: 'password'
      }
    }
  },
  generate: {
    schemas: ['public'],
    outDir: 'src/models',
    pascalCaseTables: true,
    camelCaseColumns: true
  }
});
```



## Advanced: Plugin Development

Want to add support for a new database? Implement the `ValnorPlugin` interface:

```typescript
import { ValnorPlugin } from 'valnor/plugin';

export class MyDatabasePlugin extends ValnorPlugin<{
  Connection: MyDbConnection;
  Config: MyDbConfig;
}> {
  readonly driver = 'my-database';
  
  async getSchema(args) { /* Extract schema metadata */ }
  getColumnType(col) { /* Map DB types to TS types */ }
  getLibrary() { /* Inject custom code */ }
  async createConnection(config) { /* Create connection */ }
  newQueryHandler(query) { /* Handle query execution */ }
}
```

**Plugin Requirements:**
- Implement ValnorPlugin abstract class
- Provide schema introspection
- Map database types to TypeScript types
- Implement query execution handlers
- Register plugin with core

**Distribution:**
- Publish as separate npm package
- Name convention: `valnor-{database}`
- Include peer dependencies for database driver
- Provide README with usage examples

## Monorepo Architecture

This repository is organized as a monorepo with multiple packages:

```
valnor-root/
├── packages/
│   ├── valnor/              # Core library & CLI
│   ├── valnor-postgres/     # PostgreSQL plugin
│   ├── valnor-mssql/        # MS SQL Server plugin
│   └── valnor-sqlite3/      # SQLite3 plugin
├── examples/                # Example projects
├── tests/                   # Integration test suites
└── @db-*/                   # Database migration scripts
```

### Development Setup

**Prerequisites:**
- Node.js >= 18.0.0 (recommended: >= 22.0.0)
- pnpm >= 10.17.0
- Docker (optional, for running test databases)

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run database migrations (requires PostgreSQL, MSSQL, SQLite)
pnpm db-migrate

# Generate types from test databases
pnpm codegen

# Run tests
pnpm test

# Lint and format
pnpm lint
pnpm format
```

**Testing Strategy:**
- Unit tests for core functionality (Vitest)
- Integration tests per plugin with real databases
- E2E tests with real databases (PostgreSQL, MSSQL, SQLite)
- Test databases in `@db-*` directories
- Migration scripts with postgrator-cli
- CI/CD with GitHub Actions

## Roadmap

### Current Status: v1.0.0-beta.1

Valnor is currently in beta. The core functionality is stable and ready for use, but we're gathering feedback before the 1.0.0 release.

### Upcoming Features (v1.0.0)

- **Query Execution CLI** (`valnor exec`) - [Spec available](EXEC_FEATURE_SPECS.md)
  - Execute queries from TypeScript files
  - Interactive parameter collection
  - Multiple output formats (table, JSON, CSV)
  - Profile-based configuration
  - Environment support (dev, staging, prod)
  - Dry-run and SQL-only modes
  
- **Additional Database Support**
  - MySQL/MariaDB plugin
  - Oracle plugin
  - CockroachDB support

### Planned Improvements (v1.1+)

- Schema migration tracking
- Query performance analysis and EXPLAIN support
- Visual query builder
- Database comparison tools
- Watch mode for development
- Transaction support for multiple queries

## Contributing

Contributions are welcome! Here's how you can help:

- Report bugs via [GitHub Issues](https://github.com/atopala/valnor/issues)
- Submit feature requests
- Create pull requests
- Improve documentation
- Write plugins for new databases
- Share your use cases and feedback

**Development Process:**
1. Fork the repository
2. Clone and install dependencies (`pnpm install`)
3. Set up test databases (see `@db-*` directories)
4. Create feature branch (`git checkout -b feature/my-feature`)
5. Write tests for changes
6. Run tests (`pnpm test`)
7. Ensure code quality (`pnpm lint`, `pnpm format`)
8. Submit PR with clear description

**Code Standards:**
- TypeScript strict mode enabled
- ESLint + Prettier formatting (enforced)
- Comprehensive test coverage for new features
- Update documentation (README)
- Follow existing code patterns
- Add JSDoc comments for public APIs

**Project Structure:**
- `packages/valnor/` - Core library and CLI
- `packages/valnor-*/` - Database plugins
- `tests/` - Integration test suites
- `examples/` - Example projects
- `@db-*/` - Test database schemas and migrations

## Requirements

- **Node.js**: >= 18.0.0 (recommended: >= 22.0.0)
- **TypeScript**: >= 5.0.0
- **Package Manager**: npm, pnpm, or yarn

## License

Apache-2.0 - See [LICENSE](LICENSE) file for details.

## Credits

**Author**: Adrian Topala  
**Repository**: https://github.com/atopala/valnor  
**Issues**: https://github.com/atopala/valnor/issues  
**NPM**: https://www.npmjs.com/package/valnor

## Support

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community support (coming soon)
- **Examples**: Sample projects in [examples/](examples/)

## Acknowledgments

Valnor is inspired by the need for type-safe SQL in TypeScript without the overhead of ORMs. Special thanks to the TypeScript and database driver communities for their excellent tools and libraries.

## Status

- **Version**: 1.0.0-beta.1
- **Status**: Beta (stable API, gathering feedback)
- **CI/CD**: [![CI](https://github.com/atopala/valnor/actions/workflows/ci_github.yml/badge.svg)](https://github.com/atopala/valnor/actions/workflows/ci_github.yml)
- **Package Manager**: pnpm (monorepo)
- **Test Coverage**: Comprehensive integration tests with real databases
