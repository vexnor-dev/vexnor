# valnor

A type-safe SQL query generator for TypeScript that creates precise type mappings from your database schema, enabling fully type-safe SQL queries without an ORM.

[![CI](https://github.com/vexnor-dev/vexnor/actions/workflows/ci_github.yml/badge.svg)](https://github.com/vexnor-dev/vexnor/actions/workflows/ci_github.yml)
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
- ✅ **Drizzle ORM adaptor** - convert Drizzle table/view definitions to valnor tables
- ✅ **TypeORM adaptor** - convert TypeORM entities and views to valnor tables

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
npm install valnor vexnor-postgres pg

# MS SQL Server
npm install valnor vexnor-mssql mssql

# SQLite
npm install valnor vexnor-sqlite3 better-sqlite3
```

> **Note**: Install `valnor` as a regular dependency. The CLI is used for code generation during development, but the runtime library is needed in production.

### Step 2: Generate Types from Your Database

```bash
# PostgreSQL (with connection string)
npx valnor generate \
  --plugin vexnor-postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns

# PostgreSQL (with individual params)
npx valnor generate \
  --plugin vexnor-postgres \
  --schema public \
  --host localhost \
  --port 5432 \
  --database mydb \
  --user postgres \
  --password <password> \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns

# MS SQL Server
npx valnor generate \
  --plugin vexnor-mssql \
  --schema dbo \
  --host localhost \
  --port 1433 \
  --database mydb \
  --user sa \
  --password <password> \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns

# SQLite (omit migration tracking table)
npx valnor generate \
  --plugin vexnor-sqlite3 \
  --schema main \
  --uri ./database.sqlite \
  --omit migration_valnor \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns
```

### Step 3: Write Type-Safe Queries

```typescript
import { sql, param, row } from 'vexnor';
import 'vexnor-postgres';
import { Account, IAccountSelect } from './models/vexnor_dev.account-table.js';
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
`.postgres.one({ db: pool });
// newAccount type: IAccountSelect = { accountId: string, firstName: string, lastName: string, email: string, ... }

// Parameterized query with explicit param types
const findById = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ id: string }>("id")}
`;

const account = await findById.postgres.one({ 
  db: pool, 
  params: { id: newAccount.accountId }
});
// account type: IAccountSelect
```

### What You Get

- ✅ **Full auto-completion** for table names, column names, and types
- ✅ **Compile-time errors** if you reference wrong columns or types
- ✅ **Generated interfaces** for SELECT, INSERT, UPDATE operations
- ✅ **View support** — read-only tables with select-only crud
- ✅ **Helper methods** for common operations (insertColsVals, updateSet, etc.)
- ✅ **Subquery support** with type inference

## How Type Inference Works

Valnor tracks which columns you select and infers the exact result type:

### Using `row()` for multiple columns

`row()` declares the columns to SELECT and registers them for result type inference. Pass one or more column references — from a table, a subquery, or a computed value.

```typescript
import { row } from 'vexnor';

// All columns from a table
const account = await sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
`.postgres.one({ db: pool });
// Type: IAccountSelect (all columns)

// Specific columns
const partial = await sql`
  SELECT ${row(Account.$firstName, Account.$email)}
  FROM ${Account}
`.postgres.one({ db: pool });
// Type: { firstName: string, email: string }

// With aliases
const aliased = await sql`
  SELECT ${row(Account.$firstName.as('name'))}
  FROM ${Account}
`.postgres.one({ db: pool });
// Type: { name: string }

// Mixing table columns from multiple tables
const joined = await sql`
  SELECT ${row(Account.$accountId, Account.$email, Order.$orderId, Order.$status)}
  FROM ${Account}
  JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}
`.postgres.all({ db: pool });
// Type: { accountId: string, email: string, orderId: string, status: string }[]

// Columns from a table alias (self-join)
const Parent = Account.as('parent');
const withParent = await sql`
  SELECT ${row(Account.$$, Parent.$email.as('parentEmail'))}
  FROM ${Account}
  LEFT JOIN ${Parent} ON ${Parent.$accountId} = ${Account.$parentId}
`.postgres.all({ db: pool });
// Type: IAccountSelect & { parentEmail: string }[]
```

### Using `val()` for computed/aggregate values

`val` embeds a raw SQL expression as a typed column. Always use `.as<T>(key)` to give it a name and type. Can be used inside `row()` or directly in the template — both contribute to result type inference.

```typescript
import { val } from 'vexnor';

// Inside row() — mixed with table columns
const stats = await sql`
  SELECT ${row(
    Account.$accountId,
    val`COUNT(*)`.as<{ total: number }>('total')
  )}
  FROM ${Account}
  GROUP BY ${Account.$accountId}
`.postgres.all({ db: pool });
// Type: { accountId: string, total: number }[]

// Directly in template — also contributes to result type
const stats2 = await sql`
  SELECT ${Account.$accountId}, ${val`COUNT(*)`.as<{ total: number }>('total')}
  FROM ${Account}
  GROUP BY ${Account.$accountId}
`.postgres.all({ db: pool });
// Type: { accountId: string, total: number }[] — same result

// Computed expression
const result = await sql`
  SELECT ${row(
    Account.$accountId,
    val`UPPER(${Account.$email})`.as<{ emailUpper: string }>('emailUpper')
  )}
  FROM ${Account}
`.postgres.all({ db: pool });
// Type: { accountId: string, emailUpper: string }[]

// Subquery scalar
const withCount = await sql`
  SELECT ${row(
    Account.$accountId,
    Account.$email,
    val`(
      SELECT COUNT(*) FROM vexnor_dev.order o
      WHERE o.account_id = ${Account.$accountId}
    )`.as<{ orderCount: number }>('orderCount')
  )}
  FROM ${Account}
`.postgres.all({ db: pool });
// Type: { accountId: string, email: string, orderCount: number }[]
```

### Using `col()` for named column references

`col` declares a named SELECT column. Use it directly in the template to give a name and type to an expression that isn't a `val` — for example after an `AS` keyword, or to name a raw expression in a CTE's recursive part.

```typescript
import { col } from 'vexnor';

// Name an aggregate expression directly in the template
const query = sql`
  SELECT ${row(Account.$firstName, Account.$email)},
         min(${Account.$email}) as ${col<{ firstEmail: string }>("firstEmail")}
  FROM ${Account}
  GROUP BY ${Account.$email}
`;
// Type: { firstName: string, email: string, firstEmail: string }[]

// Name an expression in a recursive CTE
// (anchor is the non-recursive part of the CTE defined earlier)
const hierarchy = sql`
  ${anchor} UNION ALL
  SELECT ${row(Account.as("b").$accountId, Account.as("b").$email)},
         ${anchor.out.$depth} + 1 as ${col<{ depth: number }>("depth")}
  FROM ${Account.as("b")}
  JOIN ${anchor.out} ON ${anchor.out.$accountId} = ${Account.as("b").$parentId}
`;
// depth is typed as number in the result
```

### Accessing fields from subqueries

```typescript
const AccountChildren = sql`
  SELECT ${row(Account.as('children').$$)}
  FROM ${Account.as('children')}
  WHERE ${Account.as('children').$parentId} = ${Account.$accountId}
`;

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

- **Plugin**: `vexnor-postgres`
- **Drivers**: `pg` (node-postgres) and `postgres.js`
- **Features**: Enums, arrays, JSON aggregation, CTEs, views
- **Installation**: `npm install valnor vexnor-postgres pg`
- **Version**: 1.0.0-beta.1

**Generate types:**
```bash
npx valnor generate \
  --plugin vexnor-postgres \
  --schema public \
  --host localhost \
  --port 5432 \
  --database mydb \
  --user postgres \
  --password <password> \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns
```

### MS SQL Server

- **Plugin**: `vexnor-mssql`
- **Driver**: `mssql` (tedious)
- **Features**: OUTPUT clause, table-valued parameters, views
- **Installation**: `npm install valnor vexnor-mssql mssql`
- **Version**: 1.0.0-beta.1

**Generate types:**
```bash
npx valnor generate \
  --plugin vexnor-mssql \
  --schema dbo \
  --host localhost \
  --port 1433 \
  --database mydb \
  --user sa \
  --password <password> \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns
```

### SQLite

- **Plugin**: `vexnor-sqlite3`
- **Driver**: `better-sqlite3`
- **Features**: Lightweight, file-based, perfect for testing and embedded databases, views
- **Installation**: `npm install valnor vexnor-sqlite3 better-sqlite3`
- **Version**: 1.0.0-beta.1

**Generate types:**
```bash
npx valnor generate \
  --plugin vexnor-sqlite3 \
  --schema main \
  --uri ./database.sqlite \
  --omit migration_valnor \
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
- **View support** — generates `-view.ts` files with select-only crud
- Automatic enum type generation
- Helper methods for common operations
- Customizable naming conventions (PascalCase, camelCase)
- `--omit` flag to exclude specific tables/views from codegen

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
2. Plugin packages (`vexnor-postgres`, `vexnor-mssql`, etc.) handle:
   - Schema introspection (reading table/column/view metadata)
   - Type mapping (database types → TypeScript types)
   - Query execution (`.postgres.all()`, `.mssql.run()`, `.sqlite.one()`, etc.)
3. Generated code imports both core and plugin
4. You write SQL once, plugin handles database specifics

**Current plugins:**
- `vexnor-postgres` (v1.0.0-beta.1) - PostgreSQL via `pg` or `postgres.js` drivers
- `vexnor-mssql` (v1.0.0-beta.1) - MS SQL Server via `mssql` driver
- `vexnor-sqlite3` (v1.0.0-beta.1) - SQLite via `better-sqlite3` driver
- `vexnor-drizzle` (v1.0.0-beta.1) - Drizzle ORM adaptor (pg, sqlite, mssql)
- `vexnor-typeorm` (v1.0.0-beta.1) - TypeORM adaptor

**Coming soon:** MySQL/MariaDB, Oracle, CockroachDB

> **Note**: All packages are currently in beta. The API is stable but may have minor changes before 1.0.0 release.

### Developer Experience

- ESM and CommonJS support
- Works with existing database drivers
- No runtime overhead
- CI/CD integration ready
- Comprehensive test coverage

## Drizzle ORM Adaptor

If you already have Drizzle ORM table or view definitions, you can convert them directly to valnor tables without running codegen.

### Installation

```bash
npm install vexnor-drizzle
```

### Tables

```typescript
import { pgSchema, uuid, varchar } from 'drizzle-orm/pg-core';
import { fromDrizzleTable } from 'vexnor-drizzle/pg';

const accountDrizzle = pgSchema('public').table('account', {
  accountId: uuid('account_id').primaryKey().defaultRandom(),
  email: varchar('email').notNull(),
  firstName: varchar('first_name').notNull(),
});

export const Account = fromDrizzleTable(accountDrizzle);
// Use Account in sql`` templates exactly like a codegen'd table
```

Available subpath imports:
- `vexnor-drizzle/pg` — PostgreSQL (`drizzle-orm >= 0.30.0`)
- `vexnor-drizzle/sqlite` — SQLite (`drizzle-orm >= 0.30.0`)
- `vexnor-drizzle/mssql` — MS SQL Server (`drizzle-orm >= 1.0.0-beta.1`)

### Views

```typescript
import { pgSchema, uuid, varchar, integer } from 'drizzle-orm/pg-core';
import { fromDrizzleView } from 'vexnor-drizzle/pg';

// Call .existing() to indicate the view already exists in the DB
const accountSummaryDrizzle = pgSchema('public')
  .view('account_order_summary', {
    accountId: uuid('account_id'),
    email: varchar('email'),
    orderCount: integer('order_count'),
  })
  .existing();

export const AccountOrderSummary = fromDrizzleView(accountSummaryDrizzle);
// Select-only — insert/update/delete are disabled at the type level
```

## TypeORM Adaptor

If you already have TypeORM entities, you can convert them directly to valnor tables without running codegen.

### Installation

```bash
npm install vexnor-typeorm
```

### Usage

Pass a typed `Repository` — the entity type, table name, schema, and dialect are all inferred automatically. Works with both decorator-based entities and `EntitySchema` definitions.

```typescript
import { fromTypeORM } from 'vexnor-typeorm';

// Decorator entity — T inferred from class
const Account = fromTypeORM(dataSource.getRepository(AccountEntity));

// EntitySchema — T inferred from EntitySchema<T>
const Account = fromTypeORM(dataSource.getRepository(AccountSchema));
```

### Views

TypeORM views (both `@ViewEntity` decorator and `EntitySchema` with `type: 'view'`) are automatically detected and produce select-only valnor tables:

```typescript
@ViewEntity({ name: 'account_order_summary', schema: 'public' })
class AccountOrderSummaryEntity {
  @ViewColumn({ name: 'account_id' }) accountId!: string;
  @ViewColumn({ name: 'email' }) email!: string;
  @ViewColumn({ name: 'order_count' }) orderCount!: number;
}

const AccountOrderSummary = fromTypeORM(dataSource.getRepository(AccountOrderSummaryEntity));
// crud: { select: true, insert: false, update: false, delete: false }
```

## View Support

Valnor supports database views as first-class citizens. Views are generated as `-view.ts` files with select-only crud — `insertColsVals`, `updateSet`, and delete operations are disabled at the TypeScript level.

```typescript
// Generated: src/models/public.account_order_summary-view.ts
export const AccountOrderSummary = valnor.newSqlTable<{ Select: IAccountOrderSummarySelect }>({
  crud: { select: true, insert: false, update: false, delete: false },
  // ...
});

// Usage — only SELECT works, insert/update/delete are compile errors
const results = await sql`
  SELECT ${row(AccountOrderSummary.$$)}
  FROM ${AccountOrderSummary}
  WHERE ${AccountOrderSummary.$email} = ${'john@example.com'}
`.postgres.all({ db: pool });
```

## CRUD Handlers

Every generated table exposes a typed CRUD handler via the plugin property (`.postgres`, `.mssql`, `.sqlite`). These provide pre-built query factories for common operations — no SQL needed.

### findById / findBy

```typescript
// Find by primary key
const account = await Account.postgres.findById().any({
  db: pool,
  params: { accountId: "123" },
});
// Returns IAccountSelect | null

// Find by any column(s)
const account = await Account.postgres.findBy().any({
  db: pool,
  params: { email: "john@example.com" },
});

// Find by multiple fields
const account = await Account.postgres.findBy().any({
  db: pool,
  params: { email: "john@example.com", status: "active" },
});
```

### select

```typescript
const results = await Account.postgres.select({
  WHERE: sql`${Account.$status} = ${'active'}`,
  ORDER_BY: sql`${Account.$email} asc`,
  limit: 10,
  offset: 0,
}).all({ db: pool });
```

### insertRows

```typescript
// Single row
const inserted = await Account.postgres.insertRows().one({
  db: pool,
  params: {
    rows: [{ email: "john@example.com", firstName: "John", lastName: "Doe" }],
  },
});

// Multiple rows
const inserted = await Account.postgres.insertRows().all({
  db: pool,
  params: {
    rows: [
      { email: "john@example.com", firstName: "John", lastName: "Doe" },
      { email: "jane@example.com", firstName: "Jane", lastName: "Smith" },
    ],
  },
});
```

### update

```typescript
const updated = await Account.postgres.update({
  WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
}).one({
  db: pool,
  params: { set: { firstName: "Updated" }, id: "123" },
});
```

### delete

```typescript
const deleted = await Account.postgres.delete({
  WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
}).all({
  db: pool,
  params: { id: "123" },
});
// Returns deleted rows as IAccountSelect[]
```

### upsert

PostgreSQL uses `INSERT ... ON CONFLICT DO UPDATE`, MS SQL Server uses `MERGE`:

```typescript
// PostgreSQL — CONFLICT_ON defines the conflict target
const upserted = await Account.postgres.upsert({
  CONFLICT_ON: [Account.$accountId],
}).one({
  db: pool,
  params: {
    rows: [{ accountId: "123", email: "john@example.com", firstName: "John", lastName: "Doe" }],
  },
});

// With custom SET clause using excluded()
import { excluded } from 'vexnor';

const upserted = await Account.postgres.upsert({
  CONFLICT_ON: [Account.$accountId],
  SET: sql`${Account.$firstName} = ${excluded(Account).$firstName}`,
}).one({
  db: pool,
  params: {
    rows: [{ accountId: "123", email: "john@example.com", firstName: "Updated", lastName: "Doe" }],
  },
});

// MS SQL Server — MERGE_ON defines the match condition
const upserted = await Account.mssql.upsert({
  MERGE_ON: [Account.$accountId],
}).one({
  db: pool.request(),
  params: {
    rows: [{ accountId: "123", email: "john@example.com", firstName: "John", lastName: "Doe" }],
  },
});
```

### Execution methods

All CRUD handlers and raw `sql` queries share the same execution methods:

| Method | Returns | Throws if empty |
|--------|---------|----------------|
| `.one({ db, params? })` | `T` | Yes |
| `.any({ db, params? })` | `T \| null` | No |
| `.all({ db, params? })` | `T[]` | No |
| `.run({ db, params? })` | void/metadata | No |

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
`.postgres.one({ db: pool });

// Batch insert
const accounts = await sql`
  INSERT INTO ${Account}
    ${Account.insertColsVals(
      { firstName: "John", lastName: "Doe", email: "john@example.com" },
      { firstName: "Jane", lastName: "Smith", email: "jane@example.com" }
    )}
  RETURNING ${row(Account.$$)}
`.postgres.all({ db: pool });
```

### Parameterized Queries

```typescript
// Define once, reuse many times
const findAccountById = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
`;

const account1 = await findAccountById.postgres.one({ 
  db: pool, 
  params: { accountId: "123" } 
});
const account2 = await findAccountById.postgres.any({ 
  db: pool, 
  params: { accountId: "456" } 
});
```

### Update Operations

```typescript
const updated = await sql`
  UPDATE ${Account}
  SET ${Account.updateSet({ firstName: "John Updated" })}
  WHERE ${Account.$accountId} = ${accountId}
  RETURNING ${row(Account.$$)}
`.postgres.one({ db: pool });
```

### Subqueries with Type Inference

```typescript
import { jsonMany } from 'vexnor-postgres';

const AccountChildren = sql`
  SELECT ${row(Account.as('children').$$)}
  FROM ${Account.as('children')}
  WHERE ${Account.as('children').$parentId} = ${Account.$accountId}
  ORDER BY ${Account.as('children').$email}
`;

const accountsWithChildren = await sql`
  SELECT ${row(Account.$$)}, ${jsonMany(AccountChildren).as("children")}
  FROM ${Account} ${jsonMany(AccountChildren)}
  WHERE ${Account.$parentId} IS NULL
  ORDER BY ${Account.$email}
`.postgres.all({ db: pool });
```

### CTEs (Common Table Expressions)

CTEs are first-class citizens in valnor. Define a subquery and embed it in a `WITH` clause — the CTE name and output columns are fully typed.

```typescript
import { info } from 'vexnor';

// Simple CTE
const ActiveAccounts = sql`
  ${info({ label: "ActiveAccounts" })}
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$status} = 'active'
`;

const query = await sql`
  WITH ${ActiveAccounts}
  SELECT ${row(ActiveAccounts.$$)}
  FROM ${ActiveAccounts}
  WHERE ${ActiveAccounts.$firstName} = ${param<{ firstName: string }>("firstName")}
`.postgres.all({ db: pool, params: { firstName: "John" } });
// Type: IAccountSelect[]

// Multiple CTEs
const RecentAccounts = sql`
  ${info({ label: "RecentAccounts" })}
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$createdAt} > ${param<{ since: Date }>("since")}
`;

const combined = await sql`
  WITH ${ActiveAccounts}, ${RecentAccounts}
  SELECT ${row(ActiveAccounts.$accountId, RecentAccounts.$email)}
  FROM ${ActiveAccounts}
  JOIN ${RecentAccounts} ON ${ActiveAccounts.$accountId} = ${RecentAccounts.$accountId}
`.postgres.all({ db: pool, params: { since: new Date("2024-01-01") } });
// Type: { accountId: string, email: string }[]
```

### Recursive CTEs

`query.out` is a reference to a query that renders as just the CTE name rather than re-inlining the full SQL. In recursive CTEs, the recursive part must reference the CTE by name — `anchor.out` does exactly that.

```typescript
import { val, col, row, info } from 'vexnor';

// Define the anchor (non-recursive part)
const anchor = sql`
  SELECT ${row(Account.$$)}, ${val`0`.as<{ depth: number }>("depth")}
  FROM ${Account}
  WHERE ${Account.$parentId} IS NULL
`;

// Define the recursive part.
// anchor.out renders as the CTE name (e.g. "query_1") — not the full SQL.
// This is required for the self-reference in UNION ALL.
const hierarchy = sql`
  ${anchor} UNION ALL
  SELECT ${row(Account.as("b").$$)},
         ${anchor.out.$depth} + 1 as ${col<{ depth: number }>("depth")}
  FROM ${Account.as("b")}
  JOIN ${anchor.out} ON ${anchor.out.$accountId} = ${Account.as("b").$parentId}
`;

// Use WITH RECURSIVE
const result = await sql`
  WITH RECURSIVE ${hierarchy}
  SELECT ${row(hierarchy.$$)}
  FROM ${hierarchy}
  ORDER BY ${hierarchy.$depth}, ${hierarchy.$email}
`.postgres.all({ db: pool });
// Type: IAccountSelect & { depth: number }[]
```

### Correlated subqueries with `Table.out`

`Table.out` renders a table's columns using the **outer** query's alias rather than the subquery's own alias. Use it when a subquery needs to reference a column from the enclosing query.

```typescript
// AccountChildren references Account.out.$accountId — the outer query's account_id
const AccountChildren = sql`
  SELECT ${row(Account.as('children').$$)}
  FROM ${Account.as('children')}
  WHERE ${Account.as('children').$parentId} = ${Account.out.$accountId}
  ORDER BY ${Account.as('children').$email}
`;

// In the outer query, Account.out.$accountId resolves to "a_1"."account_id"
const query = await sql`
  SELECT ${row(Account.$$, AccountChildren.row.$accountId.as('childId'))}
  FROM ${Account}
  JOIN LATERAL (${AccountChildren}) children ON true
`.postgres.all({ db: pool });
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
npx valnor generate [options]

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
  --omit <tables...>       Table/view names to exclude from codegen
                           Accepts plain name or schema.name format
                           Example: --omit migration_valnor
                           Example: --omit public.internal_table
```

## Configuration (Optional)

Create a `vexnor.config.ts` file to store connection profiles and generation settings:

```typescript
import { defineConfig } from 'valnor/config';

export default defineConfig({
  profiles: {
    dev: {
      plugin: 'vexnor-postgres',
      connection: {
        host: 'localhost',
        database: 'mydb',
        user: 'postgres',
        password: '<password>'
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

Want to add support for a new database? Implement the `VexnorPlugin` interface:

```typescript
import { VexnorPlugin } from 'valnor/plugin';

export class MyDatabasePlugin extends VexnorPlugin<{
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
- Implement VexnorPlugin abstract class
- Provide schema introspection (tables and views)
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
│   ├── vexnor-postgres/     # PostgreSQL plugin
│   ├── vexnor-mssql/        # MS SQL Server plugin
│   ├── vexnor-sqlite3/      # SQLite3 plugin
│   ├── vexnor-drizzle/      # Drizzle ORM adaptor (pg/sqlite/mssql)
│   └── vexnor-typeorm/      # TypeORM adaptor
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
- E2E tests for Drizzle and TypeORM adaptors
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

- Report bugs via [GitHub Issues](https://github.com/vexnor-dev/vexnor/issues)
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
- `packages/valnor-*/` - Database plugins and adaptors
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
**Repository**: https://github.com/vexnor-dev/vexnor  
**Issues**: https://github.com/vexnor-dev/vexnor/issues  
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
- **CI/CD**: [![CI](https://github.com/vexnor-dev/vexnor/actions/workflows/ci_github.yml/badge.svg)](https://github.com/vexnor-dev/vexnor/actions/workflows/ci_github.yml)
- **Package Manager**: pnpm (monorepo)
- **Test Coverage**: Comprehensive integration tests with real databases
