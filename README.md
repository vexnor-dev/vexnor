# vexnor

Write real SQL. Get typed results. No ORM, no DSL, no repository boilerplate.

Vexnor generates TypeScript types from your database schema and makes queries first-class objects — composable, reusable, and executable directly. The query is the repository.

[![CI](https://github.com/vexnor-dev/vexnor/actions/workflows/ci_github.yml/badge.svg)](https://github.com/vexnor-dev/vexnor/actions/workflows/ci_github.yml)
[![npm version](https://img.shields.io/npm/v/vexnor.svg)](https://www.npmjs.com/package/vexnor)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Install

```bash
# PostgreSQL
npm install vexnor vexnor-postgres pg

# MS SQL Server
npm install vexnor vexnor-mssql mssql

# SQLite
npm install vexnor vexnor-sqlite3 better-sqlite3
```

Generate types from your schema:

```bash
npx vexnor codegen \
  --plugin vexnor-postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns
```

## What It Looks Like

### Queries

```typescript
import { Account, Order, OrderItem } from './models/vexnor_dev.schema.js';
import { sql, row, param, col } from 'vexnor';
import { jsonMany } from 'vexnor-postgres';
import 'vexnor-postgres';

// A typed, reusable subquery
const AccountOrders = sql`
  SELECT ${row(Order.$orderId, Order.$status, Order.$createdAt)},
         ${jsonMany(OrderItem).as('items')}
  FROM ${Order} ${jsonMany(OrderItem)}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
  ORDER BY ${Order.$createdAt} DESC
  LIMIT ${param<{ limit: number }>('limit')}
`;

// Compose into a parent query — this IS your repository
const findActiveAccountsWithOrders = sql`
  SELECT ${row(Account.$accountId, Account.$email)},
         count(distinct ${Order.$orderId}) as ${col<{ orderCount: number }>('orderCount')},
         ${jsonMany(AccountOrders).as('orders')}
  FROM ${Account} ${jsonMany(AccountOrders)}
  WHERE ${Account.$status} = ${'ACTIVE'}
  GROUP BY ${Account.$accountId}, ${Account.$email}
`;

// Execute directly — no wrapper needed
const accounts = await findActiveAccountsWithOrders.postgres.all({
  db: pool,
  params: { limit: 5 },
});

// Result type is inferred from exactly what you selected
const typed: {
  accountId: string;
  email: string;
  orderCount: number;
  orders: { orderId: string; status: string; createdAt: Date; items: IOrderItemSelect[] }[];
} = accounts[0]!;

// @ts-expect-error — lastName was not selected
accounts[0]!.lastName;
```

### CRUD

The same `AccountOrders` subquery, reused with the CRUD `select()` factory:

```typescript
// No SQL needed for the common case
const accounts = await Account.postgres.select({
  WHERE: sql`${Account.$status} = ${'ACTIVE'}`,
  GROUP_BY: sql`${Account.$accountId}, ${Account.$email}`,
  includeMany: { orders: AccountOrders },
}).all({
  db: pool,
  params: { limit: 5 },
});
// (IAccountSelect & { orders: IOrderSelect[] })[]

// INSERT
const inserted = await Account.postgres.insertRows().all({
  db: pool,
  params: {
    rows: [{ email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }],
  },
});
// inserted: IAccountSelect[]

// Find by any column subset
const found = await Account.postgres.findBy().any({
  db: pool,
  params: { email: 'jane@example.com' },
});
// found: IAccountSelect | null
```

## Documentation

- [Quickstart](docs/quickstart.md) — full onboarding, all core APIs
- [Queries](docs/queries.md) — subqueries, CTEs, recursive CTEs, window functions
- [Params](docs/params.md) — inline injection, `param()`, runtime validation
- [CRUD](docs/crud.md) — typed query factories, execution methods
- [CLI](docs/cli.md) — `codegen`, `exec run`, `exec init`, config reference
- [Databases](docs/databases.md) — PostgreSQL, MS SQL Server, SQLite — driver setup and dialect notes
- [Plugins & Adaptors](docs/plugins.md) — Drizzle, Prisma, TypeORM, Sequelize adaptors, building your own plugin

## Requirements

- Node.js `>=22.21.1`
- pnpm `>=10.17.0` (for repo development)

## License

Apache-2.0. See [LICENSE](LICENSE).
