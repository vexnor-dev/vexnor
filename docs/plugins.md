# Plugins and Adaptors

## Database Plugins

- `vexnor-postgres`: PostgreSQL support
- `vexnor-mssql`: MS SQL Server support
- `vexnor-sqlite3`: SQLite support

Each plugin provides schema introspection, type mapping, and query execution handlers.

## Recommended Approach

For all ORM adaptors (`vexnor-drizzle`, `vexnor-typeorm`, `vexnor-sequelize`, `vexnor-prisma`):

1. Preferred: use Vexnor CLI code generation for database mapping as the long-term stable path.
2. Alternative: start from existing ORM setup via adaptor APIs for incremental adoption.

Why this split:
- CLI-generated mappings are decoupled from ORM runtime metadata APIs.
- ORM-based adaptors depend on third-party ORM contracts, which can change and require adaptor updates.

## Drizzle Adaptor

Package: `vexnor-drizzle`

Subpath imports:

- `vexnor-drizzle/pg`
- `vexnor-drizzle/sqlite`
- `vexnor-drizzle/mssql`

Use it to convert Drizzle table/view definitions into Vexnor tables without codegen.

Recommended for production stability: generate mappings via Vexnor CLI.
Use this adaptor path primarily as a migration/onramp from existing Drizzle schemas.

```typescript
import { sql, row, param } from "vexnor";
import { fromDrizzleTable, fromDrizzleView } from "vexnor-drizzle/pg";
import { account, accountOrderSummary } from "./drizzle-schema.js";
import "vexnor-postgres";
import { pool } from "./postgres-pool.js";

// table
const Account = fromDrizzleTable(account);
// view
const AccountOrderSummary = fromDrizzleView(accountOrderSummary);

const findByEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>("email", {
    minLength: 5,
    pattern: /@/,
  })}
`;

const listSummaries = sql`
  SELECT ${row(AccountOrderSummary.$$)}
  FROM ${AccountOrderSummary}
`;

const one = await findByEmail.postgres.any({
  db: pool,
  params: { email: "john@example.com" },
});

const rows = await listSummaries.postgres.all({ db: pool });
```

## TypeORM Adaptor

Package: `vexnor-typeorm`

Use `fromTypeORM(repository)` to convert TypeORM entities/views into Vexnor tables.

Recommended for production stability: generate mappings via Vexnor CLI.
Use this adaptor path primarily as a migration/onramp from existing TypeORM setups.

```typescript
import { sql, row, param } from "vexnor";
import { fromTypeORM } from "vexnor-typeorm";
import { dataSource } from "./typeorm-data-source.js";
import { AccountEntity } from "./account.entity.js";
import { AccountOrderSummaryView } from "./account-order-summary.view.js";
import "vexnor-postgres";
import { pool } from "./postgres-pool.js";

// initialize first so getRepository(...) has loaded entity/view metadata
await dataSource.initialize();

// table entity repository
const Account = fromTypeORM(dataSource.getRepository(AccountEntity));
// view entity repository
const AccountOrderSummary = fromTypeORM(dataSource.getRepository(AccountOrderSummaryView));

const findById = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId", {
    minLength: 1,
  })}
`;

const listSummaries = sql`
  SELECT ${row(AccountOrderSummary.$$)}
  FROM ${AccountOrderSummary}
`;

const one = await findById.postgres.any({
  db: pool,
  params: { accountId: "00000000-0000-0000-0000-000000000001" },
});

const rows = await listSummaries.postgres.all({ db: pool });
```

## Sequelize Adaptor

Package: `vexnor-sequelize`

Use `fromSequelizeTable(model)` for table models and `fromSequelizeView(model)` for view models.

Recommended for production stability: generate mappings via Vexnor CLI.
Use this adaptor path primarily as a migration/onramp from existing Sequelize setups.

```typescript
import { fromSequelizeTable, fromSequelizeView } from "vexnor-sequelize";
```

## Prisma Adaptor

Package: `vexnor-prisma`

Use Prisma model metadata as input and convert Prisma models into Vexnor tables.

Recommended for production stability: generate mappings via Vexnor CLI.
Use this adaptor path primarily as a migration/onramp from existing Prisma setups.

```typescript
import { fromPrismaModelTable } from "vexnor-prisma";
```

Recommended onboarding flow from an existing Prisma project:

1. Generate Prisma client (`pnpm exec prisma generate`).
2. Resolve target model metadata from your Prisma generated output.
3. Build typed Vexnor table/view with `fromPrismaModelTable` / `fromPrismaModelView`.
4. Use resulting Vexnor table in queries/CRUD flows.

Prisma v6-style metadata example:

```typescript
import { Prisma } from "@prisma/client";
import { fromPrismaModelTable } from "vexnor-prisma";

const accountModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "Account");
if (!accountModel) throw new Error("Account model not found");

const Account = fromPrismaModelTable(accountModel, {
  provider: "postgresql",
});
```

Prisma v7 note:
- The new generator shape differs from v6 and does not expose the same `Prisma.dmmf` surface by default.
- In `vexnor-prisma`, treat v7 metadata loading as generator-version specific and keep tests for both versions.

Example typing pattern:

```typescript
import type { Account, Prisma as PrismaTypes } from "@prisma/client";

type AccountSelect = Account;
type AccountInsert = PrismaTypes.AccountUncheckedCreateInput;
type AccountUpdate = PrismaTypes.AccountUncheckedUpdateInput;
```

## Building a New Plugin

Implement the `VexnorPlugin` interface from `vexnor/plugin`:

- schema introspection
- DB type -> TypeScript type mapping
- connection creation
- query handler execution
