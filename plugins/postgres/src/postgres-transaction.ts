import type { Pool, PoolClient } from "pg";

export type PostgresIsolationLevel = "READ UNCOMMITTED" | "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";
export type PostgresAccessMode = "READ WRITE" | "READ ONLY";
export type PostgresDeferrable = "DEFERRABLE" | "NOT DEFERRABLE";

export type PostgresTransactionOptions = {
   isolationLevel?: PostgresIsolationLevel;
   accessMode?: PostgresAccessMode;
   deferrable?: PostgresDeferrable;
};

const DEFAULTS: Required<PostgresTransactionOptions> = {
   isolationLevel: "READ COMMITTED",
   accessMode: "READ WRITE",
   deferrable: "NOT DEFERRABLE",
};

/**
 * Executes a callback inside a PostgreSQL transaction.
 *
 * Acquires a client from the pool, begins a transaction with the specified
 * isolation level and access mode, runs the callback, then commits. Rolls back
 * automatically if the callback throws.
 *
 * @param pool - The `pg` connection pool.
 * @param callback - Async function that receives the dedicated `PoolClient` and runs queries.
 * @param options - Optional transaction settings (isolation level, access mode, deferrable).
 *
 * @example
 * await transaction(pool, async (client) => {
 *   await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.getOneRequired({ db: client });
 *   await sql`UPDATE ${Order} SET ${Order.updateSet({ status: "confirmed" })} WHERE ...`.getOneRequired({ db: client });
 * });
 */
export async function transaction<T>(
   pool: Pool,
   callback: (client: PoolClient) => Promise<T>,
   options?: PostgresTransactionOptions,
): Promise<T> {
   const { isolationLevel, accessMode, deferrable } = { ...DEFAULTS, ...options };
   const client = await pool.connect();
   try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel} ${accessMode} ${deferrable}`);
      let result: T;
      try {
         result = await callback(client);
      } catch (err) {
         await client.query("ROLLBACK");
         throw err;
      }
      await client.query("COMMIT");
      return result;
   } finally {
      client.release();
   }
}

/**
 * Creates a savepoint within an existing transaction and runs a callback inside it.
 *
 * If the callback throws, rolls back to the savepoint and returns `undefined`.
 * If it succeeds, releases the savepoint and returns the result.
 *
 * @param client - The `PoolClient` obtained from `transaction()`.
 * @param callbackOrName - Either a savepoint name string, or the callback directly (name is auto-generated).
 * @param callback - The callback to run inside the savepoint (required when `callbackOrName` is a string).
 */
export async function savepoint<T>(
   client: PoolClient,
   callbackOrName: ((client: PoolClient) => Promise<T>) | string,
   callback?: (client: PoolClient) => Promise<T>,
): Promise<T | undefined> {
   let name: string;
   let fn: (client: PoolClient) => Promise<T>;
   if (typeof callbackOrName === "string") {
      name = callbackOrName;
      fn = callback!;
   } else {
      name = `sp_${Math.random().toString(36).slice(2, 10)}`;
      fn = callbackOrName;
   }

   await client.query(`SAVEPOINT ${name}`);
   try {
      const result = await fn(client);
      await client.query(`RELEASE SAVEPOINT ${name}`);
      return result;
   } catch {
      await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
      return undefined;
   }
}
