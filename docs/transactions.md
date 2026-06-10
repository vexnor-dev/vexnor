# Transactions

Each driver package exports a `transaction()` function and a `savepoint()` function. Both follow the same pattern: pass your pool/db, get a connection-scoped handle back in the callback, run queries against it, and the outer function commits or rolls back automatically.

## PostgreSQL

```typescript
import { transaction, savepoint } from 'vexnor-postgres';
```

### `transaction(pool, callback, options?)`

Acquires a dedicated `PoolClient` from the pool, opens a transaction, runs the callback, then commits. Rolls back and re-throws if the callback throws. The client is always released back to the pool.

```typescript
await transaction(pool, async (client) => {
  await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.one({ db: client });
  await sql`UPDATE ${Order} SET ${Order.updateSet({ status: 'confirmed' })} WHERE ...`.one({ db: client });
});
```

Options:

| Option | Type | Default |
|---|---|---|
| `isolationLevel` | `"READ UNCOMMITTED" \| "READ COMMITTED" \| "REPEATABLE READ" \| "SERIALIZABLE"` | `"READ COMMITTED"` |
| `accessMode` | `"READ WRITE" \| "READ ONLY"` | `"READ WRITE"` |
| `deferrable` | `"DEFERRABLE" \| "NOT DEFERRABLE"` | `"NOT DEFERRABLE"` |

### `savepoint(client, callback)`

Creates a savepoint inside an existing transaction. If the callback throws, rolls back to the savepoint and returns `undefined`. If it succeeds, releases the savepoint and returns the result.

```typescript
await transaction(pool, async (client) => {
  await sql`INSERT INTO ${Order} ${Order.insertColsVals(order)}`.one({ db: client });

  const item = await savepoint(client, async (c) => {
    // if this throws, only this savepoint is rolled back
    return sql`INSERT INTO ${OrderItem} ${OrderItem.insertColsVals(item)}`.one({ db: c });
  });
});
```

You can also pass an explicit name as the first argument:

```typescript
await savepoint(client, 'insert_item', async (c) => { /* ... */ });
```

---

## MS SQL Server

```typescript
import { transaction, savepoint } from 'vexnor-mssql';
```

### `transaction(pool, callback, options?)`

Begins a transaction on the pool, runs the callback, then commits. Rolls back and re-throws if the callback throws. The callback receives the `Transaction` object — use `tx.request()` to create a request for each query.

```typescript
await transaction(pool, async (tx) => {
  const request = tx.request();
  await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.one({ db: request });
});
```

Options:

| Option | Type | Default |
|---|---|---|
| `isolationLevel` | `"READ_UNCOMMITTED" \| "READ_COMMITTED" \| "REPEATABLE_READ" \| "SERIALIZABLE" \| "SNAPSHOT"` | `"READ_COMMITTED"` |

### `savepoint(tx, callback)`

Creates a named savepoint (`SAVE TRANSACTION`) inside an existing transaction. If the callback throws, issues `ROLLBACK TRANSACTION <name>` and returns `undefined`. MSSQL has no `RELEASE SAVEPOINT` — savepoints are released automatically on commit.

```typescript
await transaction(pool, async (tx) => {
  const item = await savepoint(tx, async (request) => {
    return sql`INSERT INTO ${OrderItem} ${OrderItem.insertColsVals(item)}`.one({ db: request });
  });
});
```

---

## SQLite

```typescript
import { transaction, savepoint } from 'vexnor-sqlite3';
```

### `transaction(db, callback, options?)`

Begins a transaction, runs the callback, then commits. Rolls back and re-throws if the callback throws. The callback receives the same `Database` instance.

```typescript
await transaction(database, async (db) => {
  await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.one({ db });
});
```

Options:

| Option | Type | Default |
|---|---|---|
| `behavior` | `"DEFERRED" \| "IMMEDIATE" \| "EXCLUSIVE"` | `"DEFERRED"` |

### `savepoint(db, callback)`

Creates a savepoint inside an existing transaction. If the callback throws, rolls back to the savepoint and returns `undefined`. If it succeeds, releases the savepoint and returns the result.

```typescript
await transaction(database, async (db) => {
  const item = await savepoint(db, async (d) => {
    return sql`INSERT INTO ${OrderItem} ${OrderItem.insertColsVals(item)}`.one({ db: d });
  });
});
```
