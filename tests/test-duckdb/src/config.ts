import type { DuckDBConnection } from "@duckdb/node-api";
import { VexnorDuckDB } from "@vexnor/duckdb";
import { DUCKDB_PATH } from "./create-test-database.js";

const plugin = new VexnorDuckDB();
const connection = await plugin.createConnection({ config: { mode: "file", path: DUCKDB_PATH } });

export const db: DuckDBConnection = connection.db;
export const closeDatabase = () => connection.close();
export { DUCKDB_PATH };
