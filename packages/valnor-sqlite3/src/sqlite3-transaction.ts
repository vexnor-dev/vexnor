import type { Database } from "better-sqlite3";

export type Sqlite3TransactionBehavior = "DEFERRED" | "IMMEDIATE" | "EXCLUSIVE";

export type Sqlite3TransactionOptions = {
   behavior?: Sqlite3TransactionBehavior;
};

const DEFAULTS: Required<Sqlite3TransactionOptions> = {
   behavior: "DEFERRED",
};

/**
 * Executes a callback inside a SQLite transaction.
 *
 * Begins a transaction with the specified behavior, runs the callback,
 * then commits. Rolls back automatically if the callback throws.
 *
 * @param db - The `better-sqlite3` `Database` instance.
 * @param callback - Async function that receives the database and runs queries.
 * @param options - Optional transaction settings (behavior: DEFERRED, IMMEDIATE, or EXCLUSIVE).
 *
 * @example
 * await transaction(database, async (db) => {
 *   await sql`INSERT INTO ${Account} ${Account.insertColsVals(data)}`.getOneRequired({ db });
 * });
 */
export async function transaction<T>(
   db: Database,
   callback: (db: Database) => Promise<T>,
   options?: Sqlite3TransactionOptions,
): Promise<T> {
   const { behavior } = { ...DEFAULTS, ...options };
   db.prepare(`BEGIN ${behavior}`).run();
   let result: T;
   try {
      result = await callback(db);
   } catch (err) {
      db.prepare("ROLLBACK").run();
      throw err;
   }
   db.prepare("COMMIT").run();
   return result;
}

/**
 * Creates a savepoint within an existing SQLite transaction and runs a callback inside it.
 *
 * If the callback throws, rolls back to the savepoint and returns `undefined`.
 * If it succeeds, releases the savepoint and returns the result.
 *
 * @param db - The `better-sqlite3` `Database` instance.
 * @param callbackOrName - Either a savepoint name string, or the callback directly (name is auto-generated).
 * @param callback - The callback to run inside the savepoint (required when `callbackOrName` is a string).
 */
export async function savepoint<T>(
   db: Database,
   callbackOrName: ((db: Database) => Promise<T>) | string,
   callback?: (db: Database) => Promise<T>,
): Promise<T | undefined> {
   let name: string;
   let fn: (db: Database) => Promise<T>;
   if (typeof callbackOrName === "string") {
      name = callbackOrName;
      fn = callback!;
   } else {
      name = `sp_${Math.random().toString(36).slice(2, 10)}`;
      fn = callbackOrName;
   }

   db.prepare(`SAVEPOINT ${name}`).run();
   try {
      const result = await fn(db);
      db.prepare(`RELEASE SAVEPOINT ${name}`).run();
      return result;
   } catch {
      db.prepare(`ROLLBACK TO SAVEPOINT ${name}`).run();
      return undefined;
   }
}
