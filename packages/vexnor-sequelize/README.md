# vexnor-sequelize

Sequelize adaptor for Vexnor.

Converts Sequelize model definitions into Vexnor runtime tables — no codegen against a live database required. Use this as an onramp from an existing Sequelize setup.

**For long-term stability**, generate mappings with `vexnor codegen` instead. ORM-based adaptors depend on Sequelize's metadata APIs which can change between versions.

## Install

```bash
npm install vexnor vexnor-sequelize
```

## Usage

Pass a Sequelize `ModelStatic` to `fromSequelizeTable` or `fromSequelizeView`. The Sequelize instance must be initialized before calling either function.

```typescript
import { fromSequelizeTable, fromSequelizeView } from 'vexnor-sequelize';
import { AccountModel } from './account.model.js';
import { AccountOrderSummaryModel } from './account-order-summary.model.js';
import { sql, row, param } from 'vexnor';
import 'vexnor-postgres';

const Account = fromSequelizeTable(AccountModel);
const AccountOrderSummary = fromSequelizeView(AccountOrderSummaryModel);

const findByEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email')}
`;

const account = await findByEmail.postgres.any({
  db: pool,
  params: { email: 'jane@example.com' },
});

const summaries = await sql`
  SELECT ${row(AccountOrderSummary.$$)}
  FROM ${AccountOrderSummary}
`.postgres.all({ db: pool });
```

## Schema Override

Pass a schema name as the second argument to override the schema inferred from the model:

```typescript
const Account = fromSequelizeTable(AccountModel, 'public');
const AccountOrderSummary = fromSequelizeView(AccountOrderSummaryModel, 'public');
```

## Supported Databases

Dialect is inferred automatically from the Sequelize instance dialect:

| Sequelize dialect | Vexnor dialect |
|---|---|
| `postgres` | `postgresql` |
| `mssql` | `tsql` |
| `sqlite` | `sqlite` |
| `mysql` | `mysql` |
| `mariadb` | `mariadb` |

## API

### `fromSequelizeTable(model, schema?)`

Converts a Sequelize table model into a Vexnor table with full CRUD support (`select`, `insert`, `update`, `delete`).

- Column JS keys and SQL field names are inferred from `model.getAttributes()`
- Primary keys are inferred from `model.primaryKeyAttributes`
- Schema is inferred from `model.getTableName()` or overridden via the second argument

### `fromSequelizeView(model, schema?)`

Converts a Sequelize view model into a Vexnor table (select-only).

## Notes

- The Sequelize model must be associated with a Sequelize instance (`model.sequelize` must be set) before calling either function
- Virtual fields and associations are not included — only persisted columns from `getAttributes()`
