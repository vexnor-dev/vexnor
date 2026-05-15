# vexnor-drizzle

Drizzle ORM adaptor for Vexnor.

Converts Drizzle table and view definitions into Vexnor runtime tables — no codegen against a live database required. Use this as an onramp from an existing Drizzle schema.

**For long-term stability**, generate mappings with `vexnor codegen` instead. ORM-based adaptors depend on Drizzle's internal APIs which can change between versions.

## Install

```bash
npm install vexnor vexnor-drizzle
```

## Subpath Imports

Import from the subpath matching your database:

```typescript
import { fromDrizzleTable, fromDrizzleView } from 'vexnor-drizzle/pg';     // PostgreSQL
import { fromDrizzleTable, fromDrizzleView } from 'vexnor-drizzle/sqlite'; // SQLite
import { fromDrizzleTable } from 'vexnor-drizzle/mssql';                   // MS SQL Server
```

## PostgreSQL

```typescript
import { fromDrizzleTable, fromDrizzleView } from 'vexnor-drizzle/pg';
import { pgSchema, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql, row, param } from 'vexnor';
import 'vexnor-postgres';

const schema = pgSchema('public');

const accountDrizzle = schema.table('account', {
  accountId: uuid('account_id').primaryKey(),
  email: varchar('email').notNull(),
  firstName: varchar('first_name').notNull(),
});

const accountOrderSummary = schema
  .view('account_order_summary', {
    accountId: uuid('account_id'),
    email: varchar('email'),
    orderCount: uuid('order_count'),
  })
  .existing();

const Account = fromDrizzleTable(accountDrizzle);
const AccountOrderSummary = fromDrizzleView(accountOrderSummary);

const findByEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email')}
`;

const account = await findByEmail.postgres.any({ db: pool, params: { email: 'jane@example.com' } });
```

## SQLite

```typescript
import { fromDrizzleTable } from 'vexnor-drizzle/sqlite';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql, row } from 'vexnor';
import 'vexnor-sqlite3';

const accountDrizzle = sqliteTable('account', {
  accountId: text('account_id').primaryKey(),
  email: text('email').notNull(),
});

const Account = fromDrizzleTable(accountDrizzle);

const accounts = await sql`
  SELECT ${row(Account.$$)} FROM ${Account}
`.sqlite.all({ db });
```

## MS SQL Server

```typescript
import { fromDrizzleTable } from 'vexnor-drizzle/mssql';
import { mssqlTable, uniqueidentifier, varchar } from 'drizzle-orm/mssql-core';
import { sql, row } from 'vexnor';
import 'vexnor-mssql';

const accountDrizzle = mssqlTable('account', {
  accountId: uniqueidentifier('account_id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
});

// Pass schema as second argument when needed
const Account = fromDrizzleTable(accountDrizzle, 'dbo');

const accounts = await sql`
  SELECT ${row(Account.$$)} FROM ${Account}
`.mssql.all({ db: pool });
```

## API

### `fromDrizzleTable(table, schema?)`

Converts a Drizzle table definition into a Vexnor table with full CRUD support (`select`, `insert`, `update`, `delete`).

- `table` — a Drizzle table definition
- `schema` — optional schema name override (defaults to the schema defined on the Drizzle table)

### `fromDrizzleView(view, schema?)` (pg / sqlite only)

Converts a Drizzle view definition into a Vexnor table (select-only). Call `.existing()` on the view builder before passing it here.

- `view` — a Drizzle view definition with `.existing()` applied
- `schema` — optional schema name override

## Notes

- Requires `drizzle-orm >= 1.0.0-beta.1` for MSSQL support
- Column JS keys and SQL names are inferred directly from the Drizzle table definition
- Primary keys are detected from both column-level and table-level `primaryKey()` definitions
