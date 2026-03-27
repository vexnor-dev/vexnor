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
