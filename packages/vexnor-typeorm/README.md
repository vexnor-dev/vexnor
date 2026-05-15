# vexnor-typeorm

TypeORM adaptor for Vexnor.

Converts TypeORM entity repositories into Vexnor runtime tables — no codegen against a live database required. Use this as an onramp from an existing TypeORM setup.

**For long-term stability**, generate mappings with `vexnor codegen` instead. ORM-based adaptors depend on TypeORM's metadata APIs which can change between versions.

## Install

```bash
npm install vexnor vexnor-typeorm
```

## Usage

Initialize your `DataSource` first, then pass a typed `Repository` to `fromTypeORM`. The entity type, table name, schema, and dialect are all inferred from the repository metadata.

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

## Views

Works the same way for view entities — pass the view repository to `fromTypeORM`. The resulting table is select-only.

```typescript
import { AccountOrderSummaryView } from './account-order-summary.view.js';

const AccountOrderSummary = fromTypeORM(dataSource.getRepository(AccountOrderSummaryView));

const summaries = await sql`
  SELECT ${row(AccountOrderSummary.$$)}
  FROM ${AccountOrderSummary}
`.postgres.all({ db: pool });
```

## Supported Databases

Dialect is inferred automatically from the TypeORM connection type:

| TypeORM type | Vexnor dialect |
|---|---|
| `postgres`, `cockroachdb`, `aurora-postgres` | `postgresql` |
| `mssql` | `tsql` |
| `sqlite`, `better-sqlite3`, `sqljs` | `sqlite` |
| `mysql`, `aurora-mysql` | `mysql` |
| `mariadb` | `mariadb` |

## API

### `fromTypeORM(repository)`

Converts a TypeORM `Repository` into a Vexnor table.

- Works with both decorator-based entities and `EntitySchema` definitions
- Virtual columns are excluded automatically
- Primary keys are detected from column metadata
- Views produce select-only tables (no insert/update/delete)

## Notes

- `dataSource.initialize()` must be called before `fromTypeORM` — entity metadata is not available until the data source is initialized
- The resulting Vexnor table uses the same column names and schema as the TypeORM entity metadata
