import { DuckDBInstance } from "@duckdb/node-api";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databasePath = resolve(process.argv[2] ?? fileURLToPath(new URL("./vexnor-dev.duckdb", import.meta.url)));
const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));

rmSync(databasePath, { force: true });
rmSync(`${databasePath}.wal`, { force: true });

const instance = await DuckDBInstance.create(databasePath);
const connection = await instance.connect();

try {
   await connection.run(readFileSync(schemaPath, "utf8"));
} finally {
   connection.closeSync();
   instance.closeSync();
}
