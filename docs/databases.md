# Databases

## PostgreSQL

**Package:** `vexnor-postgres`  
**Driver:** `pg` (node-postgres) — `Pool` / `PoolClient`  
**Dialect:** `postgresql`

```bash
npm install vexnor vexnor-postgres pg
```

```typescript
import 'vexnor-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const result = await query.postgres.all({ db: pool });
```

Also works with `postgres.js` — pass a `postgres()` client as `db`.

### JSON Aggregation

`jsonMany` uses `jsonb_agg` with a `LEFT JOIN LATERAL`. Returns `[]` when no rows match.  
`jsonOne` uses `to_jsonb` with a `LEFT JOIN LATERAL`. Returns `null` when no row matches.

```typescript
import { jsonMany, jsonOne } from 'vexnor-postgres';
```

### Enum Support

PostgreSQL enums are generated as TypeScript `const` enums:

```typescript
// Generated
export const AccountStatusUdt = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } as const;
export type AccountStatusUdt = (typeof AccountStatusUdt)[keyof typeof AccountStatusUdt];
```

---

## MS SQL Server

**Package:** `vexnor-mssql`  
**Driver:** `mssql` (tedious)  
**Dialect:** `tsql`

```bash
npm install vexnor vexnor-mssql mssql
```

```typescript
import 'vexnor-mssql';
import * as mssql from 'mssql';

const pool = await mssql.connect(process.env.MSSQL_CONNECTION_STRING!);

const result = await query.mssql.all({ db: pool });
```

Params use named `@paramName` format internally — this is handled automatically by Vexnor.

### JSON Aggregation

`jsonMany` uses `FOR JSON PATH`. Returns `[]` when no rows match.  
`jsonOne` uses `FOR JSON PATH, WITHOUT_ARRAY_WRAPPER`. Returns `null` when no row matches.

```typescript
import { jsonMany, jsonOne } from 'vexnor-mssql';
```

### Notes

- No native enum type in MSSQL — enum columns are generated as `string`
- `upsert()` is supported via `MERGE`

---

## SQLite

**Package:** `vexnor-sqlite3`  
**Driver:** `better-sqlite3` (synchronous)  
**Dialect:** `sqlite`

```bash
npm install vexnor vexnor-sqlite3 better-sqlite3
```

```typescript
import 'vexnor-sqlite3';
import Database from 'better-sqlite3';

const db = new Database('mydb.sqlite');

const result = await query.sqlite.all({ db });
```

The driver is synchronous — Vexnor wraps calls in `Promise.resolve()` so the async API is consistent.

### JSON Aggregation

`jsonMany` uses `json_group_array` + `json_object`. Returns `[]` when no rows match.  
`jsonOne` uses `json_object`. Returns `null` when no row matches.

```typescript
import { jsonMany, jsonOne } from 'vexnor-sqlite3';
```

### Notes

- No `upsert()` support
- Schema introspection uses `PRAGMA table_list`, `PRAGMA table_info`, and `PRAGMA index_list`
