# Plugins & Adaptors

## Database Plugins

Each database plugin provides schema introspection, type mapping, and query execution.

| Plugin | Database | Driver |
|--------|----------|--------|
| `vexnor-postgres` | PostgreSQL | `pg` |
| `vexnor-mssql` | MS SQL Server | `mssql` |
| `vexnor-sqlite3` | SQLite | `better-sqlite3` |

See [Databases](databases.md) for setup and dialect details.

---

## ORM Adaptors

ORM adaptors let you convert existing ORM model definitions into Vexnor tables — without running codegen against a live database.

**Recommended path for long-term stability:** use `vexnor codegen` to generate mappings from your live schema. ORM-based adaptors depend on third-party ORM contracts that can change.

**Use adaptors for:** incremental adoption from an existing ORM codebase, or when you can't run codegen against a live DB.

---

## Drizzle Adaptor

**Package:** `vexnor-drizzle`

Subpath imports by database:
- `vexnor-drizzle/pg`
- `vexnor-drizzle/sqlite`
- `vexnor-drizzle/mssql`

```typescript
import { fromDrizzleTable, fromDrizzleView } from 'vexnor-drizzle/pg';
import { account, accountOrderSummary } from './drizzle-schema.js';
import { sql, row, param } from 'vexnor';
import 'vexnor-postgres';

const Account = fromDrizzleTable(account);
const AccountOrderSummary = fromDrizzleView(accountOrderSummary);

const findByEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email', {
    minLength: 5,
    pattern: /@/,
  })}
`;

const account = await findByEmail.postgres.any({
  db: pool,
  params: { email: 'john@example.com' },
});
```

---

## TypeORM Adaptor

**Package:** `vexnor-typeorm`

```typescript
import { fromTypeORM } from 'vexnor-typeorm';
import { dataSource } from './typeorm-data-source.js';
import { AccountEntity } from './account.entity.js';
import { sql, row, param } from 'vexnor';
import 'vexnor-postgres';

await dataSource.initialize();

const Account = fromTypeORM(dataSource.getRepository(AccountEntity));

const findById = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
`;

const account = await findById.postgres.any({
  db: pool,
  params: { accountId: '00000000-0000-0000-0000-000000000001' },
});
```

---

## Sequelize Adaptor

**Package:** `vexnor-sequelize`

```typescript
import { fromSequelizeTable, fromSequelizeView } from 'vexnor-sequelize';

const Account = fromSequelizeTable(AccountModel);
const AccountOrderSummary = fromSequelizeView(AccountOrderSummaryModel);
```

---

## Prisma Adaptor

**Package:** `vexnor-prisma`

Supports Prisma v6 and v7, both `prisma-client-js` and `prisma-client` generators.

### Resolve a Prisma Model

`findPrismaModel` accepts three input forms:

```typescript
import { findPrismaModel } from 'vexnor-prisma';

// Option A: dmmf — best for Prisma v6 + prisma-client-js
import { Prisma } from '@prisma/client';
const model = await findPrismaModel('Account', { dmmf: Prisma.dmmf });

// Option B: schemaPath — best for Prisma v7 + prisma-client
const model = await findPrismaModel('Account', { schemaPath: './prisma/schema.prisma' });

// Option C: in-memory schema string
const schema = await readFile('./prisma/schema.prisma', 'utf8');
const model = await findPrismaModel('Account', { schema });
```

### Build a Vexnor Table

```typescript
import { fromPrismaModelTable, fromPrismaModelView } from 'vexnor-prisma';
import type { Account, Prisma as PrismaTypes } from '@prisma/client';

const Account = fromPrismaModelTable<
  Account,
  PrismaTypes.AccountUncheckedCreateInput,
  PrismaTypes.AccountUncheckedUpdateInput
>(accountModel, { provider: 'postgresql', schema: 'public' });
```

### Version Guidance

| Prisma version | Generator | Recommended input |
|----------------|-----------|-------------------|
| v6 | `prisma-client-js` | `{ dmmf: Prisma.dmmf }` |
| v7 | `prisma-client` | `{ schemaPath }` |
| v7 | `prisma-client-js` | either — pick one and stay consistent |

For full Prisma adaptor details see `packages/vexnor-prisma/README.md`.

---

## Building a Custom Plugin

Implement the `VexnorPlugin` interface from `vexnor/plugin`:

```typescript
import { VexnorPlugin } from 'vexnor/plugin';

class MyPlugin extends VexnorPlugin<{ Connection: MyConnection; Config: MyConfig }> {
  dialect = 'postgresql';
  driver = 'my-driver';

  // Schema introspection — used by CLI codegen
  async getSchema(args): Promise<SqlSchema> { ... }

  // DB column type → TypeScript type mapping
  getColumnType(col: SqlColumnInfo): SqlColumnType { ... }

  // Optional library files to emit alongside generated table files
  getLibrary(): LibraryOutputFile[] { return []; }

  // Connection factory
  async createConnection(config: MyConfig): Promise<VexnorConnection<MyConnection>> { ... }

  // Query handler factory — called per query at runtime
  newQueryHandler<T>(query: SqlQuery<T>): SqlQueryHandler<T> { ... }
}
```

Plugins attach themselves to `SqlQuery.prototype` at import time via module augmentation, which is how `.postgres` / `.mssql` / `.sqlite` are added to every query.
