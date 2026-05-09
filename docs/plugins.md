# Plugins and Adaptors

## Database Plugins

- `vexnor-postgres`: PostgreSQL support
- `vexnor-mssql`: MS SQL Server support
- `vexnor-sqlite3`: SQLite support

Each plugin provides schema introspection, type mapping, and query execution handlers.

## Drizzle Adaptor

Package: `vexnor-drizzle`

Subpath imports:

- `vexnor-drizzle/pg`
- `vexnor-drizzle/sqlite`
- `vexnor-drizzle/mssql`

Use it to convert Drizzle table/view definitions into Vexnor tables without codegen.

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

```typescript
import { fromSequelizeTable, fromSequelizeView } from "vexnor-sequelize";
```

## Prisma Adaptor

Package: `vexnor-prisma`

Use Prisma DMMF metadata as input and convert Prisma models into Vexnor tables.

```typescript
import { Prisma } from "@prisma/client";
import { fromPrismaModelTable } from "vexnor-prisma";

const accountModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "Account");
if (!accountModel) throw new Error("Account model not found");

const Account = fromPrismaModelTable(accountModel, {
  provider: "postgresql",
});
```

## Building a New Plugin

Implement the `VexnorPlugin` interface from `vexnor/plugin`:

- schema introspection
- DB type -> TypeScript type mapping
- connection creation
- query handler execution
