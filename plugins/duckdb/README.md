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

## Hierarchical columns

Codegen recursively types DuckDB `STRUCT`, `LIST`, fixed-array, `MAP`, and `UNION` columns. Struct fields use the same generated `$field` syntax as ordinary columns, including configured column-name conversion:

```typescript
import { row } from '@vexnor/core';
import { sql, unnest } from '@vexnor/duckdb';
import { Order } from './models/main.order-table.js';

const Orders = Order.as('orders');
const Items = unnest(Orders.$items).as('item');

const selectOrderItems = sql`
  SELECT ${row(
    Orders.$orderId,
    Orders.$shipping.$address.$country.as('shippingCountry'),
    Items.$product.$productId.as('productId'),
    Items.$quantity,
  )}
  FROM ${Orders}, ${Items}
`;
```

`unnest()` accepts a generated list column and exposes a typed relation. It can be chained for deeper lists, for example `unnest(Items.$discounts).as('discount')`. Unknown fields and non-list arguments fail TypeScript compilation.

An ordinary `param()` value occupies one placeholder, so DuckDB can bind a complete list or struct value:

```typescript
import { param } from '@vexnor/core';
import type { IOrderInsert } from './models/main.order-table.js';

type UpdateItemsParams = {
  orderId: string;
  items: NonNullable<IOrderInsert['items']>;
};

const updateOrderItems = sql`
  UPDATE ${Order}
  SET ${Order.$items} = ${param<UpdateItemsParams>('items')}
  WHERE ${Order.$orderId} = ${param<UpdateItemsParams>('orderId')}
`;
```

Generated select-side struct fields follow Vexnor's configured naming, such as `productId`. Insert-side struct values retain DuckDB's native field names, such as `product_id`, because those object keys are consumed by the DuckDB binder.

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

// Glob patterns for multi-file queries
const allSales = await sql`select * from read_parquet(${'/data/*.parquet'})`.duckdb.all({ db: connection.db });
```

## ATTACH — Multi-Database Queries

Attach external DuckDB files and query across databases in a single statement:

```typescript
await connection.db.run(`ATTACH 'warehouse.duckdb' AS warehouse`);

// Cross-database JOIN
const result = await sql`
  SELECT a.email, w.stock
  FROM account a
  JOIN warehouse.main.inventory w ON a.account_id = w.account_id
`.duckdb.all({ db: connection.db });

// Read-only attach
await connection.db.run(`ATTACH 'archive.duckdb' AS archive (READ_ONLY)`);

await connection.db.run('DETACH warehouse');
```

## ETL Pipelines

```typescript
// COPY FROM — bulk import from files into tables
await connection.db.run(`COPY transactions FROM 'data.csv' (FORMAT CSV, HEADER)`);
await connection.db.run(`COPY customers FROM 'customers.parquet' (FORMAT PARQUET)`);

// CREATE TABLE AS SELECT — transform and materialize
await sql`
  CREATE TABLE customer_summary AS
  SELECT c.name, count(*) as orders, sum(t.amount) as total
  FROM read_parquet(${customersPath}) c
  JOIN read_csv_auto(${transactionsPath}) t ON c.id = t.customer_id
  GROUP BY c.name
`.duckdb.run({ db: connection.db });

// EXPORT / IMPORT DATABASE — full backup and restore
await connection.db.run(`EXPORT DATABASE '/backup' (FORMAT PARQUET)`);
// ... later, in a fresh database:
await freshConnection.db.run(`IMPORT DATABASE '/backup'`);
```

## Custom Types

DuckDB columns with types that differ between insert and select export named types:

```typescript
import type { DuckDBInterval, DuckDBTimeTZ } from '@vexnor/duckdb';

// DuckDBInterval = { months: number; days: number; micros: bigint }
// DuckDBTimeTZ = { micros: bigint; offset: number }
```

Insert types accept `string` (e.g., `"1 year 2 months"` for INTERVAL, `"12:34:56+05:30"` for TIMETZ). Select types return the structured native values above.

## Type Mapping

| DuckDB Type | Insert TypeScript Type | Select TypeScript Type |
|---|---|---|
| `VARCHAR`, `TEXT`, `UUID` | `string` | `string` |
| `INTEGER`, `SMALLINT`, `FLOAT`, `DOUBLE` | `number` | `number` |
| `BIGINT`, `HUGEINT`, `UBIGINT`, `UHUGEINT` | `BigInt` | `BigInt` |
| `BOOLEAN` | `boolean` | `boolean` |
| `DATE`, `TIMESTAMP`, `TIMESTAMPTZ` | `Date` | `Date` |
| `DECIMAL(p,s)` | `string` | `string` (lossless, no precision loss) |
| `TIME` | `string` | `bigint` (microseconds since midnight) |
| `TIMETZ` | `string` | `DuckDBTimeTZ` |
| `INTERVAL` | `string` | `DuckDBInterval` |
| `BIT` | `string` | `Uint8Array` |
| `BLOB` | `Uint8Array` | `Uint8Array` |
| `JSON` | `unknown` | `unknown` (raw JSON string) |
| `STRUCT(...)` | nested object (snake_case keys) | nested object (camelCase keys) |
| `MAP(K, V)` | `Map<K, V>` | `Array<{ key: K; value: V \| null }>` |
| `UNION(...)` | union of member scalar types | `{ tag: string; value: T \| null }` |
| `type[]` | `Array<T \| null>` | `Array<T \| null>` |
| `ENUM(...)` | generated const enum type | generated const enum type |

DECIMAL values are returned as strings to preserve full precision. A `DECIMAL(38,10)` value like `1234567890123456789012345678.1234567890` is kept exactly — no floating-point approximation.

## DuckDB-Specific SQL Features

These work through `sql` tagged templates with full parameterization:

- **PIVOT / UNPIVOT** — reshape between wide and long formats
- **QUALIFY** — filter window function results directly
- **ASOF JOIN** — time-series joins matching the nearest preceding row
- **LATERAL JOIN** — correlated table functions in FROM
- **GROUPING SETS / CUBE / ROLLUP** — multi-level aggregation
- **List comprehensions** — `[x * x for x in generate_series(1, 5)]`
- **Struct literals** — `{'x': 1, 'y': 2}::STRUCT(x INTEGER, y INTEGER)`
- **UNION type** — tagged sum types with `union_value()`, `union_tag()`, `union_extract()`

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
