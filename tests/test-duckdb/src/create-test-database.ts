import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

export const DUCKDB_PATH = fileURLToPath(new URL("../vexnor-dev.duckdb", import.meta.url));
const CREATE_DATABASE_PATH = fileURLToPath(new URL("../../../@db-duckdb/create-database.ts", import.meta.url));
const execFileAsync = promisify(execFile);

export async function createTestDatabase(): Promise<void> {
   await execFileAsync(process.execPath, ["--import", "tsx", CREATE_DATABASE_PATH, DUCKDB_PATH]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
   await createTestDatabase();
}
