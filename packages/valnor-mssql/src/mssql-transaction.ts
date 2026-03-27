import mssql, { ConnectionPool, Request, Transaction } from "mssql";

export type MssqlIsolationLevel =
   | "READ_UNCOMMITTED"
   | "READ_COMMITTED"
   | "REPEATABLE_READ"
   | "SERIALIZABLE"
   | "SNAPSHOT";

export type MssqlTransactionOptions = {
   isolationLevel?: MssqlIsolationLevel;
};

const DEFAULTS: Required<MssqlTransactionOptions> = {
   isolationLevel: "READ_COMMITTED",
};

/**
 * Executes a callback inside an MS SQL Server transaction.
 *
 * Begins a transaction on the pool with the specified isolation level,
 * runs the callback, then commits. Rolls back automatically if the callback throws.
 *
 * @param pool - The `mssql` `ConnectionPool`.
 * @param callback - Async function that receives the `Transaction` and runs queries via `tx.request()`.
 * @param options - Optional transaction settings (isolation level).
 *
 * @example
 * await transaction(pool, async (tx) => {
 *   const request = tx.request();
 *   await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.getOneRequired({ db: request });
 * });
 */
export async function transaction<T>(
   pool: ConnectionPool,
   callback: (tx: Transaction) => Promise<T>,
   options?: MssqlTransactionOptions,
): Promise<T> {
   const { isolationLevel } = { ...DEFAULTS, ...options };
   const tx = new Transaction(pool);
   await tx.begin(mssql.ISOLATION_LEVEL[isolationLevel]);
   let result: T;
   try {
      result = await callback(tx);
   } catch (err) {
      await tx.rollback();
      throw err;
   }
   await tx.commit();
   return result;
}

/**
 * Creates a named savepoint within an existing MSSQL transaction and runs a callback inside it.
 *
 * If the callback throws, rolls back to the savepoint and returns `undefined`.
 * If it succeeds, returns the result (MSSQL savepoints are released automatically on commit).
 *
 * @param tx - The `Transaction` obtained from `transaction()`.
 * @param callbackOrName - Either a savepoint name string, or the callback directly (name is auto-generated).
 * @param callback - The callback to run inside the savepoint (required when `callbackOrName` is a string).
 */
export async function savepoint<T>(
   tx: Transaction,
   callbackOrName: ((request: Request) => Promise<T>) | string,
   callback?: (request: Request) => Promise<T>,
): Promise<T | undefined> {
   let name: string;
   let fn: (request: Request) => Promise<T>;
   if (typeof callbackOrName === "string") {
      name = callbackOrName;
      fn = callback!;
   } else {
      name = `sp_${Math.random().toString(36).slice(2, 10)}`;
      fn = callbackOrName;
   }

   await tx.request().query(`SAVE TRANSACTION ${name}`);
   try {
      const result = await fn(tx.request());
      // MSSQL has no RELEASE SAVEPOINT — savepoints are released automatically on commit
      return result;
   } catch {
      await tx.request().query(`ROLLBACK TRANSACTION ${name}`);
      return undefined;
   }
}
