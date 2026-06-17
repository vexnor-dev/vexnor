# Databases

## PostgreSQL

**Package:** `@vexnor/postgres`  
**Driver:** `pg` (node-postgres) — `Pool` / `PoolClient`  
**Dialect:** `postgresql`

```bash
npm install @vexnor/core @vexnor/postgres pg
```

### Connection Setup

```typescript
import '@vexnor/postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const result = await query.postgres.all({ db: pool });
```

### Pool Configuration

All `pg.Pool` options are supported — pass them directly:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                  // maximum pool size
  idleTimeoutMillis: 30000, // close idle connections after 30s
  connectionTimeoutMillis: 5000, // fail if connection not acquired in 5s
});
```

### SSL

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca.pem').toString(),
  },
});
```

For managed databases (AWS RDS, Supabase, etc.) that require SSL:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // or provide the CA cert
});
```

### Connection Lifecycle

The pool manages connections automatically. For graceful shutdown:

```typescript
process.on('SIGTERM', async () => {
  await pool.end(); // waits for in-flight queries then closes all connections
});
```

### JSON Aggregation

`jsonMany` uses `jsonb_agg` with a `LEFT JOIN LATERAL`. Returns `[]` when no rows match.  
`jsonOne` uses `to_jsonb` with a `LEFT JOIN LATERAL`. Returns `null` when no row matches.

```typescript
import { jsonMany, jsonOne } from '@vexnor/postgres';
```

### Enum Support

PostgreSQL enums are generated as TypeScript `const` enums:

```typescript
// Generated
export const AccountStatusUdt = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } as const;
export type AccountStatusUdt = (typeof AccountStatusUdt)[keyof typeof AccountStatusUdt];
```

### Custom Types

PostgreSQL geometric and interval types are exported:

```typescript
import type { Point, Circle, Interval } from '@vexnor/postgres';
```

---

## MS SQL Server

**Package:** `@vexnor/mssql`  
**Driver:** `mssql` (tedious)  
**Dialect:** `tsql`

```bash
npm install @vexnor/core @vexnor/mssql mssql
```

### Connection Setup

```typescript
import '@vexnor/mssql';
import * as mssql from 'mssql';

const pool = await mssql.connect(process.env.MSSQL_CONNECTION_STRING!);

const result = await query.mssql.all({ db: pool });
```

### Pool Configuration

```typescript
const pool = await mssql.connect({
  server: process.env.MSSQL_HOST!,
  port: parseInt(process.env.MSSQL_PORT ?? '1433'),
  database: process.env.MSSQL_DATABASE!,
  user: process.env.MSSQL_USER!,
  password: process.env.MSSQL_PASSWORD!,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,              // required for Azure
    trustServerCertificate: false,
  },
});
```

### SSL / Encryption

For Azure SQL or any encrypted connection:

```typescript
const pool = await mssql.connect({
  ...connectionConfig,
  options: {
    encrypt: true,
    trustServerCertificate: false, // set true only for local dev with self-signed certs
  },
});
```

### Connection Lifecycle

```typescript
process.on('SIGTERM', async () => {
  await pool.close();
});
```

### JSON Aggregation

`jsonMany` uses `FOR JSON PATH`. Returns `[]` when no rows match.  
`jsonOne` uses `FOR JSON PATH, WITHOUT_ARRAY_WRAPPER`. Returns `null` when no row matches.

```typescript
import { jsonMany, jsonOne } from '@vexnor/mssql';
```

### Notes

- Params use named `@paramName` format internally, handled automatically by Vexnor
- No native enum type in MSSQL — enum columns are generated as `string`
- `upsert()` uses `MERGE`

---

## SQLite

**Package:** `@vexnor/sqlite3`  
**Driver:** `better-sqlite3` (synchronous)  
**Dialect:** `sqlite`

```bash
npm install @vexnor/core @vexnor/sqlite3 better-sqlite3
```

### Connection Setup

```typescript
import '@vexnor/sqlite3';
import Database from 'better-sqlite3';

const db = new Database('mydb.sqlite');

const result = await query.sqlite.all({ db });
```

`better-sqlite3` is synchronous — Vexnor wraps calls in `Promise.resolve()` so the async API stays consistent.

### Database Configuration

```typescript
// In-memory database
const db = new Database(':memory:');

// WAL mode for better concurrent read performance
const db = new Database('mydb.sqlite');
db.pragma('journal_mode = WAL');

// Read-only
const db = new Database('mydb.sqlite', { readonly: true });
```

### Connection Lifecycle

```typescript
process.on('SIGTERM', () => {
  db.close();
});
```

### JSON Aggregation

`jsonMany` uses `json_group_array` + `json_object`. Returns `[]` when no rows match.  
`jsonOne` uses `json_object`. Returns `null` when no row matches.

```typescript
import { jsonMany, jsonOne } from '@vexnor/sqlite3';
```

### Notes

- Schema introspection uses `PRAGMA table_list`, `PRAGMA table_info`, and `PRAGMA index_list`
- No native enum type — enum columns are generated as `string`
- `upsert()` uses `ON CONFLICT DO UPDATE` (same syntax as PostgreSQL)

---

## Using `connect()` with Pipelines

Wrap any connection with `connect()` to attach a `SqlQueryPipeline` — adding authorization, rate limiting, and audit logging to direct queries:

```typescript
import { connect } from '@vexnor/core';
import { SqlQueryPipeline } from '@vexnor/core/execution';

type AppContext = { userId: string; roles: string[] };

const pipeline = new SqlQueryPipeline<{ Context: AppContext }>();
pipeline.registerAuthorization(({ query, context }) => {
  if (!query.authorization.every(tag => context.roles.includes(tag))) throw new Error('Forbidden');
});

const db = connect<AppContext>(pool, { pipeline });

// Pipeline runs on every query executed against this connection
const accounts = await findActiveAccounts.postgres.all({
  db,
  params: { userId: 'user-1', roles: ['admin'] },
});
```

See [Registry](registry.md) for `SqlQueryRegistry`, remote execution, and the full pipeline API.
