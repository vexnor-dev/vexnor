# Portable Queries

Vexnor queries are portable across three independent axes. Each axis is opt-in — you can use one, two, or all three depending on your architecture.

## The Three Axes

### 1. Server ↔ Browser (Isomorphic Execution)

The same query object executes directly against a database on the server, or dispatches over HTTP from the browser. The call site is identical — only the `db` argument changes:

```typescript
// Server — direct execution
const accounts = await findAccounts.postgres.all({ db: pool });

// Browser — remote execution via HTTP
const accounts = await findAccounts.postgres.all({ db: remoteClient });
```

The browser never sends SQL. It sends the query's stable hash. The server resolves the hash in a `SqlQueryRegistry`, executes the query, and returns typed results.

See [Isomorphic SQL](isomorphic-sql.md) for the full mechanism.

### 2. Multi-Dialect (PostgreSQL, MS SQL, SQLite)

Portable operator nodes — `filterBy`, `orderBy`, `insert`, `set`, `upsert`, `pagination` — emit dialect-correct SQL at build time:

| Operator | PostgreSQL | MS SQL (Transact-SQL) | SQLite |
|----------|------------|----------------------|--------|
| Parameter | `$1` | `@p0` | `$1` |
| Upsert | `ON CONFLICT ... DO UPDATE` | `MERGE INTO ... WHEN MATCHED` | `ON CONFLICT ... DO UPDATE` |
| Pagination | `LIMIT $1 OFFSET $2` | `OFFSET @p0 ROWS FETCH NEXT @p1 ROWS ONLY` | `LIMIT $1 OFFSET $2` |
| Identifier quoting | `"column"` | `[column]` | `"column"` |

See [Databases](databases.md) for driver setup and dialect-specific notes.

### 3. Multi-Runtime (Node.js ↔ .NET)

Queries serialize to a JSON manifest via `vexnor serialize`. The .NET SDK loads the manifest and evaluates the same portable operators to produce identical SQL text and parameter arrays:

```
TypeScript                          .NET
─────────                          ────
sql`...` → vexnor serialize → manifest.json → QueryRegistry.Build() → SQL + params
```

Both runtimes are verified against shared fixtures — if the .NET output diverges from Node.js, tests fail.

See [.NET SDK](dotnet.md) for the full .NET API.
See [Cross-Stack Setup](cross-stack-setup.md) for the step-by-step guide.

## How Manifests Are Created

Manifests are produced by `vexnor serialize`. The command generates **one manifest file per source file** — not one per CLI run. This means your manifest directory mirrors your query source structure:

```bash
npx vexnor serialize \
  --input "src/queries/**/*.ts" \
  --output manifests/ \
  --dialect postgresql
```

Given this source structure:

```
src/queries/
├── accounts.ts    # exports: findActiveAccounts, findAccountById, countAccounts
├── orders.ts      # exports: findOrdersByAccount, findRecentOrders
└── admin/
    └── users.ts   # exports: listAllUsers, deleteUser
```

The output is:

```
manifests/
└── src/queries/
    ├── accounts.json    (3 queries)
    ├── orders.json      (2 queries)
    └── admin/
        └── users.json   (2 queries)
```

Each JSON file contains all queries exported from that source file. The CLI output confirms what was generated:

```
  src/queries/accounts.ts → src/queries/accounts.json (3 queries)
  src/queries/orders.ts → src/queries/orders.json (2 queries)
  src/queries/admin/users.ts → src/queries/admin/users.json (2 queries)

Serialized 7 queries from 3 files to manifests/
```

### What gets serialized?

The command imports each matched file and discovers all exported `SqlQuery` and `SqlQueryHandler` instances. Every query export becomes an entry in the manifest — you don't need to register them anywhere.

```typescript
// src/queries/accounts.ts
import { sql, row, param, filterBy, orderBy } from 'vexnor';
import { Account } from '../models/public.schema.js';

// All three exports become entries in manifests/src/queries/accounts.json
export const findActiveAccounts = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${filterBy(Account)}
  ${orderBy(Account)}
`;

export const findAccountById = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
`;

export const countAccounts = sql`
  SELECT count(*) as ${col<{ total: number }>('total')}
  FROM ${Account}
  WHERE ${filterBy(Account)}
`;
```

### Re-running serialize is idempotent

Running the same command again overwrites the existing manifests. If you remove a query export, it disappears from the manifest on the next run. If you add one, it appears.

See [Serialize](serialize.md) for the full CLI reference.

## How They Compose

The axes are orthogonal. Common combinations:

| Architecture | Axes Used |
|---|---|
| TypeScript monolith (Node.js + React) | Isomorphic only |
| TypeScript service supporting Postgres + SQLite | Multi-dialect only |
| TypeScript defines queries, .NET microservice executes | Multi-runtime only |
| Full-stack: React browser → Node.js → also .NET workers | All three |

## The Manifest as the Contract

At the center of portability is the **manifest** — a JSON file that captures:

- **Query templates** — token streams (text, param, filter, orderBy, set, insert, when, pagination)
- **Parameter metadata** — names, types, validation schemas
- **Stable hashes** — content-addressed identifiers that never change unless the query changes
- **Authorization tags** — carried through so any runtime can enforce access control

TypeScript is the source of truth; other runtimes consume the manifest and produce identical output.

## Guarantees

1. **SQL injection is structurally impossible** — all values become parameterized placeholders, in every runtime, in every dialect
2. **Type safety at compile time** — TypeScript infers result types from what you select
3. **Identical output** — cross-runtime fixtures assert that Node.js and .NET produce the same SQL text and parameter arrays for the same inputs
4. **Hash stability** — a query's hash only changes when its SQL structure changes, not when parameters change

## Cross-Reference

- [Isomorphic SQL](isomorphic-sql.md) — server ↔ browser axis in depth
- [Databases](databases.md) — multi-dialect axis, driver setup
- [.NET SDK](dotnet.md) — multi-runtime axis, C# API
- [Serialize](serialize.md) — producing manifests
- [Cross-Stack Setup](cross-stack-setup.md) — getting all runtimes running together
- [Workflow](workflow.md) — day-to-day development loop
