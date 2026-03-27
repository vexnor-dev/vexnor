import type { Database } from "better-sqlite3";

export type Sqlite3TransactionBehavior = "DEFERRED" | "IMMEDIATE" | "EXCLUSIVE";

export type Sqlite3TransactionOptions = {
   behavior?: Sqlite3TransactionBehavior;
};

const DEFAULTS: Required<Sqlite3TransactionOptions> = {
   behavior: "DEFERRED",
};

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
