import { DuckDBInstance } from "@duckdb/node-api";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DUCKDB_PATH = fileURLToPath(new URL("../vexnor-dev.duckdb", import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL("../../../@db-duckdb/schema.sql", import.meta.url));

export async function createTestDatabase(): Promise<void> {
   rmSync(DUCKDB_PATH, { force: true });
   rmSync(`${DUCKDB_PATH}.wal`, { force: true });

   const instance = await DuckDBInstance.create(DUCKDB_PATH);
   const connection = await instance.connect();
   try {
      await connection.run(readFileSync(SCHEMA_PATH, "utf8"));
   } finally {
      connection.closeSync();
      instance.closeSync();
   }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
   await createTestDatabase();
}
