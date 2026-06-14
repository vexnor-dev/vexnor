# Transactions

Each driver package exports a `transaction()` function and a `savepoint()` function. Both follow the same pattern: pass your pool/db, get a connection-scoped handle back in the callback, run queries against it, and the outer function commits or rolls back automatically.

## PostgreSQL

```typescript
import { transaction, savepoint } from '@vexnor/postgres';
```

### `transaction(pool, callback, options?)`

Acquires a dedicated `PoolClient` from the pool, opens a transaction, runs the callback, then commits. Rolls back and re-throws if the callback throws. The client is always released back to the pool.

```typescript
await transaction(pool, async (client) => {
  await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.postgres.one({ db: client });
  await sql`UPDATE ${Order} SET ${Order.updateSet({ status: 'confirmed' })} WHERE ...`.postgres.one({ db: client });
});
```

Options:

| Option | Type | Default |
|---|---|---|
| `isolationLevel` | `"READ UNCOMMITTED" \| "READ COMMITTED" \| "REPEATABLE READ" \| "SERIALIZABLE"` | `"READ COMMITTED"` |
| `accessMode` | `"READ WRITE" \| "READ ONLY"` | `"READ WRITE"` |
| `deferrable` | `"DEFERRABLE" \| "NOT DEFERRABLE"` | `"NOT DEFERRABLE"` |

#### Serializable Isolation

Use `SERIALIZABLE` for transactions requiring strict consistency:

```typescript
await transaction(pool, async (client) => {
  const balance = await sql`
    SELECT ${row(Account.$balance)}
    FROM ${Account}
    WHERE ${Account.$accountId} = ${accountId}
  `.postgres.one({ db: client });

  await sql`
    UPDATE ${Account}
    SET ${Account.updateSet({ balance: balance.balance - amount })}
    WHERE ${Account.$accountId} = ${accountId}
  `.postgres.run({ db: client });
}, { isolationLevel: 'SERIALIZABLE' });
```

#### Read-Only Transactions

```typescript
await transaction(pool, async (client) => {
  const accounts = await findActiveAccounts.postgres.all({ db: client });
  const orders = await findRecentOrders.postgres.all({ db: client });
  return { accounts, orders };
}, { accessMode: 'READ ONLY' });
```

### `savepoint(client, callback)`

Creates a savepoint inside an existing transaction. If the callback throws, rolls back to the savepoint and returns `undefined`. If it succeeds, releases the savepoint and returns the result.

```typescript
await transaction(pool, async (client) => {
  await sql`INSERT INTO ${Order} ${Order.insertColsVals(order)}`.postgres.one({ db: client });

  const item = await savepoint(client, async (c) => {
    // if this throws, only this savepoint is rolled back
    return sql`INSERT INTO ${OrderItem} ${OrderItem.insertColsVals(item)}`.postgres.one({ db: c });
  });

  if (!item) {
    // savepoint was rolled back — handle gracefully
    console.warn('Order item insert failed, continuing without it');
  }
});
```

You can also pass an explicit name as the first argument:

```typescript
await savepoint(client, 'insert_item', async (c) => { /* ... */ });
```

### Nested Savepoints

Savepoints can be nested — each creates an independent rollback point:

```typescript
await transaction(pool, async (client) => {
  await sql`INSERT INTO ${Order} ${Order.insertColsVals(order)}`.postgres.one({ db: client });

  await savepoint(client, async (c) => {
    await sql`INSERT INTO ${OrderItem} ${OrderItem.insertColsVals(item1)}`.postgres.one({ db: c });

    // Nested savepoint
    const bonus = await savepoint(c, async (c2) => {
      return sql`INSERT INTO ${Bonus} ${Bonus.insertColsVals(bonusData)}`.postgres.one({ db: c2 });
    });
  });
});
```

---

## MS SQL Server

```typescript
import { transaction, savepoint } from '@vexnor/mssql';
```

### `transaction(pool, callback, options?)`

Begins a transaction on the pool, runs the callback, then commits. Rolls back and re-throws if the callback throws. The callback receives the `Transaction` object — use `tx.request()` to create a request for each query.

```typescript
await transaction(pool, async (tx) => {
  const request = tx.request();
  await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.mssql.one({ db: request });
});
```

Options:

| Option | Type | Default |
|---|---|---|
| `isolationLevel` | `"READ_UNCOMMITTED" \| "READ_COMMITTED" \| "REPEATABLE_READ" \| "SERIALIZABLE" \| "SNAPSHOT"` | `"READ_COMMITTED"` |

#### SNAPSHOT Isolation

MSSQL supports `SNAPSHOT` isolation for optimistic concurrency:

```typescript
await transaction(pool, async (tx) => {
  const request = tx.request();
  // reads see a consistent snapshot without taking locks
  const accounts = await findAccounts.mssql.all({ db: request });
}, { isolationLevel: 'SNAPSHOT' });
```

### `savepoint(tx, callback)`

Creates a named savepoint (`SAVE TRANSACTION`) inside an existing transaction. If the callback throws, issues `ROLLBACK TRANSACTION <name>` and returns `undefined`. MSSQL has no `RELEASE SAVEPOINT` — savepoints are released automatically on commit.

```typescript
await transaction(pool, async (tx) => {
  const item = await savepoint(tx, async (request) => {
    return sql`INSERT INTO ${OrderItem} ${OrderItem.insertColsVals(item)}`.mssql.one({ db: request });
  });
});
```

You can also pass an explicit name:

```typescript
await savepoint(tx, 'insert_item', async (request) => { /* ... */ });
```

---

## SQLite

```typescript
import { transaction, savepoint } from '@vexnor/sqlite3';
```

### `transaction(db, callback, options?)`

Begins a transaction, runs the callback, then commits. Rolls back and re-throws if the callback throws. The callback receives the same `Database` instance.

```typescript
await transaction(database, async (db) => {
  await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.sqlite.one({ db });
});
```

Options:

| Option | Type | Default |
|---|---|---|
| `behavior` | `"DEFERRED" \| "IMMEDIATE" \| "EXCLUSIVE"` | `"DEFERRED"` |

#### Transaction Behaviors

- `DEFERRED` — locks are acquired lazily on the first read or write
- `IMMEDIATE` — acquires a write lock immediately, preventing other writers
- `EXCLUSIVE` — acquires an exclusive lock, preventing all other connections from reading or writing

```typescript
// Prevent write conflicts in concurrent access scenarios
await transaction(database, async (db) => {
  await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.sqlite.one({ db });
}, { behavior: 'IMMEDIATE' });
```

### `savepoint(db, callback)`

Creates a savepoint inside an existing transaction. If the callback throws, rolls back to the savepoint and returns `undefined`. If it succeeds, releases the savepoint and returns the result.

```typescript
await transaction(database, async (db) => {
  const item = await savepoint(db, async (d) => {
    return sql`INSERT INTO ${OrderItem} ${OrderItem.insertColsVals(item)}`.sqlite.one({ db: d });
  });
});
```

You can also pass an explicit name:

```typescript
await savepoint(db, 'insert_item', async (d) => { /* ... */ });
```

---

## Error Handling

All transaction functions follow the same error contract:

1. If the callback throws, the transaction is rolled back automatically
2. The original error is re-thrown — your application catches it as normal
3. The connection is always cleaned up (released to pool / closed)

```typescript
try {
  await transaction(pool, async (client) => {
    await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.postgres.one({ db: client });
    throw new Error('Business logic failure');
  });
} catch (err) {
  // Transaction was rolled back, client released
  console.error('Transaction failed:', err.message);
}
```

### Savepoint Error Recovery

Savepoints return `undefined` on failure instead of throwing — allowing partial-failure workflows:

```typescript
await transaction(pool, async (client) => {
  const results = [];

  for (const item of items) {
    const result = await savepoint(client, async (c) => {
      return sql`INSERT INTO ${OrderItem} ${OrderItem.insertColsVals(item)}`.postgres.one({ db: c });
    });

    if (result) {
      results.push(result);
    } else {
      // This item failed — the rest of the transaction continues
      console.warn(`Failed to insert item ${item.name}`);
    }
  }

  return results;
});
```

---

## Return Values

Both `transaction()` and `savepoint()` return the callback's return value:

```typescript
const account = await transaction(pool, async (client) => {
  return sql`
    INSERT INTO ${Account} ${Account.insertColsVals(data)}
    RETURNING ${row(Account.$$)}
  `.postgres.one({ db: client });
});
// account: IAccountSelect
```
