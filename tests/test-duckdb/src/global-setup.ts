import type { TestProject } from "vitest/node";
import { createTestDatabase, DUCKDB_PATH } from "./create-test-database.js";

export default async function (_project: TestProject) {
   await createTestDatabase();
   return () => {
      process.stdout.write(`DuckDB e2e database completed at ${DUCKDB_PATH}\n`);
   };
}
