# vexnor

Write real SQL. Get typed results. No ORM, no DSL, no repository boilerplate.

Vexnor generates TypeScript types from your database schema and makes queries first-class objects — composable, reusable, and executable directly. The query is the repository.

[![CI](https://github.com/vexnor-dev/vexnor/actions/workflows/ci_github.yml/badge.svg)](https://github.com/vexnor-dev/vexnor/actions/workflows/ci_github.yml)
[![codecov](https://codecov.io/gh/vexnor-dev/vexnor/branch/main/graph/badge.svg)](https://codecov.io/gh/vexnor-dev/vexnor)
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

Generate types from your database schema:

```bash
npx vexnor codegen \
  --plugin vexnor-postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
   \
  --camelCaseColumns
```

## What It Looks Like

### Queries

```typescript
import { Account, AccountStatusUdt, Order, OrderItem } from './models/vexnor_dev.schema.js';
import { sql, row, param, col } from 'vexnor';
import { jsonMany } from 'vexnor-postgres';
import 'vexnor-postgres';

// A typed, reusable subquery
const OrderItems = sql`
  SELECT ${row(OrderItem.$$)}
  FROM ${OrderItem}
  WHERE ${OrderItem.$orderId} = ${Order.out.$orderId}
`;

const AccountOrders = sql`
  SELECT ${row(Order.$orderId, Order.$status, Order.$createdAt)},
         ${jsonMany(OrderItems).as('items')}
  FROM ${Order} ${jsonMany(OrderItems)}
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
  WHERE ${Account.$status} = ${AccountStatusUdt.ACTIVE}
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
  WHERE: sql`${Account.$status} = ${AccountStatusUdt.ACTIVE}`,
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

## Isomorphic SQL

The same query object can execute directly on the server **or** be dispatched from the browser — without changing the call site.

```typescript
// Server — direct DB execution
const accounts = await selectAccounts.postgres.all({ db: pool });

// Browser — dispatched over HTTP to /api/db
const accounts = await selectAccounts.postgres.all({ db: remoteClient });
```

The client never sends SQL. It sends a stable hash that identifies a pre-registered query. The server looks it up, runs it, and returns typed results. No REST endpoints to define, no API types to maintain — the query is the contract.

`HttpRemoteClient` is the built-in implementation:

```typescript
import { HttpRemoteClient } from 'vexnor';

// Static (no auth)
const remoteClient = new HttpRemoteClient({ targetUrl: '/api/db' });

// Auth-aware hook (React)
import { useMemo } from 'react';
function useRemoteClient() {
  const { token } = useAuth();
  return useMemo(() => new HttpRemoteClient({
    targetUrl: '/api/db',
    headerResolver: async () => token ? { Authorization: `Bearer ${token}` } : {},
  }), [token]);
}
```

See [Isomorphic SQL](docs/isomorphic-sql.md) for the full picture.

## Transactions

```typescript
import { transaction, savepoint } from 'vexnor-postgres';

await transaction(pool, async (client) => {
  await sql`INSERT INTO ${Order} ${Order.insertColsVals(order)}`.one({ db: client });

  const item = await savepoint(client, async (c) => {
    return sql`INSERT INTO ${OrderItem} ${OrderItem.insertColsVals(item)}`.one({ db: c });
  });
});
```

See [Transactions](docs/transactions.md) for all three drivers and options.

## Query Pipelines

Every query execution flows through a `SqlQueryPipeline` — a composable object that sequences authorization, rate limiting, audit logging, and observability in a single place. `SqlQueryRegistry` owns one by default; you can also attach a pipeline directly to any connection via `connect()` for background workers, scripts, or tests.

```typescript
import { connect } from 'vexnor';
import { SqlQueryPipeline, AuditLogPlugin, TimeToLiveRateLimiter, SqlQueryRegistry } from 'vexnor/execution';

type AppContext = { userId: string; roles: string[] };

const pipeline = new SqlQueryPipeline<{ Context: AppContext }>();

// Authorization — runs before every .authorize()-tagged query, throw to deny
pipeline.registerAuthorization(({ query, context, name }) => {
  if (!context.roles.includes(query.authorization!)) {
    throw new Error(`Forbidden: ${name} requires '${query.authorization}'`);
  }
});

// Rate limiting — built-in per-query and per-user concurrency caps
pipeline.use(new TimeToLiveRateLimiter({
  contextKeyResolver: (ctx) => ctx.userId,
  maxConcurrent: 50,
  maxConcurrentPerContext: 5,
}));

// Audit log — fires on every execution, including failures and auth denials
pipeline.use(new AuditLogPlugin({
  contextLogResolver: ({ userId }) => ({ userId }), // never logs raw context
  onLog: ({ name, durationMs, error, context }) => {
    logger.info({ name, durationMs, error, ...context });
  },
}));

// Use with SqlQueryRegistry
const registry = new SqlQueryRegistry<AppContext>();
registry.use(auditPlugin);
registry.registerAuthorization(authHook);

// Or attach to a direct connection — same pipeline, same guarantees
const db = connect<AppContext>(pool, { pipeline });
const accounts = await findActiveAccounts.postgres.all({ db, params: { userId, roles } });
```

### Authorization

Tag queries with `.authorize(tag)` to require an explicit check. Untagged queries bypass authorization. Call `checkAuthorization()` at startup to assert every tagged query has a hook — no silent gaps:

```typescript
const deleteAccount = sql`
  DELETE FROM ${Account} WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
`.authorize('admin');

// Fails at startup if any .authorize() query has no hook registered
registry.checkAuthorization();

// Audit every unprotected query — useful as a SOC2 / security gate
const unprotected = registry.getUnauthorizedQueries();
if (unprotected.length > 0) throw new Error(`Unprotected queries: ${unprotected.map(q => q.label).join(', ')}`);
```

### SOC2 / HIPAA

- The audit log fires on **every** execution — success, failure, and authorization denial. Denied attempts are logged with the error.
- `contextLogResolver` is opt-in — raw context is never forwarded to the log. Only what you explicitly project is included.
- `input.location` in each log entry identifies the exact source file and line where the query was defined — traceable back to the code path that triggered a sensitive operation.
- `params` are available in `onLog` but excluded from the examples by default. Scrub or omit them if they contain PII or PHI before writing to your log sink.
- Pair with your log destination's (CloudWatch, Datadog, Splunk) access controls and retention policies for full compliance coverage.

### OpenTelemetry

Built-in OpenTelemetry support creates a span for every query — including error code, SQL text on failure, and source location:

```typescript
import 'vexnor/telemetry';
import { trace } from '@opentelemetry/api';

registry.registerOpenTelemetry(trace.getTracer('my-service'));
```

See [Registry](docs/registry.md) — query pipelines, `connect()`, plugin API, `SqlQueryPipelinePlugin` interface.
See [Authorization](docs/authorization.md) — `.authorize()`, hooks, audit logging, SOC2/HIPAA notes.
See [Telemetry](docs/telemetry.md) — span shape, OTLP exporters, combining with audit logging.

## Documentation

- [Quickstart](docs/quickstart.md) — full onboarding, all core APIs
- [Queries](docs/queries.md) — subqueries, CTEs, recursive CTEs, window functions
- [Params](docs/params.md) — inline injection, `param()`, `expand()`, runtime validation
- [CRUD](docs/crud.md) — typed query factories, execution methods
- [Isomorphic SQL](docs/isomorphic-sql.md) — same query on server and client, how it works, comparison with REST/tRPC/GraphQL
- [Registry](docs/registry.md) — SqlQueryRegistry, query pipelines, `connect()`, isomorphic SQL, remote execution
- [Authorization](docs/authorization.md) — query authorization, audit logging, SOC2/HIPAA
- [Telemetry](docs/telemetry.md) — OpenTelemetry integration, spans, OTLP exporters
- [CLI](docs/cli.md) — `codegen`, `exec run`, `exec init`, config reference
- [Transactions](docs/transactions.md) — `transaction()`, `savepoint()`, isolation levels, all three drivers
- [Databases](docs/databases.md) — PostgreSQL, MS SQL Server, SQLite — driver setup and dialect notes
- [Plugins & Adaptors](docs/plugins.md) — Drizzle, Prisma, TypeORM, Sequelize adaptors, building your own plugin

## Examples

Working examples are in the [`examples/`](examples/) directory:

| Example | Description |
|---|---|
| [`postgres-esm`](examples/postgres-esm) | Minimal Node.js ESM script — insert, select, update with PostgreSQL |
| [`postgres-cjs`](examples/postgres-cjs) | Same as above using CommonJS |
| [`react-vite-api`](examples/react-vite-api) | React + Vite + Hono — isomorphic queries, `SqlQueryRegistry`, `HttpRemoteClient`, PostgreSQL + MSSQL + SQLite3 |
| [`react-next-app`](examples/react-next-app) | Next.js App Router — React Server Components, Server Actions, same isomorphic pattern |

## Requirements

- Node.js `>=22.21.1`
- pnpm `>=11.0.0` (for repo development)

## License

Apache-2.0. See [LICENSE](LICENSE).
