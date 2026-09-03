<div align="center">

# Vexnor

### Typesafe, real SQL data framework for AI-native apps

**Write real SQL with full type inference. Run it on the server or the browser with zero API layer. Let AI agents discover your schema and compose typed queries at runtime — without ever emitting raw SQL.**

_The query is the contract._

[![CI](https://github.com/vexnor-dev/vexnor/actions/workflows/ci_github.yml/badge.svg)](https://github.com/vexnor-dev/vexnor/actions/workflows/ci_github.yml)
[![codecov](https://codecov.io/gh/vexnor-dev/vexnor/branch/main/graph/badge.svg)](https://codecov.io/gh/vexnor-dev/vexnor)
[![npm version](https://img.shields.io/npm/v/@vexnor/core.svg)](https://www.npmjs.com/package/@vexnor/core)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[Quickstart](docs/quickstart.md) · [AI Integration](#ai-integration) · [Isomorphic SQL](docs/isomorphic-sql.md) · [Documentation](#documentation) · [Examples](#examples)

</div>

---

## Why Vexnor

- **🧠 Real SQL, fully typed** — write actual SQL in a tagged template; result rows and required params are inferred at compile time from what you `select()`. No DSL, no query-builder chains, no hand-written types.
- **🌐 Isomorphic, zero API layer** — the same query object runs server-side against your database or browser-side over HTTP. No REST endpoints, no tRPC procedures, no GraphQL resolvers to maintain.
- **🔒 SQL injection is structurally impossible** — every interpolated value becomes a bound parameter. It's enforced by the architecture, not by discipline. In the browser, clients send only a query hash — never SQL.
- **🤖 AI-native by design** — a built-in MCP server lets agents discover your schema, resolve FK join paths, and compose typed, read-only queries at runtime, bounded by row/timeout/concurrency budgets.
- **🗄️ Four databases, one API** — PostgreSQL, MS SQL Server, SQLite, and DuckDB behind a single typed surface, with per-dialect SQL generated for you.
- **🚀 Cross-runtime** — serialize queries to portable manifests and execute the same contract from TypeScript, .NET, and Go.

---

```typescript
// Define once
const selectAccounts = sql`
  SELECT ${row(Account.$accountId, Account.$email)}
  FROM ${Account}
  WHERE ${Account.$status} = ${AccountStatusUdt.ACTIVE}
`;

// Server — direct DB execution
const accounts = await selectAccounts.postgres.all({ db: pool });
// accounts: { accountId: string; email: string }[] — inferred from row()

// Browser — dispatched over HTTP, same call site
const accounts = await selectAccounts.postgres.all({ db: remoteClient });
// Same type, same code — no API layer in between
```

Result types and required params are **inferred at compile time** from what you select — no manual type annotations, no codegen step after schema changes.

Built for AI agents: they discover your schema over a local stdio MCP server, resolve FK join paths, and compose typed queries at runtime — never emitting raw SQL. See [AI Integration](#ai-integration).

Mix raw SQL with CRUD — compose subqueries into typed includes:

```typescript
// A reusable SQL subquery
const AccountOrders = sql`
  SELECT ${row(Order.$orderId, Order.$status, Order.$createdAt)}
  FROM ${Order}
  WHERE ${Order.$accountId} = ${Account.out.$accountId}
  ORDER BY ${Order.$createdAt} DESC
`;

// CRUD select with the subquery included as a typed nested array
const accounts = await Account.postgres.select({
  WHERE: sql`${Account.$status} = ${AccountStatusUdt.ACTIVE}`,
  includeMany: { orders: AccountOrders },
}).all({ db: pool });
// { accountId: string; email: string; ...; orders: { orderId: string; status: string; createdAt: Date }[] }[]
```

Parameters and context values — validated at runtime, injected from pipeline context:

```typescript
// param() — caller provides, validated at build time
const findByEmail = sql`
  SELECT ${row(Account.$$)} FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email')}
`.postgres.all({ db: pool, params: { email: 'jane@example.com' } });

// ctx() — injected from SqlQueryRegistry/pipeline context, never sent from the client
const myOrders = sql`
  SELECT ${row(Order.$$)} FROM ${Order}
  WHERE ${Order.$accountId} = ${ctx<{ userId: string }>('userId')}
`.authorize('user');
// In registry: userId is resolved from the authenticated request context
// .authorize('user') — query won't execute without a registered authorization hook
```

Zero-SQL CRUD — same types, same pipeline:

```typescript
// Zero-config select with runtime filtering, sorting, and pagination
const accounts = await Account.postgres.select({}).all({
  db: pool,
  params: {
    filterBy: [{ email: ["like", "%@example.com"] }],
    orderBy: { createdAt: "DESC" },
    limit: 10,
  },
});
// accounts: IAccountSelect[]
```

The client never sends SQL. It sends a stable hash that identifies a pre-registered query. The server looks it up, runs it, and returns typed results. No REST endpoints, no tRPC procedures, no GraphQL resolvers — the query is the API.

## SQL Injection Is Structurally Impossible

Every interpolated value in a `sql` template becomes a parameterized placeholder (`$1`, `?`) — never concatenated into the SQL string. This isn't a convention you have to follow; it's enforced by the tagged template architecture. There is no API that accepts a user string and puts it into a query.

```typescript
// The value goes into the driver's parameter array, not the SQL text
const accounts = await sql`
  SELECT ${row(Account.$$)} FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email')}
`.postgres.all({ db: pool, params: { email: userInput } });
// Generated: SELECT ... WHERE "email" = $1  — values: [userInput]
```

In isomorphic mode, the browser never sends SQL at all — only a query hash. Even a compromised client cannot inject arbitrary SQL.

## How It Works

1. You write typed SQL queries as first-class objects
2. Register them in a `SqlQueryRegistry` on the server
3. From the browser, the same query object dispatches via `HttpRemoteClient`
4. The server resolves the query by hash, executes it, returns typed results
5. Types flow end-to-end — no codegen, no shared API types to maintain

```typescript
import { HttpRemoteClient } from '@vexnor/core';

// Browser — auth-aware
const remoteClient = new HttpRemoteClient({
  targetUrl: '/api/db',
  headerResolver: async () => ({ Authorization: `Bearer ${token}` }),
});

// Same query, same types, different execution target
const accounts = await selectAccounts.postgres.all({ db: remoteClient });
// accounts: { accountId: string; email: string }[]
```

See [Isomorphic SQL](docs/isomorphic-sql.md) for the full picture and comparison with REST/tRPC/GraphQL.

## Install

```bash
# PostgreSQL
npm install @vexnor/core @vexnor/postgres pg

# MS SQL Server
npm install @vexnor/core @vexnor/mssql mssql

# SQLite
npm install @vexnor/core @vexnor/sqlite3 better-sqlite3

# DuckDB
npm install @vexnor/core @vexnor/duckdb @duckdb/node-api
```

Generate types from your database schema:

```bash
npx vexnor codegen \
  --plugin @vexnor/postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
   \
  --camelCaseColumns
```

## Typed SQL Queries

Real SQL. Full type inference from what you select. Composable subqueries.

```typescript
import { Account, AccountStatusUdt, Order, OrderItem } from './models/vexnor_dev.schema.js';
import { sql, row, param, col, type ParamsOf, type TypeOf } from '@vexnor/core';
import { jsonMany } from '@vexnor/postgres';
import '@vexnor/postgres';

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

Select-all composes with additional columns from another table or query. `TypeOf` and `ParamsOf` expose the exact inferred contract without repeating it manually:

```typescript
const ordersWithAccount = sql`
  SELECT ${row(Order.$$, Account.$email.as('accountEmail'))}
  FROM ${Order}
  JOIN ${Account} ON ${Account.$accountId} = ${Order.$accountId}
  WHERE ${Order.$status} = ${param<{ status: string }>('status')}
`;

export type OrdersWithAccountRow = TypeOf<typeof ordersWithAccount>;
export type OrdersWithAccountParams = ParamsOf<typeof ordersWithAccount>;
```

`OrdersWithAccountRow` contains every field from `IOrderSelect` plus `accountEmail`. Generated hierarchical fields—including DuckDB structs, lists, maps, unions, and nested combinations—retain their complete nested types. Alias additional columns when their result keys would collide with a field already selected by `$$`.

## CRUD

No SQL needed for the common case. Same subqueries compose into CRUD factories:

```typescript
// SELECT with includes
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

// Zero-config select with runtime filtering, sorting, and pagination
const found = await Account.postgres.select({}).all({
  db: pool,
  params: {
    filterBy: [{ status: ["in", "active", "confirmed"] }],
    orderBy: { createdAt: "DESC" },
    limit: 25,
    offset: 0,
  },
});
// found: IAccountSelect[]
```

## AI Integration

Vexnor lets AI agents talk to your database through a bounded, read-only surface where SQL injection is structurally impossible. An agent discovers your schema, resolves join paths, composes typed queries, and reads data — without ever emitting raw SQL. The schema graph IS the API.

**MCP server** — `vexnor schema mcp` starts a local stdio Model Context Protocol server for a persisted schema selection. It listens on no network port and exposes no tool unless named explicitly in `--tools`:

```bash
# Metadata and safe query construction only
npx vexnor schema mcp --profile dev --tools getSchema join

# Add bounded row access, with budgets
npx vexnor schema mcp --profile dev \
  --tools getSchema join fetchData \
  --max-rows 50 --timeout-ms 10000 --max-concurrency 1
```

- `getSchema` — exposes only the selected schema metadata, with per-object capabilities and limitations.
- `join` — registers a read-only query composed through known relationships.
- `fetchData` — executes only an opaque query hash already registered by the session; it never accepts SQL.

**Schema discovery** — `SchemaGraph` builds an FK graph from your generated tables, resolves BFS shortest-path joins between any two tables, and emits compact descriptions tailored for an LLM system prompt:

```typescript
import { SchemaGraph } from '@vexnor/core/execution';
import * as schema from './models';

const graph = new SchemaGraph(schema);
graph.formatOverview();                 // one line per table, for an LLM prompt
graph.joinPath('public.payment', 'public.city');  // resolved FK path the agent didn't have to know
```

**Runtime CRUD** — an agent constructs queries from column metadata alone, with no query definition per filter combination. Every operator is validated against the table schema before any SQL is built:

```typescript
const accounts = await Account.postgres.select({}).all({
  db: pool,
  params: {
    filterBy: [
      { status: ["in", "active", "confirmed"] },
      { createdAt: [">=", "2024-01-01"] },
      { or: [{ email: ["like", "%@vip.com"] }, { parentId: ["isNotNull"] }] },
    ],
    orderBy: { createdAt: "DESC" },
    limit: 25,
    offset: 0,
  },
});
```

All operators (`in`, `>=`, `like`, `between`, `isNull`, `isNotNull`, etc.) are validated at runtime against the table schema. Invalid columns or operators throw before any SQL is built, and every value is parameterized.

→ See [AI Integration](docs/ai-integration.md) for the full picture: MCP tools and budgets, schema discovery and prompt formatting, runtime projections (`viewBy`) and windows (`windowBy`), machine-readable schema manifests, and the security model.

## Transactions

```typescript
import { sql, insert } from '@vexnor/core';
import { transaction, savepoint } from '@vexnor/postgres';

await transaction(pool, async (client) => {
  await sql`INSERT INTO ${Order} ${insert(Order)}`.postgres.one({ db: client, params: { rows: [order] } });

  const item = await savepoint(client, async (c) => {
    return sql`INSERT INTO ${OrderItem} ${insert(OrderItem)}`.postgres.one({ db: c, params: { rows: [item] } });
  });
});
```

See [Transactions](docs/transactions.md) for database-specific transaction and savepoint options.

## Query Pipelines

Every query execution flows through a `SqlQueryPipeline` — a composable object that sequences authorization, rate limiting, audit logging, and observability in a single place. `SqlQueryRegistry` owns one by default; you can also attach a pipeline directly to any connection via `connect()` for background workers, scripts, or tests.

```typescript
import { connect } from '@vexnor/core';
import { SqlQueryPipeline, AuditLogPlugin, TimeToLiveRateLimiter, SqlQueryRegistry } from '@vexnor/core/execution';

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
import '@vexnor/core/telemetry';
import { trace } from '@opentelemetry/api';

registry.registerOpenTelemetry(trace.getTracer('my-service'));
```

See [Registry](docs/registry.md) — query pipelines, `connect()`, plugin API, `SqlQueryPipelinePlugin` interface.
See [Authorization](docs/authorization.md) — `.authorize()`, hooks, audit logging, SOC2/HIPAA notes.
See [Telemetry](docs/telemetry.md) — span shape, OTLP exporters, combining with audit logging.

## Documentation

> 📖 See [Cheat Sheet](docs/cheat-sheet.md) for the full composable API reference (`.as()`, `.out`, `col()`, `param()`, CLI troubleshooting).

- [Cheat Sheet](docs/cheat-sheet.md) — quick reference for all composable APIs
- [Quickstart](docs/quickstart.md) — full onboarding, all core APIs
- [AI Integration](docs/ai-integration.md) — MCP server, schema discovery, runtime CRUD for agents, and the security model
- [Queries](docs/queries.md) — subqueries, CTEs, recursive CTEs, window functions
- [Params](docs/params.md) — inline injection, atomic `param()`, explicit `each()` expansion, runtime validation
- [CRUD](docs/crud.md) — typed query factories, execution methods
- [Window Functions](docs/window-functions.md) — runtime `windowBy` param, all 15 functions, frame clauses, AI agent usage
- [Isomorphic SQL](docs/isomorphic-sql.md) — same query on server and client, how it works, comparison with REST/tRPC/GraphQL
- [Registry](docs/registry.md) — SqlQueryRegistry, query pipelines, `connect()`, isomorphic SQL, remote execution
- [Schema Graph](docs/schema-graph.md) — FK-based table introspection, BFS join path resolution, AI prompt formatting
- [Authorization](docs/authorization.md) — query authorization, audit logging, SOC2/HIPAA
- [Telemetry](docs/telemetry.md) — OpenTelemetry integration, spans, OTLP exporters
- [CLI](docs/cli.md) — `codegen`, schema selection, local stdio MCP, query execution, config reference
- [Serialize](docs/serialize.md) — `vexnor serialize`, manifest generation for cross-runtime execution
- [Transactions](docs/transactions.md) — `transaction()`, `savepoint()`, isolation levels, and database-specific behavior
- [Databases](docs/databases.md) — PostgreSQL, MS SQL Server, SQLite, and DuckDB driver setup and dialect notes
- [Plugins & Adaptors](docs/plugins.md) — Drizzle, Prisma, TypeORM, Sequelize adaptors, building your own plugin
- [Portable Queries](docs/portable-queries.md) — conceptual overview of all portability axes (isomorphic, multi-dialect, multi-runtime)
- [Cross-Stack Setup](docs/cross-stack-setup.md) — step-by-step guide to get TypeScript + .NET running together
- [.NET SDK](docs/dotnet.md) — cross-runtime manifest, QueryRegistry, SqlBuilder, shared fixtures
- [Go SDK](docs/golang.md) — cross-runtime manifest, QueryRegistry, SqlBuilder, and SQL database executors
- [Workflow](docs/workflow.md) — migration/upgrade guide, day-to-day dev loop
- [CI](docs/ci.md) — CI/deployment pipeline for cross-stack projects

## Examples

Working examples are in the [`examples/`](examples/) directory:

| Example | Description |
|---|---|
| [`postgres-esm`](examples/postgres-esm) | Minimal Node.js ESM script — insert, select, update with PostgreSQL |
| [`postgres-cjs`](examples/postgres-cjs) | Same as above using CommonJS |
| [`react-vite-api`](examples/react-vite-api) | React + Vite + Hono — isomorphic queries, `SqlQueryRegistry`, `HttpRemoteClient`, PostgreSQL + MSSQL + SQLite3 + DuckDB |
| [`react-vite-ui`](examples/react-vite-ui) | React + Vite — generic frontend for testing backend stacks (Go, .NET, Node.js) |
| [`react-next-app`](examples/react-next-app) | Next.js App Router — React Server Components, Server Actions, same isomorphic pattern |

Cross-runtime backends are in [`stacks/`](stacks/):

| Stack | Description |
|---|---|
| [`golang`](stacks/golang) | Go query registry — loads manifests, executes against PostgreSQL + MSSQL + SQLite3 + DuckDB |
| [`dotnet`](stacks/dotnet) | .NET query registry — same architecture, C# implementation |

## Requirements

- Node.js `>=22.21.1`
- pnpm `>=11.0.0` (for repo development)

## License

Apache-2.0. See [LICENSE](LICENSE).
