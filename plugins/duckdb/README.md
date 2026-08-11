# @vexnor/duckdb

DuckDB plugin for Vexnor using the official `@duckdb/node-api` client.

It provides parameterized query execution, schema introspection and codegen, typed CRUD factories, JSON aggregation, transactions, portable query serialization, and direct queries over DuckDB-supported files.

## Install

```bash
npm install @vexnor/core @vexnor/duckdb @duckdb/node-api
```

Import the package once to register `.duckdb` on Vexnor queries and generated tables:

```typescript
import '@vexnor/duckdb';
import { VexnorDuckDB } from '@vexnor/duckdb';

const plugin = new VexnorDuckDB();
const connection = await plugin.createConnection({
  config: { mode: 'file', path: 'analytics.duckdb' },
});

const rows = await query.duckdb.all({ db: connection.db, params: { accountId: 42 } });
await connection.close();
```

## Connection modes

```typescript
await plugin.createConnection({ config: { mode: 'memory' } });
await plugin.createConnection({ config: { mode: 'file', path: 'analytics.duckdb' } });
await plugin.createConnection({
  config: {
    mode: 'motherduck',
    database: 'analytics',
    token: process.env.MOTHERDUCK_TOKEN!,
  },
});
await plugin.createConnection({ config: { uri: 'analytics.duckdb' } });
```

File and MotherDuck instances are shared while connections are active. Closing the final Vexnor connection releases the native instance and its file lock. In-memory connections are isolated.

MotherDuck tokens are passed through the DuckDB `motherduck_token` connection parameter and are redacted from Vexnor logs. Keep tokens out of source control.

## Queries and CRUD

DuckDB uses PostgreSQL-compatible `$1`, `$2`, ... positional parameters. Vexnor binds them through prepared statements, including dates, timestamps, big integers, blobs, lists, structs, maps, and JSON values.

```typescript
import { param, sql } from '@vexnor/core';

const account = await findAccount.duckdb.one({
  db: connection.db,
  params: { accountId: 42 },
});

const inserted = await Account.duckdb.insertRows().all({
  db: connection.db,
  params: { rows: [{ email: 'duck@example.com' }] },
});

const selected = await Account.duckdb.select({
  ORDER_BY: sql`${Account.$createdAt} DESC`,
  limit: param<{ limit: number }>('limit'),
}).all({ db: connection.db, params: { limit: 20 } });
```

Generated tables support select, insert rows, insert from a query, update, delete, and upsert. Selects support joins, grouping, having, windows, projection, pagination, `includeOne`, and `includeMany`.

## Transactions

```typescript
import { transaction } from '@vexnor/duckdb';

await transaction(connection.db, async (db) => {
  await insertAccount.duckdb.run({ db, params: { email: 'duck@example.com' } });
});
```

DuckDB does not support savepoints. Calling the exported `savepoint()` function throws a typed `DuckDBUnsupportedError` with code `DUCKDB_UNSUPPORTED`.

## CSV, JSON, and Parquet

File sources remain inside DuckDB's execution engine; Vexnor does not load the complete file into application memory.

```typescript
const csvRows = await sql`select * from read_csv_auto(${csvPath})`.duckdb.all({ db: connection.db });
const jsonRows = await sql`select * from read_json_auto(${jsonPath})`.duckdb.all({ db: connection.db });
const parquetRows = await sql`select * from read_parquet(${parquetPath})`.duckdb.all({ db: connection.db });
```

## Extensions

Extension installation, loading, and credentials are explicit application configuration. The plugin does not automatically install or load `httpfs`, `postgres`, `sqlite`, `spatial`, `iceberg`, `delta`, or `motherduck`.

```typescript
await connection.db.run('INSTALL httpfs');
await connection.db.run('LOAD httpfs');
```

## Codegen

```bash
npx vexnor codegen \
  --plugin @vexnor/duckdb \
  --schema main \
  --uri analytics.duckdb \
  --outDir src/models \
  --camelCaseColumns
```

Codegen discovers tables, views, columns, nullability, primary keys, foreign keys, and DuckDB enums.

## Native platform support

The pinned runtime baselines are `@duckdb/node-api` 1.5.5-r.3, `DuckDB.NET.Data.Full` 1.5.5, and `duckdb-go/v2` v2.10505.0.

The native packages are built and tested for:

- Linux x64 and arm64
- macOS x64 and arm64
- Windows x64

The Go client requires a working CGO toolchain. Install a C/C++ compiler for the target platform and run with `CGO_ENABLED=1`. Unsupported native platforms fail during driver installation or initialization; verify that your deployment target is present in the selected SDK's published native packages.

## Bundlers

The package's `sideEffects` metadata preserves the module augmentation that registers `.duckdb`. Do not remove or narrow those entries. The browser export provides query construction and remote-execution support; local DuckDB connections require a supported native Node.js runtime.
