import { info, SqlInsertRowsCommand, SqlInsertRowsParams, SqlQueryColumns, SqlTable } from "@vexnor/core";
import { DuckDBQueryHandler } from "#src/duckdb-query-handler.js";
import "#src/duckdb-augment.js";

export type DuckDBInsertRowsCommandResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   DuckDBQueryHandler<{ Params: SqlInsertRowsParams<T, "rows">; Row: T["Select"] }> & SqlQueryColumns<T["Select"]>;

export class DuckDBInsertRowsCommand<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>
   extends SqlInsertRowsCommand<T> {
   constructor(table: SqlTable<T>) {
      super(table, info({ driver: "duckdb" }));
   }

   execute(): DuckDBInsertRowsCommandResult<T> {
      return this.build().duckdb as DuckDBInsertRowsCommandResult<T>;
   }
}
