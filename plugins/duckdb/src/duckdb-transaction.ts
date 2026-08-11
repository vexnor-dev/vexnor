import type { DuckDBConnection } from "@duckdb/node-api";

export async function transaction<T>(connection: DuckDBConnection, callback: (connection: DuckDBConnection) => Promise<T>): Promise<T> {
   await connection.run("BEGIN TRANSACTION");
   try {
      const result = await callback(connection);
      await connection.run("COMMIT");
      return result;
   } catch (error) {
      await connection.run("ROLLBACK");
      throw error;
   }
}

export class DuckDBUnsupportedError extends Error {
   readonly code = "DUCKDB_UNSUPPORTED";

   constructor(feature: string) {
      super(`DuckDB does not support ${feature}`);
      this.name = "DuckDBUnsupportedError";
   }
}

export function savepoint(): never {
   throw new DuckDBUnsupportedError("savepoints");
}
