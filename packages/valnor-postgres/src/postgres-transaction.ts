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
