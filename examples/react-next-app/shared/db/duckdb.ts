import type { DuckDBConnection } from "@duckdb/node-api";
import { VexnorDuckDB } from "@vexnor/duckdb";
import path from "node:path";

let duckDbPromise: Promise<DuckDBConnection> | undefined;

export function getDuckDb(): Promise<DuckDBConnection> {
   return (duckDbPromise ??= new VexnorDuckDB()
      .createConnection({
         config: {
            mode: "file",
            path: path.resolve(process.cwd(), process.env.DUCKDB_PATH ?? "../../@db-duckdb/vexnor-dev.duckdb"),
         },
      })
      .then(({ db }) => db));
}
